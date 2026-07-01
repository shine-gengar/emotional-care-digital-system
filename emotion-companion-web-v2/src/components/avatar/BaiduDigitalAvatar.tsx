'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmotionType } from '@/types';
import { useBaiduDigitalHuman, initBaiduDigitalHuman } from '@/hooks/useBaiduDigitalHuman';
import { Loader2 } from 'lucide-react';

// 初始化配置（从环境变量读取）
const BAIDU_CONFIG = {
  appId: process.env.NEXT_PUBLIC_BAIDU_APP_ID || '',
  apiKey: process.env.NEXT_PUBLIC_BAIDU_API_KEY || '',
  secretKey: process.env.NEXT_PUBLIC_BAIDU_SECRET_KEY || '',
};

// 是否已初始化
let isInitialized = false;

interface BaiduDigitalAvatarProps {
  emotion: EmotionType;
  isSpeaking?: boolean;
  isListening?: boolean;
  text?: string; // 要合成的文字
  figureId: string; // 百度数字人形象 ID
  avatarUrl?: string; // 静态头像后备
  name?: string;
  onVideoGenerated?: (url: string) => void;
  onError?: (error: Error) => void;
}

const emotionColors: Record<EmotionType, string> = {
  neutral: 'from-stone-200 to-stone-300',
  happy: 'from-amber-200 to-orange-200',
  sad: 'from-blue-200 to-indigo-200',
  anxious: 'from-purple-200 to-pink-200',
  angry: 'from-red-200 to-rose-200',
  tired: 'from-slate-200 to-gray-200',
  excited: 'from-yellow-200 to-amber-200',
};

export function BaiduDigitalAvatar({
  emotion = 'neutral',
  isSpeaking = false,
  isListening = false,
  text,
  figureId,
  avatarUrl,
  name = '小暖',
  onVideoGenerated,
  onError,
}: BaiduDigitalAvatarProps) {
  const [breathingScale, setBreathingScale] = useState(1);
  const [displayVideoUrl, setDisplayVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevTextRef = useRef<string>('');

  // 初始化百度数字人 API
  useEffect(() => {
    if (!isInitialized && BAIDU_CONFIG.appId && BAIDU_CONFIG.apiKey) {
      try {
        initBaiduDigitalHuman(BAIDU_CONFIG);
        isInitialized = true;
      } catch (err) {
        console.error('初始化百度数字人失败:', err);
      }
    }
  }, []);

  // 使用百度数字人 Hook
  const { isGenerating, videoUrl, generateVideo, error } = useBaiduDigitalHuman({
    figureId,
    onError,
  });

  // 当 text 变化时生成新视频
  useEffect(() => {
    if (text && text !== prevTextRef.current && isInitialized) {
      prevTextRef.current = text;
      generateVideo(text).then((url) => {
        setDisplayVideoUrl(url);
        onVideoGenerated?.(url);
      }).catch(() => {
        // 错误已在 hook 中处理
      });
    }
  }, [text, figureId, generateVideo, onVideoGenerated]);

  // 呼吸动画（仅在没有视频时使用）
  useEffect(() => {
    if (displayVideoUrl) return;
    const interval = setInterval(() => {
      setBreathingScale((prev) => (prev === 1 ? 1.03 : 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [displayVideoUrl]);

  // 视频播放控制
  useEffect(() => {
    if (videoRef.current && displayVideoUrl) {
      if (isSpeaking) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isSpeaking, displayVideoUrl]);

  const getStatusText = () => {
    if (isGenerating) return '正在生成数字人...';
    if (isSpeaking) return '正在说话...';
    if (isListening) return '正在聆听...';
    return name;
  };

  const useStaticAvatar = !displayVideoUrl || error;

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* 外层光晕 */}
      <motion.div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${emotionColors[emotion]} opacity-30 blur-3xl`}
        animate={{
          scale: isSpeaking ? [1, 1.15, 1] : breathingScale,
          opacity: isSpeaking ? [0.3, 0.6, 0.3] : 0.3,
        }}
        transition={{
          duration: isSpeaking ? 0.5 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* 主头像容器 */}
      <motion.div
        className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br ${emotionColors[emotion]} 
          shadow-2xl flex items-center justify-center overflow-hidden`}
        animate={{
          scale: isSpeaking ? [1, 1.02, 1] : breathingScale,
        }}
        transition={{
          duration: isSpeaking ? 0.3 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* 内圈装饰 */}
        <div className="absolute inset-4 rounded-full bg-white/20 backdrop-blur-sm z-10" />
        
        {/* 视频头像 */}
        <AnimatePresence mode="wait">
          {!useStaticAvatar ? (
            <motion.video
              key="video"
              ref={videoRef}
              src={displayVideoUrl || videoUrl || undefined}
              className="absolute inset-0 w-full h-full object-cover rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              loop
              muted
              playsInline
              style={{
                filter: isSpeaking ? 'brightness(1.1)' : 'brightness(1)',
              }}
            />
          ) : (
            <motion.div
              key="static"
              className="relative z-10 text-6xl md:text-8xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover"
                />
              ) : (
                <span className="filter drop-shadow-lg">{name === '小暖' ? '👩' : '👨'}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 生成中遮罩 */}
        {isGenerating && (
          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center z-20">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* 说话时的音波动画 */}
        {isSpeaking && !isGenerating && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8 z-20">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-white rounded-full"
                animate={{
                  height: [8, 24, 8],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        )}

        {/* 聆听时的指示器 */}
        {isListening && (
          <motion.div
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full z-20"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* 状态指示器 */}
        <div className="absolute bottom-2 right-2 z-20">
          <motion.div
            className={`w-4 h-4 rounded-full border-2 border-white ${
              isGenerating 
                ? 'bg-yellow-500' 
                : isSpeaking 
                  ? 'bg-green-500' 
                  : isListening 
                    ? 'bg-red-500' 
                    : 'bg-blue-500'
            }`}
            animate={{
              scale: (isSpeaking || isListening || isGenerating) ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 1,
              repeat: (isSpeaking || isListening || isGenerating) ? Infinity : 0,
              ease: 'easeInOut',
            }}
          />
        </div>
      </motion.div>

      {/* 状态文字 */}
      <motion.p
        className="mt-6 text-lg font-medium text-stone-600 dark:text-stone-300"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {getStatusText()}
      </motion.p>

      {/* 错误提示 */}
      {error && (
        <motion.p
          className="mt-2 text-sm text-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          数字人生成失败，使用默认头像
        </motion.p>
      )}
    </div>
  );
}
