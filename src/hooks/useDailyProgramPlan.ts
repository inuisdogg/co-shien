/**
 * 日別プログラム計画フック
 * Daily Program Plan Hook
 *
 * 日ごとのスタッフ・児童・加算データを管理し、単位数を計算
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Staff, Child, ScheduleItem } from '@/types';

// ============================================
// 型定義
// ============================================

// 加算定義
export interface AdditionDefinition {
  id: string;
  code: string;
  name: string;
  shortName: string;
  categoryCode: string;
  additionType: 'facility_preset' | 'monthly' | 'daily';
  units: number | null;
  isPercentage: boolean;
  percentageRate: number | null;
  maxTimesPerMonth: number | null;
  maxTimesPerDay: number;
  exclusiveGroup: string | null;
  requirements: string | null;
  requirementsJson: Record<string, unknown> | null;
  recordingGuide: string | null;
  displayOrder: number;
  isActive: boolean;
}

// 日別計画
export interface DailyProgramPlan {
  id: string;
  facilityId: string;
  date: string;
  plannedAdditions: string[];
  autoAdditions: string[];
  estimatedTotalUnits: number;
  actualTotalUnits: number | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// 加算ターゲット
export interface DailyAdditionTarget {
  id: string;
  facilityId: string;
  date: string;
  childId: string;
  additionCode: string;
  targetStatus: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  assignedStaffId: string | null;
  units: number | null;
  notes: string | null;
  completedAt: string | null;
  completedBy: string | null;
  cancelReason: string | null;
  usageRecordId: string | null;
  createdAt: string;
  updatedAt: string;
  // 拡張情報
  childName?: string;
  additionName?: string;
  assignedStaffName?: string;
}

// 日次データ
export interface DailyData {
  date: string;
  staffOnShift: Staff[];
  scheduledChildren: Child[];
  schedules: ScheduleItem[];
  plan: DailyProgramPlan | null;
  additionTargets: DailyAdditionTarget[];
}

// 単位数内訳
export interface UnitBreakdown {
  baseUnits: number;
  facilityPresetUnits: number;
  dailyUnits: number;
  totalUnits: number;
  details: {
    code: string;
    name: string;
    units: number;
    count: number;
    subtotal: number;
    type: 'base' | 'facility_preset' | 'daily';
  }[];
}

// フックの返り値型
export interface UseDailyProgramPlanReturn {
  // データ
  dailyData: DailyData | null;
  additionDefinitions: AdditionDefinition[];
  unitBreakdown: UnitBreakdown | null;
  // 状態
  loading: boolean;
  error: string | null;
  selectedDate: string | null;
  // アクション
  loadDailyData: (date: string) => Promise<void>;
  savePlan: (plannedAdditions: string[], notes?: string) => Promise<void>;
  addTarget: (childId: string, additionCode: string, assignedStaffId?: string) => Promise<void>;
  updateTarget: (targetId: string, updates: Partial<DailyAdditionTarget>) => Promise<void>;
  removeTarget: (targetId: string) => Promise<void>;
  completeTarget: (targetId: string, notes?: string) => Promise<void>;
  calculateUnits: (
    children: Child[],
    plannedAdditions: string[],
    targets: DailyAdditionTarget[]
  ) => UnitBreakdown;
  refreshAdditionDefinitions: () => Promise<void>;
}

// ============================================
// 定数
// ============================================

// 基本単位（放課後等デイサービス、定員10名、区分1の場合の例）
const BASE_UNITS_PER_DAY = 604;

// カテゴリ順序
const CATEGORY_ORDER: Record<string, number> = {
  staffing: 1,
  specialist: 2,
  treatment: 3,
  family: 4,
  transport: 5,
  extension: 6,
  support: 7,
  medical: 8,
  other: 99,
};

// ============================================
// フック実装
// ============================================

export function useDailyProgramPlan(): UseDailyProgramPlanReturn {
  const { facility, user } = useAuth();
  const facilityId = facility?.id;

  // 状態
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [additionDefinitions, setAdditionDefinitions] = useState<AdditionDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 加算定義を取得
  const refreshAdditionDefinitions = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('addition_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (fetchError) throw fetchError;

      const mapped: AdditionDefinition[] = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        code: row.code as string,
        name: row.name as string,
        shortName: row.short_name as string,
        categoryCode: row.category_code as string,
        additionType: row.addition_type as AdditionDefinition['additionType'],
        units: row.units as number | null,
        isPercentage: row.is_percentage as boolean,
        percentageRate: row.percentage_rate as number | null,
        maxTimesPerMonth: row.max_times_per_month as number | null,
        maxTimesPerDay: (row.max_times_per_day as number) || 1,
        exclusiveGroup: row.exclusive_group as string | null,
        requirements: row.requirements as string | null,
        requirementsJson: row.requirements_json as Record<string, unknown> | null,
        recordingGuide: row.recording_guide as string | null,
        displayOrder: row.display_order as number,
        isActive: row.is_active as boolean,
      }));

      // カテゴリ順にソート
      mapped.sort((a, b) => {
        const orderA = CATEGORY_ORDER[a.categoryCode] || 99;
        const orderB = CATEGORY_ORDER[b.categoryCode] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.displayOrder - b.displayOrder;
      });

      setAdditionDefinitions(mapped);
    } catch (err) {
      console.error('Error fetching addition definitions:', err);
    }
  }, []);

  // 初期化
  useEffect(() => {
    refreshAdditionDefinitions();
  }, [refreshAdditionDefinitions]);

  // 日次データを読み込み
  const loadDailyData = useCallback(async (date: string) => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);
    setSelectedDate(date);

    try {
      // 並列でデータ取得
      const [shiftsResult, schedulesResult, planResult, targetsResult] = await Promise.all([
        // シフトデータ（その日のスタッフ）
        supabase
          .from('shifts')
          .select('staff_id, staff:staff_id(*)')
          .eq('facility_id', facilityId)
          .eq('date', date)
          .eq('has_shift', true),

        // スケジュールデータ（その日の児童）
        supabase
          .from('schedules')
          .select('*, child:child_id(*)')
          .eq('facility_id', facilityId)
          .eq('date', date),

        // 日別計画
        supabase
          .from('daily_program_plans')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('date', date)
          .single(),

        // 加算ターゲット
        supabase
          .from('daily_addition_targets')
          .select('*, child:child_id(name), staff:assigned_staff_id(name)')
          .eq('facility_id', facilityId)
          .eq('date', date),
      ]);

      // スタッフを抽出
      const staffOnShift: Staff[] = (shiftsResult.data || [])
        .map((row: any) => row.staff as Staff)
        .filter(Boolean);

      // 児童を抽出（重複除去）
      const childMap = new Map<string, Child>();
      const schedules: ScheduleItem[] = [];
      (schedulesResult.data || []).forEach((row: any) => {
        if (row.child) {
          childMap.set(row.child.id, row.child as Child);
        }
        schedules.push({
          id: row.id,
          facilityId: row.facility_id,
          date: row.date,
          childId: row.child_id,
          childName: row.child?.name || '',
          slot: row.slot,
          hasPickup: row.has_pickup || false,
          hasDropoff: row.has_dropoff || false,
          staffId: row.staff_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      });
      const scheduledChildren = Array.from(childMap.values());

      // 日別計画
      let plan: DailyProgramPlan | null = null;
      if (planResult.data && !planResult.error) {
        const row = planResult.data as Record<string, unknown>;
        plan = {
          id: row.id as string,
          facilityId: row.facility_id as string,
          date: row.date as string,
          plannedAdditions: (row.planned_additions as string[]) || [],
          autoAdditions: (row.auto_additions as string[]) || [],
          estimatedTotalUnits: (row.estimated_total_units as number) || 0,
          actualTotalUnits: row.actual_total_units as number | null,
          notes: row.notes as string | null,
          createdBy: row.created_by as string | null,
          updatedBy: row.updated_by as string | null,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }

      // 加算ターゲット
      const additionTargets: DailyAdditionTarget[] = (targetsResult.data || []).map((row: any) => ({
        id: row.id,
        facilityId: row.facility_id,
        date: row.date,
        childId: row.child_id,
        additionCode: row.addition_code,
        targetStatus: row.target_status,
        assignedStaffId: row.assigned_staff_id,
        units: row.units,
        notes: row.notes,
        completedAt: row.completed_at,
        completedBy: row.completed_by,
        cancelReason: row.cancel_reason,
        usageRecordId: row.usage_record_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        childName: row.child?.name,
        assignedStaffName: row.staff?.name,
      }));

      setDailyData({
        date,
        staffOnShift,
        scheduledChildren,
        schedules,
        plan,
        additionTargets,
      });
    } catch (err) {
      console.error('Error loading daily data:', err);
      setError('日次データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  // 計画を保存
  const savePlan = useCallback(async (plannedAdditions: string[], notes?: string) => {
    if (!facilityId || !selectedDate || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from('daily_program_plans')
        .upsert({
          facility_id: facilityId,
          date: selectedDate,
          planned_additions: plannedAdditions,
          notes: notes || null,
          updated_by: user.id,
        }, {
          onConflict: 'facility_id,date',
        });

      if (upsertError) throw upsertError;

      // リロード
      await loadDailyData(selectedDate);
    } catch (err) {
      console.error('Error saving plan:', err);
      setError('計画の保存に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [facilityId, selectedDate, user, loadDailyData]);

  // ターゲットを追加
  const addTarget = useCallback(async (
    childId: string,
    additionCode: string,
    assignedStaffId?: string
  ) => {
    if (!facilityId || !selectedDate) return;

    setLoading(true);
    setError(null);

    try {
      const definition = additionDefinitions.find(d => d.code === additionCode);

      const { error: insertError } = await supabase
        .from('daily_addition_targets')
        .insert({
          facility_id: facilityId,
          date: selectedDate,
          child_id: childId,
          addition_code: additionCode,
          target_status: 'planned',
          assigned_staff_id: assignedStaffId || null,
          units: definition?.units || null,
        });

      if (insertError) throw insertError;

      await loadDailyData(selectedDate);
    } catch (err) {
      console.error('Error adding target:', err);
      setError('ターゲットの追加に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [facilityId, selectedDate, additionDefinitions, loadDailyData]);

  // ターゲットを更新
  const updateTarget = useCallback(async (
    targetId: string,
    updates: Partial<DailyAdditionTarget>
  ) => {
    if (!selectedDate) return;

    setLoading(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {};
      if (updates.targetStatus !== undefined) updateData.target_status = updates.targetStatus;
      if (updates.assignedStaffId !== undefined) updateData.assigned_staff_id = updates.assignedStaffId;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { error: updateError } = await supabase
        .from('daily_addition_targets')
        .update(updateData)
        .eq('id', targetId);

      if (updateError) throw updateError;

      await loadDailyData(selectedDate);
    } catch (err) {
      console.error('Error updating target:', err);
      setError('ターゲットの更新に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate, loadDailyData]);

  // ターゲットを削除
  const removeTarget = useCallback(async (targetId: string) => {
    if (!selectedDate) return;

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('daily_addition_targets')
        .delete()
        .eq('id', targetId);

      if (deleteError) throw deleteError;

      await loadDailyData(selectedDate);
    } catch (err) {
      console.error('Error removing target:', err);
      setError('ターゲットの削除に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate, loadDailyData]);

  // ターゲットを完了
  const completeTarget = useCallback(async (targetId: string, notes?: string) => {
    if (!selectedDate || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('daily_addition_targets')
        .update({
          target_status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          notes: notes || null,
        })
        .eq('id', targetId);

      if (updateError) throw updateError;

      await loadDailyData(selectedDate);
    } catch (err) {
      console.error('Error completing target:', err);
      setError('ターゲットの完了に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user, loadDailyData]);

  // 単位数を計算
  const calculateUnits = useCallback((
    children: Child[],
    plannedAdditions: string[],
    targets: DailyAdditionTarget[]
  ): UnitBreakdown => {
    const details: UnitBreakdown['details'] = [];
    let baseUnits = 0;
    let facilityPresetUnits = 0;
    let dailyUnits = 0;

    // 基本単位（児童数 × 基本単位）
    const childCount = children.length;
    const baseTotal = childCount * BASE_UNITS_PER_DAY;
    baseUnits = baseTotal;
    details.push({
      code: 'base',
      name: '基本報酬',
      units: BASE_UNITS_PER_DAY,
      count: childCount,
      subtotal: baseTotal,
      type: 'base',
    });

    // 体制加算（施設全体）
    plannedAdditions.forEach(code => {
      const definition = additionDefinitions.find(d => d.code === code);
      if (!definition) return;

      if (definition.additionType === 'facility_preset') {
        let subtotal = 0;
        if (definition.isPercentage && definition.percentageRate) {
          subtotal = Math.floor(baseTotal * (definition.percentageRate / 100));
        } else if (definition.units) {
          subtotal = definition.units * childCount;
        }

        facilityPresetUnits += subtotal;
        details.push({
          code: definition.code,
          name: definition.name,
          units: definition.units || 0,
          count: childCount,
          subtotal,
          type: 'facility_preset',
        });
      }
    });

    // 実施加算（児童ごと）
    const targetCounts: Record<string, number> = {};
    targets.forEach(target => {
      if (target.targetStatus === 'cancelled') return;
      const key = target.additionCode;
      targetCounts[key] = (targetCounts[key] || 0) + 1;
    });

    Object.entries(targetCounts).forEach(([code, count]) => {
      const definition = additionDefinitions.find(d => d.code === code);
      if (!definition || definition.additionType !== 'daily') return;

      const subtotal = (definition.units || 0) * count;
      dailyUnits += subtotal;
      details.push({
        code: definition.code,
        name: definition.name,
        units: definition.units || 0,
        count,
        subtotal,
        type: 'daily',
      });
    });

    return {
      baseUnits,
      facilityPresetUnits,
      dailyUnits,
      totalUnits: baseUnits + facilityPresetUnits + dailyUnits,
      details,
    };
  }, [additionDefinitions]);

  // 単位数内訳の計算（現在のデータに基づく）
  const unitBreakdown = useMemo(() => {
    if (!dailyData) return null;

    return calculateUnits(
      dailyData.scheduledChildren,
      dailyData.plan?.plannedAdditions || [],
      dailyData.additionTargets
    );
  }, [dailyData, calculateUnits]);

  return {
    dailyData,
    additionDefinitions,
    unitBreakdown,
    loading,
    error,
    selectedDate,
    loadDailyData,
    savePlan,
    addTarget,
    updateTarget,
    removeTarget,
    completeTarget,
    calculateUnits,
    refreshAdditionDefinitions,
  };
}

export default useDailyProgramPlan;
