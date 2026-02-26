/**
 * メール認証待機ページ（利用者向け）
 * メール認証が完了するまで表示
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 静的生成をスキップ（useSearchParamsを使用するため）
export const dynamic = 'force-dynamic';

export default function ClientEmailWaitingPage() {
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
        // メール認証完了 → usersテーブルのaccount_statusをactiveに更新
        await supabase
          .from('users')
          .update({
            account_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);

        // リダイレクト先を確認（招待フローからの登録の場合）
        const postSignupRedirect = localStorage.getItem('post_signup_redirect');
        if (postSignupRedirect) {
          localStorage.removeItem('post_signup_redirect');
          router.push(postSignupRedirect);
        } else {
          router.push('/parent');
        }
      }

      setChecking(false);
    };

    // 初回チェック
    checkEmailConfirmation();

    // 5秒ごとにチェック
    const interval = setInterval(checkEmailConfirmation, 5000);

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        // usersテーブルのaccount_statusをactiveに更新
        await supabase
          .from('users')
          .update({
            account_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);

        // リダイレクト先を確認（招待フローからの登録の場合）
        const postSignupRedirect = localStorage.getItem('post_signup_redirect');
        if (postSignupRedirect) {
          localStorage.removeItem('post_signup_redirect');
          router.push(postSignupRedirect);
        } else {
          router.push('/parent');
        }
      }
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-[#FEF3E2] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#F6AD55]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#F6AD55]"></div>
            <span>認証状態を確認中...</span>
          </div>
        )}
        <div className="bg-[#FEF3E2] border border-[#F6AD55]/30 rounded-md p-4 text-left">
          <p className="text-xs text-[#D97706] mb-2">
            <strong>メールが届かない場合：</strong>
          </p>
          <ul className="text-xs text-[#ED8936] space-y-1 list-disc list-inside">
            <li>迷惑メールフォルダを確認してください</li>
            <li>メールアドレスが正しいか確認してください</li>
            <li>数分待ってから再度お試しください</li>
          </ul>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            認証が完了すると、自動的にダッシュボードに移動します。
          </p>
        </div>
      </div>
    </div>
  );
}
