"""
使用实际图像测试情绪分析API
"""

import requests
import cv2
import numpy as np
import base64

def encode_image_to_base64(image_path):
    """将图片编码为base64"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def test_with_actual_image():
    """使用实际图像测试情绪分析API"""
    
    # 使用项目中的示例图像
    image_path = "emotions/Happy.PNG"
    
    print("=" * 50)
    print("测试: 使用实际图像进行情绪检测")
    print("=" * 50)
    
    try:
        # 编码图像
        img_base64 = encode_image_to_base64(image_path)
        
        # 发送请求
        response = requests.post(
            "http://localhost:5000/detect",
            json={"image": f"data:image/png;base64,{img_base64}"},
            timeout=10
        )
        
        print(f"状态: {response.status_code}")
        print(f"响应: {response.json()}")
        
    except Exception as e:
        print(f"❌ 失败: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)

if __name__ == "__main__":
    test_with_actual_image()