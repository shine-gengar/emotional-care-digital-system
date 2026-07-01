'use client';

import { useState, useCallback, useRef } from 'react';

// 百度智能云 TTS 配置
const BAIDU_TTS_URL = 'https://tsn.baidu.com/text2audio';

interface BaiduTTSOptions {
  /** 语速，取值 0-15，默认 5 */
  spd?: number;
  /** 音调，取值 0-15，默认 5 */
  pit?: number;
  /** 音量，取值 0-15，默认 5 */
  vol?: number;
  /** 发音人，默认度嫣然 CAP_4194 */
  per?: string;
  /** 音频编码，默认 mp3 */
  aue?: number;
}

interface UseBaiduTTSReturn {
  /** 播放语音 */
  speak: (text: string, options?: BaiduTTSOptions) => Promise<void>;
  /** 停止播放 */
  stop: () => void;
  /** 是否正在播放 */
  isSpeaking: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 百度智能云 TTS Hook
 * 
 * 使用百度智能云语音合成 API，默认使用度嫣然声音 (CAP_4194)
 * 文档: https://cloud.baidu.com/doc/SPEECH/s/Vk4wxhwf8
 * 
 * @example
 * ```tsx
 * const { speak, stop, isSpeaking } = useBaiduTTS();
 * 
 * // 播放文本
 * await speak('你好，我是度嫣然');
 * 
 * // 自定义参数
 * await speak('你好', { spd: 6, vol: 7 });
 * ```
 */
export function useBaiduTTS(): UseBaiduTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * 获取百度 TTS Token
   */
  const getToken = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/baidu-token');
      const data = await response.json();
      
      if (data.token) {
        return data.token;
      }
      
      console.error('获取 Token 失败:', data.error);
      return null;
    } catch (err) {
      console.error('获取 Token 异常:', err);
      return null;
    }
  };

  /**
   * 播放语音
   * 
   * @param text - 要合成的文本（UTF-8 编码，最大 1024 字节）
   * @param options - TTS 选项
   */
  const speak = useCallback(async (
    text: string, 
    options: BaiduTTSOptions = {}
  ): Promise<void> => {
    if (!text || typeof window === 'undefined') return;

    // 停止之前的播放
    stop();
    setError(null);

    try {
      setIsSpeaking(true);

      // 获取 Token
      const token = await getToken();
      if (!token) {
        throw new Error('无法获取百度 TTS Token');
      }

      // 构建参数
      const {
        spd = 5,      // 语速：正常
        pit = 5,      // 音调：正常
        vol = 7,      // 音量：稍大
        per = 'CAP_4194', // 度嫣然声音
        aue = 3,      // mp3 格式
      } = options;

      // 构建请求 URL
      const params = new URLSearchParams({
        tex: encodeURIComponent(text),
        tok: token,
        cuid: 'emotion-companion-web', // 用户唯一标识
        ctp: '1',      // 客户端类型：Web
        lan: 'zh',     // 语言：中文
        spd: String(spd),
        pit: String(pit),
        vol: String(vol),
        per: per,
        aue: String(aue),
      });

      const url = `${BAIDU_TTS_URL}?${params.toString()}`;

      console.log('百度 TTS 请求:', { text: text.substring(0, 50) + '...', per });

      // 创建音频元素
      const audio = new Audio(url);
      audioRef.current = audio;

      // 监听事件
      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
      };

      audio.onerror = (e) => {
        console.error('音频播放错误:', e);
        setError('音频播放失败');
        setIsSpeaking(false);
        audioRef.current = null;
      };

      // 播放
      await audio.play();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'TTS 失败';
      console.error('百度 TTS 错误:', err);
      setError(errorMsg);
      setIsSpeaking(false);
      
      // 失败时回退到浏览器 TTS
      fallbackSpeak(text);
    }
  }, []);

  /**
   * 浏览器 TTS 回退
   */
  const fallbackSpeak = (text: string) => {
    if (typeof window === 'undefined') return;
    
    console.log('回退到浏览器 TTS');
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    
    // 尝试找到中文女声
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => 
      v.lang.includes('zh') && (v.name.includes('Female') || v.name.includes('Xiaoxiao') || v.name.includes('Xiaoyi'))
    ) || voices.find(v => v.lang.includes('zh'));
    
    if (zhVoice) {
      utterance.voice = zhVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  /**
   * 停止播放
   */
  const stop = useCallback(() => {
    // 停止百度 TTS 音频
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    // 停止浏览器 TTS
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    error,
  };
}

export default useBaiduTTS;
