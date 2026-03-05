/**
 * スケジュールビュー（利用調整・予約）
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarDays, X, Plus, Trash2, Car, Calendar, RotateCcw, Zap, ClipboardList, Settings, AlertTriangle, Inbox, CheckCircle, XCircle } from 'lucide-react';
import { TimeSlot, ScheduleItem, Child } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import SlotAssignmentPanel from './SlotAssignmentPanel';
import TransportAssignmentPanel from './TransportAssignmentPanel';
import { useToast } from '@/components/ui/Toast';
import ConfirmModal from '@/components/common/ConfirmModal';
import { isJapaneseHoliday } from '@/utils/japaneseHolidays';
import { resolveTimeSlots, slotDisplayName, expandSlotKeys } from '@/utils/slotResolver';

// スロット表示用カラーパレット（displayOrder順に割り当て）
const SLOT_COLORS = [
  { bg: 'bg-[#e0f7fa]', text: 'text-[#006064]', border: 'border-[#b2ebf2]', bar: 'bg-primary', barBg: 'bg-white/50' },
  { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-100', bar: 'bg-orange-500', barBg: 'bg-white/50' },
  { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-100', bar: 'bg-purple-500', barBg: 'bg-white/50' },
  { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-100', bar: 'bg-emerald-500', barBg: 'bg-white/50' },
  { bg: 'bg-rose-50', text: 'text-rose-900', border: 'border-rose-100', bar: 'bg-rose-500', barBg: 'bg-white/50' },
];

function getSlotColor(index: number) {
  return SLOT_COLORS[index % SLOT_COLORS.length];
}

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
  const { toast } = useToast();
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
      const requestedDates = request.requested_dates || [];
      const response = requestedDates.map(d => ({ date: d.date, approved: true }));

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
      for (const dateItem of requestedDates) {
        const child = children.find(c => c.id === request.child_id);
        if (!child) continue;

        // 'full'/'終日' → 全スロット展開、'am'/'pm' → レガシーマッピング、それ以外 → そのまま
        const slotValue = dateItem.slot === 'full' ? '終日'
          : dateItem.slot === 'am' ? (resolvedSlots[0]?.key || 'AM')
          : dateItem.slot === 'pm' ? (resolvedSlots[1]?.key || resolvedSlots[0]?.key || 'PM')
          : dateItem.slot;
        const slots: TimeSlot[] = expandSlotKeys(resolvedSlots, slotValue);

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
      toast.error('承認処理に失敗しました');
    } finally {
      setProcessingRequestId(null);
    }
  };

  // 申請を却下
  const handleRejectAll = async (request: UsageRequestItem, notes?: string) => {
    setProcessingRequestId(request.id);
    try {
      const response = (request.requested_dates || []).map(d => ({ date: d.date, approved: false }));

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
      toast.error('却下処理に失敗しました');
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

  // 確認ダイアログ用の状態
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // 日別計画モーダル用の状態
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [selectedDateForPlanning, setSelectedDateForPlanning] = useState<string | null>(null);

  // 日別計画モーダルを開く
  const openPlanningModal = (date: string) => {
    setSelectedDateForPlanning(date);
    setIsPlanningModalOpen(true);
  };

  const [newBooking, setNewBooking] = useState<{
    childId: string;
    date: string;
    slots: Record<string, boolean>;
    pickup: boolean;
    dropoff: boolean;
  }>({
    childId: '',
    date: '',
    slots: {},
    pickup: false,
    dropoff: false,
  });

  // 施設設定から動的時間枠を解決（デフォルトAM/PMフォールバックあり）
  const resolvedSlots = useMemo(
    () => resolveTimeSlots(timeSlots, facilitySettings),
    [timeSlots, facilitySettings]
  );

  // 時間枠が利用可能か（resolvedSlotsはデフォルトAM/PMを常に返すのでDB未設定でも動作する）
  const hasTimeSlots = resolvedSlots.length > 0;

  // SlotAssignmentPanel用のレガシー形式 slotInfo / legacyCapacity を構築
  const slotInfo = useMemo(() => {
    const am = resolvedSlots[0];
    const pm = resolvedSlots.length >= 2 ? resolvedSlots[1] : null;
    return {
      AM: am
        ? { name: am.name, startTime: am.startTime, endTime: am.endTime }
        : { name: '午前', startTime: '09:00', endTime: '12:00' },
      PM: pm ? { name: pm.name, startTime: pm.startTime, endTime: pm.endTime } : null,
    };
  }, [resolvedSlots]);

  const legacyCapacity = useMemo(() => {
    const am = resolvedSlots[0];
    const pm = resolvedSlots.length >= 2 ? resolvedSlots[1] : null;
    return { AM: am?.capacity ?? 0, PM: pm?.capacity ?? 0 };
  }, [resolvedSlots]);

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
    const offset = currentDay === 0 ? -6 : 1 - currentDay;
    startOfWeek.setDate(baseDate.getDate() + offset); // 月曜日を開始日とする

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
      if (matchedPeriod.regularHolidays?.includes(dayOfWeek)) {
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
      
      // ユニーク利用児童数を集計
      schedules
        .filter((s) => s.date === dateStr)
        .forEach((s) => uniqueChildren.add(s.childId));

      // 各スロットの利用数と定員を動的に集計
      for (const slot of resolvedSlots) {
        const slotCount = schedules.filter((s) => s.date === dateStr && s.slot === slot.key).length;
        totalCapacity += slot.capacity;
        totalUsed += slotCount;
      }
    }

    return {
      totalCapacity,
      totalUsed,
      utilization: totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0,
      uniqueChildrenCount: uniqueChildren.size,
    };
  }, [schedules, currentDate, resolvedSlots, isHoliday]);

  // 週間カレンダーの統計を計算
  const weeklyStats = useMemo(() => {
    let totalCapacity = 0;
    let totalUsed = 0;
    const uniqueChildren = new Set<string>();

    weekDates.forEach((d) => {
      // 休業日チェック（isHoliday関数を使用）
      if (isHoliday(d.date)) return;
      
      schedules
        .filter((s) => s.date === d.date)
        .forEach((s) => uniqueChildren.add(s.childId));

      for (const slot of resolvedSlots) {
        const slotCount = schedules.filter((s) => s.date === d.date && s.slot === slot.key).length;
        totalCapacity += slot.capacity;
        totalUsed += slotCount;
      }
    });

    return {
      totalCapacity,
      totalUsed,
      utilization: totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0,
      uniqueChildrenCount: uniqueChildren.size,
    };
  }, [schedules, weekDates, resolvedSlots, isHoliday]);

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
      
      // 選択されている最初のスロットキーを取得
      const selectedSlot = resolvedSlots.find(s => newBooking.slots[s.key])?.key || null;
      const aMatchesSlot = selectedSlot ? (aTimeSlot === selectedSlot || aTimeSlot === 'AMPM' || aTimeSlot === '終日') : false;
      const bMatchesSlot = selectedSlot ? (bTimeSlot === selectedSlot || bTimeSlot === 'AMPM' || bTimeSlot === '終日') : false;
      
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
    const initialSlots: Record<string, boolean> = {};
    for (const s of resolvedSlots) {
      initialSlots[s.key] = slot ? s.key === slot : false;
    }
    setNewBooking({
      childId: '',
      date,
      slots: initialSlots,
      pickup: false,
      dropoff: false,
    });
    setIsModalOpen(true);
  };

  // パターン一括登録
  const handleBulkRegister = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    setConfirmModal({
      isOpen: true,
      title: '一括登録の確認',
      message: `${year}年${month}月の利用パターンに基づいて一括登録します。よろしいですか？`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsBulkProcessing(true);
        try {
          const result = await bulkRegisterFromPatterns(year, month);
          toast.success(`一括登録が完了しました。\n追加: ${result.added}件\nスキップ: ${result.skipped}件`);
        } catch (error) {
          console.error('Error in bulk register:', error);
          toast.error('一括登録に失敗しました。もう一度お試しください。');
        } finally {
          setIsBulkProcessing(false);
        }
      },
    });
  };

  // 月次リセット
  const handleMonthReset = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    setConfirmModal({
      isOpen: true,
      title: '月次予約リセット',
      message: `${year}年${month}月の予約をすべて削除します。\n※実績登録済みの予約は除外されます。\n\nよろしいですか？`,
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsBulkProcessing(true);
        try {
          const deleted = await resetMonthSchedules(year, month);
          toast.success(`${deleted}件の予約を削除しました。`);
        } catch (error) {
          console.error('Error in month reset:', error);
          toast.error('リセットに失敗しました。もう一度お試しください。');
        } finally {
          setIsBulkProcessing(false);
        }
      },
    });
  };

  // スロットパネル内でのスケジュールアイテムクリック
  const handleScheduleItemClickFromPanel = (item: ScheduleItem) => {
    setSelectedScheduleItem(item);
  };

  // 予約を追加
  const handleAddBooking = async () => {
    if (!newBooking.childId) {
      toast.warning('児童を選択してください');
      return;
    }
    const selectedSlotKeys = resolvedSlots.filter(s => newBooking.slots[s.key]).map(s => s.key);
    if (selectedSlotKeys.length === 0) {
      toast.warning('時間帯を選択してください');
      return;
    }
    const child = children.find((c) => c.id === newBooking.childId);
    if (!child) return;

    // 重複チェック：同じ児童が同じ日付・同じ時間帯に既に登録されているか確認
    const existingSchedules = schedules.filter(
      (s) => s.childId === newBooking.childId && s.date === newBooking.date
    );

    for (const slotKey of selectedSlotKeys) {
      if (existingSchedules.some((s) => s.slot === slotKey)) {
        const name = slotDisplayName(resolvedSlots, slotKey);
        toast.warning(`${child.name}さんは${newBooking.date}の${name}に既に予約が登録されています。`);
        return;
      }
    }

    try {
      // 選択された時間帯ごとにスケジュールを追加
      for (const slotKey of selectedSlotKeys) {
        await addSchedule({
          date: newBooking.date,
          childId: child.id,
          childName: child.name,
          slot: slotKey,
          hasPickup: newBooking.pickup,
          hasDropoff: newBooking.dropoff,
        });
      }

      toast.success(`${child.name}さんの予約を追加しました`);
      setIsModalOpen(false);
      const resetSlots: Record<string, boolean> = {};
      for (const s of resolvedSlots) resetSlots[s.key] = false;
      setNewBooking({
        childId: '',
        date: '',
        slots: resetSlots,
        pickup: false,
        dropoff: false,
      });
    } catch (error) {
      console.error('Error adding booking:', error);
      toast.error('予約の追加に失敗しました。もう一度お試しください。');
    }
  };

  // 登録児童をクリックしたときの処理（予約削除のみ）
  const handleScheduleItemClick = async (item: ScheduleItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // 実績登録済みの場合は削除不可
    const hasUsageRecord = !!getUsageRecordByScheduleId(item.id);
    if (hasUsageRecord) {
      toast.warning('実績登録済みのため削除できません。\n業務日誌から実績を削除してください。');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: '予約の削除',
      message: `${item.childName}さんの予約を削除しますか？`,
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteSchedule(item.id);
        } catch (error) {
          console.error('Error deleting schedule:', error);
          toast.error('予約の削除に失敗しました。もう一度お試しください。');
        }
      },
    });
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
              ? 'text-primary border-primary bg-white'
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
              ? 'text-primary border-primary bg-white'
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
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                月間
              </button>
              <button
                onClick={() => setViewFormat('week')}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded transition-all ${
                  viewFormat === 'week'
                    ? 'bg-white text-primary shadow-sm'
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
                  className="ml-2 px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm"
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
                  className="ml-2 px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm"
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
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-md text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
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

                  // 各スロットの利用数・送迎数を動的に計算
                  const slotStats = resolvedSlots.map((slot, si) => {
                    const count = schedules.filter(
                      (s) => s.date === dateInfo.date && s.slot === slot.key
                    ).length;
                    const cap = slot.capacity;
                    const utilization = cap > 0 ? Math.round((count / cap) * 100) : 0;
                    const pickupCount = schedules.filter(
                      (s) => s.date === dateInfo.date && s.slot === slot.key && s.hasPickup
                    ).length;
                    const dropoffCount = schedules.filter(
                      (s) => s.date === dateInfo.date && s.slot === slot.key && s.hasDropoff
                    ).length;
                    return { slot, count, cap, utilization, pickupCount, dropoffCount, colorIndex: si };
                  });

                  const allFull = slotStats.every(s => s.utilization >= 100);
                  const anyHigh = slotStats.some(s => s.utilization >= 80);

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
                          : allFull
                          ? 'bg-red-50/30 border-red-200 cursor-pointer hover:bg-red-50/50'
                          : anyHigh
                          ? 'bg-amber-50/30 border-amber-200 cursor-pointer hover:bg-amber-50/50'
                          : 'bg-white border-gray-200 cursor-pointer hover:bg-gray-50 hover:shadow-sm'
                      } ${isToday ? 'ring-2 ring-primary shadow-md' : ''}`}
                      onClick={() => !isHolidayDay && handleDateClick(dateInfo.date)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold leading-tight ${
                              isToday
                                ? 'bg-primary text-white'
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
                              className="p-0.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
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
                          {slotStats.map(({ slot, count, cap, utilization, pickupCount, dropoffCount, colorIndex }) => {
                            const color = getSlotColor(colorIndex);
                            return (
                              <div key={slot.key} className={`${color.bg} rounded px-1.5 py-1`}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`font-bold ${color.text} text-[10px] sm:text-[11px] leading-tight`}>{slot.name}</span>
                                  <span className={`${color.text} font-bold text-[10px] sm:text-[11px] leading-tight`}>
                                    {count}/{cap}
                                  </span>
                                </div>
                                {(pickupCount > 0 || dropoffCount > 0) && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <Car className={`w-3 h-3 ${color.text}`} />
                                    <span className={`text-[9px] sm:text-[10px] ${color.text} leading-tight`}>
                                      送迎: 迎{pickupCount} 送{dropoffCount}
                                    </span>
                                  </div>
                                )}
                                <div className={`w-full ${color.barBg} rounded-full h-1`}>
                                  <div
                                    className={`h-1 rounded-full ${
                                      utilization >= 100
                                        ? 'bg-red-500'
                                        : utilization >= 80
                                        ? 'bg-orange-400'
                                        : color.bar
                                    }`}
                                    style={{ width: `${Math.min(utilization, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
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
              {/* Dynamic slot rows */}
              {resolvedSlots.map((slot, si) => {
                const color = getSlotColor(si);
                const isLastRow = si === resolvedSlots.length - 1;
                return (
                  <div key={slot.key} className={`flex ${isLastRow ? 'min-h-[200px]' : 'border-b border-gray-200 min-h-[120px]'}`}>
                    <div className="w-16 sm:w-20 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                      <div className="text-xs sm:text-sm font-bold text-gray-600">{slot.name}</div>
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-1 leading-tight">定員{slot.capacity}</div>
                    </div>
                    {weekDates.map((d, i) => {
                      const items = schedules.filter((s) => s.date === d.date && s.slot === slot.key);
                      const isHolidayDay = isHoliday(d.date);
                      return (
                        <div
                          key={i}
                          className={`flex-1 p-1 border-r border-gray-100 transition-colors ${
                            isHolidayDay
                              ? 'bg-red-50 cursor-not-allowed opacity-60'
                              : 'bg-white hover:bg-gray-50 cursor-pointer'
                          }`}
                          onClick={() => !isHolidayDay && handleDateClick(d.date, slot.key)}
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
                                      : `${color.bg} ${color.border} ${color.text} hover:border-gray-400`
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
                                          : `bg-white/80 ${color.text} ${color.border}`
                                      }`}>
                                        迎
                                      </span>
                                    )}
                                    {item.hasDropoff && (
                                      <span className={`px-1 rounded-[2px] text-[10px] sm:text-xs font-bold border leading-tight ${
                                        hasRecord
                                          ? 'bg-white/80 text-green-700 border-green-200'
                                          : `bg-white/80 ${color.text} ${color.border}`
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
                );
              })}
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
                <Plus size={18} className="mr-2 text-primary" />
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
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
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
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-primary"
                  value={newBooking.date}
                  onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">時間帯</label>
                <div className="space-y-2">
                  {resolvedSlots.map((slot) => (
                    <label key={slot.key} className="flex items-center space-x-3 cursor-pointer group p-2 rounded-md border border-gray-200 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={!!newBooking.slots[slot.key]}
                        onChange={(e) =>
                          setNewBooking({
                            ...newBooking,
                            slots: { ...newBooking.slots, [slot.key]: e.target.checked },
                          })
                        }
                        className="accent-primary w-4 h-4"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
                          {slot.name}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {slot.startTime} ～ {slot.endTime}
                        </p>
                      </div>
                    </label>
                  ))}
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
                          className="accent-primary w-4 h-4"
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
                          className="accent-primary w-4 h-4"
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
                className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm transition-all"
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
          capacity={legacyCapacity}
          slotInfo={slotInfo}
          resolvedSlots={resolvedSlots}
          transportCapacity={facilitySettings.transportCapacity || { pickup: 4, dropoff: 4 }}
          transportVehicles={facilitySettings.transportVehicles || []}
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
              pickupMethod: data.pickupMethod,
              dropoffMethod: data.dropoffMethod,
            });
          }}
          onDeleteSchedule={deleteSchedule}
          onMoveSchedule={moveSchedule}
          onUpdateTransport={updateScheduleTransport}
          getUsageRecordByScheduleId={getUsageRecordByScheduleId}
          onScheduleItemClick={handleScheduleItemClickFromPanel}
          onBulkRegisterDay={async (dayDate: string) => {
            const [y, m, d] = dayDate.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayOfWeek = dateObj.getDay();
            const existingIds = new Set(
              schedules.filter(s => s.date === dayDate).map(s => `${s.childId}-${s.slot}`)
            );
            let added = 0;
            let skipped = 0;
            for (const child of children) {
              if (!child.patternDays?.includes(dayOfWeek)) continue;
              const timeSlot = child.patternTimeSlots?.[dayOfWeek];
              if (!timeSlot) continue;
              const slotsToAdd: TimeSlot[] = expandSlotKeys(resolvedSlots, timeSlot);
              const tp = child.transportPattern?.[dayOfWeek];
              for (const slot of slotsToAdd) {
                const key = `${child.id}-${slot}`;
                if (existingIds.has(key)) { skipped++; continue; }
                try {
                  await addSchedule({
                    date: dayDate,
                    childId: child.id,
                    childName: child.name,
                    slot,
                    hasPickup: child.needsPickup || !!tp?.pickup,
                    hasDropoff: child.needsDropoff || !!tp?.dropoff,
                    pickupMethod: tp?.pickup || null,
                    dropoffMethod: tp?.dropoff || null,
                  });
                  existingIds.add(key);
                  added++;
                } catch { skipped++; }
              }
            }
            return { added, skipped };
          }}
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
                      {(request.requested_dates || []).map((d, idx) => (
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg px-8 py-6 shadow-xl">
            <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-700 font-bold">処理中...</p>
          </div>
        </div>
      )}

      </>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ScheduleView;

