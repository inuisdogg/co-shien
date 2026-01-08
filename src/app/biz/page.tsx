/**
 * Biz用ログインページ（事業所向け）
 * パーソナルアカウントに一本化されたため、/login にリダイレクト
 * facilityIdクエリパラメータがある場合は、メインページにリダイレクト（施設情報を自動取得）
 */

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function BizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const facilityIdFromQuery = searchParams?.get('facilityId') || null;
  
  useEffect(() => {
    // facilityIdクエリパラメータがある場合は、メインページにリダイレクト（施設情報を自動取得）
    if (facilityIdFromQuery) {
      router.replace(`/?facilityId=${facilityIdFromQuery}`);
    } else {
      // /login にリダイレクト
      router.replace('/login');
    }
  }, [router, facilityIdFromQuery]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
      <div className="text-white">リダイレクト中...</div>
    </div>
  );
}
