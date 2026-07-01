# 百度智能云数字人 API 配置

## 环境变量

在 `.env.local` 文件中添加以下配置：

```env
# 百度智能云数字人 API 配置
NEXT_PUBLIC_BAIDU_APP_ID=your_app_id_here
NEXT_PUBLIC_BAIDU_API_KEY=your_api_key_here
NEXT_PUBLIC_BAIDU_SECRET_KEY=your_secret_key_here

# 数字人形象 ID（在百度控制台创建）
NEXT_PUBLIC_BAIDU_FIGURE_ID=your_figure_id_here
```

## 获取方式

### 1. App ID
- 登录百度智能云控制台
- 进入 "数字员工" 产品
- 在应用管理中找到 App ID

### 2. API Key / Secret Key
- 在控制台 "安全认证" 页面
- 或应用详情页查看

### 3. Figure ID（数字人形象 ID）
- 在 "形象管理" 中创建或选择数字人
- 复制形象 ID

## 使用方式

### 方式一：使用 BaiduDigitalAvatar 组件（推荐）

```tsx
import { BaiduDigitalAvatar } from '@/components/avatar/BaiduDigitalAvatar';

function ChatPage() {
  return (
    <BaiduDigitalAvatar
      figureId={process.env.NEXT_PUBLIC_BAIDU_FIGURE_ID!}
      text={aiResponseText}  // AI 回复的文本
      isSpeaking={isSpeaking}
      isListening={isListening}
      emotion={currentEmotion}
      name="小暖"
      onVideoGenerated={(url) => console.log('视频生成:', url)}
      onError={(err) => console.error('生成失败:', err)}
    />
  );
}
```

### 方式二：使用 Hook 自定义

```tsx
import { useBaiduDigitalHuman, initBaiduDigitalHuman } from '@/hooks/useBaiduDigitalHuman';

// 初始化（在应用入口做一次）
initBaiduDigitalHuman({
  appId: process.env.NEXT_PUBLIC_BAIDU_APP_ID!,
  apiKey: process.env.NEXT_PUBLIC_BAIDU_API_KEY!,
  secretKey: process.env.NEXT_PUBLIC_BAIDU_SECRET_KEY!,
});

// 在组件中使用
function MyComponent() {
  const { isGenerating, videoUrl, generateVideo } = useBaiduDigitalHuman({
    figureId: process.env.NEXT_PUBLIC_BAIDU_FIGURE_ID!,
  });

  const handleGenerate = async () => {
    const url = await generateVideo('你好，我是你的数字人助手');
    // 使用生成的视频 URL
  };
}
```

## 注意事项

1. **服务端渲染**：由于涉及 API Key，建议在客户端组件中使用（'use client'）
2. **Token 有效期**：Access Token 有效期为 30 天，代码中已自动处理刷新
3. **视频生成时间**：通常需要 5-30 秒，请做好 loading 状态
4. **并发限制**：注意百度 API 的 QPS 限制

## 故障排查

### 401 错误（认证失败）
- 检查 API Key 和 Secret Key 是否正确
- 检查 App ID 是否匹配

### 404 错误（形象不存在）
- 检查 Figure ID 是否正确
- 确认形象是否已发布

### 视频生成失败
- 检查文本内容是否合规
- 检查账户余额是否充足
