from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins="*")

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
    app.run(host='0.0.0.0', port=5002, debug=True)
