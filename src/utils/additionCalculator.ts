/**
 * 加算計算ロジック
 * - 排他制御（同時取得不可の加算グループ）
 * - 月間上限
 * - スタッフベースの加算提案
 * - 要件チェック
 */

// 加算タイプの定義
export type AdditionType = 'facility_preset' | 'monthly' | 'daily';

// 加算バージョンの型定義（法改正による変更を管理）
export interface AdditionVersion {
  id: string;
  addition_id: string;
  version_number: number;
  units: number | null;
  is_percentage: boolean;
  percentage_rate: number | null;
  requirements: string | null;
  requirements_json: Record<string, unknown> | null;
  max_times_per_month: number | null;
  max_times_per_day: number | null;
  effective_from: string;  // 'YYYY-MM-DD'
  effective_to: string | null;  // null = 現在有効
  revision_id: string | null;
  notes: string | null;
}

// 法改正の型定義
export interface LawRevision {
  id: string;
  revision_date: string;
  name: string;
  description: string | null;
  source_url: string | null;
  is_active: boolean;
}

// 加算の型定義
export interface Addition {
  code: string;
  name: string;
  short_name: string;
  category_code: string;
  units: number | null;
  unit_type: string;
  is_percentage: boolean;
  percentage_rate: number | null;
  max_times_per_month: number | null;
  max_times_per_day: number;
  is_exclusive: boolean;
  exclusive_with: string[] | null;
  requirements: string | null;
  requirements_json: Record<string, unknown> | null;
  applicable_services?: string[];
  addition_type?: AdditionType; // 加算タイプ: facility_preset(施設事前届出型), monthly(月次選択型), daily(日次実績型)
}

// 施設加算設定の型定義
export interface FacilityAdditionSetting {
  id: string;
  facility_id: string;
  addition_code: string;
  is_enabled: boolean;
  status?: 'planned' | 'applying' | 'submitted' | 'active' | 'inactive';
  effective_from?: string;
  effective_to?: string;
}

// スタッフの型定義
export interface Staff {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  qualifications?: string[];
  years_of_experience?: number;
  employment_type?: string;
  weekly_hours?: number;
  is_active?: boolean;
}

// 児童の型定義
export interface Child {
  id: string;
  name: string;
  medical_care_score?: number;
  behavior_disorder_score?: number;
  care_needs_category?: string;
  is_protected_child?: boolean;
  income_category?: string;
}

// 加算選択の型定義
export interface AdditionSelection {
  code: string;
  enabled: boolean;
  customDaysPerMonth?: number; // 月間適用日数（上限ありの加算用）
}

// 計算結果の型定義
export interface CalculationResult {
  totalUnitsPerDay: number;
  totalUnitsPerMonth: number;
  breakdown: AdditionBreakdown[];
  warnings: Warning[];
  suggestions: Suggestion[];
}

export interface AdditionBreakdown {
  code: string;
  name: string;
  unitsPerDay: number;
  daysPerMonth: number;
  totalUnits: number;
  isPercentage: boolean;
  percentageRate?: number;
  status: 'active' | 'excluded' | 'limited' | 'invalid';
  statusReason?: string;
}

