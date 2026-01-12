/**
 * 招待承認ページ
 * 施設からの招待を承認し、児童情報を紐付ける
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';
import {
  Building2,
  User,
  CheckCircle,
  AlertCircle,
  Plus,
  ChevronRight,
  Loader2,
} from 'lucide-react';

type Invitation = {
  id: string;
  facility_id: string;
  temp_child_name: string;
  temp_child_name_kana?: string;
  email: string;
  status: string;
  expires_at: string;
  child_id?: string; // 施設が既存児童を選択した場合
  facility?: {
    id: string;
    name: string;
    address?: string;
  };
};

type Child = {
  id: string;
  name: string;
  name_kana?: string;
  birth_date?: string;
  owner_profile_id?: string;
};

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showNewChildForm, setShowNewChildForm] = useState(false);
  const [newChildData, setNewChildData] = useState({
    name: '',
    nameKana: '',
    birthDate: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setError('招待トークンが見つかりません');
        setLoading(false);
        return;
      }

      try {
        // ログイン状態を確認
        const userId = localStorage.getItem('userId');
        if (!userId) {
          // ログインページにリダイレクト（招待トークンを保持）
          router.push(`/client/login?redirect=/client/invitation/accept?token=${token}`);
          return;
        }

        // ユーザー情報を取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (userError || !userData) {
          router.push(`/client/login?redirect=/client/invitation/accept?token=${token}`);
          return;
        }

        setCurrentUser(userData);

        // 招待情報を取得
        const { data: invitationData, error: invitationError } = await supabase
          .from('contract_invitations')
          .select(`
            *,
            facility:facilities(id, name, address)
          `)
          .eq('invitation_token', token)
          .single();

        if (invitationError || !invitationData) {
          setError('招待が見つかりません。リンクが無効か、すでに使用されている可能性があります。');
          setLoading(false);
          return;
        }

        // 招待の有効期限を確認
        if (new Date(invitationData.expires_at) < new Date()) {
          setError('この招待は期限切れです。施設に再度招待を依頼してください。');
          setLoading(false);
          return;
        }

        // 既に承認済みの場合
        if (invitationData.status === 'accepted') {
          setError('この招待は既に承認されています。');
          setLoading(false);
          return;
        }

        setInvitation(invitationData);

        // ユーザーの児童一覧を取得
        const { data: childrenData } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', userId);

        setChildren(childrenData || []);

        // 仮の児童名をフォームにセット
        if (invitationData.temp_child_name) {
          setNewChildData({
            name: invitationData.temp_child_name,
            nameKana: invitationData.temp_child_name_kana || '',
            birthDate: '',
          });
        }
      } catch (err: any) {
        console.error('Error fetching invitation:', err);
        setError('招待情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, router]);

  // 招待を承認する
  const handleAcceptInvitation = async () => {
    if (!invitation || !currentUser) return;

    let childIdToLink = selectedChildId;
    let facilityChildData: any = null;

    // 施設が既存児童を選択していた場合、その児童データを取得して保存準備
    if (invitation.child_id) {
      const { data: facilityChild } = await supabase
        .from('children')
        .select('*')
        .eq('id', invitation.child_id)
        .single();

      if (facilityChild) {
        // 施設が入力した情報を保存用に整形
        facilityChildData = {
          name: facilityChild.name,
          nameKana: facilityChild.name_kana,
          birthDate: facilityChild.birth_date,
          guardianName: facilityChild.guardian_name,
          guardianNameKana: facilityChild.guardian_name_kana,
          guardianRelationship: facilityChild.guardian_relationship,
          beneficiaryNumber: facilityChild.beneficiary_number,
          grantDays: facilityChild.grant_days,
          contractDays: facilityChild.contract_days,
          address: facilityChild.address,
          phone: facilityChild.phone,
          email: facilityChild.email,
          doctorName: facilityChild.doctor_name,
          doctorClinic: facilityChild.doctor_clinic,
          schoolName: facilityChild.school_name,
          pattern: facilityChild.pattern,
          patternDays: facilityChild.pattern_days,
          needsPickup: facilityChild.needs_pickup,
          needsDropoff: facilityChild.needs_dropoff,
          pickupLocation: facilityChild.pickup_location,
          dropoffLocation: facilityChild.dropoff_location,
          characteristics: facilityChild.characteristics,
        };
      }
    }

    // 新規児童を作成する場合
    if (showNewChildForm && !selectedChildId) {
      if (!newChildData.name.trim()) {
        alert('児童名を入力してください');
        return;
      }

      setProcessing(true);
      try {
        // 新規児童を作成（施設の既存児童がある場合はそれを更新）
        if (invitation.child_id && facilityChildData) {
          // 施設の既存児童を利用者アカウントにリンク
          const { error: updateError } = await supabase
            .from('children')
            .update({
              name: newChildData.name,
              name_kana: newChildData.nameKana || null,
              birth_date: newChildData.birthDate || null,
              owner_profile_id: currentUser.id,
              facility_intake_data: facilityChildData,
              facility_intake_recorded_at: new Date().toISOString(),
              contract_status: 'active',
            })
            .eq('id', invitation.child_id);

          if (updateError) throw updateError;
          childIdToLink = invitation.child_id;
        } else {
          // 完全に新規の児童を作成
          const { data: newChild, error: childError } = await supabase
            .from('children')
            .insert({
              name: newChildData.name,
              name_kana: newChildData.nameKana || null,
              birth_date: newChildData.birthDate || null,
              owner_profile_id: currentUser.id,
              facility_id: invitation.facility_id,
              contract_status: 'active',
              contract_start_date: new Date().toISOString().split('T')[0],
            })
            .select()
            .single();

          if (childError) throw childError;
          childIdToLink = newChild.id;
        }
      } catch (err: any) {
        console.error('Error creating/updating child:', err);
        alert('児童の作成に失敗しました: ' + err.message);
        setProcessing(false);
        return;
      }
    }

    // 既存の自分の児童を選択した場合
    if (selectedChildId && !showNewChildForm) {
      // 施設の既存児童データがある場合は、選択した児童に施設記録を保存
      if (facilityChildData) {
        try {
          await supabase
            .from('children')
            .update({
              facility_intake_data: facilityChildData,
              facility_intake_recorded_at: new Date().toISOString(),
            })
            .eq('id', selectedChildId);
        } catch (err) {
          console.error('Error saving facility intake data:', err);
        }
      }
    }

    if (!childIdToLink) {
      alert('紐付ける児童を選択してください');
      return;
    }

    setProcessing(true);
    try {
      // 契約を作成
      const { error: contractError } = await supabase.from('contracts').insert({
        child_id: childIdToLink,
        facility_id: invitation.facility_id,
        status: 'active',
        contract_start_date: new Date().toISOString().split('T')[0],
        approved_at: new Date().toISOString(),
      });

      if (contractError) {
        // 既に契約が存在する場合はスキップ
        if (!contractError.message.includes('duplicate')) {
          throw contractError;
        }
      }

      // 招待を承認済みに更新
      const { error: updateError } = await supabase
        .from('contract_invitations')
        .update({
          status: 'accepted',
          child_id: childIdToLink,
          accepted_at: new Date().toISOString(),
          accepted_by: currentUser.id,
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      // 児童のfacility_idを更新（既存児童の場合）
      if (selectedChildId) {
        await supabase
          .from('children')
          .update({ facility_id: invitation.facility_id })
          .eq('id', selectedChildId);
      }

      // 成功画面を表示
      router.push('/client/dashboard?invitation=accepted');
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      alert('招待の承認に失敗しました: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">エラー</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/client/dashboard')}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-md transition-colors"
          >
            ダッシュボードへ
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
            <Building2 className="w-12 h-12 mb-3" />
            <h1 className="text-2xl font-bold mb-1">施設からの招待</h1>
            <p className="text-orange-100">
              {invitation.facility?.name || '施設'}から招待が届いています
            </p>
          </div>

          <div className="p-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h2 className="font-bold text-orange-800 mb-2">招待内容</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">施設名:</span>
                  <span className="font-bold text-gray-800">
                    {invitation.facility?.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">児童名（仮）:</span>
                  <span className="font-bold text-gray-800">
                    {invitation.temp_child_name}
                  </span>
                </div>
              </div>
            </div>

            {/* 児童選択セクション */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3">
                紐付けるお子様を選択してください
              </h3>

              {/* 既存の児童一覧 */}
              {children.length > 0 && (
                <div className="space-y-2 mb-4">
                  {children.map((child) => {
                    const ageInfo = child.birth_date ? calculateAgeWithMonths(child.birth_date) : null;
                    return (
                      <button
                        key={child.id}
                        onClick={() => {
                          setSelectedChildId(child.id);
                          setShowNewChildForm(false);
                        }}
                        className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                          selectedChildId === child.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">{child.name}</div>
                          {ageInfo && (
                            <div className="text-sm text-gray-500">{ageInfo.display}</div>
                          )}
                        </div>
                        {selectedChildId === child.id && (
                          <CheckCircle className="w-6 h-6 text-orange-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 新規児童作成 */}
              <button
                onClick={() => {
                  setShowNewChildForm(true);
                  setSelectedChildId(null);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                  showNewChildForm && !selectedChildId
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-dashed border-gray-300 hover:border-orange-300 hover:bg-orange-50'
                }`}
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Plus className="w-6 h-6 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800">新しいお子様を登録</div>
                  <div className="text-sm text-gray-500">
                    まだ登録していないお子様を追加します
                  </div>
                </div>
                {showNewChildForm && !selectedChildId && (
                  <CheckCircle className="w-6 h-6 text-orange-500" />
                )}
              </button>

              {/* 新規児童フォーム */}
              {showNewChildForm && !selectedChildId && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-sm text-gray-700 mb-3">
                    新しいお子様の情報
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        お名前 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-orange-500"
                        placeholder="例: 山田 太郎"
                        value={newChildData.name}
                        onChange={(e) =>
                          setNewChildData({ ...newChildData, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        フリガナ
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-orange-500"
                        placeholder="例: ヤマダ タロウ"
                        value={newChildData.nameKana}
                        onChange={(e) =>
                          setNewChildData({ ...newChildData, nameKana: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        生年月日
                      </label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-orange-500"
                        value={newChildData.birthDate}
                        onChange={(e) =>
                          setNewChildData({ ...newChildData, birthDate: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/client/dashboard')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAcceptInvitation}
                disabled={processing || (!selectedChildId && !showNewChildForm)}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    招待を承認
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-800 text-sm mb-2">ご注意</h3>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li>招待を承認すると、施設との契約が成立します</li>
            <li>お子様の情報は施設と共有されます</li>
            <li>契約後も児童情報の管理権限はあなたにあります</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
