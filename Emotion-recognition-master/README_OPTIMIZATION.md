# 情绪识别系统优化方案

## 问题分析

原系统存在的问题：
1. **情绪分布太均匀** - 各情绪概率差异小，置信度低
2. **情绪抖动严重** - 相邻帧情绪变化频繁
3. **检测不准确** - 使用CDN模型，不适合本地场景
4. **缺少平滑处理** - 没有时序一致性

## 优化方案

### 1. Python API优化 (`emotion_api_v2.py`)

#### 主要改进：
- **图像预处理增强**：直方图均衡化 + CLAHE
- **温度缩放**：使概率分布更尖锐，突出主导情绪
- **时序平滑**：指数加权移动平均，减少抖动
- **置信度阈值**：过滤低置信度结果
- **情绪优先级**：某些情绪（如happy/sad）更容易被检测

#### 启动方式：
```bash
# 方式1：直接启动
python emotion_api_v2.py

# 方式2：使用启动脚本
start_emotion_api.bat
```

#### API接口：
- `GET /health` - 健康检查
- `POST /detect` - 情绪检测
  - 参数：`{image: "base64", smoothing: true, debug: false}`
- `POST /reset` - 重置历史
- `GET /emotions` - 获取情绪列表

### 2. 前端优化 (`emotion_analyzer_v2.js`)

#### 主要改进：
- **稳定性检测**：连续多帧确认才触发情绪变化
- **置信度过滤**：忽略低置信度检测
- **趋势分析**：stable/worsening/improving/fluctuating
- **性能优化**：可配置检测间隔
- **详细统计**：成功率、运行时间等

#### 使用方式：
```javascript
// 初始化
const analyzer = new EmotionAnalyzer({
  apiUrl: 'http://localhost:5000/detect',
  detectInterval: 300,      // 检测间隔(ms)
  confidenceThreshold: 40,  // 置信度阈值(%)
  smoothingWindow: 3,       // 平滑窗口
  enableDebug: false
});

// 启动
await analyzer.init();
analyzer.start();

// 监听情绪变化
window.onUserEmotionDetected = (data) => {
  console.log('情绪:', data.emotion);
  console.log('策略:', data.strategy);
  console.log('趋势:', data.trend);
};
```

### 3. 模型训练优化 (`train_emotion_optimized.py`)

#### 主要改进：
- **数据增强**：旋转、平移、缩放、亮度、剪切
- **类别权重**：处理数据不平衡
- **学习率调度**：自适应学习率
- **早停策略**：防止过拟合
- **高级预处理**：CLAHE增强

#### 训练命令：
```bash
python train_emotion_optimized.py
```

## 文件说明

```
D:\AAAfuwuwaibao\emotions\Emotion-recognition-master\
├── emotion_api_v2.py              # 优化的API服务（主文件）
├── emotion_analyzer_v2.js         # 优化的前端模块
├── train_emotion_optimized.py     # 优化的训练脚本
├── start_emotion_api.bat          # 启动脚本
└── README_OPTIMIZATION.md         # 本文档

D:\AAAfuwuwaibao\aaa\              # Python依赖包
├── tensorflow\                    # TensorFlow 2.x
├── keras\                         # Keras 3.x
├── opencv_python\                 # OpenCV
├── numpy\                         # NumPy
└── ...
```

## 集成到LiveTalking

### 1. 修改 emotion_companion.html

在HTML中引入新模块：
```html
<!-- 替换原来的 emotion_analyzer.js -->
<script src="emotion_analyzer_v2.js"></script>
```

### 2. 初始化代码

```javascript
// 在 emotion_companion.html 中
const emotionAnalyzer = new EmotionAnalyzer({
  detectInterval: 300,
  confidenceThreshold: 40
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
  const success = await emotionAnalyzer.init();
  if (success) {
    emotionAnalyzer.start();
  }
});

// 情绪变化回调
window.onUserEmotionDetected = (emotionData) => {
  // 更新UI显示
  updateEmotionUI(emotionData);
  
  // 生成AI提示词
  const promptEnhancement = emotionAnalyzer.generatePromptEnhancement();
  
  // 发送到LLM
  sendToLLM(promptEnhancement);
};
```

## 测试API

### 使用curl测试：
```bash
# 健康检查
curl http://localhost:5000/health

# 获取情绪列表
curl http://localhost:5000/emotions

# 情绪检测（需要准备base64图片）
curl -X POST http://localhost:5000/detect \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ..."}'
```

### 使用Python测试：
```python
import requests
import base64

# 读取图片并编码
with open("test_face.jpg", "rb") as f:
    img_base64 = base64.b64encode(f.read()).decode()

# 调用API
response = requests.post("http://localhost:5000/detect", json={
    "image": f"data:image/jpeg;base64,{img_base64}",
    "smoothing": True
})

print(response.json())
```

## 性能优化建议

1. **降低检测频率**：将 `detectInterval` 增加到 500ms 或更高
2. **减小图像尺寸**：降低 canvas 分辨率到 240x180
3. **使用GPU**：确保TensorFlow使用GPU加速
4. **批量检测**：如果需要，可以实现批量检测接口

## 常见问题

### Q: API启动失败
A: 检查Python依赖是否正确安装：
```bash
python -c "import tensorflow; print(tensorflow.__version__)"
python -c "import cv2; print(cv2.__version__)"
```

### Q: 情绪检测不准确
A: 
1. 确保光线充足
2. 人脸正对摄像头
3. 调整 `confidenceThreshold` 参数
4. 考虑重新训练模型

### Q: 情绪抖动仍然严重
A:
1. 增加 `smoothingWindow` 大小
2. 增加 `stableThreshold` 值
3. 增加 `detectInterval` 间隔

## 下一步优化

1. **使用更先进的模型**：如EfficientNet、ResNet
2. **多模型集成**：结合多个模型的预测结果
3. **迁移学习**：使用预训练的人脸识别模型
4. **实时反馈**：根据用户反馈在线调整
