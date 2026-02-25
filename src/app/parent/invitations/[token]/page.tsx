/**
 * 施設からの招待承認ページ
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
          setError('招待が見つかりません。URLが正しいか確認してください。');
          setLoading(false);
          return;
        }

        // 有効期限チェック
        if (new Date(invitationData.expires_at) < new Date()) {
          setError('この招待は有効期限が切れています。');
          setLoading(false);
          return;
        }

        // ステータスチェック
        if (invitationData.status !== 'pending') {
          setError('この招待は既に処理済みです。');
          setLoading(false);
          return;
        }

        setInvitation(invitationData);
        setFacility(invitationData.facilities);
        setChild(invitationData.children);
      } catch (err: any) {
        setError(err.message || '招待情報の取得に失敗しました');
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
        setError('利用者アカウントでログインしてください');
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
          setError('お子様の情報が見つかりません。先にお子様を登録してください。');
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
        setError('この施設とは既に契約中です。');
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
      }, 2000);
    } catch (err: any) {
      setError(err.message || '招待の承認に失敗しました');
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

      const user = JSON.parse(userStr);

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
      setError(err.message || '招待の拒否に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F6AD55] mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">招待を承認しました</h2>
          <p className="text-gray-600 mb-4">
            {facility?.name}との契約が開始されました。
          </p>
          <p className="text-sm text-gray-500">ダッシュボードに戻ります...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={200}
            height={64}
            className="h-16 w-auto mx-auto mb-4"
            priority
          />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">施設からの招待</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {invitation && facility && (
          <div className="space-y-4 mb-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-3">招待内容</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">施設名:</span>
                  <span className="ml-2 font-medium text-gray-800">{facility.name}</span>
                </div>
                {facility.code && (
                  <div>
                    <span className="text-gray-600">施設コード:</span>
                    <span className="ml-2 font-medium text-gray-800">{facility.code}</span>
                  </div>
                )}
                {child && (
                  <div>
                    <span className="text-gray-600">対象児童:</span>
                    <span className="ml-2 font-medium text-gray-800">{child.name}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">有効期限:</span>
                  <span className="ml-2 font-medium text-gray-800">
                    {new Date(invitation.expires_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={processing}
                className="flex-1 bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    処理中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    承認する
                  </>
                )}
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                拒否する
              </button>
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => router.push('/parent/login')}
            className="text-sm text-[#F6AD55] hover:underline"
          >
            ログインが必要な場合はこちら
          </button>
        </div>
      </div>
    </div>
  );
}

