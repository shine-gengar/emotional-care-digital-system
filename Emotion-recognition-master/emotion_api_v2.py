"""
优化的情绪检测API服务 v2.0
改进点：
1. 使用TensorFlow 2.x + Keras 3.x
2. 添加图像预处理增强
3. 添加时序平滑
4. 添加置信度阈值
5. 支持批量检测
6. 添加调试模式
"""

import sys
# 添加新依赖路径
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import logging
from collections import deque
import time
import json

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# 全局CORS配置 - 允许所有来源
CORS(app, origins="*", supports_credentials=False)

# 添加CORS头到所有响应
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# 全局变量
model = None
face_cascade = None
emotion_history = deque(maxlen=5)  # 减少历史长度，更敏感
last_result = None

# 情绪标签
EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]
EMOTION_LABELS = {
    'angry': '愤怒',
    'disgust': '厌恶',
    'scared': '害怕',
    'happy': '开心',
    'sad': '悲伤',
    'surprised': '惊讶',
    'neutral': '平静'
}

# 情绪优先级（某些情绪更容易被检测到）
EMOTION_PRIORITY = {
    'happy': 1.0,
    'sad': 1.0,
    'angry': 1.0,
    'surprised': 1.0,
    'scared': 0.9,
    'disgust': 0.9,
    'neutral': 0.7
}

def load_model_and_detector():
    """加载预训练模型和人脸检测器"""
    global model, face_cascade
    
    try:
        import tensorflow as tf
        from tensorflow import keras
        
        # 设置TensorFlow日志级别
        tf.get_logger().setLevel('ERROR')
        
        # 加载预训练模型
        model_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\models\_mini_XCEPTION.102-0.66.hdf5'
        logger.info(f"正在加载模型: {model_path}")
        
        model = keras.models.load_model(model_path, compile=False)
        logger.info(f"模型加载成功! 输入形状: {model.input_shape}")
        
        # 加载人脸检测器
        cascade_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\haarcascade_files\haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        logger.info("人脸检测器加载成功!")
        
        return True
    except Exception as e:
        logger.error(f"加载模型失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def decode_base64_image(base64_string):
    """解码base64编码的图像"""
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        img_data = base64.b64decode(base64_string)
        img = Image.open(BytesIO(img_data))
        img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        return img
    except Exception as e:
        logger.error(f"解码图像失败: {e}")
        return None

def preprocess_face(face_img, target_size=(48, 48)):
    """预处理人脸图像"""
    # 调整大小
    face_img = cv2.resize(face_img, target_size)
    
    # 直方图均衡化
    face_img = cv2.equalizeHist(face_img.astype(np.uint8))
    
    # 归一化
    face_img = face_img.astype("float32") / 255.0
    
    return face_img

def apply_temperature_scaling(probs, temperature=0.7):
    """应用温度缩放，使分布更尖锐"""
    log_probs = np.log(probs + 1e-8)
    scaled = log_probs / temperature
    exp_scaled = np.exp(scaled)
    return exp_scaled / np.sum(exp_scaled)

def temporal_smoothing(current_probs, alpha=0.7):
    """时序平滑"""
    global emotion_history
    
    if len(emotion_history) == 0:
        return current_probs
    
    # 获取上一帧的结果
    last_probs = emotion_history[-1]
    
    # 指数加权平均
    smoothed = {}
    for emotion in EMOTIONS:
        smoothed[emotion] = alpha * current_probs[emotion] + (1 - alpha) * last_probs[emotion]
    
    return smoothed

def detect_emotion_from_frame(frame, use_smoothing=True, debug=False):
    """从视频帧中检测情绪"""
    global model, face_cascade, emotion_history, last_result
    
    if model is None or face_cascade is None:
        return {'error': '模型未加载', 'success': False}
    
    debug_info = {}
    
    try:
        # 转换为灰度图
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        debug_info['original_shape'] = gray.shape
        
        # 人脸检测
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(48, 48),
            maxSize=(gray.shape[1]//2, gray.shape[0]//2)
        )
        
        debug_info['faces_detected'] = len(faces)
        
        if len(faces) == 0:
            return {
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0,
                'debug': debug_info if debug else None
            }
        
        results = []
        
        for (x, y, w, h) in faces:
            # 提取人脸区域
            face_roi = gray[y:y+h, x:x+w]
            
            # 预处理
            processed_face = preprocess_face(face_roi, (48, 48))
            
            # 准备模型输入
            face_input = np.expand_dims(processed_face, axis=0)
            face_input = np.expand_dims(face_input, axis=-1)
            
            # 预测
            preds = model.predict(face_input, verbose=0)[0]
            
            # 应用温度缩放
            scaled_preds = apply_temperature_scaling(preds, temperature=0.6)
            
            # 构建概率字典
            probabilities = {EMOTIONS[i]: float(scaled_preds[i]) for i in range(len(EMOTIONS))}
            
            # 应用时序平滑
            if use_smoothing:
                probabilities = temporal_smoothing(probabilities, alpha=0.6)
            
            # 保存到历史
            emotion_history.append(probabilities)
            
            # 找到最高概率的情绪
            max_emotion = max(probabilities, key=probabilities.get)
            max_prob = probabilities[max_emotion]
            
            # 置信度阈值
            CONFIDENCE_THRESHOLD = 0.35
            
            # 如果置信度太低，检查第二高概率的情绪
            if max_prob < CONFIDENCE_THRESHOLD:
                sorted_emotions = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
                if len(sorted_emotions) > 1:
                    second_emotion, second_prob = sorted_emotions[1]
                    # 如果第二情绪概率接近且优先级更高，选择它
                    if second_prob > max_prob * 0.8 and EMOTION_PRIORITY[second_emotion] > EMOTION_PRIORITY[max_emotion]:
                        max_emotion = second_emotion
                        max_prob = second_prob
            
            result = {
                'face': {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h)
                },
                'emotion': max_emotion,
                'emotion_label': EMOTION_LABELS[max_emotion],
                'confidence': round(max_prob * 100, 1),
                'is_confident': max_prob >= CONFIDENCE_THRESHOLD,
                'probabilities': {k: round(v * 100, 1) for k, v in probabilities.items()}
            }
            
            if debug:
                result['raw_predictions'] = {EMOTIONS[i]: round(float(preds[i]) * 100, 1) for i in range(len(EMOTIONS))}
            
            results.append(result)
        
        return {
            'success': True,
            'faces_detected': len(results),
            'results': results,
            'debug': debug_info if debug else None
        }
        
    except Exception as e:
        logger.error(f"情绪检测失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e),
            'debug': debug_info if debug else None
        }

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'detector_loaded': face_cascade is not None,
        'history_size': len(emotion_history),
        'emotions_supported': EMOTIONS
    })

