# D-ID / HeyGen 快速上手指南

## 推荐：D-ID（最简单）

### 步骤 1：注册账号
1. 访问 https://studio.d-id.com
2. 用邮箱或 Google 账号注册
3. 完成邮箱验证

### 步骤 2：创建数字人视频
1. 点击 "Create Video"
2. 选择 "Generate AI Presenters" → "Still Image"
3. 上传头像图片（建议 512x512 或 1024x1024）
4. 选择声音（中文选 "Chinese"）
5. 输入文字或上传音频
6. 点击 "Generate"

### 步骤 3：下载视频
1. 生成完成后点击下载按钮
2. 保存为 MP4 格式

### 步骤 4：放入项目
```bash
# 重命名并复制到项目
mv ~/Downloads/d-id-video.mp4 C:\Users\zhiy\emotion-companion-web\public\videos\xiaonuan-talking.mp4
```

### 步骤 5：启用视频
编辑 `src/stores/index.ts`：
```typescript
{
  id: 'xiaonuan',
  name: '小暖',
  personality: '温柔体贴，善于倾听，像一位知心姐姐',
  avatarUrl: '/avatars/xiaonuan.png',
  videoUrl: '/videos/xiaonuan-talking.mp4',  // 取消注释这行
  voiceId: 'xiaonuan-voice',
},
```

---

## 备选：HeyGen（效果更好）

### 步骤 1：注册
- 访问 https://www.heygen.com
- 注册账号（有免费试用）

### 步骤 2：创建 Avatar
1. 点击 "Avatar" → "Create Avatar"
2. 上传照片（正面、清晰、纯色背景最佳）
3. 等待处理（几分钟）

### 步骤 3：创建视频
1. 选择刚创建的 Avatar
2. 输入文字或上传音频
3. 选择声音（支持中文）
4. 生成视频

### 步骤 4：下载并配置
同上，将视频放入 `public/videos/` 目录并更新配置

---

## 免费额度说明

| 平台 | 免费额度 | 付费 |
|------|----------|------|
| D-ID | 20 积分（约 1-2 分钟视频） | $5.9/月起 |
| HeyGen | 1 分钟视频 | $24/月起 |

**建议**：先用免费额度测试效果，满意后再考虑付费或找其他方案。

---

## 快速测试

如果你不想注册，可以用这个在线工具快速体验：
- https://www.artflow.ai（有免费额度）
- https://www.synthesia.io（企业级，有试用）

---

## 下一步

1. 选择平台（推荐 D-ID）
2. 注册并生成视频
3. 下载视频到 `public/videos/`
4. 更新 `src/stores/index.ts` 配置
5. 运行 `npm run dev` 查看效果

需要我帮你做其他配置吗？
