/**
 * ログインページ
 * ルート（/）にリダイレクト（ルートでログイン画面を表示するため）
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // ルート（/）にリダイレクト
    router.replace('/');
  }, [router]);

  // リダイレクト中のローディング表示
  return (
    <div className="flex items-center justify-center h-screen">
      <div>読み込み中...</div>
    </div>
  );
}

