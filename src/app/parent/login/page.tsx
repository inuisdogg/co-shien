/**
 * 利用者（保護者）アカウント用ログインページ
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { startAuthentication } from '@simplewebauthn/browser';

export const dynamic = 'force-dynamic';

export default function ClientLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [sessionCheckTimedOut, setSessionCheckTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setSessionCheckTimedOut(true);
    }, 8000);

    const checkSession = async () => {
      try {
        // セッション有効期限チェック
        const sessionExpires = localStorage.getItem('session_expires');
        if (sessionExpires && Date.now() > parseInt(sessionExpires, 10)) {
          localStorage.removeItem('user');
          localStorage.removeItem('facility');
          localStorage.removeItem('session_expires');
        }

        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user?.id && user?.userType === 'client') {
            router.push(redirectPath || '/parent');
            return;
          }
        }

        const savedData = localStorage.getItem('savedLoginData');
        if (savedData) {
          try {
            const data = JSON.parse(savedData);
            const savedDate = new Date(data.savedAt);
            const daysSinceSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSinceSaved <= 30) {
              if (data.email) setEmail(data.email);
              setRememberMe(true);
            } else {
              localStorage.removeItem('savedLoginData');
            }
          } catch (e) {
            localStorage.removeItem('savedLoginData');
          }
        }
      } catch (e) {
        console.error('Session check error:', e);
      }
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        setPasskeySupported(true);
      }

      if (!cancelled) {
        setCheckingSession(false);
        clearTimeout(timeout);
      }
    };
    checkSession();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // サーバーサイドAPIでパスワード検証（password_hashをクライアントに露出させない）
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityCode: '',
          loginId: email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ログインに失敗しました');
      }

      const userData = data.user;

      // 保護者アカウント以外はブロック
      if (userData.user_type !== 'client') {
        throw new Error('このアカウントは保護者アカウントではありません。スタッフの方はキャリアログインをご利用ください。');
      }

      const user = {
        id: userData.id,
        name: userData.name || (userData.last_name && userData.first_name ? `${userData.last_name} ${userData.first_name}` : ''),
        lastName: userData.last_name,
        firstName: userData.first_name,
        email: userData.email,
        role: userData.role,
        userType: 'client',
        account_status: userData.account_status,
      };
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('session_expires', (Date.now() + 8 * 60 * 60 * 1000).toString());

      if (rememberMe) {
        const savedData = {
          email,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem('savedLoginData', JSON.stringify(savedData));
      } else {
        localStorage.removeItem('savedLoginData');
      }

      // リダイレクト先がある場合はそちらへ、なければダッシュボードへ
      router.push(redirectPath || '/parent');
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!email.trim()) {
      setError('パスキーでログインするにはメールアドレスを入力してください');
      return;
    }
    setError('');
    setPasskeyLoading(true);
    try {
      const beginRes = await fetch('/api/passkey/authenticate/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: email.toLowerCase() }),
      });
      if (!beginRes.ok) {
        const err = await beginRes.json();
        throw new Error(
          err.error === 'No passkeys found for this user'
            ? 'このアカウントにパスキーが登録されていません'
            : err.error === 'User not found'
            ? 'ユーザーが見つかりません'
            : 'パスキー認証を開始できませんでした'
        );
      }
      const options = await beginRes.json();
      const credential = await startAuthentication({ optionsJSON: options });
      const finishRes = await fetch('/api/passkey/authenticate/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, loginId: email.toLowerCase() }),
      });
      if (!finishRes.ok) {
        throw new Error('パスキー認証に失敗しました');
      }
      const { userId } = await finishRes.json();
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (!userData) throw new Error('ユーザー情報の取得に失敗しました');
      const user = {
        id: userData.id,
        name: userData.name || (userData.last_name && userData.first_name ? `${userData.last_name} ${userData.first_name}` : ''),
        lastName: userData.last_name,
        firstName: userData.first_name,
        email: userData.email,
        role: userData.role,
        userType: 'client',
        account_status: userData.account_status,
      };
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('session_expires', (Date.now() + 8 * 60 * 60 * 1000).toString());
      window.location.href = redirectPath || '/parent';
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('パスキー認証がキャンセルされました');
      } else if (err.name === 'AbortError') {
        setError('パスキー認証がタイムアウトしました。もう一度お試しください。');
      } else if (err.name === 'InvalidStateError') {
        setError('パスキーが見つかりません。パスワードでログインしてください。');
      } else {
        setError(err.message || 'パスキー認証に失敗しました');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-client-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-client mx-auto"></div>
          {sessionCheckTimedOut && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">接続に時間がかかっています</p>
              <button
                onClick={() => setCheckingSession(false)}
                className="mt-2 text-sm text-client hover:underline"
              >
                ログイン画面を表示
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-client-light p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={180}
            height={56}
            className="h-14 w-auto mx-auto mb-4"
            priority
          />
          <div className="mb-3">
            <span className="inline-block bg-client/10 text-client text-xs font-bold px-3 py-1 rounded-lg">
              保護者
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ログイン</h1>
          <p className="text-gray-500 text-sm mt-1">
            ログインIDとパスワードを入力してください
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1.5">
              ログインID（メールアドレス）
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="w-full h-12 pl-10 pr-4 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client transition-all"
                placeholder="example@email.com"
                disabled={loading || passkeyLoading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1.5">
              パスワード
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-12 pl-10 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client transition-all"
                placeholder="パスワードを入力"
                disabled={loading || passkeyLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
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

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-client border-gray-300 rounded focus:ring-client"
                disabled={loading}
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-600">
                ログイン情報を保存
              </label>
            </div>
            <button
              type="button"
              onClick={() => router.push('/login/forgot-password')}
              className="text-xs text-client hover:underline"
            >
              パスワードを忘れた場合
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-client hover:bg-client-dark text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ログイン中...
              </>
            ) : 'ログイン'}
          </button>

          {passkeySupported && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">または</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={passkeyLoading || loading}
                className="w-full h-12 bg-white border border-gray-200 text-gray-700 hover:border-client hover:text-client-dark font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {passkeyLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-client border-t-transparent rounded-full animate-spin" />
                    認証中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                    </svg>
                    Face ID / 指紋でログイン
                  </>
                )}
              </button>
            </>
          )}
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-center text-sm text-gray-500 mb-3">
            アカウントをお持ちでない方
          </p>
          <button
            type="button"
            onClick={() => router.push(redirectPath ? `/parent/signup?redirect=${encodeURIComponent(redirectPath)}` : '/parent/signup')}
            className="w-full h-12 bg-white border border-gray-200 text-gray-700 hover:border-client hover:text-client font-bold rounded-lg transition-colors text-sm min-w-[120px]"
          >
            保護者として新規登録
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center gap-4">
          <button
            onClick={() => router.push('/login/forgot-login-id')}
            className="text-xs text-gray-400 hover:text-client hover:underline"
          >
            ログインIDを忘れた場合
          </button>
          <span className="text-xs text-gray-300">|</span>
          <button
            onClick={() => router.push('/career/login')}
            className="text-xs text-gray-400 hover:text-personal hover:underline"
          >
            スタッフの方はこちら
          </button>
        </div>
      </div>
    </div>
  );
}
