/**
 * カレンダー形式の日程スロット選択コンポーネント
 * ホットペッパービューティ風のドラッグ選択対応
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export type DateSlot = {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
};

interface DateSlotPickerProps {
  selectedSlots: DateSlot[];
  onChange: (slots: DateSlot[]) => void;
}

// 時間スロット（30分刻み）
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00',
];

// 日付をYYYY-MM-DD形式に変換
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// 曜日名
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function DateSlotPicker({ selectedSlots, onChange }: DateSlotPickerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    return monday;
  });

  // ドラッグ選択用の状態
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ date: string; timeIndex: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ date: string; timeIndex: number } | null>(null);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const containerRef = useRef<HTMLDivElement>(null);

  // 週の日付を生成
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  // スロットが選択されているかチェック
  const isSlotSelected = useCallback((date: string, time: string): boolean => {
    return selectedSlots.some(
      (slot) => slot.date === date && slot.startTime === time
    );
  }, [selectedSlots]);

  // ドラッグ範囲内かチェック
  const isInDragRange = useCallback((date: string, timeIndex: number): boolean => {
    if (!isDragging || !dragStart || !dragEnd) return false;

    const startDateIndex = weekDates.findIndex(d => formatDate(d) === dragStart.date);
    const endDateIndex = weekDates.findIndex(d => formatDate(d) === dragEnd.date);
    const currentDateIndex = weekDates.findIndex(d => formatDate(d) === date);

    if (currentDateIndex < 0) return false;

    const minDateIndex = Math.min(startDateIndex, endDateIndex);
    const maxDateIndex = Math.max(startDateIndex, endDateIndex);
    const minTimeIndex = Math.min(dragStart.timeIndex, dragEnd.timeIndex);
    const maxTimeIndex = Math.max(dragStart.timeIndex, dragEnd.timeIndex);

    return (
      currentDateIndex >= minDateIndex &&
      currentDateIndex <= maxDateIndex &&
      timeIndex >= minTimeIndex &&
      timeIndex <= maxTimeIndex
    );
  }, [isDragging, dragStart, dragEnd, weekDates]);

  // マウスダウン
  const handleMouseDown = (date: string, timeIndex: number) => {
    const isSelected = isSlotSelected(date, TIME_SLOTS[timeIndex]);
    setDragMode(isSelected ? 'deselect' : 'select');
    setDragStart({ date, timeIndex });
    setDragEnd({ date, timeIndex });
    setIsDragging(true);
  };

  // マウスムーブ
  const handleMouseMove = (date: string, timeIndex: number) => {
    if (isDragging) {
      setDragEnd({ date, timeIndex });
    }
  };

  // マウスアップ
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      return;
    }

    const startDateIndex = weekDates.findIndex(d => formatDate(d) === dragStart.date);
    const endDateIndex = weekDates.findIndex(d => formatDate(d) === dragEnd.date);

    const minDateIndex = Math.min(startDateIndex, endDateIndex);
    const maxDateIndex = Math.max(startDateIndex, endDateIndex);
    const minTimeIndex = Math.min(dragStart.timeIndex, dragEnd.timeIndex);
    const maxTimeIndex = Math.max(dragStart.timeIndex, dragEnd.timeIndex);

    // 選択範囲のスロットを生成
    const newSlots: DateSlot[] = [];
    for (let di = minDateIndex; di <= maxDateIndex; di++) {
      const date = formatDate(weekDates[di]);
      for (let ti = minTimeIndex; ti <= maxTimeIndex; ti++) {
        newSlots.push({
          date,
          startTime: TIME_SLOTS[ti],
          endTime: TIME_SLOTS[ti + 1] || '19:00',
        });
      }
    }

    if (dragMode === 'select') {
      // 既存の選択と新しい選択をマージ（重複除去）
      const existingSet = new Set(selectedSlots.map(s => `${s.date}-${s.startTime}`));
      const mergedSlots = [...selectedSlots];
      newSlots.forEach(slot => {
        if (!existingSet.has(`${slot.date}-${slot.startTime}`)) {
          mergedSlots.push(slot);
        }
      });
      onChange(mergedSlots);
    } else {
      // 選択解除
      const removeSet = new Set(newSlots.map(s => `${s.date}-${s.startTime}`));
      onChange(selectedSlots.filter(s => !removeSet.has(`${s.date}-${s.startTime}`)));
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, dragMode, selectedSlots, weekDates, onChange]);

  // グローバルなマウスアップイベント
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  // 週を移動
  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  // 個別スロット削除
  const removeSlot = (date: string, startTime: string) => {
    onChange(selectedSlots.filter(s => !(s.date === date && s.startTime === startTime)));
  };

  // 選択済みスロットをグループ化（連続するスロットをまとめる）
  const groupedSlots = selectedSlots
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    })
    .reduce<DateSlot[]>((groups, slot) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === slot.date && lastGroup.endTime === slot.startTime) {
        // 連続するスロットをマージ
        lastGroup.endTime = slot.endTime;
      } else {
        groups.push({ ...slot });
      }
      return groups;
    }, []);

  const today = formatDate(new Date());

  return (
    <div className="space-y-4">
      {/* カレンダーヘッダー */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="font-medium text-gray-800">
          {currentWeekStart.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}
        </span>
        <button
          type="button"
          onClick={goToNextWeek}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* カレンダーグリッド */}
      <div
        ref={containerRef}
        className="border border-gray-200 rounded-lg overflow-hidden select-none"
        onMouseLeave={() => isDragging && setDragEnd(dragStart)}
      >
        {/* 日付ヘッダー */}
        <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-200">
          <div className="p-2 text-center text-xs text-gray-500 border-r border-gray-200">
            時間
          </div>
          {weekDates.map((date) => {
            const dateStr = formatDate(date);
            const isToday = dateStr === today;
            const isPast = dateStr < today;
            return (
              <div
                key={dateStr}
                className={`p-2 text-center border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-cyan-50' : ''
                } ${isPast ? 'opacity-50' : ''}`}
              >
                <div className={`text-xs ${isToday ? 'text-cyan-600 font-bold' : 'text-gray-500'}`}>
                  {WEEKDAYS[date.getDay()]}
                </div>
                <div className={`text-sm font-medium ${isToday ? 'text-cyan-600' : 'text-gray-800'}`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* 時間スロット */}
        <div className="max-h-[400px] overflow-y-auto">
          {TIME_SLOTS.map((time, timeIndex) => (
            <div key={time} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
              <div className="p-1 text-center text-xs text-gray-400 border-r border-gray-200 bg-gray-50">
                {time}
              </div>
              {weekDates.map((date) => {
                const dateStr = formatDate(date);
                const isPast = dateStr < today;
                const isSelected = isSlotSelected(dateStr, time);
                const inDragRange = isInDragRange(dateStr, timeIndex);
                const showAsSelected = dragMode === 'select' ? (isSelected || inDragRange) : (isSelected && !inDragRange);

                return (
                  <div
                    key={`${dateStr}-${time}`}
                    className={`p-1 border-r border-gray-100 last:border-r-0 h-8 cursor-pointer transition-colors ${
                      isPast
                        ? 'bg-gray-100 cursor-not-allowed'
                        : showAsSelected
                        ? 'bg-cyan-500'
                        : inDragRange
                        ? 'bg-cyan-200'
                        : 'hover:bg-cyan-100'
                    }`}
                    onMouseDown={() => !isPast && handleMouseDown(dateStr, timeIndex)}
                    onMouseMove={() => !isPast && handleMouseMove(dateStr, timeIndex)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 操作説明 */}
      <p className="text-xs text-gray-500">
        クリックまたはドラッグで日程を選択できます。選択済みの箇所をドラッグすると選択解除できます。
      </p>

      {/* 選択済みスロット一覧 */}
      {groupedSlots.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            選択済み日程 ({groupedSlots.length}件)
          </h4>
          <div className="flex flex-wrap gap-2">
            {groupedSlots.map((slot) => (
              <div
                key={`${slot.date}-${slot.startTime}`}
                className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-sm"
              >
                <span className="text-gray-800">
                  {new Date(slot.date).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
                <span className="text-gray-500">
                  {slot.startTime}
                  {slot.endTime && ` - ${slot.endTime}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // グループ化されたスロットを全て削除
                    const startIdx = TIME_SLOTS.indexOf(slot.startTime);
                    const endIdx = slot.endTime ? TIME_SLOTS.indexOf(slot.endTime) : startIdx + 1;
                    const timesToRemove = TIME_SLOTS.slice(startIdx, endIdx);
                    onChange(selectedSlots.filter(s =>
                      !(s.date === slot.date && timesToRemove.includes(s.startTime))
                    ));
                  }}
                  className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
