/**
 * チャットビューコンポーネント
 * 保護者と施設スタッフ間のリアルタイムチャット用
 * co-shienオリジナルデザイン
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, User, Building2, XCircle, Calendar, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ChatMessage } from '@/types';

type QuickAction = {
  type: 'absence' | 'schedule' | 'message';
  label: string;
  icon: React.ReactNode;
  color: string;
};

type ChatViewProps = {
  facilityId: string;
  facilityName: string;
  clientUserId: string;
  clientName?: string;
  currentUserId: string;
  currentUserName: string;
  currentUserType: 'staff' | 'client';
  onBack?: () => void;
  showQuickActions?: boolean;
  childId?: string;
};

// DBのsnake_caseからTypeScriptのcamelCaseに変換
const mapDbToMessage = (row: any): ChatMessage => ({
  id: row.id,
  facilityId: row.facility_id,
  clientUserId: row.client_user_id,
  senderId: row.sender_id,
  senderType: row.sender_type,
  senderName: row.sender_name,
  message: row.message,
  isRead: row.is_read,
  readAt: row.read_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export default function ChatView({
  facilityId,
  facilityName,
  clientUserId,
  clientName,
  currentUserId,
  currentUserName,
  currentUserType,
  onBack,
  showQuickActions = false,
  childId,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const quickActions: QuickAction[] = [
    { type: 'absence', label: '欠席連絡', icon: <XCircle className="w-4 h-4" />, color: 'bg-red-500' },
    { type: 'schedule', label: '利用希望', icon: <Calendar className="w-4 h-4" />, color: 'bg-blue-500' },
    { type: 'message', label: 'その他', icon: <MessageCircle className="w-4 h-4" />, color: 'bg-gray-500' },
  ];

  // メッセージ一覧を取得
  const fetchMessages = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('client_user_id', clientUserId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      if (data) {
        setMessages(data.map(mapDbToMessage));
      }
    } catch (err: any) {
      console.error('メッセージ取得エラー:', err);
      setError('メッセージの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 既読を更新（相手のメッセージを既読にする）
  const markAsRead = async () => {
    try {
      const targetSenderType = currentUserType === 'client' ? 'staff' : 'client';
      await supabase
        .from('chat_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('facility_id', facilityId)
        .eq('client_user_id', clientUserId)
        .eq('sender_type', targetSenderType)
        .eq('is_read', false);
    } catch (err) {
      console.error('既読更新エラー:', err);
    }
  };

  // 初回読み込みとリアルタイム購読
  useEffect(() => {
    fetchMessages();
    markAsRead();

    // Supabase Realtimeで新規メッセージを購読
    const channel = supabase
      .channel(`chat:${facilityId}:${clientUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `facility_id=eq.${facilityId}`,
        },
        (payload) => {
          const newMsg = mapDbToMessage(payload.new);
          // このチャットルームのメッセージのみ追加
          if (newMsg.clientUserId === clientUserId) {
            setMessages((prev) => {
              // 重複チェック
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // 相手からのメッセージの場合は既読にする
            if (newMsg.senderType !== currentUserType) {
              markAsRead();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [facilityId, clientUserId]);

  // 最下部にスクロール
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // 初回読み込み完了時に最下部にスクロール
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDone) {
      scrollToBottom(false);
      setInitialScrollDone(true);
    }
  }, [loading, messages.length, initialScrollDone, scrollToBottom]);

  // 新規メッセージ時にスムーズスクロール
  useEffect(() => {
    if (initialScrollDone && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, initialScrollDone]);

  // メッセージ送信
  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setError('');

    // クイックアクションがある場合はプレフィックスを追加
    let messageText = newMessage.trim();
    if (selectedQuickAction) {
      const prefix = selectedQuickAction.type === 'absence' ? '【欠席連絡】' :
                     selectedQuickAction.type === 'schedule' ? '【利用希望】' : '【連絡】';
      messageText = `${prefix}\n${messageText}`;
    }

    try {
      const { error: sendError } = await supabase
        .from('chat_messages')
        .insert({
          facility_id: facilityId,
          client_user_id: clientUserId,
          sender_id: currentUserId,
          sender_type: currentUserType,
          sender_name: currentUserName,
          message: messageText,
        });

      if (sendError) throw sendError;

      setNewMessage('');
      setSelectedQuickAction(null);
      inputRef.current?.focus();
    } catch (err: any) {
      console.error('送信エラー:', err);
      setError('メッセージの送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  // Enter送信（Shift+Enterで改行）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 日付ラベルを表示するか判定
  const shouldShowDateLabel = (msg: ChatMessage, index: number): boolean => {
    if (index === 0) return true;
    const prevDate = new Date(messages[index - 1].createdAt).toDateString();
    const currDate = new Date(msg.createdAt).toDateString();
    return prevDate !== currDate;
  };

  // 日付をフォーマット
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今日';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨日';
    } else {
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }
  };

  // 時刻をフォーマット
  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // メッセージタイプを判定（欠席連絡、利用希望など）
  const getMessageType = (message: string): 'absence' | 'schedule' | 'message' | null => {
    if (message.startsWith('【欠席連絡】')) return 'absence';
    if (message.startsWith('【利用希望】')) return 'schedule';
    if (message.startsWith('【連絡】')) return 'message';
    return null;
  };

  // テーマカラー
  const themeColor = currentUserType === 'client' ? '#f97316' : '#00c4cc'; // オレンジ or ティール

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 mx-auto mb-3"
            style={{ borderTopColor: themeColor }}
          ></div>
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* ヘッダー */}
      <div
        className="px-4 py-3 flex items-center gap-3 shadow-sm"
        style={{ backgroundColor: themeColor }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        )}
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          {currentUserType === 'client' ? (
            <Building2 className="w-5 h-5 text-white" />
          ) : (
            <User className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-white text-lg">
            {currentUserType === 'client' ? facilityName : clientName || '保護者'}
          </h2>
          <p className="text-xs text-white/80">
            メッセージ
          </p>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">メッセージはまだありません</p>
            <p className="text-sm text-gray-400 mt-1">
              {currentUserType === 'client'
                ? '施設へのご連絡をお待ちしています'
                : '保護者からのメッセージをお待ちしています'}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.senderId === currentUserId;
            const msgType = getMessageType(msg.message);
            const displayMessage = msg.message
              .replace('【欠席連絡】\n', '')
              .replace('【利用希望】\n', '')
              .replace('【連絡】\n', '');

            return (
              <React.Fragment key={msg.id}>
                {/* 日付ラベル */}
                {shouldShowDateLabel(msg, index) && (
                  <div className="flex justify-center my-4">
                    <span className="bg-gray-300 text-gray-600 text-xs px-4 py-1.5 rounded-full font-medium">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                )}
                {/* メッセージ */}
                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* 送信者名（相手のメッセージのみ） */}
                    {!isOwn && (
                      <div className="flex items-center gap-2 mb-1 ml-1">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: msg.senderType === 'staff' ? '#00c4cc' : '#f97316' }}
                        >
                          {msg.senderType === 'staff' ? (
                            <Building2 className="w-3 h-3 text-white" />
                          ) : (
                            <User className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500 font-medium">{msg.senderName}</span>
                      </div>
                    )}

                    {/* メッセージタイプバッジ */}
                    {msgType && (
                      <div className={`mb-1 ${isOwn ? 'mr-1 self-end' : 'ml-1 self-start'}`}>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${
                          msgType === 'absence' ? 'bg-red-500' :
                          msgType === 'schedule' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}>
                          {msgType === 'absence' ? '欠席連絡' :
                           msgType === 'schedule' ? '利用希望' : '連絡'}
                        </span>
                      </div>
                    )}

                    {/* 吹き出し */}
                    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 shadow-sm ${
                          isOwn
                            ? 'rounded-tr-md'
                            : 'rounded-tl-md bg-white'
                        }`}
                        style={isOwn ? { backgroundColor: themeColor } : {}}
                      >
                        <p className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${
                          isOwn ? 'text-white' : 'text-gray-800'
                        }`}>
                          {displayMessage}
                        </p>
                      </div>
                      {/* 時刻・既読 */}
                      <div className={`flex flex-col text-xs text-gray-400 mb-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                        {isOwn && msg.isRead && (
                          <span className="text-gray-500">既読</span>
                        )}
                        <span>{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* クイックアクションボタン（利用者のみ） */}
      {showQuickActions && currentUserType === 'client' && (
        <div className="bg-white border-t border-gray-200 px-4 py-2">
          <div className="flex gap-2">
            {quickActions.map((action) => (
              <button
                key={action.type}
                onClick={() => setSelectedQuickAction(
                  selectedQuickAction?.type === action.type ? null : action
                )}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedQuickAction?.type === action.type
                    ? `${action.color} text-white shadow-md`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
          {selectedQuickAction && (
            <p className="text-xs text-gray-500 mt-2 ml-1">
              {selectedQuickAction.type === 'absence' && '欠席の日付と理由をお知らせください'}
              {selectedQuickAction.type === 'schedule' && '利用希望日と時間帯をお知らせください'}
              {selectedQuickAction.type === 'message' && 'ご連絡内容をご記入ください'}
            </p>
          )}
        </div>
      )}

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-200 p-3 safe-area-inset-bottom">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedQuickAction
                ? `${selectedQuickAction.label}の内容を入力...`
                : 'メッセージを入力...'
            }
            className="flex-1 resize-none bg-gray-100 border-0 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-opacity-50 max-h-32 text-[15px]"
            style={{
              minHeight: '48px',
              // @ts-ignore
              '--tw-ring-color': themeColor,
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className={`p-3 rounded-xl transition-all ${
              newMessage.trim()
                ? 'text-white shadow-md hover:shadow-lg active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            style={newMessage.trim() ? { backgroundColor: themeColor } : {}}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
