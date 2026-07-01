# 情感陪护数字人后端API

## 技术栈
- **框架**: Express.js + TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **AI服务**: SiliconFlow (Qwen2.5-7B)
- **认证**: JWT
- **部署**: Docker + Sealos

## 环境变量配置

创建 `.env` 文件：

```env
# 服务器配置
PORT=3001
NODE_ENV=production

# 数据库配置（Sealos提供）
DATABASE_URL="postgresql://..."

# JWT密钥
JWT_SECRET="your-secret-key"

# SiliconFlow API配置
SILICONFLOW_API_KEY="sk-..."
```

## API端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录

### 聊天
- `POST /api/chat/message` - 发送消息（AI回复）
- `GET /api/chat/history` - 获取历史会话
- `GET /api/chat/session/:id` - 获取会话详情

### 健康检查
- `GET /health` - 服务状态

## 本地开发

```bash
# 安装依赖
npm install

# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

## 部署到Sealos

1. 在Sealos创建PostgreSQL数据库
2. 创建应用，上传代码或关联Git仓库
3. 配置环境变量
4. 部署并访问

## AI模型

使用 **SiliconFlow** 的 `Qwen/Qwen2.5-7B-Instruct` 模型：
- 价格: ¥0.5/百万token
- 免费额度: 2000万token
- 特点: 中文优秀、速度快、价格便宜
