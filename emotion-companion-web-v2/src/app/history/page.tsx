'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChatStore, useUserStore, useAuthStore } from '@/stores';
import { EmotionBadge } from '@/components/emotion/EmotionBadge';
import { EmotionType, Message } from '@/types';
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  MessageSquare, 
  Trash2, 
  ChevronRight,
  Clock,
  Filter,
  Download,
  Loader2,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { chatApi } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 历史会话数据接口
interface ChatSession {
  id: string;
  date: string;
  title: string;
  messageCount: number;
  duration: string;
  emotions: EmotionType[];
  preview: string;
  messages?: Message[];
}

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { profile, selectedAvatar } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [filterEmotion, setFilterEmotion] = useState<EmotionType | 'all'>('all');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  // 检查登录状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // 加载历史会话列表
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const data = await chatApi.getHistory();
        
        // 转换后端数据为前端格式
        const formattedSessions: ChatSession[] = data.sessions.map((session: any) => ({
          id: session.id,
          date: new Date(session.createdAt).toLocaleDateString('zh-CN'),
          title: session.title,
          messageCount: session.messageCount,
          duration: formatDuration(new Date(session.createdAt), new Date(session.updatedAt)),
          emotions: extractEmotions(session.lastMessage?.emotion),
          preview: session.lastMessage?.content?.substring(0, 50) + '...' || '无消息预览',
        }));
        
        setSessions(formattedSessions);
      } catch (error) {
        console.error('加载历史记录失败:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      loadSessions();
    }
  }, [isAuthenticated]);

  // 加载选中会话的详细消息
  useEffect(() => {
    const loadSessionMessages = async () => {
      if (!selectedSession) {
        setSessionMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);
        const data = await chatApi.getSession(selectedSession.id);
        
        // 转换消息格式
        const messages: Message[] = data.session.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          emotion: msg.emotion as EmotionType,
          timestamp: new Date(msg.createdAt).getTime(),
        }));
        
        setSessionMessages(messages);
      } catch (error) {
        console.error('加载会话详情失败:', error);
        setSessionMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadSessionMessages();
  }, [selectedSession]);

  // 格式化时长
  const formatDuration = (start: Date, end: Date): string => {
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '1分钟';
    if (minutes > 60) return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
    return `${minutes}分钟`;
  };

  // 提取情绪标签
  const extractEmotions = (emotion: string | null): EmotionType[] => {
    if (!emotion) return ['neutral'];
    const emotions: EmotionType[] = [emotion as EmotionType];
    // 可以在这里添加更多情绪分析逻辑
    return emotions;
  };

  // 导出对话
  const handleExport = () => {
    if (!selectedSession || sessionMessages.length === 0) {
      alert('没有可导出的对话内容');
      return;
    }

    // 构建导出内容
    const exportData = {
      session: {
        id: selectedSession.id,
        title: selectedSession.title,
        date: selectedSession.date,
        duration: selectedSession.duration,
        messageCount: selectedSession.messageCount,
      },
      messages: sessionMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        emotion: msg.emotion,
        time: new Date(msg.timestamp).toLocaleString('zh-CN'),
      })),
    };

    // 创建并下载文件
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `对话记录_${selectedSession.title}_${selectedSession.date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 打开删除确认对话框
  const openDeleteDialog = () => {
    console.log('点击删除按钮，当前选中会话:', selectedSession);
    if (!selectedSession) {
      console.log('没有选中的会话，返回');
      return;
    }
    setSessionToDelete(selectedSession);
    setDeleteDialogOpen(true);
  };

  // 关闭删除确认对话框
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    console.log('开始删除会话:', sessionToDelete.id);
    try {
      // 调用后端删除 API
      await chatApi.deleteSession(sessionToDelete.id);
      console.log('后端删除成功');
      
      // 从本地列表中移除
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      if (selectedSession?.id === sessionToDelete.id) {
        setSelectedSession(null);
        setSessionMessages([]);
      }
      
      closeDeleteDialog();
      alert('对话已删除');
    } catch (error: any) {
      console.error('删除对话失败:', error);
      alert('删除失败: ' + (error.message || '请稍后重试'));
    }
  };

  // 导出全部对话
  const handleExportAll = () => {
    if (sessions.length === 0) {
      alert('没有可导出的对话记录');
      return;
    }

    // 构建导出内容
    const exportData = {
      exportDate: new Date().toLocaleString('zh-CN'),
      totalSessions: sessions.length,
      sessions: sessions.map(session => ({
        id: session.id,
        title: session.title,
        date: session.date,
        duration: session.duration,
        messageCount: session.messageCount,
        preview: session.preview,
      })),
    };

    // 创建并下载文件
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `全部对话记录_${new Date().toLocaleDateString('zh-CN')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 过滤会话
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = 
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.preview.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEmotion = 
      filterEmotion === 'all' || session.emotions.includes(filterEmotion);
    return matchesSearch && matchesEmotion;
  });

  // 使用 useEffect 处理重定向，避免在渲染时调用 router.push
  useEffect(() => {
    if (!profile || !selectedAvatar) {
      router.push('/');
    }
  }, [profile, selectedAvatar, router]);

  if (!profile || !selectedAvatar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-stone-50 to-orange-50/50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-stone-50 to-orange-50/50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载历史记录...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-stone-50 to-orange-50/50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-700">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => router.push('/chat')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-stone-800 dark:text-stone-100">历史记录</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={handleExportAll}
            >
              <Download className="w-4 h-4" />
              导出全部
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左侧：会话列表 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 搜索和筛选 */}
            <Card className="border-none shadow-lg bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm">
              <CardContent className="p-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    placeholder="搜索历史记录..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-4 h-4 text-stone-400" />
                  <Badge
                    variant={filterEmotion === 'all' ? 'default' : 'secondary'}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setFilterEmotion('all')}
                  >
                    全部
                  </Badge>
                  {(['happy', 'sad', 'anxious', 'angry'] as EmotionType[]).map((emotion) => (
                    <div
                      key={emotion}
                      className={`cursor-pointer hover:opacity-80 transition-opacity ${filterEmotion === emotion ? 'ring-2 ring-offset-1 ring-stone-400 rounded-full' : ''}`}
                      onClick={() => setFilterEmotion(emotion)}
                      title={`筛选${emotion === 'happy' ? '开心' : emotion === 'sad' ? '难过' : emotion === 'anxious' ? '焦虑' : '生气'}的情绪`}
                    >
                      <EmotionBadge
                        emotion={emotion}
                        size="sm"
                        showLabel={false}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 会话列表 */}
            <div className="space-y-3">
              {filteredSessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={`border-none shadow-md cursor-pointer transition-all duration-300 ${
                      selectedSession?.id === session.id
                        ? 'bg-rose-50 dark:bg-rose-900/20 ring-2 ring-rose-400'
                        : 'bg-white/80 dark:bg-stone-900/80 hover:shadow-lg'
                    }`}
                    onClick={() => setSelectedSession(session)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-200 to-orange-200 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-5 h-5 text-stone-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium truncate">{session.title}</h3>
                            <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                          </div>
                          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                            {session.preview}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {session.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {session.duration}
                            </span>
                            <span>{session.messageCount}条消息</span>
                          </div>
                          <div className="flex gap-1 mt-2">
                            {session.emotions.slice(0, 3).map((emotion, i) => (
                              <EmotionBadge key={i} emotion={emotion} size="sm" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 右侧：会话详情 */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedSession ? (
                <motion.div
                  key={selectedSession.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card className="border-none shadow-lg bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm h-[calc(100vh-8rem)]">
                    <CardHeader className="border-b border-stone-200 dark:border-stone-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{selectedSession.title}</CardTitle>
                          <p className="text-sm text-stone-500 mt-1">
                            {selectedSession.date} · {selectedSession.duration} · {selectedSession.messageCount}条消息
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full"
                            onClick={handleExport}
                            title="导出对话"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full text-red-500"
                            onClick={openDeleteDialog}
                            title="删除对话"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto h-[calc(100%-5rem)]">
                      <div className="p-4 space-y-4">
                        {loadingMessages ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
                          </div>
                        ) : sessionMessages.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-stone-400">
                            暂无消息记录
                          </div>
                        ) : (
                          sessionMessages.map((message, index) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex gap-3 ${
                              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                            }`}
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className={`text-xs ${
                                message.role === 'user'
                                  ? 'bg-stone-300'
                                  : 'bg-gradient-to-br from-rose-200 to-orange-200'
                              }`}>
                                {message.role === 'user' ? profile.nickname[0] : selectedAvatar.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`max-w-[70%] ${
                              message.role === 'user' ? 'items-end' : 'items-start'
                            } flex flex-col`}>
                              <div className={`px-4 py-2 rounded-2xl ${
                                message.role === 'user'
                                  ? 'bg-stone-800 text-white rounded-tr-sm'
                                  : 'bg-stone-100 dark:bg-stone-800 rounded-tl-sm'
                              }`}>
                                <p className="text-sm">{message.content}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {message.emotion && message.role === 'assistant' && (
                                  <EmotionBadge emotion={message.emotion} size="sm" />
                                )}
                                <span className="text-xs text-stone-400">
                                  {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-[calc(100vh-8rem)] flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-10 h-10 text-stone-400" />
                    </div>
                    <p className="text-stone-500 dark:text-stone-400">选择一个会话查看详情</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要删除对话"{sessionToDelete?.title}"吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
