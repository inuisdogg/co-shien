/**
 * スタッフ招待モーダル
 * 新規スタッフを招待するためのモーダルコンポーネント
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Copy,
  Check,
  UserPlus,
  Link2,
  AlertCircle,
  Clock,
  Users,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface StaffInvitation {
  id: string;
  email: string;
  name: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

interface StaffInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, name: string) => Promise<{ token: string } | null>;
  pendingInvitations?: StaffInvitation[];
  onResendInvitation?: (invitation: StaffInvitation) => Promise<void>;
  onCancelInvitation?: (invitation: StaffInvitation) => Promise<void>;
  loading?: boolean;
}

const StaffInviteModal: React.FC<StaffInviteModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  pendingInvitations = [],
  onResendInvitation,
  onCancelInvitation,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'invite' | 'pending'>('invite');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviteResult, setInviteResult] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルを開くたびにリセット
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setName('');
      setErrors({});
      setInviteResult(null);
      setCopied(false);
    }
  }, [isOpen]);

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    if (!name.trim()) {
      newErrors.name = '名前を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 招待送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await onInvite(email.trim(), name.trim());
      if (result) {
        // 招待URLを生成
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const inviteUrl = `${baseUrl}/facility/join?token=${result.token}`;
        setInviteResult({ token: result.token, url: inviteUrl });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // URLコピー
  const handleCopyUrl = async () => {
    if (!inviteResult) return;

    try {
      await navigator.clipboard.writeText(inviteResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 招待ステータスラベル
  const getStatusLabel = (status: StaffInvitation['status']) => {
    switch (status) {
      case 'pending':
        return { label: '招待中', color: 'bg-yellow-100 text-yellow-700' };
      case 'accepted':
        return { label: '承認済み', color: 'bg-green-100 text-green-700' };
      case 'expired':
        return { label: '期限切れ', color: 'bg-gray-100 text-gray-500' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700' };
    }
  };

  // 残り時間計算
  const getRemainingTime = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return '期限切れ';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `残り ${days}日`;
    if (hours > 0) return `残り ${hours}時間`;
    return '間もなく期限切れ';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* モーダル */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-[#00c4cc]" />
            <h2 className="text-lg font-bold text-gray-800">スタッフを招待</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('invite')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invite'
                ? 'border-[#00c4cc] text-[#00c4cc]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            新規招待
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-[#00c4cc] text-[#00c4cc]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            招待中
            {pendingInvitations.filter((i) => i.status === 'pending').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                {pendingInvitations.filter((i) => i.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'invite' ? (
            <div className="p-6">
              {inviteResult ? (
                // 招待成功
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    招待を送信しました
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {name}さんに招待メールを送信しました。
                    <br />
                    または以下のURLを共有してください。
                  </p>

                  {/* 招待URL */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      招待URL（7日間有効）
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inviteResult.url}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600"
                      />
                      <button
                        onClick={handleCopyUrl}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                          copied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-[#00c4cc] text-white hover:bg-[#00b0b8]'
                        }`}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'コピー済み' : 'コピー'}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setInviteResult(null);
                      setEmail('');
                      setName('');
                    }}
                    className="text-sm text-[#00c4cc] hover:text-[#00b0b8]"
                  >
                    別のスタッフを招待する
                  </button>
                </div>
              ) : (
                // 招待フォーム
                <form onSubmit={handleSubmit} className="space-y-6">
                  <p className="text-gray-600 text-sm">
                    招待するスタッフの情報を入力してください。
                    招待メールが送信され、7日間有効な招待URLが発行されます。
                  </p>

                  {/* 名前 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      名前 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="山田 太郎"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* メールアドレス */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] ${
                          errors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="example@email.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* 招待プレビュー */}
                  {name && email && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">招待メールプレビュー</p>
                      <div className="p-3 bg-white rounded-lg border border-gray-100 text-sm text-gray-600 space-y-1">
                        <p className="font-medium text-gray-800">{name}様</p>
                        <p>スタッフとして招待されました。</p>
                        <p>以下のリンクからアカウントを作成してください。</p>
                        <div className="mt-2 px-3 py-1.5 bg-[#00c4cc]/5 rounded text-[#00c4cc] text-xs font-mono">
                          招待URL（7日間有効）
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 送信ボタン */}
                  <button
                    type="submit"
                    disabled={isSubmitting || loading}
                    className="w-full flex items-center justify-center gap-2 min-h-10 px-4 py-3 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-all duration-200 disabled:opacity-50 font-medium"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        送信中...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        招待を送信
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            // 招待中リスト
            <div className="p-6">
              {pendingInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">招待中のスタッフはいません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingInvitations.map((invitation) => {
                    const status = getStatusLabel(invitation.status);
                    return (
                      <div
                        key={invitation.id}
                        className="p-4 bg-gray-50 rounded-xl"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-800">
                              {invitation.name}
                            </h4>
                            <p className="text-sm text-gray-500">{invitation.email}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock size={12} />
                            <span>{getRemainingTime(invitation.expiresAt)}</span>
                          </div>

                          {invitation.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              {onResendInvitation && (
                                <button
                                  onClick={() => onResendInvitation(invitation)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-[#00c4cc] hover:bg-[#00c4cc]/5 rounded"
                                >
                                  <RefreshCw size={12} />
                                  再送信
                                </button>
                              )}
                              {onCancelInvitation && (
                                <button
                                  onClick={() => onCancelInvitation(invitation)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 size={12} />
                                  取消
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StaffInviteModal;