export interface Warning {
  type: 'requirement_not_met' | 'exclusive_conflict' | 'over_limit';
  additionCode: string;
  additionName: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface Suggestion {
  additionCode: string;
  additionName: string;
  potentialUnits: number;
  reason: string;
  requirements: string;
  priority: 'high' | 'medium' | 'low';
}

// 排他グループの定義
export const EXCLUSIVE_GROUPS: Record<string, string[]> = {
  // 児童指導員等加配加算グループ（最大1つ）
  staff_allocation: [
    'staff_allocation_1_fulltime',  // 187単位
    'staff_allocation_1_convert',   // 123単位
    'staff_allocation_2_fulltime',  // 152単位
    'staff_allocation_2_convert',   // 107単位
    'staff_allocation_3',           // 90単位
  ],
  // 処遇改善加算グループ（最大1つ）
  treatment_improvement: [
    'treatment_improvement_1',  // 14%
    'treatment_improvement_2',  // 10%
    'treatment_improvement_3',  // 8.1%
    'treatment_improvement_4',  // 5.5%
  ],
  // 延長支援加算グループ（最大1つ）
  extension: [
    'extension_1h',      // 61単位
    'extension_2h',      // 92単位
    'extension_over2h',  // 123単位
  ],
  // 強度行動障害児支援加算グループ
  behavior_support: [
    'behavior_support_1',
    'behavior_support_1_initial',
    'behavior_support_2',
    'behavior_support_2_initial',
  ],
  // 個別サポート加算(I)グループ
  individual_support_1: [
    'individual_support_1',
    'individual_support_1_high',
  ],
};

// 月間上限の定義
export const MONTHLY_LIMITS: Record<string, number> = {
  specialist_support: 4,        // 専門的支援実施加算: 月4日
  family_support_1: 2,          // 家族支援加算(I): 月2回
  family_support_2: 2,          // 家族支援加算(II): 月2回
  family_support_3: 4,          // 家族支援加算(III): 月4回
  family_support_4: 4,          // 家族支援加算(IV): 月4回
  agency_cooperation_1: 1,      // 関係機関連携加算(I): 月1回
  agency_cooperation_2: 1,      // 関係機関連携加算(II): 月1回
  intensive_support: 4,         // 集中的支援加算: 月4回
};

// 資格コードの定義
export const QUALIFICATION_CODES = {
  PT: '理学療法士',
  OT: '作業療法士',
  ST: '言語聴覚士',
  PSYCHOLOGIST: '公認心理師',
  NURSERY_TEACHER: '保育士',
  CHILD_INSTRUCTOR: '児童指導員',
  SOCIAL_WORKER: '社会福祉士',
  NURSE: '看護師',
  CARE_WORKER: '介護福祉士',
};

/**
 * 施設加算設定から選択状態を生成
 * facility_preset型の加算は施設設定から自動適用
 */
export function mergeWithFacilitySettings(
  manualSelections: AdditionSelection[],
  additions: Addition[],
  facilitySettings: FacilityAdditionSetting[]
): AdditionSelection[] {
  const result: AdditionSelection[] = [];
  const manualMap = new Map(manualSelections.map(s => [s.code, s]));

  for (const addition of additions) {
    const facilitySetting = facilitySettings.find(fs => fs.addition_code === addition.code);
    const manualSelection = manualMap.get(addition.code);

    if (addition.addition_type === 'facility_preset') {
      // 施設事前届出型: 施設設定から自動適用（activeステータスのみ）
      if (facilitySetting && facilitySetting.is_enabled && facilitySetting.status === 'active') {
        result.push({
          code: addition.code,
          enabled: true,
        });
      } else if (facilitySetting && facilitySetting.is_enabled) {
        // enabled だが active でない場合も含める（申請中など）
        result.push({
          code: addition.code,
          enabled: facilitySetting.status === 'active', // activeの場合のみ有効
        });
      }
    } else {
      // monthly/daily型: 手動選択を反映
      if (manualSelection) {
        result.push(manualSelection);
      }
    }
  }

  return result;
}

/**
 * 加算をタイプ別に分類
 */
export function categorizeAdditionsByType(additions: Addition[]): {
  facilityPreset: Addition[];
  monthly: Addition[];
  daily: Addition[];
} {
  return {
    facilityPreset: additions.filter(a => a.addition_type === 'facility_preset'),
    monthly: additions.filter(a => a.addition_type === 'monthly' || !a.addition_type),
    daily: additions.filter(a => a.addition_type === 'daily'),
  };
}

/**
 * 排他グループから有効な加算のみを選択
 * 同一グループ内で複数選択されている場合、最も単位数が高いものを選択
 */
export function resolveExclusiveGroups(
  selections: AdditionSelection[],
  additions: Addition[]
): { resolved: AdditionSelection[]; conflicts: Warning[] } {
  const conflicts: Warning[] = [];
  const resolved: AdditionSelection[] = [...selections];
  const additionMap = new Map(additions.map(a => [a.code, a]));

  for (const [groupName, groupCodes] of Object.entries(EXCLUSIVE_GROUPS)) {
    // このグループで選択されている加算を取得
    const selectedInGroup = selections.filter(
      s => s.enabled && groupCodes.includes(s.code)
    );

    if (selectedInGroup.length <= 1) continue;

    // 最も単位数が高いものを特定
    let maxUnits = -1;
    let maxCode = '';
    for (const sel of selectedInGroup) {
      const addition = additionMap.get(sel.code);
      if (addition) {
        const units = addition.units || 0;
        if (units > maxUnits) {
          maxUnits = units;
          maxCode = sel.code;
        }
      }
    }

    // 最高単位以外を無効化
    for (const sel of selectedInGroup) {
      if (sel.code !== maxCode) {
        const idx = resolved.findIndex(r => r.code === sel.code);
        if (idx !== -1) {
          resolved[idx] = { ...resolved[idx], enabled: false };
        }
        const addition = additionMap.get(sel.code);
        conflicts.push({
          type: 'exclusive_conflict',
          additionCode: sel.code,
          additionName: addition?.name || sel.code,
          message: `${addition?.name}は${additionMap.get(maxCode)?.name}と同時取得できません`,
          severity: 'warning',
        });
      }
    }
  }

  return { resolved, conflicts };
}

/**
 * 月間上限を適用
 */
export function applyMonthlyLimits(
  selections: AdditionSelection[],
  additions: Addition[],
  businessDaysInMonth: number
): { limited: AdditionSelection[]; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const limited = selections.map(sel => {
    const addition = additions.find(a => a.code === sel.code);
    if (!addition || !sel.enabled) return sel;

    // 月間上限をチェック
    const limit = MONTHLY_LIMITS[sel.code] || addition.max_times_per_month;
    if (limit) {
      const requestedDays = sel.customDaysPerMonth || businessDaysInMonth;
      if (requestedDays > limit) {
        warnings.push({
          type: 'over_limit',
          additionCode: sel.code,
          additionName: addition.name,
          message: `${addition.name}は月${limit}日/回が上限です（${requestedDays}日→${limit}日に制限）`,
          severity: 'info',
        });
        return { ...sel, customDaysPerMonth: limit };
      }
    }

    return sel;
  });

  return { limited, warnings };
}

/**
 * スタッフの常勤換算を計算
 */
export function calculateFTE(staff: Staff[]): number {
  const FULL_TIME_HOURS = 40; // 週40時間を1.0とする
  return staff
    .filter(s => s.is_active !== false)
    .reduce((sum, s) => {
      const hours = s.weekly_hours || (s.employment_type === 'fulltime' ? 40 : 20);
      return sum + hours / FULL_TIME_HOURS;
    }, 0);
}

/**
 * 資格保有スタッフ数をカウント
 */
export function countQualifiedStaff(
  staff: Staff[],
  qualifications: string[]
): number {
  return staff.filter(s => {
    if (!s.qualifications || s.is_active === false) return false;
    return s.qualifications.some(q => qualifications.includes(q));
  }).length;
}

/**
 * 経験年数条件を満たすスタッフ数をカウント
 */
export function countExperiencedStaff(
  staff: Staff[],
  minYears: number
): number {
  return staff.filter(s => {
    if (s.is_active === false) return false;
    return (s.years_of_experience || 0) >= minYears;
  }).length;
}

/**
 * スタッフベースの加算提案を生成
 */
export function generateSuggestions(
  staff: Staff[],
  currentSelections: AdditionSelection[],
  additions: Addition[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const enabledCodes = new Set(
    currentSelections.filter(s => s.enabled).map(s => s.code)
  );

  // 専門職の資格リスト
  const specialistQualifications = ['PT', 'OT', 'ST', 'PSYCHOLOGIST', '理学療法士', '作業療法士', '言語聴覚士', '公認心理師'];
  const hasSpecialist = countQualifiedStaff(staff, specialistQualifications) > 0;

  // 経験5年以上のスタッフ
  const experienced5Years = countExperiencedStaff(staff, 5);

  // 常勤換算
  const fte = calculateFTE(staff);

  // 専門的支援実施加算の提案
  if (hasSpecialist && !enabledCodes.has('specialist_support')) {
    const addition = additions.find(a => a.code === 'specialist_support');
    if (addition) {
      suggestions.push({
        additionCode: 'specialist_support',
        additionName: addition.name,
        potentialUnits: (addition.units || 0) * 4, // 月4日上限
        reason: 'PT/OT/ST/公認心理師の資格保有者がいます',
        requirements: '専門的支援計画に基づき直接支援を実施',
        priority: 'high',
      });
    }
  }

  // 児童指導員等加配加算(I)の提案
  if (experienced5Years > 0 && fte >= 1.0) {
    const staffAllocationGroup = EXCLUSIVE_GROUPS.staff_allocation;
    const hasStaffAllocation = staffAllocationGroup.some(code => enabledCodes.has(code));

    if (!hasStaffAllocation) {
      const addition = additions.find(a => a.code === 'staff_allocation_1_fulltime');
      if (addition) {
        suggestions.push({
          additionCode: 'staff_allocation_1_fulltime',
          additionName: addition.name,
          potentialUnits: (addition.units || 0) * 22, // 月22日想定
          reason: `経験5年以上のスタッフが${experienced5Years}名、常勤換算${fte.toFixed(1)}人`,
          requirements: '常勤専従1.0人以上配置',
          priority: 'high',
        });
      }
    }
  }

  // 送迎加算の提案（ほぼ全事業所で取得可能）
  if (!enabledCodes.has('transport')) {
    const addition = additions.find(a => a.code === 'transport');
    if (addition) {
      suggestions.push({
        additionCode: 'transport',
        additionName: addition.name,
        potentialUnits: (addition.units || 0) * 2 * 22, // 往復×月22日
        reason: '送迎を実施している場合は取得可能',
        requirements: '居宅・保育所等と事業所間の送迎（片道54単位）',
        priority: 'medium',
      });
    }
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * 要件チェックとアラート生成
 */
export function checkRequirements(
  selections: AdditionSelection[],
  additions: Addition[],
  staff: Staff[],
  children: Child[]
): Warning[] {
  const warnings: Warning[] = [];
  const fte = calculateFTE(staff);
  const specialistQualifications = ['PT', 'OT', 'ST', 'PSYCHOLOGIST', '理学療法士', '作業療法士', '言語聴覚士', '公認心理師'];

  for (const sel of selections) {
    if (!sel.enabled) continue;

    const addition = additions.find(a => a.code === sel.code);
    if (!addition) continue;

    // 児童指導員等加配加算の要件チェック
    if (sel.code.startsWith('staff_allocation_1')) {
      // 経験5年以上必要
      const experienced = countExperiencedStaff(staff, 5);
      if (experienced === 0) {
        warnings.push({
          type: 'requirement_not_met',
          additionCode: sel.code,
          additionName: addition.name,
          message: '経験5年以上のスタッフがいません',
          severity: 'error',
        });
      }
      // 常勤換算1.0以上必要
      if (fte < 1.0) {
        warnings.push({
          type: 'requirement_not_met',
          additionCode: sel.code,
          additionName: addition.name,
          message: `常勤換算${fte.toFixed(1)}人（1.0人以上必要）`,
          severity: 'error',
        });
      }
    }

    // 専門的支援実施加算の要件チェック
    if (sel.code === 'specialist_support') {
      const hasSpecialist = countQualifiedStaff(staff, specialistQualifications) > 0;
      if (!hasSpecialist) {
        warnings.push({
          type: 'requirement_not_met',
          additionCode: sel.code,
          additionName: addition.name,
          message: 'PT/OT/ST/公認心理師の資格保有者がいません',
          severity: 'error',
        });
      }
    }

    // 強度行動障害児支援加算の要件チェック
    if (sel.code.startsWith('behavior_support')) {
      const hasEligibleChild = children.some(c => (c.behavior_disorder_score || 0) >= 20);
      if (!hasEligibleChild) {
        warnings.push({
          type: 'requirement_not_met',
          additionCode: sel.code,
          additionName: addition.name,
          message: '強度行動障害スコア20点以上の児童がいません',
          severity: 'warning',
        });
      }
    }

    // 個別サポート加算(II)の要件チェック
    if (sel.code === 'individual_support_2') {
      const hasProtectedChild = children.some(c => c.is_protected_child);
      if (!hasProtectedChild) {
        warnings.push({
          type: 'requirement_not_met',
          additionCode: sel.code,
          additionName: addition.name,
          message: '要保護・要支援児童がいません',
          severity: 'warning',
        });
      }
    }
  }

  return warnings;
}

/**
 * 売上試算のメイン計算関数
 */
export function calculateRevenue(
  selections: AdditionSelection[],
  additions: Addition[],
  staff: Staff[],
  children: Child[],
  baseRewardUnits: number,
  businessDaysInMonth: number,
  unitPrice: number
): CalculationResult {
  // 1. 排他グループの解決
  const { resolved, conflicts } = resolveExclusiveGroups(selections, additions);

  // 2. 月間上限の適用
  const { limited, warnings: limitWarnings } = applyMonthlyLimits(
    resolved,
    additions,
    businessDaysInMonth
  );

  // 3. 要件チェック
  const requirementWarnings = checkRequirements(limited, additions, staff, children);

  // 4. 加算提案の生成
  const suggestions = generateSuggestions(staff, limited, additions);

  // 5. 単位数の計算
  const breakdown: AdditionBreakdown[] = [];
  let totalUnitsPerDay = baseRewardUnits;
  let totalUnitsPerMonth = baseRewardUnits * businessDaysInMonth;

  // 処遇改善加算用の基礎単位（後で計算）
  let baseForTreatment = totalUnitsPerMonth;

  for (const sel of limited) {
    const addition = additions.find(a => a.code === sel.code);
    if (!addition) continue;

    const isEnabled = sel.enabled;
    const hasError = requirementWarnings.some(
      w => w.additionCode === sel.code && w.severity === 'error'
    );
    const wasExcluded = conflicts.some(c => c.additionCode === sel.code);

    let status: AdditionBreakdown['status'] = 'active';
    let statusReason: string | undefined;

    if (!isEnabled) {
      status = 'invalid';
      statusReason = '無効';
    } else if (wasExcluded) {
      status = 'excluded';
      statusReason = '排他制御により除外';
    } else if (hasError) {
      status = 'invalid';
      statusReason = '要件未充足';
    } else if (sel.customDaysPerMonth && sel.customDaysPerMonth < businessDaysInMonth) {
      status = 'limited';
      statusReason = `月${sel.customDaysPerMonth}日に制限`;
    }

    // パーセント加算は後で計算
    if (addition.is_percentage) {
      breakdown.push({
        code: addition.code,
        name: addition.name,
        unitsPerDay: 0,
        daysPerMonth: businessDaysInMonth,
        totalUnits: 0, // 後で計算
        isPercentage: true,
        percentageRate: addition.percentage_rate || 0,
        status: status === 'active' ? 'active' : status,
        statusReason,
      });
      continue;
    }

    const unitsPerDay = addition.units || 0;
    const daysPerMonth = sel.customDaysPerMonth || businessDaysInMonth;
    const totalUnits = status === 'active' ? unitsPerDay * daysPerMonth : 0;

    if (status === 'active') {
      totalUnitsPerDay += unitsPerDay;
      totalUnitsPerMonth += totalUnits;
      baseForTreatment += totalUnits;
    }

    breakdown.push({
      code: addition.code,
      name: addition.name,
      unitsPerDay,
      daysPerMonth,
      totalUnits,
      isPercentage: false,
      status,
      statusReason,
    });
  }

  // 処遇改善加算の計算
  const treatmentAddition = breakdown.find(
    b => b.code.startsWith('treatment_improvement') && b.status === 'active'
  );
  if (treatmentAddition && treatmentAddition.percentageRate) {
    treatmentAddition.totalUnits = Math.floor(
      baseForTreatment * (treatmentAddition.percentageRate / 100)
    );
    totalUnitsPerMonth += treatmentAddition.totalUnits;
  }

  return {
    totalUnitsPerDay,
    totalUnitsPerMonth,
    breakdown,
    warnings: [...conflicts, ...limitWarnings, ...requirementWarnings],
    suggestions,
  };
}

/**
 * 特定日時点で有効な加算バージョンを取得
 * @param versions 全バージョンリスト
 * @param additionId 加算ID
 * @param targetDate 対象日（YYYY-MM-DD形式、省略時は現在日）
 * @returns 有効なバージョン、なければundefined
 */
export function getEffectiveVersion(
  versions: AdditionVersion[],
  additionId: string,
  targetDate?: string
): AdditionVersion | undefined {
  const target = targetDate ? new Date(targetDate) : new Date();
  const targetStr = target.toISOString().split('T')[0];

  // この加算のバージョンを抽出
  const additionVersions = versions.filter(v => v.addition_id === additionId);

  // 対象日時点で有効なバージョンを検索
  // effective_from <= targetDate AND (effective_to IS NULL OR effective_to >= targetDate)
  const effectiveVersion = additionVersions.find(v => {
    if (v.effective_from > targetStr) return false;
    if (v.effective_to && v.effective_to < targetStr) return false;
    return true;
  });

  return effectiveVersion;
}

/**
 * 加算リストにバージョン情報をマージ
 * 特定日時点の単位数・条件を適用
 * @param additions 加算マスタリスト
 * @param versions バージョンリスト
 * @param targetDate 対象日（YYYY-MM-DD形式）
 * @returns バージョン情報がマージされた加算リスト
 */
export function mergeAdditionsWithVersions(
  additions: Addition[],
  versions: AdditionVersion[],
  targetDate?: string
): Addition[] {
  return additions.map(addition => {
    // IDでバージョンを検索（additions.idはコードの場合があるので注意）
    const effectiveVersion = versions.find(v => {
      if (v.addition_id !== addition.code && v.addition_id !== (addition as any).id) {
        return false;
      }
      const target = targetDate ? new Date(targetDate) : new Date();
      const targetStr = target.toISOString().split('T')[0];
      if (v.effective_from > targetStr) return false;
      if (v.effective_to && v.effective_to < targetStr) return false;
      return true;
    });

    if (!effectiveVersion) {
      return addition;
    }

    // バージョンの値で上書き
    return {
      ...addition,
      units: effectiveVersion.units,
      is_percentage: effectiveVersion.is_percentage,
      percentage_rate: effectiveVersion.percentage_rate,
      requirements: effectiveVersion.requirements,
      requirements_json: effectiveVersion.requirements_json,
      max_times_per_month: effectiveVersion.max_times_per_month,
      max_times_per_day: effectiveVersion.max_times_per_day ?? addition.max_times_per_day,
    };
  });
}

/**
 * 月初の日付を取得（計算対象月の判定用）
 * @param year 年
 * @param month 月（1-12）
 * @returns YYYY-MM-01形式の日付文字列
 */
export function getMonthStartDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * バージョン対応の売上計算
 * 指定月時点の単位数で計算を行う
 */
export function calculateRevenueWithVersions(
  selections: AdditionSelection[],
  additions: Addition[],
  versions: AdditionVersion[],
  staff: Staff[],
  children: Child[],
  baseRewardUnits: number,
  businessDaysInMonth: number,
  unitPrice: number,
  targetYear: number,
  targetMonth: number
): CalculationResult {
  // 対象月時点のバージョンで加算データをマージ
  const targetDate = getMonthStartDate(targetYear, targetMonth);
  const versionedAdditions = mergeAdditionsWithVersions(additions, versions, targetDate);

  // 通常の計算を実行
  return calculateRevenue(
    selections,
    versionedAdditions,
    staff,
    children,
    baseRewardUnits,
    businessDaysInMonth,
    unitPrice
  );
}
