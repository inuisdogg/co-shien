/**
 * 加算体制コンプライアンスチェックフック
 * Addition Compliance Check Hook
 *
 * シフト編集中に加算体制要件の充足状況をリアルタイムでチェック
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Staff, StaffPersonnelSettings, PersonnelType, WorkStyle } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// 型定義
// ============================================

// 加算コンプライアンスの状態
export type AdditionComplianceStatus = 'met' | 'unmet' | 'partial';

// 個別加算のコンプライアンス結果
export interface AdditionComplianceResult {
  code: string;
  name: string;
  shortName: string;
  status: AdditionComplianceStatus;
  reason: string;
  requirements: string;
  units?: string;
  tier?: string;
  tierLabel?: string;
}

// 加算カテゴリ
export type AdditionCategory = 'staffing' | 'specialist' | 'treatment' | 'other';

// カテゴリごとのグループ
export interface AdditionCategoryGroup {
  category: AdditionCategory;
  label: string;
  additions: AdditionComplianceResult[];
}

// 日別のシフト情報
export interface DailyShiftInfo {
  date: string;
  staffIds: string[];
}

// フックの返り値型
export interface UseAdditionComplianceCheckReturn {
  // データ
  complianceResults: AdditionComplianceResult[];
  categoryGroups: AdditionCategoryGroup[];
  summary: {
    total: number;
    met: number;
    unmet: number;
    partial: number;
  };
  // 状態
  loading: boolean;
  error: string | null;
  // アクション
  checkCompliance: (dailyShifts: DailyShiftInfo[], staffList: Staff[]) => void;
  checkComplianceForMonth: (
    shifts: Record<string, Record<string, boolean>>,
    staffList: Staff[],
    year: number,
    month: number
  ) => void;
  refreshSettings: () => void;
}

// ============================================
// 加算定義
// ============================================

interface AdditionDefinition {
  code: string;
  name: string;
  shortName: string;
  category: AdditionCategory;
  hasTiers: boolean;
  tiers?: {
    id: string;
    label: string;
    units: string;
    requirements: AdditionRequirements;
  }[];
  requirements?: AdditionRequirements;
  defaultUnits?: string;
}

interface AdditionRequirements {
  // スタッフ数要件
  minStaffCount?: number;
  minFulltimeCount?: number;
  minFulltimeDedicatedCount?: number;
  // 資格要件
  requiredQualifications?: string[];
  anyQualification?: boolean;
  // 経験要件
  minYearsExperience?: number;
  // FTE要件
  minFte?: number;
  // その他条件
  customCheck?: (params: ComplianceCheckParams) => boolean;
}

interface ComplianceCheckParams {
  staffOnShift: Staff[];
  personnelSettings: Map<string, StaffPersonnelSettings>;
  standardWeeklyHours: number;
}

// 加算マスター定義
const ADDITION_DEFINITIONS: AdditionDefinition[] = [
  {
    code: 'staff_allocation',
    name: '児童指導員等加配加算',
    shortName: '加配',
    category: 'staffing',
    hasTiers: true,
    tiers: [
      {
        id: 'tier1_fulltime_exp',
        label: '常勤専従・経験5年以上',
        units: '187単位/日',
        requirements: {
          minFulltimeDedicatedCount: 1,
          minYearsExperience: 5,
          requiredQualifications: ['保育士', '児童指導員', 'PT', 'OT', 'ST', 'PSYCHOLOGIST', 'NURSERY_TEACHER', 'CHILD_INSTRUCTOR'],
          anyQualification: true,
        },
      },
      {
        id: 'tier1_fulltime',
        label: '常勤専従・経験5年未満',
        units: '152単位/日',
        requirements: {
          minFulltimeDedicatedCount: 1,
          requiredQualifications: ['保育士', '児童指導員', 'PT', 'OT', 'ST', 'PSYCHOLOGIST', 'NURSERY_TEACHER', 'CHILD_INSTRUCTOR'],
          anyQualification: true,
        },
      },
      {
        id: 'tier2_convert_exp',
        label: '常勤換算・経験5年以上',
        units: '123単位/日',
        requirements: {
          minFte: 1.0,
          minYearsExperience: 5,
          requiredQualifications: ['保育士', '児童指導員', 'PT', 'OT', 'ST', 'PSYCHOLOGIST', 'NURSERY_TEACHER', 'CHILD_INSTRUCTOR'],
          anyQualification: true,
        },
      },
      {
        id: 'tier2_convert',
        label: '常勤換算・経験5年未満',
        units: '107単位/日',
        requirements: {
          minFte: 1.0,
          requiredQualifications: ['保育士', '児童指導員', 'PT', 'OT', 'ST', 'PSYCHOLOGIST', 'NURSERY_TEACHER', 'CHILD_INSTRUCTOR'],
          anyQualification: true,
        },
      },
      {
        id: 'tier3_other',
        label: 'その他従業者',
        units: '90単位/日',
        requirements: {
          minStaffCount: 1,
        },
      },
    ],
  },
  {
    code: 'specialist_support',
    name: '専門的支援体制加算',
    shortName: '専門',
    category: 'specialist',
    hasTiers: false,
    defaultUnits: '123単位/日',
    requirements: {
      minFte: 1.0,
      requiredQualifications: ['PT', 'OT', 'ST', 'PSYCHOLOGIST', '理学療法士', '作業療法士', '言語聴覚士', '公認心理師', 'VISION_TRAINER'],
      anyQualification: true,
    },
  },
  {
    code: 'welfare_professional',
    name: '福祉専門職員配置等加算',
    shortName: '福専',
    category: 'staffing',
    hasTiers: true,
    tiers: [
      {
        id: 'tier1',
        label: '(I) 35%以上',
        units: '15単位/日',
        requirements: {
          requiredQualifications: ['SOCIAL_WORKER', 'CARE_WORKER', 'PSYCH_WELFARE_WORKER', 'PSYCHOLOGIST'],
          anyQualification: true,
          customCheck: (params) => {
            // 常勤従業者のうち資格者割合35%以上
            const fulltime = params.staffOnShift.filter(s => {
              const setting = params.personnelSettings.get(s.id);
              return setting?.workStyle === 'fulltime_dedicated' || setting?.workStyle === 'fulltime_concurrent';
            });
            if (fulltime.length === 0) return false;
            const qualified = fulltime.filter(s => {
              const quals = s.qualifications?.split(',').map(q => q.trim()) || [];
              return quals.some(q => ['SOCIAL_WORKER', 'CARE_WORKER', 'PSYCH_WELFARE_WORKER', 'PSYCHOLOGIST', '社会福祉士', '介護福祉士', '精神保健福祉士', '公認心理師'].includes(q));
            });
            return qualified.length / fulltime.length >= 0.35;
          },
        },
      },
      {
        id: 'tier2',
        label: '(II) 25%以上',
        units: '10単位/日',
        requirements: {
          requiredQualifications: ['SOCIAL_WORKER', 'CARE_WORKER', 'PSYCH_WELFARE_WORKER', 'PSYCHOLOGIST'],
          anyQualification: true,
          customCheck: (params) => {
            const fulltime = params.staffOnShift.filter(s => {
              const setting = params.personnelSettings.get(s.id);
              return setting?.workStyle === 'fulltime_dedicated' || setting?.workStyle === 'fulltime_concurrent';
            });
            if (fulltime.length === 0) return false;
            const qualified = fulltime.filter(s => {
              const quals = s.qualifications?.split(',').map(q => q.trim()) || [];
              return quals.some(q => ['SOCIAL_WORKER', 'CARE_WORKER', 'PSYCH_WELFARE_WORKER', 'PSYCHOLOGIST', '社会福祉士', '介護福祉士', '精神保健福祉士', '公認心理師'].includes(q));
            });
            return qualified.length / fulltime.length >= 0.25;
          },
        },
      },
      {
        id: 'tier3',
        label: '(III) 常勤率等',
        units: '6単位/日',
        requirements: {
          customCheck: (params) => {
            // 常勤割合75%以上、または勤続3年以上30%以上
            const fulltime = params.staffOnShift.filter(s => {
              const setting = params.personnelSettings.get(s.id);
              return setting?.workStyle === 'fulltime_dedicated' || setting?.workStyle === 'fulltime_concurrent';
            });
            if (params.staffOnShift.length === 0) return false;
            const fulltimeRate = fulltime.length / params.staffOnShift.length;
            // 勤続3年以上は経験年数で代用
            const experienced = params.staffOnShift.filter(s => (s.yearsOfExperience || 0) >= 3);
            const experienceRate = experienced.length / params.staffOnShift.length;
            return fulltimeRate >= 0.75 || experienceRate >= 0.3;
          },
        },
      },
    ],
  },
  {
    code: 'treatment_improvement',
    name: '福祉・介護職員処遇改善加算',
    shortName: '処遇',
    category: 'treatment',
    hasTiers: true,
    tiers: [
      { id: 'tier1', label: '新加算(I)', units: '13.1%', requirements: {} },
      { id: 'tier2', label: '新加算(II)', units: '10.0%', requirements: {} },
      { id: 'tier3', label: '新加算(III)', units: '7.0%', requirements: {} },
      { id: 'tier4', label: '新加算(IV)', units: '4.0%', requirements: {} },
    ],
  },
];

// カテゴリラベル
const CATEGORY_LABELS: Record<AdditionCategory, string> = {
  staffing: '人員配置',
  specialist: '専門職',
  treatment: '処遇改善',
  other: 'その他',
};

// ローカルストレージキー
const getSettingsStorageKey = (facilityId: string) => `facility_addition_settings_${facilityId}`;

// ============================================
// フック実装
// ============================================

export function useAdditionComplianceCheck(): UseAdditionComplianceCheckReturn {
  const { facility } = useAuth();
  const facilityId = facility?.id;

  // 状態
  const [complianceResults, setComplianceResults] = useState<AdditionComplianceResult[]>([]);
  const [enabledAdditions, setEnabledAdditions] = useState<Record<string, { enabled: boolean; selectedTier: string | null; status: string }>>({});
  const [personnelSettings, setPersonnelSettings] = useState<Map<string, StaffPersonnelSettings>>(new Map());
  const [standardWeeklyHours, setStandardWeeklyHours] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 設定読み込み
  const refreshSettings = useCallback(() => {
    if (!facilityId) return;

    try {
      // ローカルストレージから加算設定を読み込み
      const savedSettings = localStorage.getItem(getSettingsStorageKey(facilityId));
      if (savedSettings) {
        setEnabledAdditions(JSON.parse(savedSettings));
      }
    } catch (err) {
      console.error('Error loading addition settings:', err);
    }
  }, [facilityId]);

  // 初期化
  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  // FTE計算
  const calculateFte = useCallback((staff: Staff, setting: StaffPersonnelSettings | undefined): number => {
    if (!setting) return 0;
    const weeklyHours = setting.contractedWeeklyHours || 40;
    return weeklyHours / standardWeeklyHours;
  }, [standardWeeklyHours]);

  // 資格チェック
  const hasQualification = useCallback((staff: Staff, requiredQualifications: string[], anyQualification: boolean): boolean => {
    const staffQuals = staff.qualifications?.split(',').map(q => q.trim()) || [];
    if (anyQualification) {
      return requiredQualifications.some(req => staffQuals.includes(req));
    }
    return requiredQualifications.every(req => staffQuals.includes(req));
  }, []);

  // 要件チェック
  const checkRequirements = useCallback((
    requirements: AdditionRequirements,
    staffOnShift: Staff[],
    personnelSettingsMap: Map<string, StaffPersonnelSettings>
  ): { met: boolean; reason: string } => {
    const params: ComplianceCheckParams = {
      staffOnShift,
      personnelSettings: personnelSettingsMap,
      standardWeeklyHours,
    };

    // カスタムチェックがあれば優先
    if (requirements.customCheck) {
      const result = requirements.customCheck(params);
      if (!result) {
        return { met: false, reason: '要件を満たしていません' };
      }
    }

    // 最低スタッフ数チェック
    if (requirements.minStaffCount && staffOnShift.length < requirements.minStaffCount) {
      return { met: false, reason: `スタッフ${requirements.minStaffCount}名以上が必要（現在: ${staffOnShift.length}名）` };
    }

    // 常勤スタッフ数チェック
    if (requirements.minFulltimeCount) {
      const fulltimeCount = staffOnShift.filter(s => {
        const setting = personnelSettingsMap.get(s.id);
        return setting?.workStyle === 'fulltime_dedicated' || setting?.workStyle === 'fulltime_concurrent';
      }).length;
      if (fulltimeCount < requirements.minFulltimeCount) {
        return { met: false, reason: `常勤${requirements.minFulltimeCount}名以上が必要（現在: ${fulltimeCount}名）` };
      }
    }

    // 常勤専従スタッフ数チェック
    if (requirements.minFulltimeDedicatedCount) {
      const dedicatedCount = staffOnShift.filter(s => {
        const setting = personnelSettingsMap.get(s.id);
        return setting?.workStyle === 'fulltime_dedicated';
      }).length;
      if (dedicatedCount < requirements.minFulltimeDedicatedCount) {
        return { met: false, reason: `常勤専従${requirements.minFulltimeDedicatedCount}名以上が必要（現在: ${dedicatedCount}名）` };
      }
    }

    // 資格要件チェック
    if (requirements.requiredQualifications && requirements.requiredQualifications.length > 0) {
      const qualifiedStaff = staffOnShift.filter(s =>
        hasQualification(s, requirements.requiredQualifications!, requirements.anyQualification || false)
      );
      if (qualifiedStaff.length === 0) {
        const qualNames = requirements.requiredQualifications.join('、');
        return { met: false, reason: `対象資格（${qualNames}）を持つスタッフがいません` };
      }

      // 資格 + 経験年数チェック
      if (requirements.minYearsExperience) {
        const experiencedQualified = qualifiedStaff.filter(s => (s.yearsOfExperience || 0) >= requirements.minYearsExperience!);
        if (experiencedQualified.length === 0) {
          return { met: false, reason: `経験${requirements.minYearsExperience}年以上の有資格者がいません` };
        }
      }
    }

    // FTEチェック
    if (requirements.minFte) {
      let totalFte = 0;
      const targetStaff = requirements.requiredQualifications
        ? staffOnShift.filter(s => hasQualification(s, requirements.requiredQualifications!, requirements.anyQualification || false))
        : staffOnShift;

      for (const staff of targetStaff) {
        const setting = personnelSettingsMap.get(staff.id);
        totalFte += calculateFte(staff, setting);
      }

      if (totalFte < requirements.minFte) {
        return { met: false, reason: `常勤換算${requirements.minFte}以上が必要（現在: ${totalFte.toFixed(2)}）` };
      }
    }

    return { met: true, reason: '要件を満たしています' };
  }, [standardWeeklyHours, hasQualification, calculateFte]);

  // コンプライアンスチェック実行
  const checkCompliance = useCallback((
    dailyShifts: DailyShiftInfo[],
    staffList: Staff[]
  ) => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const results: AdditionComplianceResult[] = [];
      const staffMap = new Map(staffList.map(s => [s.id, s]));

      // 全日程でシフトに入っているスタッフを集計
      const allStaffIds = new Set<string>();
      dailyShifts.forEach(day => {
        day.staffIds.forEach(id => allStaffIds.add(id));
      });
      const staffOnShift = Array.from(allStaffIds)
        .map(id => staffMap.get(id))
        .filter((s): s is Staff => !!s);

      // 各加算の要件をチェック
      for (const addition of ADDITION_DEFINITIONS) {
        const setting = enabledAdditions[addition.code];

        // 有効でない加算はスキップ
        if (!setting?.enabled) continue;

        // 「適用中」ステータスの加算のみチェック
        if (setting.status !== 'active') continue;

        if (addition.hasTiers && addition.tiers) {
          // 区分選択型の加算
          const selectedTier = addition.tiers.find(t => t.id === setting.selectedTier);
          if (selectedTier) {
            const { met, reason } = checkRequirements(selectedTier.requirements, staffOnShift, personnelSettings);
            results.push({
              code: addition.code,
              name: addition.name,
              shortName: addition.shortName,
              status: met ? 'met' : 'unmet',
              reason,
              requirements: selectedTier.requirements.toString(),
              units: selectedTier.units,
              tier: selectedTier.id,
              tierLabel: selectedTier.label,
            });
          }
        } else if (addition.requirements) {
          // 単一型の加算
          const { met, reason } = checkRequirements(addition.requirements, staffOnShift, personnelSettings);
          results.push({
            code: addition.code,
            name: addition.name,
            shortName: addition.shortName,
            status: met ? 'met' : 'unmet',
            reason,
            requirements: '',
            units: addition.defaultUnits,
          });
        }
      }

      setComplianceResults(results);
    } catch (err) {
      console.error('Error checking compliance:', err);
      setError('コンプライアンスチェックに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facilityId, enabledAdditions, personnelSettings, checkRequirements]);

  // 月間シフトからコンプライアンスチェック
  const checkComplianceForMonth = useCallback((
    shifts: Record<string, Record<string, boolean>>,
    staffList: Staff[],
    year: number,
    month: number
  ) => {
    // シフトデータを日別情報に変換
    const dailyShifts: DailyShiftInfo[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const staffIds: string[] = [];

      Object.entries(shifts).forEach(([staffId, staffShifts]) => {
        if (staffShifts[dateStr]) {
          staffIds.push(staffId);
        }
      });

      if (staffIds.length > 0) {
        dailyShifts.push({ date: dateStr, staffIds });
      }
    }

    checkCompliance(dailyShifts, staffList);
  }, [checkCompliance]);

  // カテゴリごとにグループ化
  const categoryGroups = useMemo((): AdditionCategoryGroup[] => {
    const groups: Map<AdditionCategory, AdditionComplianceResult[]> = new Map();

    complianceResults.forEach(result => {
      const definition = ADDITION_DEFINITIONS.find(a => a.code === result.code);
      const category = definition?.category || 'other';

      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(result);
    });

    return Array.from(groups.entries()).map(([category, additions]) => ({
      category,
      label: CATEGORY_LABELS[category],
      additions,
    }));
  }, [complianceResults]);

  // サマリー計算
  const summary = useMemo(() => {
    const total = complianceResults.length;
    const met = complianceResults.filter(r => r.status === 'met').length;
    const unmet = complianceResults.filter(r => r.status === 'unmet').length;
    const partial = complianceResults.filter(r => r.status === 'partial').length;
    return { total, met, unmet, partial };
  }, [complianceResults]);

  return {
    complianceResults,
    categoryGroups,
    summary,
    loading,
    error,
    checkCompliance,
    checkComplianceForMonth,
    refreshSettings,
  };
}

export default useAdditionComplianceCheck;
