/**
 * スケジュールビュー（利用調整・予約）
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { CalendarDays, X, Plus, Trash2, Car, Calendar, RotateCcw, Zap, ClipboardList } from 'lucide-react';
import { TimeSlot, ScheduleItem, Child } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import SlotAssignmentPanel from './SlotAssignmentPanel';
import { isJapaneseHoliday } from '@/utils/japaneseHolidays';
import DailyProgramPlanningView from '@/components/planning/DailyProgramPlanningView';

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
  } = useFacilityData();

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

  // 施設設定から受け入れ人数を取得（リアクティブに更新される）
  // facilitySettingsが更新されると自動的に再計算される
  const capacity = useMemo(() => facilitySettings.capacity, [facilitySettings]);

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
      {/* Calendar Panel */}
      <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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
                  className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm sm:text-base"
                >
                  ←
                </button>
                <h3 className="font-bold text-base sm:text-lg text-gray-800 whitespace-nowrap">
                  {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                </h3>
                <button
                  onClick={() => changeMonth(1)}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm sm:text-base"
                >
                  →
                </button>
              </>
            )}
            {viewFormat === 'week' && (
              <>
                <button
                  onClick={() => changeWeek(-1)}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm sm:text-base"
                >
                  ←
                </button>
                <h3 className="font-bold text-sm sm:text-lg text-gray-800">
                  {weekDates[0].date.split('-')[1]}月 {weekDates[0].date.split('-')[2]}日 ～ {weekDates[6].date.split('-')[1]}月 {weekDates[6].date.split('-')[2]}日
                </h3>
                <button
                  onClick={() => changeWeek(1)}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm sm:text-base"
                >
                  →
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
          {viewFormat === 'month' && (
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
                      className={`min-h-[85px] sm:min-h-[100px] border rounded-lg p-1.5 transition-colors ${
                        isHolidayDay
                          ? 'bg-red-50 border-red-200 cursor-not-allowed opacity-60'
                          : !dateInfo.isCurrentMonth
                          ? 'bg-gray-50 opacity-50 border-gray-200 cursor-pointer hover:bg-gray-100'
                          : 'bg-white border-gray-200 cursor-pointer hover:bg-gray-50'
                      } ${isToday ? 'ring-2 ring-[#00c4cc]' : ''}`}
                      onClick={() => !isHolidayDay && handleDateClick(dateInfo.date)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1">
                          <div
                            className={`text-sm font-bold leading-tight ${
                              !dateInfo.isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
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
                        {isHolidayDay && (
                          <span className="text-[10px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-bold leading-tight">
                            休業
                          </span>
                        )}
                      </div>
                      {!isHolidayDay ? (
                        <div className="flex flex-col gap-1 mt-1">
                          {/* 午前 */}
                          <div className="bg-[#e0f7fa] rounded px-1.5 py-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-[#006064] text-[10px] sm:text-[11px] leading-tight">午前</span>
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
                          {/* 午後 */}
                          <div className="bg-orange-50 rounded px-1.5 py-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-orange-900 text-[10px] sm:text-[11px] leading-tight">午後</span>
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

          {viewFormat === 'week' && (
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
                  <div className="text-xs sm:text-sm font-bold text-gray-600">午前</div>
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
              <div className="flex min-h-[200px]">
                <div className="w-16 sm:w-20 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                  <div className="text-xs sm:text-sm font-bold text-gray-600">午後</div>
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
                        午前
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {facilitySettings.businessHours?.AM?.start || '09:00'} ～ {facilitySettings.businessHours?.AM?.end || '12:00'}
                      </p>
                    </div>
                  </label>
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
                        午後
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {facilitySettings.businessHours?.PM?.start || '13:00'} ～ {facilitySettings.businessHours?.PM?.end || '18:00'}
                      </p>
                    </div>
                  </label>
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

      {/* 一括処理中オーバーレイ */}
      {isBulkProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg px-8 py-6 shadow-xl">
            <div className="animate-spin w-8 h-8 border-3 border-[#00c4cc] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-700 font-bold">処理中...</p>
          </div>
        </div>
      )}

      {/* 日別計画モーダル */}
      {isPlanningModalOpen && selectedDateForPlanning && (
        <DailyProgramPlanningView
          date={selectedDateForPlanning}
          onClose={() => {
            setIsPlanningModalOpen(false);
            setSelectedDateForPlanning(null);
          }}
        />
      )}
    </div>
  );
};

export default ScheduleView;

