/**
 * 施設招待受け取りページ
 * オーナーからの招待リンクを受け取り、施設管理者として登録する
 *
 * フロー:
 * 1. トークン検証
 * 2. キャリアアカウント作成（未登録の場合）
 * 3. 施設管理者として登録
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/utils/password';
import { Building2, User, Lock, Mail, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface FacilityInfo {
  id: string;
  name: string;
  companyName: string;
}

type Step = 'loading' | 'invalid' | 'account' | 'complete';

export default function FacilityInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [facility, setFacility] = useState<FacilityInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // アカウント作成フォーム
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // トークン検証
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setStep('invalid');
        return;
      }

      try {
        // トークンから施設情報を取得
        const { data: tokenData, error: tokenError } = await supabase
          .from('facility_registration_tokens')
          .select(`
            facility_id,
            expires_at,
            facilities (
              id,
              name,
              pre_registered,
              companies (name)
            )
          `)
          .eq('token', token)
          .single();

        if (tokenError || !tokenData) {
          console.error('Token validation error:', tokenError);
          setStep('invalid');
          return;
        }

        // 有効期限チェック
        if (new Date(tokenData.expires_at) < new Date()) {
          setError('この招待リンクは有効期限切れです。管理者に新しいリンクを発行してもらってください。');
          setStep('invalid');
          return;
        }

        // 施設情報をセット
        const facilityData = tokenData.facilities as any;
        setFacility({
          id: facilityData.id,
          name: facilityData.name,
          companyName: facilityData.companies?.name || facilityData.name,
        });

        // 既にログイン済みの場合は直接登録処理へ
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const userData = JSON.parse(userStr);
          await completeFacilityRegistration(userData.id, facilityData.id);
        } else {
          setStep('account');
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setStep('invalid');
      }
    };

    validateToken();
  }, [token]);

  // 施設登録完了処理
  const completeFacilityRegistration = async (userId: string, facilityId: string) => {
    try {
      // 施設のオーナーとして設定
      const { error: updateError } = await supabase
        .from('facilities')
        .update({
          pre_registered: false,
          verification_status: 'verified',
          owner_user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', facilityId);

      if (updateError) {
        console.error('Facility update error:', updateError);
      }

      // employment_recordsに管理者として追加
      const { error: empError } = await supabase
        .from('employment_records')
        .upsert({
          user_id: userId,
          facility_id: facilityId,
          start_date: new Date().toISOString().split('T')[0],
          role: '管理者',
          employment_type: '常勤',
          permissions: {
            admin: true,
            manage_staff: true,
            manage_children: true,
            manage_schedules: true,
            manage_billing: true,
          },
        }, {
          onConflict: 'user_id,facility_id',
        });

      if (empError) {
        console.error('Employment record error:', empError);
      }

      // トークンを無効化（使用済みに）
      await supabase
        .from('facility_registration_tokens')
        .delete()
        .eq('token', token);

      setStep('complete');
    } catch (err) {
      console.error('Registration completion error:', err);
      setError('登録処理中にエラーが発生しました');
    }
  };

  // アカウント作成＆施設登録
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // バリデーション
      if (!name.trim()) {
        throw new Error('名前を入力してください');
      }
      if (!email.trim()) {
        throw new Error('メールアドレスを入力してください');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
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

      // 既存ユーザーチェック
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (existingUser) {
        throw new Error('このメールアドレスは既に登録されています。ログインしてから招待リンクを開いてください。');
      }

      // パスワードハッシュ化
      const passwordHash = await hashPassword(password);

      // ユーザー作成
      const userId = `user-${Date.now()}`;
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          login_id: email.trim().toLowerCase(),
          password_hash: passwordHash,
          role: 'admin',
          user_type: 'staff',
          has_account: true,
          account_status: 'active',
          activated_at: new Date().toISOString(),
        });

      if (userError) {
        throw new Error(`アカウント作成に失敗しました: ${userError.message}`);
      }

      // ローカルストレージに保存
      const userData = {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        login_id: email.trim().toLowerCase(),
        role: 'admin',
        user_type: 'staff',
      };
      localStorage.setItem('user', JSON.stringify(userData));

      // 施設登録完了処理
      if (facility) {
        await completeFacilityRegistration(userId, facility.id);
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ローディング
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8] to-[#6366F1] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#818CF8] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">招待を確認中...</h2>
          <p className="text-gray-600">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  // 無効なトークン
  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8] to-[#6366F1] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">招待リンクが無効です</h2>
          <p className="text-gray-600 mb-6">
            {error || 'このリンクは無効か、既に使用済みです。管理者に新しい招待リンクを発行してもらってください。'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-md transition-colors"
          >
            トップページへ
          </button>
        </div>
      </div>
    );
  }

  // 登録完了
  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8] to-[#6366F1] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">登録完了！</h2>
          <p className="text-gray-600 mb-2">
            施設管理者として登録されました。
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">施設名</p>
            <p className="font-bold text-gray-800">{facility?.name}</p>
          </div>
          <button
            onClick={() => router.push(`/business?facilityId=${facility?.id}`)}
            className="w-full bg-[#818CF8] hover:bg-[#6366F1] text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            施設管理画面へ
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // アカウント作成フォーム
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#818CF8] to-[#6366F1] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={160}
            height={50}
            className="h-12 w-auto mx-auto mb-4"
          />
          <div className="w-14 h-14 bg-[#818CF8]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-[#818CF8]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">施設管理者として登録</h1>
          {facility && (
            <div className="mt-3 bg-[#818CF8]/10 rounded-lg px-4 py-2 inline-block">
              <p className="text-[#818CF8] font-bold">{facility.name}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              お名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
              placeholder="山田 太郎"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              <Mail className="w-4 h-4 inline mr-1" />
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
              placeholder="yamada@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              <Lock className="w-4 h-4 inline mr-1" />
              パスワード <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
              placeholder="8文字以上"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              <Lock className="w-4 h-4 inline mr-1" />
              パスワード（確認） <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
              placeholder="パスワードを再入力"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#818CF8] hover:bg-[#6366F1] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登録中...' : 'アカウントを作成して施設を管理'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            既にアカウントをお持ちの方は{' '}
            <button
              onClick={() => router.push(`/login?redirect=/facility/invite/${token}`)}
              className="text-[#818CF8] hover:underline font-bold"
            >
              ログイン
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
