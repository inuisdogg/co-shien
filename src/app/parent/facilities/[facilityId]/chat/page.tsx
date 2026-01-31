/**
 * 保護者側チャットページ
 * 施設とのリアルタイムチャット
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ChatView from '@/components/chat/ChatView';

export const dynamic = 'force-dynamic';

export default function ClientChatPage() {
  const router = useRouter();
  const params = useParams();
  const facilityId = params.facilityId as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [hasContract, setHasContract] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ユーザー認証チェック
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

        // 施設情報を取得
        const { data: facilityData, error: facilityError } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single();

        if (facilityError || !facilityData) {
          setError('施設情報が見つかりません');
          setLoading(false);
          return;
        }

        setFacility(facilityData);

        // 施設との関連確認（子供がこの施設に登録されているか、または契約があるか）
        const { data: childrenData } = await supabase
          .from('children')
          .select('id, facility_id')
          .eq('owner_profile_id', user.id);

        if (childrenData && childrenData.length > 0) {
          // 方法1: 子供のfacility_idで確認
          const hasRelatedChild = childrenData.some((c: any) => c.facility_id === facilityId);

          if (hasRelatedChild) {
            setHasContract(true);
          } else {
            // 方法2: contractsテーブルで確認（RLSがあるため結果が空でもエラーにしない）
            const childIds = childrenData.map((c: any) => c.id);
            const { data: contractsData } = await supabase
              .from('contracts')
              .select('id')
              .in('child_id', childIds)
              .eq('facility_id', facilityId)
              .eq('status', 'active')
              .limit(1);

            if (contractsData && contractsData.length > 0) {
              setHasContract(true);
            }
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
  }, [facilityId, router]);

  const handleBack = () => {
    router.push('/parent');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F6AD55] mx-auto mb-4"></div>
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
            onClick={() => router.push('/parent')}
            className="px-4 py-2 bg-[#F6AD55] text-white rounded-lg hover:bg-[#ED8936]"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  if (!hasContract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-gray-600 mb-4">この施設との契約がありません</p>
          <button
            onClick={() => router.push('/parent')}
            className="px-4 py-2 bg-[#F6AD55] text-white rounded-lg hover:bg-[#ED8936]"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <ChatView
        facilityId={facilityId}
        facilityName={facility?.name || '施設'}
        clientUserId={currentUser.id}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        currentUserType="client"
        onBack={handleBack}
        showQuickActions={true}
      />
    </div>
  );
}
