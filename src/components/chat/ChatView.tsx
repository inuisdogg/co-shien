'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  facility_id: string;
  client_user_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'staff' | 'client';
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface ChatViewProps {
  facilityId: string;
  facilityName: string;
  clientUserId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserType: 'staff' | 'client';
  onBack?: () => void;
  showQuickActions?: boolean;
}

export default function ChatView({
  facilityId,
  facilityName,
  clientUserId,
  currentUserId,
  currentUserName,
  currentUserType,
  onBack,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('client_user_id', clientUserId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (!error && data && !cancelled) {
          setMessages(data);

          // 相手のメッセージを既読にする
          if (data.length > 0) {
            const unreadIds = data
              .filter((m) => m.sender_id !== currentUserId && !m.is_read)
              .map((m) => m.id);
            if (unreadIds.length > 0) {
              await supabase
                .from('chat_messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', unreadIds);
            }
          }
        }
      } catch {
        // chat_messagesテーブルが未作成の場合は空のまま
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    // Supabase Realtime subscription
    // filter on facility_id; client-side filter on client_user_id
    const channel = supabase
      .channel(`chat_${facilityId}_${clientUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `facility_id=eq.${facilityId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          // client-side filter: only messages for this conversation
          if (newMsg.client_user_id !== clientUserId) return;
          setMessages((prev) => {
            // 楽観的追加による重複防止
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [facilityId, clientUserId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text) return;

    setNewMessage('');

    try {
      const { error } = await supabase.from('chat_messages').insert({
        facility_id: facilityId,
        client_user_id: clientUserId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        sender_type: currentUserType,
        message: text,
      });

      if (error) {
        console.error('メッセージ送信エラー:', error);
        setNewMessage(text);
      }
    } catch {
      setNewMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msg.created_at, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="戻る"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div>
          <h2 className="font-semibold text-gray-900">{facilityName}</h2>
          <p className="text-xs text-gray-500">チャット</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="w-7 h-7 text-gray-400" />}
            title="メッセージはまだありません"
            description="最初のメッセージを送信しましょう"
          />
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                  {formatDate(group.date)}
                </span>
              </div>
              {group.messages.map((msg) => {
                const isMine = msg.sender_id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                        isMine
                          ? 'bg-primary text-white rounded-br-md'
                          : 'bg-white text-gray-900 border rounded-bl-md'
                      }`}
                    >
                      {!isMine && (
                        <p className="text-xs font-medium text-gray-500 mb-1">{msg.sender_name}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <p
                        className={`text-[10px] mt-1 text-right ${
                          isMine ? 'text-white/60' : 'text-gray-400'
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            rows={1}
            className="flex-1 resize-none border rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="p-2 bg-primary text-white rounded-full hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="送信"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
