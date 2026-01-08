/**
 * Personal用ログインページ（スタッフ向け）
 * パーソナルアカウントに一本化されたため、/login にリダイレクト
 */

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function PersonalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // リダイレクトパラメータがあれば保持して /login にリダイレクト
    const redirect = searchParams?.get('redirect');
    if (redirect) {
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    } else {
      router.replace('/login');
    }
  }, [router, searchParams]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
      <div className="text-white">リダイレクト中...</div>
    </div>
  );
}

