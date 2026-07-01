'use client';

import { useState, useCallback, useRef } from 'react';

// 百度语音识别配置
const BAIDU_ASR_CONFIG = {
  appId: '7532626',
  apiKey: 'RmfOzT130RvX8RKqAocUcJMB',
  // 注意：WebSocket 连接需要在后端进行，前端不能直接暴露 Secret Key
  // 这里使用后端代理
  wsUrl: '/api/baidu-asr', // 后端代理地址
  devPid: 15372, // 中文普通话（加强标点）
  sampleRate: 16000,
};

interface UseBaiduVoiceInputReturn {
  /** 是否正在录音 */
  isRecording: boolean;
  /** 识别到的文本 */
  transcript: string;
  /** 开始录音 */
  startRecording: () => Promise<void>;
  /** 停止录音 */
  stopRecording: () => void;
  /** 错误信息 */
  error: string | null;
  /** 是否支持语音识别 */
  isSupported: boolean;
}

/**
 * 百度语音识别 Hook
 * 
 * 使用百度实时语音识别 WebSocket API
 * 将用户语音实时转成文字
 * 
 * @example
 * ```tsx
 * const { isRecording, transcript, startRecording, stopRecording } = useBaiduVoiceInput();
 * 
 * // 开始录音
 * await startRecording();
 * 
 * // 停止录音，获取结果
 * stopRecording();
 * console.log(transcript);
 * ```
 */
export function useBaiduVoiceInput(): UseBaiduVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // 检查麦克风权限
  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: any) {
      console.error('麦克风权限失败:', err);
      if (err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
      } else {
        setError(`麦克风错误: ${err.message}`);
      }
      return false;
    }
  };

  // 开始录音
  const startRecording = useCallback(async () => {
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) return;

    try {
      setTranscript('');
      setError(null);
      audioChunksRef.current = [];

      // 获取音频流
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // 创建 MediaRecorder - 尝试使用支持的格式
      let mimeType = 'audio/webm;codecs=opus';
      
      // 检查浏览器支持的格式
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
        mimeType = 'audio/webm;codecs=pcm';
        console.log('使用 PCM 格式录音');
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
        console.log('使用 WebM 格式录音');
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        console.log('使用 MP4 格式录音');
      } else {
        console.log('使用默认格式录音');
        mimeType = '';
      }
      
      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      
      console.log('MediaRecorder 创建成功, mimeType:', mediaRecorder.mimeType);
      mediaRecorderRef.current = mediaRecorder;

      // 收集音频数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 录音停止时处理
      mediaRecorder.onstop = async () => {
        console.log('录音停止，处理音频...');
        
        // 检查是否有音频数据
        if (audioChunksRef.current.length === 0) {
          console.warn('没有收集到音频数据');
          setError('没有检测到语音，请靠近麦克风说话');
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // 检查音频大小
        if (audioBlob.size < 1000) {
          console.warn('音频数据太小:', audioBlob.size, 'bytes');
          setError('录音时间太短，请长按麦克风按钮说话');
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        // 发送到后端进行识别
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('appId', BAIDU_ASR_CONFIG.appId);
          formData.append('apiKey', BAIDU_ASR_CONFIG.apiKey);
          formData.append('devPid', String(BAIDU_ASR_CONFIG.devPid));

          console.log('发送音频数据:', audioBlob.size, 'bytes');
          
          const response = await fetch('/api/baidu-asr', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`识别请求失败: ${response.status}`);
          }

          const data = await response.json();
          console.log('识别结果:', data);
          
          if (data.result && data.result.length > 0) {
            setTranscript(data.result[0]);
          } else if (data.err_msg) {
            setError(`识别失败: ${data.err_msg}`);
            setTranscript('');
          } else {
            setTranscript('');
          }
        } catch (err: any) {
          console.error('识别失败:', err);
          setError('语音识别失败: ' + err.message);
        }

        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      // 开始录音
      mediaRecorder.start(100); // 每100ms收集一次数据
      setIsRecording(true);
      console.log('开始录音');

    } catch (err: any) {
      console.error('启动录音失败:', err);
      setError('启动录音失败: ' + err.message);
    }
  }, []);

  // 停止录音
  const stopRecording = useCallback(() => {
    console.log('停止录音');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        // 先请求数据，确保 ondataavailable 被触发
        mediaRecorderRef.current.requestData();
        // 延迟一点停止，确保数据被收集
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }, 100);
      } catch (err) {
        console.error('停止录音失败:', err);
        // 强制清理状态
        setIsRecording(false);
      }
    } else {
      // 如果 recorder 已经停止，确保状态也更新
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    error,
    isSupported,
  };
}

export default useBaiduVoiceInput;
