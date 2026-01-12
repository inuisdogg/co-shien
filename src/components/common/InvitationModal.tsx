'use client';

import { useState } from 'react';
import { X, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Child } from '@/types';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilityId: string;
  facilityName: string;
  userId: string;
  childList: Child[]; // 全児童リスト（フィルタリングはこのコンポーネント内で行う）
  onInvitationSent: (invitation: any) => void;
}

export default function InvitationModal({
  isOpen,
  onClose,
  facilityId,
  facilityName,
  userId,
  childList,
  onInvitationSent,
}: InvitationModalProps) {
  const [selectedChildId, setSelectedChildId] = useState('');
  const [sending, setSending] = useState(false);

  // 未連携の児童のみフィルタリング
  const unlinkedChildren = childList.filter(c => !c.ownerProfileId);

  // 選択中の児童のメールアドレスを取得
  const selectedChild = childList.find(c => c.id === selectedChildId);
  const selectedEmail = selectedChild?.email || '';

  const handleClose = () => {
    setSelectedChildId('');
    onClose();
  };

  const handleSendInvitation = async () => {
    if (!selectedChildId) {
      alert('招待する児童を選択してください');
      return;
    }
    if (!selectedEmail) {
      alert('選択した児童にはメールアドレスが登録されていません。児童管理からメールアドレスを追加してください。');
      return;
    }

    setSending(true);
    try {
      if (!selectedChild) {
        throw new Error('選択された児童が見つかりません');
      }

      // 招待トークンを生成
      const invitationToken = crypto.randomUUID();

      // 招待を作成
      const { data, error } = await supabase
        .from('contract_invitations')
        .insert({
          facility_id: facilityId,
          child_id: selectedChildId,
          temp_child_name: selectedChild.name,
          temp_child_name_kana: selectedChild.nameKana || null,
          email: selectedEmail.trim().toLowerCase(),
          invitation_token: invitationToken,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日後
          invited_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // 招待メールを送信
      try {
        const invitationUrl = `${window.location.origin}/client/invitation/accept?token=${invitationToken}`;
        const loginUrl = `${window.location.origin}/login?redirect=/client/invitation/confirm&token=${invitationToken}`;
        await fetch('/api/send-contract-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: selectedEmail.trim().toLowerCase(),
            facilityName: facilityName,
            childName: selectedChild.name,
            invitationUrl,
            loginUrl, // 既存アカウント用のログインURL
          }),
        });
      } catch (emailError) {
        console.error('メール送信エラー:', emailError);
        // メール送信に失敗しても招待は作成済み
      }

      onInvitationSent(data);
      handleClose();
      alert('招待を送信しました');
    } catch (error: any) {
      console.error('招待作成エラー:', error);
      alert('招待の作成に失敗しました: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-2xl border border-gray-100">
        {/* ヘッダー */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800">利用者招待</h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            保護者のメールアドレスに招待を送信します。<br />
            保護者が招待を承認すると、児童情報が自動的に連携されます。
          </p>
        </div>

        {/* フォーム */}
        <div className="p-6 space-y-4">
          {unlinkedChildren.length === 0 ? (
            // 未連携児童がいない場合
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-yellow-800">招待可能な児童がいません</h4>
                  <p className="text-xs text-yellow-700 mt-1">
                    利用者招待を行うには、まず児童管理で児童を登録してください。<br />
                    すでに利用者アカウントと連携済みの児童には再度招待を送信できません。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 児童選択 */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  招待する児童 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                >
                  <option value="">-- 児童を選択 --</option>
                  {unlinkedChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                      {child.birthDate && ` (${calculateAgeWithMonths(child.birthDate).display})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  利用者アカウントと未連携の児童のみ表示されます
                </p>
              </div>

              {/* メールアドレス表示 */}
              {selectedChildId && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    招待メール送信先
                  </label>
                  {selectedEmail ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-orange-500" />
                        <span className="text-sm font-medium text-gray-800">{selectedEmail}</span>
                      </div>
                      <p className="text-xs text-orange-600 mt-2">
                        招待メールをこのアドレスに送信します
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-700">
                            メールアドレスが登録されていません
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            この児童にはメールアドレスが登録されていません。
                            児童管理画面から保護者のメールアドレスを追加してください。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 招待の流れ */}
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <h4 className="text-xs font-bold text-orange-800 mb-1">招待の流れ</h4>
                <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside">
                  <li>保護者にメールで招待リンクを送信</li>
                  <li>保護者がリンクからログイン/登録</li>
                  <li>保護者が児童情報を確認・連携</li>
                  <li>施設と児童の契約が完了</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-bold transition-colors"
          >
            キャンセル
          </button>
          {unlinkedChildren.length > 0 && (
            <button
              onClick={handleSendInvitation}
              disabled={sending || !selectedChildId || !selectedEmail}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  送信中...
                </>
              ) : (
                <>
                  <Mail size={16} />
                  招待を送信
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
