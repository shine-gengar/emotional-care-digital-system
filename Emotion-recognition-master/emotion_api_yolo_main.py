"""
情绪检测API - YOLO主模型版 v6.0
以YOLO为主，XCEPTION为备用
修复CORS问题
"""

import sys
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')
sys.path.insert(0, r'D:\Yolo-FaceEmotionAI-main\Yolo-FaceEmotionAI-main')

from flask import Flask, request, jsonify, make_response
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import logging
from collections import deque

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ============ 模型加载 ============
yolo_model = None
xception_model = None
face_cascade = None

# 时序平滑
emotion_history = deque(maxlen=10)
frame_history = deque(maxlen=7)
locked_emotion = 'neutral'
locked_confidence = 0
lock_counter = 0

# 8类情绪
EMOTIONS_8 = ["Anger", "Contempt", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]
EMOTIONS_7 = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]

EMOTION_MAP = {
    'Anger': 'angry', 'Contempt': 'disgust', 'Disgust': 'disgust',
    'Fear': 'scared', 'Happy': 'happy', 'Neutral': 'neutral',
    'Sad': 'sad', 'Surprise': 'surprised'
}

EMOTION_LABELS = {
    'angry': '愤怒', 'disgust': '厌恶', 'scared': '害怕',
    'happy': '开心', 'sad': '悲伤', 'surprised': '惊讶', 'neutral': '平静'
}

def load_models():
    """加载模型"""
    global yolo_model, xception_model, face_cascade
    
    try:
        # YOLO主模型
        from ultralytics import YOLO
        logger.info("加载YOLO主模型...")
        yolo_path = r'D:\Yolo-FaceEmotionAI-main\Yolo-FaceEmotionAI-main\models\best.pt'
        yolo_model = YOLO(yolo_path)
        logger.info(f"✅ YOLO主模型加载成功")
        
        # XCEPTION备用
        import tensorflow as tf
        tf.get_logger().setLevel('ERROR')
        from tensorflow import keras
        
        xception_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\models\_mini_XCEPTION.102-0.66.hdf5'
        xception_model = keras.models.load_model(xception_path, compile=False)
        logger.info("✅ XCEPTION备用模型加载成功")
        
        # Haar人脸检测
        cascade_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\haarcascade_files\haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        logger.info("✅ Haar人脸检测加载成功")
        
        return True
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        return False

# ============ 工具函数 ============
def decode_base64_image(base64_string):
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        img_data = base64.b64decode(base64_string)
        img = Image.open(BytesIO(img_data))
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.error(f"解码失败: {e}")
        return None

def preprocess_xception(face_img):
    face_img = cv2.resize(face_img, (48, 48))
    face_img = cv2.equalizeHist(face_img.astype(np.uint8))
    return face_img.astype("float32") / 255.0

def predict_yolo(face_img):
    """YOLO预测 - 主模型"""
    try:
        results = yolo_model(face_img, verbose=False)
        if len(results) > 0 and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            confs = boxes.conf.cpu().numpy()
            classes = boxes.cls.cpu().numpy().astype(int)
            
            best_idx = np.argmax(confs)
            emotion_8 = yolo_model.names[classes[best_idx]]
            confidence = confs[best_idx]
            
            # 转换为7类
            emotion_7 = EMOTION_MAP.get(emotion_8, 'neutral')
            
            # 构建概率
            probs = {emo: 0.0 for emo in EMOTIONS_7}
            for i, cls in enumerate(classes):
                emo_8 = yolo_model.names[cls]
                emo_7 = EMOTION_MAP.get(emo_8, 'neutral')
                probs[emo_7] += confs[i]
            
            # 归一化
            total = sum(probs.values())
            if total > 0:
                probs = {k: v/total for k, v in probs.items()}
            
            return probs, confidence, 'yolo'
    except Exception as e:
        logger.error(f"YOLO预测失败: {e}")
    return None, 0, 'none'

