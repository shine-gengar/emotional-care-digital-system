# 百度智能云数字人 H5 组件集成文档

## 概述

百度智能云数字人提供 **H5 组件** 方式，通过 iframe 嵌入即可使用，无需复杂的 API 调用。

## 组件参数说明

### CUSTOME_PARAMS 配置项

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `token` | string | ✅ | 访问令牌，需从后端获取 |
| `figureId` | string | ✅ | 数字人形象 ID，如 `A2A_V2-xixi` |
| `ttsPer` | string | ✅ | TTS 音色 ID，如 `LMV_10578` |
| `cp-ttsSample` | string | 可选 | 音频采样率，默认 `24000` |
| `initMode` | string | 可选 | 初始化模式，`noAudio` 表示静音启动 |
| `videoBg` | string | 可选 | 视频背景色，如 `#F3F4FB` |
| `resolutionWidth` | number | 可选 | 视频宽度，默认 `1080` |
| `resolutionHeight` | number | 可选 | 视频高度，默认 `1920` |
| `showDebugger` | boolean | 可选 | 是否显示调试信息 |
| `backgroundImageUrl` | string | 可选 | 背景图片 URL |
| `cp-preAlertSec` | number | 可选 | 预提醒时间（秒） |
| `cp-positionV2` | string | 可选 | 数字人位置配置（JSON 字符串） |

### 位置配置格式

```json
{
  "location": {
    "top": 0,
    "left": 0,
    "width": 1080,
    "height": 1920
  }
}
```

## 获取 Token

Token 需要从后端获取，前端直接调用百度 API 会有跨域问题。

### 后端接口示例（Node.js）

```javascript
const axios = require('axios');

// 获取百度 Access Token
async function getBaiduToken() {
  const url = 'https://aip.baidubce.com/oauth/2.0/token';
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: 'uan6s8qt38wyqhe3vbs3',  // 你的 App Key
    client_secret: 'YOUR_SECRET_KEY',     // 你的 Secret Key
  });
  
  const response = await axios.post(`${url}?${params}`);
  return response.data.access_token;
}
```

## React 组件集成

### 基础版组件

