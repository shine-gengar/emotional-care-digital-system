'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearAllStorage } from '@/stores';

export default function ClearCachePage() {
  const router = useRouter();

  useEffect(() => {
    // 清除所有缓存
    clearAllStorage();
    
    // 显示提示
    alert('缓存已清除，页面将刷新');
    
    // 跳转到登录页
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg text-stone-600">正在清除缓存...</p>
    </div>
  );
}
