"""
情绪检测API - 混合版 v5.0
整合 Yolo-FaceEmotionAI + 当前优化方案

特性:
1. YOLO情绪模型 (来自Yolo-FaceEmotionAI)
2. XCEPTION备用模型
3. 双模型投票融合
4. 所有后处理优化保留
"""

import sys
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')
sys.path.insert(0, r'D:\Yolo-FaceEmotionAI-main\Yolo-FaceEmotionAI-main')

from flask import Flask, request, jsonify
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
yolo_emotion_model = None
xception_model = None
face_cascade = None

# 情绪历史
emotion_history = deque(maxlen=10)
frame_history = deque(maxlen=7)

# 锁定状态
locked_emotion = 'neutral'
locked_confidence = 0
lock_counter = 0

# 8类情绪（使用Yolo-FaceEmotionAI的类别）
EMOTIONS_8 = ["Anger", "Contempt", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]
EMOTIONS_7 = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]

# 映射8类到7类
EMOTION_MAP_8_TO_7 = {
    'Anger': 'angry',
    'Contempt': 'disgust',  # 轻蔑归入厌恶
    'Disgust': 'disgust',
    'Fear': 'scared',
    'Happy': 'happy',
    'Neutral': 'neutral',
    'Sad': 'sad',
    'Surprise': 'surprised'
}

EMOTION_LABELS = {
    'angry': '愤怒', 'disgust': '厌恶', 'scared': '害怕',
    'happy': '开心', 'sad': '悲伤', 'surprised': '惊讶', 'neutral': '平静'
}

def load_models():
    """加载双模型"""
    global yolo_emotion_model, xception_model, face_cascade
    
    try:
        # 1. 加载YOLO情绪模型 (来自Yolo-FaceEmotionAI)
        try:
            from ultralytics import YOLO
            logger.info("加载YOLO情绪模型...")
            yolo_path = r'D:\Yolo-FaceEmotionAI-main\Yolo-FaceEmotionAI-main\models\best.pt'
            yolo_emotion_model = YOLO(yolo_path)
            logger.info(f"✅ YOLO情绪模型加载成功: {yolo_path}")
            logger.info(f"   支持情绪: {yolo_emotion_model.names}")
        except Exception as e:
            logger.error(f"❌ YOLO加载失败: {e}")
            yolo_emotion_model = None
        
        # 2. 加载XCEPTION备用
        try:
            import tensorflow as tf
            tf.get_logger().setLevel('ERROR')
            from tensorflow import keras
            
            logger.info("加载XCEPTION备用模型...")
            xception_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\models\_mini_XCEPTION.102-0.66.hdf5'
            xception_model = keras.models.load_model(xception_path, compile=False)
            logger.info("✅ XCEPTION备用模型加载成功")
        except Exception as e:
            logger.error(f"❌ XCEPTION加载失败: {e}")
            xception_model = None
        
        # 3. 加载Haar人脸检测
        cascade_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\haarcascade_files\haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        logger.info("✅ Haar人脸检测加载成功")
        
        # 检查至少有一个情绪模型
        if yolo_emotion_model is None and xception_model is None:
            logger.error("❌ 没有可用的情绪模型!")
            return False
        
        return True
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        return False

# ============ 工具函数 ============
def decode_base64_image(base64_string):
    """解码base64图像"""
    try:
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        img_data = base64.b64decode(base64_string)
        img = Image.open(BytesIO(img_data))
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.error(f"解码失败: {e}")
        return None

def preprocess_for_xception(face_img):
    """预处理用于XCEPTION"""
    face_img = cv2.resize(face_img, (48, 48))
    face_img = cv2.equalizeHist(face_img.astype(np.uint8))
    face_img = face_img.astype("float32") / 255.0
    return face_img

def predict_yolo(face_img):
    """YOLO情绪预测"""
    if yolo_emotion_model is None:
        return None, 0
    
    try:
        results = yolo_emotion_model(face_img, verbose=False)
        
        if len(results) > 0 and len(results[0].boxes) > 0:
            # 获取最高置信度的结果
            boxes = results[0].boxes
            confs = boxes.conf.cpu().numpy()
            classes = boxes.cls.cpu().numpy().astype(int)
            
            best_idx = np.argmax(confs)
            emotion_class = yolo_emotion_model.names[classes[best_idx]]
            confidence = confs[best_idx]
            
            # 转换为7类
            emotion_7 = EMOTION_MAP_8_TO_7.get(emotion_class, 'neutral')
            
            # 构建概率分布
            probs = {emo: 0.0 for emo in EMOTIONS_7}
            for i, cls in enumerate(classes):
                emo_8 = yolo_emotion_model.names[cls]
                emo_7 = EMOTION_MAP_8_TO_7.get(emo_8, 'neutral')
                probs[emo_7] += confs[i]
            
            # 归一化
            total = sum(probs.values())
            if total > 0:
                probs = {k: v/total for k, v in probs.items()}
            
            return probs, confidence
    except Exception as e:
        logger.error(f"YOLO预测失败: {e}")
    
    return None, 0

