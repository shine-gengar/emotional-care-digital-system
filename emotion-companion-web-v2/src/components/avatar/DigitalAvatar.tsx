'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { EmotionType } from '@/types';

interface DigitalAvatarProps {
  emotion: EmotionType;
  isSpeaking?: boolean;
  isListening?: boolean;
  avatarUrl?: string;
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

export function DigitalAvatar({
  emotion = 'neutral',
  isSpeaking = false,
  isListening = false,
  avatarUrl,
  name = '小暖',
}: DigitalAvatarProps) {
  const [breathingScale, setBreathingScale] = useState(1);

  // 呼吸动画
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathingScale((prev) => (prev === 1 ? 1.03 : 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* 外层光晕 */}
      <motion.div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${emotionColors[emotion]} opacity-30 blur-3xl`}
        animate={{
          scale: isSpeaking ? [1, 1.1, 1] : breathingScale,
          opacity: isSpeaking ? [0.3, 0.5, 0.3] : 0.3,
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
          shadow-2xl ${emotionGlow[emotion]} flex items-center justify-center`}
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
        <div className="absolute inset-4 rounded-full bg-white/20 backdrop-blur-sm" />
        
        {/* 头像内容 */}
        <div className="relative z-10 text-6xl md:text-8xl">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover"
            />
          ) : (
            <span className="filter drop-shadow-lg">{name === '小暖' ? '👩' : '👨'}</span>
          )}
        </div>

        {/* 说话时的音波动画 */}
        {isSpeaking && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-current rounded-full"
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
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full"
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
      </motion.div>

      {/* 状态文字 */}
      <motion.p
        className="mt-6 text-lg font-medium text-stone-600 dark:text-stone-300"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isSpeaking ? '正在说话...' : isListening ? '正在聆听...' : name}
      </motion.p>
    </div>
  );
}
