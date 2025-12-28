/**
 * 初期管理者アカウント作成ページ
 * 施設がまだ登録されていない場合に、最初の管理者アカウントを作成します
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/utils/password';

export default function AdminSetupPage() {
  const [facilityName, setFacilityName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminLoginId, setAdminLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true); // デフォルトで表示
  const [showConfirmPassword, setShowConfirmPassword] = useState(true); // デフォルトで表示
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // バリデーション
      if (!facilityName.trim()) {
        throw new Error('施設名を入力してください');
      }
      if (!adminName.trim()) {
        throw new Error('管理者名を入力してください');
      }
      if (!adminLoginId.trim()) {
        throw new Error('ログインIDを入力してください');
      }
      if (!password) {
        throw new Error('パスワードを入力してください');
      }
      if (password.length < 6) {
        throw new Error('パスワードは6文字以上で入力してください');
      }
      if (password !== confirmPassword) {
        throw new Error('パスワードが一致しません');
      }

      // 施設コードを自動発番（5桁のランダムな番号、重複チェック付き）
      let facilityCode: string;
      let isUnique = false;
      while (!isUnique) {
        facilityCode = Math.floor(10000 + Math.random() * 90000).toString().padStart(5, '0');
        // 重複チェック
        const { data: existingFacility } = await supabase
          .from('facilities')
          .select('id')
          .eq('code', facilityCode)
          .single();
        if (!existingFacility) {
          isUnique = true;
        }
      }
      
      // 施設IDを生成
      const timestamp = Date.now();
      const facilityId = `facility-${timestamp}`;
      const adminId = `admin-${facilityId}`;

      // パスワードをハッシュ化
      const passwordHash = await hashPassword(password);

      // 施設を作成
      const { error: facilityError } = await supabase
        .from('facilities')
        .insert({
          id: facilityId,
          name: facilityName.trim(),
          code: facilityCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (facilityError) {
        throw new Error(`施設の作成に失敗しました: ${facilityError.message}`);
      }

      // 管理者アカウントを作成
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: adminId,
          facility_id: facilityId,
          name: adminName.trim(),
          login_id: adminLoginId.trim(),
          email: null,
          role: 'admin',
          password_hash: passwordHash,
          has_account: true,
          permissions: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (userError) {
        // 施設を削除（ロールバック）
        await supabase.from('facilities').delete().eq('id', facilityId);
        throw new Error(`管理者アカウントの作成に失敗しました: ${userError.message}`);
      }

      // 施設設定を作成
      const { error: settingsError } = await supabase
        .from('facility_settings')
        .insert({
          facility_id: facilityId,
          facility_name: facilityName.trim(),
          regular_holidays: [0], // 日曜日を定休日
          custom_holidays: [],
          business_hours: {
            AM: { start: '09:00', end: '12:00' },
            PM: { start: '13:00', end: '18:00' },
          },
          capacity: {
            AM: 10,
            PM: 10,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (settingsError) {
        console.error('施設設定の作成エラー（無視）:', settingsError);
        // 施設設定のエラーは無視（後で設定可能）
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || '初期設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">初期設定が完了しました</h2>
            <p className="text-gray-600">ログインページに移動します...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <img
            src="/logo-cropped-center.png"
            alt="co-shien"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">初期管理者アカウント作成</h1>
          <p className="text-gray-600 text-sm mt-2">施設と管理者アカウントを新規登録します</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 border-b border-gray-200 pb-2">施設情報</h3>
            
            <div>
              <label htmlFor="facilityName" className="block text-sm font-bold text-gray-700 mb-2">
                施設名 <span className="text-red-500">*</span>
              </label>
              <input
                id="facilityName"
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="施設名を入力"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">※ 施設名は後で変更できます。施設コードは自動発番されます。</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 border-b border-gray-200 pb-2">管理者アカウント情報</h3>
            
            <div>
              <label htmlFor="adminName" className="block text-sm font-bold text-gray-700 mb-2">
                管理者名 <span className="text-red-500">*</span>
              </label>
              <input
                id="adminName"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="山田 太郎"
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">※ 本名を入力してください</p>
            </div>

            <div>
              <label htmlFor="adminLoginId" className="block text-sm font-bold text-gray-700 mb-2">
                ログインID <span className="text-red-500">*</span>
              </label>
              <input
                id="adminLoginId"
                type="text"
                value={adminLoginId}
                onChange={(e) => setAdminLoginId(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="ログインIDを入力（例: admin）"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">※ ログイン時に使用するIDです</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                    placeholder="6文字以上"
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
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-2">
                  パスワード（確認） <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                    placeholder="パスワードを再入力"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
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
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '作成中...' : '初期設定を完了する'}
          </button>
        </form>
      </div>
    </div>
  );
}

