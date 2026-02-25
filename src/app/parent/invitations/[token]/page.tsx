/**
 * 施設からの招待承認ページ
 * ステップインジケーター付きの親切なUI
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, XCircle, AlertCircle, Building2, Shield, Heart, ArrowRight, Loader2 } from 'lucide-react';
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
                  ? 'bg-[#F6AD55] text-white ring-4 ring-[#F6AD55]/20'
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

export default function InvitationAcceptPage() {
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

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        // 招待情報を取得
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
          setError('この招待リンクは無効です。URLが正しいかご確認ください。施設の担当者に再送をお願いすることもできます。');
          setLoading(false);
          return;
        }

        // 有効期限チェック
        if (new Date(invitationData.expires_at) < new Date()) {
          setError('この招待の有効期限が切れています。お手数ですが、施設の担当者に新しい招待の送信をお願いしてください。');
          setLoading(false);
          return;
        }

        // ステータスチェック
        if (invitationData.status !== 'pending') {
          setError('この招待は既に処理済みです。既に承認されている場合は、ダッシュボードからご確認ください。');
          setLoading(false);
          return;
        }

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
        // ログインが必要
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

      // トランザクション: 招待を承認し、契約を作成
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          {/* スケルトンローディング */}
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 mx-4">
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
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
            className="text-sm text-[#F6AD55] hover:text-[#ED8936] font-medium flex items-center gap-1 mx-auto"
          >
            今すぐダッシュボードへ <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <StepIndicator currentStep={error && !invitation ? 0 : 1} />

        <div className="text-center mb-6">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={160}
            height={52}
            className="h-12 w-auto mx-auto mb-6"
            priority
          />
          <div className="w-16 h-16 bg-[#F6AD55]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-[#F6AD55]" />
          </div>
          <p className="text-sm text-[#F6AD55] font-medium mb-1">
            保護者の方へ
          </p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            お子様の通所施設からの招待です
          </h1>
        </div>

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

        {invitation && facility && (
          <div className="space-y-4 mb-6">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">招待の内容</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Building2 size={16} className="text-[#F6AD55] shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500">施設名</span>
                    <p className="font-bold text-gray-800">{facility.name}</p>
                  </div>
                </div>
                {child && (
                  <div className="flex items-center gap-3">
                    <Heart size={16} className="text-[#F6AD55] shrink-0" />
                    <div>
                      <span className="text-xs text-gray-500">対象のお子様</span>
                      <p className="font-bold text-gray-800">{child.name}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Shield size={16} className="text-[#F6AD55] shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500">有効期限</span>
                    <p className="font-medium text-gray-800">
                      {new Date(invitation.expires_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}まで
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAccept}
                disabled={processing}
                className="w-full bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-base"
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

        <div className="text-center pt-4 border-t border-gray-100">
          <button
            onClick={() => router.push('/parent/login')}
            className="text-sm text-[#F6AD55] hover:text-[#ED8936] font-medium"
          >
            ログインが必要な場合はこちら
          </button>
        </div>
      </div>
    </div>
  );
}
