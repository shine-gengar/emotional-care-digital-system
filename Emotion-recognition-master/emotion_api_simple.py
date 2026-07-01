from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins="*")

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'message': '情绪识别API服务',
        'version': '2.0',
        'status': 'running'
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok'
    })

if __name__ == '__main__':
    print("启动简化版情绪检测API服务...")
    app.run(host='0.0.0.0', port=5003, debug=True)
