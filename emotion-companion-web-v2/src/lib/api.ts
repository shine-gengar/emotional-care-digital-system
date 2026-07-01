// API 基础配置
// 直接连接后端服务
const API_BASE_URL = 'http://localhost:3001';

// 通用请求函数
async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log('API 请求:', url, options.method || 'GET');
  
  // 获取 token
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('auth-storage')
      ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token
      : null
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();
    console.log('API 响应:', url, response.status, data);

    // 即使状态码不是 2xx，如果有数据返回也交给上层处理
    if (!response.ok && !data.message) {
      throw new Error(data.error || `请求失败: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error('API 错误:', url, error.message);
    // 如果是网络错误，返回一个可重试的错误对象
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('网络连接失败，请检查网络或稍后重试');
    }
    throw error;
  }
}

// 认证相关 API
export const authApi = {
  login: (username: string, password: string) =>
    fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string, nickname?: string) =>
    fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname }),
    }),
};

// 聊天相关 API
export const chatApi = {
  sendMessage: (content: string, sessionId?: string) =>
    fetchApi('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ content, sessionId }),
    }),

  getHistory: (page = 1, limit = 20) =>
    fetchApi(`/api/chat/history?page=${page}&limit=${limit}`),

  getSession: (sessionId: string) =>
    fetchApi(`/api/chat/session/${sessionId}`),

  deleteSession: (sessionId: string) =>
    fetchApi(`/api/chat/session/${sessionId}`, {
      method: 'DELETE',
    }),
};

export { fetchApi };
