/**
 * AttendanceCalendar - 勤怠カレンダーコンポーネント
 * シフトベースの勤怠管理、カレンダークリックで休暇申請
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Coffee,
  Sun,
  Moon,
  CalendarPlus,
  FileText,
  Briefcase,
  ClipboardEdit,
  Save,
  Play,
  Square,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getJapaneseHolidays } from '@/utils/japaneseHolidays';
import { ShiftPattern, StaffLeaveSettings } from '@/types';

interface FacilitySettings {
  regularHolidays?: number[];
  customHolidays?: string[];
  includeHolidays?: boolean;
  holidayPeriods?: Array<{
    startDate?: string;
    start_date?: string;
    endDate?: string;
    end_date?: string;
    regularHolidays?: number[];
    regular_holidays?: number[];
  }>;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  facility_id: string;
  date: string;
  type: 'start' | 'end' | 'break_start' | 'break_end' | 'manual' | 'paid_leave';
  time?: string;
  start_time?: string;
  end_time?: string;
  break_start_time?: string;
  break_end_time?: string;
  leave_type?: string;
  memo?: string;
}

interface LeaveRequest {
  id: string;
  user_id: string;
  facility_id: string;
  request_type: 'paid_leave' | 'half_day_am' | 'half_day_pm' | 'special_leave' | 'sick_leave' | 'absence';
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
}

interface PaidLeaveBalance {
  id: string;
  user_id: string;
  facility_id: string;
  fiscal_year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

interface ShiftData {
  id: string;
  date: string;
  has_shift: boolean;
  shift_pattern_id?: string;
  start_time?: string;
  end_time?: string;
  pattern?: ShiftPattern;
}

interface AttendanceCalendarProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  facilitySettings?: FacilitySettings | null;
  onClose?: () => void;
}

interface FetchedFacilitySettings {
  regularHolidays: number[];
  customHolidays: string[];
  includeHolidays: boolean;
  holidayPeriods: Array<{
    startDate?: string;
    start_date?: string;
    endDate?: string;
    end_date?: string;
    regularHolidays?: number[];
    regular_holidays?: number[];
  }>;
  prescribedWorkingHours?: number; // 1日の所定労働時間（分）
  prescribedWorkingDays?: number; // 月の所定出勤日数
}

const REQUEST_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid_leave: { label: '有給休暇', color: 'bg-green-100 text-green-700 border-green-200', icon: Calendar },
  half_day_am: { label: '午前半休', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Sun },
  half_day_pm: { label: '午後半休', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Moon },
  special_leave: { label: '特別休暇', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Calendar },
  sick_leave: { label: '病欠', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  absence: { label: '欠勤', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: X },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '申請中', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '承認済', color: 'bg-green-100 text-green-700' },
  rejected: { label: '却下', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'キャンセル', color: 'bg-gray-100 text-gray-500' },
};

export default function AttendanceCalendar({
  userId,
  facilityId,
  facilityName,
  facilitySettings: propFacilitySettings,
  onClose,
}: AttendanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [paidLeaveBalance, setPaidLeaveBalance] = useState<PaidLeaveBalance | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isActionSelectOpen, setIsActionSelectOpen] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({
    request_type: 'absence' as LeaveRequest['request_type'],
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [attendanceFormData, setAttendanceFormData] = useState({
    start_time: '',
    end_time: '',
    break_start_time: '',
    break_end_time: '',
    break2_start_time: '', // 中抜け1
    break2_end_time: '',
    memo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shifts, setShifts] = useState<Map<string, ShiftData>>(new Map());
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([]);
  const [leaveSettings, setLeaveSettings] = useState<StaffLeaveSettings | null>(null);

  // 施設設定を直接取得した状態
  const [fetchedSettings, setFetchedSettings] = useState<FetchedFacilitySettings | null>(null);

  // 月変更
  const changeMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  // 施設設定を直接取得
  useEffect(() => {
    const fetchFacilitySettings = async () => {
      if (!facilityId) return;

      try {
        // facility_settingsテーブルから取得
        const { data: settingsData, error: settingsError } = await supabase
          .from('facility_settings')
          .select('*')
          .eq('facility_id', facilityId)
          .single();

        if (settingsError) {
          console.error('施設設定取得エラー:', settingsError);
          // フォールバック: facilitiesテーブルから取得
          const { data: facilityData } = await supabase
            .from('facilities')
            .select('regular_holidays, custom_holidays, include_holidays, holiday_periods')
            .eq('id', facilityId)
            .single();

          if (facilityData) {
            setFetchedSettings({
              regularHolidays: facilityData.regular_holidays || [0],
              customHolidays: facilityData.custom_holidays || [],
              includeHolidays: facilityData.include_holidays || false,
              holidayPeriods: facilityData.holiday_periods || [],
            });
          }
          return;
        }

        if (settingsData) {
          // holiday_periodsの形式を正規化
          let holidayPeriods: FetchedFacilitySettings['holidayPeriods'] = [];
          if (settingsData.holiday_periods) {
            const rawPeriods = typeof settingsData.holiday_periods === 'string'
              ? JSON.parse(settingsData.holiday_periods)
              : settingsData.holiday_periods;
            if (Array.isArray(rawPeriods)) {
              holidayPeriods = rawPeriods.map((p: any) => ({
                startDate: p.startDate || p.start_date,
                endDate: p.endDate || p.end_date,
                regularHolidays: p.regularHolidays || p.regular_holidays,
              }));
            }
          }

          setFetchedSettings({
            regularHolidays: settingsData.regular_holidays || [0],
            customHolidays: settingsData.custom_holidays || [],
            includeHolidays: settingsData.include_holidays || false,
            holidayPeriods,
            prescribedWorkingHours: settingsData.prescribed_working_hours,
            prescribedWorkingDays: settingsData.prescribed_working_days,
          });
        }
      } catch (error) {
        console.error('施設設定取得エラー:', error);
      }
    };

    fetchFacilitySettings();
  }, [facilityId]);

  // 実際に使用する施設設定（直接取得した設定を優先）
  const facilitySettings = fetchedSettings || {
    regularHolidays: propFacilitySettings?.regularHolidays || [0],
    customHolidays: propFacilitySettings?.customHolidays || [],
    includeHolidays: propFacilitySettings?.includeHolidays || false,
    holidayPeriods: propFacilitySettings?.holidayPeriods || [],
  };

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

      // Supabaseから勤怠記録を取得
      try {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', userId)
          .eq('facility_id', facilityId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('time', { ascending: true });

        if (attendanceError) {
          console.error('勤怠記録取得エラー:', attendanceError);
        } else if (attendanceData) {
          setAttendanceRecords(attendanceData);
        }
      } catch (error) {
        console.error('勤怠記録取得エラー:', error);
      }

      // 休暇申請を取得
      try {
        const { data: requestsData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', userId)
          .eq('facility_id', facilityId)
          .gte('start_date', startDate)
          .lte('end_date', endDate)
          .order('start_date', { ascending: true });

        if (requestsData) {
          setLeaveRequests(requestsData);
        }
      } catch (error) {
        console.error('休暇申請取得エラー:', error);
      }

      // 有給残日数を取得
      try {
        const fiscalYear = month >= 3 ? year : year - 1; // 4月始まりの年度
        const { data: balanceData } = await supabase
          .from('paid_leave_balances')
          .select('*')
          .eq('user_id', userId)
          .eq('facility_id', facilityId)
          .eq('fiscal_year', fiscalYear)
          .single();

        if (balanceData) {
          setPaidLeaveBalance(balanceData);
        }
      } catch (error) {
        // テーブルが存在しない場合は無視
      }

      // シフトパターン取得
      try {
        const { data: patternsData } = await supabase
          .from('shift_patterns')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('is_active', true);

        if (patternsData) {
          const mapped: ShiftPattern[] = patternsData.map(row => ({
            id: row.id,
            facilityId: row.facility_id,
            name: row.name,
            shortName: row.short_name,
            startTime: row.start_time,
            endTime: row.end_time,
            breakMinutes: row.break_minutes || 60,
            color: row.color || '#00c4cc',
            displayOrder: row.display_order || 0,
            isDayOff: row.is_day_off || false,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          setShiftPatterns(mapped);
        }
      } catch (error) {
        console.error('シフトパターン取得エラー:', error);
      }

      // 自分のシフトを取得
      try {
        // まずstaffテーブルからstaff_idを取得
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('facility_id', facilityId)
          .eq('user_id', userId)
          .single();

        if (staffData) {
          const { data: shiftsData } = await supabase
            .from('shifts')
            .select('*')
            .eq('facility_id', facilityId)
            .eq('staff_id', staffData.id)
            .gte('date', startDate)
            .lte('date', endDate);

          if (shiftsData) {
            const shiftsMap = new Map<string, ShiftData>();
            shiftsData.forEach(row => {
              shiftsMap.set(row.date, {
                id: row.id,
                date: row.date,
                has_shift: row.has_shift,
                shift_pattern_id: row.shift_pattern_id,
                start_time: row.start_time,
                end_time: row.end_time,
              });
            });
            setShifts(shiftsMap);
          }
        }
      } catch (error) {
        console.error('シフト取得エラー:', error);
      }

      // 休暇設定を取得
      try {
        const { data: settingsData } = await supabase
          .from('staff_leave_settings')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('user_id', userId)
          .single();

        if (settingsData) {
          setLeaveSettings({
            id: settingsData.id,
            facilityId: settingsData.facility_id,
            userId: settingsData.user_id,
            paidLeaveEnabled: settingsData.paid_leave_enabled || false,
            paidLeaveDays: parseFloat(settingsData.paid_leave_days) || 0,
            substituteLeaveEnabled: settingsData.substitute_leave_enabled || false,
            substituteLeaveDays: parseFloat(settingsData.substitute_leave_days) || 0,
            notes: settingsData.notes,
            createdAt: settingsData.created_at,
            updatedAt: settingsData.updated_at,
          });
        }
      } catch (error) {
        // 設定がない場合は無視
      }
    };

    fetchData();
  }, [currentMonth, userId, facilityId, supabase]);

  // 休暇申請を日付でインデックス化
  const leaveRequestsByDate = useMemo(() => {
    const map: Record<string, LeaveRequest[]> = {};
    leaveRequests.forEach(request => {
      const start = new Date(request.start_date);
      const end = new Date(request.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(request);
      }
    });
    return map;
  }, [leaveRequests]);

  // 休業日関連の変数を先に定義
  const regularHolidays = useMemo(() => facilitySettings.regularHolidays || [0], [facilitySettings.regularHolidays]);
  const customHolidays = useMemo(() => facilitySettings.customHolidays || [], [facilitySettings.customHolidays]);
  const includeHolidays = useMemo(() => facilitySettings.includeHolidays || false, [facilitySettings.includeHolidays]);
  const japaneseHolidays = useMemo(() => {
    const year = currentMonth.getFullYear();
    return includeHolidays ? getJapaneseHolidays(year) : [];
  }, [currentMonth, includeHolidays]);

  // 定休日判定
  const getRegularHolidaysForDate = useCallback((dateStr: string, dayOfWeek: number): number[] => {
    const holidayPeriods = facilitySettings.holidayPeriods;
    if (holidayPeriods && Array.isArray(holidayPeriods) && holidayPeriods.length > 0) {
      for (const period of holidayPeriods) {
        if (period && typeof period === 'object') {
          const periodStart = period.startDate || period.start_date;
          const periodEnd = period.endDate || period.end_date || '9999-12-31';
          const periodRegularHolidays = period.regularHolidays || period.regular_holidays || [];

          if (periodStart && dateStr >= periodStart && dateStr <= periodEnd) {
            return Array.isArray(periodRegularHolidays) ? periodRegularHolidays : [];
          }
        }
      }
    }
    return Array.isArray(facilitySettings.regularHolidays) ? facilitySettings.regularHolidays : [0];
  }, [facilitySettings.holidayPeriods, facilitySettings.regularHolidays]);

  // シフト登録状況を確認（施設の休業日も考慮）
  const shiftStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    // シフト登録日数をカウント
    let scheduledShiftDays = 0;
    let scheduledWorkMinutes = 0;
    let prescribedWorkDays = 0; // 所定出勤日数（施設休業日を除いた営業日数）

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const shift = shifts.get(dateStr);

      // 施設の休業日判定
      const applicableRegularHolidays = getRegularHolidaysForDate(dateStr, dayOfWeek);
      const isRegularHoliday = applicableRegularHolidays.includes(dayOfWeek);
      const isCustomHoliday = customHolidays && Array.isArray(customHolidays) && customHolidays.includes(dateStr);
      const isJapaneseHoliday = includeHolidays && japaneseHolidays.includes(dateStr);
      const isFacilityHoliday = isRegularHoliday || isCustomHoliday || isJapaneseHoliday;

      // 施設休業日でなければ所定出勤日としてカウント
      if (!isFacilityHoliday) {
        prescribedWorkDays++;
      }

      if (shift?.has_shift && !shift.pattern?.isDayOff) {
        scheduledShiftDays++;
        // シフトパターンから予定労働時間を計算
        const pattern = shift.shift_pattern_id
          ? shiftPatterns.find(p => p.id === shift.shift_pattern_id)
          : null;
        if (pattern && pattern.startTime && pattern.endTime) {
          const start = new Date(`${dateStr}T${pattern.startTime}:00`);
          const end = new Date(`${dateStr}T${pattern.endTime}:00`);
          let workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
          workMinutes -= pattern.breakMinutes || 60; // 休憩時間を差し引く
          scheduledWorkMinutes += Math.max(0, workMinutes);
        } else if (shift.start_time && shift.end_time) {
          const start = new Date(`${dateStr}T${shift.start_time}:00`);
          const end = new Date(`${dateStr}T${shift.end_time}:00`);
          let workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
          workMinutes -= 60; // デフォルト1時間休憩
          scheduledWorkMinutes += Math.max(0, workMinutes);
        } else {
          // デフォルト8時間（所定労働時間が設定されている場合はそれを使用）
          const defaultMinutes = fetchedSettings?.prescribedWorkingHours || (8 * 60);
          scheduledWorkMinutes += defaultMinutes;
        }
      }
    }

    // シフト未登録の場合は所定出勤日数から所定労働時間を計算
    const hasShifts = scheduledShiftDays > 0;
    let scheduledWorkHours: number;
    let scheduledWorkMinutesRemainder = 0;

    if (hasShifts) {
      scheduledWorkHours = Math.floor(scheduledWorkMinutes / 60);
      scheduledWorkMinutesRemainder = scheduledWorkMinutes % 60;
    } else {
      // シフト未登録の場合：所定出勤日数 × 1日の所定労働時間
      const dailyPrescribedMinutes = fetchedSettings?.prescribedWorkingHours || (8 * 60);
      const totalMinutes = prescribedWorkDays * dailyPrescribedMinutes;
      scheduledWorkHours = Math.floor(totalMinutes / 60);
      scheduledWorkMinutesRemainder = totalMinutes % 60;
    }

    return {
      hasShifts,
      scheduledShiftDays: hasShifts ? scheduledShiftDays : prescribedWorkDays,
      prescribedWorkDays, // 施設休業日を除いた営業日数
      scheduledWorkHours,
      scheduledWorkMinutesRemainder,
      totalScheduledMinutes: hasShifts ? scheduledWorkMinutes : (prescribedWorkDays * (fetchedSettings?.prescribedWorkingHours || 480)),
    };
  }, [currentMonth, shifts, shiftPatterns, customHolidays, includeHolidays, japaneseHolidays, fetchedSettings, getRegularHolidaysForDate]);

  // 月間統計を計算（シフトベース）
  const monthlyStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let workedDays = 0;
    let absentDays = 0;
    let paidLeaveDays = 0;
    let totalWorkMinutes = 0;
    const dailyWorkTimes: Record<string, number> = {};

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const shift = shifts.get(dateStr);
      const isShiftDay = shift?.has_shift && !shift.pattern?.isDayOff;

      // 過去の日付のみカウント
      if (dateStr <= todayStr) {
        const dayRecords = attendanceRecords.filter(r => r.date === dateStr);
        const hasWorked = dayRecords.some(r => r.type === 'start' || r.type === 'manual');
        const leaveReqs = leaveRequestsByDate[dateStr] || [];
        const approvedLeave = leaveReqs.find(r => r.status === 'approved');

        if (hasWorked) {
          workedDays++;
          // 労働時間を計算
          const startRecord = dayRecords.find(r => r.type === 'start' || r.type === 'manual');
          const endRecord = dayRecords.find(r => r.type === 'end' || r.type === 'manual');

          if (startRecord && endRecord) {
            const startTime = startRecord.time || startRecord.start_time;
            const endTime = endRecord.time || endRecord.end_time;
            if (startTime && endTime) {
              // 時間形式を正規化（HH:MM:SS または HH:MM に対応）
              const normalizedStartTime = startTime.length === 5 ? `${startTime}:00` : startTime;
              const normalizedEndTime = endTime.length === 5 ? `${endTime}:00` : endTime;
              const start = new Date(`${dateStr}T${normalizedStartTime}`);
              const end = new Date(`${dateStr}T${normalizedEndTime}`);
              let workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

              // 休憩時間を差し引く
              const breakStart = dayRecords.find(r => r.type === 'break_start');
              const breakEnd = dayRecords.find(r => r.type === 'break_end');
              if (breakStart?.time && breakEnd?.time) {
                const bsTime = breakStart.time.length === 5 ? `${breakStart.time}:00` : breakStart.time;
                const beTime = breakEnd.time.length === 5 ? `${breakEnd.time}:00` : breakEnd.time;
                const breakStartTime = new Date(`${dateStr}T${bsTime}`);
                const breakEndTime = new Date(`${dateStr}T${beTime}`);
                const breakMinutes = Math.floor((breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60));
                workMinutes = Math.max(0, workMinutes - breakMinutes);
              }
              dailyWorkTimes[dateStr] = workMinutes;
              totalWorkMinutes += workMinutes;
            }
          }
        } else if (approvedLeave) {
          if (['paid_leave', 'half_day_am', 'half_day_pm'].includes(approvedLeave.request_type)) {
            paidLeaveDays += approvedLeave.days_count;
          }
        } else if (dateStr < todayStr && isShiftDay) {
          // シフト日なのに出勤していない = 欠勤
          absentDays++;
        }
      }
    }

    const totalWorkHours = Math.floor(totalWorkMinutes / 60);
    const totalWorkMinutesRemainder = totalWorkMinutes % 60;
    // 予定時間に対する残業
    const overtimeHours = shiftStats.hasShifts
      ? Math.max(0, totalWorkHours - shiftStats.scheduledWorkHours)
      : 0;

    return {
      workedDays,
      absentDays,
      paidLeaveDays,
      totalWorkHours,
      totalWorkMinutesRemainder,
      overtimeHours,
    };
  }, [currentMonth, attendanceRecords, leaveRequestsByDate, shifts, shiftStats]);

  // カレンダー日付を生成
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (string | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push(dateStr);
    }

    return days;
  }, [currentMonth]);

  // 休暇申請処理
  const handleLeaveSubmit = async () => {
    if (!leaveFormData.start_date || !leaveFormData.end_date) {
      alert('日付を選択してください');
      return;
    }

    setIsSubmitting(true);
    try {
      // 日数を計算
      const start = new Date(leaveFormData.start_date);
      const end = new Date(leaveFormData.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      let daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // 半休の場合は0.5日
      if (leaveFormData.request_type === 'half_day_am' || leaveFormData.request_type === 'half_day_pm') {
        daysCount = 0.5;
      }

      const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: userId,
          facility_id: facilityId,
          request_type: leaveFormData.request_type,
          start_date: leaveFormData.start_date,
          end_date: leaveFormData.end_date,
          days_count: daysCount,
          reason: leaveFormData.reason || null,
          status: 'pending',
        });

      if (error) throw error;

      alert('休暇申請を送信しました');
      setIsLeaveModalOpen(false);
      setLeaveFormData({
        request_type: 'paid_leave',
        start_date: '',
        end_date: '',
        reason: '',
      });

      // データを再取得
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDayNum}`;

      const { data: requestsData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .order('start_date', { ascending: true });

      if (requestsData) {
        setLeaveRequests(requestsData);
      }
    } catch (error) {
      console.error('休暇申請エラー:', error);
      alert('休暇申請に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 日付クリック処理 - アクション選択モーダルを表示
  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);

    // 既存の勤怠データがあれば読み込む
    const dayRecords = attendanceRecords.filter(r => r.date === dateStr);
    const startRecord = dayRecords.find(r => r.type === 'start' || r.type === 'manual');
    const endRecord = dayRecords.find(r => r.type === 'end' || r.type === 'manual');
    const breakStartRecord = dayRecords.find(r => r.type === 'break_start');
    const breakEndRecord = dayRecords.find(r => r.type === 'break_end');

    setAttendanceFormData({
      start_time: (startRecord?.time || startRecord?.start_time || '').slice(0, 5),
      end_time: (endRecord?.time || endRecord?.end_time || '').slice(0, 5),
      break_start_time: (breakStartRecord?.time || '').slice(0, 5),
      break_end_time: (breakEndRecord?.time || '').slice(0, 5),
      break2_start_time: '',
      break2_end_time: '',
      memo: startRecord?.memo || '',
    });

    setLeaveFormData(prev => ({
      ...prev,
      start_date: dateStr,
      end_date: dateStr,
    }));
    setIsActionSelectOpen(true);
  };

  // 勤怠登録を開く
  const openAttendanceModal = () => {
    setIsActionSelectOpen(false);
    setIsAttendanceModalOpen(true);
  };

  // 休暇申請を開く
  const openLeaveModal = () => {
    setIsActionSelectOpen(false);
    setIsLeaveModalOpen(true);
  };

  // 勤怠データ保存処理
  const handleAttendanceSubmit = async () => {
    if (!selectedDate) return;
    if (!attendanceFormData.start_time) {
      alert('勤務開始時間を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      // 既存のレコードを削除
      await supabase
        .from('attendance_records')
        .delete()
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .eq('date', selectedDate);

      // 新しいレコードを追加
      const records: Array<{
        user_id: string;
        facility_id: string;
        date: string;
        type: string;
        time: string;
        memo?: string;
      }> = [];

      // 出勤
      if (attendanceFormData.start_time) {
        records.push({
          user_id: userId,
          facility_id: facilityId,
          date: selectedDate,
          type: 'start',
          time: attendanceFormData.start_time + ':00',
          memo: attendanceFormData.memo || undefined,
        });
      }

      // 退勤
      if (attendanceFormData.end_time) {
        records.push({
          user_id: userId,
          facility_id: facilityId,
          date: selectedDate,
          type: 'end',
          time: attendanceFormData.end_time + ':00',
        });
      }

      // 休憩開始
      if (attendanceFormData.break_start_time) {
        records.push({
          user_id: userId,
          facility_id: facilityId,
          date: selectedDate,
          type: 'break_start',
          time: attendanceFormData.break_start_time + ':00',
        });
      }

      // 休憩終了
      if (attendanceFormData.break_end_time) {
        records.push({
          user_id: userId,
          facility_id: facilityId,
          date: selectedDate,
          type: 'break_end',
          time: attendanceFormData.break_end_time + ':00',
        });
      }

      // 中抜け開始（break2_start）
      if (attendanceFormData.break2_start_time) {
        records.push({
          user_id: userId,
          facility_id: facilityId,
          date: selectedDate,
          type: 'break_start',
          time: attendanceFormData.break2_start_time + ':00',
        });
      }

      // 中抜け終了（break2_end）
      if (attendanceFormData.break2_end_time) {
        records.push({
          user_id: userId,
          facility_id: facilityId,
          date: selectedDate,
          type: 'break_end',
          time: attendanceFormData.break2_end_time + ':00',
        });
      }

      if (records.length > 0) {
        const { error } = await supabase
          .from('attendance_records')
          .insert(records);

        if (error) throw error;
      }

      alert('勤怠を保存しました');
      setIsAttendanceModalOpen(false);

      // データを再取得
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (attendanceData) {
        setAttendanceRecords(attendanceData);
      }
    } catch (error) {
      console.error('勤怠保存エラー:', error);
      alert('勤怠の保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // デバッグ用：施設設定を確認
  useEffect(() => {
    console.log('勤怠カレンダー 施設設定:', {
      regularHolidays,
      customHolidays,
      includeHolidays,
      japaneseHolidays,
      fetchedSettings,
    });
  }, [regularHolidays, customHolidays, includeHolidays, japaneseHolidays, fetchedSettings]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#00c4cc]/5 to-transparent">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#00c4cc]" />
          <h3 className="font-bold text-gray-800">勤怠カレンダー</h3>
          <span className="text-sm text-gray-500">- {facilityName}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* 月選択 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h4 className="font-bold text-lg text-gray-800">
            {year}年 {month + 1}月
          </h4>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* シフト未登録の注意表示 */}
        {!shiftStats.hasShifts && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            今月のシフトは未確定です
          </div>
        )}

        {/* シフト・所定出勤のサマリー */}
        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
          <span className="text-gray-600">
            {shiftStats.hasShifts ? (
              <>
                シフト予定: <span className="font-bold text-[#00c4cc]">{shiftStats.scheduledShiftDays}</span>日
              </>
            ) : (
              <>
                所定出勤: <span className="font-bold text-[#00c4cc]">{shiftStats.prescribedWorkDays}</span>日
              </>
            )}
            <span className="text-gray-400 mx-1">|</span>
            所定労働: <span className="font-bold text-[#00c4cc]">{shiftStats.scheduledWorkHours}:{String(shiftStats.scheduledWorkMinutesRemainder).padStart(2, '0')}</span>
          </span>
          {leaveSettings?.paidLeaveEnabled && (
            <span className="text-gray-500">
              有給残 <span className="font-bold text-green-600">{leaveSettings.paidLeaveDays}</span>日
            </span>
          )}
        </div>

        {/* カレンダー（メイン） */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 bg-gray-50">
            {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
              <div
                key={day}
                className={`text-center text-xs font-bold py-2 ${
                  index === 0 ? 'text-red-500' :
                  index === 6 ? 'text-blue-500' :
                  'text-gray-700'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* カレンダー本体 */}
          <div className="grid grid-cols-7">
            {calendarDays.map((dateStr, index) => {
              if (!dateStr) {
                return <div key={index} className="aspect-square border-t border-l border-gray-100" />;
              }

              const date = new Date(dateStr);
              const dayOfWeek = date.getDay();
              const day = date.getDate();
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;

              const applicableRegularHolidays = getRegularHolidaysForDate(dateStr, dayOfWeek);
              const isRegularHoliday = applicableRegularHolidays.includes(dayOfWeek);
              const isCustomHoliday = customHolidays && Array.isArray(customHolidays) && customHolidays.includes(dateStr);
              const isJapaneseHoliday = japaneseHolidays.includes(dateStr);
              const isHoliday = isRegularHoliday || isCustomHoliday || isJapaneseHoliday;

              const dayRecords = attendanceRecords.filter(r => r.date === dateStr);
              const startRecord = dayRecords.find(r => r.type === 'start' || r.type === 'manual');
              const endRecord = dayRecords.find(r => r.type === 'end' || r.type === 'manual');
              const hasStartOnly = startRecord && !endRecord;
              const hasFullAttendance = startRecord && endRecord;
              const hasAnyAttendance = startRecord !== undefined;
              const leaveReqs = leaveRequestsByDate[dateStr] || [];
              const approvedLeave = leaveReqs.find(r => r.status === 'approved');
              const pendingLeave = leaveReqs.find(r => r.status === 'pending');

              // シフト情報を取得
              const shift = shifts.get(dateStr);
              const shiftPattern = shift?.shift_pattern_id
                ? shiftPatterns.find(p => p.id === shift.shift_pattern_id)
                : null;

              // 勤務時間を計算
              let startTimeDisplay = '';
              let endTimeDisplay = '';
              if (startRecord) {
                const startTime = startRecord.time || startRecord.start_time;
                if (startTime) {
                  startTimeDisplay = startTime.slice(0, 5); // HH:MM形式
                }
              }
              if (endRecord) {
                const endTime = endRecord.time || endRecord.end_time;
                if (endTime) {
                  endTimeDisplay = endTime.slice(0, 5); // HH:MM形式
                }
              }

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDateClick(dateStr)}
                  className={`
                    aspect-square border-t border-l border-gray-100 p-1 cursor-pointer
                    hover:bg-gray-50 transition-colors relative
                    ${isToday ? 'bg-[#00c4cc]/5' : ''}
                    ${isHoliday ? 'bg-gray-50' : ''}
                  `}
                >
                  {/* 日付 */}
                  <div className={`
                    text-xs font-bold mb-0.5
                    ${isToday ? 'text-[#00c4cc]' : ''}
                    ${dayOfWeek === 0 || isJapaneseHoliday ? 'text-red-500' : ''}
                    ${dayOfWeek === 6 && !isJapaneseHoliday ? 'text-blue-500' : ''}
                    ${isRegularHoliday && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-gray-400' : ''}
                    ${!isToday && !isHoliday && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-gray-700' : ''}
                  `}>
                    {day}
                  </div>

                  {/* シフト表示（打刻がない場合のみ） */}
                  {shiftPattern && !approvedLeave && !hasAnyAttendance && (
                    <div
                      className="text-[8px] px-1 rounded font-bold truncate"
                      style={{
                        backgroundColor: shiftPattern.color + '30',
                        color: shiftPattern.color,
                      }}
                    >
                      {shiftPattern.shortName || shiftPattern.name.charAt(0)}
                    </div>
                  )}

                  {/* 打刻情報表示 */}
                  {hasFullAttendance ? (
                    <div className="text-[8px] text-gray-700 leading-snug">
                      <div className="truncate">{startTimeDisplay}-{endTimeDisplay}</div>
                      {(() => {
                        // 日毎の残業時間を計算
                        const shift = shifts.get(dateStr);
                        const pattern = shift?.shift_pattern_id ? shiftPatterns.find(p => p.id === shift.shift_pattern_id) : null;
                        const scheduledMinutes = pattern ?
                          ((() => {
                            const ps = new Date(`${dateStr}T${pattern.startTime}:00`);
                            const pe = new Date(`${dateStr}T${pattern.endTime}:00`);
                            return Math.floor((pe.getTime() - ps.getTime()) / (1000 * 60)) - (pattern.breakMinutes || 60);
                          })()) : 0;
                        const st = startRecord.time || startRecord.start_time || '';
                        const et = endRecord.time || endRecord.end_time || '';
                        const nst = st.length === 5 ? `${st}:00` : st;
                        const net = et.length === 5 ? `${et}:00` : et;
                        const actualMinutes = Math.floor((new Date(`${dateStr}T${net}`).getTime() - new Date(`${dateStr}T${nst}`).getTime()) / (1000 * 60)) - 60;
                        const overtimeMinutes = Math.max(0, actualMinutes - scheduledMinutes);
                        const otHours = Math.floor(overtimeMinutes / 60);
                        const otMins = overtimeMinutes % 60;
                        return overtimeMinutes > 0 ? (
                          <div className="text-[7px] text-orange-500">+{otHours}:{String(otMins).padStart(2, '0')}</div>
                        ) : null;
                      })()}
                    </div>
                  ) : hasStartOnly ? (
                    <div className="text-[8px]">
                      <div className="text-gray-700">{startTimeDisplay}~</div>
                      <div className="text-green-600 font-medium">勤務中</div>
                    </div>
                  ) : null}

                  {/* 休暇マーク */}
                  {approvedLeave && (
                    <div className={`text-[8px] px-1 rounded ${REQUEST_TYPE_LABELS[approvedLeave.request_type].color}`}>
                      {REQUEST_TYPE_LABELS[approvedLeave.request_type].label.slice(0, 2)}
                    </div>
                  )}
                  {pendingLeave && !approvedLeave && (
                    <div className="text-[8px] px-1 rounded bg-yellow-100 text-yellow-700">
                      申請中
                    </div>
                  )}

                  {/* 定休日マーク */}
                  {isRegularHoliday && !dayRecords.length && !approvedLeave && !shiftPattern && (
                    <div className="text-[8px] text-gray-400">休</div>
                  )}

                  {/* 今日マーカー */}
                  {isToday && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#00c4cc]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ヒント */}
        <p className="text-xs text-gray-500 text-center">
          日付をタップして勤怠登録・休暇申請ができます
        </p>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 justify-center py-2 px-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>出勤</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <span>休み</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>有給</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span>遅刻</span>
          </div>
          {shiftPatterns.slice(0, 3).map(pattern => (
            <div key={pattern.id} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: pattern.color }}
              />
              <span>{pattern.name}</span>
            </div>
          ))}
        </div>

        {/* 月間実績サマリー */}
        <div className="border-t border-gray-200 pt-3 mt-2 space-y-3">
          {/* メインサマリーカード */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xs text-gray-500 mb-1">出勤日数</div>
              <div className="text-lg font-bold text-gray-800">{monthlyStats.workedDays}<span className="text-xs font-normal text-gray-400">/{shiftStats.hasShifts ? shiftStats.scheduledShiftDays : shiftStats.prescribedWorkDays}</span></div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xs text-gray-500 mb-1">総労働時間</div>
              <div className="text-lg font-bold text-gray-800">{monthlyStats.totalWorkHours}<span className="text-xs font-normal text-gray-400">:{String(monthlyStats.totalWorkMinutesRemainder).padStart(2, '0')}</span></div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xs text-gray-500 mb-1">残業</div>
              <div className="text-lg font-bold text-orange-600">
                {(() => {
                  const overtimeMinutes = Math.max(0, (monthlyStats.totalWorkHours * 60 + monthlyStats.totalWorkMinutesRemainder) - shiftStats.totalScheduledMinutes);
                  return `${Math.floor(overtimeMinutes / 60)}:${String(overtimeMinutes % 60).padStart(2, '0')}`;
                })()}
              </div>
            </div>
          </div>

          {/* 詳細テーブル */}
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-2 text-gray-500">所定出勤日数</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">
                    {shiftStats.hasShifts ? `${shiftStats.scheduledShiftDays}日` : `${shiftStats.prescribedWorkDays}日`}
                  </td>
                  <td className="px-3 py-2 text-gray-500">所定労働時間</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">
                    {shiftStats.scheduledWorkHours}:{String(shiftStats.scheduledWorkMinutesRemainder).padStart(2, '0')}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-2 text-gray-500">過不足時間</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">
                    {(() => {
                      const actualMinutes = monthlyStats.totalWorkHours * 60 + monthlyStats.totalWorkMinutesRemainder;
                      const scheduledMinutes = shiftStats.totalScheduledMinutes;
                      const diff = actualMinutes - scheduledMinutes;
                      const sign = diff >= 0 ? '+' : '-';
                      const absDiff = Math.abs(diff);
                      return `${sign}${Math.floor(absDiff / 60)}:${String(absDiff % 60).padStart(2, '0')}`;
                    })()}
                  </td>
                  <td className="px-3 py-2 text-gray-500">法定時間外残業</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">
                    {(() => {
                      const overtimeMinutes = Math.max(0, (monthlyStats.totalWorkHours * 60 + monthlyStats.totalWorkMinutesRemainder) - shiftStats.totalScheduledMinutes);
                      return `${Math.floor(overtimeMinutes / 60)}:${String(overtimeMinutes % 60).padStart(2, '0')}`;
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 休暇申請モーダル */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-[#00c4cc]" />
                休暇申請
              </h3>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* 申請種別 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">申請種別</label>
                <select
                  value={leaveFormData.request_type}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, request_type: e.target.value as LeaveRequest['request_type'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                >
                  {/* 欠勤は常に表示 */}
                  <option value="absence">欠勤</option>
                  {/* 有給休暇は設定で有効な場合のみ表示 */}
                  {leaveSettings?.paidLeaveEnabled && (
                    <>
                      <option value="paid_leave">有給休暇（全日）</option>
                      <option value="half_day_am">午前半休</option>
                      <option value="half_day_pm">午後半休</option>
                    </>
                  )}
                  {/* 代休は設定で有効な場合のみ表示 */}
                  {leaveSettings?.substituteLeaveEnabled && (
                    <option value="special_leave">代休</option>
                  )}
                </select>
                {/* 残日数表示 */}
                {leaveFormData.request_type === 'paid_leave' || leaveFormData.request_type === 'half_day_am' || leaveFormData.request_type === 'half_day_pm' ? (
                  <p className="text-xs text-gray-500 mt-1">
                    有給残日数: <span className="font-bold text-[#00c4cc]">{leaveSettings?.paidLeaveDays || 0}</span>日
                  </p>
                ) : leaveFormData.request_type === 'special_leave' ? (
                  <p className="text-xs text-gray-500 mt-1">
                    代休残日数: <span className="font-bold text-blue-600">{leaveSettings?.substituteLeaveDays || 0}</span>日
                  </p>
                ) : null}
              </div>

              {/* 日付 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">開始日</label>
                  <input
                    type="date"
                    value={leaveFormData.start_date}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">終了日</label>
                  <input
                    type="date"
                    value={leaveFormData.end_date}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, end_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
              </div>

              {/* 理由 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">理由（任意）</label>
                <textarea
                  value={leaveFormData.reason}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                  placeholder="休暇の理由を入力してください"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                />
              </div>

              {/* ボタン */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleLeaveSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? '送信中...' : '申請する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* アクション選択モーダル */}
      {isActionSelectOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">
                {selectedDate && new Date(selectedDate).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <button
                onClick={() => setIsActionSelectOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={openAttendanceModal}
                className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-[#00c4cc]/5 hover:border-[#00c4cc] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#00c4cc]/10 flex items-center justify-center">
                  <ClipboardEdit className="w-5 h-5 text-[#00c4cc]" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-800">勤怠登録</div>
                  <div className="text-xs text-gray-500">出退勤時間を入力する</div>
                </div>
              </button>
              <button
                onClick={openLeaveModal}
                className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CalendarPlus className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-800">休暇申請</div>
                  <div className="text-xs text-gray-500">有給・欠勤などを申請する</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 勤怠登録モーダル */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <ClipboardEdit className="w-5 h-5 text-[#00c4cc]" />
                勤怠登録
              </h3>
              <button
                onClick={() => setIsAttendanceModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* 日付表示 */}
              <div className="text-center py-2 bg-gray-50 rounded-lg">
                <span className="text-lg font-bold text-gray-800">
                  {selectedDate && new Date(selectedDate).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>

              {/* 出退勤時間 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Clock className="w-4 h-4 text-[#00c4cc]" />
                  勤務時間
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      <Play className="w-3 h-3 inline mr-1" />
                      出勤
                    </label>
                    <input
                      type="time"
                      value={attendanceFormData.start_time}
                      onChange={(e) => setAttendanceFormData({ ...attendanceFormData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      <Square className="w-3 h-3 inline mr-1" />
                      退勤
                    </label>
                    <input
                      type="time"
                      value={attendanceFormData.end_time}
                      onChange={(e) => setAttendanceFormData({ ...attendanceFormData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 休憩時間 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Coffee className="w-4 h-4 text-orange-500" />
                  休憩時間
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">開始</label>
                    <input
                      type="time"
                      value={attendanceFormData.break_start_time}
                      onChange={(e) => setAttendanceFormData({ ...attendanceFormData, break_start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">終了</label>
                    <input
                      type="time"
                      value={attendanceFormData.break_end_time}
                      onChange={(e) => setAttendanceFormData({ ...attendanceFormData, break_end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 中抜け時間 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Coffee className="w-4 h-4 text-purple-500" />
                  中抜け時間（任意）
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">開始</label>
                    <input
                      type="time"
                      value={attendanceFormData.break2_start_time}
                      onChange={(e) => setAttendanceFormData({ ...attendanceFormData, break2_start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">終了</label>
                    <input
                      type="time"
                      value={attendanceFormData.break2_end_time}
                      onChange={(e) => setAttendanceFormData({ ...attendanceFormData, break2_end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* メモ */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">メモ（任意）</label>
                <textarea
                  value={attendanceFormData.memo}
                  onChange={(e) => setAttendanceFormData({ ...attendanceFormData, memo: e.target.value })}
                  placeholder="備考があれば入力してください"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                />
              </div>

              {/* ボタン */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsAttendanceModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAttendanceSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? '保存中...' : '保存する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
