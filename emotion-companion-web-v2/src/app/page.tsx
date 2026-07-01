'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { Heart } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  // 检查登录状态
  useEffect(() => {
    // 如果已登录，直接跳转到聊天页面
    if (isAuthenticated) {
      router.push('/chat');
    }
    setIsChecking(false);
  }, [isAuthenticated, router]);

  if (isChecking) {
    return null;
  }

  // 未登录，显示登录提示
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-stone-50 to-orange-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <motion.div
              className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-rose-200 to-orange-200 flex items-center justify-center mb-4"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Heart className="w-8 h-8 text-rose-500" />
            </motion.div>
            <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent">
              情感陪护数字人
            </CardTitle>
            <CardDescription className="text-base mt-2">
              你的专属AI伴侣，随时倾听你的心声
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-center text-stone-600 dark:text-stone-300">
              请先登录或注册，开始你的情感陪护之旅
            </p>
            
            <div className="space-y-3">
              <Link href="/login">
                <Button className="w-full h-12 text-lg rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white">
                  登录
                </Button>
              </Link>
              
              <Link href="/register">
                <Button variant="outline" className="w-full h-12 text-lg rounded-xl">
                  注册账号
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
