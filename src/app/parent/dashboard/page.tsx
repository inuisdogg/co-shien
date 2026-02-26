/**
 * 利用者ダッシュボード
 * 登録済みの児童一覧、契約施設一覧、実績記録、連絡機能を提供
 * フェーズ管理対応: チャット・メッセージ機能はフェーズ3でのみ表示
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Plus, User, Calendar, LogOut, ChevronRight, ChevronLeft, AlertCircle, Building2,
  FileText, Clock, CheckCircle, XCircle, MessageSquare, Bell,
  CalendarDays, ClipboardList, Send, Settings, PenLine, Mail, BookOpen
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PushNotificationToggle from '@/components/pwa/PushNotificationToggle';
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

// 施設ごとの未署名連絡帳情報
type UnsignedContactInfo = {
  facilityId: string;
  facilityName: string;
  count: number;
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadChats, setUnreadChats] = useState<UnreadChatInfo[]>([]);
  const [signRequests, setSignRequests] = useState<SignRequest[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [unsignedContactCount, setUnsignedContactCount] = useState(0);
  const [unsignedContacts, setUnsignedContacts] = useState<UnsignedContactInfo[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'facilities' | 'records' | 'messages'>('overview');

  // 児童選択モーダル用の状態
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'facilities' | 'calendar' | 'message'; } | null>(null);

  // カレンダー月の状態
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  // 児童ごとのカラー設定
  const CHILD_COLORS = ['#93C5FD', '#86EFAC', '#FCA5A5', '#C4B5FD', '#FDBA74'];
  const getChildColor = (childIndex: number): string => {
    return CHILD_COLORS[childIndex % CHILD_COLORS.length];
  };
  const getChildColorDark = (childIndex: number): string => {
    const darkColors = ['#3B82F6', '#22C55E', '#EF4444', '#8B5CF6', '#F97316'];
    return darkColors[childIndex % darkColors.length];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // localStorageからユーザー情報を取得
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/parent/login');
          return;
        }

        let userId: string | null = null;
        let userData: any = null;

        try {
          const user = JSON.parse(userStr);
          if (!user?.id) {
            router.push('/parent/login');
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
            router.push('/parent/login');
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
          router.push('/parent/login');
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

          // 施設情報を抽出するためのMap（外側スコープで定義して署名待ち取得でも使えるようにする）
          const uniqueFacilities = new Map<string, Facility>();

          if (childIds.length > 0) {

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
        }

        // 署名依頼を取得（sign_requestsテーブルがある場合）
        // TODO: 署名依頼テーブルができたら実装

        // 署名待ちの連絡帳を取得（施設ごとにグループ化）
        const allChildIds = (childrenData || []).map((c: any) => c.id);

        if (allChildIds.length > 0) {
          try {
            const { data: unsignedData, error: unsignedErr } = await supabase
              .from('contact_logs')
              .select('id, facility_id, facilities:facility_id (id, name)')
              .in('child_id', allChildIds)
              .eq('status', 'submitted')
              .eq('is_signed', false);

            if (!unsignedErr && unsignedData) {
              setUnsignedContactCount(unsignedData.length);

              // 施設ごとにグループ化
              const facilityCountMap = new Map<string, { count: number; name: string }>();
              unsignedData.forEach((entry: any) => {
                const fid = entry.facility_id;
                const existing = facilityCountMap.get(fid);
                if (existing) {
                  existing.count++;
                } else {
                  facilityCountMap.set(fid, {
                    count: 1,
                    name: entry.facilities?.name || '施設',
                  });
                }
              });

              const unsignedByFacility: UnsignedContactInfo[] = [];
              facilityCountMap.forEach((info, fid) => {
                unsignedByFacility.push({
                  facilityId: fid,
                  facilityName: info.name,
                  count: info.count,
                });
              });
              setUnsignedContacts(unsignedByFacility);
            }
          } catch {
            // ignore - status column may not exist yet
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
        router.push(`/parent/children/${childId}?tab=facilities`);
        break;
      case 'calendar':
        router.push(`/parent/children/${childId}?tab=calendar`);
        break;
      case 'message':
        // 契約中の施設があればチャット画面へ、なければメッセージタブへ
        const childContracts = contracts.filter(c => c.child_id === childId && c.status === 'active');
        if (childContracts.length > 0) {
          router.push(`/parent/facilities/${childContracts[0].facility_id}/chat`);
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

  // 児童のインデックスマップ（色割当用）
  const childIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    children.forEach((child, index) => {
      map.set(child.id, index);
    });
    return map;
  }, [children]);

  // カレンダー日付の生成
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

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      dates.push({ date: formatDate(d), day: d.getDate(), isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      dates.push({ date: formatDate(d), day, isCurrentMonth: true });
    }

    const remaining = 42 - dates.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      dates.push({ date: formatDate(d), day, isCurrentMonth: false });
    }

    return dates;
  }, [calendarMonth]);

  // 日付ごとのスケジュールをまとめる（複数児童対応）
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Array<{
      childId: string;
      childName: string;
      facilityId: string;
      facilityName: string;
      slot?: string;
      serviceStatus?: string;
    }>>();

    usageRecords.forEach(record => {
      const child = children.find(c => c.id === record.child_id);
      const facility = facilities.find(f => f.id === record.facility_id);
      if (!child) return;

      const existing = map.get(record.date) || [];
      existing.push({
        childId: record.child_id,
        childName: child.name,
        facilityId: record.facility_id,
        facilityName: facility?.name || '施設',
        slot: record.slot,
        serviceStatus: record.service_status,
      });
      map.set(record.date, existing);
    });

    return map;
  }, [usageRecords, children, facilities]);

  // 直近の予定リスト（今日以降）
  const upcomingSchedules = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const weekDayNames = ['日', '月', '火', '水', '木', '金', '土'];

    return usageRecords
      .filter(r => r.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10)
      .map(record => {
        const child = children.find(c => c.id === record.child_id);
        const facility = facilities.find(f => f.id === record.facility_id);
        const d = new Date(record.date);
        const dayOfWeek = weekDayNames[d.getDay()];
        return {
          ...record,
          childName: child?.name || '不明',
          childIndex: childIndexMap.get(record.child_id) ?? 0,
          facilityName: facility?.name || '施設',
          dayOfWeek,
        };
      });
  }, [usageRecords, children, facilities, childIndexMap]);

  // 日付ごとにグループ化した直近予定
  const upcomingGrouped = useMemo(() => {
    const groups: Array<{
      date: string;
      dayOfWeek: string;
      items: typeof upcomingSchedules;
    }> = [];

    upcomingSchedules.forEach(item => {
      const existing = groups.find(g => g.date === item.date);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({
          date: item.date,
          dayOfWeek: item.dayOfWeek,
          items: [item],
        });
      }
    });

    return groups;
  }, [upcomingSchedules]);

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

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
            {(pendingInvitations.length > 0 || unreadChats.length > 0 || signRequests.length > 0 || unsignedContactCount > 0) && (
              <div className="relative">
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="relative p-1 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="通知を表示"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {pendingInvitations.length + unreadChats.reduce((sum, c) => sum + c.unreadCount, 0) + signRequests.length + unsignedContactCount}
                  </span>
                </button>

                {showNotificationDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowNotificationDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-30 max-h-[70vh] overflow-y-auto">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-sm">通知</h3>
                        <span className="text-xs text-gray-500">
                          {pendingInvitations.length + unreadChats.reduce((sum, c) => sum + c.unreadCount, 0) + signRequests.length + unsignedContactCount}件
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {unsignedContacts.map((uc) => (
                          <button
                            key={`contact-${uc.facilityId}`}
                            onClick={() => {
                              setShowNotificationDropdown(false);
                              router.push(`/parent/facilities/${uc.facilityId}/contact-book`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FEF3E2] transition-colors text-left"
                          >
                            <div className="w-9 h-9 bg-[#F6AD55]/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-4 h-4 text-[#F6AD55]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">連絡帳 署名待ち {uc.count}件</p>
                              <p className="text-xs text-gray-500 truncate">{uc.facilityName}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        ))}
                        {unreadChats.map((chat) => (
                          <button
                            key={`chat-${chat.facilityId}`}
                            onClick={() => {
                              setShowNotificationDropdown(false);
                              router.push(`/parent/facilities/${chat.facilityId}/chat`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                          >
                            <div className="w-9 h-9 bg-[#FDEBD0] rounded-full flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="w-4 h-4 text-[#F6AD55]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">新着メッセージ {chat.unreadCount}件</p>
                              <p className="text-xs text-gray-500 truncate">{chat.facilityName}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        ))}
                        {pendingInvitations.map((inv) => (
                          <button
                            key={`inv-${inv.id}`}
                            onClick={() => {
                              setShowNotificationDropdown(false);
                              router.push(`/parent/invitations/${inv.invitation_token}`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FEF3E2] transition-colors text-left"
                          >
                            <div className="w-9 h-9 bg-[#FEF3E2] rounded-full flex items-center justify-center flex-shrink-0">
                              <Mail className="w-4 h-4 text-[#F6AD55]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">施設からの招待</p>
                              <p className="text-xs text-gray-500 truncate">{inv.facilities?.name}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        ))}
                        {signRequests.map((request) => (
                          <button
                            key={`sign-${request.id}`}
                            onClick={() => {
                              setShowNotificationDropdown(false);
                              router.push(`/parent/facilities/${request.facilityId}/records?sign=${request.id}`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FEF3E2] transition-colors text-left"
                          >
                            <div className="w-9 h-9 bg-[#FEF3E2] rounded-full flex items-center justify-center flex-shrink-0">
                              <PenLine className="w-4 h-4 text-[#F6AD55]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                署名依頼: {request.type === 'monthly_record' ? '実績記録表' : 'サービス計画'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{request.facilityName} - {request.childName}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                      {pendingInvitations.length === 0 && unreadChats.length === 0 && signRequests.length === 0 && unsignedContacts.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">
                          通知はありません
                        </div>
                      )}
                    </div>
                  </>
                )}
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
          <div className="bg-[#FEF3E2] border border-[#F6AD55]/30 rounded-lg p-4 mb-6">
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
        <div className="bg-gradient-to-r from-[#FBBF6A] to-[#F6AD55] rounded-lg p-6 text-gray-800 mb-6">
          <h1 className="text-2xl font-bold">
            ようこそ、{currentUser?.last_name || currentUser?.name?.split(' ')[0]}さん
          </h1>
        </div>

        {/* お知らせセクション（チャット機能はフェーズ3以上で表示） */}
        {((isChatEnabled && unreadChats.length > 0) || signRequests.length > 0 || unsignedContacts.length > 0) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-white" />
              <h2 className="font-bold text-white">お知らせ</h2>
              <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                {(isChatEnabled ? unreadChats.reduce((sum, c) => sum + c.unreadCount, 0) : 0) + signRequests.length + unsignedContactCount}件
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 未読チャットメッセージ（フェーズ3以上で表示） */}
              {isChatEnabled && unreadChats.map((chat) => (
                <button
                  key={chat.facilityId}
                  onClick={() => router.push(`/parent/facilities/${chat.facilityId}/chat`)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-[#FDEBD0] rounded-full flex items-center justify-center flex-shrink-0">
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

              {/* 未署名の連絡帳 */}
              {unsignedContacts.map((uc) => (
                <button
                  key={`notify-contact-${uc.facilityId}`}
                  onClick={() => router.push(`/parent/facilities/${uc.facilityId}/contact-book`)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[#FEF3E2] transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-[#F6AD55]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-[#F6AD55]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#F6AD55] text-white text-xs font-bold px-2 py-0.5 rounded">
                        連絡帳 署名待ち
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 truncate">
                      {uc.facilityName}から{uc.count}件の署名待ち
                    </h3>
                    <p className="text-sm text-gray-500">
                      タップして連絡帳を確認・署名する
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
                  className="w-full flex items-center gap-4 p-4 hover:bg-[#FEF3E2] transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-[#FDEBD0] rounded-full flex items-center justify-center flex-shrink-0">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {[
              { id: 'overview', label: '概要', icon: ClipboardList, phase: 1 },
              { id: 'facilities', label: '利用施設', icon: Building2, phase: 1 },
              { id: 'records', label: '利用実績', icon: Calendar, phase: 1 },
              { id: 'messages', label: '連絡', icon: MessageSquare, phase: 3 },
            ].filter(tab => FEATURE_PHASE >= tab.phase).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#F6AD55] text-[#ED8936] bg-[#FEF3E2]'
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
                      onClick={() => router.push('/parent/children/register')}
                      className="flex items-center gap-2 bg-[#F6AD55] hover:bg-[#ED8936] text-white text-sm font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>

                  {children.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <div className="w-16 h-16 bg-[#FEF3E2] rounded-full flex items-center justify-center mx-auto mb-4">
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

                        return (
                          <div
                            key={child.id}
                            className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                            onClick={() => router.push(`/parent/children/${child.id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-[#FDEBD0] rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-7 h-7 text-[#F6AD55]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-gray-800 truncate">{child.name}</h3>
                                  {ageInfo && (
                                    <span className="text-sm text-gray-500 flex-shrink-0">{ageInfo.display}</span>
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
                  <div className={`grid grid-cols-1 ${isChatEnabled ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
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
                      <CalendarDays className="w-8 h-8 text-[#F6AD55] mb-2" />
                      <h3 className="font-bold text-gray-800 text-sm">予定を見る</h3>
                      <p className="text-xs text-gray-500 mt-1">利用カレンダー</p>
                    </button>
                    {isChatEnabled && (
                      <button
                        onClick={() => handleQuickAction('message')}
                        disabled={children.length === 0}
                        className="bg-[#FEF3E2] hover:bg-[#FDEBD0] rounded-lg p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-[#F6AD55]/30 hover:border-[#F6AD55]/50"
                      >
                        <MessageSquare className="w-8 h-8 text-[#F6AD55] mb-2" />
                        <h3 className="font-bold text-gray-800 text-sm">施設にチャット</h3>
                        <p className="text-xs text-gray-500 mt-1">施設とメッセージ</p>
                      </button>
                    )}
                  </div>
                </div>

                {/* 利用予定カレンダー（複数児童・施設対応） */}
                {children.length > 0 && usageRecords.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-[#F6AD55]" />
                      利用予定カレンダー
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      {/* カレンダーヘッダー */}
                      <div className="px-4 py-3 bg-gradient-to-r from-[#FBBF6A] to-[#F6AD55] flex items-center justify-between">
                        <button
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                          className="p-1.5 hover:bg-white/20 rounded-md text-white"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-white font-bold">
                          {calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月
                        </h3>
                        <button
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                          className="p-1.5 hover:bg-white/20 rounded-md text-white"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>

                      {/* 児童凡例（複数児童の場合） */}
                      {children.length > 1 && (
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-3">
                          {children.map((child, idx) => (
                            <div key={child.id} className="flex items-center gap-1.5">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getChildColor(idx) }}
                              />
                              <span className="text-xs font-medium text-gray-700">{child.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-3">
                        {/* 曜日ヘッダー */}
                        <div className="grid grid-cols-7 mb-1">
                          {weekDays.map((day, i) => (
                            <div
                              key={i}
                              className={`p-1.5 text-center text-xs font-bold ${
                                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                              }`}
                            >
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* 日付セル */}
                        <div className="grid grid-cols-7 gap-0.5">
                          {calendarDates.map((dateInfo, idx) => {
                            const daySchedules = schedulesByDate.get(dateInfo.date) || [];
                            const isToday = dateInfo.date === todayStr;
                            const dayOfWeek = new Date(dateInfo.date).getDay();

                            return (
                              <div
                                key={idx}
                                className={`min-h-[68px] p-1 rounded-lg transition-all ${
                                  !dateInfo.isCurrentMonth
                                    ? 'bg-gray-50 opacity-30'
                                    : isToday
                                    ? 'bg-[#FEF3E2] border border-[#F6AD55]/40'
                                    : dayOfWeek === 0
                                    ? 'bg-red-50/30'
                                    : dayOfWeek === 6
                                    ? 'bg-blue-50/30'
                                    : 'bg-white'
                                }`}
                              >
                                <div className={`text-xs text-center font-medium mb-0.5 ${
                                  isToday
                                    ? 'w-5 h-5 rounded-full bg-[#F6AD55] text-white flex items-center justify-center mx-auto text-[10px]'
                                    : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
                                }`}>
                                  {dateInfo.day}
                                </div>
                                {daySchedules.length > 0 && dateInfo.isCurrentMonth && (
                                  <div className="space-y-0.5">
                                    {daySchedules.map((sched, sIdx) => {
                                      const cIdx = childIndexMap.get(sched.childId) ?? 0;
                                      return (
                                        <div
                                          key={sIdx}
                                          className="rounded px-0.5 py-0.5 text-center"
                                          style={{ backgroundColor: getChildColor(cIdx) + '40' }}
                                        >
                                          <div
                                            className="text-[9px] font-bold truncate leading-tight"
                                            style={{ color: getChildColorDark(cIdx) }}
                                          >
                                            {children.length > 1 ? sched.childName.charAt(0) : ''}
                                            {sched.slot === 'AM' ? '午前' : sched.slot === 'PM' ? '午後' : ''}
                                          </div>
                                          <div className="text-[8px] text-gray-500 truncate leading-tight">
                                            {sched.facilityName.length > 4 ? sched.facilityName.substring(0, 4) + '..' : sched.facilityName}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 直近の利用予定リスト（複数児童・施設対応） */}
                {upcomingGrouped.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#F6AD55]" />
                      直近の利用予定
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
                      {upcomingGrouped.map((group) => (
                        <div key={group.date} className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-gray-800">
                              {group.date.split('-')[1]}/{group.date.split('-')[2]}
                            </span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              group.dayOfWeek === '日' ? 'bg-red-50 text-red-600' :
                              group.dayOfWeek === '土' ? 'bg-blue-50 text-blue-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {group.dayOfWeek}
                            </span>
                            {group.date === todayStr && (
                              <span className="text-xs font-bold text-[#F6AD55] bg-[#FEF3E2] px-1.5 py-0.5 rounded">
                                TODAY
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {group.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 pl-2"
                              >
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                                  style={{ backgroundColor: getChildColorDark(item.childIndex) }}
                                >
                                  {item.childName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-800">{item.childName}</span>
                                    {item.slot && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                        item.slot === 'AM' ? 'bg-blue-100 text-blue-700' :
                                        item.slot === 'PM' ? 'bg-orange-100 text-orange-700' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {item.slot === 'AM' ? '午前' : item.slot === 'PM' ? '午後' : item.slot}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Building2 className="w-3 h-3" />
                                    <span>{item.facilityName}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 連絡帳 - 施設ごとのリンク */}
                {facilities.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-[#F6AD55]" />
                      連絡帳
                    </h2>
                    <div className="space-y-2">
                      {facilities.map((f) => {
                        const unsignedForFacility = unsignedContacts.find(uc => uc.facilityId === f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => router.push(`/parent/facilities/${f.id}/contact-book`)}
                            className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-left transition-colors"
                          >
                            <div className="w-10 h-10 bg-[#F6AD55]/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-[#F6AD55]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{f.name}</p>
                              <p className="text-xs text-gray-500">連絡帳を確認・署名する</p>
                            </div>
                            {unsignedForFacility && unsignedForFacility.count > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                                {unsignedForFacility.count}
                              </span>
                            )}
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 通知設定 */}
                {currentUser?.id && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-[#F6AD55]" />
                      通知設定
                    </h2>
                    <PushNotificationToggle userId={currentUser.id} />
                  </div>
                )}
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
                                        {contract.contract_start_date}〜
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-green-200 flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/parent/facilities/${contract.facility_id}/records?child=${child?.id}`);
                                      }}
                                      className={`${isChatEnabled ? 'flex-1' : 'w-full'} text-sm bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-200 transition-colors flex items-center justify-center gap-1.5`}
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
                                        className="flex-1 text-sm bg-[#F6AD55] hover:bg-[#ED8936] text-white py-2 px-3 rounded border border-[#ED8936] transition-colors font-bold flex items-center justify-center gap-1.5 shadow-md"
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
                    <div className="w-16 h-16 bg-[#FEF3E2] rounded-full flex items-center justify-center mx-auto mb-4">
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
                                <div className="w-14 h-14 bg-gradient-to-br from-[#F6AD55] to-[#ED8936] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
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
                const ageInfo = child.birthDate ? calculateAgeWithMonths(child.birthDate) : null;
                const childContracts = contracts.filter(c => c.child_id === child.id && c.status === 'active');

                return (
                  <button
                    key={child.id}
                    onClick={() => handleChildSelect(child.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-[#F6AD55]/50 hover:bg-[#FEF3E2] transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-[#FDEBD0] rounded-full flex items-center justify-center flex-shrink-0">
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
