import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('代理注册请求到:', `${API_BASE_URL}/api/auth/register`);
    
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
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
    console.error('注册代理错误:', error);
    return NextResponse.json(
      { error: '服务器连接失败: ' + error.message },
      { status: 500 }
    );
  }
}
