#!/bin/bash
# 一键部署脚本 - 在 emotion-companion-api 目录下运行

echo "🚀 开始部署到 Sealos..."

# 1. 检查是否在正确目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在 emotion-companion-api 目录下运行此脚本"
    exit 1
fi

# 2. 初始化 git（如果没有）
if [ ! -d ".git" ]; then
    echo "📦 初始化 Git 仓库..."
    git init
    git add .
    git commit -m "Initial commit"
fi

# 3. 提示用户输入信息
echo ""
echo "请提供以下信息："
read -p "GitHub 用户名: " GITHUB_USER
read -p "Sealos 数据库连接字符串: " DB_URL
read -s -p "JWT 密钥（随便输入一串字符）: " JWT_SECRET
echo ""

# 4. 关联远程仓库并推送
echo "📤 推送到 GitHub..."
git remote remove origin 2>/dev/null
git remote add origin "https://github.com/$GITHUB_USER/emotion-companion-api.git"
git branch -M main
git push -u origin main

echo ""
echo "✅ 代码已推送到 GitHub"
echo ""
echo "📝 请在 Sealos 控制台完成以下操作："
echo ""
echo "1. 创建应用 → 从 Git 仓库构建"
echo "   仓库地址: https://github.com/$GITHUB_USER/emotion-companion-api"
echo "   分支: main"
echo "   端口: 3001"
echo ""
echo "2. 配置环境变量："
echo "   PORT=3001"
echo "   NODE_ENV=production"
echo "   DATABASE_URL=$DB_URL"
echo "   JWT_SECRET=$JWT_SECRET"
echo "   SILICONFLOW_API_KEY=sk-your-siliconflow-api-key-here"
echo ""
echo "3. 部署完成后，在终端执行："
echo "   npx prisma migrate deploy"
echo ""
echo "🎉 完成！"
