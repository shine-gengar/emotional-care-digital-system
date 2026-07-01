import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * 文字转语音 API
 * 使用 edge-tts (微软 Edge 浏览器的 TTS 服务)
 */
export async function textToSpeech(req: Request, res: Response) {
  try {
    const { text, voice = 'zh-CN-XiaoxiaoNeural' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    console.log('🔊 TTS 请求:', text.substring(0, 50) + '...');

    // 创建临时文件
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const outputFile = path.join(tempDir, `tts-${Date.now()}.mp3`);
    
    // 使用 edge-tts 生成语音
    // 注意：需要在服务器上安装 edge-tts: pip install edge-tts
    const command = `edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${outputFile}"`;
    
    console.log('🎙️ 执行命令:', command);
    
    try {
      await execAsync(command);
    } catch (execError) {
      console.error('❌ edge-tts 执行失败:', execError);
      // 如果 edge-tts 失败，返回错误
      return res.status(500).json({ 
        error: 'TTS generation failed', 
        details: 'Please install edge-tts: pip install edge-tts' 
      });
    }

    // 检查文件是否生成
    if (!fs.existsSync(outputFile)) {
      console.error('❌ TTS 文件未生成');
      return res.status(500).json({ error: 'TTS file not generated' });
    }

    // 读取音频文件
    const audioBuffer = fs.readFileSync(outputFile);
    
    console.log('✅ TTS 成功，音频大小:', audioBuffer.length, 'bytes');

    // 设置响应头
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.length.toString());
    
    res.send(audioBuffer);

    // 删除临时文件
    fs.unlinkSync(outputFile);

  } catch (error) {
    console.error('TTS 错误:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
