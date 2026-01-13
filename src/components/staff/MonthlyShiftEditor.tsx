/**
 * MonthlyShiftEditor - 月間シフト作成コンポーネント
 * カレンダー形式でスタッフにシフトを割り当て
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle,
  Save,
  AlertCircle,
  Users,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ShiftPattern,
  MonthlyShiftSchedule,
  ShiftWithPattern,
  MONTHLY_SHIFT_STATUS_LABELS,
  Staff,
} from '@/types';
import { supabase } from '@/lib/supabase';

interface MonthlyShiftEditorProps {
  facilityId: string;
}

// 日付ヘルパー関数
const getDaysInMonth = (year: number, month: number): Date[] => {
  const days: Date[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function MonthlyShiftEditor({ facilityId }: MonthlyShiftEditorProps) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedule, setSchedule] = useState<MonthlyShiftSchedule | null>(null);
  const [shifts, setShifts] = useState<Map<string, ShiftWithPattern>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [availabilities, setAvailabilities] = useState<Map<string, Set<string>>>(new Map()); // staffId -> 希望日Set
  const [showAvailabilityOverlay, setShowAvailabilityOverlay] = useState(true);

  // 月の日付一覧
  const daysInMonth = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // データ取得
  useEffect(() => {
    fetchData();
  }, [facilityId, currentYear, currentMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // シフトパターン取得
      const { data: patternsData } = await supabase
        .from('shift_patterns')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('display_order');

      const mappedPatterns: ShiftPattern[] = (patternsData || []).map((row) => ({
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
      setPatterns(mappedPatterns);

      if (mappedPatterns.length > 0 && !selectedPatternId) {
        setSelectedPatternId(mappedPatterns[0].id);
      }

      // スタッフ取得
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('facility_id', facilityId)
        .order('name');

      setStaff(staffData || []);

      // 月間スケジュール取得または作成
      let { data: scheduleData } = await supabase
        .from('monthly_shift_schedules')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single();

      if (!scheduleData) {
        // スケジュールが存在しない場合は作成
        const { data: newSchedule, error: createError } = await supabase
          .from('monthly_shift_schedules')
          .insert({
            facility_id: facilityId,
            year: currentYear,
            month: currentMonth,
            status: 'draft',
          })
          .select()
          .single();

        if (createError) throw createError;
        scheduleData = newSchedule;
      }

      setSchedule({
        id: scheduleData.id,
        facilityId: scheduleData.facility_id,
        year: scheduleData.year,
        month: scheduleData.month,
        status: scheduleData.status,
        publishedAt: scheduleData.published_at,
        confirmedAt: scheduleData.confirmed_at,
        republishedAt: scheduleData.republished_at,
        republishCount: scheduleData.republish_count || 0,
        createdAt: scheduleData.created_at,
        updatedAt: scheduleData.updated_at,
      });

      // シフトデータ取得
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      const shiftsMap = new Map<string, ShiftWithPattern>();
      (shiftsData || []).forEach((row) => {
        const key = `${row.staff_id}_${row.date}`;
        shiftsMap.set(key, {
          id: row.id,
          facilityId: row.facility_id,
          staffId: row.staff_id,
          date: row.date,
          hasShift: row.has_shift,
          shiftPatternId: row.shift_pattern_id,
          monthlyScheduleId: row.monthly_schedule_id,
          startTime: row.start_time,
          endTime: row.end_time,
          breakMinutes: row.break_minutes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      });
      setShifts(shiftsMap);
      setHasUnsavedChanges(false);

      // 希望シフトデータ取得
      const { data: availabilityData } = await supabase
        .from('shift_availability_submissions')
        .select('user_id, available_dates')
        .eq('facility_id', facilityId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .not('submitted_at', 'is', null);

      // user_id → staff_id のマッピング
      const availMap = new Map<string, Set<string>>();
      (availabilityData || []).forEach((row) => {
        // staffData からuser_idに対応するstaff_idを探す
        const staffMember = staffData?.find((s) => s.user_id === row.user_id);
        if (staffMember && row.available_dates) {
          availMap.set(staffMember.id, new Set(row.available_dates));
        }
      });
      setAvailabilities(availMap);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 月移動
  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // セルクリック
  const handleCellClick = (staffId: string, date: Date) => {
    if (!selectedPatternId || schedule?.status === 'confirmed') return;

    const dateStr = formatDate(date);
    const key = `${staffId}_${dateStr}`;
    const existingShift = shifts.get(key);
    const selectedPattern = patterns.find((p) => p.id === selectedPatternId);

    const newShifts = new Map(shifts);

    if (existingShift?.shiftPatternId === selectedPatternId) {
      // 同じパターンなら削除
      newShifts.delete(key);
    } else {
      // 新しいシフトを設定
      newShifts.set(key, {
        id: existingShift?.id || '',
        facilityId,
        staffId,
        date: dateStr,
        hasShift: !selectedPattern?.isDayOff,
        shiftPatternId: selectedPatternId,
        monthlyScheduleId: schedule?.id,
        startTime: selectedPattern?.startTime,
        endTime: selectedPattern?.endTime,
        breakMinutes: selectedPattern?.breakMinutes,
        createdAt: existingShift?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    setShifts(newShifts);
    setHasUnsavedChanges(true);
  };

  // 保存
  const handleSave = async () => {
    if (!schedule) return;

    setIsSaving(true);
    try {
      // 既存のシフトを削除
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

      await supabase
        .from('shifts')
        .delete()
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      // 新しいシフトを挿入
      const shiftsToInsert = Array.from(shifts.values()).map((shift) => ({
        facility_id: facilityId,
        staff_id: shift.staffId,
        date: shift.date,
        has_shift: shift.hasShift,
        shift_pattern_id: shift.shiftPatternId,
        monthly_schedule_id: schedule.id,
        start_time: shift.startTime,
        end_time: shift.endTime,
        break_minutes: shift.breakMinutes,
      }));

      if (shiftsToInsert.length > 0) {
        const { error } = await supabase.from('shifts').insert(shiftsToInsert);
        if (error) throw error;
      }

      setHasUnsavedChanges(false);
      fetchData();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 公開
  const handlePublish = async () => {
    if (!schedule || !confirm('シフトを公開しますか？スタッフに通知されます。')) return;

    setIsSaving(true);
    try {
      // まず保存
      await handleSave();

      // ステータス更新
      const { error } = await supabase
        .from('monthly_shift_schedules')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      if (error) throw error;

      fetchData();
    } catch (error) {
      console.error('公開エラー:', error);
      alert('公開に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 確定
  const handleConfirm = async () => {
    if (!schedule || !confirm('シフトを確定しますか？確定後は編集できません。')) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('monthly_shift_schedules')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      if (error) throw error;

      fetchData();
    } catch (error) {
      console.error('確定エラー:', error);
      alert('確定に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 再周知
  const handleRepublish = async () => {
    if (!schedule || !confirm('シフトを再周知しますか？\n変更があったスタッフに再度確認を求めます。')) return;

    setIsSaving(true);
    try {
      // まず保存
      await handleSave();

      // 再周知を実行（トリガーが変更箇所をリセット）
      const { error } = await supabase
        .from('monthly_shift_schedules')
        .update({
          republished_at: new Date().toISOString(),
          republish_count: (schedule.republishCount || 0) + 1,
        })
        .eq('id', schedule.id);

      if (error) throw error;

      fetchData();
    } catch (error) {
      console.error('再周知エラー:', error);
      alert('再周知に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-orange-400" />
        <p className="text-gray-600 mb-2">シフトパターンが設定されていません</p>
        <p className="text-sm text-gray-500">
          先に「シフトパターン設定」でパターンを作成してください
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-bold text-gray-800">
            {currentYear}年{currentMonth}月
          </h3>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* ステータスバッジ */}
          {schedule && (
            <span
              className={`px-2 py-1 text-xs font-bold rounded ${MONTHLY_SHIFT_STATUS_LABELS[schedule.status].color}`}
            >
              {MONTHLY_SHIFT_STATUS_LABELS[schedule.status].label}
            </span>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-sm text-orange-600">未保存の変更があります</span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges || schedule?.status === 'confirmed'}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
          {schedule?.status === 'draft' && (
            <button
              onClick={handlePublish}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              公開
            </button>
          )}
          {schedule?.status === 'published' && (
            <>
              <button
                onClick={handleRepublish}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                再周知
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                確定
              </button>
            </>
          )}
        </div>
      </div>

      {/* 希望表示トグル */}
      {availabilities.size > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAvailabilityOverlay(!showAvailabilityOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showAvailabilityOverlay
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : 'bg-gray-50 border-gray-300 text-gray-600'
            }`}
          >
            {showAvailabilityOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            希望シフト表示
          </button>
          <span className="text-xs text-gray-500">
            {availabilities.size}名が希望提出済み
          </span>
        </div>
      )}

      {/* パターン選択 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">選択中のパターン:</span>
        {patterns.map((pattern) => (
          <button
            key={pattern.id}
            onClick={() => setSelectedPatternId(pattern.id)}
            disabled={schedule?.status === 'confirmed'}
            className={`px-3 py-1.5 text-sm font-bold rounded-lg border-2 transition-all ${
              selectedPatternId === pattern.id
                ? 'border-gray-800 shadow-md'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: pattern.color + '20',
              color: pattern.color,
              borderColor: selectedPatternId === pattern.id ? pattern.color : 'transparent',
            }}
          >
            {pattern.shortName || pattern.name}
          </button>
        ))}
      </div>

      {/* シフト表 */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left text-sm font-bold text-gray-700 border-b border-gray-200 min-w-[120px]">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  スタッフ
                </div>
              </th>
              {daysInMonth.map((date) => {
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                return (
                  <th
                    key={formatDate(date)}
                    className={`px-1 py-2 text-center text-xs font-medium border-b border-gray-200 min-w-[40px] ${
                      isWeekend ? 'bg-red-50' : 'bg-gray-50'
                    } ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-600'}`}
                  >
                    <div>{date.getDate()}</div>
                    <div className="text-[10px]">{WEEKDAYS[dayOfWeek]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-medium text-gray-800 border-b border-gray-100">
                  {s.name}
                </td>
                {daysInMonth.map((date) => {
                  const dateStr = formatDate(date);
                  const key = `${s.id}_${dateStr}`;
                  const shift = shifts.get(key);
                  const pattern = shift?.shiftPatternId
                    ? patterns.find((p) => p.id === shift.shiftPatternId)
                    : null;
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const hasAvailability = showAvailabilityOverlay && availabilities.get(s.id)?.has(dateStr);

                  return (
                    <td
                      key={dateStr}
                      onClick={() => handleCellClick(s.id, date)}
                      className={`px-1 py-1 text-center border-b border-gray-100 cursor-pointer transition-colors relative ${
                        isWeekend ? 'bg-red-50/50' : ''
                      } ${schedule?.status === 'confirmed' ? 'cursor-not-allowed' : 'hover:bg-gray-100'}`}
                    >
                      {/* 希望マーカー */}
                      {hasAvailability && !pattern && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full border-2 border-teal-400 border-dashed opacity-60" />
                        </div>
                      )}
                      {hasAvailability && pattern && (
                        <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-teal-400" />
                      )}
                      {pattern && (
                        <div
                          className="px-1 py-0.5 rounded text-xs font-bold relative z-10"
                          style={{
                            backgroundColor: pattern.color + '30',
                            color: pattern.color,
                          }}
                        >
                          {pattern.shortName || pattern.name.charAt(0)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600 pt-2">
        <span className="font-medium">凡例:</span>
        {patterns.map((pattern) => (
          <div key={pattern.id} className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: pattern.color }}
            />
            <span>{pattern.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
