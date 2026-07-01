# Live2D 数字人本地服务
# 基于 枫云AI虚拟伙伴 的驱动程序

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import sys
import random
import threading
import time

# 添加原项目路径
sys.path.insert(0, 'D:/数字人')

app = Flask(__name__)
CORS(app)  # 允许跨域

# 配置
PORT = 5261  # 数字人服务端口
DIST_PATH = 'D:/数字人/dist'
LIVE2D_MODEL_PATH = 'D:/数字人/dist/assets/live2d_model/hiyori_free_t08'

# 全局状态
class DigitalHumanState:
    def __init__(self):
        self.is_speaking = False
        self.mouth_y = 0  # 嘴部开合度 0-1
        self.current_text = ""
        self.speak_queue = []
        
state = DigitalHumanState()

@app.route('/')
def index():
    """Live2D 数字人页面"""
    return send_from_directory(DIST_PATH, 'live2d.html')

@app.route('/api/speak', methods=['POST'])
def speak():
    """驱动数字人说话"""
    data = request.get_json()
    text = data.get('text', '')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    state.current_text = text
    state.speak_queue.append(text)
    
    # 模拟语音合成时间（实际应该调用 TTS）
    # 这里简化处理，实际应该调用原项目的 TTS
    duration = len(text) * 0.3  # 估算说话时间
    
    return jsonify({
        'success': True,
        'text': text,
        'duration': duration
    })

@app.route('/api/stop', methods=['POST'])
def stop_speaking():
    """停止说话"""
    state.is_speaking = False
    state.speak_queue.clear()
    state.mouth_y = 0
    return jsonify({'success': True})

@app.route('/api/status')
def get_status():
    """获取数字人状态"""
    return jsonify({
        'is_speaking': state.is_speaking,
        'mouth_y': state.mouth_y,
        'current_text': state.current_text
    })

@app.route('/api/mouth')
def get_mouth():
    """获取嘴部动画数据（用于驱动 Live2D）"""
    if state.is_speaking:
        # 模拟嘴部动画
        import math
        t = time.time()
        state.mouth_y = (math.sin(t * 10) + 1) / 2  # 0-1 之间波动
    else:
        state.mouth_y = 0
    
    return jsonify({'y': state.mouth_y})

# 静态资源服务
@app.route('/assets/<path:path>')
def serve_assets(path):
    return send_from_directory(f'{DIST_PATH}/assets', path)

@app.route('/data/image/<path:path>')
def serve_images(path):
    return send_from_directory('D:/数字人/data/image', path)

def run_server():
    print(f"🎭 Live2D 数字人服务启动中...")
    print(f"📱 访问地址: http://localhost:{PORT}")
    print(f"🔧 API 端点:")
    print(f"   - POST /api/speak    驱动数字人说话")
    print(f"   - POST /api/stop     停止说话")
    print(f"   - GET  /api/status   获取状态")
    print(f"   - GET  /api/mouth    获取嘴部动画")
    app.run(host='0.0.0.0', port=PORT, debug=False)

if __name__ == '__main__':
    run_server()
