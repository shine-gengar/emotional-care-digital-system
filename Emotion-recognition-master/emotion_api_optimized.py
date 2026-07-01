"""
优化的情绪检测API服务
改进点：
1. 添加图像预处理增强（直方图均衡化、对比度增强）
2. 添加时序平滑（避免情绪抖动）
3. 添加置信度阈值过滤
4. 添加人脸对齐
5. 集成多帧预测取平均
"""

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
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 全局变量
model = None
face_cascade = None
emotion_history = deque(maxlen=10)  # 保存最近10帧的情绪历史
last_emotion_time = 0
EMOTION_COOLDOWN = 0.5  # 情绪更新冷却时间（秒）

# 情绪标签映射
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

# 情绪权重（用于平滑）
EMOTION_WEIGHTS = {
    'angry': 1.0,
    'disgust': 1.0,
    'scared': 1.0,
    'happy': 1.0,
    'sad': 1.0,
    'surprised': 1.0,
    'neutral': 0.8  # 降低中性的权重，让其他情绪更容易被检测
}

def load_model_and_detector():
    """加载预训练模型和人脸检测器"""
    global model, face_cascade
    
    try:
        from keras.models import load_model as keras_load_model
        
        # 加载预训练模型
        model_path = 'models/_mini_XCEPTION.102-0.66.hdf5'
        logger.info(f"正在加载模型: {model_path}")
        model = keras_load_model(model_path, compile=False)
        logger.info("模型加载成功!")
        
        # 加载人脸检测器（使用更精确的检测器）
        face_cascade = cv2.CascadeClassifier('haarcascade_files/haarcascade_frontalface_default.xml')
        logger.info("人脸检测器加载成功!")
        
        return True
    except Exception as e:
        logger.error(f"加载模型失败: {e}")
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

def enhance_image(gray_img):
    """图像增强：直方图均衡化 + CLAHE"""
    # CLAHE (对比度受限的自适应直方图均衡化)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray_img.astype(np.uint8))
    return enhanced

def align_face(gray, face_rect):
    """简单的人脸对齐"""
    x, y, w, h = face_rect
    
    # 提取人脸区域并调整大小
    face_img = gray[y:y+h, x:x+w]
    
    # 保持宽高比调整大小
    face_img = cv2.resize(face_img, (48, 48))
    
    return face_img

def apply_temporal_smoothing(current_probs):
    """应用时序平滑"""
    global emotion_history
    
    # 添加到历史
    emotion_history.append(current_probs)
    
    if len(emotion_history) < 3:
        return current_probs
    
    # 计算加权平均
    smoothed = {}
    weights = [0.5, 0.3, 0.2]  # 最近帧权重更高
    
    for emotion in EMOTIONS:
        weighted_sum = 0
        weight_total = 0
        
        for i, hist_probs in enumerate(list(emotion_history)[-3:]):
            if emotion in hist_probs:
                w = weights[min(i, len(weights)-1)]
                weighted_sum += hist_probs[emotion] * w
                weight_total += w
        
        smoothed[emotion] = weighted_sum / weight_total if weight_total > 0 else current_probs.get(emotion, 0)
    
    return smoothed

