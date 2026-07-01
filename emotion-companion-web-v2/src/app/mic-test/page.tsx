'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 麦克风权限检测页面
 * 
 * 用于调试麦克风权限问题
 */
export default function MicTestPage() {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    // 检查浏览器支持
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    // 检查权限状态
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      // 方法1: 使用 Permissions API
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('权限状态:', result.state);
        setPermissionStatus(result.state as any);
        
        // 监听权限变化
        result.onchange = () => {
          console.log('权限状态变化:', result.state);
          setPermissionStatus(result.state as any);
        };
      } else {
        setPermissionStatus('unknown');
      }
    } catch (err) {
      console.error('检查权限失败:', err);
      setPermissionStatus('unknown');
    }
  };

  const requestPermission = async () => {
    setError('');
    try {
      console.log('请求麦克风权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('权限获取成功');
      stream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
      setError('');
    } catch (err: any) {
      console.error('权限请求失败:', err);
      setPermissionStatus('denied');
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('权限被拒绝。请按以下步骤操作：\n\n1. 点击地址栏左侧的 🔒 图标\n2. 找到"麦克风"选项\n3. 选择"允许"\n4. 刷新页面');
      } else if (err.name === 'NotFoundError') {
        setError('未找到麦克风设备，请检查麦克风是否连接');
      } else {
        setError(`错误: ${err.name} - ${err.message}`);
      }
    }
  };

  const testRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log('录音开始');
      setIsRecording(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onerror = (event: any) => {
      console.error('录音错误:', event.error);
      setError('录音错误: ' + event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      console.log('录音结束');
      setIsRecording(false);
    };

    recognition.start();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">🎤 麦克风权限检测</h1>

        {/* 浏览器支持状态 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">浏览器支持</h2>
          <div className="flex items-center gap-3">
            {isSupported ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="text-green-600">支持语音识别</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="text-red-600">不支持语音识别，请使用 Chrome 或 Edge</span>
              </>
            )}
          </div>
        </div>

        {/* 权限状态 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">麦克风权限状态</h2>
          <div className="flex items-center gap-3 mb-4">
            {permissionStatus === 'granted' && (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="text-green-600">已授权 ✅</span>
              </>
            )}
            {permissionStatus === 'denied' && (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="text-red-600">被拒绝 ❌</span>
              </>
            )}
            {permissionStatus === 'prompt' && (
              <>
                <AlertCircle className="w-6 h-6 text-yellow-500" />
                <span className="text-yellow-600">等待授权 ⏳</span>
              </>
            )}
            {permissionStatus === 'unknown' && (
              <>
                <AlertCircle className="w-6 h-6 text-gray-500" />
                <span className="text-gray-600">未知状态 ❓</span>
              </>
            )}
          </div>

          <Button 
            onClick={requestPermission}
            className="w-full"
            variant={permissionStatus === 'granted' ? 'outline' : 'default'}
          >
            {permissionStatus === 'granted' ? '重新检测权限' : '请求麦克风权限'}
          </Button>
        </div>

        {/* 测试录音 */}
        {permissionStatus === 'granted' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">测试录音</h2>
            <Button 
              onClick={testRecording}
              disabled={isRecording}
              className={`w-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  录音中... (点击停止)
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  开始录音测试
                </>
              )}
            </Button>
            
            {transcript && (
              <div className="mt-4 p-4 bg-stone-100 rounded-lg">
                <p className="text-sm text-stone-600">识别结果：</p>
                <p className="text-lg">{transcript}</p>
              </div>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-600 mb-2">错误信息</h2>
            <pre className="whitespace-pre-wrap text-red-600 text-sm">{error}</pre>
          </div>
        )}

        {/* 解决步骤 */}
        {permissionStatus === 'denied' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-yellow-700 mb-4">解决步骤</h2>
            <ol className="list-decimal list-inside space-y-2 text-yellow-800">
              <li>点击地址栏左侧的 <strong>🔒</strong> 图标</li>
              <li>找到 <strong>"麦克风"</strong> 或 <strong>"网站设置"</strong></li>
              <li>将麦克风权限改为 <strong>"允许"</strong></li>
              <li>刷新页面（按 F5）</li>
            </ol>
            <p className="mt-4 text-sm text-yellow-600">
              💡 如果找不到设置，可以尝试：
              <br />
              Chrome: 设置 → 隐私和安全 → 网站设置 → 麦克风
            </p>
          </div>
        )}

        {/* 返回聊天 */}
        <div className="text-center mt-8">
          <a href="/chat" className="text-blue-500 hover:underline">
            ← 返回聊天页面
          </a>
        </div>
      </div>
    </div>
  );
}
