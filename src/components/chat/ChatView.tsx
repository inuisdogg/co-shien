'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'staff' | 'client';
  content: string;
  created_at: string;
  read_at: string | null;
}

interface ChatViewProps {
  facilityId: string;
  facilityName: string;
  clientUserId?: string;
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

  const chatRoomId = clientUserId
    ? `${facilityId}_${clientUserId}`
    : `${facilityId}_${currentUserId}`;

  useEffect(() => {
    loadMessages();

    // Supabase Realtime subscription
    const channel = supabase
      .channel(`chat_${chatRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${chatRoomId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, sender_id, sender_name, sender_type, content, created_at, read_at')
        .eq('room_id', chatRoomId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && data) {
        setMessages(data);
      }
    } catch {
      // chat_messagesテーブルが未作成の場合は空のまま
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content) return;

    setNewMessage('');

    try {
      await supabase.from('chat_messages').insert({
        room_id: chatRoomId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        sender_type: currentUserType,
        content,
      });
    } catch {
      // テーブル未作成時のフォールバック
      setNewMessage(content);
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">メッセージはまだありません</p>
            <p className="text-xs mt-1">最初のメッセージを送信しましょう</p>
          </div>
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
                          ? 'bg-teal-500 text-white rounded-br-md'
                          : 'bg-white text-gray-900 border rounded-bl-md'
                      }`}
                    >
                      {!isMine && (
                        <p className="text-xs font-medium text-gray-500 mb-1">{msg.sender_name}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={`text-[10px] mt-1 text-right ${
                          isMine ? 'text-teal-100' : 'text-gray-400'
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
            className="flex-1 resize-none border rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="p-2 bg-teal-500 text-white rounded-full hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