def predict_xception(face_img):
    """XCEPTION情绪预测"""
    if xception_model is None:
        return None, 0
    
    try:
        processed = preprocess_for_xception(face_img)
        face_input = np.expand_dims(np.expand_dims(processed, axis=0), axis=-1)
        preds = xception_model.predict(face_input, verbose=0)[0]
        
        # 温度缩放
        temperature = 0.5
        log_preds = np.log(preds + 1e-8)
        scaled = log_preds / temperature
        exp_scaled = np.exp(scaled)
        scaled_preds = exp_scaled / np.sum(exp_scaled)
        
        probs = {EMOTIONS_7[i]: float(scaled_preds[i]) for i in range(7)}
        max_idx = np.argmax(scaled_preds)
        confidence = float(scaled_preds[max_idx])
        
        return probs, confidence
    except Exception as e:
        logger.error(f"XCEPTION预测失败: {e}")
    
    return None, 0

def hybrid_predict(face_img):
    """混合预测 - 双模型融合"""
    yolo_probs, yolo_conf = predict_yolo(face_img)
    xception_probs, xception_conf = predict_xception(face_img)
    
    # 如果只有一个模型可用
    if yolo_probs is None and xception_probs is not None:
        return xception_probs, xception_conf, 'xception'
    if xception_probs is None and yolo_probs is not None:
        return yolo_probs, yolo_conf, 'yolo'
    if yolo_probs is None and xception_probs is None:
        return None, 0, 'none'
    
    # 双模型融合 (YOLO权重0.6, XCEPTION权重0.4)
    # 因为YOLO是专门针对情绪训练的
    fused_probs = {}
    for emo in EMOTIONS_7:
        fused_probs[emo] = 0.6 * yolo_probs.get(emo, 0) + 0.4 * xception_probs.get(emo, 0)
    
    # 重新归一化
    total = sum(fused_probs.values())
    fused_probs = {k: v/total for k, v in fused_probs.items()}
    
    # 计算融合置信度
    max_emotion = max(fused_probs, key=fused_probs.get)
    fused_conf = fused_probs[max_emotion]
    
    return fused_probs, fused_conf, 'hybrid'

# ============ API路由 ============
def create_response(data, status_code=200):
    """创建带CORS头的响应"""
    response = jsonify(data)
    response.status_code = status_code
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return create_response({
        'status': 'ok',
        'yolo_loaded': yolo_emotion_model is not None,
        'xception_loaded': xception_model is not None,
        'version': '5.0-hybrid',
        'models': ['YOLO(8-class)', 'XCEPTION(7-class)'],
        'fusion_mode': 'weighted_average',
        'weights': {'yolo': 0.6, 'xception': 0.4},
        'emotions_supported': list(EMOTION_LABELS.keys())
    })

@app.route('/detect', methods=['POST', 'OPTIONS'])
def detect_emotion():
    """混合版情绪检测"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return create_response({'success': False, 'error': '缺少image字段'}, 400)
        
        frame = decode_base64_image(data['image'])
        if frame is None:
            return create_response({'success': False, 'error': '无法解码图像'}, 400)
        
        # 人脸检测
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(64, 64))
        
        if len(faces) == 0:
            return create_response({
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0
            })
        
        results = []
        for (x, y, w, h) in faces:
            # 裁剪人脸
            face_roi = gray[y:y+h, x:x+w]
            
            # 混合预测
            probs, conf, model_used = hybrid_predict(face_roi)
            
            if probs is None:
                continue
            
            max_emotion = max(probs, key=probs.get)
            
            results.append({
                'face': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                'emotion': max_emotion,
                'emotion_label': EMOTION_LABELS.get(max_emotion, max_emotion),
                'confidence': round(conf * 100, 1),
                'model_used': model_used,
                'probabilities': {k: round(v * 100, 1) for k, v in probs.items()}
            })
        
        return create_response({
            'success': True,
            'faces_detected': len(results),
            'results': results,
            'method': 'hybrid_v5'
        })
        
    except Exception as e:
        logger.error(f"检测失败: {e}")
        import traceback
        traceback.print_exc()
        return create_response({'success': False, 'error': str(e)}, 500)

@app.route('/compare', methods=['POST'])
def compare_models():
    """对比两个模型的预测结果（调试用）"""
    try:
        data = request.get_json()
        frame = decode_base64_image(data['image'])
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(64, 64))
        
        if len(faces) == 0:
            return create_response({'error': '未检测到人脸'})
        
        x, y, w, h = faces[0]
        face_roi = gray[y:y+h, x:x+w]
        
        yolo_probs, yolo_conf = predict_yolo(face_roi)
        xception_probs, xception_conf = predict_xception(face_roi)
        
        return create_response({
            'yolo': {
                'probabilities': {k: round(v * 100, 1) for k, v in yolo_probs.items()} if yolo_probs else None,
                'confidence': round(yolo_conf * 100, 1) if yolo_conf else 0
            },
            'xception': {
                'probabilities': {k: round(v * 100, 1) for k, v in xception_probs.items()} if xception_probs else None,
                'confidence': round(xception_conf * 100, 1) if xception_conf else 0
            }
        })
    except Exception as e:
        return create_response({'error': str(e)}, 500)

if __name__ == '__main__':
    if load_models():
        logger.info("🚀 启动混合版情绪检测API v5.0...")
        logger.info("特性: YOLO + XCEPTION 双模型融合")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    else:
        logger.error("❌ 模型加载失败")
