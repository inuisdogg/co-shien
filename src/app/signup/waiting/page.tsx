/**
 * メール認証待機ページ（Biz側）
 * メール認証が完了するまで表示
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 静的生成をスキップ（useSearchParamsを使用するため）
export const dynamic = 'force-dynamic';

export default function EmailWaitingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // 定期的にメール認証状態をチェック
    const checkEmailConfirmation = async () => {
      setChecking(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.email_confirmed_at) {
        // メール認証完了 → /setupにリダイレクト
        router.push('/setup?type=confirm');
      }
      
      setChecking(false);
    };

    // 初回チェック
    checkEmailConfirmation();

    // 5秒ごとにチェック
    const interval = setInterval(checkEmailConfirmation, 5000);

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        router.push('/setup?type=confirm');
      }
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">メール認証をお待ちください</h2>
        <p className="text-gray-600 text-sm mb-4">
          {email ? `${email} に確認メールを送信しました。` : '確認メールを送信しました。'}
        </p>
        <p className="text-gray-600 text-sm mb-6">
          メール内のリンクをクリックして、メールアドレスを確認してください。
        </p>
        {checking && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00c4cc]"></div>
            <span>認証状態を確認中...</span>
          </div>
        )}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-left">
          <p className="text-xs text-blue-800 mb-2">
            <strong>メールが届かない場合：</strong>
          </p>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li>迷惑メールフォルダを確認してください</li>
            <li>メールアドレスが正しいか確認してください</li>
            <li>数分待ってから再度お試しください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

