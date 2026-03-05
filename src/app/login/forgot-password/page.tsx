/**
 * パスワード忘れページ
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type PortalTheme = {
  bg: string;
  iconBg: string;
  iconText: string;
  button: string;
  focusRing: string;
};

const PORTAL_THEMES: Record<string, PortalTheme> = {
  business: {
    bg: 'from-primary to-primary-dark',
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
    button: 'bg-primary hover:bg-primary-dark',
    focusRing: 'focus:ring-primary',
  },
  career: {
    bg: 'from-personal to-personal-dark',
    iconBg: 'bg-personal/10',
    iconText: 'text-personal',
    button: 'bg-personal hover:bg-personal-dark',
    focusRing: 'focus:ring-personal',
  },
  parent: {
    bg: 'from-client to-client-dark',
    iconBg: 'bg-client/10',
    iconText: 'text-client',
    button: 'bg-client hover:bg-client-dark',
    focusRing: 'focus:ring-client',
  },
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Detect portal context from query param
  const theme = useMemo(() => {
    const portal = searchParams?.get('portal') || 'business';
    return PORTAL_THEMES[portal] || PORTAL_THEMES.business;
  }, [searchParams]);

  const validateEmail = (value: string) => {
    if (!value) return 'メールアドレスを入力してください';
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/.test(value)) return '有効なメールアドレスを入力してください';
    return '';
  };

  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // メールアドレスでユーザーを検索
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (userError) {
        throw new Error('ユーザー検索に失敗しました');
      }

      if (!userData) {
        throw new Error('このメールアドレスは登録されていません');
      }

      // Supabase Authでパスワードリセットメールを送信
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?type=recovery`
        : 'https://roots.inu.co.jp/auth/callback?type=recovery';

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: redirectUrl,
        }
      );

      if (resetError) {
        throw new Error(`パスワードリセットメールの送信に失敗しました: ${resetError.message}`);
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'パスワードリセットに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${theme.bg} p-4`}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">戻る</span>
        </button>

        <div className="text-center mb-8">
          <div className={`w-16 h-16 ${theme.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Lock className={`w-8 h-8 ${theme.iconText}`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">パスワードを忘れた場合</h1>
          <p className="text-gray-600 text-sm mt-2">
            登録時のメールアドレスを入力してください
            <br />
            パスワードリセット用のリンクを送信します
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
              パスワードリセット用のリンクをメールアドレス（{email}）に送信しました。
              <br />
              メールをご確認ください。
            </div>
            <button
              onClick={() => router.push('/career/login')}
              className={`w-full ${theme.button} text-white font-bold py-3 px-4 rounded-md transition-colors`}
            >
              ログイン画面に戻る
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                onBlur={handleEmailBlur}
                required
                autoComplete="email"
                className={`w-full px-4 py-2 border ${emailError ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 ${theme.focusRing} focus:border-transparent`}
                placeholder="登録時のメールアドレスを入力"
                disabled={loading}
              />
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${theme.button} text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  送信中...
                </span>
              ) : 'パスワードリセットリンクを送信'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

