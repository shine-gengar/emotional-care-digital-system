'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { initBaiduDigitalHuman, getBaiduDigitalHumanAPI, BaiduAuthConfig } from './baidu-digital-human';

interface UseBaiduDigitalHumanOptions {
  figureId: string;
  onError?: (error: Error) => void;
}

interface UseBaiduDigitalHumanReturn {
  isGenerating: boolean;
  videoUrl: string | null;
  error: Error | null;
  generateVideo: (text: string) => Promise<string>;
  clearVideo: () => void;
}

/**
 * 百度智能云数字人 Hook
 * 
 * 使用示例:
 * ```tsx
 * // 在应用入口初始化
 * initBaiduDigitalHuman({
 *   appId: 'your-app-id',
 *   apiKey: 'your-api-key',
 *   secretKey: 'your-secret-key',
 * });
 * 
 * // 在组件中使用
 * function ChatComponent() {
 *   const { isGenerating, videoUrl, generateVideo } = useBaiduDigitalHuman({
 *     figureId: 'your-figure-id',
 *   });
 *   
 *   const handleSend = async (text: string) => {
 *     const url = await generateVideo(text);
 *     // 使用生成的视频 URL
 *   };
 * }
 * ```
 */
export function useBaiduDigitalHuman(
  options: UseBaiduDigitalHumanOptions
): UseBaiduDigitalHumanReturn {
  const { figureId, onError } = options;
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const generateVideo = useCallback(
    async (text: string): Promise<string> => {
      setIsGenerating(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      try {
        const api = getBaiduDigitalHumanAPI();
        const url = await api.generateVideo({
          figureId,
          text,
          width: 512,
          height: 512,
          format: 'mp4',
        });

        setVideoUrl(url);
        return url;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsGenerating(false);
      }
    },
    [figureId, onError]
  );

  const clearVideo = useCallback(() => {
    setVideoUrl(null);
    setError(null);
  }, []);

  return {
    isGenerating,
    videoUrl,
    error,
    generateVideo,
    clearVideo,
  };
}

// 重新导出初始化函数
export { initBaiduDigitalHuman, getBaiduDigitalHumanAPI };
export type { BaiduAuthConfig };
