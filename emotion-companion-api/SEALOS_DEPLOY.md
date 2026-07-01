# 情感陪护数字人 - Sealos 部署配置

## 1. 在 Sealos 创建项目

1. 登录 [Sealos](https://cloud.sealos.io)
2. 点击 "新建应用"
3. 选择 "从 Git 仓库构建"

## 2. 环境变量配置

在 Sealos 控制台设置以下环境变量：

```
# 必需
DATABASE_URL=postgresql://...
JWT_SECRET=your-super-secret-key
DOUBAO_API_KEY=your-doubao-api-key
DOUBAO_API_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL_ID=your-model-id

# 可选
NODE_ENV=production
PORT=3001
```

## 3. 数据库配置

在 Sealos 创建 PostgreSQL 数据库：
1. 进入 "数据库" 页面
2. 点击 "新建数据库"
3. 选择 PostgreSQL
4. 记录连接字符串，填入 DATABASE_URL

## 4. 前端配置

修改前端项目的环境变量：

```env
# .env.local
NEXT_PUBLIC_API_URL=https://your-api-domain.sealos.run
```

## 5. 部署后执行数据库迁移

在 Sealos 终端执行：
```bash
npx prisma migrate deploy
```

## API 端点

部署后可通过以下地址访问：
- API 基础地址: `https://your-app.sealos.run`
- 健康检查: `GET /health`
- 注册: `POST /api/auth/register`
- 登录: `POST /api/auth/login`
- 聊天: `POST /api/chat/message`
- 历史: `GET /api/chat/history`
