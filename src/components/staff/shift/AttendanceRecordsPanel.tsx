/**
 * 勤怠実績パネル
 * 施設管理者がスタッフの出退勤記録を確認するためのコンポーネント
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CheckCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Staff } from '@/types';

type AttendanceType = 'start' | 'end' | 'break_start' | 'break_end';

interface AttendanceRecord {
  id: string;
  userId: string;
  facilityId: string;
  date: string;
  type: AttendanceType;
  time: string;
  recordedAt: string;
  isManualCorrection: boolean;
  correctionReason?: string;
  memo?: string;
}

interface DailyAttendance {
  date: string;
  staffId: string;
  staffName: string;
  startTime?: string;
  endTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  workMinutes: number;
  breakMinutes: number;
  status: 'not_started' | 'working' | 'on_break' | 'completed';
}

interface AttendanceRecordsPanelProps {
  staffList: Staff[];
  year: number;
  month: number;
}

const AttendanceRecordsPanel: React.FC<AttendanceRecordsPanelProps> = ({
  staffList,
  year,
  month,
}) => {
  const { facility } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // 月の日数を取得
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  // 選択月の全日付を生成
  const dates = useMemo(() => {
    const result: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push(date);
    }
    return result;
  }, [year, month, daysInMonth]);

  // 勤怠データを取得
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!facility?.id) return;

      setLoading(true);
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

        const { data, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('facility_id', facility.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('time', { ascending: true });

        if (error) throw error;

        setRecords(
          (data || []).map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            facilityId: r.facility_id,
            date: r.date,
            type: r.type,
            time: r.time,
            recordedAt: r.recorded_at,
            isManualCorrection: r.is_manual_correction,
            correctionReason: r.correction_reason,
            memo: r.memo,
          }))
        );
      } catch (err) {
        console.error('勤怠データの取得に失敗:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [facility?.id, year, month, daysInMonth]);

  // スタッフごとの日別勤怠を集計
  const dailyAttendances = useMemo(() => {
    const result: Map<string, Map<string, DailyAttendance>> = new Map();

    staffList.forEach((staff) => {
      const staffRecords = new Map<string, DailyAttendance>();

      dates.forEach((date) => {
        const dayRecords = records.filter(
          (r) => r.userId === staff.user_id && r.date === date
        );

        const getTime = (type: AttendanceType) =>
          dayRecords.find((r) => r.type === type)?.time;

        const startTime = getTime('start');
        const endTime = getTime('end');
        const breakStartTime = getTime('break_start');
        const breakEndTime = getTime('break_end');

        // 勤務時間を計算
        let workMinutes = 0;
        let breakMinutes = 0;

        if (startTime && endTime) {
          const start = parseTime(startTime);
          const end = parseTime(endTime);
          workMinutes = end - start;

          if (breakStartTime && breakEndTime) {
            const breakStart = parseTime(breakStartTime);
            const breakEnd = parseTime(breakEndTime);
            breakMinutes = breakEnd - breakStart;
            workMinutes -= breakMinutes;
          }
        }

        // ステータスを判定
        let status: DailyAttendance['status'] = 'not_started';
        if (endTime) {
          status = 'completed';
        } else if (breakStartTime && !breakEndTime) {
          status = 'on_break';
        } else if (startTime) {
          status = 'working';
        }

        staffRecords.set(date, {
          date,
          staffId: staff.id,
          staffName: staff.lastName && staff.firstName
            ? `${staff.lastName} ${staff.firstName}`
            : staff.name,
          startTime,
          endTime,
          breakStartTime,
          breakEndTime,
          workMinutes: Math.max(0, workMinutes),
          breakMinutes: Math.max(0, breakMinutes),
          status,
        });
      });

      result.set(staff.id, staffRecords);
    });

    return result;
  }, [staffList, records, dates]);

  // 時間文字列を分に変換
  const parseTime = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // 分を時間表示に変換
  const formatMinutes = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}時間${m > 0 ? `${m}分` : ''}`;
  };

  // 選択日の勤怠データ
  const selectedDayAttendances = useMemo(() => {
    return staffList.map((staff) => {
      const staffAttendances = dailyAttendances.get(staff.id);
      return staffAttendances?.get(selectedDate) || {
        date: selectedDate,
        staffId: staff.id,
        staffName: staff.lastName && staff.firstName
          ? `${staff.lastName} ${staff.firstName}`
          : staff.name,
        workMinutes: 0,
        breakMinutes: 0,
        status: 'not_started' as const,
      };
    });
  }, [staffList, dailyAttendances, selectedDate]);

  // ステータスに応じたバッジ
  const StatusBadge = ({ status }: { status: DailyAttendance['status'] }) => {
    const config = {
      not_started: { color: 'bg-gray-100 text-gray-600', label: '未出勤' },
      working: { color: 'bg-green-100 text-green-700', label: '勤務中' },
      on_break: { color: 'bg-yellow-100 text-yellow-700', label: '休憩中' },
      completed: { color: 'bg-blue-100 text-blue-700', label: '退勤済' },
    };
    const { color, label } = config[status];
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  // 日付を移動
  const moveDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // 月間集計
  const monthlySummary = useMemo(() => {
    return staffList.map((staff) => {
      const staffAttendances = dailyAttendances.get(staff.id);
      let totalWorkMinutes = 0;
      let totalBreakMinutes = 0;
      let workDays = 0;

      staffAttendances?.forEach((attendance) => {
        if (attendance.status === 'completed') {
          totalWorkMinutes += attendance.workMinutes;
          totalBreakMinutes += attendance.breakMinutes;
          workDays++;
        }
      });

      return {
        staffId: staff.id,
        staffName: staff.lastName && staff.firstName
          ? `${staff.lastName} ${staff.firstName}`
          : staff.name,
        workDays,
        totalWorkMinutes,
        totalBreakMinutes,
      };
    });
  }, [staffList, dailyAttendances]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 日別勤怠セクション */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#00c4cc]" />
            日別勤怠記録
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => moveDate(-1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={() => moveDate(1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                  スタッフ
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  出勤
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  退勤
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  休憩
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  勤務時間
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  状態
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {selectedDayAttendances.map((attendance) => (
                <tr key={attendance.staffId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <span className="font-medium text-gray-800">
                        {attendance.staffName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-800">
                      {attendance.startTime || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-800">
                      {attendance.endTime || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-500">
                      {attendance.breakStartTime && attendance.breakEndTime
                        ? `${attendance.breakStartTime}〜${attendance.breakEndTime}`
                        : attendance.breakStartTime
                        ? `${attendance.breakStartTime}〜`
                        : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-800">
                      {attendance.workMinutes > 0
                        ? formatMinutes(attendance.workMinutes)
                        : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={attendance.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 月間集計セクション */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#00c4cc]" />
            {year}年{month}月 月間集計
          </h3>
          <button
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
          >
            <Download className="w-4 h-4" />
            エクスポート
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                  スタッフ
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  出勤日数
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  総勤務時間
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  総休憩時間
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                  平均勤務時間/日
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlySummary.map((summary) => (
                <tr key={summary.staffId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">
                      {summary.staffName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-800">
                      {summary.workDays}日
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-[#00c4cc]">
                      {formatMinutes(summary.totalWorkMinutes)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">
                      {formatMinutes(summary.totalBreakMinutes)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-800">
                      {summary.workDays > 0
                        ? formatMinutes(
                            Math.round(summary.totalWorkMinutes / summary.workDays)
                          )
                        : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceRecordsPanel;