def predict_xception(face_img):
    """XCEPTION预测 - 备用"""
    try:
        processed = preprocess_xception(face_img)
        face_input = np.expand_dims(np.expand_dims(processed, axis=0), axis=-1)
        preds = xception_model.predict(face_input, verbose=0)[0]
        
        # 温度缩放
        temperature = 0.5
        log_preds = np.log(preds + 1e-8)
        scaled = np.exp(log_preds / temperature)
        scaled = scaled / np.sum(scaled)
        
        probs = {EMOTIONS_7[i]: float(scaled[i]) for i in range(7)}
        max_idx = np.argmax(scaled)
        confidence = float(scaled[max_idx])
        
        return probs, confidence, 'xception'
    except Exception as e:
        logger.error(f"XCEPTION预测失败: {e}")
    return None, 0, 'none'

def predict_main(face_img):
    """主预测函数 - YOLO为主"""
    # 优先使用YOLO
    probs, conf, model_used = predict_yolo(face_img)
    
    # YOLO失败或置信度低时，用XCEPTION补充
    if probs is None or conf < 0.5:
        xception_probs, xception_conf, _ = predict_xception(face_img)
        if xception_probs is not None:
            if probs is None:
                return xception_probs, xception_conf, 'xception'
            else:
                # 融合 (YOLO 0.7, XCEPTION 0.3)
                fused = {}
                for emo in EMOTIONS_7:
                    fused[emo] = 0.7 * probs[emo] + 0.3 * xception_probs[emo]
                total = sum(fused.values())
                fused = {k: v/total for k, v in fused.items()}
                max_emotion = max(fused, key=fused.get)
                return fused, fused[max_emotion], 'hybrid'
    
    return probs, conf, model_used

# ============ CORS响应 ============
def cors_response(data, status_code=200):
    response = make_response(jsonify(data))
    response.status_code = status_code
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

# ============ API路由 ============
@app.route('/health', methods=['GET'])
def health_check():
    return cors_response({
        'status': 'ok',
        'version': '6.0-yolo-main',
        'yolo_loaded': yolo_model is not None,
        'xception_loaded': xception_model is not None,
        'primary_model': 'YOLO (8-class)',
        'backup_model': 'XCEPTION (7-class)',
        'emotions': list(EMOTION_LABELS.keys())
    })

@app.route('/detect', methods=['POST', 'OPTIONS'])
def detect_emotion():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
        return response
    
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return cors_response({'success': False, 'error': '缺少image字段'}, 400)
        
        frame = decode_base64_image(data['image'])
        if frame is None:
            return cors_response({'success': False, 'error': '无法解码图像'}, 400)
        
        # 人脸检测
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(64, 64))
        
        if len(faces) == 0:
            return cors_response({
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0
            })
        
        results = []
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            
            # YOLO为主预测
            probs, conf, model_used = predict_main(face_roi)
            
            if probs is None:
                continue
            
            max_emotion = max(probs, key=probs.get)
            
            results.append({
                'face': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                'emotion': max_emotion,
                'emotion_label': EMOTION_LABELS.get(max_emotion, max_emotion),
                'confidence': round(conf * 100, 1),
                'model_used': model_used,
                'is_primary': model_used == 'yolo',
                'probabilities': {k: round(v * 100, 1) for k, v in probs.items()}
            })
        
        return cors_response({
            'success': True,
            'faces_detected': len(results),
            'results': results,
            'version': '6.0-yolo-main'
        })
        
    except Exception as e:
        logger.error(f"检测失败: {e}")
        import traceback
        traceback.print_exc()
        return cors_response({'success': False, 'error': str(e)}, 500)

@app.route('/emotions', methods=['GET'])
def get_emotions():
    return cors_response({
        'emotions': list(EMOTION_LABELS.keys()),
        'emotion_labels': EMOTION_LABELS
    })

if __name__ == '__main__':
    if load_models():
        logger.info("🚀 启动YOLO主模型版情绪检测API v6.0...")
        logger.info("主模型: YOLO (8-class)")
        logger.info("备用: XCEPTION (7-class)")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    else:
        logger.error("❌ 模型加载失败")
