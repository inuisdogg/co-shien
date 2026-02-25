/**
 * 実績記録と連絡帳
 * カレンダーから日付を選択してモーダルで児童一覧を表示
 * 各児童の実績記録・連絡帳を入力
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle,
  AlertCircle,
  CircleDot,
  Clock,
  X,
  FileText,
  MessageSquare,
  Utensils,
  Heart,
  Smile,
  Moon,
  Droplet,
  Save,
  Loader2,
} from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import { ScheduleItem, UsageRecord, ContactLog, ContactLogFormData } from '@/types';
import UsageRecordForm from '@/components/schedule/UsageRecordForm';

// フェーズ設定
const FEATURE_PHASE = parseInt(process.env.NEXT_PUBLIC_FEATURE_PHASE || '1', 10);

// 体調・機嫌・食欲のラベル
const HEALTH_LABELS = {
  excellent: { label: '良好', color: 'bg-green-100 text-green-700' },
  good: { label: '普通', color: 'bg-blue-100 text-blue-700' },
  fair: { label: 'やや不良', color: 'bg-yellow-100 text-yellow-700' },
  poor: { label: '不良', color: 'bg-red-100 text-red-700' },
};

const MOOD_LABELS = {
  very_happy: { label: 'とても元気', emoji: '😄', color: 'bg-green-100 text-green-700' },
  happy: { label: '元気', emoji: '😊', color: 'bg-blue-100 text-blue-700' },
  neutral: { label: '普通', emoji: '😐', color: 'bg-gray-100 text-gray-700' },
  sad: { label: 'やや元気なし', emoji: '😔', color: 'bg-yellow-100 text-yellow-700' },
  upset: { label: '元気なし', emoji: '😢', color: 'bg-red-100 text-red-700' },
};

const APPETITE_LABELS = {
  excellent: { label: '完食', color: 'bg-green-100 text-green-700' },
  good: { label: 'ほぼ完食', color: 'bg-blue-100 text-blue-700' },
  fair: { label: '半分程度', color: 'bg-yellow-100 text-yellow-700' },
  poor: { label: '少量', color: 'bg-orange-100 text-orange-700' },
  none: { label: '食べず', color: 'bg-red-100 text-red-700' },
};

export default function DailyLogView() {
  const {
    schedules,
    children: facilityChildren,
    usageRecords,
    contactLogs,
    timeSlots,
    getUsageRecordByScheduleId,
    getContactLogByScheduleId,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    addContactLog,
    updateContactLog,
    deleteContactLog,
  } = useFacilityData();

  // 時間枠の名前を動的に取得
  const slotInfo = useMemo(() => {
    if (timeSlots.length >= 2) {
      const sorted = [...timeSlots].sort((a, b) => a.displayOrder - b.displayOrder);
      return {
        AM: { name: sorted[0]?.name || '午前' },
        PM: { name: sorted[1]?.name || '午後' },
      };
    } else if (timeSlots.length === 1) {
      return {
        AM: { name: timeSlots[0].name || '終日' },
        PM: null,
      };
    }
    return {
      AM: { name: '午前' },
      PM: { name: '午後' },
    };
  }, [timeSlots]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'record' | 'contact'>('record');
  const [isSaving, setIsSaving] = useState(false);

  // 連絡帳フォームの状態
  const [contactFormData, setContactFormData] = useState<Partial<ContactLogFormData>>({});

  // 月の日付配列を生成
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // 前月の日を追加
    const prevMonth = new Date(year, month, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonth.getDate() - i;
      const date = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date, day, isCurrentMonth: false });
    }

    // 当月の日を追加
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date, day, isCurrentMonth: true });
    }

    // 次月の日を追加（6週分になるように）
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonth = new Date(year, month + 1, day);
      const date = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date, day, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // 各日のスケジュールと実績・連絡帳状況
  const dayStatusMap = useMemo(() => {
    const map: Record<string, {
      total: number;
      recordCompleted: number;
      contactCompleted: number;
      schedules: Array<{
        schedule: ScheduleItem;
        usageRecord: UsageRecord | undefined;
        contactLog: ContactLog | undefined;
        hasRecord: boolean;
        hasContact: boolean;
      }>;
    }> = {};

    schedules.forEach(schedule => {
      if (!map[schedule.date]) {
        map[schedule.date] = { total: 0, recordCompleted: 0, contactCompleted: 0, schedules: [] };
      }
      const usageRecord = getUsageRecordByScheduleId(schedule.id);
      const contactLog = getContactLogByScheduleId(schedule.id);
      const hasRecord = !!usageRecord;
      const hasContact = !!contactLog;
      map[schedule.date].total++;
      if (hasRecord) map[schedule.date].recordCompleted++;
      if (hasContact) map[schedule.date].contactCompleted++;
      map[schedule.date].schedules.push({ schedule, usageRecord, contactLog, hasRecord, hasContact });
    });

    // 名前順でソート
    Object.values(map).forEach(day => {
      day.schedules.sort((a, b) => {
        // 午前→午後
        if (a.schedule.slot !== b.schedule.slot) {
          return a.schedule.slot === 'AM' ? -1 : 1;
        }
        return a.schedule.childName.localeCompare(b.schedule.childName, 'ja');
      });
    });

    return map;
  }, [schedules, getUsageRecordByScheduleId, getContactLogByScheduleId]);

  // 月移動
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  // 今日に移動
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const todayStr = today.toISOString().split('T')[0];
    setSelectedDate(todayStr);
    setIsDateModalOpen(true);
  };

  // カレンダー日付クリック時にモーダルを開く
  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setIsDateModalOpen(true);
  };

  // 日付モーダルを閉じる
  const closeDateModal = () => {
    setIsDateModalOpen(false);
  };

  // 児童詳細モーダルを開く
  const openDetailModal = (schedule: ScheduleItem) => {
    setSelectedScheduleItem(schedule);
    setActiveTab('record');

    // 連絡帳フォームの初期値を設定
    const existingContactLog = getContactLogByScheduleId(schedule.id);
    if (existingContactLog) {
      setContactFormData({
        activities: existingContactLog.activities || '',
        healthStatus: existingContactLog.healthStatus,
        mood: existingContactLog.mood,
        appetite: existingContactLog.appetite,
        mealMain: existingContactLog.mealMain,
        mealSide: existingContactLog.mealSide,
        mealNotes: existingContactLog.mealNotes || '',
        toiletCount: existingContactLog.toiletCount || 0,
        toiletNotes: existingContactLog.toiletNotes || '',
        napStartTime: existingContactLog.napStartTime || '',
        napEndTime: existingContactLog.napEndTime || '',
        napNotes: existingContactLog.napNotes || '',
        staffComment: existingContactLog.staffComment || '',
        parentMessage: existingContactLog.parentMessage || '',
      });
    } else {
      setContactFormData({
        activities: '',
        mealMain: false,
        mealSide: false,
        mealNotes: '',
        toiletCount: 0,
        toiletNotes: '',
        napStartTime: '',
        napEndTime: '',
        napNotes: '',
        staffComment: '',
        parentMessage: '',
      });
    }

    setIsDetailModalOpen(true);
    setIsDateModalOpen(false); // 日付モーダルを閉じる
  };

  // 詳細モーダルを閉じる
  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedScheduleItem(null);
    setContactFormData({});
    // 日付モーダルを再度開く
    if (selectedDate) {
      setIsDateModalOpen(true);
    }
  };

  // 実績保存
  const handleSaveUsageRecord = async (data: any) => {
    if (!selectedScheduleItem) return;

    try {
      const existingRecord = getUsageRecordByScheduleId(selectedScheduleItem.id);
      if (existingRecord) {
        await updateUsageRecord(existingRecord.id, data);
      } else {
        await addUsageRecord(data);
      }
    } catch (error) {
      console.error('実績保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  // 実績削除
  const handleDeleteUsageRecord = async () => {
    if (!selectedScheduleItem) return;

    const existingRecord = getUsageRecordByScheduleId(selectedScheduleItem.id);
    if (existingRecord) {
      if (confirm('この実績を削除しますか？')) {
        try {
          await deleteUsageRecord(existingRecord.id);
        } catch (error) {
          console.error('削除エラー:', error);
          alert('削除に失敗しました');
        }
      }
    }
  };

  // 連絡帳保存
  const handleSaveContactLog = async () => {
    if (!selectedScheduleItem) return;

    setIsSaving(true);
    try {
      const existingContactLog = getContactLogByScheduleId(selectedScheduleItem.id);
      const data: ContactLogFormData = {
        childId: selectedScheduleItem.childId,
        scheduleId: selectedScheduleItem.id,
        date: selectedScheduleItem.date,
        slot: selectedScheduleItem.slot as 'AM' | 'PM',
        ...contactFormData,
      };

      if (existingContactLog) {
        await updateContactLog(existingContactLog.id, data);
      } else {
        await addContactLog(data);
      }
      alert('連絡帳を保存しました');
    } catch (error) {
      console.error('連絡帳保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 選択日の情報
  const selectedDayInfo = selectedDate ? dayStatusMap[selectedDate] : null;

  // 曜日ヘッダー
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // 今日の日付文字列
  const todayStr = new Date().toISOString().split('T')[0];

  // 選択中の児童の実績記録
  const selectedUsageRecord = selectedScheduleItem
    ? getUsageRecordByScheduleId(selectedScheduleItem.id)
    : undefined;

  // 選択中の児童の連絡帳
  const selectedContactLog = selectedScheduleItem
    ? getContactLogByScheduleId(selectedScheduleItem.id)
    : undefined;

  // 今日の概要データ
  const todayInfo = dayStatusMap[todayStr];
  const todayTotal = todayInfo?.total || 0;
  const todayRecordCompleted = todayInfo?.recordCompleted || 0;
  const todayContactCompleted = todayInfo?.contactCompleted || 0;

  // 折りたたみ状態
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const isSectionCollapsed = (sectionId: string) => collapsedSections.has(sectionId);

  // セクションヘッダーコンポーネント
  const SectionHeader = ({ id, title, icon: Icon, badge }: { id: string; title: string; icon: React.ElementType; badge?: React.ReactNode }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 rounded-t-xl transition-colors border-b border-gray-100"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#00c4cc]" />
        <span className="font-bold text-gray-800 text-sm">{title}</span>
        {badge}
      </div>
      {isSectionCollapsed(id) ? (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronLeft className="w-4 h-4 text-gray-400 rotate-[-90deg]" />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー: 日付ナビゲーション */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#00c4cc] to-[#00b0b8] px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                実績記録と連絡帳
              </h1>
              <p className="text-white/80 text-sm mt-1">
                日々の記録を管理します
              </p>
            </div>
          </div>
        </div>

        {/* 日付ナビゲーション */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 bg-white">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="前月"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-800 min-w-[160px] text-center">
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="次月"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-4 py-2 text-sm font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors shadow-sm"
          >
            本日
          </button>
        </div>
      </div>

      {/* 本日の概要 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <SectionHeader
          id="overview"
          title="本日の概要"
          icon={CircleDot}
          badge={
            <span className="text-xs bg-[#00c4cc]/10 text-[#00c4cc] px-2 py-0.5 rounded-full font-medium">
              {todayTotal}名利用
            </span>
          }
        />
        {!isSectionCollapsed('overview') && (
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="text-xs text-blue-600 font-medium mb-1">本日の利用者</div>
                <div className="text-2xl font-bold text-blue-800">{todayTotal}<span className="text-sm font-normal ml-1">名</span></div>
              </div>
              <div className={`rounded-xl p-4 border ${todayRecordCompleted === todayTotal && todayTotal > 0 ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className={`text-xs font-medium mb-1 ${todayRecordCompleted === todayTotal && todayTotal > 0 ? 'text-green-600' : 'text-amber-600'}`}>実績記録</div>
                <div className={`text-2xl font-bold ${todayRecordCompleted === todayTotal && todayTotal > 0 ? 'text-green-800' : 'text-amber-800'}`}>
                  {todayRecordCompleted}/{todayTotal}
                </div>
              </div>
              <div className={`rounded-xl p-4 border ${todayContactCompleted === todayTotal && todayTotal > 0 ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className={`text-xs font-medium mb-1 ${todayContactCompleted === todayTotal && todayTotal > 0 ? 'text-green-600' : 'text-orange-600'}`}>連絡帳</div>
                <div className={`text-2xl font-bold ${todayContactCompleted === todayTotal && todayTotal > 0 ? 'text-green-800' : 'text-orange-800'}`}>
                  {todayContactCompleted}/{todayTotal}
                </div>
              </div>
              <button
                onClick={goToToday}
                className="bg-[#00c4cc]/5 rounded-xl p-4 border border-[#00c4cc]/20 hover:bg-[#00c4cc]/10 transition-colors text-left"
              >
                <div className="text-xs text-[#00c4cc] font-medium mb-1">クイックアクセス</div>
                <div className="text-sm font-bold text-gray-700">本日の記録を開く →</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* カレンダー */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <SectionHeader
          id="calendar"
          title="月間カレンダー"
          icon={Calendar}
        />
        {!isSectionCollapsed('calendar') && (
          <>
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDays.map((day, index) => (
                <div
                  key={day}
                  className={`py-2.5 text-center text-sm font-bold ${
                    index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* カレンダー本体 */}
            <div className="grid grid-cols-7">
              {calendarDays.map(({ date, day, isCurrentMonth }, index) => {
                const dayStatus = dayStatusMap[date];
                const isToday = date === todayStr;
                const dayOfWeek = index % 7;
                const hasSchedules = dayStatus && dayStatus.total > 0;
                const allRecordCompleted = hasSchedules && dayStatus.recordCompleted === dayStatus.total;
                const allContactCompleted = hasSchedules && dayStatus.contactCompleted === dayStatus.total;

                return (
                  <button
                    key={date}
                    onClick={() => handleDateClick(date)}
                    className={`
                      relative min-h-[90px] p-2 border-b border-r border-gray-100 text-left transition-all
                      ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-400' : 'bg-white hover:bg-gray-50'}
                      ${isToday ? 'bg-[#00c4cc]/5 ring-2 ring-inset ring-[#00c4cc]/30' : ''}
                    `}
                  >
                    <span className={`
                      inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium
                      ${isToday ? 'bg-[#00c4cc] text-white' : ''}
                      ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}
                      ${!isCurrentMonth ? 'text-gray-400' : ''}
                    `}>
                      {day}
                    </span>

                    {hasSchedules && isCurrentMonth && (
                      <div className="mt-1 space-y-1">
                        <div className="text-xs text-gray-600 font-medium">
                          {dayStatus.total}名
                        </div>
                        <div className={`
                          text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1
                          ${allRecordCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                        `}>
                          <FileText className="w-3 h-3" />
                          <span>実績 {dayStatus.recordCompleted}/{dayStatus.total}</span>
                        </div>
                        <div className={`
                          text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1
                          ${allContactCompleted ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}
                        `}>
                          <MessageSquare className="w-3 h-3" />
                          <span>連絡 {dayStatus.contactCompleted}/{dayStatus.total}</span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 日付選択モーダル（児童一覧） */}
      {isDateModalOpen && selectedDate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#00c4cc]" />
                  {(() => {
                    const [y, m, d] = selectedDate.split('-').map(Number);
                    const date = new Date(y, m - 1, d);
                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                    return `${m}月${d}日(${days[date.getDay()]})`;
                  })()}
                </h2>
                {selectedDayInfo && (
                  <p className="text-sm text-gray-500 mt-1">
                    予約 {selectedDayInfo.total}名 /
                    実績 {selectedDayInfo.recordCompleted}名完了 /
                    連絡帳 {selectedDayInfo.contactCompleted}名完了
                  </p>
                )}
              </div>
              <button
                onClick={closeDateModal}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 児童一覧 */}
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedDayInfo || selectedDayInfo.total === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>この日の利用予約はありません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 第1枠の予約 */}
                  {selectedDayInfo.schedules.filter(s => s.schedule.slot === 'AM').length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{slotInfo.AM.name}</span>
                        <span className="text-gray-500 font-normal">
                          ({selectedDayInfo.schedules.filter(s => s.schedule.slot === 'AM').length}名)
                        </span>
                      </h4>
                      <div className="space-y-2">
                        {selectedDayInfo.schedules
                          .filter(s => s.schedule.slot === 'AM')
                          .map(({ schedule, hasRecord, hasContact }) => (
                            <button
                              key={schedule.id}
                              onClick={() => openDetailModal(schedule)}
                              className="w-full flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-base font-medium text-gray-800">
                                  {schedule.childName}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  {schedule.hasPickup && <span className="px-1 bg-gray-100 rounded">迎</span>}
                                  {schedule.hasDropoff && <span className="px-1 bg-gray-100 rounded">送</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* 実績記録ステータス */}
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  hasRecord ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>実績記録</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    hasRecord ? 'bg-green-200' : 'bg-gray-200'
                                  }`}>
                                    {hasRecord ? '済' : '未'}
                                  </span>
                                </div>
                                {/* 連絡帳ステータス */}
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  hasContact ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>連絡帳</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    hasContact ? 'bg-green-200' : 'bg-gray-200'
                                  }`}>
                                    {hasContact ? '済' : '未'}
                                  </span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 第2枠の予約 */}
                  {slotInfo.PM && selectedDayInfo.schedules.filter(s => s.schedule.slot === 'PM').length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">{slotInfo.PM.name}</span>
                        <span className="text-gray-500 font-normal">
                          ({selectedDayInfo.schedules.filter(s => s.schedule.slot === 'PM').length}名)
                        </span>
                      </h4>
                      <div className="space-y-2">
                        {selectedDayInfo.schedules
                          .filter(s => s.schedule.slot === 'PM')
                          .map(({ schedule, hasRecord, hasContact }) => (
                            <button
                              key={schedule.id}
                              onClick={() => openDetailModal(schedule)}
                              className="w-full flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-base font-medium text-gray-800">
                                  {schedule.childName}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  {schedule.hasPickup && <span className="px-1 bg-gray-100 rounded">迎</span>}
                                  {schedule.hasDropoff && <span className="px-1 bg-gray-100 rounded">送</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* 実績記録ステータス */}
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  hasRecord ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>実績記録</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    hasRecord ? 'bg-green-200' : 'bg-gray-200'
                                  }`}>
                                    {hasRecord ? '済' : '未'}
                                  </span>
                                </div>
                                {/* 連絡帳ステータス */}
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  hasContact ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>連絡帳</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    hasContact ? 'bg-green-200' : 'bg-gray-200'
                                  }`}>
                                    {hasContact ? '済' : '未'}
                                  </span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 児童詳細モーダル（タブ付き） */}
      {isDetailModalOpen && selectedScheduleItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedScheduleItem.childName}
                </h2>
                <p className="text-sm text-gray-500">
                  {(() => {
                    const [y, m, d] = selectedScheduleItem.date.split('-').map(Number);
                    const date = new Date(y, m - 1, d);
                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                    const slotName = selectedScheduleItem.slot === 'AM' ? slotInfo.AM.name : (slotInfo.PM?.name || '午後');
                    return `${m}月${d}日(${days[date.getDay()]}) ${slotName}`;
                  })()}
                </p>
              </div>
              <button
                onClick={closeDetailModal}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* タブ切り替え */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('record')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'record'
                    ? 'text-[#00c4cc] border-b-2 border-[#00c4cc] bg-[#00c4cc]/5'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                実績記録
                {selectedUsageRecord && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('contact')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'contact'
                    ? 'text-[#00c4cc] border-b-2 border-[#00c4cc] bg-[#00c4cc]/5'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                連絡帳
                {selectedContactLog && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </button>
            </div>

            {/* タブコンテンツ */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'record' ? (
                /* 実績記録タブ */
                <UsageRecordForm
                  scheduleItem={selectedScheduleItem}
                  initialData={selectedUsageRecord}
                  onSave={handleSaveUsageRecord}
                  onDelete={handleDeleteUsageRecord}
                />
              ) : (
                /* 連絡帳タブ */
                <div className="p-6 space-y-6">
                  {/* 今日の活動 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#00c4cc]" />
                      今日の活動内容
                    </label>
                    <textarea
                      value={contactFormData.activities || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, activities: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="今日行った活動を記入してください"
                    />
                  </div>

                  {/* 体調・機嫌・食欲 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 体調 */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-400" />
                        体調
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(HEALTH_LABELS).map(([key, { label, color }]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setContactFormData({ ...contactFormData, healthStatus: key as any })}
                            className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                              contactFormData.healthStatus === key
                                ? `${color} border-current`
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 機嫌 */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Smile className="w-4 h-4 text-yellow-500" />
                        機嫌
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(MOOD_LABELS).map(([key, { label, emoji, color }]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setContactFormData({ ...contactFormData, mood: key as any })}
                            className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                              contactFormData.mood === key
                                ? `${color} border-current`
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {emoji} {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 食欲 */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-orange-400" />
                        食欲
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(APPETITE_LABELS).map(([key, { label, color }]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setContactFormData({ ...contactFormData, appetite: key as any })}
                            className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                              contactFormData.appetite === key
                                ? `${color} border-current`
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 食事 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-orange-400" />
                      食事
                    </label>
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={contactFormData.mealMain || false}
                          onChange={(e) => setContactFormData({ ...contactFormData, mealMain: e.target.checked })}
                          className="w-4 h-4 text-[#00c4cc] rounded"
                        />
                        <span className="text-sm text-gray-700">主食</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={contactFormData.mealSide || false}
                          onChange={(e) => setContactFormData({ ...contactFormData, mealSide: e.target.checked })}
                          className="w-4 h-4 text-[#00c4cc] rounded"
                        />
                        <span className="text-sm text-gray-700">副食</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={contactFormData.mealNotes || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, mealNotes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="食事に関するメモ"
                    />
                  </div>

                  {/* 排泄・睡眠 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 排泄 */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Droplet className="w-4 h-4 text-blue-400" />
                        排泄
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-600">トイレ回数:</span>
                        <input
                          type="number"
                          min={0}
                          value={contactFormData.toiletCount || 0}
                          onChange={(e) => setContactFormData({ ...contactFormData, toiletCount: parseInt(e.target.value) || 0 })}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                        />
                        <span className="text-sm text-gray-600">回</span>
                      </div>
                      <input
                        type="text"
                        value={contactFormData.toiletNotes || ''}
                        onChange={(e) => setContactFormData({ ...contactFormData, toiletNotes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                        placeholder="排泄に関するメモ"
                      />
                    </div>

                    {/* 睡眠 */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Moon className="w-4 h-4 text-indigo-400" />
                        お昼寝
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="time"
                          value={contactFormData.napStartTime || ''}
                          onChange={(e) => setContactFormData({ ...contactFormData, napStartTime: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                        />
                        <span className="text-gray-500">〜</span>
                        <input
                          type="time"
                          value={contactFormData.napEndTime || ''}
                          onChange={(e) => setContactFormData({ ...contactFormData, napEndTime: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                        />
                      </div>
                      <input
                        type="text"
                        value={contactFormData.napNotes || ''}
                        onChange={(e) => setContactFormData({ ...contactFormData, napNotes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                        placeholder="睡眠に関するメモ"
                      />
                    </div>
                  </div>

                  {/* スタッフからのコメント */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#00c4cc]" />
                      スタッフからのコメント
                    </label>
                    <textarea
                      value={contactFormData.staffComment || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, staffComment: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="今日の様子やエピソードなど"
                    />
                  </div>

                  {/* 保護者への連絡事項 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      保護者への連絡事項
                    </label>
                    <textarea
                      value={contactFormData.parentMessage || ''}
                      onChange={(e) => setContactFormData({ ...contactFormData, parentMessage: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="持ち物のお願いなど"
                    />
                  </div>

                  {/* 保存ボタン */}
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSaveContactLog}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      保存する
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
