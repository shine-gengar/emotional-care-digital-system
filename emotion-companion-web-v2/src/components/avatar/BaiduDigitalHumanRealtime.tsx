'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmotionType } from '@/types';
import { Loader2, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 动态导入 DHIframe，避免 SSR 问题
let DHIframe: any = null;
if (typeof window !== 'undefined') {
  import('@bddh/starling-dhiframe').then((module) => {
    DHIframe = module.default;
  });
}

// 百度数字人配置
const BAIDU_CONFIG = {
  token: "your-baidu-app-id-here/b5efb73e6b69a00e7d5625122e3f5fd5adc9294256d44de090b4e3e2d8c7724d/6954-06-10T15:10:01.011Z",
  figureId: "A2A_V2-fig-rgzp9b9gaybvqcy4",
  ttsPer: "CAP_4194",
  initMode: "noAudio",
  resolutionWidth: 1080,
  resolutionHeight: 1920,
  cameraId: 1, // 竖屏半身
};

// WebSocket 状态枚举
enum ReadyState {
  UNINSTANTIATED = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

interface BaiduDigitalHumanRealtimeProps {
  emotion?: EmotionType;
  isSpeaking?: boolean;
  isListening?: boolean;
  avatarUrl?: string;
  name?: string;
  shouldConnect: boolean;
  textToSpeak?: string;
  onSessionStart?: () => void;
  onSessionEnd?: (duration: number) => void;
  onSpeakComplete?: () => void;
}

export function BaiduDigitalHumanRealtime({
  emotion = 'neutral',
  isSpeaking = false,
  isListening = false,
  avatarUrl,
  name = '小暖',
  shouldConnect,
  textToSpeak,
  onSessionStart,
  onSessionEnd,
  onSpeakComplete,
}: BaiduDigitalHumanRealtimeProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [sessionTime, setSessionTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [realTimeVideoReady, setRealTimeVideoReady] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showTimeoutTip, setShowTimeoutTip] = useState(false);
  
  const sessionStartTimeRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dhIframeRef = useRef<any>(null);
  const commandIdRef = useRef<string>(`cmd-${Date.now()}`);

  // 构建 iframe URL
  const iframeUrl = React.useMemo(() => {
    if (!shouldConnect) return '';
    
    const params = new URLSearchParams({
      token: BAIDU_CONFIG.token,
      figureId: BAIDU_CONFIG.figureId,
      ttsPer: BAIDU_CONFIG.ttsPer,
      initMode: BAIDU_CONFIG.initMode,
      resolutionWidth: String(BAIDU_CONFIG.resolutionWidth),
      resolutionHeight: String(BAIDU_CONFIG.resolutionHeight),
      cameraId: String(BAIDU_CONFIG.cameraId),
      'cp-inactiveDisconnectSec': '180',
      'cp-preAlertSec': '10',
      mode: 'crop',
    });
    
    return `https://open.xiling.baidu.com/cloud/realtime?${params.toString()}`;
  }, [shouldConnect]);

  // 初始化 DHIframe
  useEffect(() => {
    if (typeof window !== 'undefined' && DHIframe && iframeRef.current && shouldConnect) {
      dhIframeRef.current = new DHIframe('digital-human-iframe');
      
      // 注册消息监听
      const onMessage = (msg: any) => {
        if (msg.origin === 'https://open.xiling.baidu.com') {
          const { type, content } = msg.data;
          const { action, requestId, code, body } = content;
          
          console.log('【数字人消息】', type, action, content);
          
          switch (type) {
            case 'rtcState':
              if (action === 'remoteVideoConnected') {
                console.log('✅ 数字人视频连接成功');
                setRealTimeVideoReady(true);
                setIsConnected(true);
                setIsLoading(false);
                sessionStartTimeRef.current = Date.now();
                onSessionStart?.();
              }
              if (action === 'localVideoMuted' && body) {
                console.log('🔇 数字人被静音');
                setIsMuted(true);
              }
              break;
              
            case 'wsState':
              if (content.readyState === ReadyState.OPEN) {
                console.log('✅ WebSocket 连接成功');
                setWsConnected(true);
              } else if (content.readyState === ReadyState.CLOSED || content.readyState === ReadyState.CLOSING) {
                console.log('❌ WebSocket 断开');
                setWsConnected(false);
              }
              break;
              
            case 'msg':
              // 驱动完成回调
              if (requestId === commandIdRef.current && action === 'FINISHED') {
                console.log('✅ 数字人播报完成');
                onSpeakComplete?.();
              }
              // 被打断
              else if (action === 'RENDER_INTERRUPTED') {
                console.log('⏹️ 数字人播报被打断');
                onSpeakComplete?.();
              }
              // 超时提醒
              else if (action === 'DISCONNECT_ALERT') {
                console.log('⚠️ 数字人即将超时');
                setShowTimeoutTip(true);
              }
              // 超时退出
              else if (action === 'TIMEOUT_EXIT') {
                console.log('⏰ 数字人超时退出');
                handleEndSession();
              }
              // 连接错误
              else if (code) {
                console.error('❌ 数字人错误:', code, body);
                setError(`连接错误: ${code}`);
                setIsLoading(false);
              }
              break;
              
            default:
              break;
          }
        }
      };
      
      dhIframeRef.current.registerMessageReceived(onMessage);
      
      return () => {
        dhIframeRef.current?.removeMessageReceived(onMessage);
      };
    }
  }, [shouldConnect, onSessionStart, onSpeakComplete]);

  // 监听 shouldConnect 变化 - 只有明确设置为 true 时才启动
  useEffect(() => {
    if (shouldConnect === true && !isConnected && !isLoading) {
      console.log('🚀 开始连接数字人...');
      setIsLoading(true);
      setError('');
    } else if (shouldConnect === false && isConnected) {
      console.log('👋 断开数字人连接');
      handleEndSession();
    }
  }, [shouldConnect, isConnected, isLoading, handleEndSession]);

  // 会话时长计时器
  useEffect(() => {
    if (isConnected) {
      sessionTimerRef.current = setInterval(() => {
        const elapsed = sessionStartTimeRef.current 
          ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
          : 0;
        setSessionTime(elapsed);
      }, 1000);
    }
    
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [isConnected]);

  // 结束会话
  const handleEndSession = useCallback(() => {
    console.log('【数字人】结束会话');
    
    const duration = sessionStartTimeRef.current 
      ? Date.now() - sessionStartTimeRef.current 
      : 0;
    
    // 清空 iframe
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
    
    setIsConnected(false);
    setRealTimeVideoReady(false);
    setWsConnected(false);
    setSessionTime(0);
    setShowTimeoutTip(false);
    sessionStartTimeRef.current = null;
    
    onSessionEnd?.(duration);
  }, [onSessionEnd]);

  // 取消静音并播放
  const handleUnmute = () => {
    if (dhIframeRef.current) {
      dhIframeRef.current.sendCommand({
        subType: 'muteAudio',
        subContent: false
      });
      setIsMuted(false);
    }
  };

  // 让数字人播报文本
  const speak = useCallback((text: string) => {
    if (!isConnected || !dhIframeRef.current || !realTimeVideoReady) {
      console.log('❌ 数字人未准备好，无法播报');
      return;
    }
    
    console.log('🎙️ 数字人播报:', text);
    
    // 生成新的 commandId
    commandIdRef.current = `cmd-${Date.now()}`;
    
    // 先取消静音
    dhIframeRef.current.sendCommand({
      subType: 'muteAudio',
      subContent: false
    });
    setIsMuted(false);
    
    // 发送文本
    dhIframeRef.current.sendMessage({
      action: 'TEXT_RENDER',
      body: text,
      requestId: commandIdRef.current
    }, ({ action }: { action: string }) => {
      console.log('📢 播报回调:', action);
    });
  }, [isConnected, realTimeVideoReady]);

  // 监听 textToSpeak 变化
  useEffect(() => {
    if (textToSpeak && isConnected && realTimeVideoReady) {
      speak(textToSpeak);
    }
  }, [textToSpeak, isConnected, realTimeVideoReady, speak]);

  // 打断数字人
  const handleInterrupt = () => {
    if (dhIframeRef.current) {
      dhIframeRef.current.sendMessage({
        action: 'TEXT_RENDER',
        body: '<interrupt></interrupt>',
        requestId: commandIdRef.current
      });
    }
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* 状态指示器 */}
      <div className="absolute -top-12 left-0 right-0 flex justify-center gap-2 z-20">
        <AnimatePresence>
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded-full text-sm"
            >
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              实时连接中
              <span className="font-mono">{formatTime(sessionTime)}</span>
            </motion.div>
          )}
          {showTimeoutTip && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 px-3 py-1 bg-yellow-500 text-white rounded-full text-sm"
            >
              ⚠️ 即将超时，请交互
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 取消静音提示 */}
      {isConnected && isMuted && realTimeVideoReady && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-24 left-0 right-0 flex justify-center z-20"
        >
          <button
            onClick={handleUnmute}
            className="px-4 py-2 bg-rose-500 text-white rounded-full text-sm hover:bg-rose-600 transition-colors"
          >
            🔇 点击开启声音
          </button>
        </motion.div>
      )}

      {/* 主容器 */}
      <div className="relative w-[280px] h-[380px] rounded-xl overflow-hidden shadow-2xl bg-stone-900">
        <AnimatePresence mode="wait">
          {shouldConnect && iframeUrl ? (
            <motion.div
              key="digital-human"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <iframe
                ref={iframeRef}
                id="digital-human-iframe"
                src={iframeUrl}
                className="w-full h-full border-0"
                style={{ 
                  objectFit: 'cover',
                  backgroundColor: 'transparent'
                }}
                allow="autoplay; microphone; camera"
                title="百度数字人"
              />
            </motion.div>
          ) : (
            <motion.div
              key="static-avatar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-100 to-orange-100 dark:from-stone-800 dark:to-stone-700"
            >
              <span className="text-8xl">{name === '小暖' ? '👩' : '👨'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 加载中遮罩 */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
            <span className="text-white text-sm">连接数字人...</span>
          </div>
        )}

        {/* 控制按钮 */}
        {isConnected && (
          <div className="absolute bottom-4 right-4 z-30 flex gap-2">
            {/* 静音按钮 */}
            <Button
              size="icon"
              variant="secondary"
              className="w-9 h-9 rounded-full shadow-lg bg-white/90 hover:bg-white"
              onClick={() => {
                if (isMuted) {
                  handleUnmute();
                } else {
                  dhIframeRef.current?.sendCommand({
                    subType: 'muteAudio',
                    subContent: true
                  });
                  setIsMuted(true);
                }
              }}
              title={isMuted ? "取消静音" : "静音"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            
            {/* 挂断按钮 */}
            <Button
              size="icon"
              variant="destructive"
              className="w-9 h-9 rounded-full shadow-lg hover:scale-110 transition-transform"
              onClick={handleEndSession}
              title="挂断连接"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* 状态文字 */}
      <motion.p
        className="mt-4 text-lg font-medium text-stone-600 dark:text-stone-300"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {!isConnected && isLoading ? '连接中...' : 
         isConnected && !realTimeVideoReady ? '加载数字人...' :
         isConnected && isMuted ? '点击开启声音' :
         isConnected && isSpeaking ? '正在说话...' : 
         isConnected && isListening ? '正在聆听...' : 
         error ? `错误: ${error}` : 
         ''}
      </motion.p>
    </div>
  );
}
