'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// SiliconFlow TTS 配置
const SILICONFLOW_API_KEY = process.env.NEXT_PUBLIC_SILICONFLOW_API_KEY || 'sk-your-siliconflow-api-key-here';
const SILICONFLOW_TTS_URL = 'https://api.siliconflow.cn/v1/audio/speech';

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 加载语音列表
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
        console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang })));
      }
    };

    // 直接尝试加载
    loadVoices();
    
    // 监听语音加载事件
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // 浏览器 TTS 回退
  const fallbackSpeak = (text: string) => {
    if (typeof window === 'undefined') return;
    
    console.log('Using browser TTS fallback');
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
      console.log('Using voice:', zhVoice.name);
    } else {
      console.log('No Chinese voice found, using default');
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  // 播放语音（SiliconFlow TTS）
  const speak = useCallback(async (text: string) => {
    if (!text || typeof window === 'undefined') return;

    // 先停止之前的播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    try {
      setIsSpeaking(true);

      console.log('Using SiliconFlow TTS API (CosyVoice2-0.5B with diana voice)');
      // 调用 SiliconFlow TTS API
      // 使用 FunAudioLLM/CosyVoice2-0.5B 模型，diana 音色（欢快女声）
      const response = await fetch(SILICONFLOW_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'FunAudioLLM/CosyVoice2-0.5B',
          input: text,
          voice: 'FunAudioLLM/CosyVoice2-0.5B:diana', // 系统预置音色：欢快女声
          response_format: 'mp3',
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        console.warn('SiliconFlow TTS API failed, falling back to browser TTS');
        // 直接回退到浏览器 TTS，不抛出错误
        fallbackSpeak(text);
        return;
      }

      // 获取音频 blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // 播放音频
      const newAudio = new Audio(audioUrl);
      audioRef.current = newAudio;
      
      newAudio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };
      newAudio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsSpeaking(false);
        setIsPaused(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        // 出错时回退到浏览器 TTS
        fallbackSpeak(text);
      };
      newAudio.onpause = () => {
        setIsPaused(true);
      };
      newAudio.onplay = () => {
        setIsPaused(false);
      };
      
      // 确保音频可以播放
      newAudio.oncanplay = () => {
        console.log('Audio can play');
      };

      await newAudio.play().catch(err => {
        console.error('Play error:', err);
        setIsSpeaking(false);
        fallbackSpeak(text);
      });
    } catch (error) {
      console.error('TTS error:', error);
      // 出错时回退到浏览器 TTS
      fallbackSpeak(text);
    }
  }, []);

  // 停止播放
  const stop = useCallback(() => {
    console.log('Stopping audio, current audio ref:', !!audioRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  // 暂停播放
  const pause = useCallback(() => {
    console.log('Pausing audio');
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (typeof window !== 'undefined') {
      window.speechSynthesis.pause();
    }
    setIsPaused(true);
  }, []);

  // 恢复播放
  const resume = useCallback(() => {
    console.log('Resuming audio');
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error('Resume play error:', err);
      });
    }
    if (typeof window !== 'undefined') {
      window.speechSynthesis.resume();
    }
    setIsPaused(false);
  }, []);

  return { speak, stop, pause, resume, isSpeaking, isPaused, voicesLoaded };
}
