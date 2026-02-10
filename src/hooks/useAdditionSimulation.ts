/**
 * 加算シミュレーション用フック
 * 児童別月間加算計画の取得・保存・計算
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Child } from '@/types';
import { Addition, MONTHLY_LIMITS } from '@/utils/additionCalculator';

// 加算計画の型
export type ChildAdditionPlan = {
  id?: string;
  childId: string;
  facilityId: string;
  year: number;
  month: number;
  additionCode: string;
  plannedCount: number;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

// 児童別集計結果
export type ChildSimulationResult = {
  child: Child;
  scheduledDays: number; // スケジュールからの予定日数
  plans: ChildAdditionPlan[];
  actualCounts: Record<string, number>; // 実績（addition_code -> count）
  baseUnits: number;
  additionUnits: number;
  autoAdditionUnits: number;
  totalUnits: number;
  revenue: number;
};

// 全体サマリー
export type SimulationSummary = {
  totalChildren: number;
  totalScheduledDays: number;
  totalBaseUnits: number;
  totalAdditionUnits: number;
  totalUnits: number;
  totalRevenue: number;
  additionBreakdown: Record<string, { planned: number; actual: number; units: number }>;
};

// 計画可能な加算リスト（日次実績型）
export const PLANNABLE_ADDITIONS = [
  'specialist_support',    // 専門的支援実施加算
  'transport',             // 送迎加算
  'family_support_1',      // 家族支援加算(I)
  'family_support_2',      // 家族支援加算(II)
  'family_support_3',      // 家族支援加算(III)
  'family_support_4',      // 家族支援加算(IV)
  'agency_cooperation_1',  // 関係機関連携加算(I)
  'agency_cooperation_2',  // 関係機関連携加算(II)
];

export function useAdditionSimulation() {
  const { facility, user } = useAuth();
  const facilityId = facility?.id || '';

  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const [children, setChildren] = useState<Child[]>([]);
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [plans, setPlans] = useState<ChildAdditionPlan[]>([]);
  const [scheduledDays, setScheduledDays] = useState<Record<string, number>>({}); // childId -> days
  const [actualCounts, setActualCounts] = useState<Record<string, Record<string, number>>>({}); // childId -> { additionCode -> count }
  const [unitPrice, setUnitPrice] = useState(11.2); // 1級地のデフォルト単価
  const [baseRewardUnits, setBaseRewardUnits] = useState(480); // 放デイ区分2のデフォルト

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facilityId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { year, month } = selectedMonth;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 月末

      // 1. 児童一覧を取得
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('contract_status', 'active')
        .order('name');

      if (childrenError) throw childrenError;

      const mappedChildren: Child[] = (childrenData || []).map((c: any) => ({
        id: c.id,
        facilityId: c.facility_id,
        name: c.name,
        nameKana: c.name_kana,
        birthDate: c.birth_date,
        contractStatus: c.contract_status,
        needsPickup: c.needs_pickup ?? false,
        needsDropoff: c.needs_dropoff ?? false,
        medical_care_score: c.medical_care_score,
        behavior_disorder_score: c.behavior_disorder_score,
        care_needs_category: c.care_needs_category,
        is_protected_child: c.is_protected_child,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
      setChildren(mappedChildren);

      // 2. 加算マスタを取得
      const { data: additionsData, error: additionsError } = await supabase
        .from('additions')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (additionsError) throw additionsError;

      const mappedAdditions: Addition[] = (additionsData || []).map((a: any) => ({
        code: a.code,
        name: a.name,
        short_name: a.short_name,
        category_code: a.category_code,
        units: a.units,
        unit_type: a.unit_type,
        is_percentage: a.is_percentage,
        percentage_rate: a.percentage_rate,
        max_times_per_month: a.max_times_per_month,
        max_times_per_day: a.max_times_per_day || 1,
        is_exclusive: a.is_exclusive,
        exclusive_with: a.exclusive_with,
        requirements: a.requirements,
        requirements_json: a.requirements_json,
        applicable_services: a.applicable_services,
        addition_type: a.addition_type,
      }));
      setAdditions(mappedAdditions);

      // 3. スケジュール（予定利用日数）を取得
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('child_id')
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (schedulesError) throw schedulesError;

      // 児童ごとの日数を集計
      const daysCount: Record<string, number> = {};
      for (const s of schedulesData || []) {
        daysCount[s.child_id] = (daysCount[s.child_id] || 0) + 1;
      }
      setScheduledDays(daysCount);

      // 4. 加算計画を取得
      const { data: plansData, error: plansError } = await supabase
        .from('child_addition_plans')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year', year)
        .eq('month', month);

      if (plansError) throw plansError;

      const mappedPlans: ChildAdditionPlan[] = (plansData || []).map((p: any) => ({
        id: p.id,
        childId: p.child_id,
        facilityId: p.facility_id,
        year: p.year,
        month: p.month,
        additionCode: p.addition_code,
        plannedCount: p.planned_count,
        notes: p.notes,
        createdBy: p.created_by,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
      setPlans(mappedPlans);

      // 5. 実績を取得
      const { data: recordsData, error: recordsError } = await supabase
        .from('daily_addition_records')
        .select('child_id, addition_code, times')
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (recordsError) throw recordsError;

      // 児童ごと・加算コードごとに集計
      const counts: Record<string, Record<string, number>> = {};
      for (const r of recordsData || []) {
        if (!counts[r.child_id]) counts[r.child_id] = {};
        counts[r.child_id][r.addition_code] = (counts[r.child_id][r.addition_code] || 0) + (r.times || 1);
      }
      setActualCounts(counts);

      // 6. 施設設定から単価を取得
      const { data: settingsData } = await supabase
        .from('facility_settings')
        .select('regional_grade')
        .eq('facility_id', facilityId)
        .single();

      if (settingsData?.regional_grade) {
        const { data: unitData } = await supabase
          .from('regional_units')
          .select('unit_price')
          .eq('grade', settingsData.regional_grade)
          .single();

        if (unitData) {
          setUnitPrice(unitData.unit_price);
        }
      }

    } catch (err: any) {
      console.error('Error fetching simulation data:', err);
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 計画を更新
  const updatePlan = useCallback((childId: string, additionCode: string, count: number) => {
    setPlans(prev => {
      const existing = prev.find(p => p.childId === childId && p.additionCode === additionCode);
      if (existing) {
        return prev.map(p =>
          p.childId === childId && p.additionCode === additionCode
            ? { ...p, plannedCount: count }
            : p
        );
      } else {
        return [...prev, {
          childId,
          facilityId,
          year: selectedMonth.year,
          month: selectedMonth.month,
          additionCode,
          plannedCount: count,
        }];
      }
    });
  }, [facilityId, selectedMonth]);

  // 計画を保存
  const savePlans = useCallback(async () => {
    if (!facilityId || !user?.id) return;

    setIsSaving(true);
    setError(null);

    try {
      const { year, month } = selectedMonth;

      // 既存の計画を削除
      await supabase
        .from('child_addition_plans')
        .delete()
        .eq('facility_id', facilityId)
        .eq('year', year)
        .eq('month', month);

      // 新しい計画を挿入（0回のものは除外）
      const plansToInsert = plans
        .filter(p => p.plannedCount > 0)
        .map(p => ({
          child_id: p.childId,
          facility_id: facilityId,
          year,
          month,
          addition_code: p.additionCode,
          planned_count: p.plannedCount,
          notes: p.notes,
          created_by: user.id,
        }));

      if (plansToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('child_addition_plans')
          .insert(plansToInsert);

        if (insertError) throw insertError;
      }

      await fetchData();
    } catch (err: any) {
      console.error('Error saving plans:', err);
      setError(err.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [facilityId, user?.id, plans, selectedMonth, fetchData]);

  // 前月コピー
  const copyFromPreviousMonth = useCallback(async () => {
    if (!facilityId) return;

    const { year, month } = selectedMonth;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    try {
      const { data: prevPlans, error: prevError } = await supabase
        .from('child_addition_plans')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year', prevYear)
        .eq('month', prevMonth);

      if (prevError) throw prevError;

      if (!prevPlans || prevPlans.length === 0) {
        setError('前月の計画がありません');
        return;
      }

      // 前月の計画を現在の状態に反映
      const copiedPlans: ChildAdditionPlan[] = prevPlans.map((p: any) => ({
        childId: p.child_id,
        facilityId,
        year,
        month,
        additionCode: p.addition_code,
        plannedCount: p.planned_count,
        notes: p.notes,
      }));

      setPlans(copiedPlans);
    } catch (err: any) {
      console.error('Error copying from previous month:', err);
      setError(err.message || '前月コピーに失敗しました');
    }
  }, [facilityId, selectedMonth]);

  // 児童別シミュレーション結果を計算
  const childResults = useMemo((): ChildSimulationResult[] => {
    return children.map(child => {
      const days = scheduledDays[child.id] || 0;
      const childPlans = plans.filter(p => p.childId === child.id);
      const childActual = actualCounts[child.id] || {};

      // 基本報酬
      const baseUnits = baseRewardUnits * days;

      // 計画加算
      let additionUnits = 0;
      for (const plan of childPlans) {
        const addition = additions.find(a => a.code === plan.additionCode);
        if (addition && addition.units) {
          additionUnits += addition.units * plan.plannedCount;
        }
      }

      // 自動加算（児童属性ベース）
      let autoAdditionUnits = 0;
      // 個別サポート加算(I) - ケアニーズカテゴリがある場合
      if ((child as any).care_needs_category) {
        const addition = additions.find(a => a.code === 'individual_support_1');
        if (addition && addition.units) {
          autoAdditionUnits += addition.units * days;
        }
      }
      // 強度行動障害児支援加算 - スコア20点以上
      if (((child as any).behavior_disorder_score || 0) >= 20) {
        const addition = additions.find(a => a.code === 'behavior_support_1');
        if (addition && addition.units) {
          autoAdditionUnits += addition.units * days;
        }
      }

      const totalUnits = baseUnits + additionUnits + autoAdditionUnits;
      const revenue = Math.floor(totalUnits * unitPrice);

      return {
        child,
        scheduledDays: days,
        plans: childPlans,
        actualCounts: childActual,
        baseUnits,
        additionUnits,
        autoAdditionUnits,
        totalUnits,
        revenue,
      };
    });
  }, [children, plans, scheduledDays, actualCounts, additions, baseRewardUnits, unitPrice]);

  // 全体サマリーを計算
  const summary = useMemo((): SimulationSummary => {
    const breakdown: Record<string, { planned: number; actual: number; units: number }> = {};

    // 加算別に集計
    for (const code of PLANNABLE_ADDITIONS) {
      const addition = additions.find(a => a.code === code);
      let planned = 0;
      let actual = 0;

      for (const result of childResults) {
        const plan = result.plans.find(p => p.additionCode === code);
        if (plan) planned += plan.plannedCount;
        if (result.actualCounts[code]) actual += result.actualCounts[code];
      }

      breakdown[code] = {
        planned,
        actual,
        units: addition?.units || 0,
      };
    }

    return {
      totalChildren: children.length,
      totalScheduledDays: Object.values(scheduledDays).reduce((a, b) => a + b, 0),
      totalBaseUnits: childResults.reduce((sum, r) => sum + r.baseUnits, 0),
      totalAdditionUnits: childResults.reduce((sum, r) => sum + r.additionUnits + r.autoAdditionUnits, 0),
      totalUnits: childResults.reduce((sum, r) => sum + r.totalUnits, 0),
      totalRevenue: childResults.reduce((sum, r) => sum + r.revenue, 0),
      additionBreakdown: breakdown,
    };
  }, [childResults, children.length, scheduledDays, additions]);

  // 計画可能な加算を取得
  const plannableAdditions = useMemo(() => {
    return additions.filter(a => PLANNABLE_ADDITIONS.includes(a.code));
  }, [additions]);

  return {
    // 状態
    selectedMonth,
    setSelectedMonth,
    children,
    additions,
    plannableAdditions,
    plans,
    childResults,
    summary,
    showComparison,
    setShowComparison,
    unitPrice,
    baseRewardUnits,

    // ローディング・エラー
    isLoading,
    isSaving,
    error,

    // 操作
    updatePlan,
    savePlans,
    copyFromPreviousMonth,
    refresh: fetchData,

    // 定数
    monthlyLimits: MONTHLY_LIMITS,
  };
}
