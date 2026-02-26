'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ---- Local types ----

interface StaffMember {
  id: string;
  userId: string;
  name: string;
}

interface AttendanceRow {
  userId: string;
  date: string;
  type: 'start' | 'end' | 'break_start' | 'break_end';
  time: string;
}

interface DaySummary {
  userId: string;
  staffName: string;
  startTime?: string;
  endTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  status: 'not_started' | 'working' | 'on_break' | 'completed';
  workMinutes: number;
}

type CellType = 'normal' | 'overtime' | 'absence' | 'holiday' | 'leave' | 'none';

// ---- Helpers ----

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

const STATUS_CONFIG: Record<DaySummary['status'], { label: string; color: string }> = {
  not_started: { label: '未出勤', color: 'bg-gray-100 text-gray-500' },
  working: { label: '出勤中', color: 'bg-green-100 text-green-700' },
  on_break: { label: '休憩中', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '退勤済', color: 'bg-blue-100 text-blue-700' },
};

const CELL_COLORS: Record<CellType, string> = {
  normal: 'bg-green-200',
  overtime: 'bg-amber-200',
  absence: 'bg-red-200',
  holiday: 'bg-gray-100',
  leave: 'bg-purple-100',
  none: 'bg-white',
};

// ---- Component ----

export default function AttendanceOverviewPanel() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [prescribedHours, setPrescribedHours] = useState(8); // daily prescribed hours
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCell, setSelectedCell] = useState<{ userId: string; date: string } | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [year, month] = useMemo(() => selectedMonth.split('-').map(Number), [selectedMonth]);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const dates = useMemo(() => {
    const result: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return result;
  }, [year, month, daysInMonth]);

  // Fetch data
  useEffect(() => {
    if (!facilityId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch staff with user_ids
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, name, user_id')
          .eq('facility_id', facilityId);

        const staffMembers: StaffMember[] = (staffData || [])
          .filter((s: any) => s.user_id)
          .map((s: any) => ({
            id: s.id,
            userId: s.user_id,
            name: s.name,
          }));
        setStaffList(staffMembers);

        // Fetch attendance records for the month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

        const { data: attData } = await supabase
          .from('attendance_records')
          .select('user_id, date, type, time')
          .eq('facility_id', facilityId)
          .gte('date', startDate)
          .lte('date', endDate);

        setRecords(
          (attData || []).map((r: any) => ({
            userId: r.user_id,
            date: r.date,
            type: r.type,
            time: r.time,
          }))
        );

        // Fetch prescribed working hours from facility_settings
        const { data: fsData } = await supabase
          .from('facility_settings')
          .select('prescribed_working_hours')
          .eq('facility_id', facilityId)
          .single();

        if (fsData?.prescribed_working_hours) {
          setPrescribedHours(fsData.prescribed_working_hours);
        }
      } catch (err) {
        console.error('Error fetching attendance data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId, year, month, daysInMonth]);

  // Build daily summaries for all staff
  const dailySummaries = useMemo(() => {
    const map = new Map<string, Map<string, DaySummary>>();

    for (const staff of staffList) {
      const staffMap = new Map<string, DaySummary>();
      for (const date of dates) {
        const dayRecs = records.filter(r => r.userId === staff.userId && r.date === date);
        const getTime = (type: string) => dayRecs.find(r => r.type === type)?.time;

        const startTime = getTime('start');
        const endTime = getTime('end');
        const breakStartTime = getTime('break_start');
        const breakEndTime = getTime('break_end');

        let workMinutes = 0;
        if (startTime && endTime) {
          workMinutes = parseTime(endTime) - parseTime(startTime);
          if (breakStartTime && breakEndTime) {
            workMinutes -= (parseTime(breakEndTime) - parseTime(breakStartTime));
          }
          workMinutes = Math.max(0, workMinutes);
        }

        let status: DaySummary['status'] = 'not_started';
        if (endTime) status = 'completed';
        else if (breakStartTime && !breakEndTime) status = 'on_break';
        else if (startTime) status = 'working';

        staffMap.set(date, {
          userId: staff.userId,
          staffName: staff.name,
          startTime,
          endTime,
          breakStartTime,
          breakEndTime,
          status,
          workMinutes,
        });
      }
      map.set(staff.userId, staffMap);
    }
    return map;
  }, [staffList, records, dates]);

  // Today's attendance board
  const todayBoard = useMemo(() => {
    return staffList.map(staff => {
      const summary = dailySummaries.get(staff.userId)?.get(today);
      return {
        ...staff,
        status: summary?.status || 'not_started',
        startTime: summary?.startTime,
        workMinutes: summary?.workMinutes || 0,
      };
    });
  }, [staffList, dailySummaries, today]);

  // Monthly summary stats
  const monthlyStats = useMemo(() => {
    let totalWorkMinutes = 0;
    let totalOvertimeMinutes = 0;
    let absenceCount = 0;
    let completedDayCount = 0;
    const dailyPrescribedMinutes = prescribedHours * 60;

    for (const staff of staffList) {
      const staffMap = dailySummaries.get(staff.userId);
      if (!staffMap) continue;

      for (const date of dates) {
        const summary = staffMap.get(date);
        if (!summary) continue;

        const dow = new Date(date).getDay();
        const isWeekday = dow !== 0 && dow !== 6;

        if (summary.status === 'completed') {
          totalWorkMinutes += summary.workMinutes;
          completedDayCount++;
          if (summary.workMinutes > dailyPrescribedMinutes) {
            totalOvertimeMinutes += summary.workMinutes - dailyPrescribedMinutes;
          }
        } else if (summary.status === 'not_started' && isWeekday && date <= today) {
          absenceCount++;
        }
      }
    }

    const avgHoursPerDay = completedDayCount > 0
      ? (totalWorkMinutes / completedDayCount / 60)
      : 0;

    return {
      totalStaff: staffList.length,
      avgHours: avgHoursPerDay,
      totalOvertimeHours: totalOvertimeMinutes / 60,
      absenceCount,
    };
  }, [staffList, dailySummaries, dates, today, prescribedHours]);

  // Grid cell type determination
  const getCellType = useCallback((userId: string, date: string): CellType => {
    const summary = dailySummaries.get(userId)?.get(date);
    if (!summary) return 'none';

    const dow = new Date(date).getDay();
    const isHoliday = dow === 0 || dow === 6;

    if (isHoliday && summary.status === 'not_started') return 'holiday';
    if (summary.status === 'completed') {
      const dailyPrescribedMinutes = prescribedHours * 60;
      return summary.workMinutes > dailyPrescribedMinutes ? 'overtime' : 'normal';
    }
    if (summary.status === 'not_started' && date <= today) {
      if (isHoliday) return 'holiday';
      return 'absence';
    }
    if (summary.status === 'working' || summary.status === 'on_break') return 'normal';
    return 'none';
  }, [dailySummaries, prescribedHours, today]);

  const changeMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Clock className="w-6 h-6 text-[#00c4cc]" />
        <h1 className="text-xl font-bold text-gray-800">出退勤管理</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">スタッフ数</p>
          <p className="text-2xl font-bold text-gray-800">{monthlyStats.totalStaff}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">平均勤務時間/日</p>
          <p className="text-2xl font-bold text-gray-800">{monthlyStats.avgHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">残業合計</p>
          <p className="text-2xl font-bold text-amber-600">{monthlyStats.totalOvertimeHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">欠勤数</p>
          <p className="text-2xl font-bold text-red-500">{monthlyStats.absenceCount}</p>
        </div>
      </div>

      {/* Today's Attendance Board */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            本日の出勤状況
            <span className="text-xs text-gray-400 font-normal ml-2">{today}</span>
          </h2>
        </div>

        {todayBoard.length === 0 ? (
          <div className="p-8 text-center text-gray-500">スタッフが登録されていません</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayBoard.map(staff => {
              const cfg = STATUS_CONFIG[staff.status];
              return (
                <div key={staff.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-600">{staff.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{staff.name}</p>
                      {staff.startTime && (
                        <p className="text-xs text-gray-400">
                          出勤 {staff.startTime}
                          {staff.workMinutes > 0 && ` (${formatHours(staff.workMinutes)})`}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Attendance Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            月間勤怠一覧
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            />
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 flex gap-4 text-xs text-gray-500 border-b border-gray-50">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 inline-block" /> 通常</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 inline-block" /> 残業あり</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> 欠勤</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> 休日</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-bold text-gray-600 sticky left-0 bg-gray-50 min-w-[100px]">
                  スタッフ
                </th>
                {dates.map(date => {
                  const d = new Date(date);
                  const dow = d.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th
                      key={date}
                      className={`px-1 py-2 text-center font-medium min-w-[28px] ${isWeekend ? 'text-red-400' : 'text-gray-500'}`}
                    >
                      {d.getDate()}
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center font-bold text-gray-600 min-w-[60px]">合計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staffList.map(staff => {
                const staffMap = dailySummaries.get(staff.userId);
                let totalWork = 0;
                dates.forEach(d => {
                  totalWork += staffMap?.get(d)?.workMinutes || 0;
                });
                return (
                  <tr key={staff.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-1.5 font-medium text-gray-700 sticky left-0 bg-white">
                      {staff.name}
                    </td>
                    {dates.map(date => {
                      const cellType = getCellType(staff.userId, date);
                      const summary = staffMap?.get(date);
                      return (
                        <td
                          key={date}
                          className="px-0 py-1 text-center cursor-pointer"
                          onClick={() => setSelectedCell({ userId: staff.userId, date })}
                        >
                          <div
                            className={`w-6 h-6 mx-auto rounded ${CELL_COLORS[cellType]} flex items-center justify-center`}
                            title={
                              summary?.status === 'completed'
                                ? `${summary.startTime}-${summary.endTime} (${formatMinutes(summary.workMinutes)})`
                                : STATUS_CONFIG[summary?.status || 'not_started'].label
                            }
                          >
                            {cellType === 'overtime' && (
                              <span className="text-[8px] text-amber-700 font-bold">!</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-center font-medium text-gray-700">
                      {formatMinutes(totalWork)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cell Detail Modal */}
      {selectedCell && (() => {
        const summary = dailySummaries.get(selectedCell.userId)?.get(selectedCell.date);
        const staffName = staffList.find(s => s.userId === selectedCell.userId)?.name || '';
        if (!summary) return null;
        return (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setSelectedCell(null)}
          >
            <div
              className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-bold text-gray-800 mb-4">{staffName} - {selectedCell.date}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">状態</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[summary.status].color}`}>
                    {STATUS_CONFIG[summary.status].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">出勤時刻</span>
                  <span className="text-gray-800">{summary.startTime || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">退勤時刻</span>
                  <span className="text-gray-800">{summary.endTime || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">休憩</span>
                  <span className="text-gray-800">
                    {summary.breakStartTime && summary.breakEndTime
                      ? `${summary.breakStartTime} - ${summary.breakEndTime}`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">実労働時間</span>
                  <span className="font-medium text-gray-800">
                    {summary.workMinutes > 0 ? formatHours(summary.workMinutes) : '-'}
                  </span>
                </div>
                {summary.workMinutes > prescribedHours * 60 && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-2 text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>残業 {formatHours(summary.workMinutes - prescribedHours * 60)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="mt-4 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
