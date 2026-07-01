import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 禁用 Turbopack，使用 Webpack
  turbopack: false,
  // 允许 iframe 嵌入（用于百度数字人）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://open.xiling.baidu.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; frame-src 'self' https://open.xiling.baidu.com; connect-src 'self' http://localhost:3001 http://localhost:5000 http://127.0.0.1:5000 https://open.xiling.baidu.com https://aip.baidubce.com;",
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
