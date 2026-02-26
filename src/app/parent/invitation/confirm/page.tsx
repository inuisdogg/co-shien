/**
 * 既存アカウント用の招待確認ページ
 * ログイン済みユーザーが招待を承認するためのページ
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
  child_id?: string;
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

function ConfirmInvitationContent() {
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
          router.push(`/login?redirect=/parent/invitation/confirm&token=${token}`);
          return;
        }

        // ユーザー情報を取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (userError || !userData) {
          router.push(`/login?redirect=/parent/invitation/confirm&token=${token}`);
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

    // 既存児童を選択しているか、施設が紐付けた児童を使用
    let childIdToLink = selectedChildId || invitation.child_id;

    if (!childIdToLink && children.length > 0) {
      // 児童を選択していない場合はエラー
      alert('紐付けるお子様を選択してください');
      return;
    }

    // 児童がいない場合は新規登録ページにリダイレクト
    if (!childIdToLink && children.length === 0) {
      router.push(`/parent/invitation/accept?token=${token}`);
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

      // 児童のfacility_idを更新
      if (childIdToLink) {
        await supabase
          .from('children')
          .update({ facility_id: invitation.facility_id })
          .eq('id', childIdToLink);
      }

      // 成功画面を表示
      router.push('/parent?invitation=accepted');
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      alert('招待の承認に失敗しました: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="space-y-3">
              <div className="h-16 bg-gray-100 rounded-lg" />
              <div className="h-16 bg-gray-100 rounded-lg" />
            </div>
            <div className="flex gap-3">
              <div className="h-12 bg-gray-200 rounded-lg flex-1" />
              <div className="h-12 bg-gray-200 rounded-lg flex-1" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">お知らせ</h1>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/parent')}
            className="bg-[#ED8936] hover:bg-[#D97706] text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md"
          >
            ダッシュボードへ
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen bg-[#FFF8F0] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-[#F6AD55] p-6 text-white">
            <p className="text-white/80 text-sm mb-2">保護者の方へ</p>
            <h1 className="text-2xl font-bold mb-1">お子様の通所施設からの招待です</h1>
            <p className="text-white/90">
              {invitation.facility?.name || '施設'}からお子様の利用に関する招待が届いています
            </p>
          </div>

          <div className="p-6">
            {/* ログイン中ユーザー */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <div>
                  <p className="text-sm font-bold text-green-800">
                    {currentUser?.name || currentUser?.email} としてログイン中
                  </p>
                  <p className="text-xs text-green-600">
                    このアカウントで招待を承認します
                  </p>
                </div>
              </div>
            </div>

            {/* 招待内容 */}
            <div className="bg-[#FEF3E2] border border-[#F6AD55]/30 rounded-lg p-4 mb-6">
              <h2 className="font-bold text-[#D97706] mb-2">招待内容</h2>
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
            {children.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3">
                  紐付けるお子様を選択してください
                </h3>
                <div className="space-y-2">
                  {children.map((child) => {
                    const ageInfo = child.birth_date ? calculateAgeWithMonths(child.birth_date) : null;
                    return (
                      <button
                        key={child.id}
                        onClick={() => setSelectedChildId(child.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                          selectedChildId === child.id
                            ? 'border-[#ED8936] bg-[#FEF3E2]'
                            : 'border-gray-200 hover:border-[#F6AD55]/50 hover:bg-[#FEF3E2]'
                        }`}
                      >
                        <div className="w-12 h-12 bg-[#FDEBD0] rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-[#F6AD55]" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">{child.name}</div>
                          {ageInfo && (
                            <div className="text-sm text-gray-500">{ageInfo.display}</div>
                          )}
                        </div>
                        {selectedChildId === child.id && (
                          <CheckCircle className="w-6 h-6 text-[#F6AD55]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 児童がいない場合のメッセージ */}
            {children.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-yellow-800">
                      お子様の情報が登録されていません
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      「承認する」をクリックすると、お子様の情報を新規登録できます。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/parent')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAcceptInvitation}
                disabled={processing || (children.length > 0 && !selectedChildId)}
                className="flex-1 py-3 bg-[#ED8936] hover:bg-[#D97706] text-white font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

export default function ConfirmInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#F6AD55]" />
        </div>
      }
    >
      <ConfirmInvitationContent />
    </Suspense>
  );
}
