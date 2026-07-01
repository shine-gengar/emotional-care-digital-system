# LivePortrait 视频生成指南

## 简介

由于本地没有 NVIDIA GPU，我们采用**预生成视频**的方案：
1. 使用在线服务生成 LivePortrait 视频
2. 将视频文件放入项目的 `/public/videos/` 目录
3. 在头像配置中引用视频 URL

---

## 方案一：使用在线 LivePortrait 服务（推荐）

### 1. 硅基流动 (SiliconFlow)
- 网址: https://siliconflow.cn
- 提供 LivePortrait API
- 需要注册获取 API Key

### 2. Replicate
- 网址: https://replicate.com
- 搜索 "liveportrait"
- 有多个开源模型可用

### 3. 其他平台
- **Hugging Face Spaces**: 搜索 liveportrait
- **ModelScope**: 阿里开源模型平台

---

## 方案二：使用替代工具生成视频

### 1. D-ID (最简单)
- 网址: https://studio.d-id.com
- 上传照片 + 输入文字/音频
- 自动生成说话视频
- 有免费额度

### 2. HeyGen
- 网址: https://www.heygen.com
- 效果更好的数字人平台
- 免费试用

### 3. 剪映 / CapCut
- 使用"数字人"功能
- 上传照片生成说话视频
- 完全免费

---

## 方案三：使用 Wav2Lip（轻量级）

如果以上都不行，可以使用 Wav2Lip：
- 对电脑要求较低
- CPU 也可以运行（较慢）
- GitHub: https://github.com/Rudrabha/Wav2Lip

---

## 视频文件准备

### 推荐规格
- **格式**: MP4 (H.264)
- **分辨率**: 512x512 或 1024x1024
- **时长**: 5-10 秒循环
- **文件大小**: < 5MB
- **背景**: 透明或纯色（方便融合）

### 文件存放位置
```
public/
├── avatars/
│   ├── xiaonuan.png      # 静态头像（后备）
│   └── xiaonan.png
└── videos/
    ├── xiaonuan-talking.mp4   # 说话状态视频
    ├── xiaonuan-idle.mp4      # 空闲状态视频
    ├── xiaonan-talking.mp4
    └── xiaonan-idle.mp4
```

---

## 配置使用

在 `src/stores/index.ts` 中配置：

```typescript
export const AVATAR_PRESETS: AvatarConfig[] = [
  {
    id: 'xiaonuan',
    name: '小暖',
    personality: '温柔体贴，善于倾听，像一位知心姐姐',
    avatarUrl: '/avatars/xiaonuan.png',
    videoUrl: '/videos/xiaonuan-talking.mp4',  // 添加视频路径
    voiceId: 'xiaonuan-voice',
  },
  // ...
];
```

---

## 快速开始步骤

### 最简单的方法（推荐新手）

1. **下载示例视频**
   - 从抖音/B站搜索"AI数字人"
   - 下载合适的无水印视频
   - 或使用剪映生成

2. **放入项目**
   ```bash
   # 在项目根目录执行
   mkdir -p public/videos
   # 把你的视频复制进去
   cp ~/Downloads/your-video.mp4 public/videos/xiaonuan-talking.mp4
   ```

3. **更新配置**
   - 编辑 `src/stores/index.ts`
   - 在对应头像配置中添加 `videoUrl`

4. **重启开发服务器**
   ```bash
   npm run dev
   ```

---

## 进阶：多状态视频

如果你想让数字人有不同状态（说话、聆听、空闲），可以准备多个视频：

```typescript
interface AvatarConfig {
  // ...
  videoUrl?: string;           // 默认视频
  videos?: {
    idle?: string;      // 空闲状态
    speaking?: string;  // 说话状态
    listening?: string; // 聆听状态
  };
}
```

然后修改组件根据状态切换视频源。

---

## 注意事项

1. **视频格式**: 确保浏览器支持（MP4 H.264 最兼容）
2. **自动播放**: 现代浏览器限制自动播放有声视频，我们的组件已处理（muted）
3. **性能**: 视频文件不要太大，建议压缩到 5MB 以内
4. **版权**: 使用生成的视频时注意平台使用条款

---

## 推荐工具总结

| 工具 | 难度 | 效果 | 费用 |
|------|------|------|------|
| D-ID | ⭐ 简单 | ⭐⭐⭐⭐ 很好 | 有免费额度 |
| HeyGen | ⭐ 简单 | ⭐⭐⭐⭐⭐ 最好 | 有免费额度 |
| 剪映 | ⭐ 简单 | ⭐⭐⭐ 一般 | 免费 |
| LivePortrait API | ⭐⭐⭐ 复杂 | ⭐⭐⭐⭐⭐ 最好 | 按量付费 |
| Wav2Lip | ⭐⭐⭐⭐ 复杂 | ⭐⭐⭐ 一般 | 免费 |

---

## 需要帮助？

如果遇到问题：
1. 检查视频格式是否正确
2. 查看浏览器控制台是否有错误
3. 确保视频文件路径正确
4. 尝试用静态头像模式调试
