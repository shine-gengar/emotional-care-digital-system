/**
 * 情绪分析前端优化版 v3.0
 * 配合 emotion_api_v3.py 使用
 */

class OptimizedEmotionAnalyzer {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'http://localhost:5000/detect',
      healthUrl: config.healthUrl || 'http://localhost:5000/health',
      resetUrl: config.resetUrl || 'http://localhost:5000/reset',
      detectInterval: config.detectInterval || 400, // 稍微加快检测频率
      confidenceThreshold: config.confidenceThreshold || 35,
      enableDebug: config.enableDebug || false,
      ...config
    };
    
    this.isRunning = false;
    this.isApiAvailable = false;
    this.currentEmotion = 'neutral';
    this.emotionConfidence = 0;
    this.lockStability = 0; // 情绪稳定性计数
    
    // 情绪映射
    this.emotionMapping = {
      'angry': { label: '愤怒', emoji: '😠', color: '#ef4444', strategy: '冷静倾听' },
      'disgust': { label: '厌恶', emoji: '🤢', color: '#22c55e', strategy: '转移话题' },
      'scared': { label: '害怕', emoji: '😨', color: '#a855f7', strategy: '安抚陪伴' },
      'happy': { label: '开心', emoji: '😊', color: '#f59e0b', strategy: '积极回应' },
      'sad': { label: '悲伤', emoji: '😢', color: '#3b82f6', strategy: '温柔安慰' },
      'surprised': { label: '惊讶', emoji: '😲', color: '#f97316', strategy: '解释说明' },
      'neutral': { label: '平静', emoji: '😐', color: '#9ca3af', strategy: '正常对话' }
    };
    
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.detectIntervalId = null;
    
    // 统计
    this.stats = {
      totalDetections: 0,
      successfulDetections: 0,
      emotionChanges: 0,
      lastEmotion: 'neutral'
    };
  }

  async init(videoElement) {
    try {
      console.log('🚀 初始化优化版情绪分析器 v3.0...');
      
      this.video = videoElement;
      
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      this.ctx = this.canvas.getContext('2d');
      
      const apiOk = await this.checkApiHealth();
      if (!apiOk) {
        console.warn('⚠️ API不可用，将使用备用模式');
      }
      
      console.log('✅ 情绪分析器初始化完成');
      return true;
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      return false;
    }
  }

  async checkApiHealth() {
    try {
      const response = await fetch(this.config.healthUrl, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      this.isApiAvailable = data.model_loaded;
      
      if (this.isApiAvailable) {
        console.log(`✅ API连接正常 (版本: ${data.version || 'unknown'})`);
      }
      
      return this.isApiAvailable;
    } catch (error) {
      console.error('❌ API连接失败:', error);
      this.isApiAvailable = false;
      return false;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.detectLoop();
    console.log('🎥 开始情绪检测 (优化版)');
  }

  stop() {
    this.isRunning = false;
    if (this.detectIntervalId) {
      clearTimeout(this.detectIntervalId);
      this.detectIntervalId = null;
    }
    console.log('🛑 停止情绪检测');
  }

  async detectLoop() {
    if (!this.isRunning) return;
    
    try {
      await this.detectOnce();
    } catch (error) {
      console.error('检测错误:', error);
    }
    
    this.detectIntervalId = setTimeout(() => this.detectLoop(), this.config.detectInterval);
  }

  async detectOnce() {
    if (!this.video || this.video.readyState !== 4) return;
    
    this.stats.totalDetections++;
    
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const imageData = this.canvas.toDataURL('image/jpeg', 0.85);
    
    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      
      const result = await response.json();
      
      if (result.success && result.faces_detected > 0) {
        this.stats.successfulDetections++;
        this.processResult(result.results[0]);
      }
    } catch (error) {
      console.error('API调用失败:', error);
    }
  }

  processResult(faceResult) {
    const { emotion, confidence, probabilities, is_confident, lock_stability } = faceResult;
    
    // 更新当前情绪
    const prevEmotion = this.currentEmotion;
    this.currentEmotion = emotion;
    this.emotionConfidence = confidence;
    this.lockStability = lock_stability || 0;
    
    // 统计情绪变化
    if (prevEmotion !== emotion) {
      this.stats.emotionChanges++;
    }
    
    // 更新UI
    this.updateUI(emotion, confidence, probabilities, is_confident);
    
    // 触发回调
    if (window.onOptimizedEmotionDetected) {
      window.onOptimizedEmotionDetected({
        emotion: emotion,
        emotion_label: this.emotionMapping[emotion]?.label || emotion,
        confidence: confidence,
        probabilities: probabilities,
        is_confident: is_confident,
        lock_stability: lock_stability,
        strategy: this.emotionMapping[emotion]?.strategy || '',
        stats: this.stats
      });
    }
  }

  updateUI(emotion, confidence, probabilities, isConfident) {
    const config = this.emotionMapping[emotion];
    if (!config) return;
    
    // 更新主导情绪
    const dominantEl = document.getElementById('dominant-emotion');
    if (dominantEl) {
      dominantEl.className = `dominant-emotion emotion-${emotion}-style`;
      dominantEl.style.opacity = isConfident ? '1' : '0.7';
      
      const emojiEl = document.querySelector('.dominant-emotion-emoji');
      const labelEl = document.getElementById('dominant-emotion-label');
      const confEl = document.getElementById('dominant-emotion-confidence');
      
      if (emojiEl) emojiEl.textContent = config.emoji;
      if (labelEl) labelEl.textContent = config.label;
      if (confEl) {
        confEl.textContent = `${Math.round(confidence)}% ${isConfident ? '✓' : '?'}`;
        confEl.style.color = isConfident ? config.color : '#9ca3af';
      }
    }
    
    // 更新摄像头标签
    const cameraOverlay = document.getElementById('camera-emotion-overlay');
    if (cameraOverlay) {
      cameraOverlay.style.border = isConfident ? `2px solid ${config.color}` : '2px solid transparent';
      
      const emojiEl = document.getElementById('camera-emotion-emoji');
      const labelEl = document.getElementById('camera-emotion-label');
      const confEl = document.getElementById('camera-emotion-confidence');
      
      if (emojiEl) emojiEl.textContent = config.emoji;
      if (labelEl) labelEl.textContent = config.label;
      if (confEl) confEl.textContent = `${Math.round(confidence)}%`;
    }
    
    // 更新概率条
    const barEmotions = ['happy', 'neutral', 'angry', 'disgust', 'surprised', 'sad'];
    barEmotions.forEach(emo => {
      const prob = probabilities[emo] || 0;
      const bar = document.getElementById(`bar-${emo}`);
      const value = document.getElementById(`value-${emo}`);
      if (bar && value) {
        bar.style.width = `${prob}%`;
        bar.style.transition = 'width 0.3s ease';
        value.textContent = `${Math.round(prob)}%`;
        
        // 高亮当前情绪
        if (emo === emotion) {
          bar.style.opacity = '1';
          bar.style.boxShadow = `0 0 8px ${this.emotionMapping[emo]?.color || '#ccc'}`;
        } else {
          bar.style.opacity = '0.6';
          bar.style.boxShadow = 'none';
        }
      }
    });
    
    // 更新情绪徽章
    const emotionBadge = document.getElementById('emotion-badge');
    if (emotionBadge) {
      emotionBadge.textContent = config.label;
      emotionBadge.style.background = config.color + '20'; // 20%透明度
      emotionBadge.style.color = config.color;
      emotionBadge.style.border = `1px solid ${config.color}`;
    }
  }

  generatePromptEnhancement() {
    const config = this.emotionMapping[this.currentEmotion];
    if (!config || this.emotionConfidence < this.config.confidenceThreshold) {
      return '';
    }
    
    let enhancement = '';
    
    switch (this.currentEmotion) {
      case 'happy':
        enhancement = '用户看起来很开心，请用积极、热情的语气回应，分享这份快乐。';
        break;
      case 'sad':
        enhancement = '用户看起来有些难过，请用温柔、体贴的语气，给予安慰和支持。';
        break;
      case 'angry':
        enhancement = '用户似乎有些生气，请先耐心倾听，用平和的语气安抚情绪。';
        break;
      case 'scared':
        enhancement = '用户看起来有些害怕或焦虑，请用稳定、安心的语气，帮助放松。';
        break;
      case 'surprised':
        enhancement = '用户表现出惊讶，可以解释情况或提供更多信息。';
        break;
      default:
        enhancement = '';
    }
    
    // 根据稳定性调整
    if (this.lockStability < 3) {
      enhancement += ' (情绪还在变化中)';
    }
    
    return enhancement;
  }

  async reset() {
    try {
      await fetch(this.config.resetUrl, { method: 'POST' });
      this.currentEmotion = 'neutral';
      this.emotionConfidence = 0;
      this.lockStability = 0;
      console.log('🔄 情绪分析器已重置');
    } catch (error) {
      console.error('重置失败:', error);
    }
  }

  getStats() {
    return {
      ...this.stats,
      accuracy: this.stats.totalDetections > 0 
        ? (this.stats.successfulDetections / this.stats.totalDetections * 100).toFixed(1)
        : 0,
      currentEmotion: this.currentEmotion,
      confidence: this.emotionConfidence,
      lockStability: this.lockStability
    };
  }
}

// 全局实例
window.optimizedEmotionAnalyzer = null;

async function initOptimizedEmotionAnalyzer(videoElement) {
  window.optimizedEmotionAnalyzer = new OptimizedEmotionAnalyzer({
    detectInterval: 400,
    confidenceThreshold: 35,
    enableDebug: false
  });
  
  return await window.optimizedEmotionAnalyzer.init(videoElement);
}

function startOptimizedEmotionAnalysis() {
  window.optimizedEmotionAnalyzer?.start();
}

function stopOptimizedEmotionAnalysis() {
  window.optimizedEmotionAnalyzer?.stop();
}

function getOptimizedEmotionPrompt() {
  return window.optimizedEmotionAnalyzer?.generatePromptEnhancement() || '';
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizedEmotionAnalyzer };
}
