/**
 * 月間シフトカレンダー
 * スタッフのシフトを月間カレンダー形式で表示・編集
 * 時間表記（9-17形式）で表示
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Printer,
  Download,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Staff, ShiftPattern, ShiftWithPattern } from '@/types';
import { formatShiftDisplay, patternColorToRgba } from '@/utils/shiftDisplayFormatter';
import ShiftCellEditor from './ShiftCellEditor';

interface StaffShiftRow {
  staff: Staff;
  shifts: Map<string, ShiftWithPattern>; // date -> shift
}

interface MonthlyShiftCalendarProps {
  year: number;
  month: number;
  staffList: Staff[];
  shiftsData: StaffShiftRow[];
  patterns: ShiftPattern[];
  onMonthChange: (year: number, month: number) => void;
  onShiftChange: (
    staffId: string,
    date: string,
    patternId: string | null,
    customTime?: { startTime: string; endTime: string }
  ) => void;
  onPrint?: () => void;
  onExport?: () => void;
  loading?: boolean;
  editable?: boolean;
}

const MonthlyShiftCalendar: React.FC<MonthlyShiftCalendarProps> = ({
  year,
  month,
  staffList,
  shiftsData,
  patterns,
  onMonthChange,
  onShiftChange,
  onPrint,
  onExport,
  loading = false,
  editable = true,
}) => {
  // 編集中のセル
  const [editingCell, setEditingCell] = useState<{
    staffId: string;
    date: string;
    position: { x: number; y: number };
  } | null>(null);

  // 月の日数を取得
  const daysInMonth = useMemo(() => {
    const days: { date: Date; day: number; dayOfWeek: number; dateStr: string }[] = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month - 1, d);
      days.push({
        date,
        day: d,
        dayOfWeek: date.getDay(),
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }

    return days;
  }, [year, month]);

  // 曜日ラベル
  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  // 曜日の色
  const getDayColor = (dayOfWeek: number) => {
    if (dayOfWeek === 0) return 'text-red-500';
    if (dayOfWeek === 6) return 'text-blue-500';
    return 'text-gray-700';
  };

  // セルクリック
  const handleCellClick = (
    staffId: string,
    date: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!editable) return;

    const rect = event.currentTarget.getBoundingClientRect();
    setEditingCell({
      staffId,
      date,
      position: {
        x: rect.left,
        y: rect.bottom,
      },
    });
  };

  // シフト変更
  const handleShiftSelect = (
    patternId: string | null,
    customTime?: { startTime: string; endTime: string }
  ) => {
    if (!editingCell) return;
    onShiftChange(editingCell.staffId, editingCell.date, patternId, customTime);
  };

  // 前月
  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  // 翌月
  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  // 今月
  const handleToday = () => {
    const today = new Date();
    onMonthChange(today.getFullYear(), today.getMonth() + 1);
  };

  // シフトセルを描画
  const renderShiftCell = (staffRow: StaffShiftRow, dateStr: string, dayOfWeek: number) => {
    const shift = staffRow.shifts.get(dateStr);
    const display = shift ? formatShiftDisplay(shift) : '-';
    const isEditing =
      editingCell?.staffId === staffRow.staff.id && editingCell?.date === dateStr;

    // 背景色
    let bgColor = 'bg-white';
    let bgStyle: React.CSSProperties = {};

    if (shift?.hasShift) {
      if (shift.shiftPattern?.isDayOff) {
        bgColor = 'bg-gray-100';
      } else if (shift.shiftPattern?.color) {
        bgStyle = { backgroundColor: patternColorToRgba(shift.shiftPattern.color, 0.15) };
      } else {
        bgColor = 'bg-teal-50';
      }
    }

    // 土日は薄い背景
    if (dayOfWeek === 0) {
      bgColor = shift?.hasShift ? bgColor : 'bg-red-50/50';
    } else if (dayOfWeek === 6) {
      bgColor = shift?.hasShift ? bgColor : 'bg-blue-50/50';
    }

    return (
      <div
        key={`${staffRow.staff.id}-${dateStr}`}
        onClick={(e) => handleCellClick(staffRow.staff.id, dateStr, e)}
        className={`relative h-10 flex items-center justify-center border-r border-b border-gray-200 cursor-pointer transition-all hover:ring-2 hover:ring-teal-400 hover:ring-inset ${
          isEditing ? 'ring-2 ring-teal-500 ring-inset z-10' : ''
        } ${bgColor}`}
        style={bgStyle}
      >
        <span
          className={`text-xs font-medium ${
            !shift?.hasShift
              ? 'text-gray-300'
              : shift.shiftPattern?.isDayOff
              ? 'text-gray-500'
              : 'text-gray-700'
          }`}
        >
          {display}
        </span>
      </div>
    );
  };

  // 編集中のシフトを取得
  const getEditingShift = (): ShiftWithPattern | undefined => {
    if (!editingCell) return undefined;

    const staffRow = shiftsData.find((sr) => sr.staff.id === editingCell.staffId);
    return staffRow?.shifts.get(editingCell.date);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* 月切り替え */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 min-w-[160px] justify-center">
              <Calendar size={18} className="text-teal-600" />
              <span className="text-lg font-bold text-gray-800">
                {year}年{month}月
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={handleToday}
              className="ml-2 px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
            >
              今月
            </button>
          </div>

          {/* アクション */}
          <div className="flex items-center gap-2">
            {loading && (
              <RefreshCw size={18} className="text-gray-400 animate-spin" />
            )}
            {onPrint && (
              <button
                onClick={onPrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Printer size={16} />
                印刷
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Download size={16} />
                CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* カレンダー本体 */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* ヘッダー行 */}
          <div className="sticky top-0 z-20 flex bg-gray-50 border-b border-gray-200">
            {/* スタッフ名列ヘッダー */}
            <div className="sticky left-0 z-30 w-32 min-w-[128px] flex items-center px-3 py-2 bg-gray-100 border-r border-gray-200">
              <Users size={16} className="text-gray-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">
                スタッフ
              </span>
            </div>

            {/* 日付ヘッダー */}
            {daysInMonth.map((day) => (
              <div
                key={day.dateStr}
                className={`w-12 min-w-[48px] flex flex-col items-center py-1.5 border-r border-gray-200 ${getDayColor(
                  day.dayOfWeek
                )}`}
              >
                <span className="text-xs">{dayLabels[day.dayOfWeek]}</span>
                <span className="text-sm font-bold">{day.day}</span>
              </div>
            ))}
          </div>

          {/* スタッフ行 */}
          {shiftsData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              スタッフが登録されていません
            </div>
          ) : (
            shiftsData.map((staffRow) => (
              <div key={staffRow.staff.id} className="flex">
                {/* スタッフ名 */}
                <div className="sticky left-0 z-10 w-32 min-w-[128px] flex items-center px-3 py-1 bg-white border-r border-b border-gray-200">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0 mr-2">
                    <span className="text-white text-xs font-bold">
                      {staffRow.staff.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {staffRow.staff.name}
                  </span>
                </div>

                {/* シフトセル */}
                {daysInMonth.map((day) =>
                  renderShiftCell(staffRow, day.dateStr, day.dayOfWeek)
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-medium">凡例:</span>
          {patterns
            .filter((p) => !p.isDayOff)
            .slice(0, 4)
            .map((pattern) => (
              <div key={pattern.id} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: pattern.color || '#14b8a6',
                  }}
                />
                <span>{pattern.name}</span>
              </div>
            ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-300" />
            <span>休</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300">-</span>
            <span>未設定</span>
          </div>
        </div>
      </div>

      {/* セル編集ポップアップ */}
      {editingCell && (
        <ShiftCellEditor
          shift={getEditingShift()}
          patterns={patterns}
          onSelect={handleShiftSelect}
          onClose={() => setEditingCell(null)}
          position={editingCell.position}
        />
      )}
    </div>
  );
};

export default MonthlyShiftCalendar;
