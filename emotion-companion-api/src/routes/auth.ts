import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { generateToken } from '../middleware/auth';

const router = Router();

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为6位' });
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        nickname: nickname || username,
        settings: {
          create: {
            theme: 'light',
            notifications: true,
          },
        },
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        createdAt: true,
      },
    });

    // 生成JWT令牌
    const token = generateToken(user.id, user.username);

    res.status(201).json({
      message: '注册成功',
      user,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('登录请求:', { username, hasPassword: !!password });

    // 验证输入
    if (!username || !password) {
      console.log('登录失败: 用户名或密码为空');
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        settings: true,
      },
    });

    if (!user) {
      console.log('登录失败: 用户不存在', username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log('登录失败: 密码错误', username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    console.log('登录成功:', username);

    // 生成JWT令牌
    const token = generateToken(user.id, user.username);

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        settings: user.settings,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

export default router;
