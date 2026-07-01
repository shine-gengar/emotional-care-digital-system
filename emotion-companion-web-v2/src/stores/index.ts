import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, chatApi } from '@/lib/api';
import { 
  Message, 
  EmotionState, 
  UserProfile, 
  AvatarConfig, 
  User
} from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthStore extends AuthState {
  login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  register: (credentials: { username: string; password: string; confirmPassword: string; nickname?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (credentials) => {
        try {
          console.log('store login 调用:', credentials.username);
          const data = await authApi.login(credentials.username, credentials.password);
          
          console.log('store login 成功:', data);
          
          // 检查是否是不同用户登录
          const currentUser = get().user;
          if (currentUser && currentUser.id !== data.user.id) {
            // 不同用户，清除聊天记录
            if (typeof window !== 'undefined') {
              localStorage.removeItem('chat-storage');
            }
          }
          
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
          });
          
          return { success: true };
        } catch (error: any) {
          console.error('store login 失败:', error);
          return { success: false, error: error.message || '登录失败' };
        }
      },

      register: async (credentials) => {
        try {
          // 验证密码
          if (credentials.password !== credentials.confirmPassword) {
            return { success: false, error: '两次输入的密码不一致' };
          }

          if (credentials.password.length < 6) {
            return { success: false, error: '密码长度至少为6位' };
          }

          const data = await authApi.register(
            credentials.username,
            credentials.password,
            credentials.nickname
          );

          // 新用户注册，清除之前的聊天记录
          if (typeof window !== 'undefined') {
            localStorage.removeItem('chat-storage');
          }

          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
          });

          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message || '注册失败' };
        }
      },

      logout: () => {
        // 先清除聊天记录
        if (typeof window !== 'undefined') {
          localStorage.removeItem('chat-storage');
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        // 清除 localStorage 中的认证数据
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
        }
      },
    }),
    {
      name: 'auth-storage',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // 从旧版本迁移
          return persistedState;
        }
        return persistedState;
      },
    }
  )
);

interface ChatStore {
  messages: Message[];
  currentEmotion: EmotionState;
  isTyping: boolean;
  isRecording: boolean;
  currentSessionId: string | null;
  sessions: any[];
  lastAssistantMessage: Message | null;
  sendMessage: (content: string) => Promise<void>;
  setEmotion: (emotion: EmotionState) => void;
  setTyping: (typing: boolean) => void;
  setRecording: (recording: boolean) => void;
  clearMessages: () => void;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => void;
  saveCurrentSession: () => Promise<void>;
  restoreCurrentSession: () => Promise<void>;
}

