"""
情绪分析API测试脚本
"""

import sys
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')

import requests
import cv2
import numpy as np
import base64

def encode_image_to_base64(image_path):
    """将图片编码为base64"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def test_api():
    """测试情绪分析API"""
    
    # 测试健康检查
    print("=" * 50)
    print("测试1: 健康检查")
    print("=" * 50)
    try:
        response = requests.get("http://localhost:5000/health", timeout=5)
        print(f"状态: {response.status_code}")
        print(f"响应: {response.json()}")
    except Exception as e:
        print(f"❌ 失败: {e}")
        return
    
    # 测试情绪列表
    print("\n" + "=" * 50)
    print("测试2: 情绪列表")
    print("=" * 50)
    try:
        response = requests.get("http://localhost:5000/emotions", timeout=5)
        print(f"状态: {response.status_code}")
        data = response.json()
        print(f"支持的情绪: {data['emotions']}")
        print(f"情绪标签: {data['emotion_labels']}")
    except Exception as e:
        print(f"❌ 失败: {e}")
    
    # 测试情绪检测（使用生成的测试图像）
    print("\n" + "=" * 50)
    print("测试3: 情绪检测（使用测试图像）")
    print("=" * 50)
    
    # 创建一个简单的测试图像（模拟人脸区域）
    test_img = np.random.randint(0, 255, (240, 320, 3), dtype=np.uint8)
    # 在中心画一个矩形模拟人脸
    cv2.rectangle(test_img, (110, 70), (210, 170), (128, 128, 128), -1)
    
    # 编码为base64
    _, buffer = cv2.imencode('.jpg', test_img)
    img_base64 = base64.b64encode(buffer).decode()
    
    try:
        response = requests.post(
            "http://localhost:5000/detect",
            json={"image": f"data:image/jpeg;base64,{img_base64}", "debug": True},
            timeout=10
        )
        print(f"状态: {response.status_code}")
        data = response.json()
        print(f"成功: {data.get('success')}")
        print(f"检测到人脸: {data.get('faces_detected')}")
        if data.get('results'):
            result = data['results'][0]
            print(f"情绪: {result['emotion']} ({result['emotion_label']})")
            print(f"置信度: {result['confidence']}%")
            print(f"概率分布: {result['probabilities']}")
    except Exception as e:
        print(f"❌ 失败: {e}")
    
    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)

if __name__ == "__main__":
    test_api()
