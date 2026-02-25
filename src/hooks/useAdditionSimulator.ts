/**
 * 加算シミュレーターフック
 * スタッフ・児童・施設データを取得し、加算判定とシミュレーションを行う
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  StaffForJudgment,
  FacilityForJudgment,
  AdditionJudgmentResult,
  calculateFTE,
  judgeAllSystemAdditions,
  selectBestAdditionInGroup,
  simulateMonthlyRevenue,
  generateOptimizationSuggestions,
  REGION_UNIT_RATES,
} from '@/utils/additionJudgment';

// 加算マスタの型
type AdditionMaster = {
  code: string;
  name: string;
  shortName: string;
  category: string;
  type: string;
  units: number;
  percentRate: number | null;
  requirements: string;
  exclusiveGroup: string | null;
};

// 子供の加算関連データ
type ChildAdditionData = {
  id: string;
  name: string;
  medicalCareScore: number | null;
  behaviorDisorderScore: number | null;
  isProtectedChild: boolean;
};

// シミュレーション結果
export type SimulationResult = {
  totalRevenue: number;
  revenueBreakdown: {
    baseRevenue: number;
    systemAdditionRevenue: number;
    percentAdditionRevenue: number;
    implementationRevenue: number;
  };
  perChildRevenue: number;
  systemAdditions: AdditionJudgmentResult[];
  selectedAdditions: AdditionJudgmentResult[];
  optimizationSuggestions: ReturnType<typeof generateOptimizationSuggestions>;
};

// シミュレーションパラメータ
export type SimulationParams = {
  childCount: number;
  averageUsageDays: number;
  baseUnits: number;
  regionGrade: number;
  percentAdditions: number; // 処遇改善加算等のパーセント
};

interface UseAdditionSimulatorReturn {
  // データ
  staff: StaffForJudgment[];
  children: ChildAdditionData[];
  facilitySettings: FacilityForJudgment | null;
  additionMaster: AdditionMaster[];
  currentAdditions: string[];

  // シミュレーション
  simulationParams: SimulationParams;
  setSimulationParams: (params: Partial<SimulationParams>) => void;
  simulationResult: SimulationResult | null;

  // 状態
  loading: boolean;
  error: string | null;

  // 操作
  refresh: () => Promise<void>;
  runSimulation: () => void;
}

// 定員別の基本報酬単位（児発・放デイ）
const BASE_UNITS_BY_CAPACITY: Record<number, number> = {
  10: 897,
  15: 765,
  20: 700,
};

export function useAdditionSimulator(): UseAdditionSimulatorReturn {
  const { facility } = useAuth();

  // データ状態
  const [staff, setStaff] = useState<StaffForJudgment[]>([]);
  const [children, setChildren] = useState<ChildAdditionData[]>([]);
  const [facilitySettings, setFacilitySettings] = useState<FacilityForJudgment | null>(null);
  const [additionMaster, setAdditionMaster] = useState<AdditionMaster[]>([]);
  const [currentAdditions, setCurrentAdditions] = useState<string[]>([]);

  // シミュレーションパラメータ
  const [simulationParams, setSimulationParamsState] = useState<SimulationParams>({
    childCount: 10,
    averageUsageDays: 20,
    baseUnits: 897,
    regionGrade: 6,
    percentAdditions: 10.0, // 処遇改善加算(II)をデフォルト
  });

  // ローディング・エラー状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // シミュレーション結果
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // パラメータ更新
  const setSimulationParams = useCallback((params: Partial<SimulationParams>) => {
    setSimulationParamsState(prev => ({ ...prev, ...params }));
  }, []);

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    setError(null);

    try {
      // スタッフと人員設定を取得
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select(`
          id,
          name,
          qualifications,
          years_of_experience
        `)
        .eq('facility_id', facility.id);

      if (staffError) throw staffError;

      // 人員配置設定を取得
      const { data: personnelData, error: personnelError } = await supabase
        .from('staff_personnel_settings')
        .select('*')
        .eq('facility_id', facility.id);

      if (personnelError) throw personnelError;

      // 施設設定を取得
      const { data: settingsData, error: settingsError } = await supabase
        .from('facility_settings')
        .select('*')
        .eq('facility_id', facility.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

      // 子供を取得
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('id, name, medical_care_score, behavior_disorder_score, is_protected_child')
        .eq('facility_id', facility.id)
        .in('contract_status', ['active', 'pre-contract']);

      if (childrenError) throw childrenError;

      // 現在の加算設定を取得
      const { data: additionSettingsData } = await supabase
        .from('facility_addition_settings')
        .select('addition_code, is_enabled')
        .eq('facility_id', facility.id)
        .eq('is_enabled', true);

      // スタッフデータをマッピング
      const mappedStaff: StaffForJudgment[] = (staffData || []).map(s => {
        const personnel = personnelData?.find(p => p.staff_id === s.id);
        const workStyle = personnel?.work_style || 'parttime';
        const contractedWeeklyHours = personnel?.contracted_weekly_hours || 40;
        const standardWeeklyHours = 40;

        // 資格データのパース（カンマ区切りの文字列または配列）
        let qualifications: string[] = [];
        if (s.qualifications) {
          if (Array.isArray(s.qualifications)) {
            qualifications = s.qualifications;
          } else if (typeof s.qualifications === 'string') {
            qualifications = s.qualifications.split(',').map((q: string) => q.trim());
          }
        }

        return {
          id: s.id,
          name: s.name,
          personnelType: personnel?.personnel_type || 'standard',
          workStyle,
          isManager: personnel?.is_manager || false,
          isServiceManager: personnel?.is_service_manager || false,
          contractedWeeklyHours,
          qualifications,
          yearsOfExperience: s.years_of_experience || 0,
          fte: calculateFTE(workStyle, contractedWeeklyHours, standardWeeklyHours),
        };
      });

      // 施設設定をマッピング
      const capacity = settingsData?.capacity?.AM || settingsData?.capacity?.PM || 10;
      const mappedSettings: FacilityForJudgment = {
        standardWeeklyHours: 40,
        capacity,
        regionGrade: 6, // デフォルト6級地
      };

      // 子供データをマッピング
      const mappedChildren: ChildAdditionData[] = (childrenData || []).map(c => ({
        id: c.id,
        name: c.name,
        medicalCareScore: c.medical_care_score,
        behaviorDisorderScore: c.behavior_disorder_score,
        isProtectedChild: c.is_protected_child || false,
      }));

      // 現在有効な加算コード
      const enabledAdditions = (additionSettingsData || [])
        .filter(a => a.is_enabled)
        .map(a => a.addition_code);

      setStaff(mappedStaff);
      setFacilitySettings(mappedSettings);
      setChildren(mappedChildren);
      setCurrentAdditions(enabledAdditions);

      // 基本報酬単位を定員に応じて設定
      const baseUnits = BASE_UNITS_BY_CAPACITY[capacity] || 700;
      setSimulationParamsState(prev => ({
        ...prev,
        childCount: mappedChildren.length || 10,
        baseUnits,
      }));

    } catch (err) {
      console.error('Failed to fetch simulation data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  // シミュレーション実行
  const runSimulation = useCallback(() => {
    if (staff.length === 0) return;

    // 体制加算を判定
    const systemAdditions = judgeAllSystemAdditions(staff, currentAdditions);

    // 最適な加算を選択
    const selectedAdditions = selectBestAdditionInGroup(systemAdditions);

    // 選択された加算の合計単位数
    const systemAdditionUnits = selectedAdditions
      .filter(a => a.isEligible)
      .reduce((sum, a) => sum + a.units, 0);

    // 月間売上シミュレーション
    const revenueResult = simulateMonthlyRevenue({
      baseUnits: simulationParams.baseUnits,
      systemAdditionUnits,
      percentAdditions: simulationParams.percentAdditions,
      childCount: simulationParams.childCount,
      averageUsageDays: simulationParams.averageUsageDays,
      regionGrade: simulationParams.regionGrade,
    });

    // 最適化提案を生成
    const suggestions = generateOptimizationSuggestions(
      staff,
      systemAdditions,
      simulationParams.regionGrade
    );

    setSimulationResult({
      ...revenueResult,
      systemAdditions,
      selectedAdditions,
      optimizationSuggestions: suggestions,
    });
  }, [staff, currentAdditions, simulationParams]);

  // 初期読み込み
  useEffect(() => {
    if (facility?.id) {
      fetchData();
    }
  }, [facility?.id, fetchData]);

  // パラメータ変更時に自動でシミュレーション実行
  useEffect(() => {
    if (staff.length > 0) {
      runSimulation();
    }
  }, [staff, simulationParams, runSimulation]);

  return {
    staff,
    children,
    facilitySettings,
    additionMaster,
    currentAdditions,
    simulationParams,
    setSimulationParams,
    simulationResult,
    loading,
    error,
    refresh: fetchData,
    runSimulation,
  };
}

export default useAdditionSimulator;
