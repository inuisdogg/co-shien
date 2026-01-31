'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  Send,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle,
  Lock,
  Coins,
  Eye,
} from 'lucide-react';
import { useConsultationMessages } from '@/hooks/useConsultations';
import { usePoints } from '@/hooks/usePoints';
import { supabase } from '@/lib/supabase';
import {
  ConsultationThread,
  ConsultationMessage,
  mapConsultationThreadFromDB,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ClientConsultationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const threadId = params.threadId as string;

  const [user, setUser] = useState<{ id: string; name: string; userType: string } | null>(null);
  const [thread, setThread] = useState<ConsultationThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [revealingMessageId, setRevealingMessageId] = useState<string | null>(null);
  const [showPointModal, setShowPointModal] = useState(false);
  const [pendingRevealMessageId, setPendingRevealMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading: messagesLoading, sendMessage, markAsRead, refresh: refreshMessages } = useConsultationMessages(threadId, user?.id);
  const { points, consumePoints, hasEnoughPoints, refresh: refreshPoints } = usePoints(user?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.userType !== 'client' && parsed.userType !== 'staff') {
          router.push('/parent/login');
          return;
        }
        setUser(parsed);
      } catch (e) {
        router.push('/parent/login');
      }
    } else {
      router.push('/parent/login');
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
            expert:expert_profiles!consultation_threads_expert_id_fkey(
              id,
              display_name,
              user_id,
              price_per_message,
              page_theme
            )
          `)
          .eq('id', threadId)
          .single();

        if (error) throw error;

        if (data) {
          const mapped = mapConsultationThreadFromDB(data);
          // Expert pricing info
          if (data.expert) {
            (mapped as any).expertPricePerMessage = data.expert.price_per_message;
            (mapped as any).expertTheme = data.expert.page_theme;
          }
          setThread(mapped);
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

  const handleSendMessage = async () => {
    if (!replyText.trim() || !user || !thread) return;

    setIsSending(true);
    try {
      await sendMessage(replyText.trim(), 'client');
      setReplyText('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleRevealMessage = async (messageId: string, pointsRequired: number) => {
    if (!user) return;

    // ポイント確認
    if (!hasEnoughPoints(pointsRequired)) {
      setPendingRevealMessageId(messageId);
      setShowPointModal(true);
      return;
    }

    setRevealingMessageId(messageId);
    try {
      // ポイント消費
      const success = await consumePoints(
        pointsRequired,
        'consultation',
        `相談メッセージ閲覧: ${thread?.subject}`
      );

      if (success) {
        // メッセージを既読にする
        await markAsRead(messageId);
        await refreshMessages();
        await refreshPoints();
      }
    } catch (err) {
      console.error('Error revealing message:', err);
    } finally {
      setRevealingMessageId(null);
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

  const pricePerMessage = (thread as any).expertPricePerMessage || 100;
  const primaryColor = (thread as any).expertTheme?.primaryColor || '#10B981';

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
                  <span className="text-gray-500">{thread.expertName}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[thread.status]}`}>
                {statusLabels[thread.status]}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ポイント残高 */}
      <div className="bg-white border-b border-gray-100 px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-gray-600">保有ポイント:</span>
            <span className="font-bold text-gray-900">{points?.balance || 0} pt</span>
          </div>
          <button
            onClick={() => router.push('/parent/points')}
            className="text-sm text-emerald-600 hover:underline"
          >
            ポイント購入
          </button>
        </div>
      </div>

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
                const isClient = message.senderType === 'client';
                const isExpertUnread = message.senderType === 'expert' && !message.isRead;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                  >
                    {isExpertUnread ? (
                      // 未読のエキスパートメッセージ（ロック状態）
                      <div className="max-w-[80%] bg-white rounded-2xl rounded-tl-md shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Lock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-600">
                              専門家からの返信があります
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            {formatMessageTime(message.createdAt)}に送信されました
                          </p>
                          <button
                            onClick={() => handleRevealMessage(message.id, pricePerMessage)}
                            disabled={revealingMessageId === message.id}
                            className="flex items-center justify-center gap-2 w-full py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {revealingMessageId === message.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                {pricePerMessage} pt で閲覧
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // 通常のメッセージ（自分のメッセージ or 既読のエキスパートメッセージ）
                      <div
                        className={`max-w-[80%] ${
                          isClient
                            ? 'bg-emerald-500 text-white rounded-2xl rounded-tr-md'
                            : 'bg-white text-gray-900 rounded-2xl rounded-tl-md shadow-sm'
                        } px-4 py-3`}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.message}</p>
                        <div
                          className={`flex items-center gap-1 mt-2 text-xs ${
                            isClient ? 'text-emerald-100' : 'text-gray-400'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {formatMessageTime(message.createdAt)}
                          {!isClient && message.isRead && (
                            <CheckCircle className="w-3 h-3 ml-1 text-emerald-500" />
                          )}
                        </div>
                      </div>
                    )}
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
                placeholder="メッセージを入力..."
                rows={3}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleSendMessage}
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
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 border-t border-gray-200 p-4 text-center text-gray-500 safe-area-bottom">
          この相談は終了しました
        </div>
      )}

      {/* ポイント不足モーダル */}
      {showPointModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <Coins className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                ポイントが不足しています
              </h3>
              <p className="text-sm text-gray-500">
                メッセージの閲覧には{pricePerMessage}ポイントが必要です。<br />
                現在の保有ポイント: {points?.balance || 0}pt
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowPointModal(false);
                  router.push('/parent/points');
                }}
                className="w-full py-2.5 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600"
              >
                ポイントを購入する
              </button>
              <button
                onClick={() => setShowPointModal(false)}
                className="w-full py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
