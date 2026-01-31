/**
 * パスワード忘れページ
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
        : 'https://co-shien.inu.co.jp/auth/callback?type=recovery';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">戻る</span>
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00c4cc]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#00c4cc]" />
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
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
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
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="登録時のメールアドレスを入力"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '送信中...' : 'パスワードリセットリンクを送信'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

