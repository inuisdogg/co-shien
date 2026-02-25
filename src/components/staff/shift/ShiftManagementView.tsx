/**
 * シフト管理ビュー
 * シフト管理のメインビューコンポーネント
 * - 月間カレンダー表示
 * - パターン設定
 * - 確認状況管理
 */

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Calendar,
  Settings,
  CheckCircle,
  AlertCircle,
  Printer,
  Clock,
} from 'lucide-react';
import { useShiftManagement } from '@/hooks/useShiftManagement';
import { useStaffMaster } from '@/hooks/useStaffMaster';
import { useAuth } from '@/contexts/AuthContext';
import { Staff, ShiftWithPattern } from '@/types';
import MonthlyShiftCalendar from './MonthlyShiftCalendar';
import ShiftConfirmationPanel from './ShiftConfirmationPanel';
import AttendanceRecordsPanel from './AttendanceRecordsPanel';
import ShiftPatternSettings from '@/components/staff/ShiftPatternSettings';

interface StaffShiftRow {
  staff: Staff;
  shifts: Map<string, ShiftWithPattern>;
}

type ViewMode = 'calendar' | 'attendance' | 'confirmation' | 'patterns';

const ShiftManagementView: React.FC = () => {
  const { facility } = useAuth();

  // 現在の年月
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // データ取得
  const { staffList, loading: staffLoading } = useStaffMaster();
  const {
    shifts,
    shiftPatterns,
    monthlySchedule,
    confirmations,
    loading: shiftLoading,
    setShift,
    publishSchedule,
    fetchShifts,
    fetchShiftPatterns,
  } = useShiftManagement();

  // 年月が変更されたらシフトを再取得
  useEffect(() => {
    fetchShifts(year, month);
    fetchShiftPatterns();
  }, [year, month, fetchShifts, fetchShiftPatterns]);

  // シフトデータをスタッフ行形式に変換
  const shiftsData: StaffShiftRow[] = useMemo(() => {
    return staffList.map((staff) => {
      const staffShifts = new Map<string, ShiftWithPattern>();

      shifts
        .filter((s) => s.staffId === staff.id)
        .forEach((shift) => {
          staffShifts.set(shift.date, shift);
        });

      return {
        staff,
        shifts: staffShifts,
      };
    });
  }, [staffList, shifts]);

  // 確認状況データ（仮実装）
  const staffConfirmations = useMemo(() => {
    return staffList.map((staff) => ({
      staff,
      status: 'pending' as const,
    }));
  }, [staffList]);

  // スケジュール状態
  const scheduleStatus = useMemo(
    () => ({
      year,
      month,
      status: monthlySchedule?.status || ('draft' as const),
      publishedAt: monthlySchedule?.publishedAt,
      confirmedAt: monthlySchedule?.confirmedAt,
    }),
    [year, month, monthlySchedule]
  );

  // 月変更
  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  }, []);

  // シフト変更
  const handleShiftChange = useCallback(
    async (
      staffId: string,
      date: string,
      patternId: string | null,
      customTime?: { startTime: string; endTime: string }
    ) => {
      await setShift(staffId, date, patternId, customTime);
    },
    [setShift]
  );

  // 公開
  const handlePublish = useCallback(async () => {
    await publishSchedule(year, month);
  }, [publishSchedule, year, month]);

  // リマインド（仮実装）
  const handleSendReminder = useCallback((staffId: string) => {
    console.log('Send reminder to:', staffId);
  }, []);

  const handleSendReminderAll = useCallback(() => {
    console.log('Send reminder to all');
  }, []);

  // 印刷
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // エクスポート
  const handleExport = useCallback(() => {
    // CSV出力
    const headers = ['スタッフ名', ...Array.from({ length: 31 }, (_, i) => `${i + 1}日`)];
    const rows = shiftsData.map((row) => {
      const cells = [row.staff.name];
      for (let d = 1; d <= 31; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const shift = row.shifts.get(dateStr);
        if (shift?.hasShift) {
          if (shift.shiftPattern?.isDayOff) {
            cells.push('休');
          } else {
            const start = shift.startTime || shift.shiftPattern?.startTime || '';
            const end = shift.endTime || shift.shiftPattern?.endTime || '';
            cells.push(`${start}-${end}`);
          }
        } else {
          cells.push('');
        }
      }
      return cells;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `シフト表_${year}年${month}月.csv`;
    link.click();
  }, [shiftsData, year, month]);

  const loading = staffLoading || shiftLoading;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Calendar size={20} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">シフト管理</h1>
              <p className="text-sm text-gray-500">
                {year}年{month}月のシフト管理
              </p>
            </div>
          </div>

          {/* ビュー切り替え */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar size={16} />
              カレンダー
            </button>
            <button
              onClick={() => setViewMode('attendance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'attendance'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Clock size={16} />
              勤怠実績
            </button>
            <button
              onClick={() => setViewMode('confirmation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'confirmation'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <CheckCircle size={16} />
              確認状況
            </button>
            <button
              onClick={() => setViewMode('patterns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'patterns'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Settings size={16} />
              パターン設定
            </button>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {/* {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )} */}

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-hidden p-6">
        {viewMode === 'calendar' && (
          <MonthlyShiftCalendar
            year={year}
            month={month}
            staffList={staffList}
            shiftsData={shiftsData}
            patterns={shiftPatterns}
            onMonthChange={handleMonthChange}
            onShiftChange={handleShiftChange}
            onPrint={handlePrint}
            onExport={handleExport}
            loading={loading}
            editable={true}
          />
        )}

        {viewMode === 'attendance' && (
          <AttendanceRecordsPanel
            staffList={staffList}
            year={year}
            month={month}
          />
        )}

        {viewMode === 'confirmation' && (
          <div className="max-w-2xl">
            <ShiftConfirmationPanel
              scheduleStatus={scheduleStatus}
              confirmations={staffConfirmations}
              onPublish={handlePublish}
              onSendReminder={handleSendReminder}
              onSendReminderAll={handleSendReminderAll}
              loading={loading}
            />
          </div>
        )}

        {viewMode === 'patterns' && facility?.id && (
          <div className="max-w-3xl">
            <ShiftPatternSettings facilityId={facility.id} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftManagementView;
