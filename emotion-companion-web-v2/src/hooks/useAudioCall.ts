'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface AudioCallProps {
  isActive: boolean;
  onAudioStream?: (stream: MediaStream) => void;
}

export function useAudioCall({ isActive, onAudioStream }: AudioCallProps) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // 启动音频
  const startAudio = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
        video: false,
      });
      
      audioStreamRef.current = stream;
      setIsAudioEnabled(true);
      
      // 回调通知父组件
      if (onAudioStream) {
        onAudioStream(stream);
      }
      
      return stream;
    } catch (err: any) {
      console.error('启动音频失败:', err);
      setError(
        err.name === 'NotAllowedError'
          ? '麦克风权限被拒绝'
          : '无法启动音频: ' + err.message
      );
      return null;
    }
  }, [onAudioStream]);

  // 停止音频
  const stopAudio = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setIsAudioEnabled(false);
  }, []);

  // 切换静音
  const toggleMute = useCallback(() => {
    if (audioStreamRef.current) {
      const audioTracks = audioStreamRef.current.getAudioTracks();
      const newEnabled = !audioTracks[0]?.enabled;
      audioTracks.forEach(track => {
        track.enabled = newEnabled;
      });
      setIsAudioEnabled(newEnabled);
    }
  }, []);

  // 组件挂载/卸载时自动管理音频
  useEffect(() => {
    if (isActive) {
      startAudio();
    } else {
      stopAudio();
    }

    return () => {
      stopAudio();
    };
  }, [isActive, startAudio, stopAudio]);

  return {
    isAudioEnabled,
    error,
    startAudio,
    stopAudio,
    toggleMute,
    audioStream: audioStreamRef.current,
  };
}

export default useAudioCall;
