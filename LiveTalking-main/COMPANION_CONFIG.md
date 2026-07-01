# 情感陪护数字人系统配置说明

## 功能概述

将之前的虚拟数字人陪护系统集成到 LiveTalking 中，实现：
1. 用户语音输入 → 语音识别 → 显示在对话框
2. AI 对话生成回复
3. 数字人用指定声线播报回复

## 文件说明

| 文件 | 说明 |
|------|------|
| `companion_llm.py` | 陪护系统核心模块（语音识别、AI对话、语音合成） |
| `web/companion.html` | 陪护系统前端页面（带对话框和语音输入） |
| `app.py` | 已修改，集成陪护系统 LLM |

## 配置 API 和声线

编辑 `companion_llm.py` 文件，配置你的 API 密钥：

### 1. SiliconFlow API 配置（AI对话）

```python
SILICONFLOW_API_KEY = "your-api-key-here"  # 替换为你的API Key
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
SILICONFLOW_MODEL = "deepseek-ai/DeepSeek-V3"
```

获取 API Key：https://cloud.siliconflow.cn/

### 2. 百度语音识别配置（ASR）

```python
BAIDU_ASR_API_KEY = "your-asr-api-key"
BAIDU_ASR_SECRET_KEY = "your-asr-secret-key"
```

获取方式：https://ai.baidu.com/tech/speech/asr

### 3. 百度语音合成配置（TTS声线）

```python
BAIDU_TTS_APP_ID = "your-tts-app-id"
BAIDU_TTS_API_KEY = "your-tts-api-key"
BAIDU_TTS_SECRET_KEY = "your-tts-secret-key"
BAIDU_TTS_VOICE = "CAP_4194"  # 度嫣然声线，可替换
```

获取方式：https://ai.baidu.com/tech/speech/tts

**可选声线**：
- `CAP_4194` - 度嫣然（女声，温柔）
- `CAP_4195` - 度小宇（男声）
- `CAP_4196` - 度小美（女声）
- `CAP_4197` - 度小童（童声）
- 更多声线参考百度语音合成文档

### 4. 系统提示词配置

```python
SYSTEM_PROMPT = """你是一位温暖、专业的情感陪护助手。你的名字叫"小暖"。
..."""
```

可以修改提示词来改变数字人的性格和说话风格。

## 环境变量配置（可选）

也可以在系统环境变量中配置 API Key：

```bash
# Windows PowerShell
$env:SILICONFLOW_API_KEY="your-api-key"
$env:BAIDU_ASR_API_KEY="your-asr-api-key"
$env:BAIDU_ASR_SECRET_KEY="your-asr-secret-key"
$env:BAIDU_TTS_APP_ID="your-tts-app-id"
$env:BAIDU_TTS_API_KEY="your-tts-api-key"
$env:BAIDU_TTS_SECRET_KEY="your-tts-secret-key"
```

## 启动系统

```bash
conda activate nerfstream
cd "D:\数字人3\LiveTalking-main"
python app.py --transport webrtc --model wav2lip --avatar_id wav2lip256_avatar1
```

## 访问页面

- 基础版：`http://localhost:8010/webrtcapi.html`
- **陪护系统**：`http://localhost:8010/companion.html` ⭐
- 集成前端：`http://localhost:8010/dashboard.html`

## 使用流程

1. 打开 `http://localhost:8010/companion.html`
2. 点击 **"开始连接"** 启动数字人
3. 在对话框输入文字，或点击 🎤 语音输入
4. 数字人会用配置的声线播报 AI 回复

## 自定义声线

在 `companion_llm.py` 中修改 `BAIDU_TTS_VOICE`：

```python
# 女声
BAIDU_TTS_VOICE = "CAP_4194"  # 度嫣然

# 男声  
BAIDU_TTS_VOICE = "CAP_4195"  # 度小宇

# 童声
BAIDU_TTS_VOICE = "CAP_4197"  # 度小童
```

## 故障排查

### 1. API 调用失败
- 检查 API Key 是否正确
- 检查网络连接
- 查看控制台日志

### 2. 数字人不播报
- 检查是否点击了 "开始连接"
- 检查 TTS 配置是否正确
- 查看浏览器控制台

### 3. 语音识别失败
- 检查麦克风权限
- 检查百度 ASR 配置
- 尝试使用文字输入

## 后续扩展

可以添加的功能：
1. 更多情感表达（根据对话内容改变表情）
2. 长期记忆（记住用户信息和偏好）
3. 多语言支持
4. 自定义数字人形象

## 联系支持

如有问题，参考：
- LiveTalking 文档：https://livetalking-doc.readthedocs.io/
- SiliconFlow 文档：https://docs.siliconflow.cn/
- 百度 AI 文档：https://ai.baidu.com/docs
