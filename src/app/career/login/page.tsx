/**
 * キャリアアカウント用ログインページ
 * スタッフ・専門家向けのログインページ
 *
 * キャリアアカウントでログイン後：
 * - /career: 個人キャリア管理ダッシュボード
 * - /business: 施設所属があれば施設管理ダッシュボード
 * - /babysitter/staff: シッターとして活動
 * - /consultation/dashboard: 専門家として活動
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { verifyPassword } from '@/utils/password';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function CareerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
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
            // リダイレクト先がある場合はそちらを優先
            if (redirectTo) {
              router.push(redirectTo);
            } else if (user.userType === 'client') {
              router.push('/parent');
            } else {
              // キャリアログインは常にキャリアダッシュボードへ
              // オーナーもキャリアダッシュボードから管理画面へアクセス可能
              router.push('/career');
            }
            return;
          }
        }

        // 保存されたログイン情報を読み込む（30日間有効）
        const savedData = localStorage.getItem('savedCareerLoginData');
        if (savedData) {
          try {
            const data = JSON.parse(savedData);
            const savedDate = new Date(data.savedAt);
            const daysSinceSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

            // 30日以内なら読み込む
            if (daysSinceSaved <= 30) {
              if (data.email) setEmail(data.email);
              setRememberMe(true);
            } else {
              localStorage.removeItem('savedCareerLoginData');
            }
          } catch (e) {
            localStorage.removeItem('savedCareerLoginData');
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
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem('savedCareerLoginData', JSON.stringify(savedData));
      } else {
        localStorage.removeItem('savedCareerLoginData');
      }

      // リダイレクト先の決定（window.location.hrefでハードナビゲーション）
      // これにより AuthContext が localStorage から正しくデータを読み込む
      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        window.location.href = '/career';
      }
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8] to-[#6366F1]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8]/90 to-[#6366F1] p-4">
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
            <span className="inline-block bg-[#818CF8]/10 text-[#818CF8] text-xs font-bold px-3 py-1 rounded-lg">
              スタッフ / 施設管理
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ログイン</h1>
          <p className="text-gray-500 text-sm mt-1">
            スタッフ・専門家の方はこちらからログイン
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
                className="w-full h-12 pl-10 pr-4 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8] transition-all"
                placeholder="example@email.com"
                disabled={loading}
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
                className="w-full h-12 pl-10 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8] transition-all"
                placeholder="パスワードを入力"
                disabled={loading}
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
                className="w-4 h-4 text-[#818CF8] border-gray-300 rounded focus:ring-[#818CF8]"
                disabled={loading}
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-600">
                ログイン情報を保存
              </label>
            </div>
            <button
              type="button"
              onClick={() => router.push('/login/forgot-password')}
              className="text-xs text-[#818CF8] hover:underline"
            >
              パスワードを忘れた場合
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#818CF8] hover:bg-[#6366F1] text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ログイン中...
              </>
            ) : 'ログイン'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-center text-sm text-gray-500 mb-3">
            アカウントをお持ちでない方
          </p>
          <button
            type="button"
            onClick={() => router.push('/career/signup')}
            className="w-full h-12 bg-white border border-gray-200 text-gray-700 hover:border-[#818CF8] hover:text-[#818CF8] font-bold rounded-lg transition-colors text-sm min-w-[120px]"
          >
            新規登録
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center gap-4">
          <button
            onClick={() => router.push('/login/forgot-login-id')}
            className="text-xs text-gray-400 hover:text-[#818CF8] hover:underline"
          >
            ログインIDを忘れた場合
          </button>
          <span className="text-xs text-gray-300">|</span>
          <button
            onClick={() => router.push('/parent/login')}
            className="text-xs text-gray-400 hover:text-[#F472B6] hover:underline"
          >
            保護者の方はこちら
          </button>
        </div>

        {/* デバッグ用セクション（開発環境のみ） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
            <p className="text-center text-xs text-gray-400 mb-2">
              [開発用デバッグ]
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('user');
                localStorage.removeItem('savedCareerLoginData');
                alert('セッションをクリアしました。ページを再読み込みします。');
                window.location.reload();
              }}
              className="w-full text-xs text-red-500 hover:text-red-700 py-1"
            >
              セッションをクリア
            </button>
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              現在のセッション: {typeof window !== 'undefined' && localStorage.getItem('user') ? '有り' : 'なし'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
