'use client';

import { motion } from 'framer-motion';
import { Message } from '@/types';
import { EmotionBadge } from '../emotion/EmotionBadge';
import { User, Bot, Volume2, VolumeX } from 'lucide-react';
import { useTTS } from '@/hooks/useTTS';
import { useEffect, useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
  autoPlay?: boolean;
}

export function MessageBubble({ message, isLast, autoPlay }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { speak, stop, isSpeaking, isPaused, pause, resume } = useTTS();
  const [isPlayingThis, setIsPlayingThis] = useState(false);

  // 检查是否正在播放当前这条消息
  useEffect(() => {
    if (!isSpeaking && !isPaused) {
      setIsPlayingThis(false);
    }
  }, [isSpeaking, isPaused]);

  const handleSpeak = () => {
    if (isPlayingThis) {
      // 如果正在播放当前消息，则暂停/恢复
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      // 如果正在播放其他消息，先停止
      if (isSpeaking) {
        stop();
      }
      // 播放当前消息
      setIsPlayingThis(true);
      speak(message.content);
    }
  };

  return (
    <motion.div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* 头像 */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-gradient-to-br from-stone-300 to-stone-400'
            : 'bg-gradient-to-br from-rose-200 to-orange-200'
        }`}
      >
        {isUser ? <User className="w-5 h-5 text-stone-600" /> : <Bot className="w-5 h-5 text-stone-600" />}
      </div>

      {/* 消息内容 */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* 气泡 */}
        <div
          className={`relative px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-stone-800 text-white rounded-tr-sm'
              : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 rounded-tl-sm shadow-sm border border-stone-200 dark:border-stone-700'
          }`}
        >
          <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
          
          {/* 语音播放按钮（仅 AI 消息） */}
          {!isUser && (
            <button
              onClick={handleSpeak}
              className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-600 transition-colors"
              title={
                isPlayingThis 
                  ? (isPaused ? '继续播放' : '暂停播放')
                  : '播放语音'
              }
            >
              {isPlayingThis ? (
                isPaused ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* 情绪标签和时间 */}
        <div className="flex items-center gap-2 mt-1.5">
          {message.emotion && !isUser && (
            <EmotionBadge emotion={message.emotion} size="sm" />
          )}
          <span className="text-xs text-stone-400">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

interface MessageListProps {
  messages: Message[];
  autoPlayVoice?: boolean;
}

export function MessageList({ messages, autoPlayVoice = false }: MessageListProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.length === 0 ? (
        <motion.div
          className="flex flex-col items-center justify-center py-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center mb-4">
            <span className="text-3xl">💬</span>
          </div>
          <p className="text-stone-500 dark:text-stone-400">开始和你的数字人朋友对话吧</p>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">
            可以分享你的心情，或者聊聊今天发生了什么
          </p>
        </motion.div>
      ) : (
        messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
            autoPlay={autoPlayVoice}
          />
        ))
      )}
    </div>
  );
}
