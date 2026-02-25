/**
 * 施設参加ページ
 * - 招待トークン経由: URLに?token=xxxがあれば自動で施設に紐付け
 * - 施設ID検索: 施設コードを入力して参加申請
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { UserPlus, Search, AlertCircle, CheckCircle, Mail, Lock, User, ArrowRight, Building2 } from 'lucide-react';
import { hashPassword } from '@/utils/password';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface FacilityInfo {
  id: string;
  name: string;
  code?: string;
}

interface InvitationInfo {
  id: string;
  facilityId: string;
  facilityName: string;
  email: string;
  name: string;
  expiresAt: string;
}

type Step = 'loading' | 'invalid' | 'login_or_signup' | 'signup_form' | 'complete' | 'manual_search';

function FacilityJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<Step>('loading');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 手動検索用
  const [facilityCode, setFacilityCode] = useState('');
  const [foundFacility, setFoundFacility] = useState<FacilityInfo | null>(null);
  const [message, setMessage] = useState('');

  // サインアップフォーム
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // 初期化: トークンの有無で分岐
  useEffect(() => {
    const init = async () => {
      // ユーザー情報を取得
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }

      if (token) {
        // トークン経由の招待
        await validateInvitationToken(token, userStr ? JSON.parse(userStr) : null);
      } else {
        // 手動検索モード
        if (!userStr) {
          router.push('/career/login?redirect=/facility/join');
          return;
        }
        setStep('manual_search');
      }
    };

    init();
  }, [token, router]);

  // 招待トークンを検証
  const validateInvitationToken = async (inviteToken: string, currentUser: UserInfo | null) => {
    try {
      const { data: inviteData, error: inviteError } = await supabase
        .from('staff_invitations')
        .select(`
          id,
          facility_id,
          email,
          name,
          status,
          expires_at,
          facilities (
            id,
            name
          )
        `)
        .eq('token', inviteToken)
        .single();

      if (inviteError || !inviteData) {
        console.error('Invitation token error:', inviteError);
        setError('この招待リンクは無効です。管理者に新しいリンクを発行してもらってください。');
        setStep('invalid');
        return;
      }

      // ステータスチェック
      if (inviteData.status === 'accepted') {
        setError('この招待は既に使用されています。');
        setStep('invalid');
        return;
      }

      // 有効期限チェック
      if (new Date(inviteData.expires_at) < new Date()) {
        setError('この招待リンクは有効期限切れです。管理者に新しいリンクを発行してもらってください。');
        setStep('invalid');
        return;
      }

      const facilityData = inviteData.facilities as any;
      setInvitation({
        id: inviteData.id,
        facilityId: inviteData.facility_id,
        facilityName: facilityData?.name || '不明な施設',
        email: inviteData.email,
        name: inviteData.name,
        expiresAt: inviteData.expires_at,
      });

      // サインアップフォームに招待情報をプリセット
      setSignupForm((prev) => ({
        ...prev,
        name: inviteData.name,
        email: inviteData.email,
      }));

      // 既にログイン済みの場合
      if (currentUser) {
        // ログインユーザーのメールが招待メールと一致するか確認
        if (currentUser.email?.toLowerCase() === inviteData.email.toLowerCase()) {
          // 自動で施設に紐付け
          await completeJoin(currentUser.id, inviteData.facility_id, inviteToken);
        } else {
          // 別のアカウントでログイン中
          setStep('login_or_signup');
        }
      } else {
        // 未ログイン
        setStep('login_or_signup');
      }
    } catch (err) {
      console.error('Token validation error:', err);
      setError('招待の確認中にエラーが発生しました。');
      setStep('invalid');
    }
  };

  // 施設への参加を完了
  const completeJoin = async (userId: string, facilityId: string, inviteToken?: string) => {
    setLoading(true);
    try {
      // 既に所属済みかチェック
      const { data: existingEmp } = await supabase
        .from('employment_records')
        .select('id')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .is('end_date', null)
        .maybeSingle();

      if (existingEmp) {
        setError('既にこの施設に所属しています。');
        setStep('invalid');
        return;
      }

      // employment_recordsに追加（スタッフとして）
      const { error: empError } = await supabase
        .from('employment_records')
        .insert({
          user_id: userId,
          facility_id: facilityId,
          start_date: new Date().toISOString().split('T')[0],
          role: '一般スタッフ',
          employment_type: '常勤',
          permissions: {
            facilityManagement: false,
          },
        });

      if (empError) {
        console.error('Employment record error:', empError);
        throw new Error('施設への登録に失敗しました');
      }

      // staffテーブルにも追加
      const staffId = `staff-${Date.now()}`;
      const { error: staffError } = await supabase
        .from('staff')
        .insert({
          id: staffId,
          facility_id: facilityId,
          user_id: userId,
          name: invitation?.name || user?.name || '名前未設定',
          type: '常勤',
          role: '一般スタッフ',
        });

      if (staffError) {
        console.error('Staff record error:', staffError);
        // staffテーブルへの追加は必須ではないので続行
      }

      // 招待トークンを使用済みに更新
      if (inviteToken) {
        await supabase
          .from('staff_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .eq('token', inviteToken);
      }

      setStep('complete');
    } catch (err: any) {
      console.error('Join completion error:', err);
      setError(err.message || '施設への参加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 新規アカウント作成して参加
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!signupForm.name.trim()) {
      setError('名前を入力してください');
      return;
    }
    if (!signupForm.email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }
    if (!signupForm.password) {
      setError('パスワードを入力してください');
      return;
    }
    if (signupForm.password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);
    try {
      // 既存ユーザーチェック
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', signupForm.email.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        setError('このメールアドレスは既に登録されています。ログインしてください。');
        setLoading(false);
        return;
      }

      // パスワードハッシュ
      const passwordHash = await hashPassword(signupForm.password);

      // ユーザー作成
      const userId = `user-${Date.now()}`;
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: signupForm.name.trim(),
          email: signupForm.email.trim().toLowerCase(),
          login_id: signupForm.email.trim().toLowerCase(),
          password_hash: passwordHash,
          user_type: 'staff',
          role: 'staff',
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
        name: signupForm.name.trim(),
        email: signupForm.email.trim().toLowerCase(),
        login_id: signupForm.email.trim().toLowerCase(),
        role: 'staff',
        user_type: 'staff',
      };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      // 施設に参加
      if (invitation) {
        await completeJoin(userId, invitation.facilityId, token || undefined);
      }
    } catch (err: any) {
      setError(err.message || 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 施設を検索（手動）
  const searchFacility = async () => {
    if (!facilityCode.trim()) {
      setError('施設IDを入力してください');
      return;
    }

    setSearching(true);
    setError('');
    setFoundFacility(null);

    try {
      const { data, error: searchError } = await supabase
        .from('facilities')
        .select('id, name, code')
        .eq('code', facilityCode.trim())
        .single();

      if (searchError || !data) {
        throw new Error('施設が見つかりませんでした');
      }

      setFoundFacility(data);
    } catch (err: any) {
      setError(err.message || '検索に失敗しました');
    } finally {
      setSearching(false);
    }
  };

  // 参加申請を送信（手動検索経由）
  const handleManualJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !foundFacility) return;

    setLoading(true);
    setError('');

    try {
      // 既に所属済みかチェック
      const { data: existingEmp } = await supabase
        .from('employment_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('facility_id', foundFacility.id)
        .is('end_date', null)
        .maybeSingle();

      if (existingEmp) {
        throw new Error('既にこの施設に所属しています');
      }

      // 参加申請を作成
      const { error: insertError } = await supabase
        .from('join_requests')
        .insert({
          id: `join-${user.id}-${foundFacility.id}-${Date.now()}`,
          user_id: user.id,
          facility_id: foundFacility.id,
          message: message.trim() || null,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Join request insert error:', insertError);
      }

      setSuccess(true);

      // 3秒後にポータルへ
      setTimeout(() => {
        router.push('/portal');
      }, 3000);
    } catch (err: any) {
      setError(err.message || '申請に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ローディング
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">招待を確認中...</h2>
          <p className="text-gray-600">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  // 無効なトークン
  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">施設への参加が完了しました！</h2>
          <p className="text-gray-600 mb-2">
            スタッフとして登録されました。
          </p>
          {invitation && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500">施設名</p>
              <p className="font-bold text-gray-800">{invitation.facilityName}</p>
            </div>
          )}
          <button
            onClick={() => router.push('/career')}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            キャリアアプリへ
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ログインまたはサインアップ選択
  if (step === 'login_or_signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#00c4cc]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-[#00c4cc]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">施設への招待</h1>
            {invitation && (
              <div className="mt-3 bg-[#00c4cc]/5 rounded-lg px-4 py-2">
                <p className="text-[#00c4cc] font-bold">{invitation.facilityName}</p>
                <p className="text-[#00c4cc] text-sm">{invitation.name}さんとして招待されています</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* 既にログイン中の場合 */}
          {user && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <span className="font-bold">{user.name}</span>としてログイン中です。
              </p>
              <p className="text-xs text-blue-600 mt-1">
                このアカウントで参加するか、別のアカウントでログインしてください。
              </p>
              <button
                onClick={() => {
                  if (invitation) {
                    completeJoin(user.id, invitation.facilityId, token || undefined);
                  }
                }}
                disabled={loading}
                className="mt-3 w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? '参加処理中...' : 'このアカウントで参加する'}
              </button>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => setStep('signup_form')}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
            >
              新規アカウントを作成して参加
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">または</span>
              </div>
            </div>

            <button
              onClick={() => router.push(`/career/login?redirect=/facility/join?token=${token}`)}
              className="w-full bg-white border-2 border-[#00c4cc] text-[#00c4cc] font-bold py-3 px-4 rounded-md transition-colors hover:bg-[#00c4cc]/5"
            >
              既存アカウントでログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  // サインアップフォーム
  if (step === 'signup_form') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-6">
            <Image
              src="/logo.svg"
              alt="Roots"
              width={160}
              height={50}
              className="h-12 w-auto mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-800">アカウント作成</h1>
            {invitation && (
              <p className="text-gray-600 text-sm mt-2">
                {invitation.facilityName}に参加します
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                お名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={signupForm.name}
                onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
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
                value={signupForm.email}
                onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
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
                value={signupForm.password}
                onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                placeholder="6文字以上"
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
                value={signupForm.confirmPassword}
                onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                placeholder="パスワードを再入力"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'アカウント作成中...' : 'アカウントを作成して参加'}
            </button>
          </form>

          <button
            onClick={() => setStep('login_or_signup')}
            className="w-full mt-4 text-gray-500 hover:text-gray-700 text-sm"
          >
            ← 戻る
          </button>
        </div>
      </div>
    );
  }

  // 手動検索モード（成功時）
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">申請を送信しました</h2>
          <p className="text-gray-600 mb-4">
            施設の管理者が承認すると、所属施設一覧に表示されます。
          </p>
          <p className="text-gray-500 text-sm">ポータルに戻ります...</p>
        </div>
      </div>
    );
  }

  // 手動検索モード
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => router.push('/portal')}
            className="text-white/80 hover:text-white text-sm"
          >
            ← 戻る
          </button>
          <Image
            src="/logo-white.svg"
            alt="Roots"
            width={100}
            height={32}
            className="h-6 w-auto"
          />
          <div className="w-12"></div>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#00c4cc]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-7 h-7 text-[#00c4cc]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">施設へ参加申請</h1>
            <p className="text-gray-600 text-sm mt-2">
              スタッフとして既存の施設に参加します
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleManualJoinRequest} className="space-y-6">
            {/* 施設ID検索 */}
            <div>
              <label htmlFor="facilityCode" className="block text-sm font-bold text-gray-700 mb-2">
                施設ID <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="facilityCode"
                  type="text"
                  value={facilityCode}
                  onChange={(e) => {
                    setFacilityCode(e.target.value);
                    setFoundFacility(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="施設IDを入力"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={searchFacility}
                  disabled={searching || loading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50"
                >
                  {searching ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                施設の管理者から施設IDを教えてもらってください
              </p>
            </div>

            {/* 検索結果 */}
            {foundFacility && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-bold mb-1">施設が見つかりました</p>
                <p className="text-green-700">{foundFacility.name}</p>
              </div>
            )}

            {/* メッセージ（任意） */}
            {foundFacility && (
              <div>
                <label htmlFor="message" className="block text-sm font-bold text-gray-700 mb-2">
                  メッセージ（任意）
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
                  placeholder="管理者へのメッセージ（任意）"
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !foundFacility}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '送信中...' : '参加申請を送信'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-bold text-blue-800 text-sm mb-2">参加申請について</h3>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>・施設の管理者が申請を承認すると参加できます</li>
                <li>・承認されるとポータルに施設が表示されます</li>
                <li>・申請状況は管理者へお問い合わせください</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FacilityJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <FacilityJoinContent />
    </Suspense>
  );
}
