import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// 百度语音识别配置
const BAIDU_CONFIG = {
  appId: '7532626',
  apiKey: 'RmfOzT130RvX8RKqAocUcJMB',
  secretKey: 'o3zl7DNwZ9HoWwuSl8g6bhVFGqElIJGT',
  devPid: 15372, // 中文普通话（加强标点）
};

/**
 * 获取百度 Access Token
 */
async function getAccessToken(): Promise<string> {
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_CONFIG.apiKey}&client_secret=${BAIDU_CONFIG.secretKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('获取 Access Token 失败');
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * 百度语音识别 API
 * 
 * 接收音频文件，调用百度语音识别接口
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: '没有收到音频文件' },
        { status: 400 }
      );
    }

    console.log('收到音频文件:', audioFile.name, audioFile.size, 'bytes', '类型:', audioFile.type);

    // 检查音频文件大小
    if (audioFile.size < 1000) {
      return NextResponse.json(
        { error: '音频文件太小，请重新录音' },
        { status: 400 }
      );
    }

    // 获取 Access Token
    let token;
    try {
      token = await getAccessToken();
      console.log('获取到 Access Token');
    } catch (err: any) {
      console.error('获取 Access Token 失败:', err);
      return NextResponse.json(
        { error: '百度 API 认证失败: ' + err.message },
        { status: 500 }
      );
    }

    // 读取音频文件为 base64
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioBase64 = audioBuffer.toString('base64');

    console.log('音频 base64 长度:', audioBase64.length);
    
    // 检查 base64 长度（百度限制）
    if (audioBase64.length > 65536) {
      console.warn('音频数据过大，可能需要分段处理');
    }

    // 调用百度语音识别 API
    // 注意：百度语音识别支持的格式：pcm, wav, amr, m4a
    // webm 需要先转换为支持的格式，这里我们尝试使用 pcm 格式参数
    const asrUrl = `https://vop.baidu.com/server_api?dev_pid=${BAIDU_CONFIG.devPid}&cuid=emotion-companion-web&token=${token}`;
    
    console.log('调用百度 API:', asrUrl);
    
    const response = await fetch(asrUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'amr',  // 尝试使用 amr 格式，百度支持
        rate: 16000,
        channel: 1,
        cuid: 'emotion-companion-web',
        token: token,
        dev_pid: BAIDU_CONFIG.devPid,
        speech: audioBase64,
        len: audioBuffer.length,
      }),
    });

    console.log('百度 API 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('百度 API 请求失败:', response.status, errorText);
      throw new Error(`百度 API 请求失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('百度识别结果:', result);

    if (result.err_no !== 0) {
      console.error('百度识别错误:', result.err_no, result.err_msg);
      return NextResponse.json(
        { error: result.err_msg || '识别失败', err_no: result.err_no },
        { status: 500 }
      );
    }

    return NextResponse.json({
      result: result.result || [],
      err_no: result.err_no,
    });

  } catch (error: any) {
    console.error('语音识别失败:', error);
    console.error('错误堆栈:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || '语音识别失败',
        details: error.stack || '未知错误'
      },
      { status: 500 }
    );
  }
}
