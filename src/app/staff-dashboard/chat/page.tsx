/**
 * スタッフ側チャットページ
 * 保護者一覧からチャットを選択、リアルタイムチャット
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, User, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ChatView from '@/components/chat/ChatView';

export const dynamic = 'force-dynamic';

type ClientChatInfo = {
  clientUserId: string;
  clientName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

export default function StaffChatPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [clientChats, setClientChats] = useState<ClientChatInfo[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientChatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 保護者チャット一覧を取得
  const fetchClientChats = async (facilityId: string) => {
    try {
      // この施設に登録されている児童の保護者を取得
      // 方法1: childrenテーブルのfacility_idで取得
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, owner_profile_id, guardian_name')
        .eq('facility_id', facilityId);

      // 方法2: contractsテーブルで確認（RLSがあるため結果が空でもエラーにしない）
      let contractsChildren: any[] = [];
      const { data: contractsData } = await supabase
        .from('contracts')
        .select(`
          child_id,
          children:child_id (
            owner_profile_id,
            guardian_name
          )
        `)
        .eq('facility_id', facilityId)
        .eq('status', 'active');

      if (contractsData) {
        contractsChildren = contractsData;
      }

      // 両方のデータソースからユニークな保護者IDを取得
      const clientMap = new Map<string, string>();

      // childrenテーブルから
      if (childrenData) {
        for (const child of childrenData) {
          if (child.owner_profile_id) {
            clientMap.set(child.owner_profile_id, child.guardian_name || '保護者');
          }
        }
      }

      // contractsテーブルから
      for (const contract of contractsChildren) {
        const child = contract.children as any;
        if (child?.owner_profile_id) {
          clientMap.set(child.owner_profile_id, child.guardian_name || '保護者');
        }
      }

      if (clientMap.size === 0) {
        setClientChats([]);
        return;
      }

      // 各保護者のチャット情報を取得
      const chatInfos: ClientChatInfo[] = [];

      for (const [clientUserId, guardianName] of clientMap) {
        // ユーザー情報を取得
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', clientUserId)
          .single();

        const clientName = userData?.name || guardianName;

        // 最新メッセージを取得
        const { data: lastMsgData } = await supabase
          .from('chat_messages')
          .select('message, created_at')
          .eq('facility_id', facilityId)
          .eq('client_user_id', clientUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // 未読数を取得（スタッフから見て、保護者が送信した未読メッセージ）
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .eq('client_user_id', clientUserId)
          .eq('sender_type', 'client')
          .eq('is_read', false);

        chatInfos.push({
          clientUserId,
          clientName,
          lastMessage: lastMsgData?.message,
          lastMessageAt: lastMsgData?.created_at,
          unreadCount: unreadCount || 0,
        });
      }

      // 最新メッセージ順にソート
      chatInfos.sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      setClientChats(chatInfos);
    } catch (err) {
      console.error('チャット一覧取得エラー:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ユーザー認証チェック
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (user.userType === 'client') {
          router.push('/client/dashboard');
          return;
        }

        setCurrentUser(user);

        // 施設情報を取得
        const facilityStr = localStorage.getItem('facility');
        if (facilityStr) {
          const facilityData = JSON.parse(facilityStr);
          setFacility(facilityData);
          await fetchClientChats(facilityData.id);
        } else if (user.facilityId) {
          const { data: facilityData } = await supabase
            .from('facilities')
            .select('*')
            .eq('id', user.facilityId)
            .single();

          if (facilityData) {
            setFacility(facilityData);
            await fetchClientChats(facilityData.id);
          }
        }
      } catch (err: any) {
        console.error('データ取得エラー:', err);
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // チャット選択時
  const handleSelectClient = (client: ClientChatInfo) => {
    setSelectedClient(client);
  };

  // チャットから戻る
  const handleBackFromChat = () => {
    setSelectedClient(null);
    // 一覧を更新
    if (facility?.id) {
      fetchClientChats(facility.id);
    }
  };

  // 時刻フォーマット
  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diff < oneDay * 2) {
      return '昨日';
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/staff-dashboard')}
            className="px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8]"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  // チャット画面表示
  if (selectedClient && facility && currentUser) {
    return (
      <div className="h-screen flex flex-col">
        <ChatView
          facilityId={facility.id}
          facilityName={facility.name}
          clientUserId={selectedClient.clientUserId}
          clientName={selectedClient.clientName}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserType="staff"
          onBack={handleBackFromChat}
        />
      </div>
    );
  }

  // 保護者一覧表示
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/staff-dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ダッシュボードに戻る</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00c4cc] rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">チャット</h1>
              <p className="text-sm text-gray-500">{facility?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {clientChats.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">チャット可能な保護者がいません</p>
            <p className="text-sm text-gray-400 mt-1">契約中の保護者が表示されます</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
            {clientChats.map((client) => (
              <button
                key={client.clientUserId}
                onClick={() => handleSelectClient(client)}
                className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                {/* アバター */}
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-gray-500" />
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-800 truncate">{client.clientName}</h3>
                    {client.lastMessageAt && (
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(client.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {client.lastMessage || 'メッセージはありません'}
                  </p>
                </div>

                {/* 未読バッジ */}
                {client.unreadCount > 0 && (
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-white font-bold">
                      {client.unreadCount > 9 ? '9+' : client.unreadCount}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
