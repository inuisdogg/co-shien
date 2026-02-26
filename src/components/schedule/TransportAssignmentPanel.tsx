/**
 * 送迎体制管理パネル (TransportAssignmentPanel)
 *
 * 週間ビューで日別の送迎担当者（迎え/送り）を一覧表示し、
 * 運転手・添乗員の割り当て、車両情報、時間を管理する。
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Car,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  X,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DailyTransportAssignment } from '@/types';
import { isJapaneseHoliday } from '@/utils/japaneseHolidays';

// ---------- 型定義 ----------

type StaffOption = {
  id: string;
  name: string;
};

type ScheduleCountPerDay = {
  date: string;
  pickupCount: number;
  dropoffCount: number;
};

type EditFormData = {
  pickupDriverStaffId: string;
  pickupAttendantStaffId: string;
  dropoffDriverStaffId: string;
  dropoffAttendantStaffId: string;
  vehicleInfo: string;
  pickupTime: string;
  dropoffTime: string;
  notes: string;
};

type MonthlyStaffCount = {
  staffId: string;
  staffName: string;
  driverCount: number;
  attendantCount: number;
};

// ---------- ユーティリティ ----------

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekDates(baseDate: Date): string[] {
  const d = new Date(baseDate);
  const dayOfWeek = d.getDay(); // 0=Sun
  // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    dates.push(formatDateLocal(day));
  }
  return dates;
}

function getMonthRange(baseDate: Date): { start: string; end: string } {
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return { start: formatDateLocal(first), end: formatDateLocal(last) };
}

// ---------- コンポーネント ----------

const TransportAssignmentPanel: React.FC = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  // 週ナビゲーション
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

  // データ
  const [assignments, setAssignments] = useState<DailyTransportAssignment[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [scheduleCounts, setScheduleCounts] = useState<ScheduleCountPerDay[]>([]);
  const [monthlyStaffCounts, setMonthlyStaffCounts] = useState<MonthlyStaffCount[]>([]);
  const [loading, setLoading] = useState(false);

  // 施設設定 (休業日判定用)
  const [facilitySettings, setFacilitySettings] = useState<{
    regularHolidays: number[];
    customHolidays: string[];
    includeHolidays?: boolean;
    holidayPeriods?: Array<{
      startDate?: string;
      endDate?: string;
      regularHolidays: number[];
    }>;
  }>({ regularHolidays: [], customHolidays: [] });

  // 編集モーダル
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    pickupDriverStaffId: '',
    pickupAttendantStaffId: '',
    dropoffDriverStaffId: '',
    dropoffAttendantStaffId: '',
    vehicleInfo: '',
    pickupTime: '09:00',
    dropoffTime: '16:30',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // ---------- 休業日判定 ----------

  const isHoliday = useCallback(
    (dateStr: string): boolean => {
      const d = parseDateLocal(dateStr);
      const dayOfWeek = d.getDay();

      const periods = facilitySettings.holidayPeriods || [];
      let matched: (typeof periods)[0] | null = null;
      for (const p of periods) {
        if (!p.startDate) continue;
        if (dateStr >= p.startDate && (!p.endDate || dateStr <= p.endDate)) {
          matched = p;
          break;
        }
      }

      if (matched) {
        if (matched.regularHolidays.includes(dayOfWeek)) return true;
      } else {
        if (facilitySettings.regularHolidays.includes(dayOfWeek)) return true;
      }

      if (facilitySettings.customHolidays.includes(dateStr)) return true;
      if (facilitySettings.includeHolidays && isJapaneseHoliday(dateStr)) return true;

      return false;
    },
    [facilitySettings],
  );

  // ---------- データ取得 ----------

  // 施設設定を取得
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { data } = await supabase
        .from('facility_settings')
        .select('settings')
        .eq('facility_id', facilityId)
        .single();
      if (data?.settings) {
        const s = data.settings as Record<string, unknown>;
        setFacilitySettings({
          regularHolidays: (s.regularHolidays as number[]) || [],
          customHolidays: (s.customHolidays as string[]) || [],
          includeHolidays: s.includeHolidays as boolean | undefined,
          holidayPeriods: s.holidayPeriods as typeof facilitySettings.holidayPeriods,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  // スタッフリスト取得
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, name')
        .eq('facility_id', facilityId)
        .order('name');
      if (data) {
        setStaffList(data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      }
    })();
  }, [facilityId]);

  // 週間アサインメント取得
  const fetchAssignments = useCallback(async () => {
    if (!facilityId || weekDates.length === 0) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('daily_transport_assignments')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('date', weekDates[0])
        .lte('date', weekDates[6]);

      if (data) {
        const mapped: DailyTransportAssignment[] = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          facilityId: row.facility_id as string,
          date: row.date as string,
          driverStaffId: (row.driver_staff_id as string) || undefined,
          attendantStaffId: (row.attendant_staff_id as string) || undefined,
          pickupDriverStaffId: (row.pickup_driver_staff_id as string) || undefined,
          pickupAttendantStaffId: (row.pickup_attendant_staff_id as string) || undefined,
          dropoffDriverStaffId: (row.dropoff_driver_staff_id as string) || undefined,
          dropoffAttendantStaffId: (row.dropoff_attendant_staff_id as string) || undefined,
          vehicleInfo: (row.vehicle_info as string) || undefined,
          pickupTime: (row.pickup_time as string) || undefined,
          dropoffTime: (row.dropoff_time as string) || undefined,
          notes: (row.notes as string) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        }));
        setAssignments(mapped);
      }
    } finally {
      setLoading(false);
    }
  }, [facilityId, weekDates]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // スケジュール数(送迎対象児童数)取得
  useEffect(() => {
    if (!facilityId || weekDates.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('schedules')
        .select('date, has_pickup, has_dropoff')
        .eq('facility_id', facilityId)
        .gte('date', weekDates[0])
        .lte('date', weekDates[6]);

      if (data) {
        const countMap = new Map<string, { pickupCount: number; dropoffCount: number }>();
        for (const row of data as Array<{ date: string; has_pickup: boolean; has_dropoff: boolean }>) {
          const existing = countMap.get(row.date) || { pickupCount: 0, dropoffCount: 0 };
          if (row.has_pickup) existing.pickupCount++;
          if (row.has_dropoff) existing.dropoffCount++;
          countMap.set(row.date, existing);
        }
        const counts: ScheduleCountPerDay[] = Array.from(countMap.entries()).map(([date, c]) => ({
          date,
          ...c,
        }));
        setScheduleCounts(counts);
      }
    })();
  }, [facilityId, weekDates]);

  // 月間担当回数
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { start, end } = getMonthRange(baseDate);
      const { data } = await supabase
        .from('daily_transport_assignments')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('date', start)
        .lte('date', end);

      if (data && staffList.length > 0) {
        const countsMap = new Map<string, { driver: number; attendant: number }>();

        for (const row of data as Array<Record<string, unknown>>) {
          const ids = [
            { id: row.pickup_driver_staff_id as string | null, role: 'driver' as const },
            { id: row.dropoff_driver_staff_id as string | null, role: 'driver' as const },
            { id: row.pickup_attendant_staff_id as string | null, role: 'attendant' as const },
            { id: row.dropoff_attendant_staff_id as string | null, role: 'attendant' as const },
            // legacy
            { id: row.driver_staff_id as string | null, role: 'driver' as const },
            { id: row.attendant_staff_id as string | null, role: 'attendant' as const },
          ];
          for (const { id, role } of ids) {
            if (!id) continue;
            const existing = countsMap.get(id) || { driver: 0, attendant: 0 };
            existing[role]++;
            countsMap.set(id, existing);
          }
        }

        const result: MonthlyStaffCount[] = [];
        for (const [staffId, counts] of countsMap.entries()) {
          const staff = staffList.find((s) => s.id === staffId);
          if (staff) {
            result.push({
              staffId,
              staffName: staff.name,
              driverCount: counts.driver,
              attendantCount: counts.attendant,
            });
          }
        }
        result.sort((a, b) => b.driverCount + b.attendantCount - (a.driverCount + a.attendantCount));
        setMonthlyStaffCounts(result);
      }
    })();
  }, [facilityId, baseDate, staffList, assignments]);

  // ---------- ヘルパー ----------

  const getAssignment = (date: string): DailyTransportAssignment | undefined =>
    assignments.find((a) => a.date === date);

  const getScheduleCount = (date: string): ScheduleCountPerDay =>
    scheduleCounts.find((c) => c.date === date) || { date, pickupCount: 0, dropoffCount: 0 };

  const getStaffName = (staffId?: string): string => {
    if (!staffId) return '未定';
    return staffList.find((s) => s.id === staffId)?.name || '不明';
  };

  const isAssigned = (a?: DailyTransportAssignment): boolean => {
    if (!a) return false;
    return !!(
      a.pickupDriverStaffId ||
      a.pickupAttendantStaffId ||
      a.dropoffDriverStaffId ||
      a.dropoffAttendantStaffId ||
      a.driverStaffId ||
      a.attendantStaffId
    );
  };

  // ---------- 週ナビゲーション ----------

  const goToPrevWeek = () => {
    setBaseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setBaseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToThisWeek = () => {
    setBaseDate(new Date());
  };

  // 週の期間ラベル
  const weekLabel = useMemo(() => {
    if (weekDates.length < 7) return '';
    const s = parseDateLocal(weekDates[0]);
    const e = parseDateLocal(weekDates[6]);
    return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日〜${e.getMonth() + 1}月${e.getDate()}日`;
  }, [weekDates]);

  // ---------- 編集モーダル ----------

  const openEditModal = (date: string) => {
    const a = getAssignment(date);
    setEditForm({
      pickupDriverStaffId: a?.pickupDriverStaffId || a?.driverStaffId || '',
      pickupAttendantStaffId: a?.pickupAttendantStaffId || a?.attendantStaffId || '',
      dropoffDriverStaffId: a?.dropoffDriverStaffId || a?.driverStaffId || '',
      dropoffAttendantStaffId: a?.dropoffAttendantStaffId || a?.attendantStaffId || '',
      vehicleInfo: a?.vehicleInfo || '',
      pickupTime: a?.pickupTime?.substring(0, 5) || '09:00',
      dropoffTime: a?.dropoffTime?.substring(0, 5) || '16:30',
      notes: a?.notes || '',
    });
    setEditingDate(date);
  };

  const closeEditModal = () => {
    setEditingDate(null);
  };

  const handleSave = async () => {
    if (!editingDate || !facilityId) return;
    setSaving(true);
    try {
      const upsertData = {
        facility_id: facilityId,
        date: editingDate,
        pickup_driver_staff_id: editForm.pickupDriverStaffId || null,
        pickup_attendant_staff_id: editForm.pickupAttendantStaffId || null,
        dropoff_driver_staff_id: editForm.dropoffDriverStaffId || null,
        dropoff_attendant_staff_id: editForm.dropoffAttendantStaffId || null,
        vehicle_info: editForm.vehicleInfo || null,
        pickup_time: editForm.pickupTime || null,
        dropoff_time: editForm.dropoffTime || null,
        notes: editForm.notes || null,
        // legacy fields - keep in sync for backward compatibility
        driver_staff_id: editForm.pickupDriverStaffId || null,
        attendant_staff_id: editForm.pickupAttendantStaffId || null,
        updated_at: new Date().toISOString(),
      };

      const existing = getAssignment(editingDate);
      if (existing) {
        await supabase
          .from('daily_transport_assignments')
          .update(upsertData)
          .eq('id', existing.id);
      } else {
        await supabase.from('daily_transport_assignments').insert(upsertData);
      }

      await fetchAssignments();
      closeEditModal();
    } catch (err) {
      console.error('Error saving transport assignment:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // ---------- 描画 ----------

  const todayStr = formatDateLocal(new Date());

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー: 週ナビゲーション */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="前週"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToThisWeek}
            className="px-3 py-1.5 text-xs font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors shadow-sm"
          >
            今週
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="次週"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h3 className="font-bold text-sm sm:text-base text-gray-800 ml-2">{weekLabel}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Car className="w-4 h-4" />
          <span>送迎体制管理</span>
        </div>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-[#00c4cc] border-t-transparent rounded-full" />
        </div>
      )}

      {/* 週間グリッド */}
      {!loading && (
        <div className="flex-1 overflow-auto">
          {/* デスクトップ: 7列グリッド */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {weekDates.map((dateStr) => {
              const d = parseDateLocal(dateStr);
              const dayIdx = d.getDay();
              const dayLabel = DAY_LABELS[dayIdx];
              const holiday = isHoliday(dateStr);
              const assignment = getAssignment(dateStr);
              const counts = getScheduleCount(dateStr);
              const assigned = isAssigned(assignment);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  className={`rounded-xl shadow-sm border transition-all ${
                    holiday
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : assigned
                      ? 'bg-white border-[#00c4cc]/30 hover:shadow-md'
                      : 'bg-white border-red-200 hover:shadow-md'
                  } ${isToday ? 'ring-2 ring-[#00c4cc]' : ''}`}
                >
                  {/* 日付ヘッダー */}
                  <div
                    className={`px-3 py-2 border-b flex items-center justify-between ${
                      holiday
                        ? 'bg-gray-100 border-gray-200'
                        : assigned
                        ? 'bg-[#00c4cc]/5 border-[#00c4cc]/10'
                        : 'bg-red-50 border-red-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-bold ${
                          dayIdx === 0
                            ? 'text-red-500'
                            : dayIdx === 6
                            ? 'text-blue-500'
                            : 'text-gray-700'
                        }`}
                      >
                        {dayLabel}
                      </span>
                      <span className={`text-sm ${isToday ? 'font-bold text-[#00c4cc]' : 'text-gray-600'}`}>
                        {d.getMonth() + 1}/{d.getDate()}
                      </span>
                    </div>
                    {!holiday && (
                      <button
                        onClick={() => openEditModal(dateStr)}
                        className="p-1 text-gray-400 hover:text-[#00c4cc] hover:bg-white rounded transition-colors"
                        title="編集"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {holiday ? (
                    <div className="px-3 py-6 text-center text-xs text-gray-400">休業日</div>
                  ) : (
                    <div className="px-3 py-2 space-y-2 text-xs">
                      {/* 迎え (Pickup) */}
                      <div>
                        <div className="font-bold text-[#006064] mb-1 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00c4cc]" />
                          迎え
                        </div>
                        <div className="pl-3 space-y-0.5">
                          <div className="flex items-center gap-1 text-gray-700">
                            <Car className="w-3 h-3 text-[#00c4cc]" />
                            <span className={!assignment?.pickupDriverStaffId && !assignment?.driverStaffId ? 'text-red-400' : ''}>
                              {getStaffName(assignment?.pickupDriverStaffId || assignment?.driverStaffId)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-700">
                            <UserCheck className="w-3 h-3 text-[#00c4cc]" />
                            <span className={!assignment?.pickupAttendantStaffId && !assignment?.attendantStaffId ? 'text-red-400' : ''}>
                              {getStaffName(assignment?.pickupAttendantStaffId || assignment?.attendantStaffId)}
                            </span>
                          </div>
                          {(assignment?.pickupTime) && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Clock className="w-3 h-3" />
                              {assignment.pickupTime.substring(0, 5)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 送り (Dropoff) */}
                      <div>
                        <div className="font-bold text-orange-700 mb-1 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400" />
                          送り
                        </div>
                        <div className="pl-3 space-y-0.5">
                          <div className="flex items-center gap-1 text-gray-700">
                            <Car className="w-3 h-3 text-orange-400" />
                            <span className={!assignment?.dropoffDriverStaffId && !assignment?.driverStaffId ? 'text-red-400' : ''}>
                              {getStaffName(assignment?.dropoffDriverStaffId || assignment?.driverStaffId)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-700">
                            <UserCheck className="w-3 h-3 text-orange-400" />
                            <span className={!assignment?.dropoffAttendantStaffId && !assignment?.attendantStaffId ? 'text-red-400' : ''}>
                              {getStaffName(assignment?.dropoffAttendantStaffId || assignment?.attendantStaffId)}
                            </span>
                          </div>
                          {(assignment?.dropoffTime) && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Clock className="w-3 h-3" />
                              {assignment.dropoffTime.substring(0, 5)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 児童数 & 車両 */}
                      <div className="pt-1 border-t border-gray-100 space-y-0.5">
                        <div className="flex items-center gap-1 text-gray-500">
                          <Users className="w-3 h-3" />
                          <span>
                            迎{counts.pickupCount}名 / 送{counts.dropoffCount}名
                          </span>
                        </div>
                        {assignment?.vehicleInfo && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Car className="w-3 h-3" />
                            <span>{assignment.vehicleInfo}</span>
                          </div>
                        )}
                        {assignment?.notes && (
                          <div className="text-gray-400 truncate" title={assignment.notes}>
                            {assignment.notes}
                          </div>
                        )}
                      </div>

                      {/* 未割当警告 */}
                      {!assigned && (counts.pickupCount > 0 || counts.dropoffCount > 0) && (
                        <div className="flex items-center gap-1 text-red-500 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          <span className="font-bold">未割当</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* モバイル: 縦スタック */}
          <div className="md:hidden space-y-2">
            {weekDates.map((dateStr) => {
              const d = parseDateLocal(dateStr);
              const dayIdx = d.getDay();
              const dayLabel = DAY_LABELS[dayIdx];
              const holiday = isHoliday(dateStr);
              const assignment = getAssignment(dateStr);
              const counts = getScheduleCount(dateStr);
              const assigned = isAssigned(assignment);
              const isToday = dateStr === todayStr;

              if (holiday) {
                return (
                  <div
                    key={dateStr}
                    className="rounded-xl shadow-sm border border-gray-200 bg-gray-50 opacity-60 px-4 py-3 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-500">
                      {dayLabel} {d.getMonth() + 1}/{d.getDate()}
                    </span>
                    <span className="text-xs text-gray-400">休業日</span>
                  </div>
                );
              }

              return (
                <div
                  key={dateStr}
                  className={`rounded-xl shadow-sm border transition-all ${
                    assigned
                      ? 'bg-white border-[#00c4cc]/30'
                      : 'bg-white border-red-200'
                  } ${isToday ? 'ring-2 ring-[#00c4cc]' : ''}`}
                >
                  <div
                    className={`px-4 py-2 border-b flex items-center justify-between ${
                      assigned ? 'bg-[#00c4cc]/5 border-[#00c4cc]/10' : 'bg-red-50 border-red-100'
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${
                        dayIdx === 0
                          ? 'text-red-500'
                          : dayIdx === 6
                          ? 'text-blue-500'
                          : 'text-gray-700'
                      }`}
                    >
                      {dayLabel} {d.getMonth() + 1}/{d.getDate()}
                    </span>
                    <button
                      onClick={() => openEditModal(dateStr)}
                      className="p-1.5 text-gray-400 hover:text-[#00c4cc] hover:bg-white rounded transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-4 py-3 grid grid-cols-2 gap-3 text-xs">
                    {/* 迎え */}
                    <div>
                      <div className="font-bold text-[#006064] mb-1">迎え</div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Car className="w-3 h-3 text-[#00c4cc]" />
                          {getStaffName(assignment?.pickupDriverStaffId || assignment?.driverStaffId)}
                        </div>
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-[#00c4cc]" />
                          {getStaffName(assignment?.pickupAttendantStaffId || assignment?.attendantStaffId)}
                        </div>
                        {assignment?.pickupTime && (
                          <div className="text-gray-500">{assignment.pickupTime.substring(0, 5)}</div>
                        )}
                      </div>
                    </div>
                    {/* 送り */}
                    <div>
                      <div className="font-bold text-orange-700 mb-1">送り</div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Car className="w-3 h-3 text-orange-400" />
                          {getStaffName(assignment?.dropoffDriverStaffId || assignment?.driverStaffId)}
                        </div>
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-orange-400" />
                          {getStaffName(assignment?.dropoffAttendantStaffId || assignment?.attendantStaffId)}
                        </div>
                        {assignment?.dropoffTime && (
                          <div className="text-gray-500">{assignment.dropoffTime.substring(0, 5)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-3 flex items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
                    <span>迎{counts.pickupCount}名 / 送{counts.dropoffCount}名</span>
                    {assignment?.vehicleInfo && <span>車: {assignment.vehicleInfo}</span>}
                    {!assigned && (counts.pickupCount > 0 || counts.dropoffCount > 0) && (
                      <span className="text-red-500 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> 未割当
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 月間担当回数サマリー */}
          {monthlyStaffCounts.length > 0 && (
            <div className="mt-4 rounded-xl shadow-sm border border-gray-100 bg-white p-4">
              <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#00c4cc]" />
                月間担当回数（{parseDateLocal(weekDates[0]).getMonth() + 1}月）
              </h4>
              <div className="flex flex-wrap gap-2">
                {monthlyStaffCounts.map((sc) => (
                  <div
                    key={sc.staffId}
                    className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs"
                  >
                    <span className="font-bold text-gray-800">{sc.staffName}</span>
                    <span className="text-gray-500 ml-1">
                      (運転{sc.driverCount}回 / 添乗{sc.attendantCount}回)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 編集モーダル */}
      {editingDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="px-5 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <Car className="w-5 h-5 text-[#00c4cc]" />
                送迎体制編集
                <span className="text-sm text-gray-500 font-normal ml-1">
                  {(() => {
                    const d = parseDateLocal(editingDate);
                    return `${d.getMonth() + 1}/${d.getDate()}（${DAY_LABELS[d.getDay()]}）`;
                  })()}
                </span>
              </h3>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* 迎え */}
              <div className="bg-[#e0f7fa]/30 rounded-lg p-4 border border-[#b2ebf2]/50">
                <h4 className="text-sm font-bold text-[#006064] mb-3 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#00c4cc]" />
                  迎え（ピックアップ）
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">運転手</label>
                    <select
                      value={editForm.pickupDriverStaffId}
                      onChange={(e) => setEditForm({ ...editForm, pickupDriverStaffId: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                    >
                      <option value="">未定</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">添乗員</label>
                    <select
                      value={editForm.pickupAttendantStaffId}
                      onChange={(e) => setEditForm({ ...editForm, pickupAttendantStaffId: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                    >
                      <option value="">未定</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">出発時間</label>
                    <input
                      type="time"
                      value={editForm.pickupTime}
                      onChange={(e) => setEditForm({ ...editForm, pickupTime: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                    />
                  </div>
                </div>
              </div>

              {/* 送り */}
              <div className="bg-orange-50/50 rounded-lg p-4 border border-orange-100/50">
                <h4 className="text-sm font-bold text-orange-700 mb-3 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                  送り（ドロップオフ）
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">運転手</label>
                    <select
                      value={editForm.dropoffDriverStaffId}
                      onChange={(e) => setEditForm({ ...editForm, dropoffDriverStaffId: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                    >
                      <option value="">未定</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">添乗員</label>
                    <select
                      value={editForm.dropoffAttendantStaffId}
                      onChange={(e) => setEditForm({ ...editForm, dropoffAttendantStaffId: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                    >
                      <option value="">未定</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">出発時間</label>
                    <input
                      type="time"
                      value={editForm.dropoffTime}
                      onChange={(e) => setEditForm({ ...editForm, dropoffTime: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                    />
                  </div>
                </div>
              </div>

              {/* 車両・メモ */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">車両情報</label>
                  <input
                    type="text"
                    value={editForm.vehicleInfo}
                    onChange={(e) => setEditForm({ ...editForm, vehicleInfo: e.target.value })}
                    placeholder="例: 白バン（品川 500 あ 1234）"
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">メモ</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="例: 田中さん遅れる場合は佐藤さんが代行"
                    rows={2}
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* モーダルフッター */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex gap-2 flex-shrink-0">
              <button
                onClick={closeEditModal}
                className="flex-1 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-sm transition-colors border border-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportAssignmentPanel;
