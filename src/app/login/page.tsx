/**
 * 共通ログインページ
 * → /career/login へリダイレクト
 *
 * 後方互換性のため残置
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/career/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8] to-[#6366F1]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    </div>
  );
}
