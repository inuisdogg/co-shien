/**
 * 統一招待承認ページ
 * 全てのシナリオ（未ログイン・ログイン済み・期限切れ・承認済み）を1ページで処理
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, XCircle, AlertCircle, Building2, Shield, Heart, ArrowRight, Loader2, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ステップインジケーター
const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const stepLabels = ['招待確認', '承認', '完了'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {stepLabels.map((label, index) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-[#F472B6] text-white ring-4 ring-[#F472B6]/20'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {index < currentStep ? <CheckCircle size={16} /> : index + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${
              index <= currentStep ? 'text-gray-700' : 'text-gray-400'
            }`}>
              {label}
            </span>
          </div>
          {index < stepLabels.length - 1 && (
            <div className={`w-8 h-0.5 mb-4 rounded ${
              index < currentStep ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function UnifiedInvitationPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [child, setChild] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [invitationStatus, setInvitationStatus] = useState<'pending' | 'accepted' | 'expired' | 'cancelled' | 'invalid'>('pending');

  // ログイン状態を確認
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user?.id && user?.userType === 'client') {
          setIsLoggedIn(true);
          setCurrentUser(user);
        }
      } catch {
        // invalid JSON, ignore
      }
    }
  }, []);

  // 招待情報を取得
  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const { data: invitationData, error: invitationError } = await supabase
          .from('contract_invitations')
          .select(`
            *,
            facilities:facility_id (
              id,
              name,
              code
            ),
            children:child_id (
              id,
              name
            )
          `)
          .eq('invitation_token', token)
          .single();

        if (invitationError || !invitationData) {
          setInvitationStatus('invalid');
          setError('この招待リンクは無効です。URLが正しいかご確認ください。施設の担当者に再送をお願いすることもできます。');
          setLoading(false);
          return;
        }

        // 有効期限チェック
        if (new Date(invitationData.expires_at) < new Date()) {
          setInvitationStatus('expired');
          setInvitation(invitationData);
          setFacility(invitationData.facilities);
          setChild(invitationData.children);
          setError('この招待の有効期限が切れています。お手数ですが、施設の担当者に新しい招待の送信をお願いしてください。');
          setLoading(false);
          return;
        }

        // ステータスチェック
        if (invitationData.status === 'accepted') {
          setInvitationStatus('accepted');
          setInvitation(invitationData);
          setFacility(invitationData.facilities);
          setChild(invitationData.children);
          setError('この招待は既に承認済みです。ダッシュボードからご確認ください。');
          setLoading(false);
          return;
        }

        if (invitationData.status === 'cancelled') {
          setInvitationStatus('cancelled');
          setInvitation(invitationData);
          setFacility(invitationData.facilities);
          setChild(invitationData.children);
          setError('この招待はキャンセルされています。施設の担当者にお問い合わせください。');
          setLoading(false);
          return;
        }

        if (invitationData.status !== 'pending') {
          setInvitationStatus('invalid');
          setError('この招待は既に処理済みです。既に承認されている場合は、ダッシュボードからご確認ください。');
          setLoading(false);
          return;
        }

        setInvitationStatus('pending');
        setInvitation(invitationData);
        setFacility(invitationData.facilities);
        setChild(invitationData.children);
      } catch (err: any) {
        setError('招待情報の読み込みに失敗しました。ネットワーク環境を確認して、ページを再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const handleAccept = async () => {
    setProcessing(true);
    setError('');

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push(`/parent/login?redirect=/parent/invitations/${token}`);
        return;
      }

      const user = JSON.parse(userStr);
      if (user.userType !== 'client') {
        setError('この操作には利用者（保護者）アカウントでのログインが必要です。現在のアカウントはスタッフ用です。');
        setProcessing(false);
        return;
      }

      // 児童が既に存在するか確認
      let targetChildId = invitation.child_id;

      // 児童が指定されていない場合は、メールアドレスから児童を探す
      if (!targetChildId) {
        const { data: childrenData } = await supabase
          .from('children')
          .select('id')
          .eq('owner_profile_id', user.id)
          .eq('email', invitation.email)
          .limit(1)
          .single();

        if (childrenData) {
          targetChildId = childrenData.id;
        } else {
          setError('紐付けるお子様の情報が見つかりません。先にお子様の情報を登録してください。');
          setProcessing(false);
          return;
        }
      }

      // 既に契約が存在するかチェック
      const { data: existingContract } = await supabase
        .from('contracts')
        .select('id')
        .eq('child_id', targetChildId)
        .eq('facility_id', invitation.facility_id)
        .eq('status', 'active')
        .single();

      if (existingContract) {
        setError('この施設とは既に契約済みです。ダッシュボードからご確認ください。');
        setProcessing(false);
        return;
      }

      // 招待を承認
      const { error: acceptError } = await supabase
        .from('contract_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (acceptError) {
        throw acceptError;
      }

      // 契約を作成
      const { error: contractError } = await supabase
        .from('contracts')
        .insert({
          child_id: targetChildId,
          facility_id: invitation.facility_id,
          status: 'active',
          contract_start_date: new Date().toISOString().split('T')[0],
          approved_at: new Date().toISOString(),
          approved_by: invitation.invited_by,
        });

      if (contractError) {
        throw contractError;
      }

      // children.owner_profile_id を現在のユーザーに更新
      if (targetChildId) {
        await supabase
          .from('children')
          .update({
            owner_profile_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetChildId);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/parent');
      }, 3000);
    } catch (err: any) {
      setError('招待の承認処理中にエラーが発生しました。もう一度お試しください。改善しない場合は施設にお問い合わせください。');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    setError('');

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push(`/parent/login?redirect=/parent/invitations/${token}`);
        return;
      }

      const { error: rejectError } = await supabase
        .from('contract_invitations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (rejectError) {
        throw rejectError;
      }

      router.push('/parent');
    } catch (err: any) {
      setError('処理に失敗しました。もう一度お試しください。');
    } finally {
      setProcessing(false);
    }
  };

  // ローディング表示
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50">
        <div className="text-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full p-8 mx-4">
            <div className="animate-pulse space-y-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto" />
              <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="space-y-3 pt-4">
                <div className="h-12 bg-gray-100 rounded-lg" />
                <div className="h-12 bg-gray-100 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 承認完了画面
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <StepIndicator currentStep={3} />
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart size={36} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">承認が完了しました</h2>
          <p className="text-gray-600 mb-2">
            {facility?.name}との連携が開始されました。
          </p>
          <p className="text-sm text-gray-500 mb-6">
            これからお子様の毎日の記録をご確認いただけます。
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-green-700 font-medium">
              まもなくダッシュボードに移動します...
            </p>
          </div>
          <button
            onClick={() => router.push('/parent')}
            className="text-sm text-[#F472B6] hover:text-[#EC4899] font-medium flex items-center gap-1 mx-auto"
          >
            今すぐダッシュボードへ <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // 招待詳細カード（常に表示）
  const InvitationDetails = () => (
    invitation && facility ? (
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 mb-6">
        <h3 className="font-bold text-gray-800 mb-3 text-sm">招待の内容</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Building2 size={16} className="text-[#F472B6] shrink-0" />
            <div>
              <span className="text-xs text-gray-500">施設名</span>
              <p className="font-bold text-gray-800">{facility.name}</p>
            </div>
          </div>
          {(child || invitation.temp_child_name) && (
            <div className="flex items-center gap-3">
              <Heart size={16} className="text-[#F472B6] shrink-0" />
              <div>
                <span className="text-xs text-gray-500">対象のお子様</span>
                <p className="font-bold text-gray-800">{child?.name || invitation.temp_child_name}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-[#F472B6] shrink-0" />
            <div>
              <span className="text-xs text-gray-500">有効期限</span>
              <p className="font-medium text-gray-800">
                {new Date(invitation.expires_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}まで
              </p>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full p-8">
        <StepIndicator currentStep={error && invitationStatus !== 'pending' ? 0 : isLoggedIn ? 1 : 0} />

        <div className="text-center mb-6">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={160}
            height={52}
            className="h-12 w-auto mx-auto mb-6"
            priority
          />
          <div className="w-16 h-16 bg-[#F472B6]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-[#F472B6]" />
          </div>
          <p className="text-sm text-[#F472B6] font-medium mb-1">
            保護者の方へ
          </p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            お子様の通所施設からの招待です
          </h1>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">お知らせ</p>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 招待詳細は常に表示（データがある場合） */}
        <InvitationDetails />

        {/* 期限切れ・承認済みの場合のアクション */}
        {invitationStatus === 'expired' && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              施設の担当者に新しい招待の送信をお願いしてください。
            </p>
            <button
              onClick={() => router.push('/parent')}
              className="text-sm text-[#F472B6] hover:text-[#EC4899] font-medium"
            >
              ダッシュボードへ戻る
            </button>
          </div>
        )}

        {invitationStatus === 'accepted' && (
          <div className="text-center">
            <button
              onClick={() => router.push('/parent')}
              className="w-full bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              ダッシュボードへ <ArrowRight size={16} />
            </button>
          </div>
        )}

        {invitationStatus === 'cancelled' && (
          <div className="text-center">
            <button
              onClick={() => router.push('/parent')}
              className="text-sm text-[#F472B6] hover:text-[#EC4899] font-medium"
            >
              ダッシュボードへ戻る
            </button>
          </div>
        )}

        {/* 有効な招待 & 未ログイン → ログイン/新規登録ボタン */}
        {invitationStatus === 'pending' && !isLoggedIn && invitation && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center mb-2">
              招待を承認するには、ログインまたは新規登録が必要です。
            </p>
            <button
              onClick={() => router.push(`/parent/login?redirect=/parent/invitations/${token}`)}
              className="w-full bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-base"
            >
              <LogIn size={18} />
              ログインして承認
            </button>
            <button
              onClick={() => router.push(`/parent/signup?redirect=/parent/invitations/${token}`)}
              className="w-full bg-white border-2 border-[#F472B6] text-[#F472B6] hover:bg-pink-50 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
            >
              <UserPlus size={18} />
              新規登録して承認
            </button>
          </div>
        )}

        {/* 有効な招待 & ログイン済み → 承認フォーム */}
        {invitationStatus === 'pending' && isLoggedIn && invitation && (
          <div className="space-y-4">
            {currentUser && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-2">
                <p className="text-xs text-gray-500">ログイン中のアカウント</p>
                <p className="text-sm font-bold text-gray-800">{currentUser.name || currentUser.email}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleAccept}
                disabled={processing}
                className="w-full bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-base"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    招待を承認する
                  </>
                )}
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 text-sm"
              >
                <XCircle className="w-4 h-4" />
                辞退する
              </button>
            </div>
          </div>
        )}

        {/* 無効な招待リンクの場合のフッター */}
        {invitationStatus === 'invalid' && (
          <div className="text-center">
            <button
              onClick={() => router.push('/parent/login')}
              className="text-sm text-[#F472B6] hover:text-[#EC4899] font-medium"
            >
              ログインページへ
            </button>
          </div>
        )}

        <div className="text-center pt-4 border-t border-gray-100 mt-6">
          <p className="text-xs text-gray-400">
            Roots - 児童発達支援管理システム
          </p>
        </div>
      </div>
    </div>
  );
}
