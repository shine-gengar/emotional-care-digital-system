export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  password: string;
  nickname: string;
  confirmPassword: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: EmotionType;
  timestamp: number;
}

export type EmotionType = 
  | 'neutral' 
  | 'happy' 
  | 'sad' 
  | 'anxious' 
  | 'angry' 
  | 'tired' 
  | 'excited';

export interface EmotionState {
  type: EmotionType;
  confidence: number;
  intensity: number;
}

export interface AvatarConfig {
  id: string;
  name: string;
  personality: string;
  avatarUrl: string;
  videoUrl?: string; // LivePortrait 生成的视频 URL
  voiceId?: string;
}

export interface ChatState {
  messages: Message[];
  currentEmotion: EmotionState;
  isTyping: boolean;
  isRecording: boolean;
}

export interface UserProfile {
  nickname: string;
  selectedAvatar: string;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}
