import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/api/chat/history${queryString ? '?' + queryString : ''}`;
    
    console.log('代理历史记录请求到:', url);
    
    const headers: Record<string, string> = {};
    
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const data = await response.json();
    
    console.log('后端响应:', response.status);

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('历史记录代理错误:', error);
    return NextResponse.json(
      { error: '服务器连接失败: ' + error.message },
      { status: 500 }
    );
  }
}