```tsx
import React, { useMemo, useEffect, useState } from 'react';

const CUSTOME_PARAMS = {
  token: "", // 从后端获取
  figureId: "A2A_V2-xixi",
  ttsPer: "LMV_10578",
  "cp-ttsSample": "24000",
  initMode: "noAudio",
  videoBg: "#F3F4FB",
  resolutionWidth: 1080,
  resolutionHeight: 1920,
  showDebugger: false,
  backgroundImageUrl: "https://meta-human-editor-test.cdn.bcebos.com/17f8e526-1530-48ab-b02a-1c6138e1da1e/ffda0bfd-a0f5-49cc-bff4-1501ac1aa155/defaultBg.png",
  "cp-preAlertSec": 120,
  "cp-positionV2": JSON.stringify({
    location: { top: 0, left: 0, width: 1080, height: 1920 }
  })
};

interface BaiduDigitalHumanProps {
  token: string;
  onLoad?: () => void;
}

export const BaiduDigitalHuman: React.FC<BaiduDigitalHumanProps> = ({
  token,
  onLoad
}) => {
  const iframeParams = useMemo(() => {
    const params = new URLSearchParams();
    const allParams = { ...CUSTOME_PARAMS, token };
    
    Object.entries(allParams).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        params.append(key, String(value));
      }
    });
    
    return `?${params.toString()}`;
  }, [token]);

  const aspectRatio = CUSTOME_PARAMS.resolutionWidth / CUSTOME_PARAMS.resolutionHeight;

  return (
    <iframe
      style={{
        aspectRatio,
        width: '100%',
        height: 'auto',
        border: 'none',
        borderRadius: '12px',
      }}
      id="digital-human-iframe"
      src={`https://open.xiling.baidu.com/cloud/realtime${iframeParams}`}
      allow="autoplay; microphone"
      onLoad={onLoad}
    />
  );
};
```

### 完整集成版（带 Token 获取）

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const CUSTOME_PARAMS = {
  figureId: "A2A_V2-xixi",
  ttsPer: "LMV_10578",
  "cp-ttsSample": "24000",
  initMode: "noAudio",
  videoBg: "#F3F4FB",
  resolutionWidth: 1080,
  resolutionHeight: 1920,
  showDebugger: false,
  backgroundImageUrl: "https://meta-human-editor-test.cdn.bcebos.com/17f8e526-1530-48ab-b02a-1c6138e1da1e/ffda0bfd-a0f5-49cc-bff4-1501ac1aa155/defaultBg.png",
  "cp-preAlertSec": 120,
  "cp-positionV2": JSON.stringify({
    location: { top: 0, left: 0, width: 1080, height: 1920 }
  })
};

export function BaiduDigitalHumanChat() {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // 从后端获取 Token
  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    try {
      setLoading(true);
      // 调用你的后端 API 获取 Token
      const response = await fetch('/api/baidu-token');
      const data = await response.json();
      
      if (data.token) {
        setToken(data.token);
      } else {
        setError('获取 Token 失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">加载数字人中...</span>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-500">
        <p>{error || 'Token 获取失败'}</p>
        <button 
          onClick={fetchToken}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          重试
        </button>
      </div>
    );
  }

  // 构建 iframe URL
  const params = new URLSearchParams();
  Object.entries({ ...CUSTOME_PARAMS, token }).forEach(([key, value]) => {
    params.append(key, String(value));
  });

  const iframeUrl = `https://open.xiling.baidu.com/cloud/realtime?${params.toString()}`;
  const aspectRatio = CUSTOME_PARAMS.resolutionWidth / CUSTOME_PARAMS.resolutionHeight;

  return (
    <div className="w-full h-full">
      <iframe
        src={iframeUrl}
        style={{
          width: '100%',
          height: '100%',
          aspectRatio,
          border: 'none',
          borderRadius: '12px',
        }}
        allow="autoplay; microphone"
      />
    </div>
  );
}
```

## 后端 API 示例（Next.js API Route）

创建 `app/api/baidu-token/route.ts`：

```typescript
import { NextResponse } from 'next/server';

const BAIDU_CONFIG = {
  appKey: 'uan6s8qt38wyqhe3vbs3',
  secretKey: process.env.BAIDU_SECRET_KEY, // 从环境变量读取
};

export async function GET() {
  try {
    const url = 'https://aip.baidubce.com/oauth/2.0/token';
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: BAIDU_CONFIG.appKey,
      client_secret: BAIDU_CONFIG.secretKey!,
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (data.access_token) {
      return NextResponse.json({ token: data.access_token });
    } else {
      return NextResponse.json(
        { error: '获取 Token 失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
```

## 环境变量配置

```env
# .env.local
BAIDU_SECRET_KEY=your_secret_key_here
```

## 使用方式

### 1. 简单嵌入（已有对话页面）

```tsx
import { BaiduDigitalHumanChat } from '@/components/BaiduDigitalHumanChat';

export default function ChatPage() {
  return (
    <div className="flex h-screen">
      {/* 左侧：百度数字人 */}
      <div className="w-1/3 h-full">
        <BaiduDigitalHumanChat />
      </div>
      
      {/* 右侧：你自己的对话界面 */}
      <div className="w-2/3 h-full">
        {/* 你的对话组件 */}
      </div>
    </div>
  );
}
```

### 2. 全屏数字人

```tsx
export default function FullScreenDigitalHuman() {
  return (
    <div className="w-screen h-screen">
      <BaiduDigitalHumanChat />
    </div>
  );
}
```

## 注意事项

1. **Token 安全**: 不要在客户端暴露 Secret Key，必须通过后端获取 Token
2. **跨域问题**: iframe 方式避免了跨域问题
3. **麦克风权限**: 需要用户授权才能使用语音输入
4. **自动播放**: 现代浏览器限制自动播放音频，组件已处理

## 参考链接

- [百度智能云数字人控制台](https://xiling.cloud.baidu.com/open/overview)
- [组件开放平台文档](https://cloud.baidu.com/doc/AI_DH/index.html)
