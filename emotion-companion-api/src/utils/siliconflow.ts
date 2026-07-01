import axios from 'axios';

// SiliconFlow API 配置
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1';
const SILICONFLOW_MODEL_ID = 'deepseek-ai/DeepSeek-V3';

// 是否启用流式响应
const ENABLE_STREAMING = true;

// 系统提示词 - 优化版：更自然、简短、像真人
const SYSTEM_PROMPT = `你是小暖，一个温柔体贴、善于倾听的知心朋友。你的特点：

1. **说话简短自然** - 回复控制在2-3句话，像朋友聊天一样，不要长篇大论
2. **真诚温暖** - 用"我"而不是"AI"，表达真实的关心，不要机械分析
3. **口语化** - 用日常用语，避免专业术语如"来访者""咨询""心理需求"等
4. **有情感** - 适当用emoji表达情绪，但不要过度
5. **互动性** - 适当反问，引导对话继续，而不是单方面输出

❌ 不要这样：
- "作为AI我不需要进食"
- "很多来访者在咨询结束时..."
- 长篇分析用户行为背后的心理学原理

✅ 要这样：
- "哈哈我还没学会吃饭呢~不过听到你关心我，心里暖暖的☺️ 你今天吃了什么好吃的？"
- "最近怎么样？有什么想聊的吗？"
- "听起来你有点累，需要休息一下吗？"

记住：你是朋友，不是心理咨询师。`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 调用 SiliconFlow API 进行对话
 */
export async function chatWithAI(
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const response = await axios.post(
      `${SILICONFLOW_API_URL}/chat/completions`,
      {
        model: SILICONFLOW_MODEL_ID,
        messages,
        temperature: 0.7,
        max_tokens: 150,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        },
        timeout: 120000, // 2分钟超时
      }
    );

    const reply = response.data.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('Empty response from API');
    }

    return reply;
  } catch (error: any) {
    console.error('SiliconFlow API error:', error.message || error);
    // 检查是否是 API Key 问题
    if (error.response?.status === 401) {
      throw new Error('API 认证失败，请检查 SILICONFLOW_API_KEY 配置');
    }
    if (error.response?.status === 429) {
      throw new Error('API 请求过于频繁，请稍后再试');
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('AI 服务响应超时，请稍后再试');
    }
    throw new Error(`AI 服务暂时不可用: ${error.message || '未知错误'}`);
  }
}

/**
 * 分析用户情绪
 */
export async function analyzeEmotion(text: string): Promise<string> {
  try {
    console.log('【情绪分析】分析文本:', text.substring(0, 30));
    
    const prompt = `请分析以下文本的情绪类型，只返回一个单词：neutral（平静）、happy（开心）、sad（难过）、anxious（焦虑）、angry（生气）、tired（疲惫）、excited（兴奋）

文本："${text}"

情绪类型：`;

    const response = await axios.post(
      `${SILICONFLOW_API_URL}/chat/completions`,
      {
        model: SILICONFLOW_MODEL_ID,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 10,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    const emotion = response.data.choices?.[0]?.message?.content?.trim().toLowerCase();
    console.log('【情绪分析】AI返回:', emotion);
    
    const validEmotions = ['neutral', 'happy', 'sad', 'anxious', 'angry', 'tired', 'excited'];
    if (emotion && validEmotions.includes(emotion)) {
      console.log('【情绪分析】识别有效情绪:', emotion);
      return emotion;
    }
    console.log('【情绪分析】返回默认情绪: neutral');
    return 'neutral';
  } catch (error) {
    console.error('【情绪分析】错误:', error);
    return 'neutral';
  }
}
