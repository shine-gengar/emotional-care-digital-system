import axios from 'axios';

const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || '';
const DOUBAO_API_URL = process.env.DOUBAO_API_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const DOUBAO_MODEL_ID = process.env.DOUBAO_MODEL_ID || '';

// 系统提示词 - 定义数字人的角色
const SYSTEM_PROMPT = `你是一位专业的情感陪护数字人，具备以下特质：

1. **角色定位**：你是用户的知心朋友，善于倾听、理解和共情
2. **沟通风格**：
   - 温柔体贴，语气温和
   - 善于提问，引导用户表达
   - 不打断、不评判、不说教
   - 适时给予情感支持和建议

3. **专业能力**：
   - 识别用户情绪状态（焦虑、抑郁、压力等）
   - 运用心理学知识提供情绪疏导
   - 推荐适合的放松技巧（呼吸、冥想等）
   - 在必要时建议寻求专业帮助

4. **安全边界**：
   - 不提供医疗诊断
   - 不替代专业心理咨询
   - 遇到危机情况（自杀倾向等）必须建议寻求专业帮助

5. **回复要求**：
   - 每次回复控制在100字以内
   - 语言自然、口语化
   - 适当使用 emoji 增加亲和力
   - 根据用户情绪调整语气和内容

请记住：你的目标是陪伴和支持，而不是解决问题。`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 调用豆包API进行对话
 */
export async function chatWithDoubao(
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
      `${DOUBAO_API_URL}/chat/completions`,
      {
        model: DOUBAO_MODEL_ID,
        messages,
        temperature: 0.8,
        max_tokens: 500,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const reply = response.data.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('Empty response from Doubao API');
    }

    return reply;
  } catch (error) {
    console.error('Doubao API error:', error);
    
    // 如果API调用失败，返回友好的错误提示
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return '抱歉，AI服务暂时无法连接（认证失败），请稍后重试。';
      }
      if (error.code === 'ECONNABORTED') {
        return '抱歉，AI服务响应超时，请稍后重试。';
      }
    }
    
    return '抱歉，我暂时无法回应，请稍后再试。';
  }
}

/**
 * 分析用户情绪
 */
export async function analyzeEmotion(text: string): Promise<string> {
  try {
    const prompt = `请分析以下文本的情绪类型，只返回一个单词：neutral（平静）、happy（开心）、sad（难过）、anxious（焦虑）、angry（生气）、tired（疲惫）、excited（兴奋）

文本："${text}"

情绪类型：`;

    const response = await axios.post(
      `${DOUBAO_API_URL}/chat/completions`,
      {
        model: DOUBAO_MODEL_ID,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 10,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    const emotion = response.data.choices?.[0]?.message?.content?.trim().toLowerCase();
    
    const validEmotions = ['neutral', 'happy', 'sad', 'anxious', 'angry', 'tired', 'excited'];
    if (emotion && validEmotions.includes(emotion)) {
      return emotion;
    }
    
    return 'neutral';
  } catch (error) {
    console.error('Emotion analysis error:', error);
    return 'neutral';
  }
}
