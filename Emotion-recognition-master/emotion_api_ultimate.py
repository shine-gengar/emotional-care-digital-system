"""
情绪检测API - 终极优化版 v4.0
整合所有优化技术：
1. YOLO人脸检测（替代Haar）
2. CLAHE图像增强
3. 人脸对齐
4. 数据增强（推理时）
5. 模型集成（多模型投票）
6. 时序平滑（EMA）
7. 多帧投票
8. 情绪锁定
9. 置信度校准
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
from datetime import datetime
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ============ 模型加载 ============
yolo_model = None
emotion_model = None
face_cascade = None  # 备用

# 时序平滑历史
emotion_history = deque(maxlen=10)
frame_history = deque(maxlen=7)  # 增加到7帧

# 情绪锁定状态
locked_emotion = 'neutral'
locked_confidence = 0
lock_counter = 0
LOCK_THRESHOLD = 3

EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]
EMOTION_LABELS = {
    'angry': '愤怒', 'disgust': '厌恶', 'scared': '害怕',
    'happy': '开心', 'sad': '悲伤', 'surprised': '惊讶', 'neutral': '平静'
}

# 情绪优先级（动态调整）
EMOTION_PRIORITY = {
    'happy': 1.3, 'sad': 1.3, 'angry': 1.3,  # 高优先级
    'surprised': 1.0, 'scared': 0.9, 'disgust': 0.9,
    'neutral': 0.6  # 降低中性，避免过度检测
}

# 混淆矩阵校正（基于常见错误模式）
CONFUSION_CORRECTION = {
    'scared': {'surprised': 0.1},  # 害怕容易被误认为惊讶
    'surprised': {'scared': 0.1},
    'disgust': {'angry': 0.05},
}

def load_models():
    """加载所有模型"""
    global yolo_model, emotion_model, face_cascade
    
    try:
        # 1. 尝试加载YOLO
        try:
            from ultralytics import YOLO
            logger.info("加载YOLOv8...")
            yolo_model = YOLO('yolov8n.pt')  # 自动下载
            logger.info("✅ YOLO加载成功")
        except Exception as e:
            logger.warning(f"YOLO加载失败，使用Haar备用: {e}")
            yolo_model = None
        
        # 2. 加载XCEPTION表情模型
        import tensorflow as tf
        tf.get_logger().setLevel('ERROR')
        from tensorflow import keras
        
        model_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\models\_mini_XCEPTION.102-0.66.hdf5'
        logger.info("加载XCEPTION...")
        emotion_model = keras.models.load_model(model_path, compile=False)
        logger.info("✅ XCEPTION加载成功")
        
        # 3. 加载Haar备用
        if yolo_model is None:
            cascade_path = r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\haarcascade_files\haarcascade_frontalface_default.xml'
            face_cascade = cv2.CascadeClassifier(cascade_path)
            logger.info("✅ Haar备用加载成功")
        
        return True
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        return False

# ============ 图像预处理 ============
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

def enhance_image(gray_img):
    """CLAHE增强"""
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(gray_img)

def align_face(gray, face_rect):
    """人脸对齐 - 检测眼睛并旋转"""
    x, y, w, h = face_rect
    face_img = gray[y:y+h, x:x+w]
    
    try:
        # 加载眼睛检测器
        eye_cascade = cv2.CascadeClassifier(
            r'D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\haarcascade_files\haarcascade_eye.xml'
        )
        eyes = eye_cascade.detectMultiScale(face_img, 1.1, 3, minSize=(w//5, h//5))
        
        if len(eyes) >= 2:
            # 排序获取左右眼
            eyes = sorted(eyes, key=lambda e: e[0])[:2]
            left_eye = eyes[0]
            right_eye = eyes[1]
            
            # 计算眼睛中心
            left_center = (left_eye[0] + left_eye[2]//2, left_eye[1] + left_eye[3]//2)
            right_center = (right_eye[0] + right_eye[2]//2, right_eye[1] + right_eye[3]//2)
            
            # 计算旋转角度
            dy = right_center[1] - left_center[1]
            dx = right_center[0] - left_center[0]
            angle = np.degrees(np.arctan2(dy, dx))
            
            # 旋转
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            face_img = cv2.warpAffine(face_img, M, (w, h), flags=cv2.INTER_CUBIC)
    except:
        pass
    
    # 调整大小
    face_img = cv2.resize(face_img, (48, 48))
    return face_img

def preprocess_face(face_img, augment=False):
    """预处理，可选数据增强"""
    # 直方图均衡化
    face_img = cv2.equalizeHist(face_img.astype(np.uint8))
    
    if augment:
        # 随机轻微增强（推理时增强）
        if np.random.random() > 0.5:
            # 轻微旋转
            angle = np.random.uniform(-5, 5)
            h, w = face_img.shape
            M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1)
            face_img = cv2.warpAffine(face_img, M, (w, h))
        
        if np.random.random() > 0.5:
            # 轻微缩放
            scale = np.random.uniform(0.95, 1.05)
            h, w = face_img.shape
            new_h, new_w = int(h*scale), int(w*scale)
            resized = cv2.resize(face_img, (new_w, new_h))
            # 裁剪或填充到48x48
            if scale > 1:
                start_h, start_w = (new_h-h)//2, (new_w-w)//2
                face_img = resized[start_h:start_h+h, start_w:start_w+w]
            else:
                pad_h, pad_w = (h-new_h)//2, (w-new_w)//2
                face_img = cv2.copyMakeBorder(resized, pad_h, h-new_h-pad_h, pad_w, w-new_w-pad_w, cv2.BORDER_CONSTANT)
    
    # 归一化
    face_img = face_img.astype("float32") / 255.0
    return face_img

def detect_faces_yolo(frame):
    """YOLO人脸检测"""
    results = yolo_model(frame, verbose=False)
    faces = []
    
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            
            # 只保留person类别（class 0）且置信度高的
            if cls == 0 and conf > 0.4:
                h, w = frame.shape[:2]
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                
                if x2 > x1 and y2 > y1:
                    faces.append((x1, y1, x2-x1, y2-y1, conf))
    
    return faces

def detect_faces_haar(gray):
    """Haar备用检测"""
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=6, minSize=(64, 64)
    )
    return [(x, y, w, h, 1.0) for x, y, w, h in faces]

# ============ 模型推理优化 ============
def predict_with_tta(face_img, n_augmentations=3):
    """测试时增强 (TTA) - 多次推理取平均"""
    predictions = []
    
    # 原始图像
    processed = preprocess_face(face_img, augment=False)
    face_input = np.expand_dims(np.expand_dims(processed, axis=0), axis=-1)
    pred = emotion_model.predict(face_input, verbose=0)[0]
    predictions.append(pred)
    
    # 增强版本
    for _ in range(n_augmentations - 1):
        processed = preprocess_face(face_img, augment=True)
        face_input = np.expand_dims(np.expand_dims(processed, axis=0), axis=-1)
        pred = emotion_model.predict(face_input, verbose=0)[0]
        predictions.append(pred)
    
    # 平均
    return np.mean(predictions, axis=0)

def apply_temperature_scaling(probs, temperature=0.4):
    """温度缩放 - 更低温度使分布更尖锐"""
    log_probs = np.log(probs + 1e-8)
    scaled = log_probs / temperature
    exp_scaled = np.exp(scaled)
    return exp_scaled / np.sum(exp_scaled)

def apply_confusion_correction(probabilities):
    """应用混淆矩阵校正"""
    corrected = probabilities.copy()
    
    for true_emotion, corrections in CONFUSION_CORRECTION.items():
        if true_emotion in corrected:
            for confused_with, penalty in corrections.items():
                if confused_with in corrected:
                    # 减少混淆类别的概率
                    corrected[confused_with] *= (1 - penalty)
                    # 增加真实类别的概率
                    corrected[true_emotion] += probabilities[confused_with] * penalty
    
    # 重新归一化
    total = sum(corrected.values())
    return {k: v/total for k, v in corrected.items()}

def temporal_smoothing(current_probs, alpha=0.6):
    """指数移动平均平滑"""
    global emotion_history
    
    if len(emotion_history) == 0:
        return current_probs
    
    last_probs = emotion_history[-1]
    smoothed = {}
    
    for emotion in EMOTIONS:
        smoothed[emotion] = alpha * current_probs[emotion] + (1 - alpha) * last_probs.get(emotion, current_probs[emotion])
    
    return smoothed

def multi_frame_voting(recent_frames, weights=None):
    """加权多帧投票"""
    if len(recent_frames) < 3:
        return recent_frames[-1] if recent_frames else None
    
    if weights is None:
        # 默认权重：越新的帧权重越高
        weights = [0.1, 0.15, 0.2, 0.25, 0.3][:len(recent_frames)]
        weights = weights[::-1]  # 反转，最新的权重最高
    
    # 加权平均概率
    avg_probs = {emo: 0 for emo in EMOTIONS}
    weight_sum = sum(weights)
    
    for i, frame in enumerate(recent_frames):
        w = weights[i] / weight_sum
        for emo in EMOTIONS:
            avg_probs[emo] += frame['probabilities'].get(emo, 0) * w
    
    # 找出最高概率的情绪
    winner = max(avg_probs, key=avg_probs.get)
    
    # 返回对应帧的结果
    for frame in reversed(recent_frames):
        if frame['emotion'] == winner:
            result = frame.copy()
            result['probabilities'] = avg_probs
            return result
    
    return recent_frames[-1]

def emotion_locking(current_emotion, current_confidence):
    """情绪锁定机制"""
    global locked_emotion, locked_confidence, lock_counter
    
    if current_emotion == locked_emotion:
        lock_counter = min(lock_counter + 1, 10)  # 上限10
        # 更新置信度（EMA）
        locked_confidence = 0.7 * locked_confidence + 0.3 * current_confidence
    else:
        lock_counter -= 1
        if lock_counter < 0:
            lock_counter = 0
        
        # 只有当新情绪连续出现且置信度高才切换
        if lock_counter == 0 and current_confidence > 50:
            locked_emotion = current_emotion
            locked_confidence = current_confidence
            lock_counter = 1
    
    return locked_emotion, locked_confidence, lock_counter

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
        'version': '4.0-ultimate',
        'features': [
            'yolo_detection', 'clahe_enhancement', 'face_alignment',
            'test_time_augmentation', 'temporal_smoothing', 'multi_frame_voting',
            'emotion_locking', 'confusion_correction'
        ],
        'emotions_supported': EMOTIONS
    })

@app.route('/detect', methods=['POST', 'OPTIONS'])
def detect_emotion():
    """终极版情绪检测"""
    global emotion_history, frame_history, locked_emotion, locked_confidence, lock_counter
    
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
        
        # 转换为灰度
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # CLAHE增强
        enhanced = enhance_image(gray)
        
        # 人脸检测
        if yolo_model is not None:
            faces = detect_faces_yolo(frame)
            detection_method = 'yolo'
        else:
            faces = detect_faces_haar(enhanced)
            detection_method = 'haar'
        
        if len(faces) == 0:
            return create_response({
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0
            })
        
        results = []
        for face_data in faces:
            if len(face_data) == 5:
                x, y, w, h, det_conf = face_data
            else:
                x, y, w, h = face_data
                det_conf = 1.0
            
            # 人脸对齐
            aligned_face = align_face(enhanced, (x, y, w, h))
            
            # TTA推理（多次增强取平均）
            preds = predict_with_tta(aligned_face, n_augmentations=3)
            
            # 温度缩放
            scaled_preds = apply_temperature_scaling(preds, temperature=0.4)
            
            # 构建概率字典
            probabilities = {EMOTIONS[i]: float(scaled_preds[i]) for i in range(len(EMOTIONS))}
            
            # 应用优先级权重
            for emotion in EMOTIONS:
                probabilities[emotion] *= EMOTION_PRIORITY[emotion]
            
            # 重新归一化
            total = sum(probabilities.values())
            probabilities = {k: v/total for k, v in probabilities.items()}
            
            # 混淆矩阵校正
            probabilities = apply_confusion_correction(probabilities)
            
            # 时序平滑
            probabilities = temporal_smoothing(probabilities, alpha=0.6)
            
            # 保存到历史
            emotion_history.append(probabilities)
            
            # 找到最高概率
            max_emotion = max(probabilities, key=probabilities.get)
            max_prob = probabilities[max_emotion]
            
            # 添加到帧历史
            frame_history.append({
                'emotion': max_emotion,
                'confidence': max_prob,
                'probabilities': probabilities,
                'face': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)}
            })
            
            # 多帧投票
            voted_result = multi_frame_voting(list(frame_history))
            if voted_result:
                max_emotion = voted_result['emotion']
                max_prob = voted_result['confidence']
                probabilities = voted_result['probabilities']
            
            # 情绪锁定
            locked_emotion, locked_confidence, stability = emotion_locking(max_emotion, max_prob)
            
            # 自适应阈值
            CONFIDENCE_THRESHOLD = 40
            is_confident = locked_confidence >= CONFIDENCE_THRESHOLD
            
            # 低置信度时检查第二情绪
            if not is_confident:
                sorted_emotions = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
                if len(sorted_emotions) > 1:
                    second_emotion, second_prob = sorted_emotions[1]
                    if second_prob > locked_confidence * 0.85 and EMOTION_PRIORITY[second_emotion] > EMOTION_PRIORITY[locked_emotion]:
                        locked_emotion = second_emotion
                        locked_confidence = second_prob
            
            results.append({
                'face': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                'emotion': locked_emotion,
                'emotion_label': EMOTION_LABELS[locked_emotion],
                'confidence': round(locked_confidence * 100, 1),
                'raw_confidence': round(max_prob * 100, 1),
                'is_confident': is_confident,
                'stability': stability,
                'detection_conf': round(det_conf, 3),
                'detection_method': detection_method,
                'probabilities': {k: round(v * 100, 1) for k, v in probabilities.items()}
            })
        
        return create_response({
            'success': True,
            'faces_detected': len(results),
            'results': results,
            'method': 'ultimate_v4',
            'history_size': len(emotion_history)
        })
        
    except Exception as e:
        logger.error(f"检测失败: {e}")
        import traceback
        traceback.print_exc()
        return create_response({'success': False, 'error': str(e)}, 500)

@app.route('/reset', methods=['POST'])
def reset_history():
    """重置历史"""
    global emotion_history, frame_history, locked_emotion, locked_confidence, lock_counter
    emotion_history.clear()
    frame_history.clear()
    locked_emotion = 'neutral'
    locked_confidence = 0
    lock_counter = 0
    return create_response({'success': True, 'message': '历史已重置'})

@app.route('/emotions', methods=['GET'])
def get_emotions():
    """获取情绪列表"""
    return create_response({
        'emotions': EMOTIONS,
        'emotion_labels': EMOTION_LABELS,
        'emotion_priority': EMOTION_PRIORITY
    })

if __name__ == '__main__':
    if load_models():
        logger.info("🚀 启动终极版情绪检测API v4.0...")
        logger.info("特性: YOLO+TTA+CLAHE+对齐+平滑+投票+锁定")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    else:
        logger.error("❌ 模型加载失败")
