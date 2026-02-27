/**
 * 利用者ダッシュボード
 * 登録済みの児童一覧、契約施設一覧、実績記録、連絡機能を提供
 * 追加: 利用予定カレンダー、連絡帳バッジ、お知らせ、利用施設一覧
 * フェーズ管理対応: チャット・メッセージ機能はフェーズ3でのみ表示
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Plus, User, Calendar, LogOut, ChevronRight, AlertCircle, Building2,
  FileText, Clock, CheckCircle, XCircle, MessageSquare, Bell,
  CalendarDays, ClipboardList, Send, Settings, PenLine, Mail,
  ChevronLeft, BookOpen, Inbox
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';
import type { Child } from '@/types';

// フェーズ管理: フェーズ3以上でチャット・メッセージ機能を有効化
const FEATURE_PHASE = parseInt(process.env.NEXT_PUBLIC_FEATURE_PHASE || '1', 10);
const isChatEnabled = FEATURE_PHASE >= 3;

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
  type: 'info' | 'warning' | 'success' | 'chat' | 'sign_request';
  linkTo?: string;
  facilityId?: string;
  facilityName?: string;
  created_at: string;
  is_read: boolean;
};

// 未読チャット情報の型
type UnreadChatInfo = {
  facilityId: string;
  facilityName: string;
  unreadCount: number;
  lastMessageAt: string;
};

// 署名依頼の型
type SignRequest = {
  id: string;
  facilityId: string;
  facilityName: string;
  childId: string;
  childName: string;
  month: string;
  type: 'monthly_record' | 'service_plan';
  status: 'pending' | 'signed';
  requestedAt: string;
};

// 連絡帳の型
type ContactLog = {
  id: string;
  facility_id: string;
  child_id: string;
  date: string;
  activities?: string;
  health_status?: string;
  staff_comment?: string;
  status?: string;
  is_signed: boolean;
  signed_at?: string;
  parent_signer_name?: string;
};

// 施設メッセージの型
type FacilityMessage = {
  id: string;
  facility_id: string;
  parent_user_id: string;
  sender_type: string;
  sender_name?: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

// 利用申請の型
type UsageRequest = {
  id: string;
  facility_id: string;
  child_id: string;
  request_month: string;
  status: string;
  submitted_at: string;
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadChats, setUnreadChats] = useState<UnreadChatInfo[]>([]);
  const [signRequests, setSignRequests] = useState<SignRequest[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<FacilityMessage[]>([]);
  const [usageRequests, setUsageRequests] = useState<UsageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'facilities' | 'records' | 'messages'>('overview');

  // カレンダー表示用の状態
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // 児童選択モーダル用の状態
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'facilities' | 'calendar' | 'message' | 'usage-request'; } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // localStorageからユーザー情報を取得
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          setIsRedirecting(true);
          router.replace('/parent/login');
          return;
        }

        let userId: string | null = null;
        let userData: any = null;

        try {
          const user = JSON.parse(userStr);
          if (!user?.id) {
            setIsRedirecting(true);
            router.replace('/parent/login');
            return;
          }

          if (user.userType !== 'client') {
            setIsRedirecting(true);
            router.replace('/career');
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
            setIsRedirecting(true);
            router.replace('/parent/login');
            return;
          }

          if (dbUserData.user_type !== 'client') {
            setIsRedirecting(true);
            router.replace('/career');
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
          setIsRedirecting(true);
          router.replace('/parent/login');
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
            // 施設情報を抽出するためのMap
            const uniqueFacilities = new Map<string, Facility>();

            // 方法1: childrenのfacility_idから施設を取得
            const childFacilityIds = formattedChildren
              .filter(c => c.facilityId)
              .map(c => c.facilityId as string);

            if (childFacilityIds.length > 0) {
              const { data: childFacilitiesData } = await supabase
                .from('facilities')
                .select('id, name, code')
                .in('id', childFacilityIds);

              if (childFacilitiesData) {
                childFacilitiesData.forEach((f: any) => {
                  uniqueFacilities.set(f.id, f);
                });

                // childrenベースの仮想契約を作成
                const virtualContracts: Contract[] = formattedChildren
                  .filter(c => c.facilityId)
                  .map(c => ({
                    id: `virtual-${c.id}-${c.facilityId}`,
                    child_id: c.id,
                    facility_id: c.facilityId as string,
                    status: 'active' as const,
                    facilities: uniqueFacilities.get(c.facilityId as string),
                  }));
                setContracts(virtualContracts);
              }
            }

            // 方法2: 契約情報を取得（RLSがあるため結果が空でもエラーにしない）
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

            if (!contractsError && contractsData && contractsData.length > 0) {
              // 契約データがある場合は上書き
              setContracts(contractsData);

              // 契約から施設を追加
              contractsData.forEach((c: any) => {
                if (c.facilities && !uniqueFacilities.has(c.facility_id)) {
                  uniqueFacilities.set(c.facility_id, c.facilities);
                }
              });
            }

            setFacilities(Array.from(uniqueFacilities.values()));

            // アクティブな契約/関連の施設IDを取得
            const activeFacilityIds = Array.from(uniqueFacilities.keys());

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

              // 連絡帳を取得（署名待ちと最近の履歴）
              const { data: contactLogsData } = await supabase
                .from('contact_logs')
                .select('*')
                .in('child_id', childIds)
                .in('facility_id', activeFacilityIds)
                .order('date', { ascending: false })
                .limit(30);

              if (contactLogsData) {
                setContactLogs(contactLogsData);
              }
            }

            // 利用申請を取得
            if (userId) {
              const { data: requestsData } = await supabase
                .from('usage_requests')
                .select('*')
                .eq('parent_user_id', userId)
                .order('submitted_at', { ascending: false })
                .limit(20);

              if (requestsData) {
                setUsageRequests(requestsData);
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

        // 未読チャットメッセージを取得
        if (userId) {
          const { data: unreadData } = await supabase
            .from('chat_messages')
            .select(`
              facility_id,
              created_at,
              facilities:facility_id (
                id,
                name
              )
            `)
            .eq('client_user_id', userId)
            .eq('sender_type', 'staff')
            .eq('is_read', false)
            .order('created_at', { ascending: false });

          if (unreadData && unreadData.length > 0) {
            // 施設ごとにグループ化
            const chatMap = new Map<string, UnreadChatInfo>();
            unreadData.forEach((msg: any) => {
              const facilityId = msg.facility_id;
              const existing = chatMap.get(facilityId);
              if (existing) {
                existing.unreadCount++;
              } else {
                chatMap.set(facilityId, {
                  facilityId,
                  facilityName: msg.facilities?.name || '施設',
                  unreadCount: 1,
                  lastMessageAt: msg.created_at,
                });
              }
            });
            setUnreadChats(Array.from(chatMap.values()));
          }

          // 未読施設メッセージを取得
          const { data: facilityMsgData } = await supabase
            .from('facility_messages')
            .select('*')
            .eq('parent_user_id', userId)
            .eq('sender_type', 'facility')
            .eq('is_read', false)
            .order('created_at', { ascending: false });

          if (facilityMsgData) {
            setUnreadMessages(facilityMsgData);
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
    router.push('/parent/login');
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

  // 署名待ちの連絡帳の数
  const unsignedContactLogs = contactLogs.filter(cl => !cl.is_signed && cl.status === 'submitted');

  // 総未読バッジ数
  const totalBadgeCount = pendingInvitations.length
    + unreadChats.reduce((sum, c) => sum + c.unreadCount, 0)
    + signRequests.length
    + unsignedContactLogs.length
    + unreadMessages.length;

  // カレンダー用日付データ
  const calendarDates = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const dates: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    const formatDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    // 前月の末尾
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      dates.push({ date: formatDate(d), day: d.getDate(), isCurrentMonth: false });
    }

    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      dates.push({ date: formatDate(d), day, isCurrentMonth: true });
    }

    // 次月の初め
    const remaining = 42 - dates.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      dates.push({ date: formatDate(d), day, isCurrentMonth: false });
    }

    return dates;
  }, [calendarMonth]);

  // カレンダー上の利用予定日を集計
  const scheduledDateMap = useMemo(() => {
    const map = new Map<string, { count: number; facilities: Set<string> }>();
    usageRecords.forEach(r => {
      const existing = map.get(r.date);
      if (existing) {
        existing.count++;
        existing.facilities.add(r.facility_id);
      } else {
        map.set(r.date, { count: 1, facilities: new Set([r.facility_id]) });
      }
    });
    return map;
  }, [usageRecords]);

  // クイックアクションの処理
  const handleQuickAction = (actionType: 'facilities' | 'calendar' | 'message' | 'usage-request') => {
    if (children.length === 0) return;

    if (children.length === 1) {
      executeAction(children[0].id, actionType);
    } else {
      setPendingAction({ type: actionType });
      setShowChildSelector(true);
    }
  };

  // アクション実行
  const executeAction = (childId: string, actionType: 'facilities' | 'calendar' | 'message' | 'usage-request') => {
    switch (actionType) {
      case 'facilities':
        router.push(`/parent/children/${childId}?tab=facilities`);
        break;
      case 'calendar':
        router.push(`/parent/children/${childId}?tab=calendar`);
        break;
      case 'message': {
        const childContracts = contracts.filter(c => c.child_id === childId && c.status === 'active');
        if (childContracts.length > 0) {
          router.push(`/parent/facilities/${childContracts[0].facility_id}/chat`);
        } else {
          setActiveTab('messages');
        }
        break;
      }
      case 'usage-request':
        router.push(`/parent/children/${childId}/usage-request`);
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

  // リダイレクト中は何も表示しない
  if (isRedirecting) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F6AD55] mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Roots"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
            <span className="inline-block bg-[#F6AD55] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              利用者
            </span>
          </div>
          <div className="flex items-center gap-4">
            {totalBadgeCount > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                  {totalBadgeCount}
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
          <div className="bg-amber-50 border border-[#F6AD55]/30 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
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
                    onClick={() => router.push(`/parent/invitations/${inv.invitation_token}`)}
                    className="bg-[#F6AD55] hover:bg-[#ED8936] text-white text-sm font-bold py-2 px-4 rounded-md"
                  >
                    確認する
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ウェルカムメッセージ */}
        <div className="bg-[#FEF3E2] rounded-2xl p-6 mb-6 border border-[#F6AD55]/20">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl">👋</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                ようこそ、{currentUser?.last_name || currentUser?.name?.split(' ')[0]}さん
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                お子様の利用状況を確認できます
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
              <User className="w-4 h-4 text-[#F6AD55]" />
              <span className="text-xs text-gray-500">お子様</span>
              <span className="text-sm font-bold text-gray-800">{children.length}人</span>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">利用施設</span>
              <span className="text-sm font-bold text-gray-800">{facilities.length}</span>
            </div>
            {currentMonthUsage > 0 && (
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                <CalendarDays className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500">今月の利用</span>
                <span className="text-sm font-bold text-gray-800">{currentMonthUsage}回</span>
              </div>
            )}
            {unsignedContactLogs.length > 0 && (
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-red-200">
                <BookOpen className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-500">署名待ち</span>
                <span className="text-sm font-bold text-red-600">{unsignedContactLogs.length}件</span>
              </div>
            )}
          </div>
        </div>

        {/* お知らせセクション */}
        {((isChatEnabled && unreadChats.length > 0) || signRequests.length > 0 || unsignedContactLogs.length > 0 || unreadMessages.length > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
              <div className="w-8 h-8 bg-[#FEF3E2] rounded-full flex items-center justify-center">
                <Bell className="w-4 h-4 text-[#F6AD55]" />
              </div>
              <h2 className="font-bold text-gray-800">お知らせ</h2>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                {(isChatEnabled ? unreadChats.reduce((sum, c) => sum + c.unreadCount, 0) : 0) + signRequests.length + unsignedContactLogs.length + unreadMessages.length}件
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 署名待ち連絡帳 */}
              {unsignedContactLogs.length > 0 && (
                <button
                  onClick={() => {
                    const firstLog = unsignedContactLogs[0];
                    router.push(`/parent/facilities/${firstLog.facility_id}/contact`);
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-[#F6AD55]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#F6AD55] text-white text-xs font-bold px-2 py-0.5 rounded">
                        署名待ち
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 truncate">
                      {unsignedContactLogs.length}件の連絡帳が署名を待っています
                    </h3>
                    <p className="text-sm text-gray-500">
                      タップして確認・署名する
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              )}

              {/* 未読施設メッセージ */}
              {unreadMessages.length > 0 && (
                <button
                  onClick={() => {
                    const firstMsg = unreadMessages[0];
                    router.push(`/parent/facilities/${firstMsg.facility_id}/chat`);
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Inbox className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                        未読メッセージ
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 truncate">
                      施設からの{unreadMessages.length}件のメッセージ
                    </h3>
                    <p className="text-sm text-gray-500">
                      タップして確認する
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              )}

              {/* 未読チャットメッセージ（フェーズ3以上で表示） */}
              {isChatEnabled && unreadChats.map((chat) => (
                <button
                  key={chat.facilityId}
                  onClick={() => router.push(`/parent/facilities/${chat.facilityId}/chat`)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-[#F6AD55]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#ED8936] text-white text-xs font-bold px-2 py-0.5 rounded">
                        新着メッセージ
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 truncate">
                      {chat.facilityName}から{chat.unreadCount}件のメッセージ
                    </h3>
                    <p className="text-sm text-gray-500">
                      タップして確認する
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))}

              {/* 署名依頼 */}
              {signRequests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => router.push(`/parent/facilities/${request.facilityId}/records?sign=${request.id}`)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <PenLine className="w-6 h-6 text-[#F6AD55]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#F6AD55] text-white text-xs font-bold px-2 py-0.5 rounded">
                        署名依頼
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 truncate">
                      {request.month}の{request.type === 'monthly_record' ? '実績記録表' : 'サービス計画'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {request.facilityName} - {request.childName}さん
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
          <div className="flex overflow-x-auto p-1.5 gap-1" role="tablist" aria-label="ダッシュボードメニュー">
            {[
              { id: 'overview', label: '概要', icon: ClipboardList, phase: 1 },
              { id: 'facilities', label: '利用施設', icon: Building2, phase: 1 },
              { id: 'records', label: '利用実績', icon: Calendar, phase: 1 },
              { id: 'messages', label: '連絡', icon: MessageSquare, phase: 3 },
            ].filter(tab => FEATURE_PHASE >= tab.phase).map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#FEF3E2] text-[#ED8936] font-bold rounded-lg'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg'
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
              <div className="space-y-6" role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
                {/* クイックアクション */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-[#F6AD55] rounded-full" />
                    <h2 className="text-lg font-bold text-gray-800">クイックアクション</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                      onClick={() => handleQuickAction('usage-request')}
                      disabled={children.length === 0}
                      className="bg-[#FEF3E2] hover:bg-[#FDEBD0] rounded-xl p-5 text-left transition-all hover:shadow-md border border-[#F6AD55]/20 hover:border-[#F6AD55]/40 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform">
                        <CalendarDays className="w-6 h-6 text-[#F6AD55]" />
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm">利用希望申請</h3>
                      <p className="text-xs text-gray-500 mt-1">日程を申請する</p>
                    </button>
                    <button
                      onClick={() => handleQuickAction('facilities')}
                      disabled={children.length === 0}
                      className="bg-[#FEF3E2] hover:bg-[#FDEBD0] rounded-xl p-5 text-left transition-all hover:shadow-md border border-[#F6AD55]/20 hover:border-[#F6AD55]/40 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform">
                        <Building2 className="w-6 h-6 text-[#F6AD55]" />
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm">施設を確認</h3>
                      <p className="text-xs text-gray-500 mt-1">利用施設一覧</p>
                    </button>
                    <button
                      onClick={() => handleQuickAction('calendar')}
                      disabled={children.length === 0}
                      className="bg-[#FEF3E2] hover:bg-[#FDEBD0] rounded-xl p-5 text-left transition-all hover:shadow-md border border-[#F6AD55]/20 hover:border-[#F6AD55]/40 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform">
                        <Calendar className="w-6 h-6 text-[#F6AD55]" />
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm">予定を見る</h3>
                      <p className="text-xs text-gray-500 mt-1">利用カレンダー</p>
                    </button>
                    {isChatEnabled && (
                      <button
                        onClick={() => handleQuickAction('message')}
                        disabled={children.length === 0}
                        className="bg-[#FEF3E2] hover:bg-[#FDEBD0] rounded-xl p-5 text-left transition-all hover:shadow-md border border-[#F6AD55]/20 hover:border-[#F6AD55]/40 group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform">
                          <MessageSquare className="w-6 h-6 text-[#F6AD55]" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm">施設にチャット</h3>
                        <p className="text-xs text-gray-500 mt-1">施設とメッセージ</p>
                      </button>
                    )}
                  </div>
                </div>

                {/* 児童一覧 */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 bg-[#F6AD55] rounded-full" />
                      <h2 className="text-lg font-bold text-gray-800">お子様一覧</h2>
                    </div>
                    <button
                      onClick={() => router.push('/parent/children/register')}
                      className="flex items-center gap-2 bg-[#F6AD55] hover:bg-[#ED8936] text-white text-sm font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>

                  {children.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-[#F6AD55]" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">お子様が登録されていません</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        「追加」ボタンからお子様の情報を登録してください。
                      </p>
                      <button
                        onClick={() => router.push('/parent/children/register')}
                        className="inline-flex items-center gap-2 bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-2 px-4 rounded-md transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        お子様を登録する
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {children.map((child) => {
                        const ageInfo = child.birthDate ? calculateAgeWithMonths(child.birthDate) : null;
                        const childContracts = contracts.filter(c => c.child_id === child.id && c.status === 'active');
                        const childUsage = usageRecords.filter(r => r.child_id === child.id);
                        const nextSchedule = childUsage.find(r => new Date(r.date) >= new Date());

                        return (
                          <div
                            key={child.id}
                            className="bg-white rounded-xl p-5 hover:shadow-md transition-all cursor-pointer border border-gray-100 hover:border-[#F6AD55]/50 group"
                            onClick={() => router.push(`/parent/children/${child.id}`)}
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                <User className="w-7 h-7 text-[#F6AD55]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-gray-800 truncate text-lg">{child.name}</h3>
                                  {ageInfo && (
                                    <span className="text-sm text-gray-500 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">{ageInfo.display}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                                  <div className="flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span>
                                      {childContracts.length > 0
                                        ? `${childContracts.length}施設`
                                        : '未連携'}
                                    </span>
                                  </div>
                                  {nextSchedule && (
                                    <div className="flex items-center gap-1">
                                      <CalendarDays className="w-3.5 h-3.5" />
                                      <span>次回: {nextSchedule.date}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 group-hover:text-[#F6AD55] transition-colors mt-2" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 利用予定カレンダー */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 bg-[#F6AD55] rounded-full" />
                      <h2 className="text-lg font-bold text-gray-800">利用予定カレンダー</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                        className="p-1.5 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
                        {calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月
                      </span>
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                        className="p-1.5 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="grid grid-cols-7 bg-gray-50">
                      {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                        <div
                          key={i}
                          className={`p-2 text-center text-xs font-bold ${
                            i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                          }`}
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {calendarDates.map((dateInfo, idx) => {
                        const scheduled = scheduledDateMap.get(dateInfo.date);
                        const isToday = dateInfo.date === todayStr;
                        const dayOfWeek = new Date(dateInfo.date).getDay();

                        return (
                          <div
                            key={idx}
                            className={`min-h-[48px] p-1 border-t border-r border-gray-100 relative ${
                              !dateInfo.isCurrentMonth ? 'bg-gray-50 opacity-40' : ''
                            } ${isToday ? 'bg-amber-50' : ''}`}
                          >
                            <div className={`text-xs text-center font-medium ${
                              isToday
                                ? 'w-6 h-6 rounded-full bg-[#F6AD55] text-white flex items-center justify-center mx-auto'
                                : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
                            }`}>
                              {dateInfo.day}
                            </div>
                            {scheduled && dateInfo.isCurrentMonth && (
                              <div className="flex justify-center mt-1">
                                <div className="w-2 h-2 rounded-full bg-[#F6AD55]" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#F6AD55]" />
                      <span>利用予定日</span>
                    </div>
                  </div>
                </div>

                {/* 最新の連絡帳 */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 bg-[#F6AD55] rounded-full" />
                      <h2 className="text-lg font-bold text-gray-800">最新の連絡帳</h2>
                      {unsignedContactLogs.length > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {unsignedContactLogs.length}件署名待ち
                        </span>
                      )}
                    </div>
                  </div>
                  {contactLogs.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">連絡帳はまだありません</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contactLogs.slice(0, 5).map((log) => {
                        const child = children.find(c => c.id === log.child_id);
                        const facility = facilities.find(f => f.id === log.facility_id);
                        const needsSign = !log.is_signed && log.status === 'submitted';
                        return (
                          <div
                            key={log.id}
                            className={`rounded-xl p-4 border cursor-pointer transition-all hover:shadow-sm ${
                              needsSign
                                ? 'border-[#F6AD55]/40 bg-amber-50 hover:border-[#F6AD55]'
                                : 'border-gray-100 bg-white hover:border-gray-200'
                            }`}
                            onClick={() => router.push(`/parent/facilities/${log.facility_id}/contact`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  needsSign ? 'bg-[#F6AD55]/10' : 'bg-gray-100'
                                }`}>
                                  <BookOpen className={`w-5 h-5 ${needsSign ? 'text-[#F6AD55]' : 'text-gray-400'}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-800">{log.date}</span>
                                    {needsSign && (
                                      <span className="text-[10px] bg-[#F6AD55] text-white px-1.5 py-0.5 rounded font-bold">
                                        署名待ち
                                      </span>
                                    )}
                                    {log.is_signed && (
                                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                        <CheckCircle className="w-3 h-3" />
                                        署名済み
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {child?.name} - {facility?.name || '施設'}
                                    {log.activities && ` / ${log.activities.substring(0, 30)}...`}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 利用施設一覧 */}
                {facilities.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 bg-[#F6AD55] rounded-full" />
                      <h2 className="text-lg font-bold text-gray-800">利用施設一覧</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {facilities.map((facility) => {
                        const facilityContracts = contracts.filter(c => c.facility_id === facility.id && c.status === 'active');
                        const facilityChildren = facilityContracts.map(c => children.find(ch => ch.id === c.child_id)).filter(Boolean);
                        return (
                          <div
                            key={facility.id}
                            className="bg-white rounded-xl p-4 border border-gray-100 hover:border-[#F6AD55]/40 hover:shadow-sm transition-all cursor-pointer group"
                            onClick={() => {
                              const childForFacility = facilityChildren[0];
                              router.push(`/parent/facilities/${facility.id}${childForFacility ? `?child=${childForFacility.id}` : ''}`);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-5 h-5 text-[#F6AD55]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 truncate">{facility.name}</h4>
                                <p className="text-xs text-gray-500">
                                  {facilityChildren.map(c => c?.name).join(', ')}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#F6AD55]" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 利用施設タブ */}
            {activeTab === 'facilities' && (
              <div className="space-y-4" role="tabpanel" id="tabpanel-facilities" aria-labelledby="tab-facilities">
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
                                  className="bg-green-50 border border-green-200 rounded-xl p-4 hover:border-green-300 transition-colors cursor-pointer"
                                  onClick={() => child && router.push(`/parent/facilities/${contract.facility_id}?child=${child.id}`)}
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
                                        {contract.contract_start_date}~
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-green-200 flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/parent/facilities/${contract.facility_id}/contact`);
                                      }}
                                      className="flex-1 text-sm bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <BookOpen className="w-4 h-4" />
                                      連絡帳
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/parent/facilities/${contract.facility_id}/records?child=${child?.id}`);
                                      }}
                                      className="flex-1 text-sm bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <FileText className="w-4 h-4" />
                                      実績記録
                                    </button>
                                    {isChatEnabled && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/parent/facilities/${contract.facility_id}/chat`);
                                        }}
                                        className="flex-1 text-sm bg-[#F6AD55] hover:bg-[#ED8936] text-white py-2 px-3 rounded-lg border border-[#ED8936] transition-colors font-bold flex items-center justify-center gap-1.5 shadow-md"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                        チャット
                                      </button>
                                    )}
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
                                  className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
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
              <div className="space-y-4" role="tabpanel" id="tabpanel-records" aria-labelledby="tab-records">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">利用実績</h2>
                </div>

                {/* 利用申請のステータス */}
                {usageRequests.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-600 mb-2">利用希望申請</h3>
                    <div className="space-y-2">
                      {usageRequests.slice(0, 5).map((req) => {
                        const child = children.find(c => c.id === req.child_id);
                        const facility = facilities.find(f => f.id === req.facility_id);
                        const statusConfig: Record<string, { label: string; color: string }> = {
                          pending: { label: '申請中', color: 'bg-yellow-100 text-yellow-800' },
                          approved: { label: '承認済み', color: 'bg-green-100 text-green-800' },
                          partially_approved: { label: '一部承認', color: 'bg-blue-100 text-blue-800' },
                          rejected: { label: '却下', color: 'bg-red-100 text-red-800' },
                        };
                        const st = statusConfig[req.status] || { label: req.status, color: 'bg-gray-100 text-gray-800' };
                        return (
                          <div key={req.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{req.request_month}</p>
                              <p className="text-xs text-gray-500">{child?.name} - {facility?.name}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${st.color}`}>
                              {st.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {usageRecords.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-[#F6AD55]" />
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
                          className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
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
              <div className="space-y-4" role="tabpanel" id="tabpanel-messages" aria-labelledby="tab-messages">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">施設への連絡</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      施設カードをクリックしてチャットを開き、メッセージ・欠席連絡・利用希望を送ることができます
                    </p>
                  </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {contracts
                        .filter(c => c.status === 'active')
                        .map((contract) => {
                          const child = children.find(ch => ch.id === contract.child_id);
                          return (
                            <div
                              key={contract.id}
                              className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-[#F6AD55] hover:shadow-lg transition-all cursor-pointer group"
                              onClick={() => router.push(`/parent/facilities/${contract.facility_id}/chat`)}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-[#F6AD55] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                                  <Building2 className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-gray-800 text-lg mb-1">{contract.facilities?.name}</h4>
                                  {child && (
                                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                                      <User className="w-4 h-4" />
                                      {child.name} さん
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    チャットで連絡する
                                  </p>
                                </div>
                                <ChevronRight className="w-6 h-6 text-gray-400 flex-shrink-0 group-hover:text-[#F6AD55] transition-colors" />
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
            Roots 利用者向けサービス
          </p>
        </div>
      </main>

      {/* 児童選択モーダル */}
      {showChildSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                お子様を選択してください
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {pendingAction?.type === 'facilities' && '施設一覧を確認するお子様を選択'}
                {pendingAction?.type === 'calendar' && '予定カレンダーを確認するお子様を選択'}
                {pendingAction?.type === 'message' && '連絡するお子様を選択'}
                {pendingAction?.type === 'usage-request' && '利用希望を申請するお子様を選択'}
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {children.map((child) => {
                const ageInfo = child.birthDate ? calculateAgeWithMonths(child.birthDate) : null;
                const childContracts = contracts.filter(c => c.child_id === child.id && c.status === 'active');

                return (
                  <button
                    key={child.id}
                    onClick={() => handleChildSelect(child.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-[#F6AD55]/50 hover:bg-amber-50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-[#F6AD55]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-800 truncate">{child.name}</h4>
                        {ageInfo && (
                          <span className="text-sm text-gray-500 flex-shrink-0">{ageInfo.display}</span>
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
