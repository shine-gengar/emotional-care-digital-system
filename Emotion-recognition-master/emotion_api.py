# 情绪检测API服务
# 基于预训练的 mini_XCEPTION 模型

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 全局变量
model = None
face_cascade = None
EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]

def load_model_and_detector():
    """加载预训练模型和人脸检测器"""
    global model, face_cascade
    
    try:
        # 尝试导入keras
        from keras.models import load_model as keras_load_model
        from keras.preprocessing.image import img_to_array
        
        # 加载预训练模型
        model_path = 'models/_mini_XCEPTION.102-0.66.hdf5'
        logger.info(f"正在加载模型: {model_path}")
        model = keras_load_model(model_path, compile=False)
        logger.info("模型加载成功!")
        
        # 加载人脸检测器
        face_cascade = cv2.CascadeClassifier('haarcascade_files/haarcascade_frontalface_default.xml')
        logger.info("人脸检测器加载成功!")
        
        return True
    except Exception as e:
        logger.error(f"加载模型失败: {e}")
        return False

def decode_base64_image(base64_string):
    """解码base64编码的图像"""
    try:
        # 移除可能的data URI前缀
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        img_data = base64.b64decode(base64_string)
        img = Image.open(BytesIO(img_data))
        # 转换为OpenCV格式 (BGR)
        img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        return img
    except Exception as e:
        logger.error(f"解码图像失败: {e}")
        return None

# 全局变量用于缓存
last_face_position = None
last_emotion_result = None
frame_counter = 0

def detect_emotion_from_frame(frame):
    """从视频帧中检测情绪"""
    global model, face_cascade, last_face_position, last_emotion_result, frame_counter
    
    if model is None or face_cascade is None:
        return {'error': '模型未加载'}
    
    try:
        from keras.preprocessing.image import img_to_array
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 每3帧才进行人脸检测，其他帧使用缓存位置
        frame_counter += 1
        if frame_counter % 3 == 0 or last_face_position is None:
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=3, minSize=(48, 48))
            if len(faces) > 0:
                last_face_position = faces[0]  # 只取第一个人脸
            else:
                last_face_position = None
                last_emotion_result = None
        
        if last_face_position is None:
            return {'faces_detected': 0, 'results': []}
        
        # 使用缓存的位置或新检测的位置
        x, y, w, h = last_face_position
        
        # 提取人脸区域
        roi = gray[y:y+h, x:x+w]
        roi = cv2.resize(roi, (64, 64))
        roi = roi.astype("float") / 255.0
        roi = img_to_array(roi)
        roi = np.expand_dims(roi, axis=0)
        roi = np.expand_dims(roi, axis=-1)
        
        # 预测情绪
        preds = model.predict(roi, verbose=0)[0]
        emotion_probability = float(np.max(preds))
        label = EMOTIONS[preds.argmax()]
        
        result = {
            'face': {
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h)
            },
            'emotion': label,
            'confidence': emotion_probability,
            'probabilities': {EMOTIONS[i]: float(preds[i]) for i in range(len(EMOTIONS))}
        }
        
        last_emotion_result = result
        
        return {
            'faces_detected': 1,
            'results': [result]
        }
    except Exception as e:
        logger.error(f"情绪检测失败: {e}")
        return {'error': str(e)}

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'detector_loaded': face_cascade is not None
    })

@app.route('/detect', methods=['POST'])
def detect_emotion():
    """情绪检测接口
    
    请求体格式:
    {
        "image": "base64编码的图像字符串"
    }
    
    返回格式:
    {
        "faces_detected": 1,
        "results": [
            {
                "face": {"x": 100, "y": 100, "width": 200, "height": 200},
                "emotion": "happy",
                "confidence": 0.95,
                "probabilities": {
                    "angry": 0.01,
                    "disgust": 0.01,
                    "scared": 0.02,
                    "happy": 0.95,
                    "sad": 0.005,
                    "surprised": 0.005,
                    "neutral": 0.01
                }
            }
        ]
    }
    """
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': '缺少image字段'}), 400
        
        # 解码图像
        frame = decode_base64_image(data['image'])
        if frame is None:
            return jsonify({'error': '无法解码图像'}), 400
        
        # 检测情绪
        result = detect_emotion_from_frame(frame)
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"处理请求失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/emotions', methods=['GET'])
def get_emotions():
    """获取支持的情绪列表"""
    return jsonify({
        'emotions': EMOTIONS,
        'emotion_labels': {
            'angry': '愤怒',
            'disgust': '厌恶',
            'scared': '害怕',
            'happy': '开心',
            'sad': '悲伤',
            'surprised': '惊讶',
            'neutral': '平静'
        }
    })

if __name__ == '__main__':
    # 加载模型
    if load_model_and_detector():
        logger.info("启动情绪检测API服务...")
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        logger.error("模型加载失败，无法启动服务")
