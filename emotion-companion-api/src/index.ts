import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import { textToSpeech } from './routes/tts';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true,
}));
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.post('/api/tts', textToSpeech);

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  console.error('Error stack:', err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

// 未捕获的异常处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // 不退出进程，保持运行
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 不退出进程，保持运行
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📚 API文档:`);
  console.log(`   - POST /api/auth/register    注册`);
  console.log(`   - POST /api/auth/login       登录`);
  console.log(`   - POST /api/chat/message     发送消息`);
  console.log(`   - GET  /api/chat/history     获取历史`);
});
