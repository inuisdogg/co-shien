/**
 * Personal用ログインページ（スタッフ向け）
 * my.co-shien.inu.co.jp でアクセスされた場合に表示される
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { verifyPassword } from '@/utils/password';
import { usePasskeyAuth } from '@/components/auth/PasskeyAuth';

export default function PersonalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { authenticatePasskey, isSupported, isAuthenticating, checkSupport } = usePasskeyAuth();
  
  // リダイレクト先を取得（クエリパラメータから）
  const redirectTo = searchParams?.get('redirect') || '/staff-dashboard';

  // WebAuthnサポート確認
  useEffect(() => {
    if (typeof window !== 'undefined') {
      checkSupport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 保存されたログイン情報を読み込む（30日間有効）
  useEffect(() => {
    const savedData = localStorage.getItem('savedLoginData_personal');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const savedDate = new Date(data.savedAt);
        const daysSinceSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // 30日以内なら読み込む
        if (daysSinceSaved <= 30) {
          if (data.email) {
            setEmail(data.email);
          }
          if (data.password) {
            setPassword(data.password);
          }
          setRememberMe(true);
        } else {
          // 30日を超えていたら削除
          localStorage.removeItem('savedLoginData_personal');
        }
      } catch (e) {
        // パースエラーの場合は削除
        localStorage.removeItem('savedLoginData_personal');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // usersテーブルからメールアドレスで検索
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('account_status', 'active')
        .single();

      if (userError || !userData) {
        throw new Error('メールアドレスまたはパスワードが正しくありません');
      }

      if (!userData.password_hash) {
        throw new Error('このアカウントにはパスワードが設定されていません');
      }

      const isValid = await verifyPassword(password, userData.password_hash);
      if (!isValid) {
        throw new Error('メールアドレスまたはパスワードが正しくありません');
      }

      // ユーザー情報をlocalStorageに保存
      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        account_status: userData.account_status,
      };
      localStorage.setItem('user', JSON.stringify(user));

      // ログイン情報を保存するかどうか（30日間有効）
      if (rememberMe) {
        const savedData = {
          email,
          password, // パスワードも保存（30日間）
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem('savedLoginData_personal', JSON.stringify(savedData));
      } else {
        localStorage.removeItem('savedLoginData_personal');
      }
      // ログイン成功後、パスワードをリセット（保存しない場合のみ）
      if (!rememberMe) {
        setPassword('');
      }

      // リダイレクト先に移動（クエリパラメータで指定された場合はそこへ、なければデフォルト）
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // パスキー認証処理
  const handlePasskeyLogin = async () => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }
    setError('');
    try {
      // 個人向けなのでfacilityCodeは空文字列
      const result = await authenticatePasskey('', email);
      
      // パスキー認証成功後、ユーザー情報を取得してログイン処理
      if (result && result.userId) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', result.userId)
          .eq('account_status', 'active')
          .single();

        if (userError || !userData) {
          throw new Error('ユーザー情報の取得に失敗しました');
        }

        // ユーザー情報をlocalStorageに保存
        const user = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          account_status: userData.account_status,
        };
        localStorage.setItem('user', JSON.stringify(user));

        // リダイレクト先に移動
        router.push(redirectTo);
      } else {
        throw new Error('パスキー認証に失敗しました');
      }
    } catch (err: any) {
      setError(err.message || 'パスキー認証に失敗しました');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo-cropped-center.png"
            alt="co-shien"
            width={200}
            height={64}
            className="h-16 w-auto mx-auto mb-4"
            priority
          />
          <div className="mb-2">
            <span className="inline-block bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              Personal（スタッフ向け）
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ログイン</h1>
          <p className="text-gray-600 text-sm mt-2">メールアドレスとパスワードを入力してください</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
              placeholder="メールアドレスを入力"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
              パスワード
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="パスワードを入力"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
              disabled={loading}
            />
            <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-600">
              ログイン情報を30日間保存する
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || isAuthenticating}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        {isSupported && (
          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">または</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={loading || isAuthenticating || !email}
              className="mt-4 w-full bg-white hover:bg-gray-50 text-[#00c4cc] border-2 border-[#00c4cc] font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  認証中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  パスキーでログイン
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
          <p className="text-center text-sm text-gray-600">
            アカウントをお持ちでない方は{' '}
            <button
              onClick={() => router.push('/personal/signup')}
              className="text-[#00c4cc] hover:underline font-bold"
            >
              こちらから新規登録
            </button>
          </p>
          <p className="text-center text-xs text-gray-400">
            <button
              onClick={() => window.location.href = 'https://biz.co-shien.inu.co.jp/'}
              className="hover:underline"
            >
              Biz側でログイン
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

