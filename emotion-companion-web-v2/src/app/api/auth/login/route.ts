import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetUrl = `${API_BASE_URL}/api/auth/login`;
    
    console.log('代理登录请求到:', targetUrl);
    console.log('请求体:', body);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    console.log('后端响应:', response.status, data);

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('登录代理错误:', error);
    console.error('错误详情:', {
      message: error.message,
      cause: error.cause,
      code: error.code,
    });
    return NextResponse.json(
      { error: '服务器连接失败: ' + error.message + ' (请确保后端服务器运行在 ' + API_BASE_URL + ')' },
      { status: 500 }
    );
  }
}
