// Live2D 数字人服务 - 完全按照原项目实现
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5261;

// 启用 CORS
app.use(cors());
app.use(express.json());

// 静态资源服务 - 完全按照原项目路径
app.use('/assets', express.static('D:/数字人/dist/assets'));
app.use('/data/image', express.static('D:/数字人/data/image'));

// 全局状态 - 模拟 pygame 的播放状态
let isPlaying = false;
let playDuration = 0;
let playStartTime = 0;

// Live2D 页面 - 完全按照原项目 HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="assets/image/logo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        background-image: url('assets/image/bg.jpg');
        background-size: cover;
        background-repeat: no-repeat;
        background-position: center center;
        background-attachment: fixed;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      #canvas2 {
        width: 100%;
        height: 100vh;
        display: block;
        background-color: transparent;
      }
    </style>
    <script src="/assets/live2d_core/live2dcubismcore.min.js"></script>
    <script src="/assets/live2d_core/live2d.min.js"></script>
    <script src="/assets/live2d_core/pixi.min.js"></script>
    <title>Live2D角色 - 枫云AI虚拟伙伴Web版</title>
    <script type="module" crossorigin src="/assets/live2d.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <canvas id="canvas2"></canvas>
  </body>
</html>
  `);
});

// 驱动数字人说话
app.post('/api/speak', (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }
  
  // 模拟开始播放
  isPlaying = true;
  playDuration = text.length * 0.3; // 估算说话时间
  playStartTime = Date.now();
  
  console.log('🎙️ 开始说话:', text, '预计时长:', playDuration, '秒');
  
  // 一段时间后自动停止
  setTimeout(() => {
    isPlaying = false;
    console.log('🎙️ 说话结束');
  }, playDuration * 1000);
  
  res.json({
    success: true,
    text,
    duration: playDuration
  });
});

// 停止说话
app.post('/api/stop', (req, res) => {
  isPlaying = false;
  res.json({ success: true });
});

// 获取嘴部动画数据 - 完全按照原项目实现
app.get('/api/get_mouth_y', (req, res) => {
  // 检查是否正在播放（模拟 pygame.mixer.music.get_busy()）
  if (isPlaying) {
    // 如果超过预计时长，自动停止
    if (Date.now() - playStartTime > playDuration * 1000) {
      isPlaying = false;
    }
  }
  
  if (isPlaying) {
    // 随机生成嘴部开合度 0.1-0.9
    const y = Math.random() * 0.8 + 0.1;
    res.json({ y });
  } else {
    res.json({ y: 0 });
  }
});

// 获取状态
app.get('/api/status', (req, res) => {
  res.json({
    is_speaking: isPlaying,
    duration: playDuration
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log('🎭 Live2D 数字人服务已启动');
  console.log(`📱 访问地址: http://localhost:${PORT}`);
  console.log('🔧 API 端点:');
  console.log('   - POST /api/speak       驱动数字人说话');
  console.log('   - POST /api/stop        停止说话');
  console.log('   - GET  /api/get_mouth_y 获取嘴部动画（原项目兼容）');
  console.log('   - GET  /api/status      获取状态');
});
