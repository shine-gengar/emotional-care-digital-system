/**
 * 百度智能云数字人 API 封装
 * 文档: https://cloud.baidu.com/doc/AI_DH/index.html
 */

const BAIDU_API_BASE = 'https://aip.baidubce.com';
const XILING_API_BASE = 'https://xiling.cloud.baidu.com';

interface BaiduAuthConfig {
  appId: string;
  apiKey: string;
  secretKey: string;
}

interface VideoSynthesisParams {
  text?: string;           // 合成文本（与 url 二选一）
  url?: string;            // 音频 URL（与 text 二选一）
  figureId: string;        // 数字人形象 ID
  width?: number;          // 视频宽度
  height?: number;         // 视频高度
  format?: 'mp4' | 'webm'; // 视频格式
}

interface VideoSynthesisResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  errorMsg?: string;
}

class BaiduDigitalHumanAPI {
  private config: BaiduAuthConfig;
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(config: BaiduAuthConfig) {
    this.config = config;
  }

  /**
   * 获取 Access Token
   */
  async getAccessToken(): Promise<string> {
    // 如果 token 未过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    const url = `${BAIDU_API_BASE}/oauth/2.0/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.apiKey,
      client_secret: this.config.secretKey,
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取 Token 失败: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // token 有效期通常为 30 天，这里设置 29 天后过期
    this.tokenExpireTime = Date.now() + (data.expires_in - 86400) * 1000;
    
    return this.accessToken!;
  }

  /**
   * 提交视频合成任务
   */
  async submitVideoTask(params: VideoSynthesisParams): Promise<string> {
    const token = await this.getAccessToken();
    
    // 注意：实际 API 路径需要根据官方文档确认
    const url = `${XILING_API_BASE}/v1/digitalhuman/video/synthesis`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        appId: this.config.appId,
        figureId: params.figureId,
        text: params.text,
        url: params.url,
        width: params.width || 512,
        height: params.height || 512,
        format: params.format || 'mp4',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`提交任务失败: ${error}`);
    }

    const data = await response.json();
    return data.taskId;
  }

  /**
   * 查询任务状态
   */
  async queryTaskStatus(taskId: string): Promise<VideoSynthesisResponse> {
    const token = await this.getAccessToken();
    
    const url = `${XILING_API_BASE}/v1/digitalhuman/video/query`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        appId: this.config.appId,
        taskId,
      }),
    });

    if (!response.ok) {
      throw new Error(`查询任务失败: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 轮询等待任务完成
   */
  async waitForTaskCompletion(
    taskId: string,
    options: { interval?: number; timeout?: number } = {}
  ): Promise<string> {
    const { interval = 2000, timeout = 120000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.queryTaskStatus(taskId);
      
      if (result.status === 'completed' && result.videoUrl) {
        return result.videoUrl;
      }
      
      if (result.status === 'failed') {
        throw new Error(`任务失败: ${result.errorMsg || '未知错误'}`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('任务超时');
  }

  /**
   * 同步生成视频（提交任务并等待完成）
   */
  async generateVideo(params: VideoSynthesisParams): Promise<string> {
    const taskId = await this.submitVideoTask(params);
    return await this.waitForTaskCompletion(taskId);
  }
}

// 导出单例实例（需要在初始化时传入配置）
let baiduAPI: BaiduDigitalHumanAPI | null = null;

export function initBaiduDigitalHuman(config: BaiduAuthConfig) {
  baiduAPI = new BaiduDigitalHumanAPI(config);
  return baiduAPI;
}

export function getBaiduDigitalHumanAPI(): BaiduDigitalHumanAPI {
  if (!baiduAPI) {
    throw new Error('请先调用 initBaiduDigitalHuman 初始化');
  }
  return baiduAPI;
}

export type {
  BaiduAuthConfig,
  VideoSynthesisParams,
  VideoSynthesisResponse,
};
