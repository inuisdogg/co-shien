/**
 * スロット割り当てパネル
 * 日付クリック時に開くフルスクリーンモーダル
 * 児童を各時間枠に割り当てる
 * 左側に児童一覧、右側に午前・午後の枠を表示
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { X, Plus, Trash2, Car, Calendar, AlertTriangle, Search } from 'lucide-react';
import { TimeSlot, ScheduleItem, Child, UsageRecord } from '@/types';
import ChildCard from './ChildCard';
import ChildPickerPopup from './ChildPickerPopup';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';

interface SlotAssignmentPanelProps {
  date: string;
  schedules: ScheduleItem[];
  childList: Child[];
  capacity: { AM: number; PM: number };
  transportCapacity?: { pickup: number; dropoff: number };
  onClose: () => void;
  onAddSchedule: (data: {
    date: string;
    childId: string;
    childName: string;
    slot: TimeSlot;
    hasPickup: boolean;
    hasDropoff: boolean;
  }) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onMoveSchedule: (id: string, newSlot: TimeSlot) => Promise<void>;
  getUsageRecordByScheduleId: (scheduleId: string) => UsageRecord | undefined;
  onScheduleItemClick: (item: ScheduleItem) => void;
}

export default function SlotAssignmentPanel({
  date,
  schedules,
  childList,
  capacity,
  transportCapacity = { pickup: 3, dropoff: 3 },
  onClose,
  onAddSchedule,
  onDeleteSchedule,
  onMoveSchedule,
  getUsageRecordByScheduleId,
  onScheduleItemClick,
}: SlotAssignmentPanelProps) {
  const [pickerSlot, setPickerSlot] = useState<TimeSlot | null>(null);
  const [draggedItem, setDraggedItem] = useState<ScheduleItem | null>(null);
  const [draggedChild, setDraggedChild] = useState<Child | null>(null); // 左側の児童リストからドラッグ
  const [dragOverSlot, setDragOverSlot] = useState<TimeSlot | null>(null);
  const [processing, setProcessing] = useState(false);
  const [childSearchQuery, setChildSearchQuery] = useState('');
  const [selectedSlotForQuickAdd, setSelectedSlotForQuickAdd] = useState<TimeSlot | null>(null);

  // 日付情報
  const dateInfo = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return {
      year,
      month,
      day,
      dayOfWeek,
      dayName: dayNames[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  }, [date]);

  // この日のスケジュールをスロット別に分類
  const schedulesBySlot = useMemo(() => {
    const daySchedules = schedules.filter(s => s.date === date);
    return {
      AM: daySchedules.filter(s => s.slot === 'AM'),
      PM: daySchedules.filter(s => s.slot === 'PM'),
    };
  }, [schedules, date]);

  // 既に登録済みの児童ID（全スロット合計）
  const registeredChildIds = useMemo(() => {
    return [...schedulesBySlot.AM, ...schedulesBySlot.PM].map(s => s.childId);
  }, [schedulesBySlot]);

  // 送迎の集計
  const transportStats = useMemo(() => {
    const amPickup = schedulesBySlot.AM.filter(s => s.hasPickup).length;
    const amDropoff = schedulesBySlot.AM.filter(s => s.hasDropoff).length;
    const pmPickup = schedulesBySlot.PM.filter(s => s.hasPickup).length;
    const pmDropoff = schedulesBySlot.PM.filter(s => s.hasDropoff).length;

    return {
      AM: { pickup: amPickup, dropoff: amDropoff },
      PM: { pickup: pmPickup, dropoff: pmDropoff },
      total: {
        pickup: amPickup + pmPickup,
        dropoff: amDropoff + pmDropoff,
      },
    };
  }, [schedulesBySlot]);

  // パターン一致判定
  const isPatternMatch = useCallback((child: Child, slot: TimeSlot) => {
    if (!child.patternDays?.includes(dateInfo.dayOfWeek)) return false;
    const timeSlot = child.patternTimeSlots?.[dateInfo.dayOfWeek];
    return timeSlot === slot || timeSlot === 'AMPM';
  }, [dateInfo.dayOfWeek]);

  // 左側の児童リスト（未登録の児童のみ、パターン一致で分類）
  const availableChildrenForList = useMemo(() => {
    // 既に登録済みの児童IDを取得
    const registeredIds = [...schedulesBySlot.AM, ...schedulesBySlot.PM].map(s => s.childId);

    // 未登録の児童をフィルタリング
    let filtered = childList.filter(c => !registeredIds.includes(c.id));

    // 検索クエリでフィルタリング
    if (childSearchQuery.trim()) {
      const query = childSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.nameKana?.toLowerCase().includes(query)
      );
    }

    // その曜日に利用パターンがある児童を分類
    const withPattern: Child[] = [];
    const withoutPattern: Child[] = [];

    filtered.forEach(child => {
      // この曜日に利用パターンがあるか
      const hasPatternForDay = child.patternDays?.includes(dateInfo.dayOfWeek) || false;

      if (hasPatternForDay) {
        withPattern.push(child);
      } else {
        withoutPattern.push(child);
      }
    });

    // 名前順でソート
    withPattern.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    withoutPattern.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    return { withPattern, withoutPattern };
  }, [childList, schedulesBySlot, childSearchQuery, dateInfo.dayOfWeek]);

  // 児童追加
  const handleAddChildren = async (childIds: string[], slot: TimeSlot) => {
    setProcessing(true);
    try {
      for (const childId of childIds) {
        const child = childList.find(c => c.id === childId);
        if (!child) continue;

        await onAddSchedule({
          date,
          childId: child.id,
          childName: child.name,
          slot,
          hasPickup: child.needsPickup || false,
          hasDropoff: child.needsDropoff || false,
        });
      }
    } finally {
      setProcessing(false);
      setPickerSlot(null);
    }
  };

  // 児童削除
  const handleRemoveChild = async (scheduleId: string) => {
    if (!confirm('この児童の予約を削除しますか？')) return;
    setProcessing(true);
    try {
      await onDeleteSchedule(scheduleId);
    } finally {
      setProcessing(false);
    }
  };

  // ドラッグ開始（登録済みスケジュールから）
  const handleDragStart = (item: ScheduleItem) => {
    const hasRecord = getUsageRecordByScheduleId(item.id);
    if (hasRecord) return; // 実績登録済みはドラッグ不可
    setDraggedItem(item);
    setDraggedChild(null);
  };

  // ドラッグ開始（左側の児童リストから）
  const handleChildDragStart = (child: Child) => {
    setDraggedChild(child);
    setDraggedItem(null);
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedChild(null);
    setDragOverSlot(null);
  };

  // ドロップ（登録済みスケジュールの移動）
  const handleDrop = async (targetSlot: TimeSlot) => {
    if (draggedItem) {
      // 登録済みスケジュールの移動
      if (draggedItem.slot === targetSlot) {
        setDraggedItem(null);
        setDragOverSlot(null);
        return;
      }

      setProcessing(true);
      try {
        await onMoveSchedule(draggedItem.id, targetSlot);
      } finally {
        setProcessing(false);
        setDraggedItem(null);
        setDragOverSlot(null);
      }
    } else if (draggedChild) {
      // 左側の児童リストからの新規登録
      setProcessing(true);
      try {
        await onAddSchedule({
          date,
          childId: draggedChild.id,
          childName: draggedChild.name,
          slot: targetSlot,
          hasPickup: draggedChild.needsPickup || false,
          hasDropoff: draggedChild.needsDropoff || false,
        });
      } finally {
        setProcessing(false);
        setDraggedChild(null);
        setDragOverSlot(null);
      }
    }
  };

  // 児童をクリックして登録（選択されたスロットがある場合）
  const handleChildClick = async (child: Child) => {
    if (!selectedSlotForQuickAdd) {
      // スロットが選択されていない場合は、スロット選択を促す
      return;
    }

    // 既に登録済みかチェック
    const alreadyRegistered = [...schedulesBySlot.AM, ...schedulesBySlot.PM]
      .some(s => s.childId === child.id);
    
    if (alreadyRegistered) {
      alert(`${child.name}さんは既に登録済みです`);
      return;
    }

    // 定員チェック
    const slotSchedules = schedulesBySlot[selectedSlotForQuickAdd];
    if (slotSchedules.length >= capacity[selectedSlotForQuickAdd]) {
      alert(`${selectedSlotForQuickAdd === 'AM' ? '午前' : '午後'}の定員に達しています`);
      return;
    }

    setProcessing(true);
    try {
      await onAddSchedule({
        date,
        childId: child.id,
        childName: child.name,
        slot: selectedSlotForQuickAdd,
        hasPickup: child.needsPickup || false,
        hasDropoff: child.needsDropoff || false,
      });
      setSelectedSlotForQuickAdd(null);
    } finally {
      setProcessing(false);
    }
  };

  // この日をリセット
  const handleResetDay = async () => {
    const schedulesWithoutRecord = [...schedulesBySlot.AM, ...schedulesBySlot.PM].filter(
      s => !getUsageRecordByScheduleId(s.id)
    );

    if (schedulesWithoutRecord.length === 0) {
      alert('削除可能な予約がありません（実績登録済みの予約は削除できません）');
      return;
    }

    if (!confirm(`この日の予約${schedulesWithoutRecord.length}件を削除しますか？\n※実績登録済みの予約は除外されます`)) {
      return;
    }

    setProcessing(true);
    try {
      for (const s of schedulesWithoutRecord) {
        await onDeleteSchedule(s.id);
      }
    } finally {
      setProcessing(false);
    }
  };

  // スロットセクションのレンダリング
  const renderSlotSection = (slot: TimeSlot) => {
    const slotSchedules = schedulesBySlot[slot];
    const slotCapacity = capacity[slot];
    const remaining = slotCapacity - slotSchedules.length;
    const isFull = remaining <= 0;
    const stats = transportStats[slot];
    const isOverPickup = stats.pickup > transportCapacity.pickup;
    const isOverDropoff = stats.dropoff > transportCapacity.dropoff;
    const isSelected = selectedSlotForQuickAdd === slot;

    return (
      <div
        className={`
          border-b border-gray-200 pb-4 transition-all
          ${isSelected ? 'ring-2 ring-[#00c4cc] ring-offset-1' : ''}
          ${dragOverSlot === slot && (draggedItem || draggedChild) ? 'ring-2 ring-[#00c4cc] ring-offset-1' : ''}
        `}
        onClick={() => {
          if (!isFull) {
            setSelectedSlotForQuickAdd(selectedSlotForQuickAdd === slot ? null : slot);
          }
        }}
        style={{ cursor: isFull ? 'default' : 'pointer' }}
        onDragOver={(e) => {
          e.preventDefault();
          if ((draggedItem && draggedItem.slot !== slot) || draggedChild) {
            setDragOverSlot(slot);
          }
        }}
        onDragLeave={() => setDragOverSlot(null)}
        onDrop={() => handleDrop(slot)}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-800">
              {slot === 'AM' ? '午前' : '午後'}
            </h3>
            <span className={`text-xs font-medium ${isFull ? 'text-red-600' : 'text-gray-600'}`}>
              {slotSchedules.length}/{slotCapacity}
            </span>
            {remaining > 0 && (
              <span className="text-xs text-gray-400">残り{remaining}枠</span>
            )}
            {isSelected && (
              <span className="text-xs bg-[#00c4cc] text-white px-2 py-0.5 rounded font-semibold shadow-sm">
                選択中
              </span>
            )}
          </div>

          {/* 送迎統計 */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className={`flex items-center gap-1 ${isOverPickup ? 'text-red-600 font-semibold' : ''}`}>
              <Car className="w-3.5 h-3.5" />
              <span>迎 {stats.pickup}/{transportCapacity.pickup}</span>
              {isOverPickup && <AlertTriangle className="w-3.5 h-3.5" />}
            </div>
            <div className={`flex items-center gap-1 ${isOverDropoff ? 'text-red-600 font-semibold' : ''}`}>
              <span>送 {stats.dropoff}/{transportCapacity.dropoff}</span>
              {isOverDropoff && <AlertTriangle className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        {/* 登録済み児童 */}
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {slotSchedules.map(schedule => {
            const child = childList.find(c => c.id === schedule.childId);
            if (!child) return null;

            const hasRecord = !!getUsageRecordByScheduleId(schedule.id);

            return (
              <ChildCard
                key={schedule.id}
                child={child}
                slot={slot}
                scheduleId={schedule.id}
                isPatternMatch={isPatternMatch(child, slot)}
                hasPickup={schedule.hasPickup}
                hasDropoff={schedule.hasDropoff}
                hasUsageRecord={hasRecord}
                draggable={!hasRecord}
                onDragStart={() => handleDragStart(schedule)}
                onDragEnd={handleDragEnd}
                onClick={() => onScheduleItemClick(schedule)}
                onRemove={hasRecord ? undefined : () => handleRemoveChild(schedule.id)}
              />
            );
          })}

          {/* 追加ボタン */}
          {!isFull && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPickerSlot(slot);
              }}
              disabled={processing}
              className={`
                flex items-center justify-center w-12 h-12 rounded-md border-2 border-dashed border-gray-300
                transition-all hover:border-[#00c4cc] hover:bg-[#00c4cc]/5 hover:shadow-sm
                text-gray-400 hover:text-[#00c4cc]
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title="児童を選択して追加"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 lg:p-4">
      <div className="bg-white rounded-lg lg:rounded-2xl w-full max-w-7xl max-h-[95vh] lg:max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        {/* ヘッダー */}
        <div className="px-3 lg:px-6 py-3 lg:py-4 border-b border-gray-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 lg:gap-0 bg-gradient-to-r from-[#00c4cc] to-[#00b0b8]">
          <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
            <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-white flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm lg:text-base font-semibold text-white truncate">
                {dateInfo.year}年{dateInfo.month}月{dateInfo.day}日
                <span className={`ml-1 lg:ml-2 text-xs lg:text-sm font-normal ${dateInfo.isWeekend ? 'text-yellow-200' : 'text-white/90'}`}>
                  ({dateInfo.dayName})
                </span>
              </h2>
              <p className="text-[10px] lg:text-xs text-white/80 mt-0.5">利用予定の登録・編集</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={handleResetDay}
              disabled={processing}
              className="flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-md transition-colors disabled:opacity-50 flex-1 lg:flex-initial"
            >
              <Trash2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">この日をリセット</span>
              <span className="lg:hidden">リセット</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 lg:p-2 hover:bg-white/20 rounded-md transition-colors"
            >
              <X className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* 左側: 児童一覧（デスクトップのみ表示） */}
          <div className="hidden lg:flex w-72 border-r border-gray-200 flex-col bg-gray-50">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">登録可能な児童</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="児童名で検索..."
                  value={childSearchQuery}
                  onChange={(e) => setChildSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] shadow-sm"
                />
              </div>
              {selectedSlotForQuickAdd && (
                <div className="mt-2 text-xs text-[#00c4cc] font-semibold">
                  {selectedSlotForQuickAdd === 'AM' ? '午前' : '午後'}枠を選択中
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {availableChildrenForList.withPattern.length === 0 && availableChildrenForList.withoutPattern.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {childSearchQuery ? (
                    <p>「{childSearchQuery}」に一致する児童が見つかりません</p>
                  ) : (
                    <p>登録可能な児童がいません</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* パターン一致セクション */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                        {dateInfo.dayName}曜の利用パターン設定児童
                        <span className="text-[10px] font-normal text-gray-400 ml-1">({availableChildrenForList.withPattern.length})</span>
                      </span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    {availableChildrenForList.withPattern.length === 0 ? (
                      <div className="text-center py-3 text-xs text-gray-400">
                        該当者なし
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {availableChildrenForList.withPattern.map(child => {
                          const patternMatchAM = isPatternMatch(child, 'AM');
                          const patternMatchPM = isPatternMatch(child, 'PM');
                          const ageDisplay = child.birthDate ? calculateAgeWithMonths(child.birthDate).display : child.age ? `${child.age}歳` : null;
                          
                          return (
                            <div
                              key={child.id}
                              draggable
                              onDragStart={() => handleChildDragStart(child)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleChildClick(child)}
                              className={`
                                relative group flex items-center space-x-3 px-3 py-2.5 rounded-md transition-all cursor-grab active:cursor-grabbing
                                bg-white border border-gray-200 hover:bg-gray-50 hover:border-[#00c4cc]/30 hover:shadow-sm
                                ${selectedSlotForQuickAdd && isPatternMatch(child, selectedSlotForQuickAdd) ? 'ring-1 ring-yellow-400 bg-yellow-50/50' : ''}
                              `}
                            >
                              <span className="font-medium text-sm text-gray-700 flex-1 text-left">
                                {child.name}
                                {ageDisplay && (
                                  <span className="text-xs font-normal text-gray-500 ml-1.5">({ageDisplay})</span>
                                )}
                              </span>
                              {(child.needsPickup || child.needsDropoff) && (
                                <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="flex gap-1">
                                {patternMatchAM && patternMatchPM ? (
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                                    終日
                                  </span>
                                ) : patternMatchAM ? (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                                    午前
                                  </span>
                                ) : patternMatchPM ? (
                                  <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                                    午後
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* その他の児童セクション */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">その他</span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    {availableChildrenForList.withoutPattern.length === 0 ? (
                      <div className="text-center py-3 text-xs text-gray-400">
                        該当者なし
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {availableChildrenForList.withoutPattern.map(child => {
                          const ageDisplay = child.birthDate ? calculateAgeWithMonths(child.birthDate).display : child.age ? `${child.age}歳` : null;
                          
                          return (
                            <div
                              key={child.id}
                              draggable
                              onDragStart={() => handleChildDragStart(child)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleChildClick(child)}
                              className="relative group flex items-center space-x-3 px-3 py-2.5 rounded-md transition-all cursor-grab active:cursor-grabbing bg-white border border-gray-200 hover:bg-gray-50 hover:border-[#00c4cc]/30 hover:shadow-sm"
                            >
                              <span className="font-medium text-sm text-gray-700 flex-1 text-left">
                                {child.name}
                                {ageDisplay && (
                                  <span className="text-xs font-normal text-gray-500 ml-1.5">({ageDisplay})</span>
                                )}
                              </span>
                              {(child.needsPickup || child.needsDropoff) && (
                                <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右側: 午前・午後の枠 */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
            {/* 午前 */}
            {renderSlotSection('AM')}

            {/* 午後 */}
            {renderSlotSection('PM')}
          </div>
        </div>

        {/* フッター */}
        <div className="px-3 lg:px-6 py-2 lg:py-3 border-t border-gray-200 bg-gray-50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 lg:gap-0">
          <div className="text-xs lg:text-sm text-gray-600">
            登録済み: <span className="font-semibold text-gray-800">{registeredChildIds.length}名</span>
            <span className="text-[10px] lg:text-xs text-gray-500 ml-1 lg:ml-2">（午前{schedulesBySlot.AM.length}名 / 午後{schedulesBySlot.PM.length}名）</span>
          </div>
          <button
            onClick={onClose}
            className="w-full lg:w-auto px-4 py-2 text-sm font-medium text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-md transition-colors shadow-sm"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* 児童選択ポップアップ */}
      <ChildPickerPopup
        isOpen={!!pickerSlot}
        onClose={() => setPickerSlot(null)}
        childList={childList}
        targetSlot={pickerSlot || 'AM'}
        date={date}
        alreadyRegisteredIds={
          pickerSlot === 'AM'
            ? schedulesBySlot.AM.map(s => s.childId)
            : pickerSlot === 'PM'
              ? schedulesBySlot.PM.map(s => s.childId)
              : []
        }
        onSelect={(childIds) => handleAddChildren(childIds, pickerSlot!)}
      />

      {/* 処理中オーバーレイ */}
      {processing && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg px-6 py-4 shadow-lg">
            <div className="animate-spin w-6 h-6 border-2 border-[#00c4cc] border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-600">処理中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
