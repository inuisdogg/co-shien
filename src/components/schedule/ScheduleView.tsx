/**
 * スケジュールビュー（利用調整・予約）
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { CalendarDays, X, Plus, Trash2 } from 'lucide-react';
import { TimeSlot, ScheduleItem, Child } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import UsageRecordForm from './UsageRecordForm';
import { isJapaneseHoliday } from '@/utils/japaneseHolidays';

const ScheduleView: React.FC = () => {
  const {
    schedules,
    children,
    addSchedule,
    facilitySettings,
    deleteSchedule,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    getUsageRecordByScheduleId,
  } = useFacilityData();

  const [viewFormat, setViewFormat] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState('');
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<TimeSlot>('PM');
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isUsageRecordFormOpen, setIsUsageRecordFormOpen] = useState(false);

  const [newBooking, setNewBooking] = useState({
    childId: '',
    date: '',
    slot: 'PM' as TimeSlot,
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

  // 日付をクリックしてモーダルを開く
  const handleDateClick = (date: string, slot?: TimeSlot) => {
    setSelectedDateForBooking(date);
    const selectedSlot = slot || 'PM';
    setSelectedSlotForBooking(selectedSlot);
    setNewBooking({
      childId: '',
      date,
      slot: selectedSlot,
      pickup: false,
      dropoff: false,
    });
    setIsModalOpen(true);
  };

  // 予約を追加
  const handleAddBooking = () => {
    if (!newBooking.childId) {
      alert('児童を選択してください');
      return;
    }
    const child = children.find((c) => c.id === newBooking.childId);
    if (!child) return;

    addSchedule({
      date: newBooking.date,
      childId: child.id,
      childName: child.name,
      slot: newBooking.slot,
      hasPickup: newBooking.pickup,
      hasDropoff: newBooking.dropoff,
    });

    alert(`${child.name}さんの予約を追加しました`);
    setIsModalOpen(false);
    setNewBooking({
      childId: '',
      date: '',
      slot: 'PM',
      pickup: false,
      dropoff: false,
    });
  };

  // 登録児童をクリックしたときの処理
  const handleScheduleItemClick = (item: ScheduleItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedScheduleItem(item);
    setIsActionDialogOpen(true);
  };

  // 実績登録を選択
  const handleSelectRecord = () => {
    setIsActionDialogOpen(false);
    setIsUsageRecordFormOpen(true);
  };

  // 削除を選択
  const handleSelectDelete = () => {
    if (selectedScheduleItem && confirm(`${selectedScheduleItem.childName}さんの予約を削除しますか？`)) {
      deleteSchedule(selectedScheduleItem.id);
      setIsActionDialogOpen(false);
      setSelectedScheduleItem(null);
    }
  };

  // 実績を保存
  const handleSaveUsageRecord = (data: any) => {
    if (selectedScheduleItem) {
      const existingRecord = getUsageRecordByScheduleId(selectedScheduleItem.id);
      if (existingRecord) {
        updateUsageRecord(existingRecord.id, data);
      } else {
        addUsageRecord(data);
      }
      setIsUsageRecordFormOpen(false);
      setSelectedScheduleItem(null);
      alert('実績を保存しました');
    }
  };

  // 実績を削除
  const handleDeleteUsageRecord = () => {
    if (selectedScheduleItem) {
      const existingRecord = getUsageRecordByScheduleId(selectedScheduleItem.id);
      if (existingRecord && confirm('実績を削除しますか？')) {
        deleteUsageRecord(existingRecord.id);
        setIsUsageRecordFormOpen(false);
        setSelectedScheduleItem(null);
        alert('実績を削除しました');
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
    <div className="h-[calc(100vh-100px)] animate-in fade-in duration-500">
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
                        <div
                          className={`text-sm font-bold leading-tight ${
                            !dateInfo.isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
                          }`}
                        >
                          {dateInfo.day}
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
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl border border-gray-100">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center">
                <Plus size={20} className="mr-2 text-[#00c4cc]" />
                利用予定を追加
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">児童を選択</label>
                <select
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] transition-all"
                  value={newBooking.childId}
                  onChange={(e) => setNewBooking({ ...newBooking, childId: e.target.value })}
                >
                  <option value="">選択してください</option>
                  {children.map((child) => (
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
                <select
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={newBooking.slot}
                  onChange={(e) =>
                    setNewBooking({ ...newBooking, slot: e.target.value as TimeSlot })
                  }
                >
                  <option value="PM">午後 (放課後)</option>
                  <option value="AM">午前</option>
                </select>
              </div>

              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-3">
                <label className="text-xs font-bold text-gray-500 block">送迎オプション</label>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={newBooking.pickup}
                    onChange={(e) => setNewBooking({ ...newBooking, pickup: e.target.checked })}
                    className="accent-[#00c4cc] w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    お迎え (学校→事業所)
                  </span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={newBooking.dropoff}
                    onChange={(e) => setNewBooking({ ...newBooking, dropoff: e.target.checked })}
                    className="accent-[#00c4cc] w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    お送り (事業所→自宅)
                  </span>
                </label>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddBooking}
                  className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md shadow-md text-sm transition-all"
                >
                  登録する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* アクション選択ダイアログ */}
      {isActionDialogOpen && selectedScheduleItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl border border-gray-100">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">
                {selectedScheduleItem.childName}さん
              </h3>
              <button
                onClick={() => {
                  setIsActionDialogOpen(false);
                  setSelectedScheduleItem(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={handleSelectRecord}
                className="w-full py-3 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md shadow-md text-sm transition-all"
              >
                実績登録
              </button>
              <button
                onClick={handleSelectDelete}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md text-sm transition-all"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 実績登録フォーム */}
      {isUsageRecordFormOpen && selectedScheduleItem && (
        <UsageRecordForm
          scheduleItem={selectedScheduleItem}
          initialData={getUsageRecordByScheduleId(selectedScheduleItem.id) || undefined}
          onClose={() => {
            setIsUsageRecordFormOpen(false);
            setSelectedScheduleItem(null);
          }}
          onSave={handleSaveUsageRecord}
          onDelete={handleDeleteUsageRecord}
        />
      )}
    </div>
  );
};

export default ScheduleView;

