/**
 * セットアップページ（Biz側）
 * メール認証完了後、施設ID発行 + パーソナルアカウント作成 + パスワード設定 + 自動Bizログイン
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { hashPassword } from '@/utils/password';

// 静的生成をスキップ（useSearchParamsとuseAuthを使用するため）
export const dynamic = 'force-dynamic';

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [step, setStep] = useState<'setup' | 'password' | 'complete'>('setup');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [facilityCode, setFacilityCode] = useState<string | null>(null);
  const [facilityName, setFacilityName] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // ステップ1: 施設ID発行 + パーソナルアカウント作成準備
  useEffect(() => {
    const setupFacility = async () => {
      if (step !== 'setup') return;

      try {
        setLoading(true);
        setError('');

        // メール認証が完了しているか確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.user) {
          setError('ログインが必要です');
          router.push('/signup');
          return;
        }

        // メール認証が完了しているか確認
        if (!session.user.email_confirmed_at) {
          setError('メール認証が完了していません');
          router.push('/signup/waiting');
          return;
        }

        // 既に施設が作成されているか確認
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email, name, facility_id')
          .eq('email', session.user.email)
          .single();

        // 既に施設IDが発行されている場合、パスワード設定画面へ
        if (existingUser?.facility_id) {
          const { data: facility } = await supabase
            .from('facilities')
            .select('code')
            .eq('id', existingUser.facility_id)
            .single();

          if (facility) {
            setFacilityCode(facility.code);
            setName(existingUser.name || '');
            setStep('password');
            setLoading(false);
            return;
          }
        }

        // 施設IDを生成（5桁のランダムな番号、重複チェック付き）
        let newFacilityCode: string = '';
        let isUnique = false;
        do {
          newFacilityCode = Math.floor(10000 + Math.random() * 90000).toString().padStart(5, '0');
          const { data: existingFacility } = await supabase
            .from('facilities')
            .select('id')
            .eq('code', newFacilityCode)
            .single();
          if (!existingFacility) {
            isUnique = true;
          }
        } while (!isUnique);

        // 施設を作成
        const timestamp = Date.now();
        const facilityId = `facility-${timestamp}`;

        const { error: facilityError } = await supabase
          .from('facilities')
          .insert({
            id: facilityId,
            name: '新規施設', // デフォルト名（後で変更可能）
            code: newFacilityCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (facilityError) {
          throw new Error(`施設の作成に失敗しました: ${facilityError.message}`);
        }

        // パーソナルアカウント（usersテーブル）を作成または更新
        const userId = session.user.id;
        const userEmail = session.user.email!;
        const userName = session.user.user_metadata?.name || userEmail.split('@')[0];

        // usersテーブルにユーザー情報を保存（パスワードは後で設定）
        const { error: userError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            name: userName,
            email: userEmail,
            login_id: userEmail,
            facility_id: facilityId,
            role: 'admin',
            account_status: 'active',
            has_account: true,
            activated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          });

        if (userError) {
          // 施設を削除（ロールバック）
          await supabase.from('facilities').delete().eq('id', facilityId);
          throw new Error(`ユーザーアカウントの作成に失敗しました: ${userError.message}`);
        }

        // 施設設定を作成
        await supabase
          .from('facility_settings')
          .insert({
            facility_id: facilityId,
            facility_name: '新規施設',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        setFacilityCode(newFacilityCode);
        setName(userName);

        // パスワード設定画面へ
        setStep('password');
        setLoading(false);
      } catch (err: any) {
        console.error('Setup error:', err);
        setError(err.message || 'セットアップに失敗しました');
        setLoading(false);
      }
    };

    setupFacility();
  }, [step, router]);

  // パスワード設定と自動ログイン
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!facilityName.trim()) {
      setError('施設名を入力してください');
      return;
    }

    if (!name.trim()) {
      setError('氏名を入力してください');
      return;
    }

    if (!password) {
      setError('パスワードを入力してください');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('セッションが無効です');
      }

      // パスワードをハッシュ化
      const passwordHash = await hashPassword(password);

      // usersテーブルを更新（名前とパスワードを設定）
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', session.user.id)
        .single();

      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (updateError) {
        throw new Error(`パスワードの設定に失敗しました: ${updateError.message}`);
      }

      // 施設名を更新
      if (userData?.facility_id) {
        await supabase
          .from('facilities')
          .update({
            name: facilityName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userData.facility_id);

        await supabase
          .from('facility_settings')
          .update({
            facility_name: facilityName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('facility_id', userData.facility_id);
      }

      // Supabase Authのパスワードも更新
      const { error: authUpdateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          name: name.trim(),
        }
      });

      if (authUpdateError) {
        console.error('Supabase Authのパスワード更新エラー:', authUpdateError);
        // エラーでも続行（usersテーブルには保存済み）
      }

      // 自動Bizログイン
      if (facilityCode) {
        await login(facilityCode, session.user.email!, password);
        
        // 本登録完了メールを2通送信（個人アカウント発行メール + 施設IDメール）
        try {
          // 1. 個人アカウント発行のお知らせ
          const personalAccountResponse = await fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: session.user.email,
              name: name.trim(),
              mailType: 'personal_account',
            }),
          });

          // 2. 施設IDを記したお知らせ
          const facilityIdResponse = await fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: session.user.email,
              name: name.trim(),
              facilityCode: facilityCode,
              mailType: 'facility_id',
            }),
          });

          if (personalAccountResponse.ok && facilityIdResponse.ok) {
            setEmailSent(true);
          }
        } catch (emailError) {
          console.error('ウェルカムメール送信エラー:', emailError);
          // メール送信エラーは無視（本登録は完了している）
        }
        
        setStep('complete');
        // Bizのログイン突破後の画面にリダイレクト
        setTimeout(() => {
          router.push('/biz');
        }, 1500);
      } else {
        throw new Error('施設IDが見つかりません');
      }
    } catch (err: any) {
      console.error('Password setup error:', err);
      setError(err.message || 'パスワード設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">セットアップ中...</h2>
          <p className="text-gray-600">施設IDを発行しています</p>
        </div>
      </div>
    );
  }

  if (error && step === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">エラー</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/signup')}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            サインアップページに戻る
          </button>
        </div>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-6">
            <Image
              src="/logo-cropped-center.png"
              alt="co-shien"
              width={200}
              height={64}
              className="h-16 w-auto mx-auto mb-4"
              priority
            />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">本登録を完了</h2>
            <p className="text-gray-600 text-sm mb-4">
              {facilityCode && `施設ID: ${facilityCode}`}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-6">
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
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
                管理者氏名 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="管理者の氏名を入力"
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
                  minLength={6}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="6文字以上で入力"
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
                  minLength={6}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '設定中...' : '本登録を完了してログイン'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">本登録完了！</h2>
          <p className="text-gray-600 mb-6">ダッシュボードに移動します...</p>
        </div>
      </div>
    );
  }

  return null;
}
