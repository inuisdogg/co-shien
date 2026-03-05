'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowLeft, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import ChatView from './ChatView';

interface ClientConversation {
  clientUserId: string;
  clientName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

/**
 * Business-side wrapper for ChatView.
 * Shows a list of client conversations, then opens ChatView for selected client.
 */
const BusinessChatView: React.FC = () => {
  const { facility, user } = useAuth();
  const [conversations, setConversations] = useState<ClientConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientUserId, setSelectedClientUserId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState('');

  const { toast } = useToast();
  const facilityId = facility?.id || '';
  const facilityName = facility?.name || '施設';
  const currentUserId = user?.id || '';
  const currentUserName = user?.name || 'スタッフ';

  useEffect(() => {
    if (!facilityId) return;
    let cancelled = false;

    const loadConversations = async () => {
      try {
        // 1. この施設のチャットメッセージを取得（最新100件）
        const { data: msgs, error } = await supabase
          .from('chat_messages')
          .select('client_user_id, sender_name, sender_type, message, created_at, is_read, sender_id')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false })
          .limit(500);

        if (error || !msgs || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        // 2. client_user_id ごとにグループ化
        const clientMap = new Map<string, ClientConversation>();
        for (const msg of msgs) {
          const cid = msg.client_user_id;
          if (!clientMap.has(cid)) {
            // 保護者名: sender_typeがclientのメッセージからsender_nameを取得
            const clientName = msg.sender_type === 'client'
              ? msg.sender_name
              : '';
            clientMap.set(cid, {
              clientUserId: cid,
              clientName,
              lastMessage: msg.message,
              lastMessageAt: msg.created_at,
              unreadCount: 0,
            });
          }
          // 保護者名がまだ空の場合、clientタイプの送信者から取得
          const conv = clientMap.get(cid)!;
          if (!conv.clientName && msg.sender_type === 'client') {
            conv.clientName = msg.sender_name;
          }
          // 未読カウント（スタッフ側から見て、clientからの未読）
          if (msg.sender_id !== currentUserId && !msg.is_read) {
            conv.unreadCount++;
          }
        }

        // 3. 名前が取れなかった保護者のユーザー情報を取得
        const unknownClients = [...clientMap.values()].filter((c) => !c.clientName);
        if (unknownClients.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, name')
            .in('id', unknownClients.map((c) => c.clientUserId));
          if (users) {
            for (const u of users) {
              const conv = clientMap.get(u.id);
              if (conv) conv.clientName = u.name || '保護者';
            }
          }
        }

        if (!cancelled) {
          // 最終メッセージが新しい順にソート
          const sorted = [...clientMap.values()].sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );
          setConversations(sorted);
        }
      } catch (err) {
        console.error('チャット一覧読み込みエラー:', err);
        if (!cancelled) toast.error('チャット一覧の読み込みに失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadConversations();

    return () => { cancelled = true; };
  }, [facilityId, currentUserId]);

  // 個別チャット表示
  if (selectedClientUserId) {
    return (
      <div className="h-[calc(100vh-140px)]">
        <ChatView
          facilityId={facilityId}
          facilityName={selectedClientName || '保護者'}
          clientUserId={selectedClientUserId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserType="staff"
          onBack={() => setSelectedClientUserId(null)}
        />
      </div>
    );
  }

  // 会話一覧
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-gray-50">
      <div className="px-4 py-3 bg-white border-b shadow-sm">
        <h2 className="font-semibold text-gray-900">保護者チャット</h2>
        <p className="text-xs text-gray-500">{facilityName}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Users className="w-7 h-7 text-gray-400" />}
              title="チャット履歴はまだありません"
              description="保護者からメッセージが届くとここに表示されます"
            />
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conv) => (
              <button
                key={conv.clientUserId}
                onClick={() => {
                  setSelectedClientUserId(conv.clientUserId);
                  setSelectedClientName(conv.clientName);
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {conv.clientName || '保護者'}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function formatRelativeTime(dateStr: string): string {
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

export default BusinessChatView;
