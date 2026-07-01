'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 情绪类型定义
export type DetectedEmotion = 'angry' | 'disgust' | 'scared' | 'happy' | 'sad' | 'surprised' | 'neutral';

interface EmotionAnalysis {
  emotion: DetectedEmotion;
  confidence: number;
  probabilities: Record<DetectedEmotion, number>;
}

interface UserEmotionDetectorProps {
  onEmotionDetected?: (emotion: EmotionAnalysis) => void;
  isActive?: boolean;
  interval?: number; // 检测间隔（毫秒）
}

const emotionConfig: Record<DetectedEmotion, { label: string; emoji: string; color: string; bgColor: string }> = {
  angry: { label: '愤怒', emoji: '😠', color: 'text-red-600', bgColor: 'bg-red-100' },
  disgust: { label: '厌恶', emoji: '🤢', color: 'text-green-600', bgColor: 'bg-green-100' },
  scared: { label: '害怕', emoji: '😨', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  happy: { label: '开心', emoji: '😊', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  sad: { label: '悲伤', emoji: '😢', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  surprised: { label: '惊讶', emoji: '😲', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  neutral: { label: '平静', emoji: '😐', color: 'text-stone-600', bgColor: 'bg-stone-100' },
};

export function UserEmotionDetector({
  onEmotionDetected,
  isActive = true,
  interval = 2000,
}: UserEmotionDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    if (!isCameraEnabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('摄像头启动失败:', err);
      setError(
        err.name === 'NotAllowedError'
          ? '摄像头权限被拒绝'
          : '无法启动摄像头: ' + err.message
      );
    } finally {
      setIsLoading(false);
    }
  }, [isCameraEnabled]);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 调用真实情绪分析API
  const analyzeEmotion = useCallback(async (): Promise<EmotionAnalysis> => {
    if (!videoRef.current) {
      throw new Error('视频元素未准备好');
    }

    // 创建canvas捕获视频帧 - 提高分辨率
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建canvas上下文');
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    // 调用情绪分析API - 使用相对路径避免CORS问题
    const response = await fetch('http://127.0.0.1:5000/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageData,
        smoothing: true,
        debug: false
      })
    });

    const result = await response.json();

    if (!result.success || result.faces_detected === 0) {
      // 返回默认中性情绪
      return {
        emotion: 'neutral',
        confidence: 0.3,
        probabilities: {
          angry: 0.05, disgust: 0.05, scared: 0.05,
          happy: 0.1, sad: 0.05, surprised: 0.05, neutral: 0.65
        }
      };
    }

    const faceResult = result.results[0];
    const apiProbs = faceResult.probabilities;
    
    // 转换概率格式
    const probabilities: Record<DetectedEmotion, number> = {
      angry: apiProbs.angry || 0,
      disgust: apiProbs.disgust || 0,
      scared: apiProbs.scared || 0,
      happy: apiProbs.happy || 0,
      sad: apiProbs.sad || 0,
      surprised: apiProbs.surprised || 0,
      neutral: apiProbs.neutral || 0,
    };

    return {
      emotion: faceResult.emotion as DetectedEmotion,
      confidence: faceResult.confidence,
      probabilities,
    };
  }, []);

  // 执行情绪检测
  const detectEmotion = useCallback(async () => {
    if (!videoRef.current || !isCameraEnabled || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeEmotion();
      setCurrentEmotion(result);
      onEmotionDetected?.(result);
    } catch (err) {
      console.error('情绪分析失败:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isCameraEnabled, isAnalyzing, analyzeEmotion, onEmotionDetected]);

  // 切换摄像头
  const toggleCamera = useCallback(() => {
    setIsCameraEnabled(prev => !prev);
  }, []);

  // 组件挂载时启动摄像头
  useEffect(() => {
    if (isActive && isCameraEnabled) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, isCameraEnabled, startCamera, stopCamera]);

  // 设置定期检测 - 降低延迟到500ms
  useEffect(() => {
    if (isActive && isCameraEnabled) {
      detectionIntervalRef.current = setInterval(detectEmotion, 500);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isActive, isCameraEnabled, detectEmotion]);

  const dominantConfig = currentEmotion ? emotionConfig[currentEmotion.emotion] : null;

  return (
    <div className="w-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-200">
            情绪分析
          </span>
          {isAnalyzing && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-3 h-3 text-stone-400" />
            </motion.div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={toggleCamera}
        >
          {isCameraEnabled ? (
            <Camera className="w-4 h-4 text-stone-500" />
          ) : (
            <CameraOff className="w-4 h-4 text-stone-400" />
          )}
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* 摄像头预览 */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-stone-900">
          {isCameraEnabled ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900">
                  <div className="w-8 h-8 border-2 border-stone-600 border-t-rose-500 rounded-full animate-spin" />
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900 p-4">
                  <p className="text-xs text-red-400 text-center">{error}</p>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800">
              <CameraOff className="w-10 h-10 text-stone-600 mb-2" />
              <p className="text-xs text-stone-500">摄像头已关闭</p>
            </div>
          )}

          {/* 当前情绪标签 */}
          {currentEmotion && isCameraEnabled && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-2 left-2"
            >
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${dominantConfig?.bgColor} ${dominantConfig?.color}`}>
                <span className="text-sm">{dominantConfig?.emoji}</span>
                <span className="text-xs font-medium">{dominantConfig?.label}</span>
                <span className="text-xs opacity-70">
                  {Math.round(currentEmotion.confidence * 100)}%
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* 情绪概率条 */}
        {currentEmotion && isCameraEnabled && (
          <div className="space-y-2">
            <p className="text-xs text-stone-500 dark:text-stone-400">情绪概率分布</p>
            <div className="space-y-1.5">
              {(Object.entries(currentEmotion.probabilities)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4) as [DetectedEmotion, number][]).map(([emotion, prob]) => {
                const config = emotionConfig[emotion];
                return (
                  <div key={emotion} className="flex items-center gap-2">
                    <span className="text-xs w-12 text-stone-600 dark:text-stone-300">
                      {config.label}
                    </span>
                    <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prob * 100}%` }}
                        transition={{ duration: 0.3 }}
                        className="h-full rounded-full bg-rose-500"
                      />
                    </div>
                    <span className="text-xs w-10 text-right text-stone-500">
                      {Math.round(prob * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 提示信息 */}
        {!currentEmotion && isCameraEnabled && !isLoading && !error && (
          <p className="text-xs text-stone-400 text-center">
            正在分析您的表情...
          </p>
        )}
      </div>

      {/* 隐藏的canvas用于图像处理 */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default UserEmotionDetector;
