"""
使用预训练模型进行实时情绪检测
"""

import cv2
import numpy as np
from keras.models import load_model
from keras.preprocessing.image import img_to_array

# 加载预训练模型
model_path = 'models/_mini_XCEPTION.102-0.66.hdf5'
model = load_model(model_path, compile=False)

# 情绪标签
EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]

# 加载人脸检测器
face_cascade = cv2.CascadeClassifier('haarcascade_files/haarcascade_frontalface_default.xml')

def detect_emotion(frame):
    """检测图像中的情绪"""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    results = []
    for (x, y, w, h) in faces:
        # 提取人脸区域
        roi = gray[y:y+h, x:x+w]
        roi = cv2.resize(roi, (48, 48))
        roi = roi.astype("float") / 255.0
        roi = img_to_array(roi)
        roi = np.expand_dims(roi, axis=0)
        roi = np.expand_dims(roi, axis=-1)
        
        # 预测情绪
        preds = model.predict(roi, verbose=0)[0]
        emotion_probability = np.max(preds)
        label = EMOTIONS[preds.argmax()]
        
        results.append({
            'face': (x, y, w, h),
            'emotion': label,
            'confidence': float(emotion_probability),
            'probabilities': {EMOTIONS[i]: float(preds[i]) for i in range(len(EMOTIONS))}
        })
    
    return results

def test_on_image(image_path):
    """测试单张图片"""
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"无法加载图片: {image_path}")
        return
    
    results = detect_emotion(frame)
    print(f"检测到 {len(results)} 张人脸")
    
    for i, result in enumerate(results):
        print(f"\n人脸 {i+1}:")
        print(f"  情绪: {result['emotion']} ({result['confidence']:.2%})")
        print(f"  概率分布:")
        for emotion, prob in sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True):
            print(f"    {emotion}: {prob:.2%}")

if __name__ == "__main__":
    print("预训练模型加载成功!")
    print("模型输入形状:", model.input_shape)
    print("模型输出形状:", model.output_shape)
    print("\n支持的7种情绪:", EMOTIONS)
