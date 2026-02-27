/**
 * 月間シフトカレンダー
 * スタッフのシフトを月間カレンダー形式で表示・編集
 * - 行=スタッフ, 列=日付
 * - コンパクトなカラーコード表示
 * - スタッフ名列固定スクロール + ヘッダー固定
 * - スタッフ希望オーバーレイ + デフォルトパターン表示
 * - AM/PM内訳サマリー + スタッフ別月間稼働日数
 * - 複数セル選択, 前月コピー(プレビュー付き)
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
  X,
  Eye,
  Info,
} from 'lucide-react';
import { Staff, ShiftPattern, ShiftWithPattern, DefaultWorkPattern, StaffAvailabilityStatus } from '@/types';
import { formatShiftDisplay, patternColorToRgba, calculateShiftWorkHours } from '@/utils/shiftDisplayFormatter';
import ShiftCellEditor from './ShiftCellEditor';

// ---- helpers ----
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** Generate a compact label from a DefaultWorkPattern */
function formatDefaultPatternLabel(pattern?: DefaultWorkPattern): string {
  if (!pattern) return '';
  if (pattern.label) return pattern.label;

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const sortedDays = [...pattern.days].sort();

  // Detect contiguous ranges like 月-金
  let dayStr: string;
  if (sortedDays.length === 0) {
    dayStr = '';
  } else if (
    sortedDays.length > 2 &&
    sortedDays[sortedDays.length - 1] - sortedDays[0] === sortedDays.length - 1
  ) {
    dayStr = `${dayNames[sortedDays[0]]}-${dayNames[sortedDays[sortedDays.length - 1]]}`;
  } else {
    dayStr = sortedDays.map((d) => dayNames[d]).join('');
  }

  const typeStr =
    pattern.type === 'am' ? 'AM' : pattern.type === 'pm' ? 'PM' : 'Full';

  if (pattern.startTime && pattern.endTime) {
    const sh = pattern.startTime.split(':')[0].replace(/^0/, '');
    const eh = pattern.endTime.split(':')[0].replace(/^0/, '');
    return `${dayStr} ${sh}-${eh}`;
  }
  return `${dayStr} ${typeStr}`;
}

/** Get today's date string */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- sub-types ----
export interface StaffShiftRow {
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
  /** Called to copy previous month shifts (gets prev month shifts, should call bulkSetShifts) */
  onCopyPrevMonth?: (
    shiftsToCopy: Array<{ staffId: string; date: string; patternId: string | null }>
  ) => void;
  /** Previous month raw shifts for copy preview */
  prevMonthShifts?: ShiftWithPattern[];
  /** Staff availability statuses for this month */
  availabilityStatuses?: StaffAvailabilityStatus[];
  onPrint?: () => void;
  onExport?: () => void;
  loading?: boolean;
  editable?: boolean;
  /** Minimum staffing requirement per day */
  minStaffPerDay?: number;
}

