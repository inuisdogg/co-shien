/**
 * ログインID忘れページ
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default function ForgotLoginIdPage() {
  const router = useRouter();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginId, setLoginId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoginId(null);

    try {
      // 姓名と生年月日でユーザーを検索
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('login_id, email, last_name, first_name, birth_date')
        .eq('last_name', lastName.trim())
        .eq('first_name', firstName.trim())
        .eq('birth_date', birthDate)
        .maybeSingle();

      if (userError) {
        throw new Error('ユーザー検索に失敗しました');
      }

      if (!userData) {
        throw new Error('入力された情報に一致するアカウントが見つかりませんでした');
      }

      // ログインIDを表示
      setLoginId(userData.login_id || userData.email);
    } catch (err: any) {
      setError(err.message || 'ログインIDの取得に失敗しました');
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
            <User className="w-8 h-8 text-[#00c4cc]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ログインIDを忘れた場合</h1>
          <p className="text-gray-600 text-sm mt-2">
            登録時の情報を入力してください
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
            {error}
          </div>
        )}

        {loginId ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
              <p className="font-bold mb-2">ログインIDが見つかりました</p>
              <p className="break-all bg-white p-2 rounded border border-green-300 mt-2">
                {loginId}
              </p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
            >
              ログイン画面に戻る
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lastName" className="block text-sm font-bold text-gray-700 mb-2">
                  姓 <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="姓を入力"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="firstName" className="block text-sm font-bold text-gray-700 mb-2">
                  名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="名を入力"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="birthDate" className="block text-sm font-bold text-gray-700 mb-2">
                生年月日 <span className="text-red-500">*</span>
              </label>
              <input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '検索中...' : 'ログインIDを表示'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

