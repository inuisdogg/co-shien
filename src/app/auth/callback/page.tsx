/**
 * Auth コールバックページ（クライアントサイド）
 * Supabaseからのハッシュフラグメントを処理
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URLからtypeを取得
        const type = searchParams.get('type') || 'biz';
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // エラーがある場合
        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          setStatus('error');
          setErrorMessage(errorDescription || error);
          return;
        }

        // ハッシュフラグメントからトークンを取得
        const hash = window.location.hash;

        if (hash) {
          // ハッシュフラグメントをパース
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const hashType = params.get('type');

          if (accessToken && refreshToken) {
            // セッションを設定
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              setStatus('error');
              setErrorMessage(sessionError.message);
              return;
            }

            // typeに応じてリダイレクト
            if (hashType === 'recovery' || type === 'recovery') {
              // パスワードリセットの場合
              router.push('/login/reset-password');
              return;
            } else if (type === 'personal') {
              // パーソナルアカウント認証完了
              router.push('/personal/setup?type=confirm');
              return;
            } else {
              // Bizアカウント認証完了
              router.push('/setup?type=confirm');
              return;
            }
          }
        }

        // codeパラメータがある場合（PKCEフロー）
        const code = searchParams.get('code');
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('Exchange code error:', exchangeError);
            setStatus('error');
            setErrorMessage(exchangeError.message);
            return;
          }

          if (data.session) {
            // typeに応じてリダイレクト
            if (type === 'recovery') {
              router.push('/login/reset-password');
              return;
            } else if (type === 'personal') {
              // usersテーブルを更新
              if (data.user) {
                await supabase
                  .from('users')
                  .update({
                    account_status: 'active',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', data.user.id);
              }
              router.push('/staff-dashboard?verified=true');
              return;
            } else {
              router.push('/setup?type=confirm');
              return;
            }
          }
        }

        // トークンもコードもない場合
        setStatus('error');
        setErrorMessage('認証情報が見つかりません');
      } catch (err: any) {
        console.error('Auth callback exception:', err);
        setStatus('error');
        setErrorMessage(err.message || '認証処理中にエラーが発生しました');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto"></div>
          <p className="mt-4 text-gray-600">認証処理中...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">認証エラー</h2>
          <p className="text-gray-600 text-sm mb-6">{errorMessage}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            ログインページへ戻る
          </button>
        </div>
      </div>
    );
  }

  return null;
}
