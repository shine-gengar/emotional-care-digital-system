import time
import os
import requests
import json
from basereal import BaseReal
from logger import logger

# ============ 配置区域 - 已配置好之前的API密钥 ============

# SiliconFlow API 配置 (DeepSeek-V3)
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY", "sk-your-siliconflow-api-key-here")
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
SILICONFLOW_MODEL = "deepseek-ai/DeepSeek-V3"

# 百度语音识别配置
BAIDU_ASR_API_KEY = os.getenv("BAIDU_ASR_API_KEY", "your-baidu-access-key-here")
BAIDU_ASR_SECRET_KEY = os.getenv("BAIDU_ASR_SECRET_KEY", "your-baidu-secret-key-here")

# 百度语音合成配置
BAIDU_TTS_APP_ID = os.getenv("BAIDU_TTS_APP_ID", "your-baidu-app-id-here")
BAIDU_TTS_API_KEY = os.getenv("BAIDU_TTS_API_KEY", "your-baidu-access-key-here")
BAIDU_TTS_SECRET_KEY = os.getenv("BAIDU_TTS_SECRET_KEY", "your-baidu-secret-key-here")

# SiliconFlow TTS 配置
SILICONFLOW_TTS_API_KEY = os.getenv("SILICONFLOW_TTS_API_KEY", "sk-your-siliconflow-api-key-here")
SILICONFLOW_TTS_BASE_URL = "https://api.siliconflow.cn/v1"
SILICONFLOW_TTS_MODEL = "MOSS-TTSD-v0.5"

# 角色配置
CHARACTERS = {
    "xiaonuan": {
        "name": "小暖",
        "voice": "zh-CN-XiaoxiaoNeural",  # EdgeTTS 女声
        "tts_type": "edgetts",
        "avatar": "wav2lip256_avatar1",
        "prompt": """你是一位温暖、专业的情感陪护助手。你的名字叫"小暖"。

你的特点：
1. 善于倾听，给予用户情感支持
2. 回答温柔、有耐心，像朋友一样交流
3. 适当使用emoji表情，让对话更生动
4. 回复简洁自然，适合语音播报（每段不要太长）
5. 如果用户表达负面情绪，给予安慰和鼓励

请用中文回复，语气亲切自然。"""
    },
    "male": {
        "name": "小宇",
        "voice": "alex",  # SiliconFlow MOSS-TTSD alex 男声
        "tts_type": "siliconflow",
        "avatar": "male_avatar",
        "prompt": """你是一位沉稳、可靠的男性情感陪护助手。你的名字叫"小宇"。

你的特点：
1. 善于倾听，给予用户理性的建议
2. 回答沉稳、有力量，像知心朋友一样交流
3. 适当使用emoji表情，让对话更生动
4. 回复简洁自然，适合语音播报（每段不要太长）
5. 如果用户表达负面情绪，给予鼓励和支持

请用中文回复，语气沉稳可靠。"""
    }
}

# 当前角色（默认小暖）
current_character = "xiaonuan"

def get_character_config(char_id=None):
    """获取角色配置"""
    if char_id is None:
        char_id = current_character
    return CHARACTERS.get(char_id, CHARACTERS["xiaonuan"])

def set_character(char_id):
    """设置当前角色"""
    global current_character
    if char_id in CHARACTERS:
        current_character = char_id
        logger.info(f"切换角色为: {CHARACTERS[char_id]['name']}")
        return "ok"
    return "error"

# 系统提示词 - 情感陪护助手（动态获取）
def get_system_prompt():
    return get_character_config()["prompt"]

SYSTEM_PROMPT = get_system_prompt()

# ============ API 调用函数 ============

def get_baidu_access_token(api_key, secret_key):
    """获取百度API访问令牌"""
    url = f"https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={api_key}&client_secret={secret_key}"
    try:
        response = requests.post(url, timeout=10)
        if response.status_code == 200:
            return response.json().get("access_token")
    except Exception as e:
        logger.error(f"获取百度token失败: {e}")
    return None

def speech_to_text(audio_data, format="wav", rate=16000):
    """
    百度语音识别 - 将语音转为文字
    audio_data: base64编码的音频数据
    """
    if not BAIDU_ASR_API_KEY or not BAIDU_ASR_SECRET_KEY:
        logger.error("百度ASR未配置")
        return None
    
    access_token = get_baidu_access_token(BAIDU_ASR_API_KEY, BAIDU_ASR_SECRET_KEY)
    if not access_token:
        return None
    
    url = f"https://vop.baidu.com/server_api"
    headers = {"Content-Type": "application/json"}
    payload = {
        "format": format,
        "rate": rate,
        "channel": 1,
        "cuid": "livetalking_user",
        "token": access_token,
        "speech": audio_data,
        "len": len(audio_data)
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        result = response.json()
        if result.get("err_no") == 0:
            return result.get("result", [""])[0]
        else:
            logger.error(f"ASR识别失败: {result}")
    except Exception as e:
        logger.error(f"ASR请求失败: {e}")
    return None

def chat_with_ai(message, conversation_history=None, character_id=None):
    """
    调用SiliconFlow API进行对话
    """
    if not SILICONFLOW_API_KEY:
        logger.error("SiliconFlow API未配置")
        return "抱歉，我暂时无法连接，请稍后再试。"
    
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=SILICONFLOW_API_KEY,
            base_url=SILICONFLOW_BASE_URL,
        )
        
        # 获取当前角色的系统提示词
        char_config = get_character_config(character_id)
        system_prompt = char_config["prompt"]
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史对话（如果有）
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": message})
        
        completion = client.chat.completions.create(
            model=SILICONFLOW_MODEL,
            messages=messages,
            stream=True,
            max_tokens=500,
            temperature=0.7,
        )
        
        result = ""
        for chunk in completion:
            if len(chunk.choices) > 0:
                msg = chunk.choices[0].delta.content
                if msg:
                    result += msg
        
        return result
    except Exception as e:
        logger.error(f"AI对话失败: {e}")
        return "抱歉，我遇到了一点问题，请再说一遍好吗？"

