/**
 * プラットフォームオーナー初期登録ページ
 *
 * このページは以下の条件でのみアクセス可能:
 * 1. system_configテーブルに owner_setup_completed = false
 * 2. または system_configテーブルが空
 *
 * オーナー登録後は二度とアクセスできません。
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/utils/password';
import { Shield, Check, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function OwnerSetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);

  // フォーム
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // オーナー登録済みかどうかをチェック
  useEffect(() => {
    const checkOwnerSetup = async () => {
      try {
        // system_configテーブルを確認
        const { data: config, error: configError } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'owner_setup_completed')
          .maybeSingle();

        if (configError) {
          // テーブルが存在しない場合は未セットアップ扱い
          console.log('system_configテーブルの確認エラー:', configError);
          setAlreadySetup(false);
        } else if (config?.value === 'true') {
          // 既にセットアップ済み
          setAlreadySetup(true);
        } else {
          setAlreadySetup(false);
        }
      } catch (err) {
        console.error('オーナーセットアップ確認エラー:', err);
        setAlreadySetup(false);
      } finally {
        setChecking(false);
      }
    };

    checkOwnerSetup();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // バリデーション
      if (!ownerName.trim()) {
        throw new Error('オーナー名を入力してください');
      }
      if (!ownerEmail.trim()) {
        throw new Error('メールアドレスを入力してください');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(ownerEmail.trim())) {
        throw new Error('正しいメールアドレスを入力してください');
      }
      if (!password) {
        throw new Error('パスワードを入力してください');
      }
      if (password.length < 8) {
        throw new Error('パスワードは8文字以上で入力してください');
      }
      if (password !== confirmPassword) {
        throw new Error('パスワードが一致しません');
      }

      // パスワードハッシュ化
      const passwordHash = await hashPassword(password);

      // オーナーユーザーを作成
      const ownerId = `owner-${Date.now()}`;
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: ownerId,
          name: ownerName.trim(),
          login_id: ownerEmail.trim(),
          email: ownerEmail.trim(),
          role: 'owner', // プラットフォームオーナー
          user_type: 'owner',
          password_hash: passwordHash,
          has_account: true,
          account_status: 'active',
          activated_at: new Date().toISOString(),
          permissions: {
            platform_admin: true,
            manage_facilities: true,
            manage_users: true,
            manage_system: true,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (userError) {
        throw new Error(`オーナーアカウントの作成に失敗しました: ${userError.message}`);
      }

      // system_configにセットアップ完了を記録
      const { error: configError } = await supabase
        .from('system_config')
        .upsert({
          key: 'owner_setup_completed',
          value: 'true',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (configError) {
        console.error('system_config更新エラー:', configError);
        // エラーでも続行（オーナーは作成されている）
      }

      setSuccess(true);

      // 3秒後にログインページへリダイレクト
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'オーナー登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 確認中
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">確認中...</h2>
          <p className="text-gray-600">システム状態を確認しています</p>
        </div>
      </div>
    );
  }

  // 既にセットアップ済み
  if (alreadySetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">アクセス不可</h2>
          <p className="text-gray-600 mb-6">
            プラットフォームオーナーは既に登録されています。<br />
            このページにはアクセスできません。
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            ログインページへ
          </button>
        </div>
      </div>
    );
  }

  // 成功画面
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">オーナー登録完了</h2>
          <p className="text-gray-600 mb-4">
            プラットフォームオーナーとして登録されました。<br />
            ログインページへリダイレクトします...
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-600 mb-1">メールアドレス:</p>
            <p className="font-mono text-gray-800">{ownerEmail}</p>
          </div>
        </div>
      </div>
    );
  }

  // 登録フォーム
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-slate-800" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">プラットフォームオーナー登録</h1>
          <p className="text-gray-600 text-sm mt-2">
            co-shienの最初の管理者として登録します
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-bold mb-1">重要</p>
              <p>
                このページは一度しか使用できません。<br />
                ここで登録したアカウントがプラットフォーム全体の管理者となります。
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="ownerName" className="block text-sm font-bold text-gray-700 mb-2">
              オーナー名 <span className="text-red-500">*</span>
            </label>
            <input
              id="ownerName"
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              placeholder="あなたの名前"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="ownerEmail" className="block text-sm font-bold text-gray-700 mb-2">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              placeholder="owner@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
              パスワード <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="8文字以上"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? '隠す' : '表示'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-2">
              パスワード（確認） <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              placeholder="パスワードを再入力"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登録中...' : 'オーナーとして登録'}
          </button>
        </form>
      </div>
    </div>
  );
}
