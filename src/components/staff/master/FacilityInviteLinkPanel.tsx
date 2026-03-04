/**
 * 施設招待リンク管理パネル
 * リンク作成・一覧・有効/無効切替・メール送信
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Link2,
  Copy,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Plus,
  Mail,
  Send,
  Clock,
  Users,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { useFacilityInviteLink } from '@/hooks/useFacilityInviteLink';
import type { FacilityInviteLink } from '@/types/bulkImport';

interface FacilityInviteLinkPanelProps {
  facilityName?: string;
}

const FacilityInviteLinkPanel: React.FC<FacilityInviteLinkPanelProps> = ({
  facilityName = '',
}) => {
  const {
    inviteLinks,
    loading,
    error,
    createInviteLink,
    toggleLinkActive,
    deleteLink,
  } = useFacilityInviteLink();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [createMaxUses, setCreateMaxUses] = useState('');
  const [createExpiresDays, setCreateExpiresDays] = useState('30');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // メール送信UI
  const [emailLinkId, setEmailLinkId] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const getLinkUrl = (code: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/facility/join?code=${code}`;
  };

  const handleCopyLink = useCallback(async (link: FacilityInviteLink) => {
    try {
      await navigator.clipboard.writeText(getLinkUrl(link.code));
      setCopiedLinkId(link.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const expiresAt = createExpiresDays
        ? new Date(Date.now() + parseInt(createExpiresDays) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      await createInviteLink({
        label: createLabel || undefined,
        maxUses: createMaxUses ? parseInt(createMaxUses) : undefined,
        expiresAt,
      });

      setShowCreateForm(false);
      setCreateLabel('');
      setCreateMaxUses('');
      setCreateExpiresDays('30');
    } finally {
      setIsCreating(false);
    }
  }, [createLabel, createMaxUses, createExpiresDays, createInviteLink]);

  const handleSendEmail = useCallback(async (link: FacilityInviteLink) => {
    if (!emailAddress.trim()) return;

    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/staff/bulk-invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [{
            name: emailAddress.split('@')[0],
            email: emailAddress.trim(),
            activationUrl: getLinkUrl(link.code),
          }],
          facilityName,
        }),
      });

      if (response.ok) {
        setEmailSent(true);
        setTimeout(() => {
          setEmailSent(false);
          setEmailLinkId(null);
          setEmailAddress('');
        }, 2000);
      }
    } catch (err) {
      console.error('Send email failed:', err);
    } finally {
      setIsSendingEmail(false);
    }
  }, [emailAddress, facilityName]);

  const isExpired = (link: FacilityInviteLink) => {
    if (!link.expiresAt) return false;
    return new Date(link.expiresAt) < new Date();
  };

  const isMaxedOut = (link: FacilityInviteLink) => {
    if (!link.maxUses) return false;
    return link.useCount >= link.maxUses;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* 作成ボタン */}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark font-medium"
        >
          <Plus size={16} />
          新しい招待リンクを作成
        </button>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">招待リンク作成</span>
            <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">ラベル（任意）</label>
            <input
              type="text"
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              placeholder="例: 2026年4月入職スタッフ向け"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">最大利用回数（任意）</label>
              <input
                type="number"
                value={createMaxUses}
                onChange={(e) => setCreateMaxUses(e.target.value)}
                placeholder="無制限"
                min="1"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">有効期間（日）</label>
              <input
                type="number"
                value={createExpiresDays}
                onChange={(e) => setCreateExpiresDays(e.target.value)}
                placeholder="30"
                min="1"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={isCreating || loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Link2 size={14} />
            )}
            リンクを作成
          </button>
        </div>
      )}

      {/* リンク一覧 */}
      {inviteLinks.length === 0 && !loading ? (
        <div className="text-center py-8">
          <Link2 size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">招待リンクはまだありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inviteLinks.map((link) => {
            const expired = isExpired(link);
            const maxedOut = isMaxedOut(link);
            const disabled = !link.isActive || expired || maxedOut;

            return (
              <div
                key={link.id}
                className={`p-3 rounded-lg border ${
                  disabled ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {link.label || '招待リンク'}
                      </span>
                      {disabled && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                          {expired ? '期限切れ' : maxedOut ? '上限到達' : '無効'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {link.useCount}{link.maxUses ? `/${link.maxUses}` : ''}回使用
                      </span>
                      {link.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(link.expiresAt).toLocaleDateString('ja-JP')}まで
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyLink(link)}
                      className={`p-1.5 rounded transition-colors ${
                        copiedLinkId === link.id
                          ? 'bg-green-100 text-green-700'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title="URLをコピー"
                    >
                      {copiedLinkId === link.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        setEmailLinkId(emailLinkId === link.id ? null : link.id);
                        setEmailAddress('');
                        setEmailSent(false);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="メールで送る"
                    >
                      <Mail size={14} />
                    </button>
                    <button
                      onClick={() => toggleLinkActive(link.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title={link.isActive ? '無効にする' : '有効にする'}
                    >
                      {link.isActive ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('このリンクを削除しますか？')) {
                          deleteLink(link.id);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* URL表示 */}
                <div className="mt-1 px-2 py-1 bg-gray-50 rounded text-xs text-gray-500 font-mono truncate">
                  {getLinkUrl(link.code)}
                </div>

                {/* メール送信フォーム */}
                {emailLinkId === link.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="メールアドレス"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleSendEmail(link)}
                      disabled={isSendingEmail || !emailAddress.trim()}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        emailSent
                          ? 'bg-green-100 text-green-700'
                          : 'bg-primary text-white hover:bg-primary-dark disabled:opacity-50'
                      }`}
                    >
                      {emailSent ? (
                        <><Check size={14} /> 送信済み</>
                      ) : isSendingEmail ? (
                        <><Loader2 size={14} className="animate-spin" /> 送信中</>
                      ) : (
                        <><Send size={14} /> 送信</>
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
  );
};

export default FacilityInviteLinkPanel;
