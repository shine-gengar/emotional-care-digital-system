import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: '测试成功',
    timestamp: new Date().toISOString(),
  });
}
