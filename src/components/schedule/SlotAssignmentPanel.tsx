/**
 * スロット割り当てパネル
 * 日付クリック時に開くフルスクリーンモーダル
 * 児童を各時間枠に割り当てる
 * 左側に児童一覧（曜日パターン優先）、右側に午前・午後の枠（送迎エリア含む）を表示
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { X, Plus, Trash2, Car, Calendar, AlertTriangle, Search, ArrowRight, ArrowLeft, Users } from 'lucide-react';
import { TimeSlot, ScheduleItem, Child, UsageRecord } from '@/types';
import ChildCard from './ChildCard';
import ChildPickerPopup, { SelectedChildWithTransport } from './ChildPickerPopup';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';

// ドロップターゲットの種類
type DropTarget = {
  slot: TimeSlot;
  transport: 'pickup' | 'none' | 'dropoff' | 'both';
};

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
  onUpdateTransport?: (id: string, hasPickup: boolean, hasDropoff: boolean) => Promise<void>;
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
  onUpdateTransport,
  getUsageRecordByScheduleId,
  onScheduleItemClick,
}: SlotAssignmentPanelProps) {
  const [pickerSlot, setPickerSlot] = useState<TimeSlot | null>(null);
  const [draggedItem, setDraggedItem] = useState<ScheduleItem | null>(null);
  const [draggedChild, setDraggedChild] = useState<Child | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DropTarget | null>(null);
  const [processing, setProcessing] = useState(false);
  const [childSearchQuery, setChildSearchQuery] = useState('');

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

  // 曜日パターン設定済みの児童（未登録のみ）
  const patternChildren = useMemo(() => {
    const registeredIds = [...schedulesBySlot.AM, ...schedulesBySlot.PM].map(s => s.childId);
    return childList.filter(c =>
      !registeredIds.includes(c.id) &&
      c.patternDays?.includes(dateInfo.dayOfWeek)
    ).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [childList, schedulesBySlot, dateInfo.dayOfWeek]);

  // その他の児童（未登録のみ）
  const otherChildren = useMemo(() => {
    const registeredIds = [...schedulesBySlot.AM, ...schedulesBySlot.PM].map(s => s.childId);
    let filtered = childList.filter(c =>
      !registeredIds.includes(c.id) &&
      !c.patternDays?.includes(dateInfo.dayOfWeek)
    );

    if (childSearchQuery.trim()) {
      const query = childSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.nameKana?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [childList, schedulesBySlot, dateInfo.dayOfWeek, childSearchQuery]);

  // 児童追加（送迎オプション付き）
  const handleAddChildrenWithTransport = async (children: SelectedChildWithTransport[], slot: TimeSlot) => {
    setProcessing(true);
    try {
      for (const { childId, hasPickup, hasDropoff } of children) {
        const child = childList.find(c => c.id === childId);
        if (!child) continue;

        await onAddSchedule({
          date,
          childId: child.id,
          childName: child.name,
          slot,
          hasPickup,
          hasDropoff,
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
    if (hasRecord) return;
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
    setDragOverTarget(null);
  };

  // ドロップ処理
  const handleDrop = async (target: DropTarget) => {
    const { slot, transport } = target;
    const hasPickup = transport === 'pickup' || transport === 'both';
    const hasDropoff = transport === 'dropoff' || transport === 'both';

    if (draggedItem) {
      // 既存スケジュールの移動/更新
      setProcessing(true);
      try {
        // スロット移動が必要な場合
        if (draggedItem.slot !== slot) {
          await onMoveSchedule(draggedItem.id, slot);
        }
        // 送迎設定の更新
        if (onUpdateTransport) {
          await onUpdateTransport(draggedItem.id, hasPickup, hasDropoff);
        } else {
          // onUpdateTransportがない場合は、削除して再登録
          const child = childList.find(c => c.id === draggedItem.childId);
          if (child && (draggedItem.hasPickup !== hasPickup || draggedItem.hasDropoff !== hasDropoff)) {
            await onDeleteSchedule(draggedItem.id);
            await onAddSchedule({
              date,
              childId: child.id,
              childName: child.name,
              slot,
              hasPickup,
              hasDropoff,
            });
          }
        }
      } finally {
        setProcessing(false);
        handleDragEnd();
      }
    } else if (draggedChild) {
      // 新規登録
      setProcessing(true);
      try {
        await onAddSchedule({
          date,
          childId: draggedChild.id,
          childName: draggedChild.name,
          slot,
          hasPickup,
          hasDropoff,
        });
      } finally {
        setProcessing(false);
        handleDragEnd();
      }
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

  // ドロップエリアのレンダリング
  const renderDropArea = (slot: TimeSlot, transport: 'pickup' | 'none' | 'dropoff' | 'both', label: string, icon?: React.ReactNode) => {
    const target: DropTarget = { slot, transport };
    const isOver = dragOverTarget?.slot === slot && dragOverTarget?.transport === transport;
    const isDragging = !!(draggedItem || draggedChild);

    // このエリアに該当するスケジュール
    const areaSchedules = schedulesBySlot[slot].filter(s => {
      if (transport === 'both') return s.hasPickup && s.hasDropoff;
      if (transport === 'pickup') return s.hasPickup && !s.hasDropoff;
      if (transport === 'dropoff') return s.hasDropoff && !s.hasPickup;
      if (transport === 'none') return !s.hasPickup && !s.hasDropoff;
      return false;
    });

    const allSchedules = areaSchedules;

    return (
      <div
        className={`
          flex-1 min-h-[100px] rounded-lg border-2 border-dashed p-2 transition-all
          ${isOver && isDragging
            ? 'border-[#00c4cc] bg-[#00c4cc]/10'
            : 'border-gray-200 bg-gray-50/50'
          }
          ${isDragging ? 'hover:border-[#00c4cc]/50 hover:bg-[#00c4cc]/5' : ''}
        `}
        onDragOver={(e) => {
          e.preventDefault();
          if (isDragging) {
            setDragOverTarget(target);
          }
        }}
        onDragLeave={() => setDragOverTarget(null)}
        onDrop={() => handleDrop(target)}
      >
        {/* エリアラベル */}
        <div className="flex items-center gap-1 mb-2 text-xs text-gray-500">
          {icon}
          <span className="font-medium">{label}</span>
        </div>

        {/* 登録済み児童 */}
        <div className="flex flex-wrap gap-1.5">
          {allSchedules.map(schedule => {
            const child = childList.find(c => c.id === schedule.childId);
            if (!child) return null;

            const hasRecord = !!getUsageRecordByScheduleId(schedule.id);
            const hasBoth = schedule.hasPickup && schedule.hasDropoff;

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
                compact
                showBothTransport={hasBoth}
              />
            );
          })}
        </div>
      </div>
    );
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

    return (
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        {/* ヘッダー（1行にまとめる） */}
        <div className={`px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 ${
          slot === 'AM' ? 'bg-blue-50 border-b border-blue-100' : 'bg-orange-50 border-b border-orange-100'
        }`}>
          <div className="flex items-center gap-3">
            <h3 className={`font-bold text-sm ${slot === 'AM' ? 'text-blue-800' : 'text-orange-800'}`}>
              {slot === 'AM' ? '午前' : '午後'}
            </h3>
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              <span className={`text-xs font-medium ${isFull ? 'text-red-600' : 'text-gray-600'}`}>
                {slotSchedules.length}/{slotCapacity}
              </span>
              {remaining > 0 && (
                <span className="text-xs text-gray-400 ml-1">残{remaining}</span>
              )}
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-3 text-xs">
              <span className={`flex items-center gap-1 ${isOverPickup ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                <ArrowRight className="w-3 h-3" />
                迎{stats.pickup}/{transportCapacity.pickup}
                {isOverPickup && <AlertTriangle className="w-3 h-3" />}
              </span>
              <span className={`flex items-center gap-1 ${isOverDropoff ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                <ArrowLeft className="w-3 h-3" />
                送{stats.dropoff}/{transportCapacity.dropoff}
                {isOverDropoff && <AlertTriangle className="w-3 h-3" />}
              </span>
            </div>
          </div>

          {/* 追加ボタン */}
          {!isFull && (
            <button
              onClick={() => setPickerSlot(slot)}
              disabled={processing}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              追加
            </button>
          )}
        </div>

        {/* ドロップエリア（4列） */}
        <div className="p-3 flex gap-2">
          {renderDropArea(slot, 'both', '迎送あり', <Car className="w-3 h-3 text-purple-600" />)}
          {renderDropArea(slot, 'pickup', 'お迎えのみ', <ArrowRight className="w-3 h-3 text-green-600" />)}
          {renderDropArea(slot, 'dropoff', 'お送りのみ', <ArrowLeft className="w-3 h-3 text-blue-600" />)}
          {renderDropArea(slot, 'none', '送迎なし', <Car className="w-3 h-3 text-gray-400 opacity-50" />)}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 lg:p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] lg:max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        {/* ヘッダー */}
        <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#00c4cc] to-[#00b0b8]">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">
                {dateInfo.year}年{dateInfo.month}月{dateInfo.day}日
                <span className={`ml-2 text-sm font-normal ${dateInfo.isWeekend ? 'text-yellow-200' : 'text-white/90'}`}>
                  ({dateInfo.dayName})
                </span>
              </h2>
              <p className="text-xs text-white/80">ドラッグ&ドロップで登録・送迎設定を変更</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDay}
              disabled={processing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              リセット
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* 左側: 児童一覧 */}
          <div className="lg:w-72 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col bg-white max-h-[250px] lg:max-h-none">
            {/* 検索 */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="児童名で検索..."
                  value={childSearchQuery}
                  onChange={(e) => setChildSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* 曜日パターン児童セクション */}
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2">
                  {dateInfo.dayName}曜の利用パターン ({patternChildren.length}名)
                </p>
                {patternChildren.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">該当の児童はいません</p>
                ) : (
                  <div className="space-y-1">
                    {patternChildren.map(child => {
                      const patternMatchAM = isPatternMatch(child, 'AM');
                      const patternMatchPM = isPatternMatch(child, 'PM');

                      return (
                        <div
                          key={child.id}
                          draggable
                          onDragStart={() => handleChildDragStart(child)}
                          onDragEnd={handleDragEnd}
                          className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <span className="font-medium text-sm text-gray-800 flex-1 truncate">
                            {child.name}
                          </span>
                          {(child.needsPickup || child.needsDropoff) && (
                            <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-[10px] text-gray-500">
                            {patternMatchAM && patternMatchPM ? '終日' : patternMatchAM ? '午前' : '午後'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* その他の児童セクション */}
              <div className="p-3">
                <p className="text-xs text-gray-500 mb-2">
                  その他の児童 ({otherChildren.length}名)
                </p>
                {otherChildren.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">
                    {childSearchQuery ? `「${childSearchQuery}」該当なし` : '該当の児童はいません'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {otherChildren.map(child => {
                      const ageDisplay = child.birthDate ? calculateAgeWithMonths(child.birthDate).display : child.age ? `${child.age}歳` : null;

                      return (
                        <div
                          key={child.id}
                          draggable
                          onDragStart={() => handleChildDragStart(child)}
                          onDragEnd={handleDragEnd}
                          className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <span className="font-medium text-sm text-gray-800 flex-1 truncate">
                            {child.name}
                            {ageDisplay && (
                              <span className="text-xs font-normal text-gray-400 ml-1">({ageDisplay})</span>
                            )}
                          </span>
                          {(child.needsPickup || child.needsDropoff) && (
                            <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右側: 午前・午後の枠 */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4">
            {renderSlotSection('AM')}
            {renderSlotSection('PM')}
          </div>
        </div>

        {/* フッター */}
        <div className="px-4 lg:px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            登録済み: <span className="font-bold text-gray-800">{registeredChildIds.length}名</span>
            <span className="text-xs text-gray-500 ml-2">（午前{schedulesBySlot.AM.length} / 午後{schedulesBySlot.PM.length}）</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors shadow-sm"
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
        onSelect={(childIds) => handleAddChildrenWithTransport(
          childIds.map(id => {
            const child = childList.find(c => c.id === id);
            return {
              childId: id,
              hasPickup: child?.needsPickup || false,
              hasDropoff: child?.needsDropoff || false,
            };
          }),
          pickerSlot!
        )}
        onSelectWithTransport={(children) => handleAddChildrenWithTransport(children, pickerSlot!)}
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
