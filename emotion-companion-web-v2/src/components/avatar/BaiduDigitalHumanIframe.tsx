'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 百度数字人组件配置
const CUSTOME_PARAMS = {
  figureId: "A2A_V2-fig-rgzp9b9gaybvqcy4", // 馨月-半身交互
  ttsPer: "CAP_4196", // 度清影
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

interface BaiduDigitalHumanIframeProps {
  className?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

/**
 * 百度智能云数字人 H5 组件
 * 
 * 使用 iframe 嵌入百度数字人实时对话组件
 * 需要后端提供 Token 接口
 */
export function BaiduDigitalHumanIframe({
  className = '',
  onLoad,
  onError,
}: BaiduDigitalHumanIframeProps) {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // 从后端获取 Token
  const fetchToken = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/baidu-token');
      const data = await response.json();
      
      if (data.token) {
        setToken(data.token);
      } else {
        const errorMsg = data.error || '获取 Token 失败';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = '网络错误，请检查连接';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, []);

  // 构建 iframe URL
  const iframeUrl = useMemo(() => {
    if (!token) return '';
    
    const params = new URLSearchParams();
    Object.entries({ ...CUSTOME_PARAMS, token }).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    
    return `https://open.xiling.baidu.com/cloud/realtime?${params.toString()}`;
  }, [token]);

  const aspectRatio = CUSTOME_PARAMS.resolutionWidth / CUSTOME_PARAMS.resolutionHeight;

  // 加载中状态
  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center bg-stone-100 dark:bg-stone-800 rounded-xl ${className}`}>
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="mt-4 text-stone-600 dark:text-stone-300">正在连接数字人...</p>
      </div>
    );
  }

  // 错误状态
  if (error || !token) {
    return (
      <div className={`flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl ${className}`}>
        <p className="text-red-500 mb-4">{error || '连接失败'}</p>
        <Button onClick={fetchToken} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          重试连接
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800 ${className}`}>
      <iframe
        src={iframeUrl}
        style={{
          width: '100%',
          height: '100%',
          aspectRatio,
          border: 'none',
        }}
        allow="autoplay; microphone; camera"
        onLoad={onLoad}
        title="百度数字人"
      />
    </div>
  );
}
