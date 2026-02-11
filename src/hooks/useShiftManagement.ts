/**
 * シフト管理フック
 * シフトの作成・編集・確認状況の管理
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ShiftWithPattern,
  ShiftPattern,
  MonthlyShiftSchedule,
  ShiftConfirmation,
} from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { formatShiftDisplay, calculateShiftWorkHours } from '@/utils/shiftDisplayFormatter';

interface UseShiftManagementReturn {
  // データ
  shifts: ShiftWithPattern[];
  shiftPatterns: ShiftPattern[];
  monthlySchedule: MonthlyShiftSchedule | null;
  confirmations: ShiftConfirmation[];
  loading: boolean;
  error: string | null;

  // シフトパターン操作
  fetchShiftPatterns: () => Promise<void>;
  createShiftPattern: (pattern: Partial<ShiftPattern>) => Promise<string | null>;
  updateShiftPattern: (patternId: string, data: Partial<ShiftPattern>) => Promise<boolean>;
  deleteShiftPattern: (patternId: string) => Promise<boolean>;

  // シフト操作
  fetchShifts: (year: number, month: number) => Promise<void>;
  setShift: (
    staffId: string,
    date: string,
    patternId: string | null,
    customTime?: { startTime: string; endTime: string; breakMinutes?: number }
  ) => Promise<boolean>;
  clearShift: (staffId: string, date: string) => Promise<boolean>;
  bulkSetShifts: (
    shifts: Array<{
      staffId: string;
      date: string;
      patternId: string | null;
      customTime?: { startTime: string; endTime: string; breakMinutes?: number };
    }>
  ) => Promise<boolean>;

  // 月間スケジュール操作
  fetchMonthlySchedule: (year: number, month: number) => Promise<void>;
  publishSchedule: (year: number, month: number) => Promise<boolean>;
  confirmSchedule: (year: number, month: number) => Promise<boolean>;
  republishSchedule: (year: number, month: number) => Promise<boolean>;

  // 確認状況
  fetchConfirmations: (year: number, month: number) => Promise<void>;

  // ユーティリティ
  getShiftDisplay: (shift: ShiftWithPattern) => string;
  getShiftWorkHours: (shift: ShiftWithPattern) => number;
}

export function useShiftManagement(): UseShiftManagementReturn {
  const { facility } = useAuth();
  const [shifts, setShifts] = useState<ShiftWithPattern[]>([]);
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([]);
  const [monthlySchedule, setMonthlySchedule] = useState<MonthlyShiftSchedule | null>(null);
  const [confirmations, setConfirmations] = useState<ShiftConfirmation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // シフトパターン一覧を取得
  const fetchShiftPatterns = useCallback(async () => {
    if (!facility?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('shift_patterns')
        .select('*')
        .eq('facility_id', facility.id)
        .eq('is_active', true)
        .order('display_order');

      if (fetchError) throw fetchError;

      setShiftPatterns((data || []).map(mapPatternFromDb));
    } catch (err) {
      console.error('Failed to fetch shift patterns:', err);
    }
  }, [facility?.id]);

  // シフトパターン作成
  const createShiftPattern = useCallback(
    async (pattern: Partial<ShiftPattern>): Promise<string | null> => {
      if (!facility?.id) return null;

      setLoading(true);
      setError(null);

      try {
        const newId = `sp-${Date.now()}`;

        // 表示順序を決定
        const maxOrder = Math.max(0, ...shiftPatterns.map((p) => p.displayOrder));

        const { error: insertError } = await supabase.from('shift_patterns').insert({
          id: newId,
          facility_id: facility.id,
          name: pattern.name,
          short_name: pattern.shortName,
          start_time: pattern.startTime,
          end_time: pattern.endTime,
          break_minutes: pattern.breakMinutes || 0,
          color: pattern.color || '#00c4cc',
          display_order: maxOrder + 1,
          is_day_off: pattern.isDayOff || false,
          is_active: true,
        });

        if (insertError) throw insertError;

        await fetchShiftPatterns();
        return newId;
      } catch (err) {
        console.error('Failed to create shift pattern:', err);
        setError('シフトパターンの作成に失敗しました');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, shiftPatterns, fetchShiftPatterns]
  );

  // シフトパターン更新
  const updateShiftPattern = useCallback(
    async (patternId: string, data: Partial<ShiftPattern>): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const updateData: Record<string, unknown> = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.shortName !== undefined) updateData.short_name = data.shortName;
        if (data.startTime !== undefined) updateData.start_time = data.startTime;
        if (data.endTime !== undefined) updateData.end_time = data.endTime;
        if (data.breakMinutes !== undefined) updateData.break_minutes = data.breakMinutes;
        if (data.color !== undefined) updateData.color = data.color;
        if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;
        if (data.isDayOff !== undefined) updateData.is_day_off = data.isDayOff;

        const { error: updateError } = await supabase
          .from('shift_patterns')
          .update(updateData)
          .eq('id', patternId)
          .eq('facility_id', facility.id);

        if (updateError) throw updateError;

        await fetchShiftPatterns();
        return true;
      } catch (err) {
        console.error('Failed to update shift pattern:', err);
        setError('シフトパターンの更新に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchShiftPatterns]
  );

  // シフトパターン削除（論理削除）
  const deleteShiftPattern = useCallback(
    async (patternId: string): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const { error: deleteError } = await supabase
          .from('shift_patterns')
          .update({ is_active: false })
          .eq('id', patternId)
          .eq('facility_id', facility.id);

        if (deleteError) throw deleteError;

        await fetchShiftPatterns();
        return true;
      } catch (err) {
        console.error('Failed to delete shift pattern:', err);
        setError('シフトパターンの削除に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchShiftPatterns]
  );

  // シフト一覧を取得
  const fetchShifts = useCallback(
    async (year: number, month: number) => {
      if (!facility?.id) return;

      setLoading(true);
      setError(null);

      try {
        // 月の開始日と終了日
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('shifts')
          .select(
            `
            *,
            shift_patterns (*)
          `
          )
          .eq('facility_id', facility.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (fetchError) throw fetchError;

        setShifts((data || []).map(mapShiftFromDb));
      } catch (err) {
        console.error('Failed to fetch shifts:', err);
        setError('シフトの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    },
    [facility?.id]
  );

  // シフトを設定
  const setShift = useCallback(
    async (
      staffId: string,
      date: string,
      patternId: string | null,
      customTime?: { startTime: string; endTime: string; breakMinutes?: number }
    ): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const upsertData: Record<string, unknown> = {
          facility_id: facility.id,
          staff_id: staffId,
          date,
          has_shift: patternId !== null,
          shift_pattern_id: patternId,
        };

        if (customTime) {
          upsertData.start_time = customTime.startTime;
          upsertData.end_time = customTime.endTime;
          upsertData.break_minutes = customTime.breakMinutes || 0;
        }

        const { error: upsertError } = await supabase.from('shifts').upsert(upsertData, {
          onConflict: 'facility_id,staff_id,date',
        });

        if (upsertError) throw upsertError;

        // ローカルステートを更新
        setShifts((prev) => {
          const existing = prev.find((s) => s.staffId === staffId && s.date === date);
          const pattern = shiftPatterns.find((p) => p.id === patternId);

          const newShift: ShiftWithPattern = {
            id: existing?.id || `shift-${Date.now()}`,
            facilityId: facility.id,
            staffId,
            date,
            hasShift: patternId !== null,
            shiftPatternId: patternId || undefined,
            startTime: customTime?.startTime,
            endTime: customTime?.endTime,
            breakMinutes: customTime?.breakMinutes,
            shiftPattern: pattern,
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (existing) {
            return prev.map((s) =>
              s.staffId === staffId && s.date === date ? newShift : s
            );
          }
          return [...prev, newShift];
        });

        return true;
      } catch (err) {
        console.error('Failed to set shift:', err);
        setError('シフトの設定に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, shiftPatterns]
  );

  // シフトをクリア
  const clearShift = useCallback(
    async (staffId: string, date: string): Promise<boolean> => {
      if (!facility?.id) return false;

      try {
        const { error: deleteError } = await supabase
          .from('shifts')
          .delete()
          .eq('facility_id', facility.id)
          .eq('staff_id', staffId)
          .eq('date', date);

        if (deleteError) throw deleteError;

        setShifts((prev) => prev.filter((s) => !(s.staffId === staffId && s.date === date)));

        return true;
      } catch (err) {
        console.error('Failed to clear shift:', err);
        return false;
      }
    },
    [facility?.id]
  );

  // 一括シフト設定
  const bulkSetShifts = useCallback(
    async (
      shiftsToSet: Array<{
        staffId: string;
        date: string;
        patternId: string | null;
        customTime?: { startTime: string; endTime: string; breakMinutes?: number };
      }>
    ): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const upsertData = shiftsToSet.map((s) => ({
          facility_id: facility.id,
          staff_id: s.staffId,
          date: s.date,
          has_shift: s.patternId !== null,
          shift_pattern_id: s.patternId,
          start_time: s.customTime?.startTime,
          end_time: s.customTime?.endTime,
          break_minutes: s.customTime?.breakMinutes,
        }));

        const { error: upsertError } = await supabase.from('shifts').upsert(upsertData, {
          onConflict: 'facility_id,staff_id,date',
        });

        if (upsertError) throw upsertError;

        // 該当月のシフトを再取得
        const dates = shiftsToSet.map((s) => s.date);
        const year = parseInt(dates[0].split('-')[0], 10);
        const month = parseInt(dates[0].split('-')[1], 10);
        await fetchShifts(year, month);

        return true;
      } catch (err) {
        console.error('Failed to bulk set shifts:', err);
        setError('シフトの一括設定に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchShifts]
  );

  // 月間スケジュールを取得
  const fetchMonthlySchedule = useCallback(
    async (year: number, month: number) => {
      if (!facility?.id) return;

      try {
        const { data, error: fetchError } = await supabase
          .from('monthly_shift_schedules')
          .select('*')
          .eq('facility_id', facility.id)
          .eq('year', year)
          .eq('month', month)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        setMonthlySchedule(data ? mapMonthlyScheduleFromDb(data) : null);
      } catch (err) {
        console.error('Failed to fetch monthly schedule:', err);
      }
    },
    [facility?.id]
  );

  // スケジュールを公開
  const publishSchedule = useCallback(
    async (year: number, month: number): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const { error: upsertError } = await supabase.from('monthly_shift_schedules').upsert(
          {
            facility_id: facility.id,
            year,
            month,
            status: 'published',
            published_at: new Date().toISOString(),
          },
          { onConflict: 'facility_id,year,month' }
        );

        if (upsertError) throw upsertError;

        await fetchMonthlySchedule(year, month);
        return true;
      } catch (err) {
        console.error('Failed to publish schedule:', err);
        setError('スケジュールの公開に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchMonthlySchedule]
  );

  // スケジュールを確定
  const confirmSchedule = useCallback(
    async (year: number, month: number): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from('monthly_shift_schedules')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('facility_id', facility.id)
          .eq('year', year)
          .eq('month', month);

        if (updateError) throw updateError;

        await fetchMonthlySchedule(year, month);
        return true;
      } catch (err) {
        console.error('Failed to confirm schedule:', err);
        setError('スケジュールの確定に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchMonthlySchedule]
  );

  // 再周知
  const republishSchedule = useCallback(
    async (year: number, month: number): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        // 再周知カウントをインクリメント
        const { data: current } = await supabase
          .from('monthly_shift_schedules')
          .select('republish_count')
          .eq('facility_id', facility.id)
          .eq('year', year)
          .eq('month', month)
          .single();

        const currentCount = current?.republish_count || 0;

        const { error: updateError } = await supabase
          .from('monthly_shift_schedules')
          .update({
            republished_at: new Date().toISOString(),
            republish_count: currentCount + 1,
          })
          .eq('facility_id', facility.id)
          .eq('year', year)
          .eq('month', month);

        if (updateError) throw updateError;

        await fetchMonthlySchedule(year, month);
        return true;
      } catch (err) {
        console.error('Failed to republish schedule:', err);
        setError('再周知に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchMonthlySchedule]
  );

  // 確認状況を取得
  const fetchConfirmations = useCallback(
    async (year: number, month: number) => {
      if (!facility?.id) return;

      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('shift_confirmations')
          .select(
            `
            *,
            shifts!inner (
              date,
              facility_id
            )
          `
          )
          .eq('shifts.facility_id', facility.id)
          .gte('shifts.date', startDate)
          .lte('shifts.date', endDate);

        if (fetchError) throw fetchError;

        setConfirmations((data || []).map(mapConfirmationFromDb));
      } catch (err) {
        console.error('Failed to fetch confirmations:', err);
      }
    },
    [facility?.id]
  );

  // ユーティリティ関数
  const getShiftDisplay = useCallback((shift: ShiftWithPattern): string => {
    return formatShiftDisplay(shift);
  }, []);

  const getShiftWorkHours = useCallback((shift: ShiftWithPattern): number => {
    return calculateShiftWorkHours(shift);
  }, []);

  // 初期読み込み（パターンのみ）
  useEffect(() => {
    if (facility?.id) {
      fetchShiftPatterns();
    }
  }, [facility?.id, fetchShiftPatterns]);

  return {
    shifts,
    shiftPatterns,
    monthlySchedule,
    confirmations,
    loading,
    error,
    fetchShiftPatterns,
    createShiftPattern,
    updateShiftPattern,
    deleteShiftPattern,
    fetchShifts,
    setShift,
    clearShift,
    bulkSetShifts,
    fetchMonthlySchedule,
    publishSchedule,
    confirmSchedule,
    republishSchedule,
    fetchConfirmations,
    getShiftDisplay,
    getShiftWorkHours,
  };
}

// DBレコードのマッピング関数
function mapPatternFromDb(record: Record<string, unknown>): ShiftPattern {
  return {
    id: record.id as string,
    facilityId: record.facility_id as string,
    name: record.name as string,
    shortName: record.short_name as string | undefined,
    startTime: record.start_time as string | undefined,
    endTime: record.end_time as string | undefined,
    breakMinutes: record.break_minutes as number,
    color: record.color as string,
    displayOrder: record.display_order as number,
    isDayOff: record.is_day_off as boolean,
    isActive: record.is_active as boolean,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

function mapShiftFromDb(record: Record<string, unknown>): ShiftWithPattern {
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
    shiftPattern: patternRecord ? mapPatternFromDb(patternRecord) : undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

function mapMonthlyScheduleFromDb(record: Record<string, unknown>): MonthlyShiftSchedule {
  return {
    id: record.id as string,
    facilityId: record.facility_id as string,
    year: record.year as number,
    month: record.month as number,
    status: record.status as 'draft' | 'published' | 'confirmed',
    publishedAt: record.published_at as string | undefined,
    confirmedAt: record.confirmed_at as string | undefined,
    republishedAt: record.republished_at as string | undefined,
    republishCount: record.republish_count as number | undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

function mapConfirmationFromDb(record: Record<string, unknown>): ShiftConfirmation {
  return {
    id: record.id as string,
    shiftId: record.shift_id as string,
    userId: record.user_id as string,
    status: record.status as 'pending' | 'confirmed' | 'needs_discussion',
    comment: record.comment as string | undefined,
    respondedAt: record.responded_at as string | undefined,
    resolvedAt: record.resolved_at as string | undefined,
    resolutionNote: record.resolution_note as string | undefined,
    requiresReconfirm: record.requires_reconfirm as boolean | undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

export default useShiftManagement;
