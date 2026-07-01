"""
YOLO人脸检测 + XCEPTION表情识别
方案B: 快速实施，复用现有模型
"""

import sys
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')

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

# ============ 加载模型 ============
# YOLO用于人脸检测
yolo_model = None
# XCEPTION用于表情分类
emotion_model = None

EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]
EMOTION_LABELS = {
    'angry': '愤怒', 'disgust': '厌恶', 'scared': '害怕',
    'happy': '开心', 'sad': '悲伤', 'surprised': '惊讶', 'neutral': '平静'
}

def load_models():
    """加载YOLO和表情识别模型"""
    global yolo_model, emotion_model
    
    try:
        # 加载YOLOv8用于人脸检测
        from ultralytics import YOLO
        logger.info("加载YOLOv8人脸检测模型...")
        
        # 使用YOLOv8的预训练人脸检测模型
        # 如果没有，可以用yolov8n.pt检测person，然后提取人脸区域
        try:
            yolo_model = YOLO('yolov8n-face.pt')  # 人脸专用模型
        except:
            # 如果没有专用模型，用通用检测器
            yolo_model = YOLO('yolov8n.pt')
            logger.info("使用通用YOLO模型，需要过滤person类别")
        
        logger.info("✅ YOLO加载成功!")
        
        # 加载XCEPTION用于表情分类
        import tensorflow as tf
        tf.get_logger().setLevel('ERROR')
        from tensorflow import keras
        
        model_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\models\_mini_XCEPTION.102-0.66.hdf5'
        logger.info(f"加载表情分类模型...")
        emotion_model = keras.models.load_model(model_path, compile=False)
        logger.info("✅ 表情模型加载成功!")
        
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

def preprocess_face(face_img):
    """预处理人脸用于分类"""
    face_img = cv2.resize(face_img, (48, 48))
    face_img = cv2.equalizeHist(face_img.astype(np.uint8))
    face_img = face_img.astype("float32") / 255.0
    return face_img

def apply_temperature_scaling(probs, temperature=0.5):
    """温度缩放"""
    log_probs = np.log(probs + 1e-8)
    scaled = log_probs / temperature
    exp_scaled = np.exp(scaled)
    return exp_scaled / np.sum(exp_scaled)

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
        'yolo_loaded': yolo_model is not None,
        'emotion_model_loaded': emotion_model is not None,
        'version': 'yolo+xception',
        'emotions_supported': EMOTIONS
    })

@app.route('/detect', methods=['POST', 'OPTIONS'])
def detect_emotion():
    """YOLO检测人脸 + XCEPTION分类表情"""
    
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
        
        # 解码图像
        frame = decode_base64_image(data['image'])
        if frame is None:
            return create_response({'success': False, 'error': '无法解码图像'}, 400)
        
        # Step 1: YOLO检测人脸
        results = yolo_model(frame, verbose=False)
        
        faces = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # 获取边界框
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0])
                
                # 过滤低置信度
                if conf < 0.5:
                    continue
                
                # 确保坐标在图像范围内
                h, w = frame.shape[:2]
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                
                if x2 > x1 and y2 > y1:
                    faces.append({
                        'bbox': [int(x1), int(y1), int(x2), int(y2)],
                        'detection_conf': round(conf, 3)
                    })
        
        if len(faces) == 0:
            return create_response({
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0
            })
        
        # Step 2: 对每个检测到的人脸进行表情分类
        results_list = []
        for face in faces:
            x1, y1, x2, y2 = face['bbox']
            
            # 裁剪人脸区域
            face_roi = frame[y1:y2, x1:x2]
            
            # 转换为灰度图
            gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            
            # 预处理
            processed = preprocess_face(gray_face)
            
            # XCEPTION分类
            face_input = np.expand_dims(np.expand_dims(processed, axis=0), axis=-1)
            preds = emotion_model.predict(face_input, verbose=0)[0]
            
            # 温度缩放
            scaled_preds = apply_temperature_scaling(preds, temperature=0.5)
            
            # 构建概率字典
            probabilities = {EMOTIONS[i]: float(scaled_preds[i]) * 100 for i in range(len(EMOTIONS))}
            max_emotion = max(probabilities, key=probabilities.get)
            max_prob = probabilities[max_emotion]
            
            results_list.append({
                'face': {
                    'x': x1,
                    'y': y1,
                    'width': x2 - x1,
                    'height': y2 - y1
                },
                'emotion': max_emotion,
                'emotion_label': EMOTION_LABELS[max_emotion],
                'confidence': round(max_prob, 1),
                'detection_conf': face['detection_conf'],
                'probabilities': {k: round(v, 1) for k, v in probabilities.items()}
            })
        
        return create_response({
            'success': True,
            'faces_detected': len(results_list),
            'results': results_list,
            'method': 'yolo+xception'
        })
        
    except Exception as e:
        logger.error(f"检测失败: {e}")
        import traceback
        traceback.print_exc()
        return create_response({'success': False, 'error': str(e)}, 500)

@app.route('/emotions', methods=['GET'])
def get_emotions():
    """获取情绪列表"""
    return create_response({
        'emotions': EMOTIONS,
        'emotion_labels': EMOTION_LABELS
    })

if __name__ == '__main__':
    if load_models():
        logger.info("🚀 启动YOLO+XCEPTION情绪检测API...")
        app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)  # 使用5001端口
    else:
        logger.error("❌ 模型加载失败")
