'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { RealtimeVoiceChat } from '@/components/avatar/RealtimeVoiceChat';
import { MessageList } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { EmotionDashboard } from '@/components/emotion/EmotionBadge';
import { useChatStore, useUserStore, useAuthStore, AVATAR_PRESETS } from '@/stores';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { Moon, Sun, Settings, User, History, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { chatApi } from '@/lib/api';

// 默认使用小暖
const DEFAULT_AVATAR = AVATAR_PRESETS[0]; // 小暖

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { profile, selectedAvatar, setSelectedAvatar, updatePreferences } = useUserStore();
  const { 
    messages, 
    currentEmotion, 
    isTyping, 
    sendMessage, 
    createNewSession,
    restoreCurrentSession,
    currentSessionId,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 检查登录状态，并在用户变化时清理聊天记录
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    // 检查是否是新用户登录（通过比较用户ID）
    const checkUserChange = () => {
      if (typeof window === 'undefined') return;
      
      const chatStorage = localStorage.getItem('chat-storage');
      if (chatStorage) {
        try {
          const chat = JSON.parse(chatStorage);
          const currentUserId = user?.id;
          const storedUserId = chat.state?._userId;
          
          // 如果用户ID不同，清除聊天记录
          if (currentUserId && storedUserId && storedUserId !== currentUserId) {
            console.log('用户变化，清除聊天记录');
            localStorage.removeItem('chat-storage');
            // 刷新页面以重新加载空状态
            window.location.reload();
          }
        } catch (e) {
          console.error('检查用户变化失败:', e);
        }
      }
    };
    
    checkUserChange();
  }, [isAuthenticated, user, router]);

  // 如果没有选择数字人，默认使用小暖
  useEffect(() => {
    if (!selectedAvatar) {
      setSelectedAvatar(DEFAULT_AVATAR);
    }
  }, [selectedAvatar, setSelectedAvatar]);

  // 初始化主题
  useEffect(() => {
    if (profile?.preferences?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile?.preferences?.theme]);

  // 页面加载时恢复当前会话的消息
  useEffect(() => {
    if (isAuthenticated && currentSessionId) {
      restoreCurrentSession();
    }
  }, [isAuthenticated, currentSessionId, restoreCurrentSession]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 使用语音输入 hook（用于文字输入区的麦克风）
  const {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
  } = useVoiceInput();

  // 处理发送消息
  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 使用默认数字人（小暖）如果没有选择
  const currentAvatar = selectedAvatar || DEFAULT_AVATAR;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-stone-50 to-orange-50/50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-700">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-200 to-orange-200 flex items-center justify-center">
              <span className="text-sm">{currentAvatar.name === '小暖' ? '👩' : '👨'}</span>
            </div>
            <div>
              <h1 className="font-semibold text-stone-800 dark:text-stone-100">{currentAvatar.name}</h1>
              <p className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                在线
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 新对话 */}
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white"
              onClick={() => {
                createNewSession();
                // 清除 localStorage 中的聊天记录，确保新对话完全清空
                if (typeof window !== 'undefined') {
                  const chatStorage = localStorage.getItem('chat-storage');
                  if (chatStorage) {
                    try {
                      const chat = JSON.parse(chatStorage);
                      // 保留其他状态，只清空消息
                      chat.state.messages = [];
                      chat.state.currentSessionId = null;
                      chat.state.lastAssistantMessage = null;
                      localStorage.setItem('chat-storage', JSON.stringify(chat));
                    } catch (e) {
                      console.error('清除聊天记录失败:', e);
                    }
                  }
                }
                router.refresh();
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">新对话</span>
            </Button>

            {/* 历史记录 */}
            <Link href="/history">
              <Button variant="ghost" size="sm" className="gap-2 rounded-full">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">历史记录</span>
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => {
                const newTheme = profile?.preferences?.theme === 'light' ? 'dark' : 'light';
                updatePreferences({ theme: newTheme });
                if (newTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }}
            >
              {profile?.preferences?.theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors">
                <Settings className="w-5 h-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-lg">
                <Link href="/history" className="flex items-center px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer">
                  <History className="w-4 h-4 mr-2" />
                  历史记录
                </Link>
                <Link href="/" className="flex items-center px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  切换角色
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[calc(100vh-3.5rem)]">
          {/* 左侧：实时语音视频通话 */}
          <div className="lg:col-span-1 p-4 lg:p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-stone-200 dark:border-stone-700">
            <RealtimeVoiceChat
              emotion={currentEmotion.type}
              name={currentAvatar.name}
              onSendMessage={async (text) => {
                // 发送到后端并获取 AI 回复
                const response = await chatApi.sendMessage(text, currentSessionId || undefined);
                const reply = response.message?.content || '抱歉，我没有听清楚。';
                return reply;
              }}
            />

            {/* 情绪仪表盘 */}
            <div className="w-full mt-6">
              <EmotionDashboard currentEmotion={currentEmotion.type} />
            </div>
          </div>

          {/* 右侧：对话区 */}
          <div className="lg:col-span-2 flex flex-col h-[calc(100vh-3.5rem)]">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto">
              <MessageList messages={messages} autoPlayVoice={false} />
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <ChatInput
              onSendMessage={handleSendMessage}
              onToggleRecording={handleToggleRecording}
              isRecording={isRecording}
              isLoading={isTyping}
              placeholder={`给 ${currentAvatar.name} 发消息...`}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
