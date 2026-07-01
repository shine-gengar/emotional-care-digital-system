/**
 * 情感陪护系统 - 优化的摄像头情绪识别模块 v2.0
 * 使用本地Python API实现实时表情分析
 * 
 * 改进点：
 * 1. 使用本地Python情绪分析API（更准确）
 * 2. 添加时序平滑减少抖动
 * 3. 添加置信度阈值
 * 4. 更好的情绪变化检测
 * 5. 性能优化
 */

class EmotionAnalyzer {
  constructor(config = {}) {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.isRunning = false;
    this.currentEmotion = 'neutral';
    this.emotionConfidence = 0;
    this.emotionHistory = [];
    this.maxHistory = 8;
    
    // 配置
    this.config = {
      apiUrl: config.apiUrl || 'http://localhost:5000/detect',
      detectInterval: config.detectInterval || 300, // 检测间隔(ms)
      confidenceThreshold: config.confidenceThreshold || 40, // 置信度阈值(%)
      smoothingWindow: config.smoothingWindow || 3, // 平滑窗口大小
      enableDebug: config.enableDebug || false,
      ...config
    };
    
    // 表情到心理状态的映射
    this.emotionToPsychology = {
      'happy': { state: '愉悦', strategy: '积极回应', intensity: 0, color: '#FFD700' },
      'sad': { state: '低落', strategy: '温柔安慰', intensity: 0, color: '#4169E1' },
      'angry': { state: '愤怒', strategy: '冷静倾听', intensity: 0, color: '#DC143C' },
      'scared': { state: '焦虑', strategy: '安抚陪伴', intensity: 0, color: '#FF8C00' },
      'disgust': { state: '厌恶', strategy: '转移话题', intensity: 0, color: '#8B4513' },
      'surprised': { state: '惊讶', strategy: '解释说明', intensity: 0, color: '#9932CC' },
      'neutral': { state: '平静', strategy: '正常对话', intensity: 0, color: '#808080' }
    };
    
    // 情绪变化阈值
    this.changeThreshold = 15; // 百分比变化阈值
    this.lastStableEmotion = 'neutral';
    this.stableFrameCount = 0;
    this.stableThreshold = 3; // 连续多少帧才确认情绪变化
    
    // 统计
    this.stats = {
      totalDetections: 0,
      successfulDetections: 0,
      apiErrors: 0,
      startTime: null
    };
  }

