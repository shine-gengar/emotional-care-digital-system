'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceInputReturn {
  /** 是否正在录音 */
  isRecording: boolean;
  /** 识别到的文本 */
  transcript: string;
  /** 开始录音 */
  startRecording: () => void;
  /** 停止录音 */
  stopRecording: () => void;
  /** 错误信息 */
  error: string | null;
  /** 是否支持语音识别 */
  isSupported: boolean;
}

/**
 * 语音输入 Hook
 * 
 * 使用浏览器 Web Speech API 进行语音识别
 * 将用户语音实时转成文字
 * 
 * @example
 * ```tsx
 * const { isRecording, transcript, startRecording, stopRecording } = useVoiceInput();
 * 
 * // 开始录音
 * startRecording();
 * 
 * // 停止录音，获取结果
 * stopRecording();
 * console.log(transcript);
 * ```
 */
export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const isRecordingRef = useRef(false);
  
  // 同步 isRecording 状态到 ref
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    // 检查浏览器是否支持语音识别
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    // 创建语音识别实例
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('语音识别开始');
      setIsRecording(true);
      setError(null);
      finalTranscriptRef.current = '';
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 累加最终结果
      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
      }

      // 显示当前识别内容（临时结果 + 最终结果）
      setTranscript(finalTranscriptRef.current + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('语音识别错误:', event.error);
      
      // 忽略 aborted 错误（用户主动停止）- 这个错误在使用 abort() 时会出现
      // 但我们现在使用 stop()，所以这个错误不应该出现
      if (event.error === 'aborted') {
        console.log('语音识别被主动停止（aborted）');
        // 不重置状态，让 onend 处理
        return;
      }
      
      switch (event.error) {
        case 'not-allowed':
          setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
          break;
        case 'no-speech':
          setError('没有检测到语音，请靠近麦克风说话');
          break;
        case 'network':
          // 网络错误通常是临时的，不显示错误，只停止录音
          console.warn('语音识别网络错误，可能是连接 Google 服务器失败');
          break;
        default:
          setError(`语音识别错误: ${event.error}`);
      }
      
      setIsRecording(false);
    };

    recognition.onend = () => {
      console.log('语音识别结束');
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  // 检查麦克风权限
  const checkMicrophonePermission = async () => {
    // 首先检查 mediaDevices 是否可用
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('navigator.mediaDevices 不可用');
      console.log('当前协议:', window.location.protocol);
      console.log('当前主机:', window.location.host);
      
      if (window.location.protocol !== 'https:' && window.location.host !== 'localhost:3000') {
        setError(
          '麦克风功能需要在安全环境中运行。\n\n' +
          '当前地址: ' + window.location.href + '\n\n' +
          '解决方法:\n' +
          '1. 确保使用 http://localhost:3000 访问\n' +
          '2. 或者使用 https 协议\n\n' +
          '如果正在使用 IP 地址访问（如 http://192.168.x.x），请改用 localhost'
        );
      } else {
        setError('浏览器不支持麦克风功能，请使用最新版 Chrome 或 Edge');
      }
      return false;
    }

    try {
      // 尝试获取麦克风流来确认权限
      console.log('正在请求麦克风权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // 立即释放
      console.log('✅ 麦克风权限获取成功');
      return true;
    } catch (err: any) {
      console.error('❌ 麦克风权限失败:', err.name, err.message);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError(
          '麦克风权限被拒绝。\n\n' +
          '【Edge 浏览器解决方法】\n' +
          '1. 点击地址栏左侧的 🔒 图标（或 ⚠️ 图标）\n' +
          '2. 点击"此网站的权限"\n' +
          '3. 找到"麦克风"，选择"允许"\n' +
          '4. 按 F5 刷新页面\n\n' +
          '如果找不到，请按 Ctrl+Shift+Delete 清除缓存后重试'
        );
      } else if (err.name === 'NotFoundError') {
        setError('未找到麦克风设备，请检查：\n1. 麦克风是否插好\n2. 是否被其他应用占用\n3. 在系统设置中检查麦克风');
      } else {
        setError(`麦克风错误: ${err.name}\n${err.message}`);
      }
      return false;
    }
  };

  const startRecording = useCallback(async () => {
    if (!recognitionRef.current) {
      setError('语音识别未初始化');
      return;
    }

    // 检查 recognition 的实际状态，避免重复启动
    try {
      const state = (recognitionRef.current as any).state;
      console.log('当前 recognition 状态:', state);
      
      if (state === 'recording' || state === 'starting') {
        console.log('已经在录音中，跳过启动');
        return;
      }
    } catch (e) {
      // 如果无法获取状态，使用 ref 作为备选
      if (isRecordingRef.current) {
        console.log('已经在录音中(ref)，跳过启动');
        return;
      }
    }

    // 先检查麦克风权限
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) {
      return;
    }

    try {
      setTranscript('');
      finalTranscriptRef.current = '';
      setError(null);
      console.log('开始语音识别...');
      
      // 立即启动，不要延迟
      if (recognitionRef.current) {
        try {
          // 检查是否已经在运行中，避免 InvalidStateError
          const state = (recognitionRef.current as any).state;
          if (state === 'running') {
            console.log('语音识别已经在运行中，跳过启动');
            setIsRecording(true);
          } else {
            try {
              recognitionRef.current.start();
              setIsRecording(true);
            } catch (startErr: any) {
              if (startErr.name === 'InvalidStateError') {
                console.log('语音识别启动时检测到已在运行');
                setIsRecording(true);
              } else {
                throw startErr;
              }
            }
          }
        } catch (err: any) {
          console.error('启动录音失败:', err);
          if (err.name === 'InvalidStateError') {
            console.log('语音识别已经在运行中');
            setIsRecording(true);
          } else if (err.name === 'NotAllowedError') {
            setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
          } else {
            setError('启动录音失败: ' + err.message);
          }
        }
      }
    } catch (err: any) {
      console.error('启动录音失败:', err);
      if (err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
      } else {
        setError('启动录音失败: ' + err.message);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) {
      console.log('recognition 不存在，直接设置状态');
      setIsRecording(false);
      isRecordingRef.current = false;
      return;
    }

    // 检查 recognition 的实际状态，而不是依赖 ref
    // 这样可以避免在快速点击时出现的状态不同步问题
    try {
      const state = (recognitionRef.current as any).state;
      console.log('当前 recognition 状态:', state);
      
      // 如果已经不在录音中（state 不是 'recording' 或 'starting'），直接返回
      if (state !== 'recording' && state !== 'starting') {
        console.log('已经不在录音中，跳过停止');
        // 确保状态一致
        if (isRecordingRef.current) {
          isRecordingRef.current = false;
          setIsRecording(false);
        }
        return;
      }
    } catch (e) {
      // 如果无法获取状态，继续尝试停止
      console.log('无法获取 recognition 状态，继续停止');
    }

    try {
      console.log('正在停止录音...');
      // 先立即更新 ref，防止重复点击
      isRecordingRef.current = false;
      // 使用 stop() 等待最终结果
      recognitionRef.current.stop();
      console.log('录音停止命令已发送');
    } catch (err: any) {
      console.error('停止录音失败:', err);
      // 如果是 InvalidStateError（已经停止），忽略错误并同步状态
      if (err.name === 'InvalidStateError') {
        console.log('语音识别已经停止');
        setIsRecording(false);
      }
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

export default useVoiceInput;
