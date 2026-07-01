// livetalking_emotion_test.js - 简化测试版本
console.log('【测试】livetalking_emotion_test.js 开始加载');

(function() {
    'use strict';
    
    console.log('【测试】IIFE 开始执行');
    
    // 简单的测试函数
    window.handleEmotionData = function(emotionData) {
        console.log('【测试】handleEmotionData 被调用:', emotionData);
        
        if (!emotionData || !emotionData.dominant) {
            console.log('【测试】无效的情绪数据');
            return;
        }
        
        console.log('【测试】收到情绪:', emotionData.dominant, '置信度:', emotionData.confidence);
        
        // 简单的情绪变化检测
        if (emotionData.dominant === 'sad' && emotionData.confidence > 0.5) {
            console.log('【测试】检测到悲伤情绪，应该触发自动聊天');
            
            // 触发自动聊天
            setTimeout(function() {
                console.log('【测试】正在触发自动聊天...');
                
                // 添加消息到聊天界面
                if (window.addMessage) {
                    window.addMessage('【测试】我注意到你看起来有点难过...我在这里陪着你。', false);
                    console.log('【测试】消息已添加');
                } else {
                    console.error('【测试】addMessage 函数不可用');
                }
                
                // 调用 LiveTalking 后端
                var sessionid = document.getElementById('sessionid')?.value || '0';
                if (sessionid !== '0') {
                    fetch('/human', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: '我注意到你看起来有点难过...我在这里陪着你。',
                            type: 'chat',
                            interrupt: true,
                            sessionid: parseInt(sessionid)
                        })
                    }).then(function(response) {
                        console.log('【测试】fetch 响应:', response.status);
                    }).catch(function(err) {
                        console.error('【测试】fetch 失败:', err);
                    });
                } else {
                    console.log('【测试】sessionid=0，不发送给后端');
                }
            }, 1000);
        }
    };
    
    console.log('【测试】handleEmotionData 已定义');
    
})();

console.log('【测试】livetalking_emotion_test.js 加载完成');
console.log('【测试】handleEmotionData:', typeof window.handleEmotionData);
