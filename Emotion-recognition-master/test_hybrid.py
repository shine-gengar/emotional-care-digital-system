"""
测试脚本 - 对比 YOLO vs XCEPTION vs 混合模型
"""

import sys
sys.path.insert(0, r'D:\AAAfuwuwaibao\aaa')
sys.path.insert(0, r'D:\Yolo-FaceEmotionAI-main\Yolo-FaceEmotionAI-main')

import cv2
import numpy as np
import requests
import base64

def test_api():
    """测试混合版API"""
    
    print("=" * 60)
    print("测试混合版情绪识别API v5.0")
    print("=" * 60)
    
    # 1. 健康检查
    print("\n[1/3] 健康检查...")
    try:
        resp = requests.get('http://localhost:5000/health', timeout=5)
        data = resp.json()
        print(f"✅ API状态: {data.get('status')}")
        print(f"   版本: {data.get('version')}")
        print(f"   YOLO模型: {'✅' if data.get('yolo_loaded') else '❌'}")
        print(f"   XCEPTION模型: {'✅' if data.get('xception_loaded') else '❌'}")
        print(f"   融合模式: {data.get('fusion_mode')}")
        print(f"   权重: {data.get('weights')}")
    except Exception as e:
        print(f"❌ API连接失败: {e}")
        return
    
    # 2. 准备测试图像
    print("\n[2/3] 准备测试图像...")
    # 创建一个简单的测试图像（模拟人脸）
    test_img = np.random.randint(100, 200, (240, 320, 3), dtype=np.uint8)
    # 在中心画一个矩形模拟人脸
    cv2.rectangle(test_img, (110, 70), (210, 170), (150, 150, 150), -1)
    
    _, buffer = cv2.imencode('.jpg', test_img)
    img_base64 = base64.b64encode(buffer).decode()
    
    # 3. 测试情绪检测
    print("\n[3/3] 测试情绪检测...")
    try:
        resp = requests.post(
            'http://localhost:5000/detect',
            json={'image': f'data:image/jpeg;base64,{img_base64}'},
            timeout=10
        )
        data = resp.json()
        
        if data.get('success'):
            print(f"✅ 检测成功")
            print(f"   检测到人脸: {data.get('faces_detected')}")
            print(f"   使用方法: {data.get('method')}")
            
            for i, result in enumerate(data.get('results', [])):
                print(f"\n   人脸 {i+1}:")
                print(f"     情绪: {result['emotion_label']} ({result['emotion']})")
                print(f"     置信度: {result['confidence']}%")
                print(f"     使用模型: {result['model_used']}")
        else:
            print(f"⚠️ 检测失败: {data.get('error')}")
    except Exception as e:
        print(f"❌ 检测请求失败: {e}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == '__main__':
    test_api()
