# LiveTalking 情绪识别优化集成

## 概述

本项目已将优化后的情绪识别功能集成到LiveTalking情感陪护数字人系统中。

## 主要改进

### 1. 后端优化 (Python API)
- **文件**: `D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\emotion_api_v2.py`
- **改进**:
  - 图像预处理增强（直方图均衡化 + CLAHE）
  - 温度缩放使概率分布更尖锐
  - 时序平滑减少抖动
  - 置信度阈值过滤
  - 情绪优先级调整

### 2. 前端优化
- **文件**: `D:\AAAfuwuwaibao\code\LiveTalking-main\LiveTalking-main\web\emotion_companion.html`
- **改进**:
  - 调用Python API进行实时情绪分析
  - 更好的错误处理
  - 情绪徽章实时更新

### 3. 集成模块
- **文件**: `D:\AAAfuwuwaibao\code\LiveTalking-main\LiveTalking-main\web\livetalking_emotion.js`
- **功能**: 可复用的情绪分析模块

## 启动方式

### 方式1：一键启动（推荐）
```bash
D:\AAAfuwuwaibao\code\start_all_services.bat
```

这会同时启动：
- 情绪分析API (http://localhost:5000)
- LiveTalking数字人 (http://localhost:8010)

### 方式2：手动启动

**步骤1：启动情绪分析API**
```bash
cd D:\AAAfuwuwaibao\emotions\Emotion-recognition-master
set PYTHONPATH=D:\AAAfuwuwaibao\aaa;%PYTHONPATH%
python emotion_api_v2.py
```

**步骤2：启动LiveTalking**
```bash
cd D:\AAAfuwuwaibao\code\LiveTalking-main\LiveTalking-main
python app.py --model wav2lip --avatar_id wav2lip256_avatar1 --transport webrtc
```

**步骤3：打开浏览器**
访问: http://localhost:8010/emotion_companion.html

## 使用说明

1. **开始视频通话**
   - 点击"开始视频通话"按钮连接数字人

2. **打开摄像头**
   - 点击"打开摄像头"按钮启用用户摄像头
   - 情绪分析面板会自动显示

3. **查看情绪分析**
   - 左侧会显示实时情绪分析结果
   - 包括主导情绪和概率分布
   - 摄像头画面上会显示当前情绪标签

4. **对话交互**
   - 按住麦克风按钮说话
   - 或输入文字发送消息
   - 数字人会根据情绪调整回应策略

## API接口

### 健康检查
```
GET http://localhost:5000/health
```

### 情绪检测
```
POST http://localhost:5000/detect
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "smoothing": true,
  "debug": false
}
```

### 响应示例
```json
{
  "success": true,
  "faces_detected": 1,
  "results": [{
    "emotion": "happy",
    "emotion_label": "开心",
    "confidence": 85.5,
    "probabilities": {
      "angry": 5.2,
      "disgust": 1.1,
      "scared": 2.3,
      "happy": 85.5,
      "sad": 3.1,
      "surprised": 1.8,
      "neutral": 1.0
    }
  }]
}
```

## 文件结构

```
D:\AAAfuwuwaibao\code\
├── start_all_services.bat          # 一键启动脚本
├── LiveTalking-main\
│   └── LiveTalking-main\
│       └── web\
│           ├── emotion_companion.html    # 主页面（已优化）
│           ├── livetalking_emotion.js    # 情绪分析模块
│           └── client.js                 # WebRTC客户端
└── emotions\
    ├── start_emotion_api.bat
    └── Emotion-recognition-master\
        ├── emotion_api_v2.py         # 优化的API服务
        ├── train_emotion_optimized.py
        └── README_OPTIMIZATION.md
```

## 故障排除

### 情绪分析不工作
1. 检查API是否启动: http://localhost:5000/health
2. 检查浏览器控制台错误信息
3. 确保摄像头权限已授权

### API启动失败
1. 检查Python依赖: `python -c "import tensorflow; print(tensorflow.__version__)"`
2. 检查模型文件是否存在: `models\_mini_XCEPTION.102-0.66.hdf5`

### 情绪检测不准确
1. 确保光线充足
2. 人脸正对摄像头
3. 调整检测频率或置信度阈值

## 性能优化建议

1. **降低检测频率**: 修改 `performEmotionAnalysis` 中的间隔时间
2. **减小图像尺寸**: 降低 canvas 分辨率
3. **使用GPU**: 确保TensorFlow使用GPU加速

## 下一步优化

1. 使用更先进的深度学习模型
2. 添加多模型集成
3. 实现情绪趋势预测
4. 添加用户情绪档案
