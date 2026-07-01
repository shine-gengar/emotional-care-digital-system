# 部署检查清单

## ✅ 已完成
- [x] 后端代码开发完成
- [x] SiliconFlow API 配置完成
- [x] GitHub 仓库创建: https://github.com/zhiy-yang/emotion-companion-api

## 🔄 待完成（需要你操作）

### 1. 上传代码到 GitHub
在 PowerShell 中执行：
```powershell
cd C:\Users\zhiy\emotion-companion-api

# 初始化 git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 关联远程仓库
git remote add origin https://github.com/zhiy-yang/emotion-companion-api.git

# 推送
git branch -M main
git push -u origin main
```

### 2. 在 Sealos 创建数据库
1. 访问 https://cloud.sealos.io
2. 数据库 → 新建数据库 → PostgreSQL
3. 配置：
   - 名称: `emotion-db`
   - 用户名: `postgres`
   - 密码: `你的密码`
   - 数据库名: `emotion_companion`
4. 复制连接字符串（格式如下）：
   ```
   postgresql://postgres:你的密码@db-xxx.sealos.run:5432/emotion_companion
   ```

### 3. 在 Sealos 部署后端
1. 应用 → 新建应用 → 从 Git 仓库构建
2. 配置：
   - Git 仓库: `https://github.com/zhiy-yang/emotion-companion-api`
   - 分支: `main`
   - 端口: `3001`
3. 环境变量：
   ```
   PORT=3001
   NODE_ENV=production
   DATABASE_URL=postgresql://postgres:你的密码@db-xxx.sealos.run:5432/emotion_companion
   JWT_SECRET=任意随机字符串（如：Emotion2024Companion）
   SILICONFLOW_API_KEY=sk-your-siliconflow-api-key-here
   ```
4. 点击部署

### 4. 数据库迁移
部署完成后，在 Sealos 终端执行：
```bash
npx prisma migrate deploy
```

### 5. 测试 API
访问：`https://你的应用域名.sealos.run/health`
应该返回：`{"status":"ok"}`

## 📋 部署后配置前端

前端 `.env.local` 文件：
```
NEXT_PUBLIC_API_URL=https://你的后端域名.sealos.run
```

## ❓ 遇到问题？

1. **Git 推送失败** → 检查是否登录 GitHub
2. **数据库连接失败** → 检查连接字符串是否正确
3. **部署失败** → 查看 Sealos 日志
4. **API 无响应** → 检查环境变量是否配置正确

需要帮助随时问我！
