/**
 * 利用者ダッシュボード
 * 登録済みの児童一覧、契約施設一覧、実績記録、連絡機能を提供
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Plus, User, Calendar, LogOut, ChevronRight, AlertCircle, Building2,
  FileText, Clock, CheckCircle, XCircle, MessageSquare, Bell,
  CalendarDays, ClipboardList, Send, Settings
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Child } from '@/types';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

// 契約情報の型定義
type Contract = {
  id: string;
  child_id: string;
  facility_id: string;
  status: 'pending' | 'active' | 'terminated' | 'rejected';
  contract_start_date?: string;
  contract_end_date?: string;
  approved_at?: string;
  facilities?: {
    id: string;
    name: string;
    code?: string;
  };
};

// 施設情報の型定義
type Facility = {
  id: string;
  name: string;
  code?: string;
};

// 最近の利用実績
type UsageRecord = {
  id: string;
  child_id: string;
  facility_id: string;
  date: string;
  service_status: string;
  calculated_time?: number;
  slot?: string;
};

// お知らせの型
type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  created_at: string;
  is_read: boolean;
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'facilities' | 'records' | 'messages'>('overview');

  // 児童選択モーダル用の状態
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'facilities' | 'calendar' | 'message'; } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // localStorageからユーザー情報を取得
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/client/login');
          return;
        }

        let userId: string | null = null;
        let userData: any = null;

        try {
          const user = JSON.parse(userStr);
          if (!user?.id) {
            router.push('/client/login');
            return;
          }

          if (user.userType !== 'client') {
            router.push('/staff-dashboard');
            return;
          }

          userId = user.id;

          // usersテーブルからユーザー情報を確認
          const { data: dbUserData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (userError || !dbUserData) {
            router.push('/client/login');
            return;
          }

          if (dbUserData.user_type !== 'client') {
            router.push('/staff-dashboard');
            return;
          }

          userData = dbUserData;
          setCurrentUser(userData);

          // localStorageのuserデータを更新
          const updatedUser = {
            id: userData.id,
            name: userData.name || (userData.last_name && userData.first_name ? `${userData.last_name} ${userData.first_name}` : ''),
            lastName: userData.last_name,
            firstName: userData.first_name,
            email: userData.email,
            role: userData.role,
            userType: 'client',
            account_status: userData.account_status,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));

        } catch (e) {
          console.error('User data error:', e);
          router.push('/client/login');
          return;
        }

        // 正しいuserIdでchildrenを検索
        let searchUserId = userId;
        const { data: userCheckData } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();

        if (!userCheckData && userData?.email) {
          const { data: userByEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', userData.email)
            .single();

          if (userByEmail) {
            searchUserId = userByEmail.id;
          }
        }

        // 登録済みの児童を取得
        const { data: childrenData, error: childrenError } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', searchUserId)
          .order('created_at', { ascending: false });

        if (childrenError) {
          console.error('Children fetch error:', childrenError);
          setChildren([]);
        } else if (childrenData && childrenData.length > 0) {
          const formattedChildren: Child[] = childrenData.map((c: any) => ({
            id: c.id,
            facilityId: c.facility_id,
            ownerProfileId: c.owner_profile_id,
            name: c.name,
            nameKana: c.name_kana,
            age: c.age,
            birthDate: c.birth_date,
            guardianName: c.guardian_name,
            guardianNameKana: c.guardian_name_kana,
            guardianRelationship: c.guardian_relationship,
            beneficiaryNumber: c.beneficiary_number,
            beneficiaryCertificateImageUrl: c.beneficiary_certificate_image_url,
            grantDays: c.grant_days,
            contractDays: c.contract_days,
            address: c.address,
            phone: c.phone,
            email: c.email,
            doctorName: c.doctor_name,
            doctorClinic: c.doctor_clinic,
            schoolName: c.school_name,
            pattern: c.pattern,
            patternDays: c.pattern_days,
            patternTimeSlots: c.pattern_time_slots,
            needsPickup: c.needs_pickup || false,
            needsDropoff: c.needs_dropoff || false,
            pickupLocation: c.pickup_location,
            pickupLocationCustom: c.pickup_location_custom,
            dropoffLocation: c.dropoff_location,
            dropoffLocationCustom: c.dropoff_location_custom,
            characteristics: c.characteristics,
            contractStatus: c.contract_status || 'pre-contract',
            contractStartDate: c.contract_start_date,
            contractEndDate: c.contract_end_date,
            registrationType: c.registration_type,
            plannedContractDays: c.planned_contract_days,
            plannedUsageStartDate: c.planned_usage_start_date,
            plannedUsageDays: c.planned_usage_days,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }));
          setChildren(formattedChildren);

          // 児童IDのリストを取得
          const childIds = formattedChildren.map(c => c.id);

          if (childIds.length > 0) {
            // 契約情報を取得
            const { data: contractsData, error: contractsError } = await supabase
              .from('contracts')
              .select(`
                *,
                facilities:facility_id (
                  id,
                  name,
                  code
                )
              `)
              .in('child_id', childIds)
              .order('created_at', { ascending: false });

            if (!contractsError && contractsData) {
              setContracts(contractsData);

              // 施設情報を抽出
              const uniqueFacilities = new Map<string, Facility>();
              contractsData.forEach((c: any) => {
                if (c.facilities && !uniqueFacilities.has(c.facility_id)) {
                  uniqueFacilities.set(c.facility_id, c.facilities);
                }
              });
              setFacilities(Array.from(uniqueFacilities.values()));

              // アクティブな契約の施設IDを取得
              const activeFacilityIds = contractsData
                .filter((c: any) => c.status === 'active')
                .map((c: any) => c.facility_id);

              if (activeFacilityIds.length > 0) {
                // 実績記録を取得（schedulesテーブルから）
                const { data: schedulesData, error: schedulesError } = await supabase
                  .from('schedules')
                  .select('*')
                  .in('child_id', childIds)
                  .in('facility_id', activeFacilityIds)
                  .gte('date', new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().split('T')[0])
                  .order('date', { ascending: false })
                  .limit(50);

                if (!schedulesError && schedulesData) {
                  setUsageRecords(schedulesData);
                }
              }
            }
          }
        }

        // 未承認の招待を取得
        if (userData?.email) {
          const { data: invitationsData } = await supabase
            .from('contract_invitations')
            .select(`
              *,
              facilities:facility_id (
                id,
                name,
                code
              )
            `)
            .eq('email', userData.email)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());

          if (invitationsData) {
            setPendingInvitations(invitationsData);
          }
        }

      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    localStorage.removeItem('selectedFacility');
    router.push('/client/login');
  };

  // 年齢を計算
  const calculateAge = (birthDate?: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 契約ステータスのラベルを取得
  const getContractStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '承認待ち', color: 'bg-yellow-100 text-yellow-800' };
      case 'active':
        return { label: '契約中', color: 'bg-green-100 text-green-800' };
      case 'terminated':
        return { label: '解約', color: 'bg-gray-100 text-gray-800' };
      case 'rejected':
        return { label: '却下', color: 'bg-red-100 text-red-800' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  // アクティブな契約数を取得
  const activeContractsCount = contracts.filter(c => c.status === 'active').length;

  // クイックアクションの処理
  const handleQuickAction = (actionType: 'facilities' | 'calendar' | 'message') => {
    if (children.length === 0) return;

    if (children.length === 1) {
      // 1人の場合は直接遷移
      executeAction(children[0].id, actionType);
    } else {
      // 複数の場合はモーダルを表示
      setPendingAction({ type: actionType });
      setShowChildSelector(true);
    }
  };

  // アクション実行
  const executeAction = (childId: string, actionType: 'facilities' | 'calendar' | 'message') => {
    switch (actionType) {
      case 'facilities':
        router.push(`/client/children/${childId}?tab=facilities`);
        break;
      case 'calendar':
        router.push(`/client/children/${childId}?tab=calendar`);
        break;
      case 'message':
        // 契約中の施設があればそこへ、なければメッセージタブへ
        const childContracts = contracts.filter(c => c.child_id === childId && c.status === 'active');
        if (childContracts.length > 0) {
          router.push(`/client/facilities/${childContracts[0].facility_id}/contact?child=${childId}`);
        } else {
          setActiveTab('messages');
        }
        break;
    }
    setShowChildSelector(false);
    setPendingAction(null);
  };

  // 児童選択時の処理
  const handleChildSelect = (childId: string) => {
    if (pendingAction) {
      executeAction(childId, pendingAction.type);
    }
  };

  // 今月の利用回数
  const currentMonthUsage = usageRecords.filter(r => {
    const recordDate = new Date(r.date);
    const now = new Date();
    return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-cropped-center.png"
              alt="co-shien"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
            <span className="inline-block bg-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              利用者
            </span>
          </div>
          <div className="flex items-center gap-4">
            {pendingInvitations.length > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {pendingInvitations.length}
                </span>
              </div>
            )}
            <span className="text-sm text-gray-600 hidden sm:block">
              {currentUser?.name || `${currentUser?.last_name} ${currentUser?.first_name}`}さん
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* 招待通知 */}
        {pendingInvitations.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              施設からの招待があります
            </h3>
            <div className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-800">{inv.facilities?.name}</p>
                    <p className="text-sm text-gray-500">
                      有効期限: {new Date(inv.expires_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/client/invitations/${inv.invitation_token}`)}
                    className="bg-orange-400 hover:bg-orange-500 text-white text-sm font-bold py-2 px-4 rounded-md"
                  >
                    確認する
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ウェルカムメッセージ */}
        <div className="bg-gradient-to-r from-orange-300 to-orange-400 rounded-lg p-6 text-gray-800 mb-6">
          <h1 className="text-2xl font-bold">
            ようこそ、{currentUser?.last_name || currentUser?.name?.split(' ')[0]}さん
          </h1>
        </div>

        {/* タブナビゲーション */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {[
              { id: 'overview', label: '概要', icon: ClipboardList },
              { id: 'facilities', label: '利用施設', icon: Building2 },
              { id: 'records', label: '利用実績', icon: Calendar },
              { id: 'messages', label: '連絡', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-orange-400 text-orange-600 bg-orange-50'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {/* 概要タブ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 児童一覧 */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800">お子様一覧</h2>
                    <button
                      onClick={() => router.push('/client/children/register')}
                      className="flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-white text-sm font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>

                  {children.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-orange-500" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">お子様が登録されていません</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        「追加」ボタンからお子様の情報を登録してください。
                      </p>
                      <button
                        onClick={() => router.push('/client/children/register')}
                        className="inline-flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        お子様を登録する
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {children.map((child) => {
                        const age = calculateAge(child.birthDate);
                        const childContracts = contracts.filter(c => c.child_id === child.id && c.status === 'active');

                        return (
                          <div
                            key={child.id}
                            className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                            onClick={() => router.push(`/client/children/${child.id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-7 h-7 text-orange-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-gray-800 truncate">{child.name}</h3>
                                  {age !== null && (
                                    <span className="text-sm text-gray-500 flex-shrink-0">{age}歳</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Building2 className="w-4 h-4" />
                                  <span>
                                    {childContracts.length > 0
                                      ? `${childContracts.length}施設と契約中`
                                      : '施設未連携'}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* クイックアクション */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4">クイックアクション</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleQuickAction('facilities')}
                      disabled={children.length === 0}
                      className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Building2 className="w-8 h-8 text-blue-500 mb-2" />
                      <h3 className="font-bold text-gray-800 text-sm">施設を確認</h3>
                      <p className="text-xs text-gray-500 mt-1">利用施設一覧</p>
                    </button>
                    <button
                      onClick={() => handleQuickAction('calendar')}
                      disabled={children.length === 0}
                      className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CalendarDays className="w-8 h-8 text-purple-500 mb-2" />
                      <h3 className="font-bold text-gray-800 text-sm">予定を見る</h3>
                      <p className="text-xs text-gray-500 mt-1">利用カレンダー</p>
                    </button>
                    <button
                      onClick={() => handleQuickAction('message')}
                      disabled={children.length === 0}
                      className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MessageSquare className="w-8 h-8 text-green-500 mb-2" />
                      <h3 className="font-bold text-gray-800 text-sm">連絡する</h3>
                      <p className="text-xs text-gray-500 mt-1">施設への連絡</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 利用施設タブ */}
            {activeTab === 'facilities' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">利用施設一覧</h2>
                </div>

                {contracts.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building2 className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">利用施設がありません</h3>
                    <p className="text-gray-600 text-sm">
                      施設からの招待を受けるか、お子様を登録後に施設へ利用申請をしてください。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* アクティブな契約 */}
                    {contracts.filter(c => c.status === 'active').length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-gray-600 mb-3">契約中の施設</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {contracts
                            .filter(c => c.status === 'active')
                            .map((contract) => {
                              const child = children.find(ch => ch.id === contract.child_id);
                              return (
                                <div
                                  key={contract.id}
                                  className="bg-green-50 border border-green-200 rounded-lg p-4 hover:border-green-300 transition-colors cursor-pointer"
                                  onClick={() => child && router.push(`/client/facilities/${contract.facility_id}?child=${child.id}`)}
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                        <Building2 className="w-6 h-6 text-green-600" />
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-gray-800">{contract.facilities?.name}</h4>
                                        {child && (
                                          <p className="text-sm text-gray-600">{child.name} さん</p>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                      契約中
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-600">
                                    {contract.contract_start_date && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {contract.contract_start_date}〜
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-green-200 flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/client/facilities/${contract.facility_id}/records?child=${child?.id}`);
                                      }}
                                      className="flex-1 text-sm bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-200 transition-colors"
                                    >
                                      実績記録
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/client/facilities/${contract.facility_id}/contact?child=${child?.id}`);
                                      }}
                                      className="flex-1 text-sm bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-200 transition-colors"
                                    >
                                      連絡する
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* 承認待ちの契約 */}
                    {contracts.filter(c => c.status === 'pending').length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-gray-600 mb-3">承認待ち</h3>
                        <div className="space-y-3">
                          {contracts
                            .filter(c => c.status === 'pending')
                            .map((contract) => {
                              const child = children.find(ch => ch.id === contract.child_id);
                              return (
                                <div
                                  key={contract.id}
                                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Clock className="w-5 h-5 text-yellow-600" />
                                      <div>
                                        <h4 className="font-medium text-gray-800">{contract.facilities?.name}</h4>
                                        {child && (
                                          <p className="text-sm text-gray-600">{child.name} さん</p>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                      承認待ち
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 利用実績タブ */}
            {activeTab === 'records' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">利用実績</h2>
                </div>

                {usageRecords.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-purple-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">利用実績がありません</h3>
                    <p className="text-gray-600 text-sm">
                      施設と契約すると、利用実績が表示されます。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {usageRecords.slice(0, 20).map((record) => {
                      const facility = facilities.find(f => f.id === record.facility_id);
                      const child = children.find(c => c.id === record.child_id);
                      return (
                        <div
                          key={record.id}
                          className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                record.service_status === '利用' ? 'bg-green-500' :
                                record.service_status === '欠席(加算なし)' ? 'bg-gray-400' :
                                'bg-yellow-500'
                              }`} />
                              <div>
                                <p className="font-medium text-gray-800">{record.date}</p>
                                <p className="text-sm text-gray-500">
                                  {child?.name} - {facility?.name || '施設名不明'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                record.service_status === '利用' ? 'bg-green-100 text-green-800' :
                                record.service_status === '欠席(加算なし)' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {record.service_status || record.slot}
                              </span>
                              {record.calculated_time && record.calculated_time > 0 && (
                                <p className="text-xs text-gray-500 mt-1">{record.calculated_time}時間</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 連絡タブ */}
            {activeTab === 'messages' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">施設への連絡</h2>
                </div>

                {contracts.filter(c => c.status === 'active').length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">連絡できる施設がありません</h3>
                    <p className="text-gray-600 text-sm">
                      施設と契約すると、連絡機能が使えるようになります。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 mb-4">
                      連絡したい施設を選択してください。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {contracts
                        .filter(c => c.status === 'active')
                        .map((contract) => {
                          const child = children.find(ch => ch.id === contract.child_id);
                          return (
                            <div
                              key={contract.id}
                              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors"
                            >
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                  <Building2 className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-800">{contract.facilities?.name}</h4>
                                  {child && (
                                    <p className="text-sm text-gray-600">{child.name} さん</p>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => router.push(`/client/facilities/${contract.facility_id}/contact?child=${child?.id}&type=absence`)}
                                  className="flex items-center justify-center gap-1 text-sm bg-red-50 hover:bg-red-100 text-red-700 py-2 px-3 rounded border border-red-200 transition-colors"
                                >
                                  <XCircle className="w-4 h-4" />
                                  欠席連絡
                                </button>
                                <button
                                  onClick={() => router.push(`/client/facilities/${contract.facility_id}/contact?child=${child?.id}&type=schedule`)}
                                  className="flex items-center justify-center gap-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 px-3 rounded border border-blue-200 transition-colors"
                                >
                                  <Calendar className="w-4 h-4" />
                                  利用希望
                                </button>
                                <button
                                  onClick={() => router.push(`/client/facilities/${contract.facility_id}/contact?child=${child?.id}&type=message`)}
                                  className="flex items-center justify-center gap-1 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-3 rounded border border-gray-200 transition-colors col-span-2"
                                >
                                  <Send className="w-4 h-4" />
                                  メッセージを送る
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            co-shien 利用者向けサービス
          </p>
        </div>
      </main>

      {/* 児童選択モーダル */}
      {showChildSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                お子様を選択してください
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {pendingAction?.type === 'facilities' && '施設一覧を確認するお子様を選択'}
                {pendingAction?.type === 'calendar' && '予定カレンダーを確認するお子様を選択'}
                {pendingAction?.type === 'message' && '連絡するお子様を選択'}
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {children.map((child) => {
                const age = calculateAge(child.birthDate);
                const childContracts = contracts.filter(c => c.child_id === child.id && c.status === 'active');

                return (
                  <button
                    key={child.id}
                    onClick={() => handleChildSelect(child.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-800 truncate">{child.name}</h4>
                        {age !== null && (
                          <span className="text-sm text-gray-500 flex-shrink-0">{age}歳</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {childContracts.length > 0
                          ? `${childContracts.length}施設と契約中`
                          : '施設未連携'}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowChildSelector(false);
                  setPendingAction(null);
                }}
                className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium"
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
