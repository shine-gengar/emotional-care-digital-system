'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraPreviewProps {
  isActive: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEndCall: () => void;
  isMicEnabled?: boolean;
  isCameraEnabled?: boolean;
  variant?: 'small' | 'large';
  audioLevel?: number; // 音频音量级别 (0-100)
}

export function CameraPreview({
  isActive,
  onToggleCamera,
  onToggleMic,
  onEndCall,
  isMicEnabled = true,
  isCameraEnabled = true,
  variant = 'small',
  audioLevel = 0,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    if (!isCameraEnabled) {
      // 如果摄像头被禁用，停止现有流
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 获取摄像头和麦克风权限
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: isMicEnabled,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('摄像头启动失败:', err);
      setError(
        err.name === 'NotAllowedError'
          ? '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头'
          : '无法启动摄像头: ' + err.message
      );
    } finally {
      setIsLoading(false);
    }
  }, [isCameraEnabled, isMicEnabled]);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    console.log('【摄像头】正在停止摄像头...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('【摄像头】轨道已停止:', track.kind);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    console.log('【摄像头】摄像头已完全停止');
  }, []);

  // 切换麦克风状态
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMicEnabled;
      });
    }
    onToggleMic();
  }, [isMicEnabled, onToggleMic]);

  // 组件挂载时启动摄像头
  useEffect(() => {
    if (isActive && isCameraEnabled) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, isCameraEnabled, startCamera, stopCamera]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="relative w-full h-full">
      {/* 摄像头预览窗口 */}
      <div className={`relative w-full h-full rounded-2xl overflow-hidden bg-stone-900 shadow-lg border-2 border-stone-700 ${
        variant === 'large' ? 'rounded-2xl' : ''
      }`}>
        {isCameraEnabled ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-900">
                <div className="w-8 h-8 border-2 border-stone-600 border-t-rose-500 rounded-full animate-spin" />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-900 p-2">
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-800">
            <CameraOff className="w-12 h-12 text-stone-600" />
          </div>
        )}

        {/* 麦克风状态指示 */}
        <div className="absolute top-2 right-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            isMicEnabled ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {isMicEnabled ? (
              <Mic className="w-3 h-3 text-white" />
            ) : (
              <MicOff className="w-3 h-3 text-white" />
            )}
          </div>
        </div>

        {/* 音频波形可视化 */}
        {isMicEnabled && audioLevel > 0 && (
          <div className="absolute bottom-2 left-2 flex items-end gap-1 h-8">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-green-400 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.min(100, Math.max(20, audioLevel * (0.5 + i * 0.2)))}%`,
                  opacity: audioLevel > 10 ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 控制按钮已移至外部统一控制栏 */}
    </div>
  );
}

export default CameraPreview;
