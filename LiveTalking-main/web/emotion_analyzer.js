/**
 * 情感陪护系统 - 摄像头情绪识别模块
 * 集成 face-api.js 实现实时表情分析
 */

class EmotionAnalyzer {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.isRunning = false;
    this.currentEmotion = 'neutral';
    this.emotionHistory = [];
    this.maxHistory = 10;
    
    // 表情到心理状态的映射
    this.emotionToPsychology = {
      'happy': { state: '愉悦', strategy: '积极回应', intensity: 0 },
      'sad': { state: '低落', strategy: '温柔安慰', intensity: 0 },
      'angry': { state: '愤怒', strategy: '冷静倾听', intensity: 0 },
      'fearful': { state: '焦虑', strategy: '安抚陪伴', intensity: 0 },
      'disgusted': { state: '厌恶', strategy: '转移话题', intensity: 0 },
      'surprised': { state: '惊讶', strategy: '解释说明', intensity: 0 },
      'neutral': { state: '平静', strategy: '正常对话', intensity: 0 }
    };
    
    // 情绪变化阈值
    this.changeThreshold = 0.3;
  }

  /**
   * 初始化摄像头和模型
   */
  async init() {
    try {
      // 加载 face-api.js 模型
      console.log('🔄 加载情绪识别模型...');
      
      // 从 CDN 加载模型
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
      
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      
      console.log('✅ 模型加载完成');
      
      // 获取摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      });
      
      // 创建视频元素
      this.video = document.createElement('video');
      this.video.srcObject = stream;
      this.video.play();
      
      // 创建画布用于显示（可选）
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      
      return true;
    } catch (error) {
      console.error('❌ 初始化失败:', error);
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
      const detection = await faceapi
        .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      
      if (detection) {
        this.processEmotion(detection.expressions);
      }
    } catch (error) {
      console.error('检测错误:', error);
    }
    
    // 每 500ms 检测一次（降低频率减少性能消耗）
    setTimeout(() => this.detectLoop(), 500);
  }

  /**
   * 处理情绪数据
   */
  processEmotion(expressions) {
    // 找到最强烈的情绪
    let maxEmotion = 'neutral';
    let maxScore = 0;
    
    for (const [emotion, score] of Object.entries(expressions)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion;
      }
    }
    
    // 只记录置信度 > 0.5 的情绪
    if (maxScore > 0.5) {
      this.currentEmotion = maxEmotion;
      
      // 添加到历史
      this.emotionHistory.push({
        emotion: maxEmotion,
        score: maxScore,
        timestamp: Date.now()
      });
      
      // 限制历史长度
      if (this.emotionHistory.length > this.maxHistory) {
        this.emotionHistory.shift();
      }
      
      // 更新心理状态
      this.emotionToPsychology[maxEmotion].intensity = maxScore;
      
      // 触发情绪变化事件
      this.onEmotionChange(maxEmotion, maxScore);
    }
  }

  /**
   * 情绪变化回调
   */
  onEmotionChange(emotion, score) {
    const psychology = this.emotionToPsychology[emotion];
    console.log(`😊 检测到情绪: ${emotion} (${(score * 100).toFixed(1)}%) → ${psychology.state}`);
    
    // 可以在这里触发 UI 更新
    if (window.onUserEmotionDetected) {
      window.onUserEmotionDetected({
        emotion: emotion,
        state: psychology.state,
        strategy: psychology.strategy,
        intensity: score,
        history: this.getEmotionTrend()
      });
    }
  }

  /**
   * 获取情绪趋势
   */
  getEmotionTrend() {
    if (this.emotionHistory.length < 3) return 'stable';
    
    const recent = this.emotionHistory.slice(-3);
    const emotions = recent.map(h => h.emotion);
    
    // 检测情绪变化趋势
    if (emotions.every(e => e === emotions[0])) {
      return 'stable'; // 稳定
    }
    
    // 检测情绪恶化
    const negativeEmotions = ['sad', 'angry', 'fearful'];
    const recentNegative = emotions.filter(e => negativeEmotions.includes(e)).length;
    if (recentNegative >= 2) {
      return 'worsening'; // 恶化
    }
    
    // 检测情绪好转
    if (emotions[emotions.length - 1] === 'happy') {
      return 'improving'; // 好转
    }
    
    return 'fluctuating'; // 波动
  }

  /**
   * 生成 AI 提示词增强
   */
  generatePromptEnhancement() {
    const psychology = this.emotionToPsychology[this.currentEmotion];
    const trend = this.getEmotionTrend();
    
    let enhancement = '';
    
    // 根据心理状态调整策略
    switch (psychology.state) {
      case '低落':
        enhancement = '用户看起来有些低落，请用温柔、鼓励的语气回应，给予情感支持。';
        break;
      case '愤怒':
        enhancement = '用户似乎有些激动，请先倾听，不要争辩，用平和的语气安抚。';
        break;
      case '焦虑':
        enhancement = '用户看起来有些焦虑，请用稳定、安心的语气，帮助放松情绪。';
        break;
      case '愉悦':
        enhancement = '用户心情不错，可以积极回应，分享这份快乐。';
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
      psychology: this.emotionToPsychology[this.currentEmotion],
      trend: this.getEmotionTrend(),
      history: this.emotionHistory
    };
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmotionAnalyzer;
}
