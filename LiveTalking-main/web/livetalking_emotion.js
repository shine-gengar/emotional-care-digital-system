// livetalking_emotion.js - 增强版：情绪变化检测 + 自动聊天功能
// 版本: 2.0 - 让数字人更智能、更主动

console.log('【livetalking_emotion.js】开始加载...');

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // 情绪变化检测配置
        emotion: {
            historySize: 3,              // 情绪历史记录数量
            changeThreshold: 0.2,        // 情绪变化阈值 (20%)
            minConfidence: 0.4,          // 最小置信度
            cooldownPeriod: 5000,        // 自动聊天冷却期 (5秒)
            significantChangeCooldown: 10000, // 显著变化冷却期 (10秒)
        },
        // 自动聊天触发配置
        autoChat: {
            enabled: true,
            negativeEmotions: ['sad', 'angry', 'scared', 'disgust'],
            positiveEmotions: ['happy', 'surprised'],
        },
        // 情绪权重配置
        emotionWeights: {
            sad: 1.0, angry: 0.9, scared: 0.85, disgust: 0.8,
            happy: 0.6, surprised: 0.5, neutral: 0.3,
        }
    };

    // ==================== 状态管理 ====================
    const state = {
        emotionHistory: [],
        lastEmotionChange: null,
        lastAutoChatTime: 0,
        currentEmotion: 'neutral',
        emotionIntensity: 0,
        isAutoChatting: false,
        lastUserActivity: Date.now(),
    };

    // ==================== 工具函数 ====================
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function calculateEmotionIntensity(emotionData) {
        const dominant = emotionData.dominant;
        const confidence = emotionData.confidence;
        const weight = CONFIG.emotionWeights[dominant] || 0.5;
        return confidence * weight;
    }

    // ==================== 情绪变化检测 ====================
    function detectEmotionChange(newEmotion) {
        const now = Date.now();
        
        if (newEmotion.confidence < CONFIG.emotion.minConfidence) {
            return null;
        }

        const intensity = calculateEmotionIntensity(newEmotion);
        
        state.emotionHistory.push({
            emotion: newEmotion.dominant,
            confidence: newEmotion.confidence,
            intensity: intensity,
            timestamp: now
        });

        if (state.emotionHistory.length > CONFIG.emotion.historySize) {
            state.emotionHistory.shift();
        }

        const timeSinceLastChat = now - (state.lastAutoChatTime || 0);
        if (timeSinceLastChat < CONFIG.emotion.cooldownPeriod) {
            return null;
        }

        if (state.emotionHistory.length < 2) {
            return null;
        }

        const prev = state.emotionHistory[state.emotionHistory.length - 2];
        const curr = state.emotionHistory[state.emotionHistory.length - 1];

        const emotionTypeChanged = prev.emotion !== curr.emotion;
        const intensityChange = Math.abs(curr.intensity - prev.intensity);

        if (emotionTypeChanged || intensityChange >= CONFIG.emotion.changeThreshold) {
            return {
                from: prev.emotion,
                to: curr.emotion,
                isNegative: CONFIG.autoChat.negativeEmotions.includes(curr.emotion),
                isPositive: CONFIG.autoChat.positiveEmotions.includes(curr.emotion),
                isSignificant: emotionTypeChanged && intensityChange > 0.4
            };
        }

        return null;
    }

    // ==================== 回复生成 ====================
    function generateProactiveResponse(changeInfo) {
        const responses = {
            sad: [
                "我注意到你看起来有点难过...想聊聊发生了什么吗？我在这里陪着你。",
                "看到你这样，我心里也不好受。要不要跟我说说？",
                "有时候难过是很正常的，不需要强撑着。想聊聊吗？"
            ],
            angry: [
                "你看起来有点生气...是遇到什么不开心的事了吗？",
                "深呼吸，慢慢来。如果愿意的话，可以跟我倾诉一下。"
            ],
            scared: [
                "你看起来有点紧张害怕...别担心，有我在呢。",
                "害怕的时候有人陪着会好一些，我在这里。"
            ],
            happy: [
                "哇，你看起来好开心！是什么好事呀？快跟我分享！😊",
                "看到你开心，我也跟着高兴起来了！发生了什么好事？"
            ],
            surprised: [
                "咦，你看起来有点惊讶，遇到什么意外的事了？",
                "发生什么让你惊讶的事了？是惊喜吗？"
            ],
            neutral: [
                "我在这里陪着你，想聊点什么吗？",
                "感觉你很平静呢，这种状态挺好的。"
            ]
        };

        const emotionResponses = responses[changeInfo.to] || responses.neutral;
        return emotionResponses[Math.floor(Math.random() * emotionResponses.length)];
    }

    // ==================== 主动聊天触发器 ====================
    async function triggerProactiveChat(changeInfo) {
        if (!CONFIG.autoChat.enabled || state.isAutoChatting) return;

        const now = Date.now();
        const cooldown = changeInfo.isSignificant ? 
            CONFIG.emotion.significantChangeCooldown : 
            CONFIG.emotion.cooldownPeriod;
        
        if ((now - state.lastAutoChatTime) < cooldown) return;

        state.isAutoChatting = true;
        state.lastAutoChatTime = now;

        try {
            console.log('【自动聊天】触发:', changeInfo);
            
            const response = generateProactiveResponse(changeInfo);
            console.log('【自动聊天】回复:', response);

            // 显示思考状态
            if (window.setChatState) {
                window.setChatState('thinking');
            }

            await delay(1000);

            // 添加消息到聊天界面
            if (window.addMessage) {
                window.addMessage(response, false);
            }

            // 发送给数字人
            const sessionidEl = document.getElementById('sessionid');
            const sessionid = sessionidEl ? sessionidEl.value : '0';
            
            if (sessionid && sessionid !== '0') {
                try {
                    const res = await fetch('/human', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: response,
                            type: 'chat',
                            interrupt: true,
                            sessionid: parseInt(sessionid)
                        })
                    });
                    console.log('【自动聊天】已发送给数字人:', res.status);
                } catch (err) {
                    console.error('【自动聊天】发送失败:', err);
                }
            }

            if (window.setChatState) {
                window.setChatState('speaking');
                setTimeout(() => window.setChatState('idle'), 3000);
            }

        } catch (error) {
            console.error('【自动聊天】失败:', error);
        } finally {
            state.isAutoChatting = false;
        }
    }

    // ==================== 外部接口 ====================
    window.handleEmotionData = function(emotionData) {
        console.log('【情绪系统】收到数据:', emotionData);
        
        if (!emotionData || !emotionData.dominant) return;

        const changeInfo = detectEmotionChange(emotionData);
        
        if (changeInfo) {
            console.log('【情绪系统】检测到变化:', changeInfo);
            triggerProactiveChat(changeInfo);
        }

        state.lastUserActivity = Date.now();
    };

    window.getEmotionState = function() {
        return {
            currentEmotion: state.currentEmotion,
            emotionHistory: state.emotionHistory,
            isAutoChatting: state.isAutoChatting
        };
    };

    window.resetEmotionState = function() {
        state.emotionHistory = [];
        state.lastEmotionChange = null;
        state.lastAutoChatTime = 0;
        state.currentEmotion = 'neutral';
        state.emotionIntensity = 0;
        state.isAutoChatting = false;
        console.log('【情绪系统】已重置');
    };

    console.log('【livetalking_emotion.js】加载完成');
    console.log('【情绪系统】handleEmotionData 已定义');

})();
