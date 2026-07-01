'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmotionType } from '@/types';

interface LivePortraitAvatarProps {
  emotion: EmotionType;
  isSpeaking?: boolean;
  isListening?: boolean;
  avatarUrl?: string; // 静态图片作为后备
  videoUrl?: string; // LivePortrait 生成的视频
  name?: string;
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

const emotionGlow: Record<EmotionType, string> = {
  neutral: 'shadow-stone-200/50',
  happy: 'shadow-amber-200/50',
  sad: 'shadow-blue-200/50',
  anxious: 'shadow-purple-200/50',
  angry: 'shadow-red-200/50',
  tired: 'shadow-slate-200/50',
  excited: 'shadow-yellow-200/50',
};

// 视频状态类型
 type AvatarState = 'idle' | 'speaking' | 'listening';

export function LivePortraitAvatar({
  emotion = 'neutral',
  isSpeaking = false,
  isListening = false,
  avatarUrl,
  videoUrl,
  name = '小暖',
}: LivePortraitAvatarProps) {
  const [breathingScale, setBreathingScale] = useState(1);
  const [currentState, setCurrentState] = useState<AvatarState>('idle');
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 呼吸动画（仅在没有视频时使用）
  useEffect(() => {
    if (videoUrl) return;
    const interval = setInterval(() => {
      setBreathingScale((prev) => (prev === 1 ? 1.03 : 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [videoUrl]);

  // 根据状态切换
  useEffect(() => {
    if (isSpeaking) {
      setCurrentState('speaking');
    } else if (isListening) {
      setCurrentState('listening');
    } else {
      setCurrentState('idle');
    }
  }, [isSpeaking, isListening]);

  // 视频播放控制
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.playbackRate = isSpeaking ? 1.2 : 1;
      if (isSpeaking) {
        videoRef.current.play().catch(() => setHasError(true));
      }
    }
  }, [isSpeaking, videoUrl]);

  // 获取状态文字
  const getStatusText = () => {
    if (isSpeaking) return '正在说话...';
    if (isListening) return '正在聆听...';
    return name;
  };

  // 如果没有视频 URL 或出错，使用静态头像
  const useStaticAvatar = !videoUrl || hasError;

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
          shadow-2xl ${emotionGlow[emotion]} flex items-center justify-center overflow-hidden`}
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
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-cover rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: isVideoLoaded ? 1 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => setIsVideoLoaded(true)}
              onError={() => setHasError(true)}
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

        {/* 说话时的音波动画 */}
        {isSpeaking && (
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
              currentState === 'speaking' 
                ? 'bg-green-500' 
                : currentState === 'listening' 
                  ? 'bg-red-500' 
                  : 'bg-blue-500'
            }`}
            animate={{
              scale: currentState !== 'idle' ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 1,
              repeat: currentState !== 'idle' ? Infinity : 0,
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

      {/* 视频加载提示 */}
      {videoUrl && !isVideoLoaded && !hasError && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
        </motion.div>
      )}
    </div>
  );
}