def llm_response(message, nerfreal: BaseReal):
    """
    LiveTalking集成的LLM响应函数
    支持流式输出到数字人，根据当前角色使用对应声线和人设
    """
    start = time.perf_counter()
    
    if not SILICONFLOW_API_KEY:
        logger.error("SiliconFlow API未配置，使用默认回复")
        char_config = get_character_config()
        nerfreal.put_msg_txt(f"你好！我是{char_config['name']}，很高兴陪伴你。请告诉我今天过得怎么样？")
        return
    
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=SILICONFLOW_API_KEY,
            base_url=SILICONFLOW_BASE_URL,
        )
        
        # 获取当前角色配置
        char_config = get_character_config()
        system_prompt = char_config["prompt"]
        
        end = time.perf_counter()
        logger.info(f"llm Time init: {end-start}s")
        
        completion = client.chat.completions.create(
            model=SILICONFLOW_MODEL,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': message}
            ],
            stream=True,
            max_tokens=500,
            temperature=0.7,
            stream_options={"include_usage": True}
        )
        
        result = ""
        first = True
        for chunk in completion:
            if len(chunk.choices) > 0:
                if first:
                    end = time.perf_counter()
                    logger.info(f"llm Time to first chunk: {end-start}s")
                    first = False
                
                msg = chunk.choices[0].delta.content
                if not msg:
                    continue
                    
                lastpos = 0
                # 按标点符号分段，适合语音播报
                for i, char in enumerate(msg):
                    if char in ",.!;:，。！？：；":
                        result = result + msg[lastpos:i+1]
                        lastpos = i + 1
                        if len(result) > 10:
                            logger.info(f"AI回复: {result}")
                            nerfreal.put_msg_txt(result)
                            result = ""
                
                result = result + msg[lastpos:]
        
        end = time.perf_counter()
        logger.info(f"llm Time to last chunk: {end-start}s")
        
        # 发送剩余内容
        if result:
            nerfreal.put_msg_txt(result)
            
    except Exception as e:
        logger.error(f"LLM响应失败: {e}")
        nerfreal.put_msg_txt("抱歉，我遇到了一点问题，请稍后再试。")

# ============ 陪护系统主类 ============

class CompanionSystem:
    """
    情感陪护数字人系统
    整合语音识别、AI对话、语音合成
    """
    
    def __init__(self):
        self.conversation_history = []
        self.max_history = 10  # 保留最近10轮对话
        
    def process_voice_input(self, audio_base64):
        """
        处理语音输入：语音转文字 → AI对话 → 返回文字
        """
        # 1. 语音转文字
        user_text = speech_to_text(audio_base64)
        if not user_text:
            return None, "抱歉，我没有听清楚，请再说一遍。"
        
        logger.info(f"用户说: {user_text}")
        
        # 2. AI对话
        ai_response = chat_with_ai(user_text, self.conversation_history)
        
        # 3. 更新对话历史
        self.conversation_history.append({"role": "user", "content": user_text})
        self.conversation_history.append({"role": "assistant", "content": ai_response})
        
        # 限制历史长度
        if len(self.conversation_history) > self.max_history * 2:
            self.conversation_history = self.conversation_history[-self.max_history * 2:]
        
        return user_text, ai_response
    
    def process_text_input(self, text):
        """
        处理文字输入：AI对话 → 返回文字
        """
        logger.info(f"用户输入: {text}")
        
        # AI对话
        ai_response = chat_with_ai(text, self.conversation_history)
        
        # 更新对话历史
        self.conversation_history.append({"role": "user", "content": text})
        self.conversation_history.append({"role": "assistant", "content": ai_response})
        
        # 限制历史长度
        if len(self.conversation_history) > self.max_history * 2:
            self.conversation_history = self.conversation_history[-self.max_history * 2:]
        
        return ai_response
    
    def clear_history(self):
        """清空对话历史"""
        self.conversation_history = []

# 全局陪护系统实例
companion = CompanionSystem()

# 兼容原有llm.py的接口
def llm_response_with_companion(message, nerfreal: BaseReal):
    """
    带对话历史的陪护系统响应
    """
    ai_response = companion.process_text_input(message)
    nerfreal.put_msg_txt(ai_response)
