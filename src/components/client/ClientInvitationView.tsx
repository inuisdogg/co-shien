/**
 * 利用者招待ビュー
 * 施設側から利用者（保護者）に招待を送信する
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Copy, CheckCircle, XCircle, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';

export default function ClientInvitationView() {
  const { facility } = useAuth();
  const { children } = useFacilityData();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [invitationEmail, setInvitationEmail] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, [facility?.id]);

  const fetchInvitations = async () => {
    if (!facility?.id) return;

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
        .limit(50);

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

  const handleSendInvitation = async () => {
    if (!facility?.id) {
      setError('施設情報が取得できません');
      return;
    }

    if (!invitationEmail) {
      setError('メールアドレスを入力してください');
      return;
    }

    if (!invitationEmail.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setError('');
    setSuccess('');
    setSending(true);

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        throw new Error('ログイン情報が見つかりません');
      }

      const user = JSON.parse(userStr);

      // 招待トークンを生成
      const token = crypto.randomUUID();

      // 招待を作成
      const { error: inviteError } = await supabase
        .from('contract_invitations')
        .insert({
          facility_id: facility.id,
          child_id: selectedChild || null,
          email: invitationEmail.trim().toLowerCase(),
          invitation_token: token,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日後
          invited_by: user.id,
        });

      if (inviteError) {
        throw inviteError;
      }

      // メール送信（APIエンドポイントを呼び出す）
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const invitationUrl = `${baseUrl}/client/invitations/${token}`;
      
      try {
        const emailResponse = await fetch('/api/send-contract-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: invitationEmail.trim().toLowerCase(),
            facilityName: facility.name,
            childName: selectedChild ? children.find(c => c.id === selectedChild)?.name : undefined,
            invitationUrl,
          }),
        });

        if (!emailResponse.ok) {
          const emailError = await emailResponse.json();
          console.error('メール送信エラー:', emailError);
          // メール送信に失敗しても招待は作成されているので続行
        }
      } catch (emailErr) {
        console.error('メール送信エラー:', emailErr);
        // メール送信に失敗しても招待は作成されているので続行
      }

      setSuccess('招待を送信しました');
      setInvitationEmail('');
      setSelectedChild('');
      fetchInvitations();
    } catch (err: any) {
      setError(err.message || '招待の送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const copyInvitationUrl = (token: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const invitationUrl = `${baseUrl}/client/invitations/${token}`;
    navigator.clipboard.writeText(invitationUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusIcon = (status: string) => {
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

  const getStatusLabel = (status: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <UserPlus className="w-6 h-6" />
          利用者招待
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          利用者（保護者）に施設利用の招待を送信できます。招待URLをメールで送信するか、直接コピーして共有できます。
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              対象児童（任意）
            </label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
            >
              <option value="">児童を選択（任意）</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              特定の児童に紐づける場合は選択してください。未選択の場合は、メールアドレスから児童を探します。
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              保護者のメールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={invitationEmail}
              onChange={(e) => setInvitationEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
              disabled={sending}
            />
          </div>

          <button
            onClick={handleSendInvitation}
            disabled={sending || !invitationEmail}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                送信中...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5" />
                招待を送信
              </>
            )}
          </button>
        </div>
      </div>

      {/* 送信済み招待一覧 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">送信済み招待</h3>
        {invitations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>送信済みの招待がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => {
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
              const invitationUrl = `${baseUrl}/client/invitations/${invitation.invitation_token}`;
              const isExpired = new Date(invitation.expires_at) < new Date();

              return (
                <div
                  key={invitation.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-[#00c4cc] transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(invitation.status)}
                      <div>
                        <p className="font-bold text-gray-800">{invitation.email}</p>
                        {invitation.children && (
                          <p className="text-sm text-gray-500">対象児童: {invitation.children.name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          送信日: {new Date(invitation.created_at).toLocaleDateString('ja-JP')}
                        </p>
                        {isExpired && invitation.status === 'pending' && (
                          <p className="text-xs text-red-500 mt-1">期限切れ</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                      invitation.status === 'pending' && !isExpired ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(invitation.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={invitationUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm"
                    />
                    <button
                      onClick={() => copyInvitationUrl(invitation.invitation_token)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      {copiedToken === invitation.invitation_token ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

