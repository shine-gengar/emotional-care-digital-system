'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmotionType } from '@/types';
import { Mic, MicOff, Send, Video, Phone, Volume2, VolumeX, ExternalLink, Camera, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserEmotionDetector, DetectedEmotion, EmotionAnalysis } from '@/components/emotion/UserEmotionDetector';

interface RealtimeVoiceChatProps {
  emotion?: EmotionType;
  name?: string;
  onSendMessage: (text: string) => Promise<string>; // 返回 AI 回复
}

// 对话状态
type ChatState = 'idle' | 'listening' | 'thinking' | 'speaking';

// 将检测到的情绪映射到应用情绪类型
const mapDetectedEmotion = (detected: DetectedEmotion): EmotionType => {
  const mapping: Record<DetectedEmotion, EmotionType> = {
    angry: 'angry',
    disgust: 'angry',
    scared: 'anxious',
    happy: 'happy',
    sad: 'sad',
    surprised: 'excited',
    neutral: 'neutral',
  };
  return mapping[detected] || 'neutral';
};

export function RealtimeVoiceChat({
  emotion = 'neutral',
  name = '小暖',
  onSendMessage,
}: RealtimeVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const [showUserCamera, setShowUserCamera] = useState(true);
  const [userEmotion, setUserEmotion] = useState<EmotionAnalysis | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 初始化语音识别
  useEffect(() => {
    if (typeof window !== 'undefined' && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';
      
      recognitionRef.current.onresult = (event) => {
        const results = event.results;
        const lastResult = results[results.length - 1];
        const text = lastResult[0].transcript;
        
        setTranscript(text);
        
        // 如果是最终结果，自动发送
        if (lastResult.isFinal) {
          handleVoiceSubmit(text);
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        if (event.error !== 'aborted') {
          setChatState('idle');
        }
      };
      
      recognitionRef.current.onend = () => {
        // 如果还在聆听状态，自动重启
        if (chatState === 'listening') {
          recognitionRef.current?.start();
        }
      };
    }
    
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // 处理检测到的情绪
  const handleEmotionDetected = useCallback((emotionData: EmotionAnalysis) => {
    setUserEmotion(emotionData);
    // 可以在这里将情绪数据发送到后端或更新全局状态
    console.log('检测到用户情绪:', emotionData);
  }, []);

  // 开始聆听
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert('浏览器不支持语音识别，请使用 Chrome 或 Edge');
      return;
    }
    
    // 如果 AI 正在说话，打断它
    if (chatState === 'speaking') {
      stopSpeaking();
    }
    
    setChatState('listening');
    setTranscript('');
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      // 可能已经在运行
    }
    
    // 5秒无声音自动停止
    silenceTimerRef.current = setTimeout(() => {
      if (transcript) {
        handleVoiceSubmit(transcript);
      } else {
        stopListening();
      }
    }, 5000);
  }, [chatState, transcript]);

  // 停止聆听
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      // 忽略错误
    }
    
    if (chatState === 'listening') {
      setChatState('idle');
    }
  }, [chatState]);

  // 处理语音提交
  const handleVoiceSubmit = async (text: string) => {
    if (!text.trim()) return;
    
    stopListening();
    setChatState('thinking');
    
    try {
      // 调用 onSendMessage 获取 AI 回复
      const reply = await onSendMessage(text);
      
      setAiReply(reply);
      setChatState('speaking');
      
      // 播放语音
      if (!isMuted) {
        speakText(reply);
      }
      
    } catch (error) {
      console.error('发送失败:', error);
      setChatState('idle');
    }
  };

  // 文字转语音 - 使用后端 API
  const speakText = async (text: string) => {
    try {
      console.log('🔊 调用 API TTS:', text.substring(0, 50) + '...');
      
      // 调用后端 TTS API
      const response = await fetch('http://localhost:3001/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error('TTS API failed');
      }
      
      // 获取音频数据
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 播放音频
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setChatState('idle');
        setAiReply('');
        URL.revokeObjectURL(audioUrl);
        // 自动开始聆听下一句
        setTimeout(() => startListening(), 500);
      };
      
      audio.onerror = () => {
        console.error('音频播放失败');
        setChatState('idle');
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
      console.log('✅ API TTS 播放开始');
      
    } catch (error) {
      console.error('❌ API TTS 失败，回退到浏览器 TTS:', error);
      // 回退到浏览器 TTS
      speakWithBrowserTTS(text);
    }
  };

  // 浏览器 TTS 回退
  const speakWithBrowserTTS = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find(v => v.lang.includes('zh'));
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }
    
    utterance.onend = () => {
      setChatState('idle');
      setAiReply('');
      setTimeout(() => startListening(), 500);
    };
    
    utterance.onerror = () => {
      setChatState('idle');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // 停止说话
  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setChatState('idle');
    setAiReply('');
  };

  // 处理文字输入
  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    handleVoiceSubmit(textInput);
    setTextInput('');
  };

  // 获取状态显示
  const getStatusText = () => {
    switch (chatState) {
      case 'listening': return '正在聆听...';
      case 'thinking': return '思考中...';
      case 'speaking': return '正在说话...';
      default: return '点击麦克风开始对话';
    }
  };

  // 获取状态颜色
  const getStatusColor = () => {
    switch (chatState) {
      case 'listening': return 'text-red-500';
      case 'thinking': return 'text-yellow-500';
      case 'speaking': return 'text-green-500';
      default: return 'text-stone-400';
    }
  };

  // 打开 LiveTalking 页面
  const openLiveTalking = async () => {
    try {
      // 先检查 LiveTalking 服务是否可用
      const response = await fetch('http://localhost:8010/emotion_companion.html', {
        method: 'HEAD',
        timeout: 3000
      });
      
      if (response.ok) {
        // 尝试打开新窗口
        const newWindow = window.open('http://localhost:8010/emotion_companion.html', 'LiveTalking', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no');
        
        if (newWindow) {
          setIsConnected(true);
          setShowIframe(false);
        } else {
          // 如果被阻止，使用 iframe 嵌入
          setShowIframe(true);
          setIsConnected(true);
        }
      } else {
        throw new Error('LiveTalking 服务不可用');
      }
    } catch (error) {
      console.error('LiveTalking 服务连接失败:', error);
      alert('LiveTalking 服务未启动，请先启动 LiveTalking 服务\n\n启动命令:\ncd LiveTalking-main\LiveTalking-main\npython app.py --transport webrtc --model wav2lip --avatar_id wav2lip256_avatar1');
    }
  };

  // 关闭连接
  const closeConnection = () => {
    setIsConnected(false);
    setShowIframe(false);
    stopListening();
    stopSpeaking();
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* 视频通话区域 */}
      <div className="relative w-[320px] h-[400px] rounded-2xl overflow-hidden bg-gradient-to-br from-rose-100/50 to-orange-100/50 dark:from-stone-800/50 dark:to-stone-700/50 shadow-2xl">
        <AnimatePresence mode="wait">
          {isConnected && showIframe ? (
            // iframe 嵌入 LiveTalking
            <motion.div
              key="iframe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <iframe
                ref={iframeRef}
                src="http://localhost:8010/emotion_companion.html"
                className="w-full h-full border-0"
                allow="autoplay; microphone; camera"
                title="LiveTalking 数字人"
              />
            </motion.div>
          ) : isConnected ? (
            // 已连接状态（新窗口打开）
            <motion.div
              key="connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-stone-800 dark:to-stone-700"
            >
              <motion.div 
                className="w-32 h-32 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-6xl mb-4"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🌸
              </motion.div>
              <p className="text-green-600 dark:text-green-400 font-medium">数字人视频通话中</p>
              <p className="text-sm text-stone-400 mt-2">请在弹出的窗口中操作</p>
              
              {/* AI 回复文字 */}
              {aiReply && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-2 bg-white/80 dark:bg-stone-800/80 rounded-xl max-w-[280px] text-center mt-4"
                >
                  <p className="text-sm text-stone-700 dark:text-stone-200">{aiReply}</p>
                </motion.div>
              )}
            </motion.div>
          ) : (
            // 未连接状态
            <motion.div
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center"
            >
              <span className="text-8xl mb-4">🌸</span>
              <p className="text-stone-500 text-sm">点击下方按钮开始</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 状态指示器 */}
        {isConnected && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-black/50 text-white rounded-full text-xs">
            <span className={`w-2 h-2 rounded-full ${
              chatState === 'listening' ? 'bg-red-500 animate-pulse' :
              chatState === 'thinking' ? 'bg-yellow-500 animate-pulse' :
              chatState === 'speaking' ? 'bg-green-500 animate-pulse' :
              'bg-green-500'
            }`} />
            {chatState === 'idle' ? '在线' : getStatusText()}
          </div>
        )}
      </div>

      {/* 控制区域 */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        {!isConnected ? (
          <>
            <Button
              size="lg"
              className="w-full bg-green-500 hover:bg-green-600 text-white h-14 rounded-xl"
              onClick={openLiveTalking}
            >
              <Video className="w-5 h-5 mr-2" />
              开始视频通话
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open('http://localhost:8010/emotion_companion.html', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              在新标签页打开
            </Button>
            <p className="text-xs text-stone-400 text-center">
              使用 LiveTalking wav2lip 高清数字人
            </p>
          </>
        ) : showIframe ? (
          // iframe 模式控制
          <>
            <div className="flex items-center gap-4">
              <Button
                size="icon"
                variant="destructive"
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600"
                onClick={closeConnection}
              >
                <Phone className="w-6 h-6 rotate-[135deg]" />
              </Button>
            </div>
            <p className="text-sm text-stone-500">点击挂断关闭视频通话</p>
          </>
        ) : (
          // 新窗口模式控制
          <>
            {/* 主要控制按钮 */}
            <div className="flex items-center gap-4">
              {/* 麦克风按钮 */}
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  className={`w-16 h-16 rounded-full transition-all duration-300 ${
                    chatState === 'listening'
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-rose-500 hover:bg-rose-600'
                  }`}
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  disabled={chatState === 'thinking'}
                >
                  {chatState === 'listening' ? (
                    <MicOff className="w-6 h-6 text-white" />
                  ) : (
                    <Mic className="w-6 h-6 text-white" />
                  )}
                </Button>
              </motion.div>

              {/* 静音按钮 */}
              <Button
                size="icon"
                variant="outline"
                className={`w-12 h-12 rounded-full ${isMuted ? 'bg-red-100 text-red-600' : ''}`}
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (!isMuted) {
                    window.speechSynthesis.cancel();
                  }
                }}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>

              {/* 挂断按钮 */}
              <Button
                size="icon"
                variant="destructive"
                className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600"
                onClick={closeConnection}
              >
                <Phone className="w-5 h-5 rotate-[135deg]" />
              </Button>
            </div>

            {/* 状态提示 */}
            <p className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </p>

            {/* 文字输入备选 */}
            <div className="w-full flex gap-2 mt-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.trim()) {
                    handleTextSubmit();
                  }
                }}
                placeholder="输入文字..."
                disabled={chatState === 'thinking'}
                className="flex-1 h-10 rounded-xl"
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl"
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || chatState === 'thinking'}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* 使用说明 */}
            <p className="text-xs text-stone-400 text-center">
              按住麦克风说话，松手自动发送
            </p>
          </>
        )}
      </div>

      {/* 用户摄像头和情绪分析区域 */}
      {isConnected && (
        <div className="w-full max-w-sm mt-4">
          {/* 用户摄像头预览 */}
          <div className="mb-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-sm font-medium text-stone-600 dark:text-stone-300 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                你的画面
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowUserCamera(!showUserCamera)}
              >
                {showUserCamera ? (
                  <><CameraOff className="w-3 h-3 mr-1" /> 关闭摄像头</>
                ) : (
                  <><Camera className="w-3 h-3 mr-1" /> 开启摄像头</>
                )}
              </Button>
            </div>
          </div>

          {/* 情绪分析组件 */}
          <UserEmotionDetector
            isActive={isConnected && showUserCamera}
            onEmotionDetected={handleEmotionDetected}
            interval={2000}
          />
        </div>
      )}
    </div>
  );
}
