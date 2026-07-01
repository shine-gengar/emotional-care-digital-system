"""
情绪检测API服务 v4.0 - 稳定性优化版
改进点：
1. 更长的历史记录 (30帧)
2. 更强的时序平滑 (alpha=0.3)
3. 情绪锁定机制 - 高置信度时锁定
4. 多帧投票系统
5. CLAHE图像增强
6. 人脸对齐
7. 情绪切换冷却期
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
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# 全局变量
model = None
face_cascade = None
emotion_history = deque(maxlen=30)  # 增加到30帧历史
locked_emotion = None  # 锁定的情绪
locked_confidence = 0  # 锁定时的置信度
lock_start_time = 0  # 锁定开始时间
last_emotion_change = 0  # 上次情绪变化时间
frame_count = 0  # 帧计数

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
    'CONFIDENCE_THRESHOLD': 0.50,  # 置信度阈值提高到50%
    'LOCK_THRESHOLD': 0.70,  # 锁定阈值70%
    'LOCK_DURATION': 2.0,  # 锁定持续时间2秒
    'COOLDOWN_DURATION': 1.5,  # 情绪切换冷却期1.5秒
    'SMOOTHING_ALPHA': 0.3,  # 平滑系数0.3（历史权重更高）
    'TEMPERATURE': 0.5,  # 温度缩放
    'VOTE_FRAMES': 10,  # 投票使用的帧数
    'MIN_FACE_SIZE': 80,  # 最小人脸尺寸
}

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'message': '情绪识别API服务 v4.0',
        'version': '4.0',
        'config': CONFIG,
        'status': 'running'
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'history_size': len(emotion_history),
        'locked_emotion': locked_emotion,
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

def apply_clahe(image):
    """应用CLAHE对比度增强"""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(image)

def align_face(gray, face_rect):
    """人脸对齐"""
    x, y, w, h = face_rect
    face_roi = gray[y:y+h, x:x+w]
    
    # 使用CLAHE增强对比度
    face_roi = apply_clahe(face_roi)
    
    return face_roi

def preprocess_face(face_img, target_size=(48, 48)):
    """预处理人脸图像"""
    # 调整大小
    face_img = cv2.resize(face_img, target_size)
    
    # 归一化
    face_img = face_img.astype("float32") / 255.0
    
    return face_img

def apply_temperature_scaling(probs, temperature=0.5):
    """应用温度缩放，使分布更尖锐"""
    log_probs = np.log(np.array(list(probs.values())) + 1e-8)
    scaled = log_probs / temperature
    exp_scaled = np.exp(scaled)
    result = exp_scaled / np.sum(exp_scaled)
    return {k: result[i] for i, k in enumerate(probs.keys())}

def temporal_smoothing(current_probs, alpha=0.3):
    """时序平滑 - 使用指数加权移动平均"""
    global emotion_history
    
    if len(emotion_history) == 0:
        return current_probs
    
    # 计算历史平均
    history_avg = {}
    for emotion in EMOTIONS:
        values = [h[emotion] for h in emotion_history]
        history_avg[emotion] = np.mean(values)
    
    # 指数加权平均
    smoothed = {}
    for emotion in EMOTIONS:
        smoothed[emotion] = alpha * current_probs[emotion] + (1 - alpha) * history_avg[emotion]
    
    return smoothed

def get_voting_result():
    """多帧投票系统"""
    global emotion_history
    
    if len(emotion_history) < 5:
        return None, 0
    
    # 使用最近VOTE_FRAMES帧
    recent_frames = list(emotion_history)[-CONFIG['VOTE_FRAMES']:]
    
    # 统计每个情绪的出现次数（取每帧最高概率的情绪）
    emotion_votes = {e: 0 for e in EMOTIONS}
    emotion_scores = {e: 0.0 for e in EMOTIONS}
    
    for frame_probs in recent_frames:
        max_emotion = max(frame_probs, key=frame_probs.get)
        emotion_votes[max_emotion] += 1
        for e in EMOTIONS:
            emotion_scores[e] += frame_probs[e]
    
    # 平均分数
    for e in EMOTIONS:
        emotion_scores[e] /= len(recent_frames)
    
    # 找出票数最多的情绪
    winner = max(emotion_votes, key=emotion_votes.get)
    vote_count = emotion_votes[winner]
    vote_ratio = vote_count / len(recent_frames)
    
    return winner, vote_ratio, emotion_scores

def should_change_emotion(new_emotion, new_confidence, current_time):
    """判断是否应该切换情绪"""
    global locked_emotion, locked_confidence, lock_start_time, last_emotion_change
    
    # 检查冷却期
    if current_time - last_emotion_change < CONFIG['COOLDOWN_DURATION']:
        return False
    
    # 如果有锁定的情绪
    if locked_emotion is not None:
        # 检查锁定是否过期
        if current_time - lock_start_time > CONFIG['LOCK_DURATION']:
            locked_emotion = None  # 解锁
        else:
            # 锁定期间，只有新情绪置信度显著更高才切换
            if new_emotion != locked_emotion:
                if new_confidence > locked_confidence * 1.3 and new_confidence > 0.8:
                    return True
            return False
    
    return True

def detect_emotion_from_frame(frame, debug=False):
    """从视频帧中检测情绪"""
    global model, face_cascade, emotion_history, locked_emotion, locked_confidence
    global lock_start_time, last_emotion_change, frame_count
    
    frame_count += 1
    current_time = time.time()
    
    if model is None or face_cascade is None:
        return {'error': '模型未加载', 'success': False}
    
    debug_info = {'frame': frame_count}
    
    try:
        # 转换为灰度图
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 人脸检测 - 提高minNeighbors减少误检
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=6,  # 增加到6
            minSize=(CONFIG['MIN_FACE_SIZE'], CONFIG['MIN_FACE_SIZE']),
            maxSize=(gray.shape[1]//2, gray.shape[0]//2)
        )
        
        debug_info['faces_detected'] = len(faces)
        
        if len(faces) == 0:
            # 没有检测到人脸，逐渐清空历史
            if len(emotion_history) > 0 and frame_count % 10 == 0:
                emotion_history.popleft()
            return {
                'success': False,
                'error': '未检测到人脸',
                'faces_detected': 0,
                'debug': debug_info if debug else None
            }
        
        results = []
        
        for (x, y, w, h) in faces:
            # 人脸对齐和增强
            face_roi = align_face(gray, (x, y, w, h))
            
            # 预处理
            processed_face = preprocess_face(face_roi, (48, 48))
            
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
            
            # 多帧投票
            vote_winner, vote_ratio, vote_scores = get_voting_result()
            
            # 决定最终情绪
            # 策略：结合当前帧和投票结果
            current_max = max(smoothed_probs, key=smoothed_probs.get)
            current_max_prob = smoothed_probs[current_max]
            
            # 如果投票结果一致且比例高，使用投票结果
            if vote_winner is not None and vote_ratio > 0.6:
                final_emotion = vote_winner
                final_confidence = vote_scores[vote_winner]
            else:
                final_emotion = current_max
                final_confidence = current_max_prob
            
            # 检查是否应该切换情绪
            is_locked_state = False
            if not should_change_emotion(final_emotion, final_confidence, current_time):
                # 保持锁定状态
                if locked_emotion:
                    final_emotion = locked_emotion
                    final_confidence = locked_confidence
                    is_locked_state = True
            else:
                # 更新锁定状态
                if final_confidence >= CONFIG['LOCK_THRESHOLD']:
                    locked_emotion = final_emotion
                    locked_confidence = final_confidence
                    lock_start_time = current_time
                    is_locked_state = True
                
                # 记录情绪变化
                if locked_emotion != final_emotion:
                    last_emotion_change = current_time
                    locked_emotion = final_emotion
                    locked_confidence = final_confidence
            
            # 确保返回的probabilities与final_emotion和final_confidence一致
            # 创建新的概率字典，将主导情绪设为final_confidence，其他按比例调整
            display_probs = {}
            total_other = sum(v for k, v in smoothed_probs.items() if k != final_emotion)
            
            for emo in EMOTIONS:
                if emo == final_emotion:
                    display_probs[emo] = final_confidence
                else:
                    # 其他情绪按比例缩放，确保总和为1-final_confidence
                    if total_other > 0:
                        display_probs[emo] = smoothed_probs[emo] * (1 - final_confidence) / total_other
                    else:
                        display_probs[emo] = (1 - final_confidence) / (len(EMOTIONS) - 1)
            
            # 置信度检查
            is_confident = final_confidence >= CONFIG['CONFIDENCE_THRESHOLD']
            
            result = {
                'face': {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h)
                },
                'emotion': final_emotion,
                'emotion_label': EMOTION_LABELS[final_emotion],
                'confidence': round(final_confidence, 3),  # 返回0-1范围的小数
                'is_confident': is_confident,
                'is_locked': is_locked_state and final_confidence >= CONFIG['LOCK_THRESHOLD'],
                'probabilities': {k: round(v, 3) for k, v in display_probs.items()},  # 使用调整后的概率
                'vote_winner': vote_winner,
                'vote_ratio': round(vote_ratio, 3) if vote_ratio else None,  # 返回0-1范围的小数
            }
            
            if debug:
                result['raw_predictions'] = {EMOTIONS[i]: round(float(preds[i]) * 100, 1) for i in range(len(EMOTIONS))}
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
    global emotion_history, locked_emotion, locked_confidence, frame_count
    emotion_history.clear()
    locked_emotion = None
    locked_confidence = 0
    frame_count = 0
    return jsonify({'success': True, 'message': '情绪历史已重置'})

@app.route('/config', methods=['GET', 'POST'])
def update_config():
    """获取或更新配置"""
    global CONFIG
    
    if request.method == 'GET':
        return jsonify(CONFIG)
    
    elif request.method == 'POST':
        data = request.get_json()
        for key in data:
            if key in CONFIG:
                CONFIG[key] = data[key]
        return jsonify({'success': True, 'config': CONFIG})

if __name__ == '__main__':
    if load_model_and_detector():
        logger.info("启动情绪检测API服务 v4.0 (稳定性优化版)...")
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    else:
        logger.error("模型加载失败，无法启动服务")
