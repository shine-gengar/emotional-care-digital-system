"""
情绪检测API服务 - CORS修复版
"""

import sys
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')

from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import logging
from collections import deque

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 启用CORS - 允许所有来源
CORS(app, resources={r"/*": {"origins": "*"}})

# 确保所有响应都有CORS头
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

# 全局变量
model = None
face_cascade = None
emotion_history = deque(maxlen=5)

EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]
EMOTION_LABELS = {
    'angry': '愤怒', 'disgust': '厌恶', 'scared': '害怕',
    'happy': '开心', 'sad': '悲伤', 'surprised': '惊讶', 'neutral': '平静'
}

def load_model_and_detector():
    """加载模型"""
    global model, face_cascade
    try:
        import tensorflow as tf
        tf.get_logger().setLevel('ERROR')
        
        from tensorflow import keras
        model_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\models\_mini_XCEPTION.102-0.66.hdf5'
        logger.info(f"加载模型: {model_path}")
        model = keras.models.load_model(model_path, compile=False)
        logger.info("模型加载成功!")
        
        cascade_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\haarcascade_files\haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        logger.info("检测器加载成功!")
        return True
    except Exception as e:
        logger.error(f"加载失败: {e}")
        return False

def decode_base64_image(base64_string):
    """解码图像"""
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        img_data = base64.b64decode(base64_string)
        img = Image.open(BytesIO(img_data))
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.error(f"解码失败: {e}")
        return None

def preprocess_face(face_img):
    """预处理"""
    face_img = cv2.resize(face_img, (48, 48))
    face_img = cv2.equalizeHist(face_img.astype(np.uint8))
    face_img = face_img.astype("float32") / 255.0
    return face_img

@app.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    """健康检查"""
    response = make_response(jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'emotions_supported': EMOTIONS
    }))
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/detect', methods=['POST', 'OPTIONS'])
def detect_emotion():
    """情绪检测"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            response = make_response(jsonify({'success': False, 'error': '缺少image字段'}))
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400
        
        frame = decode_base64_image(data['image'])
        if frame is None:
            response = make_response(jsonify({'success': False, 'error': '无法解码图像'}))
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400
        
        # 检测
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(48, 48))
        
        if len(faces) == 0:
            response = make_response(jsonify({
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0
            }))
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        
        results = []
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            processed = preprocess_face(face_roi)
            
            face_input = np.expand_dims(np.expand_dims(processed, axis=0), axis=-1)
            preds = model.predict(face_input, verbose=0)[0]
            
            # 温度缩放
            temperature = 0.6
            scaled = np.exp(np.log(preds + 1e-8) / temperature)
            scaled = scaled / np.sum(scaled)
            
            probabilities = {EMOTIONS[i]: float(scaled[i]) * 100 for i in range(len(EMOTIONS))}
            max_emotion = max(probabilities, key=probabilities.get)
            max_prob = probabilities[max_emotion]
            
            results.append({
                'face': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                'emotion': max_emotion,
                'emotion_label': EMOTION_LABELS[max_emotion],
                'confidence': round(max_prob, 1),
                'probabilities': {k: round(v, 1) for k, v in probabilities.items()}
            })
        
        response = make_response(jsonify({
            'success': True,
            'faces_detected': len(results),
            'results': results
        }))
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
        
    except Exception as e:
        logger.error(f"检测失败: {e}")
        response = make_response(jsonify({'success': False, 'error': str(e)}))
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route('/emotions', methods=['GET', 'OPTIONS'])
def get_emotions():
    """获取情绪列表"""
    response = make_response(jsonify({
        'emotions': EMOTIONS,
        'emotion_labels': EMOTION_LABELS
    }))
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

if __name__ == '__main__':
    if load_model_and_detector():
        logger.info("启动情绪检测API...")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    else:
        logger.error("模型加载失败")
