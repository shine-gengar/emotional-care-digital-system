'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onToggleRecording: () => void;
  isRecording?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  onToggleRecording,
  isRecording = false,
  isLoading = false,
  placeholder = '输入消息...',
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex items-center gap-2 p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700">
      {/* 语音按钮 */}
      <Button
        variant="outline"
        size="icon"
        className={`flex-shrink-0 w-10 h-10 rounded-full transition-all duration-300 ${
          isRecording
            ? 'bg-red-100 text-red-600 border-red-300 animate-pulse'
            : 'hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
        onClick={onToggleRecording}
        disabled={isLoading}
      >
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              key="recording"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <MicOff className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="mic"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Mic className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* 输入框 */}
      <div className="flex-1 relative">
        <label htmlFor="chat-input" className="sr-only">发送消息</label>
        <input
          ref={inputRef}
          id="chat-input"
          name="message"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? '正在聆听...' : placeholder}
          disabled={isLoading || isRecording}
          className="w-full h-11 pr-12 pl-4 text-base bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full focus:outline-none focus:ring-2 focus:ring-rose-300 dark:focus:ring-rose-700 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          autoComplete="off"
        />
        
        {/* 发送按钮 */}
        <Button
          size="icon"
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-all duration-300 ${
            input.trim() && !isLoading
              ? 'bg-rose-500 hover:bg-rose-600 text-white'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* 录音状态指示器 */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            className="absolute left-14 -top-10 flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-sm rounded-full shadow-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            正在录音...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
