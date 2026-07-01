# 百度数字人 H5 组件 - 快速开始

## 已配置信息

| 配置项 | 值 |
|--------|-----|
| App Key | `uan6s8qt38wyqhe3vbs3` |
| App ID | `i-scsvsn9k78xxc` |
| Figure ID | `A2A_V2-fig-rgzp9b9gaybvqcy4` (馨月-半身交互) |
| TTS 音色 | `CAP_4196` (度清影) |

## 只需一步：配置 Secret Key

### 1. 获取 Secret Key
- 在百度智能云控制台 → 应用详情
- 找到 **App Secret** 或 **Secret Key**

### 2. 创建环境变量文件
```bash
cd C:\Users\zhiy\emotion-companion-web
copy .env.example .env.local
```

### 3. 编辑 `.env.local`
```env
BAIDU_SECRET_KEY=你的_secret_key
```

### 4. 运行项目
```bash
npm run dev
```

访问 http://localhost:3001/chat 即可看到数字人！

---

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   └── baidu-token/     # Token 获取 API
│   │       └── route.ts
│   └── chat/
│       └── page.tsx          # 聊天页面（已集成数字人）
└── components/avatar/
    └── BaiduDigitalHumanIframe.tsx  # 数字人组件
```

---

## 数字人功能

- ✅ 文字对话输入
- ✅ 语音输入（麦克风）
- ✅ 数字人实时口型同步
- ✅ 自动语音回复

---

## 注意事项

1. **Secret Key 不要泄露** - 只在 `.env.local` 中配置，不要提交到 Git
2. **首次加载需要几秒** - 数字人组件需要初始化
3. **需要麦克风权限** - 使用语音输入时需要授权

---

## 故障排查

### 数字人显示空白
- 检查 Secret Key 是否正确
- 查看浏览器控制台错误信息
- 确认网络连接正常

### Token 获取失败
- 检查 `.env.local` 文件是否存在
- 确认 `BAIDU_SECRET_KEY` 格式正确
- 查看后端日志

### 麦克风无法使用
- 检查浏览器麦克风权限设置
- 确保使用 HTTPS 或 localhost
