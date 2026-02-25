/**
 * シフト管理ビュー
 * シフト管理のメインビューコンポーネント
 * - 月間カレンダー表示
 * - パターン設定
 * - 確認状況管理
 * - 希望シフト連携
 * - 前月コピー機能
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
import { Staff, ShiftWithPattern, StaffAvailabilityStatus } from '@/types';
import { supabase } from '@/lib/supabase';
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

  // Current year/month
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // Data hooks
  const { staffList, loading: staffLoading } = useStaffMaster();
  const {
    shifts,
    shiftPatterns,
    monthlySchedule,
    confirmations,
    loading: shiftLoading,
    setShift,
    bulkSetShifts,
    publishSchedule,
    fetchShifts,
    fetchShiftPatterns,
  } = useShiftManagement();

  // Availability data
  const [availabilityStatuses, setAvailabilityStatuses] = useState<StaffAvailabilityStatus[]>([]);
  // Previous month shifts for copy
  const [prevMonthShifts, setPrevMonthShifts] = useState<ShiftWithPattern[]>([]);

  // Fetch shifts and patterns when year/month changes
  useEffect(() => {
    fetchShifts(year, month);
    fetchShiftPatterns();
  }, [year, month, fetchShifts, fetchShiftPatterns]);

  // Fetch availability data for the current month
  useEffect(() => {
    if (!facility?.id) return;

    const fetchAvailability = async () => {
      try {
        // Get staff list
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, user_id, first_name, last_name')
          .eq('facility_id', facility.id)
          .eq('is_active', true);

        // Get availability submissions
        const { data: submissionsData } = await supabase
          .from('shift_availability_submissions')
          .select('*')
          .eq('facility_id', facility.id)
          .eq('year', year)
          .eq('month', month);

        const statuses: StaffAvailabilityStatus[] = (staffData || [])
          .filter((s: Record<string, unknown>) => s.user_id)
          .map((s: Record<string, unknown>) => {
            const submission = submissionsData?.find(
              (sub: Record<string, unknown>) => sub.user_id === s.user_id
            );
            return {
              staffId: s.id as string,
              staffName: `${(s.last_name as string) || ''}${(s.first_name as string) || ''}`.trim() || '名前未設定',
              userId: s.user_id as string | undefined,
              submitted: !!(submission as Record<string, unknown> | undefined)?.submitted_at,
              submittedAt: (submission as Record<string, unknown> | undefined)?.submitted_at as string | undefined,
              availableDates: ((submission as Record<string, unknown> | undefined)?.available_dates as string[]) || [],
              notes: (submission as Record<string, unknown> | undefined)?.notes as string | undefined,
            };
          });

        setAvailabilityStatuses(statuses);
      } catch (error) {
        console.error('Failed to fetch availability data:', error);
      }
    };

    fetchAvailability();
  }, [facility?.id, year, month]);

  // Fetch previous month shifts for copy
  useEffect(() => {
    if (!facility?.id) return;

    const fetchPrevMonthShifts = async () => {
      try {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const endDate = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('shifts')
          .select('*, shift_patterns (*)')
          .eq('facility_id', facility.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (error) throw error;

        const mapped: ShiftWithPattern[] = (data || []).map((record: Record<string, unknown>) => {
          const patternRecord = record.shift_patterns as Record<string, unknown> | null;
          return {
            id: record.id as string,
            facilityId: record.facility_id as string,
            staffId: record.staff_id as string,
            date: record.date as string,
            hasShift: record.has_shift as boolean,
            shiftPatternId: record.shift_pattern_id as string | undefined,
            monthlyScheduleId: record.monthly_schedule_id as string | undefined,
            startTime: record.start_time as string | undefined,
            endTime: record.end_time as string | undefined,
            breakMinutes: record.break_minutes as number | undefined,
            shiftPattern: patternRecord
              ? {
                  id: patternRecord.id as string,
                  facilityId: patternRecord.facility_id as string,
                  name: patternRecord.name as string,
                  shortName: patternRecord.short_name as string | undefined,
                  startTime: patternRecord.start_time as string | undefined,
                  endTime: patternRecord.end_time as string | undefined,
                  breakMinutes: patternRecord.break_minutes as number,
                  color: patternRecord.color as string,
                  displayOrder: patternRecord.display_order as number,
                  isDayOff: patternRecord.is_day_off as boolean,
                  isActive: patternRecord.is_active as boolean,
                  createdAt: patternRecord.created_at as string,
                  updatedAt: patternRecord.updated_at as string,
                }
              : undefined,
            createdAt: record.created_at as string,
            updatedAt: record.updated_at as string,
          };
        });

        setPrevMonthShifts(mapped);
      } catch (error) {
        console.error('Failed to fetch previous month shifts:', error);
      }
    };

    fetchPrevMonthShifts();
  }, [facility?.id, year, month]);

  // Transform shift data into staff-row format
  const shiftsData: StaffShiftRow[] = useMemo(() => {
    return staffList.map((staff) => {
      const staffShifts = new Map<string, ShiftWithPattern>();
      shifts
        .filter((s) => s.staffId === staff.id)
        .forEach((shift) => {
          staffShifts.set(shift.date, shift);
        });
      return { staff, shifts: staffShifts };
    });
  }, [staffList, shifts]);

  // Confirmation statuses (placeholder)
  const staffConfirmations = useMemo(() => {
    return staffList.map((staff) => ({
      staff,
      status: 'pending' as const,
    }));
  }, [staffList]);

  // Schedule status
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

  // Month change
  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  }, []);

  // Shift change
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

  // Copy previous month
  const handleCopyPrevMonth = useCallback(
    async (shiftsToCopy: Array<{ staffId: string; date: string; patternId: string | null }>) => {
      await bulkSetShifts(
        shiftsToCopy.map((s) => ({
          staffId: s.staffId,
          date: s.date,
          patternId: s.patternId,
        }))
      );
    },
    [bulkSetShifts]
  );

  // Publish
  const handlePublish = useCallback(async () => {
    await publishSchedule(year, month);
  }, [publishSchedule, year, month]);

  // Remind (placeholder)
  const handleSendReminder = useCallback((staffId: string) => {
    console.log('Send reminder to:', staffId);
  }, []);

  const handleSendReminderAll = useCallback(() => {
    console.log('Send reminder to all');
  }, []);

  // Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Export CSV
  const handleExport = useCallback(() => {
    const headers = ['スタッフ名', ...Array.from({ length: 31 }, (_, i) => `${i + 1}日`), '稼働日数'];
    const rows = shiftsData.map((row) => {
      const cells = [row.staff.name];
      let workDays = 0;
      for (let d = 1; d <= 31; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const shift = row.shifts.get(dateStr);
        if (shift?.hasShift) {
          if (shift.shiftPattern?.isDayOff) {
            cells.push('休');
          } else {
            workDays++;
            const start = shift.startTime || shift.shiftPattern?.startTime || '';
            const end = shift.endTime || shift.shiftPattern?.endTime || '';
            cells.push(`${start}-${end}`);
          }
        } else {
          cells.push('');
        }
      }
      cells.push(String(workDays));
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
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00c4cc]/10 flex items-center justify-center">
              <Calendar size={20} className="text-[#00c4cc]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">シフト管理</h1>
              <p className="text-sm text-gray-500">
                {year}年{month}月のシフト管理
              </p>
            </div>
          </div>

          {/* View mode tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-[#00c4cc] shadow-sm'
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
                  ? 'bg-white text-[#00c4cc] shadow-sm'
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
                  ? 'bg-white text-[#00c4cc] shadow-sm'
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
                  ? 'bg-white text-[#00c4cc] shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Settings size={16} />
              パターン設定
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
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
            onCopyPrevMonth={handleCopyPrevMonth}
            prevMonthShifts={prevMonthShifts}
            availabilityStatuses={availabilityStatuses}
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
