/**
 * Root Page
 *
 * co-shien.inu.co.jp のトップページ
 * → /business へリダイレクト
 *
 * TODO: 将来的にはサービス選択ハブやLPにする可能性あり
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/business');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    </div>
  );
}
