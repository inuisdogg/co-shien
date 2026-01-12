/**
 * 施設側チャット管理コンポーネント
 * 保護者との会話一覧を表示し、選択したらチャット画面を開く
 */

'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Search, Bell, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ChatView from './ChatView';

type ChatThread = {
  clientUserId: string;
  clientName: string;
  childrenNames: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export default function ChatManagementView() {
  const { user, facility } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);

  // チャット一覧を取得
  const fetchChatThreads = async () => {
    if (!facility?.id) return;

    try {
      // 保護者ごとにグループ化
      const clientMap = new Map<string, { clientId: string; childrenNames: string[] }>();

      // 方法1: 子供のfacility_idから取得
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name, owner_profile_id')
        .eq('facility_id', facility.id);

      if (childrenData) {
        for (const child of childrenData) {
          if (child.owner_profile_id) {
            const existing = clientMap.get(child.owner_profile_id);
            if (existing) {
              if (!existing.childrenNames.includes(child.name)) {
                existing.childrenNames.push(child.name);
              }
            } else {
              clientMap.set(child.owner_profile_id, {
                clientId: child.owner_profile_id,
                childrenNames: [child.name],
              });
            }
          }
        }
      }

      // 方法2: contractsからも取得（RLSが許可する場合）
      const { data: contracts } = await supabase
        .from('contracts')
        .select(`
          child_id,
          children:child_id (
            id,
            name,
            owner_profile_id
          )
        `)
        .eq('facility_id', facility.id);

      if (contracts) {
        for (const contract of contracts) {
          const child = contract.children as any;
          if (child && child.owner_profile_id) {
            const existing = clientMap.get(child.owner_profile_id);
            if (existing) {
              if (!existing.childrenNames.includes(child.name)) {
                existing.childrenNames.push(child.name);
              }
            } else {
              clientMap.set(child.owner_profile_id, {
                clientId: child.owner_profile_id,
                childrenNames: [child.name],
              });
            }
          }
        }
      }

      // 各保護者のユーザー情報とチャット情報を取得
      const threadList: ChatThread[] = [];

      for (const [clientId, data] of clientMap) {
        // 保護者のユーザー情報を取得
        const { data: userData } = await supabase
          .from('users')
          .select('id, name')
          .eq('id', clientId)
          .single();

        // 最新のメッセージを取得
        const { data: lastMsgData } = await supabase
          .from('chat_messages')
          .select('message, created_at, sender_type')
          .eq('facility_id', facility.id)
          .eq('client_user_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // 未読メッセージ数を取得（保護者からのメッセージで未読のもの）
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('facility_id', facility.id)
          .eq('client_user_id', clientId)
          .eq('sender_type', 'client')
          .eq('is_read', false);

        threadList.push({
          clientUserId: clientId,
          clientName: userData?.name || '保護者',
          childrenNames: data.childrenNames,
          lastMessage: lastMsgData?.message || '',
          lastMessageAt: lastMsgData?.created_at || '',
          unreadCount: unreadCount || 0,
        });
      }

      // ソート: 未読があるものを上に、次に最新メッセージ順、最後にメッセージなし（名前順）
      threadList.sort((a, b) => {
        // まず未読があるものを上に
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;

        // 次にメッセージがあるものを上に
        if (a.lastMessageAt && !b.lastMessageAt) return -1;
        if (!a.lastMessageAt && b.lastMessageAt) return 1;

        // 両方メッセージがある場合は最新順
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        }

        // 両方メッセージがない場合は名前順
        return a.clientName.localeCompare(b.clientName, 'ja');
      });

      setThreads(threadList);
    } catch (err) {
      console.error('チャット一覧取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatThreads();

    // Realtimeで新規メッセージを監視
    if (facility?.id) {
      const channel = supabase
        .channel(`facility-chat:${facility.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `facility_id=eq.${facility.id}`,
          },
          () => {
            // 新規メッセージが来たら一覧を更新
            fetchChatThreads();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [facility?.id]);

  // 検索フィルタ
  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.clientName.toLowerCase().includes(query) ||
      thread.childrenNames.some((name) => name.toLowerCase().includes(query))
    );
  });

  // 未読の合計
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  // 時刻フォーマット
  const formatTime = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      return '昨日';
    } else if (diffDays < 7) {
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      return days[date.getDay()];
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  // チャット画面から戻る
  const handleBackFromChat = () => {
    setSelectedThread(null);
    fetchChatThreads(); // 一覧を更新
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  // チャット画面を表示
  if (selectedThread && facility && user) {
    return (
      <div className="h-[calc(100vh-180px)] bg-white rounded-lg shadow-sm overflow-hidden">
        <ChatView
          facilityId={facility.id}
          facilityName={facility.name || '施設'}
          clientUserId={selectedThread.clientUserId}
          clientName={selectedThread.clientName}
          currentUserId={user.id}
          currentUserName={user.name || 'スタッフ'}
          currentUserType="staff"
          onBack={handleBackFromChat}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">チャット</h1>
          <p className="text-gray-500 text-sm mt-1">保護者とのメッセージをやりとりします</p>
        </div>
        {totalUnread > 0 && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-full">
            <Bell className="w-4 h-4" />
            <span className="font-bold">{totalUnread}件の未読</span>
          </div>
        )}
      </div>

      {/* 検索バー */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="保護者名・お子様名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
        />
      </div>

      {/* 利用者一覧 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* 利用者数ヘッダー */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            登録保護者: <span className="font-bold text-gray-800">{threads.length}名</span>
          </p>
        </div>

        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            {threads.length === 0 ? (
              <>
                <p>登録されている保護者がいません</p>
                <p className="text-sm mt-1">お子様が登録されると保護者が表示されます</p>
              </>
            ) : (
              <>
                <p>検索結果がありません</p>
                <p className="text-sm mt-1">別のキーワードで検索してください</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredThreads.map((thread) => (
              <button
                key={thread.clientUserId}
                onClick={() => setSelectedThread(thread)}
                className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left ${
                  thread.unreadCount > 0 ? 'bg-orange-50 hover:bg-orange-100' : ''
                }`}
              >
                {/* アバター */}
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    thread.unreadCount > 0
                      ? 'bg-gradient-to-br from-orange-400 to-orange-500'
                      : 'bg-gradient-to-br from-[#00c4cc] to-[#00a8b0]'
                  }`}>
                    <User className="w-6 h-6 text-white" />
                  </div>
                  {/* 未読バッジ */}
                  {thread.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
                      <span className="text-white text-xs font-bold">
                        {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* コンテンツ */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-bold truncate ${
                      thread.unreadCount > 0 ? 'text-orange-800' : 'text-gray-800'
                    }`}>
                      {thread.clientName}
                    </h3>
                    {thread.lastMessageAt ? (
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(thread.lastMessageAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 flex-shrink-0 ml-2">
                        新規
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    お子様: {thread.childrenNames.join('・')}
                  </p>
                  {thread.lastMessage ? (
                    <p className={`text-sm mt-1 truncate ${
                      thread.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'
                    }`}>
                      {thread.lastMessage.substring(0, 50)}
                      {thread.lastMessage.length > 50 ? '...' : ''}
                    </p>
                  ) : (
                    <p className="text-sm mt-1 text-gray-400 italic">
                      まだメッセージがありません
                    </p>
                  )}
                </div>

                {/* 矢印 */}
                <div className="flex-shrink-0 text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
