'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  Send,
  User,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { useConsultationMessages } from '@/hooks/useConsultations';
import { supabase } from '@/lib/supabase';
import {
  ConsultationThread,
  ConsultationMessage,
  CONSULTATION_CATEGORIES,
  mapConsultationThreadFromDB,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ExpertConsultationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const threadId = params.threadId as string;

  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [thread, setThread] = useState<ConsultationThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading: messagesLoading, sendMessage } = useConsultationMessages(threadId, user?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch (e) {
        router.push('/career/login');
      }
    } else {
      router.push('/career/login');
    }
  }, [router]);

  // スレッド情報取得
  useEffect(() => {
    const fetchThread = async () => {
      if (!threadId) return;

      try {
        setThreadLoading(true);
        const { data, error } = await supabase
          .from('consultation_threads')
          .select(`
            *,
            client:users!consultation_threads_client_id_fkey(id, name),
            expert:expert_profiles!consultation_threads_expert_id_fkey(id, display_name, user_id)
          `)
          .eq('id', threadId)
          .single();

        if (error) throw error;

        if (data) {
          setThread(mapConsultationThreadFromDB(data));
        }
      } catch (err) {
        console.error('Error fetching thread:', err);
      } finally {
        setThreadLoading(false);
      }
    };

    fetchThread();
  }, [threadId]);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !user || !thread) return;

    setIsSending(true);
    try {
      await sendMessage(replyText.trim(), 'expert');
      setReplyText('');
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseThread = async () => {
    if (!thread) return;

    try {
      await supabase
        .from('consultation_threads')
        .update({ status: 'closed' })
        .eq('id', thread.id);

      setThread(prev => prev ? { ...prev, status: 'closed' } : null);
      setShowMenu(false);
    } catch (err) {
      console.error('Error closing thread:', err);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (threadLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-500">相談が見つかりません</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
        >
          戻る
        </button>
      </div>
    );
  }

  const statusColors = {
    open: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    closed: 'bg-gray-100 text-gray-600',
  };

  const statusLabels = {
    open: '対応中',
    pending: '返信待ち',
    closed: '終了',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-gray-900 truncate">{thread.subject}</h1>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">{thread.clientName}</span>
                  {thread.childAge && (
                    <span className="text-gray-400">• {thread.childAge}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[thread.status]}`}>
                {statusLabels[thread.status]}
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[140px]">
                    {thread.status !== 'closed' && (
                      <button
                        onClick={handleCloseThread}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        相談を終了
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* カテゴリー */}
      {thread.consultationType && thread.consultationType.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <div className="max-w-2xl mx-auto flex flex-wrap gap-1">
            {thread.consultationType.map((cat, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-600 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* メッセージエリア */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {messagesLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              メッセージがありません
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isExpert = message.senderType === 'expert';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isExpert ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        isExpert
                          ? 'bg-emerald-500 text-white rounded-2xl rounded-tr-md'
                          : 'bg-white text-gray-900 rounded-2xl rounded-tl-md shadow-sm'
                      } px-4 py-3`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{message.message}</p>
                      <div
                        className={`flex items-center gap-1 mt-2 text-xs ${
                          isExpert ? 'text-emerald-100' : 'text-gray-400'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {formatMessageTime(message.createdAt)}
                        {isExpert && message.isRead && (
                          <CheckCircle className="w-3 h-3 ml-1" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* 入力エリア */}
      {thread.status !== 'closed' ? (
        <div className="bg-white border-t border-gray-100 p-4 safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="返信を入力..."
                rows={3}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSending}
                className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              返信を送信すると、クライアントがポイントを消費してメッセージを閲覧できます
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 border-t border-gray-200 p-4 text-center text-gray-500 safe-area-bottom">
          この相談は終了しました
        </div>
      )}
    </div>
  );
}