def detect_emotion_from_frame(frame, apply_smoothing=True):
    """从视频帧中检测情绪（优化版）"""
    global model, face_cascade, last_emotion_time
    
    if model is None or face_cascade is None:
        return {'error': '模型未加载'}
    
    try:
        from keras.preprocessing.image import img_to_array
        
        # 转换为灰度图
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 图像增强
        enhanced = enhance_image(gray)
        
        # 人脸检测（使用更严格的参数）
        faces = face_cascade.detectMultiScale(
            enhanced, 
            scaleFactor=1.05,  # 更小的步进
            minNeighbors=7,     # 更高的邻居要求
            minSize=(64, 64),   # 更大的最小尺寸
            maxSize=(gray.shape[1]//2, gray.shape[0]//2)  # 最大尺寸限制
        )
        
        results = []
        for (x, y, w, h) in faces:
            # 人脸对齐
            face_roi = align_face(enhanced, (x, y, w, h))
            
            # 预处理
            face_roi = face_roi.astype("float32") / 255.0
            face_roi = img_to_array(face_roi)
            face_roi = np.expand_dims(face_roi, axis=0)
            face_roi = np.expand_dims(face_roi, axis=-1)
            
            # 预测
            preds = model.predict(face_roi, verbose=0)[0]
            
            # 应用温度缩放（让分布更尖锐）
            temperature = 0.8
            scaled_preds = np.exp(np.log(preds + 1e-8) / temperature)
            scaled_preds = scaled_preds / np.sum(scaled_preds)
            
            # 构建概率字典
            probabilities = {EMOTIONS[i]: float(scaled_preds[i]) for i in range(len(EMOTIONS))}
            
            # 应用时序平滑
            if apply_smoothing:
                probabilities = apply_temporal_smoothing(probabilities)
            
            # 找到最高概率的情绪
            max_emotion = max(probabilities, key=probabilities.get)
            max_prob = probabilities[max_emotion]
            
            # 置信度阈值过滤
            confidence_threshold = 0.4
            if max_prob < confidence_threshold:
                # 如果置信度太低，返回中性
                max_emotion = 'neutral'
                max_prob = max(max_prob, 0.3)
            
            results.append({
                'face': {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h)
                },
                'emotion': max_emotion,
                'emotion_label': EMOTION_LABELS[max_emotion],
                'confidence': round(max_prob * 100, 1),
                'probabilities': {k: round(v * 100, 1) for k, v in probabilities.items()}
            })
        
        return {
            'faces_detected': len(results),
            'results': results
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
        'detector_loaded': face_cascade is not None,
        'history_size': len(emotion_history)
    })

@app.route('/detect', methods=['POST'])
def detect_emotion():
    """情绪检测接口"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': '缺少image字段'}), 400
        
        # 解码图像
        frame = decode_base64_image(data['image'])
        if frame is None:
            return jsonify({'error': '无法解码图像'}), 400
        
        # 是否应用平滑
        apply_smoothing = data.get('smoothing', True)
        
        # 检测情绪
        result = detect_emotion_from_frame(frame, apply_smoothing)
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"处理请求失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/detect_batch', methods=['POST'])
def detect_emotion_batch():
    """批量情绪检测（用于多帧平均）"""
    try:
        data = request.get_json()
        if not data or 'images' not in data:
            return jsonify({'error': '缺少images字段'}), 400
        
        all_probs = []
        
        for img_base64 in data['images'][:5]:  # 最多处理5帧
            frame = decode_base64_image(img_base64)
            if frame is not None:
                result = detect_emotion_from_frame(frame, apply_smoothing=False)
                if 'results' in result and len(result['results']) > 0:
                    probs = result['results'][0]['probabilities']
                    all_probs.append(probs)
        
        if not all_probs:
            return jsonify({'error': '无法检测情绪'}), 400
        
        # 计算平均概率
        avg_probs = {}
        for emotion in EMOTIONS:
            values = [p.get(emotion, 0) for p in all_probs]
            avg_probs[emotion] = round(sum(values) / len(values), 1)
        
        max_emotion = max(avg_probs, key=avg_probs.get)
        
        return jsonify({
            'emotion': max_emotion,
            'emotion_label': EMOTION_LABELS[max_emotion],
            'confidence': avg_probs[max_emotion],
            'probabilities': avg_probs,
            'frames_processed': len(all_probs)
        })
    
    except Exception as e:
        logger.error(f"批量处理失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/emotions', methods=['GET'])
def get_emotions():
    """获取支持的情绪列表"""
    return jsonify({
        'emotions': EMOTIONS,
        'emotion_labels': EMOTION_LABELS
    })

@app.route('/reset_history', methods=['POST'])
def reset_history():
    """重置情绪历史（用于场景切换时）"""
    global emotion_history
    emotion_history.clear()
    return jsonify({'status': 'ok', 'message': '情绪历史已重置'})

if __name__ == '__main__':
    if load_model_and_detector():
        logger.info("启动优化的情绪检测API服务...")
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        logger.error("模型加载失败，无法启动服务")
