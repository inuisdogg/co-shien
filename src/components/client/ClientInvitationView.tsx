/**
 * 利用者招待ビュー
 * 施設側から利用者（保護者）に招待を送信する
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Copy, CheckCircle, XCircle, Clock, AlertCircle, UserPlus, RefreshCw, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import InvitationModal from '@/components/common/InvitationModal';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'expired';

export default function ClientInvitationView() {
  const { facility } = useAuth();
  const { children } = useFacilityData();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    fetchInvitations();
  }, [facility?.id]);

  const fetchInvitations = async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('contract_invitations')
        .select(`
          *,
          children:child_id (
            id,
            name
          ),
          facilities:facility_id (
            id,
            name
          )
        `)
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        console.error('招待取得エラー:', fetchError);
      } else {
        setInvitations(data || []);
      }
    } catch (err: any) {
      console.error('招待取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationSent = () => {
    fetchInvitations();
  };

  const handleResendInvitation = async (invitation: any) => {
    if (!facility?.id) return;

    try {
      // 新しいトークンを生成
      const newToken = crypto.randomUUID();
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // 古い招待をキャンセル
      await supabase
        .from('contract_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitation.id);

      // 新しい招待を作成
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      const { error: insertError } = await supabase
        .from('contract_invitations')
        .insert({
          facility_id: facility.id,
          child_id: invitation.child_id,
          temp_child_name: invitation.temp_child_name,
          temp_child_name_kana: invitation.temp_child_name_kana,
          email: invitation.email,
          invitation_token: newToken,
          status: 'pending',
          expires_at: newExpiresAt,
          invited_by: user?.id || invitation.invited_by,
        });

      if (insertError) throw insertError;

      // メール送信
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const invitationUrl = `${baseUrl}/client/invitation/accept?token=${newToken}`;

      await fetch('/api/send-contract-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invitation.email,
          facilityName: facility.name,
          childName: invitation.temp_child_name,
          invitationUrl,
        }),
      });

      alert('招待を再送信しました');
      fetchInvitations();
    } catch (err: any) {
      console.error('再送信エラー:', err);
      alert('再送信に失敗しました: ' + err.message);
    }
  };

  const copyInvitationUrl = (token: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const invitationUrl = `${baseUrl}/client/invitation/accept?token=${token}`;
    navigator.clipboard.writeText(invitationUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusIcon = (status: string, isExpired: boolean) => {
    if (status === 'pending' && isExpired) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'expired':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string, isExpired: boolean) => {
    if (status === 'pending' && isExpired) {
      return '期限切れ';
    }
    switch (status) {
      case 'accepted':
        return '承認済み';
      case 'pending':
        return '承認待ち';
      case 'expired':
        return '期限切れ';
      case 'cancelled':
        return 'キャンセル';
      default:
        return status;
    }
  };

  // フィルタリングされた招待リスト
  const filteredInvitations = invitations.filter((inv) => {
    const isExpired = new Date(inv.expires_at) < new Date();
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return inv.status === 'pending' && !isExpired;
    if (statusFilter === 'accepted') return inv.status === 'accepted';
    if (statusFilter === 'expired') return (inv.status === 'pending' && isExpired) || inv.status === 'expired' || inv.status === 'cancelled';
    return true;
  });

  // 統計
  const stats = {
    total: invitations.length,
    pending: invitations.filter(i => i.status === 'pending' && new Date(i.expires_at) >= new Date()).length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    expired: invitations.filter(i => (i.status === 'pending' && new Date(i.expires_at) < new Date()) || i.status === 'expired' || i.status === 'cancelled').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-orange-500" />
              利用者招待
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              登録済みの児童に対して、利用者（保護者）に施設利用の招待を送信できます。
            </p>
          </div>
          <button
            onClick={() => setIsInvitationModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2"
          >
            <Mail className="w-5 h-5" />
            招待を作成
          </button>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-xs text-gray-500">総招待数</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-gray-500">承認待ち</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
            <p className="text-xs text-gray-500">承認済み</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            <p className="text-xs text-gray-500">期限切れ等</p>
          </div>
        </div>
      </div>

      {/* 招待履歴 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">招待履歴</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">すべて</option>
              <option value="pending">承認待ち</option>
              <option value="accepted">承認済み</option>
              <option value="expired">期限切れ等</option>
            </select>
          </div>
        </div>

        {filteredInvitations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>{statusFilter === 'all' ? '送信済みの招待がありません' : '該当する招待がありません'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvitations.map((invitation) => {
              const isExpired = new Date(invitation.expires_at) < new Date();
              const canResend = (invitation.status === 'pending' && isExpired) || invitation.status === 'cancelled';

              return (
                <div
                  key={invitation.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(invitation.status, isExpired)}
                      <div>
                        <p className="font-bold text-gray-800">{invitation.email}</p>
                        {invitation.children ? (
                          <p className="text-sm text-gray-500">対象児童: {invitation.children.name}</p>
                        ) : invitation.temp_child_name ? (
                          <p className="text-sm text-gray-500">児童名（仮）: {invitation.temp_child_name}</p>
                        ) : null}
                        <p className="text-xs text-gray-400 mt-1">
                          送信日: {new Date(invitation.created_at).toLocaleDateString('ja-JP')}
                          {' | '}
                          有効期限: {new Date(invitation.expires_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        invitation.status === 'pending' && !isExpired ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {getStatusLabel(invitation.status, isExpired)}
                      </span>
                      {canResend && (
                        <button
                          onClick={() => handleResendInvitation(invitation)}
                          className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          再送信
                        </button>
                      )}
                    </div>
                  </div>
                  {invitation.status === 'pending' && !isExpired && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/client/invitation/accept?token=${invitation.invitation_token}`}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600"
                      />
                      <button
                        onClick={() => copyInvitationUrl(invitation.invitation_token)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        {copiedToken === invitation.invitation_token ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            コピー済み
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            コピー
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 招待作成モーダル */}
      <InvitationModal
        isOpen={isInvitationModalOpen}
        onClose={() => setIsInvitationModalOpen(false)}
        facilityId={facility?.id || ''}
        facilityName={facility?.name || '施設'}
        userId={localStorage.getItem('userId') || ''}
        childList={children}
        onInvitationSent={handleInvitationSent}
      />
    </div>
  );
}
