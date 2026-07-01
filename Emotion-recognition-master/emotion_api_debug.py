from flask import Flask, jsonify
from flask_cors import CORS
import sys

# 添加新依赖路径
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=False)

# 添加CORS头到所有响应
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# 全局变量
model = None
face_cascade = None

# 情绪标签
EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'message': '情绪识别API服务',
        'version': '2.0',
        'endpoints': {
            'health': '/health',
            'emotions': '/emotions'
        },
        'status': 'running'
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'detector_loaded': face_cascade is not None,
        'emotions_supported': EMOTIONS
    })

@app.route('/emotions', methods=['GET'])
def get_emotions():
    return jsonify({
        'emotions': EMOTIONS
    })

if __name__ == '__main__':
    print("启动调试版情绪检测API服务...")
    app.run(host='0.0.0.0', port=5004, debug=True)
