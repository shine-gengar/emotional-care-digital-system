"""
情绪检测API - YOLO纯版 v7.0
只用YOLO，彻底解决CORS问题
使用flask-cors库
"""

import sys
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')
sys.path.insert(0, r'D:\Yolo-FaceEmotionAI-main\Yolo-FaceEmotionAI-main')

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# 启用CORS - 允许所有来源
CORS(app, resources={r"/*": {"origins": "*"}})

# 模型
yolo_model = None
face_cascade = None

# 情绪映射
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
    global yolo_model, face_cascade
    
    try:
        from ultralytics import YOLO
        logger.info("加载YOLO模型...")
        yolo_path = r'D:\Yolo-FaceEmotionAI-main\Yolo-FaceEmotionAI-main\models\best.pt'
        yolo_model = YOLO(yolo_path)
        logger.info("✅ YOLO模型加载成功")
        
        cascade_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\haarcascade_files\haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        logger.info("✅ Haar人脸检测加载成功")
        
        return True
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        return False

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

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'version': '7.0-yolo-only',
        'model': 'YOLO',
        'yolo_loaded': yolo_model is not None
    })

@app.route('/detect', methods=['POST'])
def detect_emotion():
    """YOLO情绪检测"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': '缺少image字段'}), 400
        
        frame = decode_base64_image(data['image'])
        if frame is None:
            return jsonify({'success': False, 'error': '无法解码图像'}), 400
        
        # 人脸检测
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(64, 64))
        
        if len(faces) == 0:
            return jsonify({
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0
            })
        
        results = []
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            
            # 转换为3通道（YOLO需要）
            face_rgb = cv2.cvtColor(face_roi, cv2.COLOR_GRAY2RGB)
            
            # YOLO预测
            yolo_results = yolo_model(face_rgb, verbose=False)
            
            if len(yolo_results) > 0 and len(yolo_results[0].boxes) > 0:
                boxes = yolo_results[0].boxes
                confs = boxes.conf.cpu().numpy()
                classes = boxes.cls.cpu().numpy().astype(int)
                
                best_idx = np.argmax(confs)
                emotion_8 = yolo_model.names[classes[best_idx]]
                confidence = confs[best_idx]
                
                # 转换为7类
                emotion_7 = EMOTION_MAP.get(emotion_8, 'neutral')
                
                # 构建概率
                probs = {emo: 0.0 for emo in EMOTION_LABELS.keys()}
                for i, cls in enumerate(classes):
                    emo_8 = yolo_model.names[cls]
                    emo_7 = EMOTION_MAP.get(emo_8, 'neutral')
                    probs[emo_7] += float(confs[i])
                
                # 归一化
                total = sum(probs.values())
                if total > 0:
                    probs = {k: v/total for k, v in probs.items()}
                
                results.append({
                    'face': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                    'emotion': emotion_7,
                    'emotion_label': EMOTION_LABELS.get(emotion_7, emotion_7),
                    'confidence': round(float(confidence) * 100, 1),
                    'model_used': 'yolo',
                    'probabilities': {k: round(v * 100, 1) for k, v in probs.items()}
                })
        
        return jsonify({
            'success': True,
            'faces_detected': len(results),
            'results': results,
            'version': '7.0-yolo-only'
        })
        
    except Exception as e:
        logger.error(f"检测失败: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/emotions', methods=['GET'])
def get_emotions():
    """获取情绪列表"""
    return jsonify({
        'emotions': list(EMOTION_LABELS.keys()),
        'emotion_labels': EMOTION_LABELS
    })

if __name__ == '__main__':
    if load_models():
        logger.info("🚀 启动YOLO纯版情绪检测API v7.0...")
        logger.info("模型: YOLO only (8-class)")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    else:
        logger.error("❌ 模型加载失败")