  /**
   * 初始化摄像头
   */
  async init() {
    try {
      console.log('🔄 初始化情绪分析模块 v2.0...');
      
      // 获取摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
          frameRate: { ideal: 15 }
        },
        audio: false
      });
      
      // 创建视频元素
      this.video = document.createElement('video');
      this.video.srcObject = stream;
      this.video.play();
      
      // 等待视频准备好
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          resolve();
        };
      });
      
      // 创建画布用于截图
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      this.ctx = this.canvas.getContext('2d');
      
      // 检查API是否可用
      await this.checkApiHealth();
      
      console.log('✅ 情绪分析模块初始化完成');
      this.stats.startTime = Date.now();
      
      return true;
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查API健康状态
   */
  async checkApiHealth() {
    try {
      const response = await fetch('http://localhost:5000/health');
      const data = await response.json();
      if (data.model_loaded) {
        console.log('✅ 情绪分析API连接正常');
        return true;
      } else {
        console.warn('⚠️ 情绪分析API模型未加载');
        return false;
      }
    } catch (error) {
      console.error('❌ 无法连接情绪分析API:', error);
      console.log('💡 请确保Python情绪分析服务已启动: python emotion_api_v2.py');
      return false;
    }
  }

  /**
   * 开始情绪检测
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.detectLoop();
    console.log('🎥 开始情绪检测');
  }

  /**
   * 停止情绪检测
   */
  stop() {
    this.isRunning = false;
    if (this.video) {
      this.video.pause();
      this.video.srcObject?.getTracks().forEach(track => track.stop());
    }
    console.log('🛑 停止情绪检测');
  }

  /**
   * 检测循环
   */
  async detectLoop() {
    if (!this.isRunning) return;
    
    try {
      await this.detectOnce();
    } catch (error) {
      console.error('检测错误:', error);
      this.stats.apiErrors++;
    }
    
    // 使用setTimeout而不是setInterval，避免堆积
    setTimeout(() => this.detectLoop(), this.config.detectInterval);
  }

  /**
   * 单次检测
   */
  async detectOnce() {
    if (!this.video || this.video.readyState !== 4) return;
    
    this.stats.totalDetections++;
    
    // 绘制视频帧到画布
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // 获取base64图像
    const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
    
    // 调用API
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageData,
        smoothing: true,
        debug: this.config.enableDebug
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.faces_detected > 0) {
      this.stats.successfulDetections++;
      const faceResult = result.results[0];
      this.processEmotion(faceResult);
    }
  }

  /**
   * 处理情绪数据
   */
  processEmotion(faceResult) {
    const { emotion, confidence, probabilities, is_confident } = faceResult;
    
    // 添加到历史
    this.emotionHistory.push({
      emotion: emotion,
      confidence: confidence,
      probabilities: probabilities,
      timestamp: Date.now(),
      is_confident: is_confident
    });
    
    // 限制历史长度
    if (this.emotionHistory.length > this.maxHistory) {
      this.emotionHistory.shift();
    }
    
    // 检测情绪是否稳定
    this.checkEmotionStability(emotion, confidence);
  }

  /**
   * 检查情绪稳定性
   */
  checkEmotionStability(newEmotion, confidence) {
    // 如果置信度太低，忽略这次检测
    if (confidence < this.config.confidenceThreshold) {
      return;
    }
    
    // 如果情绪与上次稳定情绪相同，增加计数
    if (newEmotion === this.lastStableEmotion) {
      this.stableFrameCount++;
    } else {
      // 情绪可能发生变化
      this.stableFrameCount++;
      
      // 连续多帧检测到新情绪，确认变化
      if (this.stableFrameCount >= this.stableThreshold) {
        const oldEmotion = this.lastStableEmotion;
        this.lastStableEmotion = newEmotion;
        this.stableFrameCount = 0;
        
        // 更新当前情绪
        this.currentEmotion = newEmotion;
        this.emotionConfidence = confidence;
        
        // 触发情绪变化事件
        if (oldEmotion !== newEmotion) {
          this.onEmotionChange(newEmotion, confidence, oldEmotion);
        }
      }
    }
  }

  /**
   * 情绪变化回调
   */
  onEmotionChange(emotion, confidence, oldEmotion) {
    const psychology = this.emotionToPsychology[emotion];
    const trend = this.getEmotionTrend();
    
    console.log(`😊 情绪变化: ${oldEmotion} → ${emotion} (${confidence.toFixed(1)}%) | ${psychology.state} | 趋势: ${trend}`);
    
    // 触发回调
    if (window.onUserEmotionDetected) {
      window.onUserEmotionDetected({
        emotion: emotion,
        emotion_label: psychology.state,
        confidence: confidence,
        previous_emotion: oldEmotion,
        strategy: psychology.strategy,
        trend: trend,
        color: psychology.color,
        history: this.getEmotionHistory(),
        timestamp: Date.now()
      });
    }
  }

  /**
   * 获取情绪趋势
   */
  getEmotionTrend() {
    if (this.emotionHistory.length < 3) return 'stable';
    
    // 获取最近的情绪（只考虑高置信度的）
    const confidentHistory = this.emotionHistory.filter(h => h.is_confident);
    if (confidentHistory.length < 3) return 'stable';
    
    const recent = confidentHistory.slice(-3);
    const emotions = recent.map(h => h.emotion);
    
    // 检测情绪变化趋势
    if (emotions.every(e => e === emotions[0])) {
      return 'stable';
    }
    
    // 检测情绪恶化
    const negativeEmotions = ['sad', 'angry', 'scared'];
    const recentNegative = emotions.filter(e => negativeEmotions.includes(e)).length;
    if (recentNegative >= 2) {
      return 'worsening';
    }
    
    // 检测情绪好转
    if (emotions[emotions.length - 1] === 'happy') {
      return 'improving';
    }
    
    return 'fluctuating';
  }

  /**
   * 获取情绪历史
   */
  getEmotionHistory() {
    return this.emotionHistory.map(h => ({
      emotion: h.emotion,
      confidence: h.confidence,
      timestamp: h.timestamp
    }));
  }

  /**
   * 生成 AI 提示词增强
   */
  generatePromptEnhancement() {
    const psychology = this.emotionToPsychology[this.currentEmotion];
    const trend = this.getEmotionTrend();
    
    let enhancement = '';
    
    switch (psychology.state) {
      case '低落':
        enhancement = '用户看起来有些低落，请用温柔、鼓励的语气回应，给予情感支持。可以询问用户是否有什么不开心的事情。';
        break;
      case '愤怒':
        enhancement = '用户似乎有些激动，请先倾听，不要争辩，用平和的语气安抚。让用户感受到被理解和尊重。';
        break;
      case '焦虑':
        enhancement = '用户看起来有些焦虑，请用稳定、安心的语气，帮助放松情绪。可以引导用户深呼吸或转移注意力。';
        break;
      case '愉悦':
        enhancement = '用户心情不错，可以积极回应，分享这份快乐。保持轻松愉快的对话氛围。';
        break;
      case '惊讶':
        enhancement = '用户表现出惊讶，可以解释或补充相关信息，帮助用户理解情况。';
        break;
      default:
        enhancement = '';
    }
    
    // 根据趋势调整
    if (trend === 'worsening') {
      enhancement += ' 注意用户的情绪似乎在下降，需要更多关注和安慰。';
    } else if (trend === 'improving') {
      enhancement += ' 用户的情绪正在好转，继续保持积极的互动。';
    }
    
    return enhancement;
  }

  /**
   * 获取当前状态
   */
  getCurrentState() {
    return {
      emotion: this.currentEmotion,
      emotion_label: this.emotionToPsychology[this.currentEmotion]?.state || '未知',
      confidence: this.emotionConfidence,
      psychology: this.emotionToPsychology[this.currentEmotion],
      trend: this.getEmotionTrend(),
      is_running: this.isRunning,
      stats: {
        ...this.stats,
        uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
        success_rate: this.stats.totalDetections > 0 
          ? (this.stats.successfulDetections / this.stats.totalDetections * 100).toFixed(1)
          : 0
      }
    };
  }

  /**
   * 重置
   */
  reset() {
    this.emotionHistory = [];
    this.currentEmotion = 'neutral';
    this.emotionConfidence = 0;
    this.lastStableEmotion = 'neutral';
    this.stableFrameCount = 0;
    console.log('🔄 情绪分析器已重置');
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    console.log('🗑️ 情绪分析器已销毁');
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmotionAnalyzer;
}
