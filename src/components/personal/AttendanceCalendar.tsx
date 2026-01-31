/**
 * AttendanceCalendar - 勤怠カレンダーコンポーネント
 * シフトベースの勤怠管理、カレンダークリックで休暇申請
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  facilitySettings,
  onClose,
}: AttendanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [paidLeaveBalance, setPaidLeaveBalance] = useState<PaidLeaveBalance | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({
    request_type: 'absence' as LeaveRequest['request_type'],
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shifts, setShifts] = useState<Map<string, ShiftData>>(new Map());
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([]);
  const [leaveSettings, setLeaveSettings] = useState<StaffLeaveSettings | null>(null);

  // 月変更
  const changeMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

      // LocalStorageから勤怠記録を取得（暫定）
      const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
      const monthRecords = records.filter((r: AttendanceRecord) => {
        return r.user_id === userId &&
               r.facility_id === facilityId &&
               r.date >= startDate &&
               r.date <= endDate;
      });
      setAttendanceRecords(monthRecords);

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

  // 定休日判定
  const getRegularHolidaysForDate = (dateStr: string, dayOfWeek: number): number[] => {
    const holidayPeriods = facilitySettings?.holidayPeriods;
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
    return Array.isArray(facilitySettings?.regularHolidays) ? facilitySettings.regularHolidays : [0];
  };

  // シフト登録状況を確認
  const shiftStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    // シフト登録日数をカウント
    let scheduledShiftDays = 0;
    let scheduledWorkMinutes = 0;

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const shift = shifts.get(dateStr);

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
          // デフォルト7時間
          scheduledWorkMinutes += 7 * 60;
        }
      }
    }

    const hasShifts = scheduledShiftDays > 0;
    const scheduledWorkHours = Math.floor(scheduledWorkMinutes / 60);

    return {
      hasShifts,
      scheduledShiftDays,
      scheduledWorkHours,
    };
  }, [currentMonth, shifts, shiftPatterns]);

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
              const start = new Date(`${dateStr}T${startTime}:00`);
              const end = new Date(`${dateStr}T${endTime}:00`);
              let workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

              // 休憩時間を差し引く
              const breakStart = dayRecords.find(r => r.type === 'break_start');
              const breakEnd = dayRecords.find(r => r.type === 'break_end');
              if (breakStart?.time && breakEnd?.time) {
                const breakStartTime = new Date(`${dateStr}T${breakStart.time}:00`);
                const breakEndTime = new Date(`${dateStr}T${breakEnd.time}:00`);
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

  // 日付クリック処理
  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setLeaveFormData(prev => ({
      ...prev,
      start_date: dateStr,
      end_date: dateStr,
    }));
    setIsLeaveModalOpen(true);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const regularHolidays = facilitySettings?.regularHolidays || [0];
  const customHolidays = facilitySettings?.customHolidays || [];
  const includeHolidays = facilitySettings?.includeHolidays || false;
  const japaneseHolidays = includeHolidays ? getJapaneseHolidays(year) : [];

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
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            今月のシフトが未登録です
          </div>
        )}

        {/* シフト登録済みの場合のサマリー */}
        {shiftStats.hasShifts && (
          <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-600">
              シフト予定: <span className="font-bold text-[#00c4cc]">{shiftStats.scheduledShiftDays}</span>日
              <span className="text-gray-400 mx-1">|</span>
              予定労働: <span className="font-bold text-[#00c4cc]">{shiftStats.scheduledWorkHours}</span>h
            </span>
            {leaveSettings?.paidLeaveEnabled && (
              <span className="text-gray-500">
                有給残 <span className="font-bold text-green-600">{leaveSettings.paidLeaveDays}</span>日
              </span>
            )}
          </div>
        )}

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
              const hasAttendance = startRecord && endRecord;
              const leaveReqs = leaveRequestsByDate[dateStr] || [];
              const approvedLeave = leaveReqs.find(r => r.status === 'approved');
              const pendingLeave = leaveReqs.find(r => r.status === 'pending');

              // シフト情報を取得
              const shift = shifts.get(dateStr);
              const shiftPattern = shift?.shift_pattern_id
                ? shiftPatterns.find(p => p.id === shift.shift_pattern_id)
                : null;

              // 勤務時間を計算
              let workHours = '';
              if (hasAttendance) {
                const startTime = startRecord.time || startRecord.start_time;
                const endTime = endRecord.time || endRecord.end_time;
                if (startTime && endTime) {
                  const start = new Date(`${dateStr}T${startTime}:00`);
                  const end = new Date(`${dateStr}T${endTime}:00`);
                  const diff = end.getTime() - start.getTime();
                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  workHours = `${hours}:${String(minutes).padStart(2, '0')}`;
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

                  {/* シフト表示 */}
                  {shiftPattern && !approvedLeave && (
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

                  {/* 勤務情報（シフトがない場合） */}
                  {hasAttendance && !shiftPattern && (
                    <div className="text-[9px] text-[#00c4cc] font-bold truncate">
                      {workHours}
                    </div>
                  )}

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
          日付をタップして休暇申請ができます
        </p>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 justify-center">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[#00c4cc]/20 border border-[#00c4cc]" />
            <span>今日</span>
          </div>
          {shiftPatterns.slice(0, 3).map(pattern => (
            <div key={pattern.id} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: pattern.color }}
              />
              <span>{pattern.name}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
            <span>有給</span>
          </div>
        </div>

        {/* 月間実績（シンプル表示） */}
        <div className="border-t border-gray-200 pt-3 mt-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                労働 <span className="font-bold text-gray-700">{monthlyStats.totalWorkHours}h{monthlyStats.totalWorkMinutesRemainder > 0 ? `${monthlyStats.totalWorkMinutesRemainder}m` : ''}</span>
                {shiftStats.hasShifts && <span className="text-gray-400">/{shiftStats.scheduledWorkHours}h</span>}
              </span>
              <span>
                出勤 <span className="font-bold text-gray-700">{monthlyStats.workedDays}</span>
                {shiftStats.hasShifts && <span className="text-gray-400">/{shiftStats.scheduledShiftDays}日</span>}
              </span>
              {monthlyStats.overtimeHours > 0 && (
                <span>
                  残業 <span className="font-bold text-orange-600">{monthlyStats.overtimeHours}h</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {monthlyStats.paidLeaveDays > 0 && (
                <span>有給 <span className="font-bold text-purple-600">{monthlyStats.paidLeaveDays}</span></span>
              )}
              {monthlyStats.absentDays > 0 && (
                <span>欠勤 <span className="font-bold text-red-600">{monthlyStats.absentDays}</span></span>
              )}
            </div>
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
    </div>
  );
}
