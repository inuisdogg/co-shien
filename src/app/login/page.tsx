/**
 * 共通ログインページ
 * → /career/login へリダイレクト
 *
 * 後方互換性のため残置
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    router.replace('/career/login');
    const timer = setTimeout(() => setShowFallback(true), 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-personal to-personal-dark">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        {showFallback && (
          <p className="mt-4 text-white/80 text-sm">
            リダイレクト中です。自動で切り替わらない場合は
            <a href="/career/login" className="underline font-bold ml-1">こちら</a>
          </p>
        )}
      </div>
    </div>
  );
}
