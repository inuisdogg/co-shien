/**
 * プラットフォームオーナー初期登録ページ
 *
 * このページは以下の条件でのみアクセス可能:
 * 1. system_configテーブルに owner_setup_completed = false
 * 2. または system_configテーブルが空
 *
 * フロー:
 * 1. 未ログイン → キャリアアカウント作成/ログインへ誘導
 * 2. ログイン済み → そのアカウントにオーナー権限を付与
 *
 * オーナー登録後は二度とアクセスできません。
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Shield, Check, AlertTriangle, LogIn, UserPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface UserData {
  id: string;
  name: string;
  email: string;
  login_id: string;
  role: string;
  userType: string;
}

export default function OwnerSetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // オーナー登録済みかどうか & ログイン状態をチェック
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // system_configテーブルを確認
        const { data: config, error: configError } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'owner_setup_completed')
          .maybeSingle();

        if (configError) {
          console.log('system_configテーブルの確認エラー:', configError);
          setAlreadySetup(false);
        } else if (config?.value === 'true') {
          setAlreadySetup(true);
          setChecking(false);
          return;
        } else {
          setAlreadySetup(false);
        }

        // ログイン状態を確認
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user?.id) {
            setCurrentUser(user);
          }
        }
      } catch (err) {
        console.error('ステータス確認エラー:', err);
        setAlreadySetup(false);
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, []);

  // 現在のユーザーをオーナーに昇格
  const handleBecomeOwner = async () => {
    if (!currentUser) return;

    setError('');
    setLoading(true);

    try {
      // ユーザーのroleをownerに更新
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: 'owner',
          permissions: {
            platform_admin: true,
            manage_facilities: true,
            manage_users: true,
            manage_system: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (updateError) {
        throw new Error(`オーナー権限の付与に失敗しました: ${updateError.message}`);
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
      }

      // ローカルストレージのユーザー情報を更新
      const updatedUser = {
        ...currentUser,
        role: 'owner',
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setSuccess(true);

      // 2秒後に管理画面へリダイレクト
      setTimeout(() => {
        router.push('/admin');
      }, 2000);

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
            onClick={() => router.push('/career/login')}
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">オーナー登録完了！</h2>
          <p className="text-gray-600 mb-4">
            プラットフォームオーナーとして登録されました。<br />
            管理画面へ移動します...
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-600 mb-1">アカウント:</p>
            <p className="font-mono text-gray-800">{currentUser?.email}</p>
          </div>
        </div>
      </div>
    );
  }

  // 未ログイン → ログイン/登録への誘導
  if (!currentUser) {
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              オーナーになるには、まずキャリアアカウントが必要です。<br />
              アカウントを作成またはログインしてください。
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/career/signup?redirect=/owner-setup')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              キャリアアカウントを新規作成
            </button>

            <button
              onClick={() => router.push('/career/login?redirect=/owner-setup')}
              className="w-full bg-white border-2 border-slate-800 text-slate-800 hover:bg-slate-50 font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              既存アカウントでログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ログイン済み → オーナー権限付与の確認
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
                以下のアカウントがプラットフォーム全体の管理者となります。
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
            {error}
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500 mb-2">現在ログイン中のアカウント</p>
          <p className="font-bold text-gray-800">{currentUser.name || '名前未設定'}</p>
          <p className="text-sm text-gray-600">{currentUser.email}</p>
        </div>

        <button
          onClick={handleBecomeOwner}
          disabled={loading}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登録中...' : 'このアカウントをオーナーにする'}
        </button>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              localStorage.removeItem('user');
              window.location.reload();
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            別のアカウントを使用する
          </button>
        </div>
      </div>
    </div>
  );
}