// ==============================================================
// COMPONENT
// ==============================================================
const MonthlyShiftCalendar: React.FC<MonthlyShiftCalendarProps> = ({
  year,
  month,
  staffList,
  shiftsData,
  patterns,
  onMonthChange,
  onShiftChange,
  onCopyPrevMonth,
  prevMonthShifts,
  availabilityStatuses,
  onPrint,
  onExport,
  loading = false,
  editable = true,
  minStaffPerDay = 2,
}) => {
  // State
  const [editingCell, setEditingCell] = useState<{
    staffId: string;
    date: string;
    position: { x: number; y: number };
  } | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [showCopyPreview, setShowCopyPreview] = useState(false);
  const [showAvailability, setShowAvailability] = useState(true);
  const [tooltipStaffId, setTooltipStaffId] = useState<string | null>(null);

  const today = todayStr();

  // ---- Derived data ----
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

  // Build availability lookup: staffId -> Set<dateStr>
  const availabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!availabilityStatuses) return map;
    availabilityStatuses.forEach((status) => {
      const set = new Set(status.availableDates || []);
      map.set(status.staffId, set);
    });
    return map;
  }, [availabilityStatuses]);

  // Has availability data loaded
  const hasAvailabilityData = availabilityStatuses && availabilityStatuses.length > 0;

  // Day-of-week color
  const getDayColor = (dayOfWeek: number) => {
    if (dayOfWeek === 0) return 'text-red-500';
    if (dayOfWeek === 6) return 'text-blue-500';
    return 'text-gray-700';
  };

  // ---- Summaries ----
  // Daily summary: working count + AM/PM breakdown
  const dailySummary = useMemo(() => {
    const summary = new Map<
      string,
      { total: number; working: number; dayOff: number; am: number; pm: number; full: number }
    >();
    daysInMonth.forEach((day) => {
      let working = 0;
      let dayOff = 0;
      let total = 0;
      let am = 0;
      let pm = 0;
      let full = 0;

      shiftsData.forEach((staffRow) => {
        const shift = staffRow.shifts.get(day.dateStr);
        if (shift?.hasShift) {
          total++;
          if (shift.shiftPattern?.isDayOff) {
            dayOff++;
          } else {
            working++;
            // Determine AM/PM based on times
            const startTime = shift.startTime || shift.shiftPattern?.startTime;
            const endTime = shift.endTime || shift.shiftPattern?.endTime;
            if (startTime && endTime) {
              const startH = parseInt(startTime.split(':')[0], 10);
              const endH = parseInt(endTime.split(':')[0], 10);
              if (endH <= 13) {
                am++;
              } else if (startH >= 13) {
                pm++;
              } else {
                full++;
              }
            } else {
              full++;
            }
          }
        }
      });
      summary.set(day.dateStr, { total, working, dayOff, am, pm, full });
    });
    return summary;
  }, [daysInMonth, shiftsData]);

  // Staff monthly totals (working days)
  const staffMonthlyTotals = useMemo(() => {
    const totals = new Map<string, { workDays: number; totalHours: number }>();
    shiftsData.forEach((staffRow) => {
      let workDays = 0;
      let totalHours = 0;
      staffRow.shifts.forEach((shift) => {
        if (shift.hasShift && !shift.shiftPattern?.isDayOff) {
          workDays++;
          totalHours += calculateShiftWorkHours(shift);
        }
      });
      totals.set(staffRow.staff.id, { workDays, totalHours });
    });
    return totals;
  }, [shiftsData]);

  // Pattern summary
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

  // ---- Handlers ----
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

  const handleShiftSelect = (
    patternId: string | null,
    customTime?: { startTime: string; endTime: string }
  ) => {
    if (!editingCell) return;
    onShiftChange(editingCell.staffId, editingCell.date, patternId, customTime);
  };

  const handleBulkApply = useCallback(
    (patternId: string | null) => {
      selectedCells.forEach((key) => {
        const [staffId, date] = key.split(':');
        onShiftChange(staffId, date, patternId);
      });
      setSelectedCells(new Set());
      setMultiSelectMode(false);
    },
    [selectedCells, onShiftChange]
  );

  // ---- Previous month copy ----
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  // Build copy preview data
  const copyPreviewData = useMemo(() => {
    if (!prevMonthShifts || prevMonthShifts.length === 0) return [];

    // Map previous month shifts by staffId + day-of-week
    const prevShiftsByStaffDow = new Map<string, ShiftWithPattern>();
    prevMonthShifts.forEach((s) => {
      if (s.hasShift) {
        const dow = new Date(s.date).getDay();
        const key = `${s.staffId}:${dow}`;
        prevShiftsByStaffDow.set(key, s);
      }
    });

    // Generate new shifts for current month
    const result: Array<{ staffId: string; date: string; patternId: string | null; staffName: string; patternName: string }> = [];
    daysInMonth.forEach((day) => {
      staffList.forEach((staff) => {
        const key = `${staff.id}:${day.dayOfWeek}`;
        const prevShift = prevShiftsByStaffDow.get(key);
        if (prevShift && prevShift.shiftPatternId) {
          result.push({
            staffId: staff.id,
            date: day.dateStr,
            patternId: prevShift.shiftPatternId || null,
            staffName: staff.name,
            patternName: prevShift.shiftPattern?.name || '不明',
          });
        }
      });
    });

    return result;
  }, [prevMonthShifts, daysInMonth, staffList]);

  const handleCopyPrevMonth = useCallback(() => {
    if (onCopyPrevMonth && copyPreviewData.length > 0) {
      setShowCopyPreview(true);
    } else {
      // Fallback: simple confirmation
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      if (window.confirm(`${prevY}年${prevM}月のシフトを今月にコピーしますか？\n※前月シフトデータを読み込んでいない場合、コピーできません。`)) {
        // Copy previous month's shifts to current month
      }
    }
  }, [year, month, onCopyPrevMonth, copyPreviewData]);

  const handleConfirmCopy = useCallback(() => {
    if (onCopyPrevMonth && copyPreviewData.length > 0) {
      onCopyPrevMonth(
        copyPreviewData.map((d) => ({
          staffId: d.staffId,
          date: d.date,
          patternId: d.patternId,
        }))
      );
    }
    setShowCopyPreview(false);
  }, [onCopyPrevMonth, copyPreviewData]);

  // ---- Navigation ----
  const handlePrevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };
  const handleToday = () => {
    const t = new Date();
    onMonthChange(t.getFullYear(), t.getMonth() + 1);
  };

  // ---- Pattern label helpers ----
  const getPatternShortLabel = (shift: ShiftWithPattern): string => {
    if (!shift.hasShift) return '';
    if (shift.shiftPattern?.isDayOff) return '休';
    if (shift.shiftPattern?.shortName) return shift.shiftPattern.shortName;
    if (shift.shiftPattern?.name) return shift.shiftPattern.name.charAt(0);
    return formatShiftDisplay(shift);
  };

  // ---- Get default pattern info for a staff + day ----
  const getDefaultPatternForDay = (staff: Staff, dayOfWeek: number): DefaultWorkPattern | null => {
    const wp = staff.defaultWorkPattern;
    if (!wp) return null;
    if (wp.days.includes(dayOfWeek)) return wp;
    return null;
  };

  // ---- Shift cell render ----
  const renderShiftCell = (staffRow: StaffShiftRow, dateStr: string, dayOfWeek: number) => {
    const shift = staffRow.shifts.get(dateStr);
    const isEditing =
      editingCell?.staffId === staffRow.staff.id && editingCell?.date === dateStr;
    const cellKey = `${staffRow.staff.id}:${dateStr}`;
    const isSelected = selectedCells.has(cellKey);
    const isToday = dateStr === today;

    // Availability
    const staffAvail = availabilityMap.get(staffRow.staff.id);
    const hasAvail = staffAvail !== undefined;
    const isAvailable = staffAvail?.has(dateStr) ?? false;

    // Background
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
      if (dayOfWeek === 0) bgColor = 'bg-red-50/50';
      else if (dayOfWeek === 6) bgColor = 'bg-blue-50/50';
    }

    // Availability overlay colors (when showAvailability is on)
    if (showAvailability && hasAvail && shift?.hasShift && !shift.shiftPattern?.isDayOff) {
      if (!isAvailable) {
        // Shift assigned but staff NOT available -> light red
        bgStyle = {
          ...bgStyle,
          background: `linear-gradient(135deg, ${bgStyle.backgroundColor || 'rgba(239,68,68,0.12)'}, rgba(239,68,68,0.12))`,
        };
      }
    }

    // Availability dot
    const showAvailDot = showAvailability && hasAvail && !shift?.hasShift;

    return (
      <div
        key={`${staffRow.staff.id}-${dateStr}`}
        onClick={(e) => handleCellClick(staffRow.staff.id, dateStr, e)}
        className={`relative flex items-center justify-center border-r border-b border-gray-200 cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-[#00c4cc] hover:ring-inset ${
          isEditing ? 'ring-2 ring-[#00c4cc] ring-inset z-10' : ''
        } ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${bgColor}`}
        style={{ minHeight: '48px', height: '48px', minWidth: '60px', width: '60px', ...bgStyle }}
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

        {/* Availability indicator dot */}
        {showAvailDot && isAvailable && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-400" />
        )}
        {showAvailDot && !isAvailable && hasAvail && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-gray-300" />
        )}

        {/* Conflict indicator for assigned but not available */}
        {showAvailability && hasAvail && shift?.hasShift && !shift.shiftPattern?.isDayOff && !isAvailable && (
          <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-red-400" />
        )}
      </div>
    );
  };

  // ---- Get editing shift ----
  const getEditingShift = (): ShiftWithPattern | undefined => {
    if (!editingCell) return undefined;
    const staffRow = shiftsData.find((sr) => sr.staff.id === editingCell.staffId);
    return staffRow?.shifts.get(editingCell.date);
  };

  // ---- Get default pattern for editing cell ----
  const getEditingDefaultPattern = (): DefaultWorkPattern | null => {
    if (!editingCell) return null;
    const staff = staffList.find((s) => s.id === editingCell.staffId);
    if (!staff) return null;
    const dateObj = new Date(editingCell.date);
    return getDefaultPatternForDay(staff, dateObj.getDay());
  };

  // Patterns
  const workPatterns = patterns.filter((p) => !p.isDayOff);

  // Column widths
  const COL_W = 60; // px
  const STAFF_COL_W = 180; // px
  const TOTAL_COL_W = 64; // px - right side total column

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ===== HEADER ===== */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* Month navigation */}
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

          {/* Actions */}
          <div className="flex items-center gap-2">
            {loading && <RefreshCw size={18} className="text-gray-400 animate-spin" />}

            {/* Toggle availability overlay */}
            {hasAvailabilityData && (
              <button
                onClick={() => setShowAvailability(!showAvailability)}
                className={`flex items-center gap-1.5 min-h-10 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                  showAvailability
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Eye size={16} />
                希望表示
              </button>
            )}

            {editable && (
              <>
                <button
                  onClick={() => {
                    setMultiSelectMode(!multiSelectMode);
                    if (multiSelectMode) setSelectedCells(new Set());
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

        {/* Bulk selection action bar */}
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

      {/* ===== CALENDAR BODY ===== */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* ---- Header row (sticky) ---- */}
          <div className="sticky top-0 z-20 flex bg-gray-50 border-b-2 border-gray-300">
            {/* Staff column header */}
            <div
              className="sticky left-0 z-30 flex items-center px-3 py-2 bg-gray-100 border-r-2 border-gray-300"
              style={{ width: STAFF_COL_W, minWidth: STAFF_COL_W }}
            >
              <Users size={16} className="text-gray-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">スタッフ</span>
            </div>

            {/* Date headers */}
            {daysInMonth.map((day, idx) => {
              const isToday_ = day.dateStr === today;
              const isSunday = day.dayOfWeek === 0;
              const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
              // Add week separator after Sunday (except last)
              const showWeekSep = isSunday && idx < daysInMonth.length - 1;
              return (
                <div
                  key={day.dateStr}
                  className={`flex flex-col items-center py-1.5 border-r ${
                    showWeekSep ? 'border-r-2 border-r-gray-400' : 'border-r-gray-200'
                  } ${getDayColor(day.dayOfWeek)} ${isToday_ ? 'bg-[#00c4cc]/10' : isWeekend ? 'bg-gray-100' : ''}`}
                  style={{ width: COL_W, minWidth: COL_W }}
                >
                  <span className="text-[10px] leading-none">{DAY_LABELS[day.dayOfWeek]}</span>
                  <span className={`text-sm font-bold leading-tight ${isToday_ ? 'text-[#00c4cc]' : ''}`}>
                    {day.day}
                  </span>
                </div>
              );
            })}

            {/* Total column header */}
            <div
              className="flex items-center justify-center py-1.5 bg-gray-100 border-l-2 border-gray-300"
              style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
            >
              <span className="text-[10px] font-bold text-gray-500">稼働日</span>
            </div>
          </div>

          {/* ---- Staff rows ---- */}
          {shiftsData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              スタッフが登録されていません
            </div>
          ) : (
            <>
              {shiftsData.map((staffRow) => {
                const dwp = staffRow.staff.defaultWorkPattern;
                const compactLabel = formatDefaultPatternLabel(dwp);
                const monthTotal = staffMonthlyTotals.get(staffRow.staff.id);

                return (
                  <div key={staffRow.staff.id} className="flex">
                    {/* Staff name (sticky) */}
                    <div
                      className="sticky left-0 z-10 flex items-center px-3 py-1 bg-white border-r-2 border-b border-gray-200 hover:bg-gray-50 transition-all duration-200 group"
                      style={{ width: STAFF_COL_W, minWidth: STAFF_COL_W }}
                      onMouseEnter={() => setTooltipStaffId(staffRow.staff.id)}
                      onMouseLeave={() => setTooltipStaffId(null)}
                    >
                      {staffRow.staff.profilePhotoUrl ? (
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mr-2">
                          <img src={staffRow.staff.profilePhotoUrl} alt={staffRow.staff.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] flex items-center justify-center flex-shrink-0 mr-2">
                          <span className="text-white text-[10px] font-bold">
                            {staffRow.staff.name?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {staffRow.staff.name}
                        </span>
                        {compactLabel && (
                          <span className="text-[10px] text-gray-400 truncate">{compactLabel}</span>
                        )}
                      </div>

                      {/* Tooltip on hover */}
                      {tooltipStaffId === staffRow.staff.id && dwp && (
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none">
                          <div className="font-bold mb-1">デフォルトパターン</div>
                          <div>曜日: {dwp.days.map((d) => DAY_LABELS[d]).join('、')}</div>
                          <div>タイプ: {dwp.type === 'full' ? 'フル' : dwp.type === 'am' ? '午前' : '午後'}</div>
                          {dwp.startTime && dwp.endTime && (
                            <div>時間: {dwp.startTime} - {dwp.endTime}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Shift cells */}
                    {daysInMonth.map((day, idx) => {
                      const isSunday = day.dayOfWeek === 0;
                      const showWeekSep = isSunday && idx < daysInMonth.length - 1;
                      const isToday_ = day.dateStr === today;
                      const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

                      return (
                        <div
                          key={`${staffRow.staff.id}-${day.dateStr}`}
                          className={`${showWeekSep ? 'border-r-2 border-r-gray-400' : ''} ${isToday_ ? 'bg-[#00c4cc]/5' : isWeekend && !staffRow.shifts.get(day.dateStr)?.hasShift ? 'bg-gray-50/50' : ''}`}
                          style={{ width: COL_W, minWidth: COL_W }}
                        >
                          {renderShiftCell(staffRow, day.dateStr, day.dayOfWeek)}
                        </div>
                      );
                    })}

                    {/* Monthly total for this staff */}
                    <div
                      className="flex items-center justify-center border-b border-gray-200 border-l-2 border-l-gray-300 bg-gray-50"
                      style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W, minHeight: '48px' }}
                    >
                      <div className="text-center">
                        <span className="text-sm font-bold text-gray-700">
                          {monthTotal?.workDays || 0}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-0.5">日</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ---- Summary row: working staff count per day ---- */}
              <div className="flex border-t-2 border-[#00c4cc]/30">
                <div
                  className="sticky left-0 z-10 flex items-center px-3 py-2 bg-gray-50 border-r-2 border-b border-gray-300"
                  style={{ width: STAFF_COL_W, minWidth: STAFF_COL_W }}
                >
                  <span className="text-xs font-bold text-gray-600">出勤者数</span>
                </div>
                {daysInMonth.map((day, idx) => {
                  const summary = dailySummary.get(day.dateStr);
                  const workingCount = summary?.working || 0;
                  const isShort = workingCount > 0 && workingCount < minStaffPerDay;
                  const isSunday = day.dayOfWeek === 0;
                  const showWeekSep = isSunday && idx < daysInMonth.length - 1;
                  const isToday_ = day.dateStr === today;

                  return (
                    <div
                      key={`summary-${day.dateStr}`}
                      className={`flex items-center justify-center border-r border-b border-gray-200 py-2 ${
                        showWeekSep ? 'border-r-2 border-r-gray-400' : ''
                      } ${isShort ? 'bg-red-50' : workingCount > 0 ? 'bg-[#00c4cc]/5' : ''} ${isToday_ ? 'bg-[#00c4cc]/10' : ''}`}
                      style={{ width: COL_W, minWidth: COL_W }}
                    >
                      <div className="flex items-center gap-0.5">
                        {isShort && <AlertTriangle size={10} className="text-red-500" />}
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
                {/* Total column placeholder */}
                <div
                  className="flex items-center justify-center border-b border-gray-200 border-l-2 border-l-gray-300 bg-gray-50"
                  style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                />
              </div>

              {/* ---- Summary row: AM/PM breakdown ---- */}
              <div className="flex">
                <div
                  className="sticky left-0 z-10 flex items-center px-3 py-1.5 bg-gray-50 border-r-2 border-b border-gray-300"
                  style={{ width: STAFF_COL_W, minWidth: STAFF_COL_W }}
                >
                  <span className="text-[10px] font-medium text-gray-500">AM/PM内訳</span>
                </div>
                {daysInMonth.map((day, idx) => {
                  const summary = dailySummary.get(day.dateStr);
                  const isSunday = day.dayOfWeek === 0;
                  const showWeekSep = isSunday && idx < daysInMonth.length - 1;

                  return (
                    <div
                      key={`ampm-${day.dateStr}`}
                      className={`flex flex-col items-center justify-center border-r border-b border-gray-200 py-1 ${
                        showWeekSep ? 'border-r-2 border-r-gray-400' : ''
                      }`}
                      style={{ width: COL_W, minWidth: COL_W }}
                    >
                      {(summary?.am || 0) > 0 || (summary?.pm || 0) > 0 || (summary?.full || 0) > 0 ? (
                        <>
                          {(summary?.full || 0) > 0 && (
                            <span className="text-[9px] text-gray-500">{summary?.full}F</span>
                          )}
                          <div className="flex gap-0.5">
                            {(summary?.am || 0) > 0 && (
                              <span className="text-[9px] text-orange-500">{summary?.am}A</span>
                            )}
                            {(summary?.pm || 0) > 0 && (
                              <span className="text-[9px] text-blue-500">{summary?.pm}P</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[9px] text-gray-300">-</span>
                      )}
                    </div>
                  );
                })}
                <div
                  className="flex items-center justify-center border-b border-gray-200 border-l-2 border-l-gray-300 bg-gray-50"
                  style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== LEGEND + SUMMARY ===== */}
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
                    style={{ backgroundColor: pattern.color || '#14b8a6' }}
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
            {hasAvailabilityData && showAvailability && (
              <>
                <span className="text-gray-300 mx-1">|</span>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span>希望あり</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <span>希望外</span>
                </div>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500">
            合計:{' '}
            <span className="font-bold text-[#00c4cc]">
              {patternSummary.totalHours.toFixed(1)}
            </span>
            時間
          </div>
        </div>
      </div>

      {/* ===== Cell Editor Popup ===== */}
      {editingCell && (
        <ShiftCellEditor
          shift={getEditingShift()}
          patterns={patterns}
          onSelect={handleShiftSelect}
          onClose={() => setEditingCell(null)}
          position={editingCell.position}
          defaultPattern={getEditingDefaultPattern() || undefined}
          staffAvailable={
            showAvailability && availabilityMap.has(
              shiftsData.find((sr) => sr.staff.id === editingCell.staffId)?.staff.id || ''
            )
              ? availabilityMap.get(editingCell.staffId)?.has(editingCell.date) ?? undefined
              : undefined
          }
        />
      )}

      {/* ===== Copy Preview Modal ===== */}
      {showCopyPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                前月コピー プレビュー
              </h3>
              <button
                onClick={() => setShowCopyPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              {prevYear}年{prevMonth}月のシフトを曜日ベースで{year}年{month}月にコピーします。
            </p>

            <div className="flex-1 overflow-y-auto mb-4">
              {copyPreviewData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  前月のシフトデータがありません
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    {copyPreviewData.length}件のシフトをコピーします
                  </div>
                  {/* Group by staff for display */}
                  {Array.from(
                    copyPreviewData.reduce((acc, item) => {
                      const existing = acc.get(item.staffId);
                      if (existing) {
                        existing.count++;
                      } else {
                        acc.set(item.staffId, { staffName: item.staffName, count: 1, patternName: item.patternName });
                      }
                      return acc;
                    }, new Map<string, { staffName: string; count: number; patternName: string }>())
                  ).map(([staffId, info]) => (
                    <div key={staffId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">{info.staffName}</span>
                      <span className="text-xs text-gray-500">{info.count}日分</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCopyPreview(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmCopy}
                disabled={copyPreviewData.length === 0}
                className="px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Check size={16} />
                コピーを適用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyShiftCalendar;
