/**
 * スタッフアカウント用ログインページ
 * スタッフ・管理者向けのログインページ
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { verifyPassword } from '@/utils/password';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

  // 既にログイン済みかチェック、保存されたログイン情報を読み込む
  useEffect(() => {
    const checkSession = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user?.id) {
            // 既にログイン済みなら適切なダッシュボードへ
            if (user.userType === 'client') {
              router.push('/client/dashboard');
            } else {
              router.push('/staff-dashboard');
            }
            return;
          }
        }

        // 保存されたログイン情報を読み込む（30日間有効）
        const savedData = localStorage.getItem('savedLoginData');
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
              localStorage.removeItem('savedLoginData');
            }
          } catch (e) {
            // パースエラーの場合は削除
            localStorage.removeItem('savedLoginData');
          }
        }
      } catch (e) {
        console.error('Session check error:', e);
      }
      setCheckingSession(false);
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // usersテーブルからメールアドレスまたはログインIDで検索（スタッフアカウントのみ）
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${email.toLowerCase()},login_id.eq.${email.toLowerCase()}`)
        .eq('account_status', 'active')
        .neq('user_type', 'client') // 利用者アカウントは除外
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
        name: userData.name || (userData.last_name && userData.first_name ? `${userData.last_name} ${userData.first_name}` : ''),
        lastName: userData.last_name,
        firstName: userData.first_name,
        email: userData.email,
        role: userData.role,
        userType: userData.user_type || 'staff',
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
        localStorage.setItem('savedLoginData', JSON.stringify(savedData));
      } else {
        localStorage.removeItem('savedLoginData');
      }

      // スタッフダッシュボードへリダイレクト
      router.push('/staff-dashboard');
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

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
            <span className="inline-block bg-[#00c4cc] text-white text-xs font-bold px-3 py-1 rounded-full">
              スタッフ向け
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ログイン</h1>
          <p className="text-gray-600 text-sm mt-2">
            ログインIDとパスワードを入力してください
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
              ログインID（メールアドレス）
            </label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
              placeholder="ログインID（メールアドレス）を入力"
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
              ログイン情報を保存する
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.push('/login/forgot-login-id')}
            className="text-xs text-[#00c4cc] hover:underline"
          >
            ログインIDを忘れた場合
          </button>
          <button
            type="button"
            onClick={() => router.push('/login/forgot-password')}
            className="text-xs text-[#00c4cc] hover:underline"
          >
            パスワードを忘れた場合
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600 mb-3">
            アカウントをお持ちでない方
          </p>
          <button
            type="button"
            onClick={() => router.push('/signup')}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
          >
            新規登録
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-center text-xs text-gray-400">
            <button
              onClick={() => router.push('/client/login')}
              className="hover:underline"
            >
              利用者（保護者）の方はこちら
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
