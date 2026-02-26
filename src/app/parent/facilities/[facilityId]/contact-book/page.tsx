/**
 * Parent Contact Book (連絡帳) View
 * Shows contact books submitted by staff for the parent to review and sign.
 * - List of unsigned contact books requiring signature
 * - "署名する" button with name input
 * - History of past signed contact books
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  PenLine,
  Heart,
  Smile,
  Utensils,
  Moon,
  Droplet,
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  User,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 体調・機嫌・食欲のラベル
const HEALTH_LABELS: Record<string, string> = {
  excellent: '良好',
  good: '普通',
  fair: 'やや不良',
  poor: '不良',
};

const MOOD_LABELS: Record<string, { label: string; emoji: string }> = {
  very_happy: { label: 'とても元気', emoji: '😄' },
  happy: { label: '元気', emoji: '😊' },
  neutral: { label: '普通', emoji: '😐' },
  sad: { label: 'やや元気なし', emoji: '😔' },
  upset: { label: '元気なし', emoji: '😢' },
};

const APPETITE_LABELS: Record<string, string> = {
  excellent: '完食',
  good: 'ほぼ完食',
  fair: '半分程度',
  poor: '少量',
  none: '食べず',
};

type ContactBookEntry = {
  id: string;
  facility_id: string;
  child_id: string;
  schedule_id: string | null;
  date: string;
  slot: string | null;
  activities: string | null;
  health_status: string | null;
  mood: string | null;
  appetite: string | null;
  meal_main: boolean;
  meal_side: boolean;
  meal_notes: string | null;
  toilet_count: number;
  toilet_notes: string | null;
  nap_start_time: string | null;
  nap_end_time: string | null;
  nap_notes: string | null;
  staff_comment: string | null;
  parent_message: string | null;
  parent_reply: string | null;
  parent_reply_at: string | null;
  status: string;
  is_signed: boolean;
  signed_at: string | null;
  signed_by_user_id: string | null;
  signature_data: string | null;
  parent_signer_name: string | null;
  created_at: string;
  updated_at: string;
  // joined child name
  child_name?: string;
};

export default function ParentContactBookPage() {
  const router = useRouter();
  const params = useParams();
  const facilityId = params.facilityId as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [contactBooks, setContactBooks] = useState<ContactBookEntry[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Signing state
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  // Expanded detail state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Tab: unsigned vs history
  const [tab, setTab] = useState<'unsigned' | 'history'>('unsigned');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/parent/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (user.userType !== 'client') {
          router.push('/career');
          return;
        }
        setCurrentUser(user);

        // Fetch facility
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single();

        if (facilityData) setFacility(facilityData);

        // Fetch children for this parent
        const { data: childrenData } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', user.id);

        const myChildren = childrenData || [];
        setChildren(myChildren);

        if (myChildren.length === 0) {
          setLoading(false);
          return;
        }

        const childIds = myChildren.map((c: any) => c.id);

        // Fetch contact logs for these children at this facility
        // Only show submitted or signed entries (not drafts)
        const { data: contactData, error: contactError } = await supabase
          .from('contact_logs')
          .select('*')
          .eq('facility_id', facilityId)
          .in('child_id', childIds)
          .in('status', ['submitted', 'signed'])
          .order('date', { ascending: false });

        if (contactError) {
          console.error('Contact logs fetch error:', contactError);
        }

        if (contactData) {
          // Attach child names
          const childMap = new Map(myChildren.map((c: any) => [c.id, c.name]));
          const enriched = contactData.map((entry: any) => ({
            ...entry,
            child_name: childMap.get(entry.child_id) || '不明',
          }));
          setContactBooks(enriched);
        }
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId, router]);

  // Split into unsigned and signed
  const unsignedBooks = useMemo(
    () => contactBooks.filter((b) => b.status === 'submitted' && !b.is_signed),
    [contactBooks]
  );

  const signedBooks = useMemo(
    () => contactBooks.filter((b) => b.status === 'signed' || b.is_signed),
    [contactBooks]
  );

  // Handle sign
  const handleSign = async (entry: ContactBookEntry) => {
    if (!signerName.trim()) return;
    setIsSigning(true);

    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('contact_logs')
        .update({
          status: 'signed',
          is_signed: true,
          signed_at: now,
          signed_by_user_id: currentUser?.id || null,
          signature_data: signerName.trim(),
          parent_signer_name: signerName.trim(),
          updated_at: now,
        })
        .eq('id', entry.id);

      if (updateError) throw updateError;

      // Update local state
      setContactBooks((prev) =>
        prev.map((b) =>
          b.id === entry.id
            ? {
                ...b,
                status: 'signed',
                is_signed: true,
                signed_at: now,
                signed_by_user_id: currentUser?.id || null,
                signature_data: signerName.trim(),
                parent_signer_name: signerName.trim(),
              }
            : b
        )
      );

      setSigningId(null);
      setSignerName('');
    } catch (err: any) {
      alert('署名に失敗しました: ' + (err.message || ''));
    } finally {
      setIsSigning(false);
    }
  };

  // Submit reply
  const [replyText, setReplyText] = useState('');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);

  const handleReply = async (entryId: string) => {
    if (!replyText.trim()) return;
    setIsReplying(true);

    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('contact_logs')
        .update({
          parent_reply: replyText.trim(),
          parent_reply_at: now,
          updated_at: now,
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      setContactBooks((prev) =>
        prev.map((b) =>
          b.id === entryId
            ? { ...b, parent_reply: replyText.trim(), parent_reply_at: now }
            : b
        )
      );

      setReplyingId(null);
      setReplyText('');
    } catch (err: any) {
      alert('返信に失敗しました');
    } finally {
      setIsReplying(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${m}月${d}日(${days[date.getDay()]})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#F6AD55] mx-auto mb-3" />
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  const renderContactDetail = (entry: ContactBookEntry) => (
    <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3 text-[13px]">
      {/* Activities */}
      {entry.activities && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-[#00c4cc]" /> 今日の活動
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{entry.activities}</p>
        </div>
      )}

      {/* Health / Mood / Appetite */}
      <div className="grid grid-cols-3 gap-3">
        {entry.health_status && (
          <div>
            <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-0.5">
              <Heart className="w-3 h-3 text-red-400" /> 体調
            </div>
            <p className="text-gray-700">{HEALTH_LABELS[entry.health_status] || entry.health_status}</p>
          </div>
        )}
        {entry.mood && (
          <div>
            <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-0.5">
              <Smile className="w-3 h-3 text-yellow-500" /> 機嫌
            </div>
            <p className="text-gray-700">
              {MOOD_LABELS[entry.mood]?.emoji} {MOOD_LABELS[entry.mood]?.label || entry.mood}
            </p>
          </div>
        )}
        {entry.appetite && (
          <div>
            <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-0.5">
              <Utensils className="w-3 h-3 text-orange-400" /> 食欲
            </div>
            <p className="text-gray-700">{APPETITE_LABELS[entry.appetite] || entry.appetite}</p>
          </div>
        )}
      </div>

      {/* Meal */}
      {(entry.meal_main || entry.meal_side || entry.meal_notes) && (
        <div>
          <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-0.5">
            <Utensils className="w-3 h-3 text-orange-400" /> 食事
          </div>
          <div className="flex gap-3 text-gray-700">
            {entry.meal_main && <span>主食</span>}
            {entry.meal_side && <span>副食</span>}
          </div>
          {entry.meal_notes && <p className="text-gray-600 mt-0.5">{entry.meal_notes}</p>}
        </div>
      )}

      {/* Toilet */}
      {(entry.toilet_count > 0 || entry.toilet_notes) && (
        <div>
          <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-0.5">
            <Droplet className="w-3 h-3 text-blue-400" /> 排泄
          </div>
          <p className="text-gray-700">トイレ {entry.toilet_count}回</p>
          {entry.toilet_notes && <p className="text-gray-600 mt-0.5">{entry.toilet_notes}</p>}
        </div>
      )}

      {/* Nap */}
      {(entry.nap_start_time || entry.nap_end_time || entry.nap_notes) && (
        <div>
          <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-0.5">
            <Moon className="w-3 h-3 text-indigo-400" /> お昼寝
          </div>
          {entry.nap_start_time && entry.nap_end_time && (
            <p className="text-gray-700">{entry.nap_start_time} ~ {entry.nap_end_time}</p>
          )}
          {entry.nap_notes && <p className="text-gray-600 mt-0.5">{entry.nap_notes}</p>}
        </div>
      )}

      {/* Staff Comment */}
      {entry.staff_comment && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-1">
            <MessageSquare className="w-3 h-3 text-[#00c4cc]" /> スタッフコメント
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{entry.staff_comment}</p>
        </div>
      )}

      {/* Parent Message */}
      {entry.parent_message && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs font-bold text-amber-600 mb-1">
            <MessageSquare className="w-3 h-3" /> 保護者への連絡
          </div>
          <p className="text-amber-800 whitespace-pre-wrap">{entry.parent_message}</p>
        </div>
      )}

      {/* Parent Reply */}
      {entry.parent_reply && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 mb-1">
            <Send className="w-3 h-3" /> あなたの返信
          </div>
          <p className="text-indigo-800 whitespace-pre-wrap">{entry.parent_reply}</p>
          {entry.parent_reply_at && (
            <p className="text-[10px] text-indigo-400 mt-1">
              {new Date(entry.parent_reply_at).toLocaleString('ja-JP')}
            </p>
          )}
        </div>
      )}

      {/* Reply Form */}
      {!entry.parent_reply && entry.status !== 'signed' && (
        <div>
          {replyingId === entry.id ? (
            <div className="space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F6AD55]/20 focus:border-[#F6AD55] text-[13px]"
                rows={2}
                placeholder="スタッフへの返信を入力..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setReplyingId(null); setReplyText(''); }}
                  className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleReply(entry.id)}
                  disabled={isReplying || !replyText.trim()}
                  className="px-3 py-1.5 text-xs text-white bg-[#F6AD55] rounded-lg hover:bg-[#ED8936] disabled:opacity-50 flex items-center gap-1"
                >
                  {isReplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  返信
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setReplyingId(entry.id)}
              className="text-xs text-[#F6AD55] hover:text-[#ED8936] font-medium"
            >
              返信する
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/parent/facilities/${facilityId}`)}
              className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <BookOpen size={18} className="text-[#F6AD55]" />
                連絡帳
              </h1>
              <p className="text-xs text-gray-500">{facility?.name || '施設'}</p>
            </div>
            {unsignedBooks.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                <Clock className="w-3 h-3" />
                {unsignedBooks.length}件 署名待ち
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
          <button
            onClick={() => setTab('unsigned')}
            className={`flex-1 px-4 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
              tab === 'unsigned'
                ? 'text-[#F6AD55] border-b-2 border-[#F6AD55] bg-[#F6AD55]/5'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <PenLine className="w-4 h-4" />
            署名待ち
            {unsignedBooks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                {unsignedBooks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 px-4 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
              tab === 'history'
                ? 'text-[#F6AD55] border-b-2 border-[#F6AD55] bg-[#F6AD55]/5'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            署名済み
            {signedBooks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                {signedBooks.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {tab === 'unsigned' && (
          <div className="space-y-3">
            {unsignedBooks.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">署名待ちの連絡帳はありません</p>
              </div>
            ) : (
              unsignedBooks.map((entry) => (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#F6AD55]/10 flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-[#F6AD55]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800">{entry.child_name}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(entry.date)}
                        {entry.slot && <span className="ml-1">({entry.slot === 'AM' ? '午前' : '午後'})</span>}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">
                      <Clock className="w-3 h-3" /> 署名待ち
                    </span>
                    {expandedId === entry.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Expanded detail */}
                  {expandedId === entry.id && renderContactDetail(entry)}

                  {/* Sign section */}
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    {signingId === entry.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5">
                            署名者名（保護者のお名前）
                          </label>
                          <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F6AD55]/20 focus:border-[#F6AD55] text-sm"
                            placeholder="保護者のお名前を入力"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setSigningId(null); setSignerName(''); }}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleSign(entry)}
                            disabled={!signerName.trim() || isSigning}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-[#F6AD55] hover:bg-[#ED8936] rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isSigning ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PenLine className="w-4 h-4" />
                            )}
                            署名する
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSigningId(entry.id);
                          setSignerName(currentUser?.name || `${currentUser?.last_name || ''} ${currentUser?.first_name || ''}`.trim());
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#F6AD55] hover:bg-[#ED8936] rounded-lg transition-colors shadow-sm"
                      >
                        <PenLine className="w-4 h-4" />
                        内容を確認して署名する
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {signedBooks.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">署名済みの連絡帳はありません</p>
              </div>
            ) : (
              signedBooks.map((entry) => (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800">{entry.child_name}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(entry.date)}
                        {entry.slot && <span className="ml-1">({entry.slot === 'AM' ? '午前' : '午後'})</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-medium">
                        <CheckCircle className="w-3 h-3" /> 署名済
                      </span>
                      {entry.signed_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(entry.signed_at).toLocaleDateString('ja-JP')}
                        </p>
                      )}
                    </div>
                    {expandedId === entry.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {expandedId === entry.id && (
                    <>
                      {renderContactDetail(entry)}
                      {/* Signature info */}
                      <div className="px-4 py-3 border-t border-emerald-100 bg-emerald-50/50">
                        <div className="flex items-center gap-2 text-sm">
                          <PenLine className="w-4 h-4 text-emerald-600" />
                          <span className="font-medium text-emerald-800">
                            署名: {entry.parent_signer_name || entry.signature_data}
                          </span>
                          {entry.signed_at && (
                            <span className="text-[11px] text-emerald-500">
                              ({new Date(entry.signed_at).toLocaleString('ja-JP')})
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Signing Dialog Overlay */}
      {signingId && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => { setSigningId(null); setSignerName(''); }} />
      )}
    </div>
  );
}