// 获取当前用户ID（用于区分不同用户的聊天记录）
const getCurrentUserId = () => {
  if (typeof window === 'undefined') return null;
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const auth = JSON.parse(authStorage);
      return auth.state?.user?.id || null;
    } catch {
      return null;
    }
  }
  return null;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      currentEmotion: { type: 'neutral', confidence: 1, intensity: 0.5 },
      isTyping: false,
      isRecording: false,
      currentSessionId: null,
      sessions: [],
      lastAssistantMessage: null,
      // 当前用户ID，用于区分不同用户的数据
      _userId: null as string | null,

      sendMessage: async (content: string) => {
        const { currentSessionId, isTyping, setTyping } = get();
        
        // 防止重复发送：如果正在输入中，不处理新消息
        if (isTyping) {
          console.log('正在处理中，忽略重复请求');
          return;
        }
        
        // 添加用户消息到本地（立即显示）
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content,
          timestamp: Date.now(),
        };
        
        set((state) => ({
          messages: [...state.messages, userMessage],
        }));

        setTyping(true);

        try {
          // 调用后端 API，使用最新的 currentSessionId
          const latestSessionId = get().currentSessionId;
          console.log('发送消息，当前会话ID:', latestSessionId);
          const data = await chatApi.sendMessage(content, latestSessionId || undefined);

          // 检查是否有错误响应但包含数据（模拟模式）
          if (data.error && !data.message) {
            throw new Error(data.error);
          }

          // 更新会话 ID（只有在新会话时才更新）
          if (data.sessionId && !get().currentSessionId) {
            console.log('创建新会话，ID:', data.sessionId);
            set({ currentSessionId: data.sessionId });
          } else if (data.sessionId && get().currentSessionId && data.sessionId !== get().currentSessionId) {
            console.warn('会话ID不匹配，可能创建了重复会话');
          }

          // 更新用户情绪
          if (data.userEmotion) {
            console.log('【Store】更新用户情绪:', data.userEmotion);
            set({
              currentEmotion: {
                type: data.userEmotion,
                confidence: 0.8,
                intensity: 0.7,
              },
            });
          } else {
            console.log('【Store】后端未返回 userEmotion');
          }

          // 添加 AI 回复
          const aiMessage: Message = {
            id: data.message?.id || Date.now().toString(),
            role: 'assistant',
            content: data.message?.content || '我在听，请继续说...',
            emotion: data.message?.emotion || 'neutral',
            timestamp: Date.now(),
          };

          set((state) => ({
            messages: [...state.messages, aiMessage],
            lastAssistantMessage: aiMessage,
          }));
        } catch (error: any) {
          console.error('发送消息失败:', error);
          // 添加错误提示消息，但保持对话可以继续
          const errorMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: '抱歉，我遇到了一点问题，但我们可以继续聊。你想说点什么？',
            emotion: 'neutral',
            timestamp: Date.now(),
          };
          set((state) => ({
            messages: [...state.messages, errorMessage],
          }));
        } finally {
          // 确保在任何情况下都重置 isTyping 状态
          setTyping(false);
        }
      },

      setEmotion: (emotion) => set({ currentEmotion: emotion }),
      setTyping: (typing) => set({ isTyping: typing }),
      setRecording: (recording) => set({ isRecording: recording }),
      clearMessages: () => set({ messages: [], currentSessionId: null }),

      loadSessions: async () => {
        try {
          const data = await chatApi.getHistory();
          set({ sessions: data.sessions });
        } catch (error) {
          console.error('加载历史记录失败:', error);
        }
      },

      loadSession: async (sessionId: string) => {
        try {
          const data = await chatApi.getSession(sessionId);
          set({ 
            currentSessionId: sessionId,
            messages: data.session.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              emotion: msg.emotion,
              timestamp: new Date(msg.createdAt).getTime(),
            })),
          });
        } catch (error) {
          console.error('加载会话失败:', error);
        }
      },

      createNewSession: () => {
        // 完全清空当前会话状态，不保留任何消息
        set({ 
          currentSessionId: null,
          messages: [],
          lastAssistantMessage: null,
          currentEmotion: { type: 'neutral', confidence: 1, intensity: 0.5 },
        });
      },

      // 保存当前会话（用于页面刷新前自动保存）
      saveCurrentSession: async () => {
        const { currentSessionId, messages } = get();
        // 如果有消息但没有sessionId，说明需要创建会话
        if (messages.length > 0 && !currentSessionId) {
          console.log('自动保存当前会话...');
          // 发送一个隐藏消息来创建会话，或者调用专门的API
          // 这里简化处理：下次发送消息时会自动创建
        }
      },

      // 恢复当前会话（页面加载时调用）
      restoreCurrentSession: async () => {
        const { currentSessionId } = get();
        if (currentSessionId) {
          console.log('恢复当前会话:', currentSessionId);
          try {
            const data = await chatApi.getSession(currentSessionId);
            set({ 
              messages: data.session.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                emotion: msg.emotion,
                timestamp: new Date(msg.createdAt).getTime(),
              })),
            });
          } catch (error) {
            console.error('恢复会话失败:', error);
            // 如果会话不存在，清空sessionId
            set({ currentSessionId: null });
          }
        }
      },
    }),
    {
      name: 'chat-storage',
      version: 2, // 增加版本号，触发迁移
      migrate: (persistedState: any, version: number) => {
        // 版本升级时清除旧数据
        if (version < 2) {
          return {
            messages: [],
            currentEmotion: { type: 'neutral', confidence: 1, intensity: 0.5 },
            isTyping: false,
            isRecording: false,
            currentSessionId: null,
            sessions: [],
            lastAssistantMessage: null,
            _userId: null,
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        ...state,
        isTyping: false, // 不持久化 isTyping 状态
        isRecording: false, // 不持久化 isRecording 状态
      }),
      // 在存储前检查用户是否变化
      onRehydrateStorage: () => (state) => {
        if (state) {
          const currentUserId = getCurrentUserId();
          // 如果用户变化了，清空聊天记录
          if (currentUserId && state._userId && state._userId !== currentUserId) {
            state.messages = [];
            state.currentSessionId = null;
            state.lastAssistantMessage = null;
          }
          // 更新当前用户ID
          state._userId = currentUserId;
        }
      },
    }
  )
);

interface UserStore {
  profile: UserProfile | null;
  selectedAvatar: AvatarConfig | null;
  setProfile: (profile: UserProfile) => void;
  setSelectedAvatar: (avatar: AvatarConfig) => void;
  updatePreferences: (preferences: Partial<UserProfile['preferences']>) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      profile: null,
      selectedAvatar: null,
      setProfile: (profile) => set({ profile }),
      setSelectedAvatar: (avatar) => set({ selectedAvatar: avatar }),
      updatePreferences: (preferences) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, preferences: { ...state.profile.preferences, ...preferences } }
            : null,
        })),
    }),
    {
      name: 'user-storage',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          return persistedState;
        }
        return persistedState;
      },
    }
  )
);

/**
 * 清除所有应用缓存
 * 用于解决浏览器数据不一致问题
 */
export function clearAllStorage() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('chat-storage');
    localStorage.removeItem('user-storage');
    console.log('所有缓存已清除');
  }
}

// 预设的数字人配置
export const AVATAR_PRESETS: AvatarConfig[] = [
  {
    id: 'xiaonuan',
    name: '小暖',
    personality: '温柔体贴，善于倾听，像一位知心姐姐',
    avatarUrl: '/avatars/xiaonuan.png',
    // 使用 LivePortrait 生成的视频（需要自行准备）
    // videoUrl: '/videos/xiaonuan-talking.mp4',
    voiceId: 'xiaonuan-voice',
  },
  {
    id: 'xiaonan',
    name: '小安',
    personality: '理性沉稳，善于分析，像一位心理咨询师',
    avatarUrl: '/avatars/xiaonan.png',
    // 使用 LivePortrait 生成的视频（需要自行准备）
    // videoUrl: '/videos/xiaonan-talking.mp4',
    voiceId: 'xiaonan-voice',
  },
];

// 示例：如何配置 LivePortrait 视频头像
// 1. 使用 D-ID、HeyGen 或 LivePortrait 在线服务生成视频
// 2. 将视频放入 public/videos/ 目录
// 3. 在上方配置中取消注释 videoUrl 并设置正确路径
// 详细指南见 LIVEPORTRAIT_GUIDE.md
