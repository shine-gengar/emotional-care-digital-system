@echo off
chcp 65001
cls

echo ==========================================
echo  LiveTalking 情感陪护数字人 - 优化启动
echo ==========================================
echo.

REM 激活 conda 环境
call D:\Miniconda3\Scripts\activate.bat nerfstream

REM 切换到项目目录
cd /d "D:\数字人3\LiveTalking-main"

echo 启动优化配置：
echo - 分辨率: 320x320 (降低以提升帧率)
echo - 批处理: 4 (降低以减少CPU占用)
echo - 模型: wav2lip (轻量级)
echo.

REM 启动 LiveTalking 优化版本
python app.py ^
  --transport webrtc ^
  --model wav2lip ^
  --avatar_id wav2lip256_avatar1 ^
  --W 320 ^
  --H 320 ^
  --batch_size 4 ^
  --fps 25 ^
  --listenport 8010

pause
