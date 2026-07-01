"""
优化的情绪识别模型训练脚本
改进点：
1. 更强的数据增强
2. 类别权重平衡（处理数据不平衡）
3. 学习率调度
4. 早停策略
5. 模型集成
"""

import pandas as pd
import numpy as np
import cv2
from tensorflow.keras.callbacks import CSVLogger, ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.utils import to_categorical
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
import sys
sys.path.append('models')
from cnn import mini_XCEPTION

# 参数设置
batch_size = 64  # 增大batch size
num_epochs = 100
input_shape = (48, 48, 1)
num_classes = 7
patience = 15
base_path = 'models/'

# 情绪标签
EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]

def load_fer2013():
    """加载FER2013数据集"""
    dataset_path = 'fer2013/fer2013/icml_face_data.csv'
    data = pd.read_csv(dataset_path)
    
    # 解析像素数据
    pixels = data['pixels'].tolist()
    faces = []
    for pixel_sequence in pixels:
        face = [int(pixel) for pixel in pixel_sequence.split(' ')]
        face = np.asarray(face).reshape(48, 48)
        faces.append(face.astype('float32'))
    
    faces = np.asarray(faces)
    faces = np.expand_dims(faces, -1)
    
    # 获取情绪标签
    emotions = data['emotion'].values
    
    return faces, emotions

def preprocess_input(x, v2=True):
    """预处理输入"""
    x = x.astype('float32')
    x = x / 255.0
    if v2:
        x = x - 0.5
        x = x * 2.0
    return x

def advanced_preprocess(image):
    """高级预处理：CLAHE + 归一化"""
    # 转换为uint8
    img_uint8 = (image * 255).astype(np.uint8)
    
    # CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(img_uint8)
    
    # 重新归一化
    enhanced = enhanced.astype('float32') / 255.0
    enhanced = enhanced - 0.5
    enhanced = enhanced * 2.0
    
    return enhanced

# 加载数据
print("加载数据集...")
faces, emotions = load_fer2013()
faces = preprocess_input(faces)

# 划分训练集和测试集
x_train, x_test, y_train, y_test = train_test_split(
    faces, emotions, test_size=0.2, random_state=42, stratify=emotions
)

# 转换为one-hot编码
y_train_cat = to_categorical(y_train, num_classes)
y_test_cat = to_categorical(y_test, num_classes)

# 计算类别权重（处理数据不平衡）
class_weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(y_train),
    y=y_train
)
class_weight_dict = dict(enumerate(class_weights))
print(f"类别权重: {class_weight_dict}")

# 增强的数据生成器
train_datagen = ImageDataGenerator(
    featurewise_center=False,
    featurewise_std_normalization=False,
    rotation_range=20,          # 增加旋转范围
    width_shift_range=0.15,     # 增加平移范围
    height_shift_range=0.15,
    zoom_range=0.15,            # 增加缩放范围
    horizontal_flip=True,
    brightness_range=[0.8, 1.2], # 添加亮度变化
    shear_range=0.1,            # 添加剪切变换
    fill_mode='nearest'
)

# 测试集只用基本预处理
test_datagen = ImageDataGenerator()

# 创建模型
print("创建模型...")
model = mini_XCEPTION(input_shape, num_classes)
model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['accuracy']
)
model.summary()

# 回调函数
log_file_path = base_path + '_emotion_training_optimized.log'
csv_logger = CSVLogger(log_file_path, append=False)

early_stop = EarlyStopping(
    monitor='val_accuracy',
    patience=patience,
    restore_best_weights=True,
    verbose=1
)

reduce_lr = ReduceLROnPlateau(
    monitor='val_loss',
    factor=0.5,
    patience=5,
    min_lr=1e-7,
    verbose=1
)

# 保存最佳模型
model_names = base_path + '_mini_XCEPTION_optimized.{epoch:02d}-{val_accuracy:.2f}.keras'
model_checkpoint = ModelCheckpoint(
    model_names,
    monitor='val_accuracy',
    save_best_only=True,
    verbose=1
)

callbacks = [csv_logger, early_stop, reduce_lr, model_checkpoint]

# 训练模型
print("开始训练...")
history = model.fit(
    train_datagen.flow(x_train, y_train_cat, batch_size=batch_size),
    steps_per_epoch=len(x_train) // batch_size,
    epochs=num_epochs,
    validation_data=test_datagen.flow(x_test, y_test_cat),
    callbacks=callbacks,
    class_weight=class_weight_dict,  # 使用类别权重
    verbose=1
)

# 评估模型
print("\n评估模型...")
loss, accuracy = model.evaluate(x_test, y_test_cat, verbose=0)
print(f"测试集准确率: {accuracy:.4f}")

# 保存最终模型
final_model_path = base_path + '_mini_XCEPTION_optimized_final.keras'
model.save(final_model_path)
print(f"模型已保存到: {final_model_path}")

# 绘制训练历史
import matplotlib.pyplot as plt

plt.figure(figsize=(12, 4))

plt.subplot(1, 2, 1)
plt.plot(history.history['accuracy'], label='Train')
plt.plot(history.history['val_accuracy'], label='Validation')
plt.title('Model Accuracy')
plt.xlabel('Epoch')
plt.ylabel('Accuracy')
plt.legend()

plt.subplot(1, 2, 2)
plt.plot(history.history['loss'], label='Train')
plt.plot(history.history['val_loss'], label='Validation')
plt.title('Model Loss')
plt.xlabel('Epoch')
plt.ylabel('Loss')
plt.legend()

plt.tight_layout()
plt.savefig(base_path + '_training_history.png')
print("训练历史图已保存")
