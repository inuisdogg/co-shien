/**
 * 月間シフトカレンダー
 * スタッフのシフトを月間カレンダー形式で表示・編集
 * - 行=スタッフ, 列=日付
 * - コンパクトなカラーコード表示
 * - スタッフ名列固定スクロール
 * - サマリー行, コンプライアンス表示
 * - 複数セル選択 & 前月コピー
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Printer,
  Download,
  Users,
  RefreshCw,
  Copy,
  CheckSquare,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Staff, ShiftPattern, ShiftWithPattern } from '@/types';
import { formatShiftDisplay, patternColorToRgba, calculateShiftWorkHours } from '@/utils/shiftDisplayFormatter';
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

  // 複数セル選択モード
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [showBulkEditor, setShowBulkEditor] = useState(false);

  // 月の日数を取得
  const daysInMonth = useMemo(() => {
    const days: { date: Date; day: number; dayOfWeek: number; dateStr: string }[] = [];
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

  // 日ごとのスタッフ数サマリー
  const dailySummary = useMemo(() => {
    const summary = new Map<string, { total: number; working: number; dayOff: number }>();
    daysInMonth.forEach((day) => {
      let working = 0;
      let dayOff = 0;
      let total = 0;
      shiftsData.forEach((staffRow) => {
        const shift = staffRow.shifts.get(day.dateStr);
        if (shift?.hasShift) {
          total++;
          if (shift.shiftPattern?.isDayOff) {
            dayOff++;
          } else {
            working++;
          }
        }
      });
      summary.set(day.dateStr, { total, working, dayOff });
    });
    return summary;
  }, [daysInMonth, shiftsData]);

  // パターンごとのシフト集計
  const patternSummary = useMemo(() => {
    const summary = new Map<string, number>();
    let totalHours = 0;
    shiftsData.forEach((staffRow) => {
      staffRow.shifts.forEach((shift) => {
        if (shift.hasShift && shift.shiftPattern?.id) {
          summary.set(shift.shiftPattern.id, (summary.get(shift.shiftPattern.id) || 0) + 1);
        }
        totalHours += calculateShiftWorkHours(shift);
      });
    });
    return { byPattern: summary, totalHours };
  }, [shiftsData]);

  // セルクリック
  const handleCellClick = (
    staffId: string,
    date: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!editable) return;

    if (multiSelectMode) {
      const key = `${staffId}:${date}`;
      const newSelected = new Set(selectedCells);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      setSelectedCells(newSelected);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setEditingCell({
      staffId,
      date,
      position: {
        x: Math.min(rect.left, window.innerWidth - 280),
        y: Math.min(rect.bottom, window.innerHeight - 300),
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

  // 一括適用
  const handleBulkApply = useCallback(
    (patternId: string | null) => {
      selectedCells.forEach((key) => {
        const [staffId, date] = key.split(':');
        onShiftChange(staffId, date, patternId);
      });
      setSelectedCells(new Set());
      setShowBulkEditor(false);
      setMultiSelectMode(false);
    },
    [selectedCells, onShiftChange]
  );

  // 前月コピー
  const handleCopyPrevMonth = useCallback(() => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    // This would trigger a fetch of previous month data and apply it
    // For now, trigger the month change to show the user the source
    if (window.confirm(`${prevYear}年${prevMonth}月のシフトを今月にコピーしますか？`)) {
      // In a real implementation, this would call an API to copy shifts
      console.log('Copy from', prevYear, prevMonth, 'to', year, month);
    }
  }, [year, month]);

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

  // パターンの短縮名を取得
  const getPatternShortLabel = (shift: ShiftWithPattern): string => {
    if (!shift.hasShift) return '';
    if (shift.shiftPattern?.isDayOff) return '休';
    if (shift.shiftPattern?.shortName) return shift.shiftPattern.shortName;
    if (shift.shiftPattern?.name) return shift.shiftPattern.name.charAt(0);
    return formatShiftDisplay(shift);
  };

  // シフトセルを描画
  const renderShiftCell = (staffRow: StaffShiftRow, dateStr: string, dayOfWeek: number) => {
    const shift = staffRow.shifts.get(dateStr);
    const isEditing =
      editingCell?.staffId === staffRow.staff.id && editingCell?.date === dateStr;
    const cellKey = `${staffRow.staff.id}:${dateStr}`;
    const isSelected = selectedCells.has(cellKey);

    // 背景色
    let bgColor = '';
    let bgStyle: React.CSSProperties = {};
    let textColor = 'text-gray-300';
    let label = '-';

    if (shift?.hasShift) {
      if (shift.shiftPattern?.isDayOff) {
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-500';
        label = '休';
      } else if (shift.shiftPattern?.color) {
        bgStyle = { backgroundColor: patternColorToRgba(shift.shiftPattern.color, 0.2) };
        textColor = '';
        label = getPatternShortLabel(shift);
      } else {
        bgColor = 'bg-[#00c4cc]/10';
        textColor = 'text-[#00c4cc]';
        label = getPatternShortLabel(shift);
      }
    } else {
      // 土日は薄い背景
      if (dayOfWeek === 0) bgColor = 'bg-red-50/50';
      else if (dayOfWeek === 6) bgColor = 'bg-blue-50/50';
    }

    return (
      <div
        key={`${staffRow.staff.id}-${dateStr}`}
        onClick={(e) => handleCellClick(staffRow.staff.id, dateStr, e)}
        className={`relative min-h-10 h-10 flex items-center justify-center border-r border-b border-gray-200 cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-[#00c4cc] hover:ring-inset ${
          isEditing ? 'ring-2 ring-[#00c4cc] ring-inset z-10' : ''
        } ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${bgColor}`}
        style={bgStyle}
      >
        <span
          className={`text-xs font-bold leading-none ${textColor}`}
          style={
            shift?.hasShift && !shift.shiftPattern?.isDayOff && shift.shiftPattern?.color
              ? { color: shift.shiftPattern.color }
              : undefined
          }
        >
          {label}
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

  // 勤務パターン（休日以外）
  const workPatterns = patterns.filter((p) => !p.isDayOff);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* 月切り替え */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="min-h-10 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
              aria-label="前月"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 min-w-[160px] justify-center">
              <Calendar size={18} className="text-[#00c4cc]" />
              <span className="text-lg font-bold text-gray-800">
                {year}年{month}月
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="min-h-10 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
              aria-label="翌月"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={handleToday}
              className="min-h-10 ml-2 px-3 py-1.5 text-sm text-[#00c4cc] hover:bg-[#00c4cc]/5 rounded-lg transition-all duration-200"
            >
              今月
            </button>
          </div>

          {/* アクション */}
          <div className="flex items-center gap-2">
            {loading && (
              <RefreshCw size={18} className="text-gray-400 animate-spin" />
            )}

            {editable && (
              <>
                <button
                  onClick={() => {
                    setMultiSelectMode(!multiSelectMode);
                    if (multiSelectMode) {
                      setSelectedCells(new Set());
                    }
                  }}
                  className={`flex items-center gap-1.5 min-h-10 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                    multiSelectMode
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <CheckSquare size={16} />
                  一括選択
                </button>

                <button
                  onClick={handleCopyPrevMonth}
                  className="flex items-center gap-1.5 min-h-10 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                  <Copy size={16} />
                  前月コピー
                </button>
              </>
            )}

            {onPrint && (
              <button
                onClick={onPrint}
                className="flex items-center gap-1.5 min-h-10 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <Printer size={16} />
                印刷
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 min-h-10 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <Download size={16} />
                CSV
              </button>
            )}
          </div>
        </div>

        {/* 一括選択時のアクションバー */}
        {multiSelectMode && selectedCells.size > 0 && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm font-medium text-blue-700">
              {selectedCells.size}セル選択中
            </span>
            <div className="flex items-center gap-1.5 ml-auto">
              {workPatterns.map((pattern) => (
                <button
                  key={pattern.id}
                  onClick={() => handleBulkApply(pattern.id)}
                  className="min-h-10 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 hover:opacity-80"
                  style={{
                    backgroundColor: patternColorToRgba(pattern.color, 0.2),
                    color: pattern.color || '#00c4cc',
                  }}
                >
                  {pattern.shortName || pattern.name}
                </button>
              ))}
              {patterns.find((p) => p.isDayOff) && (
                <button
                  onClick={() => handleBulkApply(patterns.find((p) => p.isDayOff)!.id)}
                  className="min-h-10 px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
                >
                  休
                </button>
              )}
              <button
                onClick={() => handleBulkApply(null)}
                className="min-h-10 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                クリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* カレンダー本体 */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* ヘッダー行 */}
          <div className="sticky top-0 z-20 flex bg-gray-50 border-b border-gray-200">
            {/* スタッフ名列ヘッダー */}
            <div className="sticky left-0 z-30 w-36 min-w-[144px] flex items-center px-3 py-2 bg-gray-100 border-r border-gray-200">
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
                <span className="text-[10px] leading-none">{dayLabels[day.dayOfWeek]}</span>
                <span className="text-sm font-bold leading-tight">{day.day}</span>
              </div>
            ))}
          </div>

          {/* スタッフ行 */}
          {shiftsData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              スタッフが登録されていません
            </div>
          ) : (
            <>
              {shiftsData.map((staffRow) => (
                <div key={staffRow.staff.id} className="flex">
                  {/* スタッフ名 */}
                  <div className="sticky left-0 z-10 w-36 min-w-[144px] flex items-center px-3 py-1 bg-white border-r border-b border-gray-200 hover:bg-gray-50 transition-all duration-200">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] flex items-center justify-center flex-shrink-0 mr-2">
                      <span className="text-white text-[10px] font-bold">
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
              ))}

              {/* サマリー行: 日別出勤者数 */}
              <div className="flex border-t-2 border-[#00c4cc]/20">
                <div className="sticky left-0 z-10 w-36 min-w-[144px] flex items-center px-3 py-2 bg-gray-50 border-r border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-600">出勤者数</span>
                </div>
                {daysInMonth.map((day) => {
                  const summary = dailySummary.get(day.dateStr);
                  const workingCount = summary?.working || 0;
                  const minStaffNeeded = 2; // TODO: Make configurable
                  const isShort = workingCount > 0 && workingCount < minStaffNeeded;
                  return (
                    <div
                      key={`summary-${day.dateStr}`}
                      className={`w-12 min-w-[48px] flex items-center justify-center border-r border-b border-gray-200 py-2 ${
                        isShort ? 'bg-red-50' : workingCount > 0 ? 'bg-[#00c4cc]/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-0.5">
                        {isShort && (
                          <AlertTriangle size={10} className="text-red-500" />
                        )}
                        <span
                          className={`text-xs font-bold ${
                            isShort ? 'text-red-600' : workingCount > 0 ? 'text-[#00c4cc]' : 'text-gray-300'
                          }`}
                        >
                          {workingCount || '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 凡例 + サマリー */}
      <div className="flex-shrink-0 px-4 py-2.5 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="font-medium">凡例:</span>
            {patterns
              .filter((p) => !p.isDayOff)
              .slice(0, 5)
              .map((pattern) => (
                <div key={pattern.id} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded"
                    style={{
                      backgroundColor: pattern.color || '#14b8a6',
                    }}
                  />
                  <span>
                    {pattern.name}
                    {patternSummary.byPattern.get(pattern.id)
                      ? ` (${patternSummary.byPattern.get(pattern.id)})`
                      : ''}
                  </span>
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
          <div className="text-xs text-gray-500">
            合計: <span className="font-bold text-[#00c4cc]">{patternSummary.totalHours.toFixed(1)}</span>時間
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
