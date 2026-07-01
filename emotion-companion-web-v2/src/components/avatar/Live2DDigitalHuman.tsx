'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmotionType } from '@/types';
import { Mic, MicOff, Send, Video, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Live2DDigitalHumanProps {
  emotion?: EmotionType;
  name?: string;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  aiReply: string;
  onSpeakComplete: () => void;
  isRecording: boolean;
  transcript: string;
  startRecording: () => void;
  stopRecording: () => void;
  voiceError: string | null;
  isVoiceSupported: boolean;
  isProcessing: boolean;
  onSendMessage: (content: string) => void;
}

// Live2D 数字人服务地址
const LIVE2D_SERVER_URL = 'http://localhost:5261';

/**
 * Live2D 数字人组件
 */
export function Live2DDigitalHuman({
  emotion = 'neutral',
  name = '小暖',
  isConnected,
  setIsConnected,
  aiReply,
  onSpeakComplete,
  isRecording,
  transcript,
  startRecording,
  stopRecording,
  voiceError,
  isVoiceSupported,
  isProcessing,
  onSendMessage,
}: Live2DDigitalHumanProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [textInput, setTextInput] = React.useState('');

  // 监听 aiReply 变化，播报完成后清空
  useEffect(() => {
    if (aiReply) {
      console.log('🎭 数字人播报:', aiReply.substring(0, 50) + '...');
      // 3秒后播报完成
      const timer = setTimeout(() => {
        onSpeakComplete();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [aiReply, onSpeakComplete]);

  // 处理麦克风按钮
  const handleMicClick = () => {
    if (!isConnected) {
      alert('请先点击"开始视频通话"连接数字人');
      return;
    }
    if (!isVoiceSupported) {
      alert('浏览器不支持语音识别');
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 处理文字发送
  const handleSendText = () => {
    if (!textInput.trim()) return;
    onSendMessage(textInput);
    setTextInput('');
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Live2D 数字人显示区域 */}
      <div className="relative w-[320px] h-[400px] rounded-2xl overflow-hidden bg-gradient-to-br from-rose-100/50 to-orange-100/50 dark:from-stone-800/50 dark:to-stone-700/50 shadow-2xl">
        <AnimatePresence mode="wait">
          {isConnected ? (
            <motion.div
              key="live2d"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <iframe
                ref={iframeRef}
                src={`${LIVE2D_SERVER_URL}/`}
                className="w-full h-full border-0"
                style={{ backgroundColor: 'transparent' }}
                allow="autoplay"
                title="Live2D 数字人"
              />
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center"
            >
              <span className="text-8xl mb-4">{name === '小暖' ? '👩' : '👨'}</span>
              <p className="text-stone-500 text-sm">点击开始视频通话</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 状态指示器 */}
        {isConnected && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded-full text-xs">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            在线
          </div>
        )}
      </div>

      {/* 控制区域 */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        {!isConnected ? (
          <Button
            size="lg"
            className="w-full bg-green-500 hover:bg-green-600 text-white h-14 rounded-xl"
            onClick={() => setIsConnected(true)}
          >
            <Video className="w-5 h-5 mr-2" />
            开始视频通话
          </Button>
        ) : (
          <>
            {/* 语音按钮 */}
            <motion.div className="relative" whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                className={`w-20 h-20 rounded-full transition-all duration-300 ${
                  isRecording ? 'bg-red-500 animate-pulse' : 'bg-rose-500 hover:bg-rose-600'
                }`}
                onClick={handleMicClick}
                disabled={isProcessing}
              >
                {isRecording ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
              </Button>
              {isRecording && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                  <span className="absolute -inset-2 rounded-full bg-red-300 animate-ping opacity-50 delay-150" />
                </>
              )}
            </motion.div>

            {/* 语音识别结果 */}
            {isRecording && transcript && (
              <p className="text-sm text-stone-600 dark:text-stone-300 text-center bg-white/50 dark:bg-stone-800/50 px-4 py-2 rounded-lg">
                {transcript}
              </p>
            )}

            {/* 错误提示 */}
            {voiceError && (
              <p className="text-xs text-red-500 text-center">{voiceError}</p>
            )}

            {/* 文字输入 */}
            <div className="w-full flex gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.trim()) {
                    handleSendText();
                  }
                }}
                placeholder={`和 ${name} 说话...`}
                disabled={isProcessing}
                className="flex-1 h-12 rounded-xl"
              />
              <Button
                size="icon"
                className="h-12 w-12 rounded-xl"
                onClick={handleSendText}
                disabled={!textInput.trim() || isProcessing}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>

            {/* 挂断按钮 */}
            <Button
              variant="destructive"
              size="lg"
              className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-600"
              onClick={() => setIsConnected(false)}
            >
              <Phone className="w-5 h-5 mr-2 rotate-[135deg]" />
              结束通话
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
