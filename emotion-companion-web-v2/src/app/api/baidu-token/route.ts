import { NextResponse } from 'next/server';

/**
 * 百度智能云数字人 Token 获取 API
 * 
 * 使用 OAuth2.0 client_credentials 方式
 */

// 从环境变量读取配置
const ACCESS_KEY = process.env.BAIDU_ACCESS_KEY || 'your-baidu-access-key-here';
const APP_KEY = 'r9e979q60yc0zdufmpi7'; // 应用页面的 App Key
const SECRET_KEY = process.env.BAIDU_SECRET_KEY || 'your-baidu-secret-key-here';

export async function GET() {
  console.log('=== 百度 Token API ===');
  console.log('环境变量 BAIDU_ACCESS_KEY:', process.env.BAIDU_ACCESS_KEY ? '已设置' : '未设置');
  console.log('环境变量 BAIDU_SECRET_KEY:', process.env.BAIDU_SECRET_KEY ? '已设置' : '未设置');
  console.log('使用 ACCESS_KEY:', ACCESS_KEY.substring(0, 20) + '...');
  console.log('使用 APP_KEY:', APP_KEY.substring(0, 20) + '...');
  console.log('使用 SECRET_KEY:', SECRET_KEY ? '已设置 (长度:' + SECRET_KEY.length + ')' : '未设置');
  
  if (!SECRET_KEY || SECRET_KEY === 'your-baidu-secret-key-here') {
    console.log('⚠️ 警告: 使用的是硬编码的 SECRET_KEY，可能已过期');
  }

  try {
    // 百度 OAuth2.0 接口
    const url = 'https://aip.baidubce.com/oauth/2.0/token';
    
    // 尝试两种 client_id：Access Key ID 和 App Key
    const clientIds = [ACCESS_KEY, APP_KEY];
    
    for (const clientId of clientIds) {
      console.log('尝试 client_id:', clientId.substring(0, 25) + '...');
      
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: SECRET_KEY,
      });

      console.log('请求百度 OAuth2...');
      
      const response = await fetch(`${url}?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('响应状态:', response.status);
      
      const data = await response.json();
      console.log('响应:', JSON.stringify(data));

      if (data.access_token) {
        console.log('✅ 获取 Token 成功');
        return NextResponse.json({ 
          success: true,
          token: data.access_token,
          expires_in: data.expires_in,
        });
      }
      
      console.log('❌ 失败:', data.error);
    }
    
    // 所有尝试都失败
    return NextResponse.json({ 
      success: false,
      error: '所有 client_id 都认证失败',
    }, { status: 500 });

  } catch (error) {
    console.error('异常:', error);
    return NextResponse.json({ 
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
