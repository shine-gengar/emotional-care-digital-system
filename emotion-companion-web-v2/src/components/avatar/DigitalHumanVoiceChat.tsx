'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BaiduDigitalHumanRealtime } from './BaiduDigitalHumanRealtime';
import { CameraPreview } from '@/components/video/CameraPreview';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useAudioCall } from '@/hooks/useAudioCall';
import { chatApi } from '@/lib/api';
import { EmotionType } from '@/types';
import { Mic, MicOff, Send, Video, VideoOff, Phone, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface DigitalHumanVoiceChatProps {
  avatarUrl?: string;
  name?: string;
  emotion?: EmotionType;
  onSendMessage?: (content: string) => Promise<void>;
}

/**
 * 数字人语音交互组件 - 重新设计版
 * 
 * 视频通话模式：左右并排布局，统一控制栏
 */
export function DigitalHumanVoiceChat({
  avatarUrl,
  name = '小暖',
  emotion = 'neutral',
  onSendMessage,
}: DigitalHumanVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  
  // 视频通话相关状态
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { 
    isRecording, 
    transcript, 
    startRecording, 
    stopRecording, 
    error: voiceError,
    isSupported 
  } = useVoiceInput();
  
  const [textInput, setTextInput] = useState('');

  // 监听语音识别结果
  useEffect(() => {
    if (!isRecording && transcript && transcript.trim() && isConnected && !isProcessing) {
      const timer = setTimeout(() => {
        handleVoiceSubmit(transcript);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRecording, transcript, isConnected, isProcessing]);

  const handleVoiceSubmit = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    setIsProcessing(true);
    
    // 如果有外部传入的 sendMessage 函数，使用它
    if (onSendMessage) {
      await onSendMessage(text);
      setIsProcessing(false);
      return;
    }
    
    // 否则使用内部 API 调用
    const userMessage = { role: 'user' as const, content: text };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);

    try {
      const response = await chatApi.sendMessage(text);
      const reply = response.message?.content || '抱歉，我没有听清楚，能再说一遍吗？';
      const aiMessage = { role: 'assistant' as const, content: reply };
      setChatHistory([...newHistory, aiMessage]);
      setAiReply(reply);
    } catch (error) {
      const fallbackReply = '抱歉，我暂时无法回应，请稍后再试。';
      const aiMessage = { role: 'assistant' as const, content: fallbackReply };
      setChatHistory([...newHistory, aiMessage]);
      setAiReply(fallbackReply);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeakComplete = () => {
    setAiReply('');
  };

  const handleEndCall = () => {
    console.log('【挂断】开始执行挂断操作...');
    
    // 1. 先断开数字人连接（最重要！）
    setIsConnected(false);
    
    // 2. 关闭视频模式
    setIsVideoMode(false);
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
    
    // 3. 停止音频分析
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log('【挂断】音频分析已停止');
    }
    
    // 4. 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log('【挂断】音频上下文已关闭');
    }
    
    console.log('【挂断】挂断操作完成，数字人连接已断开');
  };

  // 音频分析
  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const analyzeAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const level = Math.min(100, Math.max(0, average * 2));
        setAudioLevel(level);
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      analyzeAudio();
    } catch (err) {
      console.error('音频分析启动失败:', err);
    }
  }, []);

  useEffect(() => {
    if (isVideoMode && isConnected) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          startAudioAnalysis(stream);
        })
        .catch(err => {
          console.error('获取摄像头/麦克风权限失败:', err);
        });
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVideoMode, isConnected, startAudioAnalysis]);

  // 视频通话模式 - 左右并排布局
  if (isVideoMode && isConnected) {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
        {/* 视频通话区域 - 左右并排，更大的尺寸 */}
        <div className="flex gap-6 w-full">
          {/* 左侧：用户摄像头 */}
          <div className="flex-1 aspect-[4/3] max-w-[480px] rounded-3xl overflow-hidden bg-stone-900 shadow-2xl relative">
            <CameraPreview
              isActive={isConnected}
              isCameraEnabled={isCameraEnabled}
              isMicEnabled={isMicEnabled}
              onToggleCamera={() => setIsCameraEnabled(!isCameraEnabled)}
              onToggleMic={() => setIsMicEnabled(!isMicEnabled)}
              onEndCall={handleEndCall}
              variant="large"
              audioLevel={audioLevel}
            />
          </div>
          
          {/* 右侧：AI 数字人 */}
          <div className="flex-1 aspect-[4/3] max-w-[480px] rounded-3xl overflow-hidden bg-stone-900 shadow-2xl relative">
            <BaiduDigitalHumanRealtime
              emotion={emotion}
              isSpeaking={!!aiReply}
              isListening={isRecording}
              avatarUrl={avatarUrl}
              name={name}
              shouldConnect={isConnected}
              textToSpeak={aiReply}
              onSessionStart={() => console.log('数字人会话开始')}
              onSessionEnd={(duration) => console.log('数字人会话结束，时长:', duration)}
              onSpeakComplete={handleSpeakComplete}
            />
          </div>
        </div>

        {/* 统一控制栏 */}
        <div className="flex items-center gap-4 p-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm rounded-2xl shadow-lg">
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full w-12 h-12 ${isCameraEnabled ? 'bg-stone-100' : 'bg-red-100 text-red-600'}`}
            onClick={() => setIsCameraEnabled(!isCameraEnabled)}
          >
            {isCameraEnabled ? <Camera className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className={`rounded-full w-12 h-12 ${isMicEnabled ? 'bg-stone-100' : 'bg-red-100 text-red-600'}`}
            onClick={() => setIsMicEnabled(!isMicEnabled)}
          >
            {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600"
            onClick={handleEndCall}
          >
            <Phone className="w-6 h-6 rotate-[135deg]" />
          </Button>
        </div>

        {/* 文字输入 */}
        <div className="w-full flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textInput.trim()) {
                handleVoiceSubmit(textInput);
                setTextInput('');
              }
            }}
            placeholder="输入文字与数字人交流..."
            disabled={isProcessing}
            className="flex-1 h-12 rounded-xl"
          />
          <Button
            size="icon"
            className="h-12 w-12 rounded-xl"
            onClick={() => {
              if (textInput.trim()) {
                handleVoiceSubmit(textInput);
                setTextInput('');
              }
            }}
            disabled={!textInput.trim() || isProcessing}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  // 普通模式
  return (
    <div className="flex flex-col items-center gap-6">
      <BaiduDigitalHumanRealtime
        emotion={emotion}
        isSpeaking={!!aiReply}
        isListening={isRecording}
        avatarUrl={avatarUrl}
        name={name}
        shouldConnect={isConnected}
        textToSpeak={aiReply}
        onSessionStart={() => console.log('数字人会话开始')}
        onSessionEnd={(duration) => console.log('数字人会话结束，时长:', duration)}
        onSpeakComplete={handleSpeakComplete}
      />

      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        {!isConnected ? (
          <Button
            size="lg"
            className="w-full bg-green-500 hover:bg-green-600 text-white h-14 rounded-xl"
            onClick={() => {
              setIsConnected(true);
              setIsVideoMode(true);
            }}
          >
            <Video className="w-5 h-5 mr-2" />
            开始视频通话
          </Button>
        ) : (
          <>
            <motion.div className="relative" whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                className={`w-20 h-20 rounded-full transition-all duration-300 ${
                  isRecording ? 'bg-red-500 animate-pulse' : 'bg-rose-500 hover:bg-rose-600'
                }`}
                onClick={() => isRecording ? stopRecording() : startRecording()}
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

            <div className="w-full flex gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.trim()) {
                    handleVoiceSubmit(textInput);
                    setTextInput('');
                  }
                }}
                placeholder="输入文字与数字人交流..."
                disabled={isProcessing}
                className="flex-1 h-12 rounded-xl"
              />
              <Button
                size="icon"
                className="h-12 w-12 rounded-xl"
                onClick={() => {
                  if (textInput.trim()) {
                    handleVoiceSubmit(textInput);
                    setTextInput('');
                  }
                }}
                disabled={!textInput.trim() || isProcessing}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DigitalHumanVoiceChat;
