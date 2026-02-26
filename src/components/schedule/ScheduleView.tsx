/**
 * スケジュールビュー（利用調整・予約）
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarDays, X, Plus, Trash2, Car, Calendar, RotateCcw, Zap, ClipboardList, Settings, AlertTriangle, Inbox, CheckCircle, XCircle } from 'lucide-react';
import { TimeSlot, ScheduleItem, Child, FacilityTimeSlot } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import SlotAssignmentPanel from './SlotAssignmentPanel';
import TransportAssignmentPanel from './TransportAssignmentPanel';
import { isJapaneseHoliday } from '@/utils/japaneseHolidays';

// 利用申請の型
type UsageRequestItem = {
  id: string;
  facility_id: string;
  child_id: string;
  parent_user_id: string;
  request_month: string;
  requested_dates: Array<{ date: string; slot: string; notes: string }>;
  status: string;
  facility_response?: Array<{ date: string; approved: boolean }>;
  facility_notes?: string;
  submitted_at: string;
  responded_at?: string;
  child_name?: string;
  parent_name?: string;
};

const ScheduleView: React.FC = () => {
  const {
    schedules,
    children,
    addSchedule,
    facilitySettings,
    deleteSchedule,
    moveSchedule,
    updateScheduleTransport,
    bulkRegisterFromPatterns,
    resetMonthSchedules,
    getUsageRecordByScheduleId,
    timeSlots,
    loadingTimeSlots,
  } = useFacilityData();

  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  // 利用申請の状態
  const [usageRequests, setUsageRequests] = useState<UsageRequestItem[]>([]);
  const [showUsageRequests, setShowUsageRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // 利用申請をフェッチ
  useEffect(() => {
    const fetchUsageRequests = async () => {
      if (!facilityId) return;

      const { data } = await supabase
        .from('usage_requests')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });

      if (data && data.length > 0) {
        // 児童名と保護者名を取得
        const childIds = [...new Set(data.map((r: any) => r.child_id))];
        const parentIds = [...new Set(data.map((r: any) => r.parent_user_id))];

        const { data: childrenData } = await supabase
          .from('children')
          .select('id, name')
          .in('id', childIds);

        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, last_name, first_name')
          .in('id', parentIds);

        const childMap = new Map((childrenData || []).map((c: any) => [c.id, c.name]));
        const userMap = new Map((usersData || []).map((u: any) => [u.id, u.name || `${u.last_name || ''} ${u.first_name || ''}`.trim()]));

        const enriched: UsageRequestItem[] = data.map((r: any) => ({
          ...r,
          child_name: childMap.get(r.child_id) || '不明',
          parent_name: userMap.get(r.parent_user_id) || '不明',
        }));

        setUsageRequests(enriched);
      } else {
        setUsageRequests([]);
      }
    };

    fetchUsageRequests();
  }, [facilityId]);

  // 申請の一括承認
  const handleApproveAll = async (request: UsageRequestItem) => {
    setProcessingRequestId(request.id);
    try {
      const response = request.requested_dates.map(d => ({ date: d.date, approved: true }));

      // usage_requestsを更新
      await supabase
        .from('usage_requests')
        .update({
          status: 'approved',
          facility_response: response,
          responded_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      // 承認された日程をスケジュールに追加
      for (const dateItem of request.requested_dates) {
        const child = children.find(c => c.id === request.child_id);
        if (!child) continue;

        const slots: TimeSlot[] = dateItem.slot === 'full'
          ? ['AM', 'PM']
          : dateItem.slot === 'am'
          ? ['AM']
          : ['PM'];

        for (const slot of slots) {
          // 重複チェック
          const exists = schedules.some(
            s => s.childId === request.child_id && s.date === dateItem.date && s.slot === slot
          );
          if (!exists) {
            await addSchedule({
              date: dateItem.date,
              childId: child.id,
              childName: child.name,
              slot,
              hasPickup: child.needsPickup || false,
              hasDropoff: child.needsDropoff || false,
            });
          }
        }
      }

      // 一覧から削除
      setUsageRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Error approving request:', err);
      alert('承認処理に失敗しました');
    } finally {
      setProcessingRequestId(null);
    }
  };

  // 申請を却下
  const handleRejectAll = async (request: UsageRequestItem, notes?: string) => {
    setProcessingRequestId(request.id);
    try {
      const response = request.requested_dates.map(d => ({ date: d.date, approved: false }));

      await supabase
        .from('usage_requests')
        .update({
          status: 'rejected',
          facility_response: response,
          facility_notes: notes || '',
          responded_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      setUsageRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('却下処理に失敗しました');
    } finally {
      setProcessingRequestId(null);
    }
  };

  // 利用予約 / 送迎体制 切替タブ
  const [scheduleTab, setScheduleTab] = useState<'reservation' | 'transport'>('reservation');

  const [viewFormat, setViewFormat] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState('');
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<TimeSlot | null>(null);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);

  // スロット割り当てパネル用の状態
  const [isSlotPanelOpen, setIsSlotPanelOpen] = useState(false);
  const [selectedDateForSlotPanel, setSelectedDateForSlotPanel] = useState('');

  // 一括操作用の状態
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // 日別計画モーダル用の状態
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [selectedDateForPlanning, setSelectedDateForPlanning] = useState<string | null>(null);

  // 日別計画モーダルを開く
  const openPlanningModal = (date: string) => {
    setSelectedDateForPlanning(date);
    setIsPlanningModalOpen(true);
  };

  const [newBooking, setNewBooking] = useState({
    childId: '',
    date: '',
    slots: { AM: false, PM: false } as { AM: boolean; PM: boolean },
    pickup: false,
    dropoff: false,
  });

  // 時間枠が設定されているかチェック
  const hasTimeSlots = timeSlots.length > 0;

  // 施設設定から受け入れ人数を取得（リアクティブに更新される）
  // timeSlots（施設設定の時間枠）があればそこから定員を取得、なければデフォルト値
  const capacity = useMemo(() => {
    if (timeSlots.length >= 2) {
      // 時間枠が2つ以上あれば、displayOrder順でAM/PMに対応させる
      const sorted = [...timeSlots].sort((a, b) => a.displayOrder - b.displayOrder);
      return {
        AM: sorted[0]?.capacity || 0,
        PM: sorted[1]?.capacity || 0,
      };
    } else if (timeSlots.length === 1) {
      // 1枠のみの場合
      return {
        AM: timeSlots[0].capacity || 0,
        PM: 0,
      };
    }
    // 未設定の場合はデフォルト（0 = 未設定を示す）
    return facilitySettings.capacity || { AM: 0, PM: 0 };
  }, [timeSlots, facilitySettings.capacity]);

  // 時間枠の名前と時間を取得
  const slotInfo = useMemo(() => {
    if (timeSlots.length >= 2) {
      const sorted = [...timeSlots].sort((a, b) => a.displayOrder - b.displayOrder);
      return {
        AM: {
          name: sorted[0]?.name || '午前',
          startTime: sorted[0]?.startTime || '09:00',
          endTime: sorted[0]?.endTime || '12:00',
        },
        PM: {
          name: sorted[1]?.name || '午後',
          startTime: sorted[1]?.startTime || '13:00',
          endTime: sorted[1]?.endTime || '18:00',
        },
      };
    } else if (timeSlots.length === 1) {
      return {
        AM: {
          name: timeSlots[0].name || '終日',
          startTime: timeSlots[0].startTime || '09:00',
          endTime: timeSlots[0].endTime || '18:00',
        },
        PM: null,
      };
    }
    // デフォルト
    return {
      AM: {
        name: '午前',
        startTime: facilitySettings.businessHours?.AM?.start || '09:00',
        endTime: facilitySettings.businessHours?.AM?.end || '12:00',
      },
      PM: {
        name: '午後',
        startTime: facilitySettings.businessHours?.PM?.start || '13:00',
        endTime: facilitySettings.businessHours?.PM?.end || '18:00',
      },
    };
  }, [timeSlots, facilitySettings.businessHours]);

  // 当月の日付を生成
  const monthDates = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const dates: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // 日付をYYYY-MM-DD形式に変換するヘルパー関数（タイムゾーン問題を回避）
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // 前月の末尾日を追加（カレンダー表示用）
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      dates.push({
        date: formatDate(date),
        day: date.getDate(),
        isCurrentMonth: false,
      });
    }

    // 当月の日付を追加
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      dates.push({
        date: formatDate(date),
        day,
        isCurrentMonth: true,
      });
    }

    // 次月の初めの日を追加（カレンダー表示用）
    const remainingDays = 42 - dates.length; // 6週間分
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      dates.push({
        date: formatDate(date),
        day,
        isCurrentMonth: false,
      });
    }

    return dates;
  }, [currentDate]);

  // 週間カレンダーの日付を生成
  const weekDates = useMemo(() => {
    const baseDate = new Date(currentDate);
    const currentDay = baseDate.getDay();
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - currentDay + 1); // 月曜日を開始日とする

    // 日付をYYYY-MM-DD形式に変換するヘルパー関数（タイムゾーン問題を回避）
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const dates: Array<{ date: string; day: string }> = [];
    const days = ['月', '火', '水', '木', '金', '土', '日'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push({
        date: formatDate(date),
        day: days[i],
      });
    }

    return dates;
  }, [currentDate]);

  // 休業日かどうかを判定
  const isHoliday = useCallback((dateStr: string): boolean => {
    // 日付を正しくパース（ローカルタイムゾーンで解釈）
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    
    // 期間ごとの定休日設定をチェック
    const holidayPeriods = facilitySettings.holidayPeriods || [];
    let matchedPeriod = null;
    
    for (const period of holidayPeriods) {
      if (!period.startDate) continue; // 開始日が設定されていない場合はスキップ
      
      // 日付文字列を直接比較（タイムゾーン問題を回避）
      const startDateStr = period.startDate;
      const endDateStr = period.endDate || '';
      
      // 期間内かどうかをチェック（文字列比較）
      if (dateStr >= startDateStr && (!endDateStr || dateStr <= endDateStr)) {
        matchedPeriod = period;
        break;
      }
    }
    
    // 期間設定がある場合は、その期間の定休日をチェック
    if (matchedPeriod) {
      if (matchedPeriod.regularHolidays.includes(dayOfWeek)) {
        return true;
      }
    } else {
      // 期間設定がない場合は、デフォルトの定休日をチェック
      if (facilitySettings.regularHolidays.includes(dayOfWeek)) {
        return true;
      }
    }
    
    // カスタム休業日チェック
    if (facilitySettings.customHolidays.includes(dateStr)) {
      return true;
    }
    
    // 祝日チェック（設定されている場合）
    if (facilitySettings.includeHolidays && isJapaneseHoliday(dateStr)) {
      return true;
    }
    
    return false;
  }, [facilitySettings.regularHolidays, facilitySettings.holidayPeriods, facilitySettings.customHolidays, facilitySettings.includeHolidays]);

  // 月間カレンダーの統計を計算
  const monthlyStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // 日付をYYYY-MM-DD形式に変換するヘルパー関数（タイムゾーン問題を回避）
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    let totalCapacity = 0;
    let totalUsed = 0;
    const uniqueChildren = new Set<string>();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);
      
      // 休業日は除外
      if (isHoliday(dateStr)) continue;
      
      const amCount = schedules.filter((s) => s.date === dateStr && s.slot === 'AM').length;
      const pmCount = schedules.filter((s) => s.date === dateStr && s.slot === 'PM').length;
      
      // ユニーク利用児童数を集計
      schedules
        .filter((s) => s.date === dateStr)
        .forEach((s) => uniqueChildren.add(s.childId));

      totalCapacity += capacity.AM + capacity.PM;
      totalUsed += amCount + pmCount;
    }

    return {
      totalCapacity,
      totalUsed,
      utilization: totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0,
      uniqueChildrenCount: uniqueChildren.size,
    };
  }, [schedules, currentDate, capacity, isHoliday]);

  // 週間カレンダーの統計を計算
  const weeklyStats = useMemo(() => {
    let totalCapacity = 0;
    let totalUsed = 0;
    const uniqueChildren = new Set<string>();

    weekDates.forEach((d) => {
      // 休業日チェック（isHoliday関数を使用）
      if (isHoliday(d.date)) return;
      
      const amCount = schedules.filter((s) => s.date === d.date && s.slot === 'AM').length;
      const pmCount = schedules.filter((s) => s.date === d.date && s.slot === 'PM').length;
      
      schedules
        .filter((s) => s.date === d.date)
        .forEach((s) => uniqueChildren.add(s.childId));

      totalCapacity += capacity.AM + capacity.PM;
      totalUsed += amCount + pmCount;
    });

    return {
      totalCapacity,
      totalUsed,
      utilization: totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0,
      uniqueChildrenCount: uniqueChildren.size,
    };
  }, [schedules, weekDates, capacity, isHoliday]);

  // 選択された日付と時間帯に基づいて児童をソート（基本利用設定がその曜日のその時間になっている子を優先）
  // 重複を除去してユニークな児童のみを表示
  const sortedChildrenForBooking = useMemo(() => {
    // useFacilityDataから取得したchildrenは既にfilteredChildrenとしてフィルタリングされている
    // 念のため、同じIDの児童は1つだけ残す（重複防止）
    const uniqueChildrenMap = new Map<string, Child>();
    children.forEach(child => {
      if (!uniqueChildrenMap.has(child.id)) {
        uniqueChildrenMap.set(child.id, child);
      }
    });
    const uniqueChildren = Array.from(uniqueChildrenMap.values());
    
    if (!newBooking.date) return uniqueChildren;
    
    const selectedDate = new Date(newBooking.date);
    const dayOfWeek = selectedDate.getDay();
    
    return uniqueChildren.sort((a, b) => {
      // 基本利用設定を確認
      const aHasPattern = a.patternDays?.includes(dayOfWeek) || false;
      const bHasPattern = b.patternDays?.includes(dayOfWeek) || false;
      
      // 時間帯の確認
      const aTimeSlot = a.patternTimeSlots?.[dayOfWeek];
      const bTimeSlot = b.patternTimeSlots?.[dayOfWeek];
      
      const selectedSlot = newBooking.slots.AM ? 'AM' : (newBooking.slots.PM ? 'PM' : null);
      const aMatchesSlot = selectedSlot ? (aTimeSlot === selectedSlot || aTimeSlot === 'AMPM') : false;
      const bMatchesSlot = selectedSlot ? (bTimeSlot === selectedSlot || bTimeSlot === 'AMPM') : false;
      
      // 優先順位: 1. 基本利用設定がある + 時間帯が一致, 2. 基本利用設定がある, 3. その他
      if (aHasPattern && aMatchesSlot && !(bHasPattern && bMatchesSlot)) return -1;
      if (bHasPattern && bMatchesSlot && !(aHasPattern && aMatchesSlot)) return 1;
      if (aHasPattern && !bHasPattern) return -1;
      if (bHasPattern && !aHasPattern) return 1;
      
      // 同じ優先度の場合は名前順
      return a.name.localeCompare(b.name, 'ja');
    });
  }, [children, newBooking.date, newBooking.slots]);

  // 日付をクリックして新しいスロット割り当てパネルを開く
  const handleDateClick = (date: string, slot?: TimeSlot) => {
    // 新しいスロット割り当てパネルを開く
    setSelectedDateForSlotPanel(date);
    setIsSlotPanelOpen(true);
  };

  // 旧モーダルを開く（週間ビュー用など、必要に応じて）
  const handleOpenLegacyModal = (date: string, slot?: TimeSlot) => {
    setSelectedDateForBooking(date);
    setSelectedSlotForBooking(slot || null);
    setNewBooking({
      childId: '',
      date,
      slots: slot ? { AM: slot === 'AM', PM: slot === 'PM' } : { AM: false, PM: false },
      pickup: false,
      dropoff: false,
    });
    setIsModalOpen(true);
  };

  // パターン一括登録
  const handleBulkRegister = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    if (!confirm(`${year}年${month}月の利用パターンに基づいて一括登録します。よろしいですか？`)) {
      return;
    }

    setIsBulkProcessing(true);
    try {
      const result = await bulkRegisterFromPatterns(year, month);
      alert(`一括登録が完了しました。\n追加: ${result.added}件\nスキップ: ${result.skipped}件`);
    } catch (error) {
      console.error('Error in bulk register:', error);
      alert('一括登録に失敗しました。もう一度お試しください。');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // 月次リセット
  const handleMonthReset = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    if (!confirm(`${year}年${month}月の予約をすべて削除します。\n※実績登録済みの予約は除外されます。\n\nよろしいですか？`)) {
      return;
    }

    setIsBulkProcessing(true);
    try {
      const deleted = await resetMonthSchedules(year, month);
      alert(`${deleted}件の予約を削除しました。`);
    } catch (error) {
      console.error('Error in month reset:', error);
      alert('リセットに失敗しました。もう一度お試しください。');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // スロットパネル内でのスケジュールアイテムクリック
  const handleScheduleItemClickFromPanel = (item: ScheduleItem) => {
    setSelectedScheduleItem(item);
  };

  // 予約を追加
  const handleAddBooking = async () => {
    if (!newBooking.childId) {
      alert('児童を選択してください');
      return;
    }
    if (!newBooking.slots.AM && !newBooking.slots.PM) {
      alert('午前または午後のいずれかを選択してください');
      return;
    }
    const child = children.find((c) => c.id === newBooking.childId);
    if (!child) return;

    // 重複チェック：同じ児童が同じ日付・同じ時間帯に既に登録されているか確認
    const existingSchedules = schedules.filter(
      (s) => s.childId === newBooking.childId && s.date === newBooking.date
    );
    
    if (newBooking.slots.AM && existingSchedules.some((s) => s.slot === 'AM')) {
      alert(`${child.name}さんは${newBooking.date}の午前中に既に予約が登録されています。`);
      return;
    }
    if (newBooking.slots.PM && existingSchedules.some((s) => s.slot === 'PM')) {
      alert(`${child.name}さんは${newBooking.date}の午後に既に予約が登録されています。`);
      return;
    }

    try {
      // 選択された時間帯ごとにスケジュールを追加
      if (newBooking.slots.AM) {
        await addSchedule({
          date: newBooking.date,
          childId: child.id,
          childName: child.name,
          slot: 'AM',
          hasPickup: newBooking.pickup,
          hasDropoff: newBooking.dropoff,
        });
      }
      if (newBooking.slots.PM) {
        await addSchedule({
          date: newBooking.date,
          childId: child.id,
          childName: child.name,
          slot: 'PM',
          hasPickup: newBooking.pickup,
          hasDropoff: newBooking.dropoff,
        });
      }

      alert(`${child.name}さんの予約を追加しました`);
      setIsModalOpen(false);
      setNewBooking({
        childId: '',
        date: '',
        slots: { AM: false, PM: false },
        pickup: false,
        dropoff: false,
      });
    } catch (error) {
      console.error('Error adding booking:', error);
      alert('予約の追加に失敗しました。もう一度お試しください。');
    }
  };

  // 登録児童をクリックしたときの処理（予約削除のみ）
  const handleScheduleItemClick = async (item: ScheduleItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // 実績登録済みの場合は削除不可
    const hasUsageRecord = !!getUsageRecordByScheduleId(item.id);
    if (hasUsageRecord) {
      alert('実績登録済みのため削除できません。\n業務日誌から実績を削除してください。');
      return;
    }
    if (confirm(`${item.childName}さんの予約を削除しますか？`)) {
      try {
        await deleteSchedule(item.id);
      } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('予約の削除に失敗しました。もう一度お試しください。');
      }
    }
  };

  // 月を変更
  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // 週を変更
  const changeWeek = (offset: number) => {
    const newDate = new Date(weekDates[0].date);
    newDate.setDate(newDate.getDate() + offset * 7);
    setCurrentDate(newDate);
  };

  return (
    <div className="h-[calc(100vh-100px)] sm:h-[calc(100vh-100px)] animate-in fade-in duration-500">
      {/* タブ切替: 利用予約 / 送迎体制 */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => setScheduleTab('reservation')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all border-b-2 ${
            scheduleTab === 'reservation'
              ? 'text-[#00c4cc] border-[#00c4cc] bg-white'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <CalendarDays className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          利用予約
        </button>
        <button
          onClick={() => setScheduleTab('transport')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all border-b-2 ${
            scheduleTab === 'transport'
              ? 'text-[#00c4cc] border-[#00c4cc] bg-white'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Car className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          送迎体制
        </button>
      </div>

      {/* 送迎体制タブ */}
      {scheduleTab === 'transport' && (
        <div className="h-[calc(100%-44px)] bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden p-4">
          <TransportAssignmentPanel />
        </div>
      )}

      {/* 利用予約タブ (既存コンテンツ) */}
      {scheduleTab === 'reservation' && (
      <>
      {/* Calendar Panel */}
      <div className="h-[calc(100%-44px)] flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-white z-10">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            <div className="flex bg-gray-100 p-1 rounded">
              <button
                onClick={() => setViewFormat('month')}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded transition-all ${
                  viewFormat === 'month'
                    ? 'bg-white text-[#00c4cc] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                月間
              </button>
              <button
                onClick={() => setViewFormat('week')}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded transition-all ${
                  viewFormat === 'week'
                    ? 'bg-white text-[#00c4cc] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                週間
              </button>
            </div>
            {viewFormat === 'month' && (
              <>
                <button
                  onClick={() => changeMonth(-1)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="前月"
                >
                  <CalendarDays className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline text-sm">←</span>
                </button>
                <h3 className="font-bold text-base sm:text-lg text-gray-800 whitespace-nowrap">
                  {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                </h3>
                <button
                  onClick={() => changeMonth(1)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="次月"
                >
                  <span className="text-sm">→</span>
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="ml-2 px-3 py-1.5 text-xs font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors shadow-sm"
                >
                  本日
                </button>
              </>
            )}
            {viewFormat === 'week' && (
              <>
                <button
                  onClick={() => changeWeek(-1)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="前週"
                >
                  <span className="text-sm">←</span>
                </button>
                <h3 className="font-bold text-sm sm:text-lg text-gray-800">
                  {weekDates[0].date.split('-')[1]}月 {weekDates[0].date.split('-')[2]}日 ～ {weekDates[6].date.split('-')[1]}月 {weekDates[6].date.split('-')[2]}日
                </h3>
                <button
                  onClick={() => changeWeek(1)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="次週"
                >
                  <span className="text-sm">→</span>
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="ml-2 px-3 py-1.5 text-xs font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors shadow-sm"
                >
                  本日
                </button>
              </>
            )}
          </div>
          {viewFormat === 'month' && (
            <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
              <div className="bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-gray-100">
                登録数/枠数: <span className="font-bold text-gray-800 text-xs sm:text-sm ml-1">{monthlyStats.totalUsed}/{monthlyStats.totalCapacity}</span>
              </div>
              <div className="bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-gray-100">
                稼働率: <span className="font-bold text-gray-800 text-xs sm:text-sm ml-1">{monthlyStats.utilization}%</span>
              </div>
              <div className="bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-gray-100">
                利用児童数: <span className="font-bold text-gray-800 text-xs sm:text-sm ml-1">{monthlyStats.uniqueChildrenCount}名</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkRegister}
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="w-3.5 h-3.5" />
                  パターン一括登録
                </button>
                <button
                  onClick={handleMonthReset}
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-md text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  月間リセット
                </button>
              </div>
            </div>
          )}
          {viewFormat === 'week' && (
            <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
              <div className="bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-gray-100">
                登録数/枠数: <span className="font-bold text-gray-800 text-xs sm:text-sm ml-1">{weeklyStats.totalUsed}/{weeklyStats.totalCapacity}</span>
              </div>
              <div className="bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-gray-100">
                稼働率: <span className="font-bold text-gray-800 text-xs sm:text-sm ml-1">{weeklyStats.utilization}%</span>
              </div>
              <div className="bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-gray-100">
                利用児童数: <span className="font-bold text-gray-800 text-xs sm:text-sm ml-1">{weeklyStats.uniqueChildrenCount}名</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-white relative p-4">
          {/* 時間枠未設定時のガイダンス */}
          {!loadingTimeSlots && !hasTimeSlots && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md shadow-sm">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  時間枠の設定が必要です
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  利用予約カレンダーを使用するには、<br />
                  まず施設情報で時間枠を設定してください。
                </p>
                <div className="bg-white rounded-lg p-4 border border-amber-100 mb-4">
                  <p className="text-xs text-gray-500 mb-2">設定例:</p>
                  <div className="flex gap-2 justify-center">
                    <span className="bg-[#e0f7fa] text-[#006064] px-3 py-1 rounded text-sm font-medium">午前 9:00-12:00</span>
                    <span className="bg-orange-50 text-orange-900 px-3 py-1 rounded text-sm font-medium">午後 13:00-18:00</span>
                  </div>
                </div>
                <a
                  href="/business?tab=facility"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  施設情報を設定する
                </a>
              </div>
            </div>
          )}

          {/* 読み込み中 */}
          {loadingTimeSlots && (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="animate-spin w-8 h-8 border-4 border-[#00c4cc] border-t-transparent rounded-full"></div>
            </div>
          )}

          {/* カレンダー表示（時間枠設定済みの場合） */}
          {!loadingTimeSlots && hasTimeSlots && viewFormat === 'month' && (
            <div className="w-full">
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                  <div
                    key={i}
                    className={`p-1 text-center text-xs font-bold ${
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              {/* カレンダーグリッド */}
              <div className="grid grid-cols-7 gap-1">
                {monthDates.map((dateInfo, index) => {
                  const isHolidayDay = isHoliday(dateInfo.date);
                  const amCount = schedules.filter(
                    (s) => s.date === dateInfo.date && s.slot === 'AM'
                  ).length;
                  const pmCount = schedules.filter(
                    (s) => s.date === dateInfo.date && s.slot === 'PM'
                  ).length;
                  const amUtilization = capacity.AM > 0 ? Math.round((amCount / capacity.AM) * 100) : 0;
                  const pmUtilization = capacity.PM > 0 ? Math.round((pmCount / capacity.PM) * 100) : 0;
                  
                  // 送迎予定枠の人数を計算
                  const amPickupCount = schedules.filter(
                    (s) => s.date === dateInfo.date && s.slot === 'AM' && s.hasPickup
                  ).length;
                  const amDropoffCount = schedules.filter(
                    (s) => s.date === dateInfo.date && s.slot === 'AM' && s.hasDropoff
                  ).length;
                  const pmPickupCount = schedules.filter(
                    (s) => s.date === dateInfo.date && s.slot === 'PM' && s.hasPickup
                  ).length;
                  const pmDropoffCount = schedules.filter(
                    (s) => s.date === dateInfo.date && s.slot === 'PM' && s.hasDropoff
                  ).length;
                  // 今日の日付をYYYY-MM-DD形式で取得（タイムゾーン問題を回避）
                  const today = new Date();
                  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                  const isToday = dateInfo.date === todayStr;
                  
                  // ユニーク利用児童数
                  const uniqueChildrenForDay = new Set(
                    schedules.filter((s) => s.date === dateInfo.date).map((s) => s.childId)
                  ).size;

                  return (
                    <div
                      key={index}
                      className={`min-h-[85px] sm:min-h-[100px] border rounded-xl p-1.5 transition-all ${
                        isHolidayDay
                          ? 'bg-red-50 border-red-200 cursor-not-allowed opacity-60'
                          : !dateInfo.isCurrentMonth
                          ? 'bg-gray-50 opacity-40 border-gray-200 cursor-pointer hover:bg-gray-100'
                          : amUtilization >= 100 && pmUtilization >= 100
                          ? 'bg-red-50/30 border-red-200 cursor-pointer hover:bg-red-50/50'
                          : (amUtilization >= 80 || pmUtilization >= 80)
                          ? 'bg-amber-50/30 border-amber-200 cursor-pointer hover:bg-amber-50/50'
                          : 'bg-white border-gray-200 cursor-pointer hover:bg-gray-50 hover:shadow-sm'
                      } ${isToday ? 'ring-2 ring-[#00c4cc] shadow-md' : ''}`}
                      onClick={() => !isHolidayDay && handleDateClick(dateInfo.date)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold leading-tight ${
                              isToday
                                ? 'bg-[#00c4cc] text-white'
                                : !dateInfo.isCurrentMonth
                                ? 'text-gray-400'
                                : 'text-gray-700'
                            }`}
                          >
                            {dateInfo.day}
                          </div>
                          {!isHolidayDay && dateInfo.isCurrentMonth && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPlanningModal(dateInfo.date);
                              }}
                              className="p-0.5 text-gray-400 hover:text-[#00c4cc] hover:bg-gray-100 rounded transition-colors"
                              title="日別計画"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!isHolidayDay && uniqueChildrenForDay > 0 && dateInfo.isCurrentMonth && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium leading-tight">
                              {uniqueChildrenForDay}名
                            </span>
                          )}
                          {isHolidayDay && (
                            <span className="text-[10px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-bold leading-tight">
                              休業
                            </span>
                          )}
                        </div>
                      </div>
                      {!isHolidayDay ? (
                        <div className="flex flex-col gap-1 mt-1">
                          {/* 午前（第1枠） */}
                          <div className="bg-[#e0f7fa] rounded px-1.5 py-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-[#006064] text-[10px] sm:text-[11px] leading-tight">{slotInfo.AM.name}</span>
                              <span className="text-[#006064] font-bold text-[10px] sm:text-[11px] leading-tight">
                                {amCount}/{capacity.AM}
                              </span>
                            </div>
                            {(amPickupCount > 0 || amDropoffCount > 0) && (
                              <div className="flex items-center gap-1 mb-1">
                                <Car className="w-3 h-3 text-[#006064]" />
                                <span className="text-[9px] sm:text-[10px] text-[#006064] leading-tight">
                                  送迎: 迎{amPickupCount} 送{amDropoffCount}
                                </span>
                              </div>
                            )}
                            <div className="w-full bg-white/50 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  amUtilization >= 100
                                    ? 'bg-red-500'
                                    : amUtilization >= 80
                                    ? 'bg-orange-400'
                                    : 'bg-[#00c4cc]'
                                }`}
                                style={{ width: `${Math.min(amUtilization, 100)}%` }}
                              />
                            </div>
                          </div>
                          {/* 午後（第2枠） */}
                          {slotInfo.PM && (
                          <div className="bg-orange-50 rounded px-1.5 py-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-orange-900 text-[10px] sm:text-[11px] leading-tight">{slotInfo.PM.name}</span>
                              <span className="text-orange-900 font-bold text-[10px] sm:text-[11px] leading-tight">
                                {pmCount}/{capacity.PM}
                              </span>
                            </div>
                            {(pmPickupCount > 0 || pmDropoffCount > 0) && (
                              <div className="flex items-center gap-1 mb-1">
                                <Car className="w-3 h-3 text-orange-900" />
                                <span className="text-[9px] sm:text-[10px] text-orange-900 leading-tight">
                                  送迎: 迎{pmPickupCount} 送{pmDropoffCount}
                                </span>
                              </div>
                            )}
                            <div className="w-full bg-white/50 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  pmUtilization >= 100
                                    ? 'bg-red-500'
                                    : pmUtilization >= 80
                                    ? 'bg-orange-400'
                                    : 'bg-orange-500'
                                }`}
                                style={{ width: `${Math.min(pmUtilization, 100)}%` }}
                              />
                            </div>
                          </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-red-600 text-center mt-2 leading-tight">
                          休業日
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loadingTimeSlots && hasTimeSlots && viewFormat === 'week' && (
            <div className="min-w-[700px] overflow-x-auto">
              <div className="flex border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
                <div className="w-16 sm:w-20 p-2 shrink-0 border-r border-gray-200 text-xs sm:text-sm text-center font-bold text-gray-500 flex items-center justify-center">
                  区分
                </div>
                {weekDates.map((d, i) => {
                  const isHolidayDay = isHoliday(d.date);
                  return (
                    <div
                      key={i}
                      className={`flex-1 p-2 text-center border-r border-gray-200 text-xs sm:text-sm font-bold ${
                        isHolidayDay
                          ? 'text-red-600 bg-red-50'
                          : i >= 5
                          ? 'text-red-500'
                          : 'text-gray-700'
                      }`}
                    >
                      <div className="leading-tight">{d.date.split('-')[2]} ({d.day})</div>
                      {isHolidayDay && (
                        <div className="text-[10px] sm:text-xs text-red-600 mt-0.5 leading-tight">休業</div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* AM Row */}
              <div className="flex border-b border-gray-200 min-h-[120px]">
                <div className="w-16 sm:w-20 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                  <div className="text-xs sm:text-sm font-bold text-gray-600">{slotInfo.AM.name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 mt-1 leading-tight">定員{capacity.AM}</div>
                </div>
                {weekDates.map((d, i) => {
                  const items = schedules.filter((s) => s.date === d.date && s.slot === 'AM');
                  const isHolidayDay = isHoliday(d.date);
                  return (
                    <div
                      key={i}
                      className={`flex-1 p-1 border-r border-gray-100 transition-colors ${
                        isHolidayDay
                          ? 'bg-red-50 cursor-not-allowed opacity-60'
                          : 'bg-white hover:bg-gray-50 cursor-pointer'
                      }`}
                      onClick={() => !isHolidayDay && handleDateClick(d.date, 'AM')}
                    >
                      {isHolidayDay ? (
                        <div className="text-[11px] sm:text-xs text-red-600 text-center mt-2 leading-tight">休業</div>
                      ) : (
                        items.map((item) => {
                          const hasRecord = getUsageRecordByScheduleId(item.id) !== undefined;
                          return (
                            <div
                              key={item.id}
                              className={`mb-1 border rounded px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shadow-sm group relative transition-colors cursor-pointer ${
                                hasRecord
                                  ? 'bg-green-50 border-green-200 text-green-900 hover:border-green-300'
                                  : 'bg-[#e0f7fa] border-[#b2ebf2] text-[#006064] hover:border-[#00c4cc]'
                              }`}
                              onClick={(e) => handleScheduleItemClick(item, e)}
                            >
                              <div className="font-bold truncate text-xs sm:text-sm leading-tight">{item.childName}</div>
                              {hasRecord && (
                                <div className="text-[10px] sm:text-xs text-green-700 mt-0.5 leading-tight">実績登録済</div>
                              )}
                              <div className="flex gap-1 mt-1">
                                {item.hasPickup && (
                                  <span className={`px-1 rounded-[2px] text-[10px] sm:text-xs font-bold border leading-tight ${
                                    hasRecord
                                      ? 'bg-white/80 text-green-700 border-green-200'
                                      : 'bg-white/80 text-[#006064] border-[#b2ebf2]'
                                  }`}>
                                    迎
                                  </span>
                                )}
                                {item.hasDropoff && (
                                  <span className={`px-1 rounded-[2px] text-[10px] sm:text-xs font-bold border leading-tight ${
                                    hasRecord
                                      ? 'bg-white/80 text-green-700 border-green-200'
                                      : 'bg-white/80 text-[#006064] border-[#b2ebf2]'
                                  }`}>
                                    送
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
              {/* PM Row */}
              {slotInfo.PM && (
              <div className="flex min-h-[200px]">
                <div className="w-16 sm:w-20 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                  <div className="text-xs sm:text-sm font-bold text-gray-600">{slotInfo.PM.name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 mt-1 leading-tight">定員{capacity.PM}</div>
                </div>
                {weekDates.map((d, i) => {
                  const items = schedules.filter((s) => s.date === d.date && s.slot === 'PM');
                  const isHolidayDay = isHoliday(d.date);
                  return (
                    <div
                      key={i}
                      className={`flex-1 p-1 border-r border-gray-100 transition-colors ${
                        isHolidayDay
                          ? 'bg-red-50 cursor-not-allowed opacity-60'
                          : 'bg-white hover:bg-gray-50 cursor-pointer'
                      }`}
                      onClick={() => !isHolidayDay && handleDateClick(d.date, 'PM')}
                    >
                      {isHolidayDay ? (
                        <div className="text-[11px] sm:text-xs text-red-600 text-center mt-2 leading-tight">休業</div>
                      ) : (
                        items.map((item) => {
                          const hasRecord = getUsageRecordByScheduleId(item.id) !== undefined;
                          return (
                            <div
                              key={item.id}
                              className={`mb-1 border rounded px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm shadow-sm group relative transition-colors cursor-pointer ${
                                hasRecord
                                  ? 'bg-green-50 border-green-200 text-green-900 hover:border-green-300'
                                  : 'bg-orange-50 border-orange-100 text-orange-900 hover:border-orange-300'
                              }`}
                              onClick={(e) => handleScheduleItemClick(item, e)}
                            >
                              <div className="font-bold truncate text-xs sm:text-sm leading-tight">{item.childName}</div>
                              {hasRecord && (
                                <div className="text-[10px] sm:text-xs text-green-700 mt-0.5 leading-tight">実績登録済</div>
                              )}
                              <div className="flex gap-1 mt-1">
                                {item.hasPickup && (
                                  <span className={`px-1 rounded-[2px] text-[10px] sm:text-xs font-bold border leading-tight ${
                                    hasRecord
                                      ? 'bg-white/80 text-green-700 border-green-200'
                                      : 'bg-white/80 text-orange-600 border-orange-100'
                                  }`}>
                                    迎
                                  </span>
                                )}
                                {item.hasDropoff && (
                                  <span className={`px-1 rounded-[2px] text-[10px] sm:text-xs font-bold border leading-tight ${
                                    hasRecord
                                      ? 'bg-white/80 text-green-700 border-green-200'
                                      : 'bg-white/80 text-orange-600 border-orange-100'
                                  }`}>
                                    送
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 予約追加モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm max-h-[80vh] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-bold text-base text-gray-800 flex items-center">
                <Plus size={18} className="mr-2 text-[#00c4cc]" />
                利用予定を追加
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">児童を選択</label>
                <select
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] transition-all"
                  value={newBooking.childId}
                  onChange={(e) => {
                    const selectedChildId = e.target.value;
                    const selectedChild = children.find(c => c.id === selectedChildId);
                    
                    // 児童の送迎情報を自動入力
                    setNewBooking({
                      ...newBooking,
                      childId: selectedChildId,
                      pickup: selectedChild?.needsPickup || false,
                      dropoff: selectedChild?.needsDropoff || false,
                    });
                  }}
                >
                  <option value="">選択してください</option>
                  {sortedChildrenForBooking.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-gray-400 mt-1 text-right">
                  ※児童管理マスタより参照
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">利用日</label>
                <input
                  type="date"
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={newBooking.date}
                  onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">時間帯</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer group p-2 rounded-md border border-gray-200 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={newBooking.slots.AM}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          slots: { ...newBooking.slots, AM: e.target.checked },
                        })
                      }
                      className="accent-[#00c4cc] w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
                        {slotInfo.AM.name}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {slotInfo.AM.startTime} ～ {slotInfo.AM.endTime}
                      </p>
                    </div>
                  </label>
                  {slotInfo.PM && (
                  <label className="flex items-center space-x-3 cursor-pointer group p-2 rounded-md border border-gray-200 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={newBooking.slots.PM}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          slots: { ...newBooking.slots, PM: e.target.checked },
                        })
                      }
                      className="accent-[#00c4cc] w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
                        {slotInfo.PM.name}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {slotInfo.PM.startTime} ～ {slotInfo.PM.endTime}
                      </p>
                    </div>
                  </label>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                <label className="text-xs font-bold text-gray-500 block">送迎オプション</label>
                {(() => {
                  const selectedChild = children.find(c => c.id === newBooking.childId);
                  const pickupLocation = selectedChild?.pickupLocation === 'その他'
                    ? selectedChild?.pickupLocationCustom
                    : selectedChild?.pickupLocation || '未設定';
                  const dropoffLocation = selectedChild?.dropoffLocation === 'その他'
                    ? selectedChild?.dropoffLocationCustom
                    : selectedChild?.dropoffLocation || '未設定';

                  return (
                    <div className="flex gap-3">
                      <label className="flex-1 flex items-center gap-2 cursor-pointer group p-2 rounded border border-gray-200 hover:bg-white">
                        <input
                          type="checkbox"
                          checked={newBooking.pickup}
                          onChange={(e) => setNewBooking({ ...newBooking, pickup: e.target.checked })}
                          className="accent-[#00c4cc] w-4 h-4"
                        />
                        <div>
                          <span className="text-sm text-gray-700 font-medium">お迎え</span>
                          {selectedChild && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[100px]">{pickupLocation}</p>
                          )}
                        </div>
                      </label>
                      <label className="flex-1 flex items-center gap-2 cursor-pointer group p-2 rounded border border-gray-200 hover:bg-white">
                        <input
                          type="checkbox"
                          checked={newBooking.dropoff}
                          onChange={(e) => setNewBooking({ ...newBooking, dropoff: e.target.checked })}
                          className="accent-[#00c4cc] w-4 h-4"
                        />
                        <div>
                          <span className="text-sm text-gray-700 font-medium">お送り</span>
                          {selectedChild && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[100px]">{dropoffLocation}</p>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex gap-2 flex-shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-sm transition-colors border border-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddBooking}
                className="flex-1 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-lg text-sm transition-all"
              >
                登録する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新しいスロット割り当てパネル */}
      {isSlotPanelOpen && selectedDateForSlotPanel && (
        <SlotAssignmentPanel
          date={selectedDateForSlotPanel}
          schedules={schedules}
          childList={children}
          capacity={capacity}
          slotInfo={slotInfo}
          transportCapacity={facilitySettings.transportCapacity || { pickup: 4, dropoff: 4 }}
          onClose={() => {
            setIsSlotPanelOpen(false);
            setSelectedDateForSlotPanel('');
          }}
          onAddSchedule={async (data) => {
            await addSchedule({
              date: data.date,
              childId: data.childId,
              childName: data.childName,
              slot: data.slot,
              hasPickup: data.hasPickup,
              hasDropoff: data.hasDropoff,
            });
          }}
          onDeleteSchedule={deleteSchedule}
          onMoveSchedule={moveSchedule}
          onUpdateTransport={updateScheduleTransport}
          getUsageRecordByScheduleId={getUsageRecordByScheduleId}
          onScheduleItemClick={handleScheduleItemClickFromPanel}
        />
      )}

      {/* 利用申請パネル */}
      {usageRequests.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40">
          {!showUsageRequests ? (
            <button
              onClick={() => setShowUsageRequests(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 font-bold text-sm transition-all hover:shadow-xl"
            >
              <Inbox className="w-5 h-5" />
              利用申請 {usageRequests.length}件
            </button>
          ) : (
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[420px] max-h-[70vh] flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-between flex-shrink-0">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Inbox className="w-5 h-5" />
                  利用申請 ({usageRequests.length}件)
                </h3>
                <button
                  onClick={() => setShowUsageRequests(false)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {usageRequests.map(request => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {request.child_name}さん
                        </p>
                        <p className="text-xs text-gray-500">
                          保護者: {request.parent_name} / {request.request_month}
                        </p>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">
                        申請中
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {request.requested_dates.map((d, idx) => (
                        <span key={idx} className="text-[10px] bg-white border border-gray-200 rounded px-2 py-0.5">
                          {d.date.split('-')[1]}/{d.date.split('-')[2]}
                          ({d.slot === 'am' ? '午前' : d.slot === 'pm' ? '午後' : '終日'})
                          {d.notes && ` - ${d.notes}`}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveAll(request)}
                        disabled={processingRequestId === request.id}
                        className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        一括承認
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt('却下理由（任意）:');
                          if (notes !== null) {
                            handleRejectAll(request, notes);
                          }
                        }}
                        disabled={processingRequestId === request.id}
                        className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        却下
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 一括処理中オーバーレイ */}
      {isBulkProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg px-8 py-6 shadow-xl">
            <div className="animate-spin w-8 h-8 border-3 border-[#00c4cc] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-700 font-bold">処理中...</p>
          </div>
        </div>
      )}

      </>
      )}
    </div>
  );
};

export default ScheduleView;

