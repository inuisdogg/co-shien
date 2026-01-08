/**
 * セットアップページ（Personal側）
 * メール認証完了後、ウェルカムメールを送信
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 静的生成をスキップ（useSearchParamsを使用するため）
export const dynamic = 'force-dynamic';

export default function PersonalSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const setupPersonal = async () => {
      try {
        setLoading(true);
        setError('');

        // メール認証が完了しているか確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.user) {
          setError('ログインが必要です');
          router.push('/personal/signup');
          return;
        }

        // メール認証が完了しているか確認
        if (!session.user.email_confirmed_at) {
          setError('メール認証が完了していません');
          router.push('/personal/signup?waiting=true');
          return;
        }

        // 登録時のメールアドレスを確認（別ユーザーでログインされないように）
        const pendingEmail = localStorage.getItem('pending_signup_email');
        const sessionEmail = session.user.email?.toLowerCase();

        // セッションのメールが登録時のメールと異なる場合は警告
        if (pendingEmail && sessionEmail && pendingEmail !== sessionEmail) {
          console.warn('Session email mismatch:', { pendingEmail, sessionEmail });
          // 古いセッションを破棄して再ログインを促す
          await supabase.auth.signOut();
          localStorage.removeItem('user');
          setError('セッションエラーが発生しました。再度ログインしてください。');
          router.push('/login');
          return;
        }

        // ユーザー情報を取得
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email, name, account_status')
          .eq('email', session.user.email)
          .single();

        if (!existingUser) {
          setError('ユーザー情報が見つかりません');
          return;
        }

        // account_statusをactiveに更新（まだpendingの場合）
        if (existingUser.account_status === 'pending') {
          await supabase
            .from('users')
            .update({
              account_status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUser.id);
        }

        // 既にウェルカムメールが送信されているか確認（localStorageで管理）
        const welcomeEmailSent = localStorage.getItem(`welcome_email_sent_${existingUser.id}`);
        if (welcomeEmailSent === 'true') {
          setEmailSent(true);
          // 既にメール送信済みの場合、自動的にログインして遷移
          await autoLoginAndRedirect(existingUser);
          return;
        }

        // ウェルカムメールを送信
        try {
          const response = await fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: existingUser.email,
              name: existingUser.name,
              type: 'personal',
            }),
          });

          if (!response.ok) {
            console.error('ウェルカムメール送信に失敗しました');
            // メール送信エラーは無視
          } else {
            setEmailSent(true);
            localStorage.setItem(`welcome_email_sent_${existingUser.id}`, 'true');
          }
        } catch (emailError) {
          console.error('ウェルカムメール送信エラー:', emailError);
          // メール送信エラーは無視
        }

        // 本登録完了後、自動的にログインして遷移
        await autoLoginAndRedirect(existingUser);
        setLoading(false);
      } catch (err: any) {
        console.error('Setup error:', err);
        setError(err.message || 'セットアップに失敗しました');
        setLoading(false);
      }
    };

    setupPersonal();
  }, [router]);

  // 自動ログインとリダイレクト処理
  const autoLoginAndRedirect = async (userData: any) => {
    try {
      // ユーザー情報をlocalStorageに保存（ログイン状態を設定）
      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        account_status: 'active', // 認証完了したのでactive
      };
      localStorage.setItem('user', JSON.stringify(user));

      // 登録時のメール確認用フラグをクリア
      localStorage.removeItem('pending_signup_email');

      // スタッフダッシュボードへリダイレクト（パーソナル単体利用）
      // 施設への参加は後からダッシュボードからできる
      router.push('/staff-dashboard');
    } catch (err: any) {
      console.error('自動ログインエラー:', err);
      // エラーでも続行（手動ログインを促す）
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">セットアップ中...</h2>
          <p className="text-gray-600">ウェルカムメールを送信しています</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">エラー</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/personal/signup')}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            サインアップページに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">セットアップ完了</h2>
          <p className="text-gray-600 text-sm mb-6">
            {emailSent 
              ? 'ウェルカムメールを送信しました。メールボックスをご確認ください。' 
              : 'セットアップが完了しました'}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-center text-sm text-gray-600 mb-4">
            ダッシュボードに移動しています...
          </p>
          <button
            type="button"
            onClick={() => {
              // スタッフダッシュボードへリダイレクト（パーソナル単体利用）
              router.push('/staff-dashboard');
            }}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            ダッシュボードへ
          </button>
        </div>
      </div>
    </div>
  );
}

