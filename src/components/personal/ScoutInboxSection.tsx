'use client';

/**
 * スカウト受信箱セクション
 * キャリアアプリのホームタブに表示。受信したスカウトメッセージの一覧と操作。
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  MailOpen,
  Reply,
  XCircle,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Inbox,
} from 'lucide-react';
import { useScout } from '@/hooks/useScout';
import { ScoutMessage } from '@/types';

// ------------------------------------------------------------------ Props

interface ScoutInboxSectionProps {
  userId?: string;
}

// ------------------------------------------------------------------ Helpers

const STATUS_CONFIG: Record<ScoutMessage['status'], { label: string; bg: string; text: string }> = {
  sent: { label: '未読', bg: 'bg-blue-100', text: 'text-blue-700' },
  read: { label: '既読', bg: 'bg-gray-100', text: 'text-gray-600' },
  replied: { label: '返信済', bg: 'bg-green-100', text: 'text-green-700' },
  declined: { label: '辞退', bg: 'bg-red-100', text: 'text-red-600' },
};

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function truncateText(text: string, maxLines: number = 2): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    const joined = lines.join(' ');
    return joined.length > 100 ? joined.substring(0, 100) + '...' : joined;
  }
  const joined = lines.slice(0, maxLines).join(' ');
  return joined.length > 100 ? joined.substring(0, 100) + '...' : joined + '...';
}

// ------------------------------------------------------------------ Component

export default function ScoutInboxSection({ userId }: ScoutInboxSectionProps) {
  const {
    scouts,
    loading,
    fetchMyScouts,
    markScoutRead,
    replyToScout,
    declineScout,
  } = useScout();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyScoutId, setReplyScoutId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);
  const [declining, setDeclining] = useState<string | null>(null);

  // 初回取得
  useEffect(() => {
    if (userId) {
      fetchMyScouts(userId);
    }
  }, [userId, fetchMyScouts]);

  // カード展開
  const handleToggle = useCallback(async (scout: ScoutMessage) => {
    if (expandedId === scout.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(scout.id);
    // 未読なら既読にする
    if (scout.status === 'sent') {
      await markScoutRead(scout.id);
    }
  }, [expandedId, markScoutRead]);

  // 返信モーダルを開く
  const handleOpenReply = useCallback((scoutId: string) => {
    setReplyScoutId(scoutId);
    setReplyMessage('');
    setShowReplyModal(true);
  }, []);

  // 返信送信
  const handleReply = useCallback(async () => {
    if (!replyScoutId || !userId) return;
    setReplying(true);
    try {
      const scout = scouts.find(s => s.id === replyScoutId);
      if (!scout) return;

      // スカウトに対して応募を作成（jobPostingIdがある場合）
      if (scout.jobPostingId) {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('job_applications').insert({
          job_posting_id: scout.jobPostingId,
          applicant_user_id: userId,
          status: 'applied',
          cover_message: `【スカウトへの返信】\n${replyMessage || 'スカウトを拝見し、応募いたします。'}`,
        });
      }

      await replyToScout(replyScoutId, userId);
      setShowReplyModal(false);
      setReplyScoutId(null);
      setReplyMessage('');
    } catch (err) {
      console.error('返信エラー:', err);
    } finally {
      setReplying(false);
    }
  }, [replyScoutId, userId, scouts, replyToScout, replyMessage]);

  // 辞退
  const handleDecline = useCallback(async (scoutId: string) => {
    if (!confirm('このスカウトを辞退しますか？')) return;
    setDeclining(scoutId);
    await declineScout(scoutId);
    setDeclining(null);
    setExpandedId(null);
  }, [declineScout]);

  // 未読数
  const unreadCount = scouts.filter(s => s.status === 'sent').length;

  if (!userId) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#818CF8]" />
            スカウト
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[#818CF8] rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="divide-y divide-gray-50">
        {loading && scouts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#818CF8]" />
          </div>
        ) : scouts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">スカウトメッセージはまだありません</p>
            <p className="text-xs text-gray-400 mt-1">施設からスカウトが届くとここに表示されます</p>
          </div>
        ) : (
          scouts.map((scout) => {
            const isExpanded = expandedId === scout.id;
            const isUnread = scout.status === 'sent';
            const statusConfig = STATUS_CONFIG[scout.status];

            return (
              <div key={scout.id} className="relative">
                {/* スカウトカード */}
                <button
                  onClick={() => handleToggle(scout)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    isUnread ? 'border-l-4 border-l-[#818CF8] bg-indigo-50/30' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* アイコン */}
                    <div className={`mt-0.5 shrink-0 ${isUnread ? 'text-[#818CF8]' : 'text-gray-400'}`}>
                      {isUnread ? (
                        <Mail className="w-5 h-5" />
                      ) : (
                        <MailOpen className="w-5 h-5" />
                      )}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                        <span className="text-xs text-gray-400">{relativeTime(scout.createdAt)}</span>
                      </div>
                      <p className={`text-sm mb-1 truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {scout.subject}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        {scout.facilityName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {scout.facilityName}
                          </span>
                        )}
                        {scout.jobTitle && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {scout.jobTitle}
                          </span>
                        )}
                      </div>
                      {!isExpanded && (
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {truncateText(scout.message)}
                        </p>
                      )}
                    </div>

                    {/* 展開アイコン */}
                    <div className="shrink-0 text-gray-400 mt-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </button>

                {/* 展開コンテンツ */}
                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-50/50">
                    {/* メッセージ本文 */}
                    <div className="ml-8 mb-4 p-4 bg-white rounded-lg border border-gray-100">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {scout.message}
                      </p>
                    </div>

                    {/* アクションボタン */}
                    {scout.status !== 'declined' && scout.status !== 'replied' && (
                      <div className="ml-8 flex flex-wrap gap-2">
                        {scout.jobPostingId && (
                          <a
                            href={`/career?tab=jobs&jobId=${scout.jobPostingId}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#818CF8] text-white text-xs font-medium rounded-lg hover:bg-[#6366F1] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            この求人に応募する
                          </a>
                        )}
                        <button
                          onClick={() => handleOpenReply(scout.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-[#818CF8] text-xs font-medium rounded-lg hover:bg-indigo-200 transition-colors"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          返信する
                        </button>
                        <button
                          onClick={() => handleDecline(scout.id)}
                          disabled={declining === scout.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          {declining === scout.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          辞退する
                        </button>
                      </div>
                    )}

                    {/* 返信済み・辞退済みの表示 */}
                    {scout.status === 'replied' && (
                      <div className="ml-8 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        返信済みです。応募状況は「求人」タブからご確認ください。
                      </div>
                    )}
                    {scout.status === 'declined' && (
                      <div className="ml-8 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                        このスカウトは辞退済みです。
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 返信モーダル */}
      {showReplyModal && replyScoutId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Reply className="w-5 h-5 text-[#818CF8]" />
                スカウトに返信
              </h3>
              <button
                onClick={() => { setShowReplyModal(false); setReplyScoutId(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* スカウト情報 */}
              {(() => {
                const scout = scouts.find(s => s.id === replyScoutId);
                return scout ? (
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-800">{scout.subject}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {scout.facilityName}{scout.jobTitle ? ` - ${scout.jobTitle}` : ''}
                    </p>
                  </div>
                ) : null;
              })()}

              {/* 返信メッセージ */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  返信メッセージ
                </label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="スカウトを拝見し、大変興味を持ちました。ぜひ詳しくお話を伺いたいです。"
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#818CF8] resize-none"
                />
              </div>

              {/* 注意書き */}
              {scouts.find(s => s.id === replyScoutId)?.jobPostingId && (
                <p className="text-xs text-gray-400">
                  返信すると、この求人への応募が自動的に作成されます。
                </p>
              )}

              {/* ボタン */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowReplyModal(false); setReplyScoutId(null); }}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleReply}
                  disabled={replying}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#818CF8] hover:bg-[#6366F1] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {replying && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Reply className="w-4 h-4" />
                  返信を送信
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
