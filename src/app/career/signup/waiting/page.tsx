/**
 * メール認証待機ページ（キャリアアカウント用）
 * メール認証が完了するまで表示
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 静的生成をスキップ（useSearchParamsを使用するため）
export const dynamic = 'force-dynamic';

export default function CareerEmailWaitingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [checking, setChecking] = useState(false);

  // 認証完了時のリダイレクト先を決定
  const getRedirectUrl = () => {
    const signupRedirect = localStorage.getItem('signup_redirect');
    if (signupRedirect) {
      localStorage.removeItem('signup_redirect');
      return signupRedirect;
    }
    return '/career?verified=true';
  };

  useEffect(() => {
    // 定期的にメール認証状態をチェック
    const checkEmailConfirmation = async () => {
      setChecking(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user?.email_confirmed_at) {
        // メール認証完了 → リダイレクト先へ
        // ユーザー情報をlocalStorageに保存
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          const userSession = {
            id: userData.id,
            name: userData.name || `${userData.last_name || ''} ${userData.first_name || ''}`.trim(),
            lastName: userData.last_name,
            firstName: userData.first_name,
            email: userData.email,
            role: userData.role,
            userType: userData.user_type || 'staff',
          };
          localStorage.setItem('user', JSON.stringify(userSession));
        }

        router.push(getRedirectUrl());
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
        // ユーザー情報をlocalStorageに保存
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          const userSession = {
            id: userData.id,
            name: userData.name || `${userData.last_name || ''} ${userData.first_name || ''}`.trim(),
            lastName: userData.last_name,
            firstName: userData.first_name,
            email: userData.email,
            role: userData.role,
            userType: userData.user_type || 'staff',
          };
          localStorage.setItem('user', JSON.stringify(userSession));
        }

        router.push(getRedirectUrl());
      }
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8] to-[#6366F1] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#818CF8]"></div>
            <span>認証状態を確認中...</span>
          </div>
        )}
        <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4 text-left">
          <p className="text-xs text-indigo-800 mb-2">
            <strong>メールが届かない場合：</strong>
          </p>
          <ul className="text-xs text-indigo-700 space-y-1 list-disc list-inside">
            <li>迷惑メールフォルダを確認してください</li>
            <li>メールアドレスが正しいか確認してください</li>
            <li>数分待ってから再度お試しください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

