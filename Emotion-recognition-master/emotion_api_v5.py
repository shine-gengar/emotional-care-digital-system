"""
情绪检测API服务 v5.0 - 简化稳定版
改进点：
1. 简化逻辑，移除复杂的锁定机制
2. 直接返回当前帧结果，确保数据一致性
3. 降低延迟，提高响应速度
"""

import sys
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

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=False)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Max-Age', '3600')
    return response

@app.route('/detect', methods=['OPTIONS'])
def detect_options():
    """处理CORS预检请求"""
    return jsonify({'status': 'ok'}), 200

# 全局变量
model = None
face_cascade = None
emotion_history = deque(maxlen=10)  # 减少到10帧历史

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

# 配置参数
CONFIG = {
    'CONFIDENCE_THRESHOLD': 0.30,  # 置信度阈值30%
    'SMOOTHING_ALPHA': 0.4,  # 平滑系数0.4（更多历史权重）
    'TEMPERATURE': 0.9,  # 温度缩放（更高=更平滑）
    'MIN_FACE_SIZE': 40,  # 最小人脸尺寸降低到40
}

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'message': '情绪识别API服务 v5.0',
        'version': '5.0',
        'config': CONFIG,
        'status': 'running'
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'history_size': len(emotion_history),
        'config': CONFIG
    })

def load_model_and_detector():
    """加载预训练模型和人脸检测器"""
    global model, face_cascade
    
    try:
        import tensorflow as tf
        from tensorflow import keras
        
        tf.get_logger().setLevel('ERROR')
        
        model_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\models\_mini_XCEPTION.102-0.66.hdf5'
        logger.info(f"正在加载模型: {model_path}")
        
        model = keras.models.load_model(model_path, compile=False)
        logger.info(f"模型加载成功!")
        
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

def preprocess_face(face_img, target_size=(64, 64)):
    """预处理人脸图像"""
    # 调整大小 - 模型期望64x64输入
    face_img = cv2.resize(face_img, target_size)
    # 归一化
    face_img = face_img.astype("float32") / 255.0
    return face_img

def apply_temperature_scaling(probs, temperature=0.8):
    """应用温度缩放，使分布更平滑"""
    log_probs = np.log(np.array(list(probs.values())) + 1e-8)
    scaled = log_probs / temperature
    exp_scaled = np.exp(scaled)
    result = exp_scaled / np.sum(exp_scaled)
    return {k: result[i] for i, k in enumerate(probs.keys())}

def temporal_smoothing(current_probs, alpha=0.5):
    """时序平滑 - 简单的指数加权移动平均"""
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

def detect_emotion_from_frame(frame, debug=False):
    """从视频帧中检测情绪"""
    global model, face_cascade, emotion_history
    
    if model is None or face_cascade is None:
        return {'error': '模型未加载', 'success': False}
    
    debug_info = {}
    
    try:
        # 转换为灰度图
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 人脸检测 - 降低门槛以提高检测率
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,  # 更小的缩放因子，检测更多尺度
            minNeighbors=3,    # 降低邻居要求
            minSize=(CONFIG['MIN_FACE_SIZE'], CONFIG['MIN_FACE_SIZE']),
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
            
            # 预处理 - 使用64x64以匹配模型期望的输入形状
            processed_face = preprocess_face(face_roi, (64, 64))
            
            # 准备模型输入
            face_input = np.expand_dims(processed_face, axis=0)
            face_input = np.expand_dims(face_input, axis=-1)
            
            # 预测
            preds = model.predict(face_input, verbose=0)[0]
            
            # 构建概率字典
            raw_probabilities = {EMOTIONS[i]: float(preds[i]) for i in range(len(EMOTIONS))}
            
            # 应用温度缩放
            scaled_probs = apply_temperature_scaling(raw_probabilities, CONFIG['TEMPERATURE'])
            
            # 应用时序平滑
            smoothed_probs = temporal_smoothing(scaled_probs, CONFIG['SMOOTHING_ALPHA'])
            
            # 保存到历史
            emotion_history.append(smoothed_probs)
            
            # 找到最高概率的情绪
            max_emotion = max(smoothed_probs, key=smoothed_probs.get)
            max_prob = smoothed_probs[max_emotion]
            
            # 置信度检查
            is_confident = max_prob >= CONFIG['CONFIDENCE_THRESHOLD']
            
            result = {
                'face': {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h)
                },
                'emotion': max_emotion,
                'emotion_label': EMOTION_LABELS[max_emotion],
                'confidence': round(max_prob, 3),  # 返回0-1范围的小数
                'is_confident': is_confident,
                'probabilities': {k: round(v, 3) for k, v in smoothed_probs.items()},
            }
            
            if debug:
                result['raw_predictions'] = {EMOTIONS[i]: round(float(preds[i]), 3) for i in range(len(EMOTIONS))}
                result['history_size'] = len(emotion_history)
            
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

@app.route('/detect', methods=['POST'])
def detect_emotion():
    """情绪检测接口"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': '缺少image字段'}), 400
        
        frame = decode_base64_image(data['image'])
        if frame is None:
            return jsonify({'success': False, 'error': '无法解码图像'}), 400
        
        debug = data.get('debug', False)
        
        result = detect_emotion_from_frame(frame, debug)
        
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

if __name__ == '__main__':
    if load_model_and_detector():
        logger.info("启动情绪检测API服务 v5.0 (简化稳定版)...")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    else:
        logger.error("模型加载失败，无法启动服务")
