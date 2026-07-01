'use client';

import { motion } from 'framer-motion';
import { EmotionType } from '@/types';
import { Smile, Frown, CloudRain, Zap, Flame, Moon, Sun } from 'lucide-react';

interface EmotionBadgeProps {
  emotion: EmotionType;
  confidence?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const emotionConfig: Record<EmotionType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  neutral: {
    label: '平静',
    icon: <Smile className="w-4 h-4" />,
    color: 'text-stone-600',
    bgColor: 'bg-stone-100',
  },
  happy: {
    label: '开心',
    icon: <Sun className="w-4 h-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  sad: {
    label: '难过',
    icon: <CloudRain className="w-4 h-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  anxious: {
    label: '焦虑',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  angry: {
    label: '生气',
    icon: <Flame className="w-4 h-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  tired: {
    label: '疲惫',
    icon: <Moon className="w-4 h-4" />,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  excited: {
    label: '兴奋',
    icon: <Sun className="w-4 h-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-4 py-2 text-base gap-2',
};

export function EmotionBadge({
  emotion,
  confidence,
  showLabel = true,
  size = 'md',
}: EmotionBadgeProps) {
  const config = emotionConfig[emotion];

  return (
    <motion.div
      className={`inline-flex items-center rounded-full ${config.bgColor} ${config.color} ${sizeClasses[size]} font-medium`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {config.icon}
      {showLabel && <span>{config.label}</span>}
      {confidence !== undefined && (
        <span className="opacity-60">{Math.round(confidence * 100)}%</span>
      )}
    </motion.div>
  );
}

interface EmotionDashboardProps {
  currentEmotion: EmotionType;
  emotionHistory?: EmotionType[];
}

export function EmotionDashboard({ currentEmotion }: EmotionDashboardProps) {
  const emotions: EmotionType[] = ['neutral', 'happy', 'sad', 'anxious', 'angry', 'tired', 'excited'];

  return (
    <div className="p-4 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm rounded-2xl border border-stone-200 dark:border-stone-700">
      <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-3">情绪状态</h3>
      <div className="flex flex-wrap gap-2">
        {emotions.map((emotion) => (
          <EmotionBadge
            key={emotion}
            emotion={emotion}
            size="sm"
            showLabel={true}
          />
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
        <div className="text-sm text-stone-600 dark:text-stone-300">
          当前检测到: <EmotionBadge emotion={currentEmotion} size="sm" />
        </div>
      </div>
    </div>
  );
}