@app.route('/detect', methods=['POST'])
def detect_emotion():
    """情绪检测接口"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': '缺少image字段'}), 400
        
        # 解码图像
        frame = decode_base64_image(data['image'])
        if frame is None:
            return jsonify({'success': False, 'error': '无法解码图像'}), 400
        
        # 获取参数
        use_smoothing = data.get('smoothing', True)
        debug = data.get('debug', False)
        
        # 检测情绪
        result = detect_emotion_from_frame(frame, use_smoothing, debug)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"处理请求失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/reset', methods=['POST'])
def reset_history():
    """重置情绪历史"""
    global emotion_history
    emotion_history.clear()
    return jsonify({'success': True, 'message': '情绪历史已重置'})

@app.route('/emotions', methods=['GET'])
def get_emotions():
    """获取支持的情绪列表"""
    return jsonify({
        'emotions': EMOTIONS,
        'emotion_labels': EMOTION_LABELS,
        'emotion_priority': EMOTION_PRIORITY
    })

@app.route('/', methods=['GET'])
def index():
    """根路径"""
    return jsonify({
        'message': '情绪识别API服务',
        'version': '2.0',
        'endpoints': {
            'health': '/health',
            'detect': '/detect',
            'reset': '/reset',
            'emotions': '/emotions'
        },
        'status': 'running'
    })

if __name__ == '__main__':
    if load_model_and_detector():
        logger.info("启动优化的情绪检测API服务 v2.0...")
        app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
    else:
        logger.error("模型加载失败，无法启动服务")
