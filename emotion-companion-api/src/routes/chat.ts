import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { chatWithAI, analyzeEmotion } from '../utils/siliconflow';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * 发送消息并获取AI回复
 * POST /api/chat/message
 * 需要认证
 */
router.post('/message', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { content, sessionId } = req.body;
    const userId = req.user!.id;

    if (!content) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    // 并行执行：分析用户情绪 和 获取或创建会话（不等待AI）
    const emotionPromise = analyzeEmotion(content);

    // 获取或创建会话
    let session;
    if (sessionId && typeof sessionId === 'string' && sessionId.trim() !== '') {
      session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (session) {
        console.log('使用现有会话:', sessionId);
      } else {
        console.log('会话ID无效，将创建新会话:', sessionId);
      }
    }

    if (!session) {
      // 检查用户最近是否有活跃的会话（5分钟内），避免重复创建
      const recentSession = await prisma.chatSession.findFirst({
        where: { 
          userId,
          updatedAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // 5分钟内
          }
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (recentSession) {
        console.log('复用最近的会话:', recentSession.id);
        session = recentSession;
      } else {
        // 创建新会话，使用消息前20字作为标题
        const title = content.length > 20 ? content.substring(0, 20) + '...' : content;
        session = await prisma.chatSession.create({
          data: {
            userId,
            title,
          },
        });
        console.log('创建新会话:', session.id);
      }
    }

    // 等待情绪分析完成
    const userEmotion = await emotionPromise;

    // 保存用户消息
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content,
        emotion: userEmotion,
      },
    });

    // 获取历史消息（最近5条，减少token消耗提高速度）
    const historyMessages = await prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const history = historyMessages
      .reverse()
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // 调用 SiliconFlow API 获取回复
    console.log('开始调用 AI，用户消息:', content.substring(0, 50));
    let aiReply: string;
    try {
      aiReply = await chatWithAI(content, history);
      console.log('AI 回复:', aiReply.substring(0, 100));
    } catch (aiError: any) {
      console.error('AI 调用失败:', aiError.message);
      // AI 超时或失败时，使用备用回复而不是返回错误
      aiReply = '抱歉，我思考得有点慢。不过我在这里陪着你，你想聊点什么？';
    }
    
    // 截断过长的回复（数据库字段限制）
    const MAX_CONTENT_LENGTH = 4000;
    if (aiReply.length > MAX_CONTENT_LENGTH) {
      aiReply = aiReply.substring(0, MAX_CONTENT_LENGTH) + '...';
    }

    // 分析AI情绪
    const aiEmotion = await analyzeEmotion(aiReply);

    // 保存AI回复
    const aiMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: aiReply,
        emotion: aiEmotion,
      },
    });

    // 更新会话的 updatedAt，确保历史记录排序正确
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    res.json({
      message: {
        id: aiMessage.id,
        role: 'assistant',
        content: aiReply,
        emotion: aiEmotion,
        createdAt: aiMessage.createdAt,
      },
      sessionId: session.id,
      userEmotion,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: '处理消息失败，请稍后重试' });
  }
});

/**
 * 获取用户的聊天历史
 * GET /api/chat/history
 * 需要认证
 */
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: Number(limit),
    });

    const total = await prisma.chatSession.count({
      where: { userId },
    });

    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session._count.messages,
      lastMessage: session.messages[0] || null,
    }));

    res.json({
      sessions: formattedSessions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

/**
 * 获取单个会话的详细消息
 * GET /api/chat/session/:id
 * 需要认证
 */
router.get('/session/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const session = await prisma.chatSession.findFirst({
      where: { id: id as string, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    res.json({
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        messages: session.messages,
      },
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: '获取会话详情失败' });
  }
});

/**
 * 删除会话
 * DELETE /api/chat/session/:id
 * 需要认证
 */
router.delete('/session/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查会话是否存在且属于当前用户
    const session = await prisma.chatSession.findFirst({
      where: { id: id as string, userId },
    });

    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 删除会话（级联删除消息）
    await prisma.chatSession.delete({
      where: { id: id as string },
    });

    res.json({ message: '会话已删除' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: '删除会话失败' });
  }
});

export default router;
