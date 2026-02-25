/**
 * 加算判定ロジック
 * 児発・放デイの体制加算の自動判定を行う
 */

import { StaffPersonnelSettings, WorkStyle, PersonnelType, QualificationCode, QUALIFICATION_CODES } from '@/types';

// 加算判定結果
export type AdditionJudgmentResult = {
  code: string;
  name: string;
  shortName: string;
  category: 'system' | 'implementation';
  units: number;
  percentRate?: number;
  isEligible: boolean;
  isCurrent: boolean; // 現在取得中かどうか
  requirements: RequirementStatus[];
  reason: string;
  priority: number; // 同一排他グループ内の優先度
  exclusiveGroup?: string;
};

// 要件の充足状況
export type RequirementStatus = {
  name: string;
  met: boolean;
  current: number | string;
  required: number | string;
  detail?: string;
};

// スタッフデータ（判定用）
export type StaffForJudgment = {
  id: string;
  name: string;
  personnelType: PersonnelType;
  workStyle: WorkStyle;
  isManager: boolean;
  isServiceManager: boolean;
  contractedWeeklyHours: number;
  qualifications: string[];
  yearsOfExperience: number;
  fte: number; // 常勤換算値
};

// 施設データ（判定用）
export type FacilityForJudgment = {
  standardWeeklyHours: number; // 週所定労働時間（常勤の基準）
  capacity: number; // 定員
  regionGrade: number; // 地域区分（1〜8）
};

// 地域区分ごとの単価係数
export const REGION_UNIT_RATES: Record<number, number> = {
  1: 11.12,  // 1級地
  2: 10.88,  // 2級地
  3: 10.70,  // 3級地
  4: 10.52,  // 4級地
  5: 10.28,  // 5級地
  6: 10.10,  // 6級地
  7: 10.00,  // 7級地
  8: 10.00,  // その他
};

/**
 * 常勤換算値（FTE）を計算
 */
export function calculateFTE(
  workStyle: WorkStyle,
  contractedWeeklyHours: number,
  standardWeeklyHours: number = 40
): number {
  if (workStyle === 'fulltime_dedicated') {
    return 1.0;
  }
  if (workStyle === 'fulltime_concurrent') {
    return 0.75; // 兼務の場合は75%として計算
  }
  // 非常勤の場合
  return Math.min(contractedWeeklyHours / standardWeeklyHours, 1.0);
}

/**
 * 資格コードを持っているかチェック
 */
export function hasQualification(
  staffQualifications: string[],
  targetCodes: QualificationCode[]
): boolean {
  return targetCodes.some(code =>
    staffQualifications.includes(code) ||
    staffQualifications.includes(QUALIFICATION_CODES[code])
  );
}

/**
 * 児童指導員等の資格を持っているかチェック
 */
export function hasChildInstructorQualification(qualifications: string[]): boolean {
  const validCodes: QualificationCode[] = [
    'NURSERY_TEACHER',
    'CHILD_INSTRUCTOR',
    'PT',
    'OT',
    'ST',
    'PSYCHOLOGIST',
    'SOCIAL_WORKER',
    'CARE_WORKER',
    'PSYCH_WELFARE_WORKER',
  ];
  return hasQualification(qualifications, validCodes);
}

/**
 * 専門職資格を持っているかチェック（PT/OT/ST/心理士）
 */
export function hasSpecialistQualification(qualifications: string[]): boolean {
  const specialistCodes: QualificationCode[] = ['PT', 'OT', 'ST', 'PSYCHOLOGIST'];
  return hasQualification(qualifications, specialistCodes);
}

/**
 * 福祉専門職資格を持っているかチェック（社会福祉士等）
 */
export function hasWelfareProfessionalQualification(qualifications: string[]): boolean {
  const welfareCodes: QualificationCode[] = [
    'SOCIAL_WORKER',
    'CARE_WORKER',
    'PSYCH_WELFARE_WORKER',
    'PSYCHOLOGIST',
  ];
  return hasQualification(qualifications, welfareCodes);
}

/**
 * 児童指導員等加配加算の判定
 */
export function judgeStaffAllocationAddition(
  staff: StaffForJudgment[],
  currentAdditions: string[]
): AdditionJudgmentResult[] {
  const results: AdditionJudgmentResult[] = [];

  // 加算人員のみを対象
  const additionStaff = staff.filter(s => s.personnelType === 'addition');

  // FTE合計を計算
  const totalFTE = additionStaff.reduce((sum, s) => sum + s.fte, 0);

  // 資格者かつ経験5年以上のスタッフ
  const qualified5YearsStaff = additionStaff.filter(s =>
    hasChildInstructorQualification(s.qualifications) && s.yearsOfExperience >= 5
  );
  const qualified5YearsFTE = qualified5YearsStaff.reduce((sum, s) => sum + s.fte, 0);

  // 資格者（経験5年未満含む）のスタッフ
  const qualifiedStaff = additionStaff.filter(s =>
    hasChildInstructorQualification(s.qualifications)
  );
  const qualifiedFTE = qualifiedStaff.reduce((sum, s) => sum + s.fte, 0);

  // 常勤専従を持っているか
  const hasFulltimeDedicated = additionStaff.some(s =>
    s.workStyle === 'fulltime_dedicated' && hasChildInstructorQualification(s.qualifications)
  );
  const hasFulltimeDedicated5Years = additionStaff.some(s =>
    s.workStyle === 'fulltime_dedicated' &&
    hasChildInstructorQualification(s.qualifications) &&
    s.yearsOfExperience >= 5
  );

  // (I) 常勤専従・経験5年以上
  results.push({
    code: 'staff_allocation_1_fulltime',
    name: '児童指導員等加配加算(I) 常勤専従・経験5年以上',
    shortName: '加配(I)常専5年',
    category: 'system',
    units: 187,
    isEligible: hasFulltimeDedicated5Years,
    isCurrent: currentAdditions.includes('staff_allocation_1_fulltime'),
    requirements: [
      {
        name: '常勤専従（資格者・5年以上）',
        met: hasFulltimeDedicated5Years,
        current: hasFulltimeDedicated5Years ? 'あり' : 'なし',
        required: '1名以上',
      },
    ],
    reason: hasFulltimeDedicated5Years
      ? '要件充足：資格者かつ経験5年以上の常勤専従を配置'
      : '要件未充足：資格者かつ経験5年以上の常勤専従が必要',
    priority: 1,
    exclusiveGroup: 'staff_allocation',
  });

  // (I) 常勤換算・経験5年以上
  results.push({
    code: 'staff_allocation_1_convert',
    name: '児童指導員等加配加算(I) 常勤換算・経験5年以上',
    shortName: '加配(I)換算5年',
    category: 'system',
    units: 123,
    isEligible: qualified5YearsFTE >= 1.0,
    isCurrent: currentAdditions.includes('staff_allocation_1_convert'),
    requirements: [
      {
        name: '常勤換算（資格者・5年以上）',
        met: qualified5YearsFTE >= 1.0,
        current: qualified5YearsFTE.toFixed(2),
        required: '1.0以上',
      },
    ],
    reason: qualified5YearsFTE >= 1.0
      ? `要件充足：資格者・経験5年以上のFTE ${qualified5YearsFTE.toFixed(2)}`
      : `要件未充足：あと${(1.0 - qualified5YearsFTE).toFixed(2)} FTE必要`,
    priority: 2,
    exclusiveGroup: 'staff_allocation',
  });

  // (I) 常勤専従・経験5年未満
  results.push({
    code: 'staff_allocation_2_fulltime',
    name: '児童指導員等加配加算(I) 常勤専従・経験5年未満',
    shortName: '加配(I)常専',
    category: 'system',
    units: 152,
    isEligible: hasFulltimeDedicated && !hasFulltimeDedicated5Years,
    isCurrent: currentAdditions.includes('staff_allocation_2_fulltime'),
    requirements: [
      {
        name: '常勤専従（資格者）',
        met: hasFulltimeDedicated,
        current: hasFulltimeDedicated ? 'あり' : 'なし',
        required: '1名以上',
      },
    ],
    reason: hasFulltimeDedicated
      ? '要件充足：資格者の常勤専従を配置'
      : '要件未充足：資格者の常勤専従が必要',
    priority: 3,
    exclusiveGroup: 'staff_allocation',
  });

  // (I) 常勤換算・経験5年未満
  results.push({
    code: 'staff_allocation_2_convert',
    name: '児童指導員等加配加算(I) 常勤換算・経験5年未満',
    shortName: '加配(I)換算',
    category: 'system',
    units: 107,
    isEligible: qualifiedFTE >= 1.0 && qualified5YearsFTE < 1.0,
    isCurrent: currentAdditions.includes('staff_allocation_2_convert'),
    requirements: [
      {
        name: '常勤換算（資格者）',
        met: qualifiedFTE >= 1.0,
        current: qualifiedFTE.toFixed(2),
        required: '1.0以上',
      },
    ],
    reason: qualifiedFTE >= 1.0
      ? `要件充足：資格者のFTE ${qualifiedFTE.toFixed(2)}`
      : `要件未充足：あと${(1.0 - qualifiedFTE).toFixed(2)} FTE必要`,
    priority: 4,
    exclusiveGroup: 'staff_allocation',
  });

  // (II) その他従業者
  results.push({
    code: 'staff_allocation_3',
    name: '児童指導員等加配加算(II) その他従業者',
    shortName: '加配(II)',
    category: 'system',
    units: 90,
    isEligible: totalFTE >= 1.0 && qualifiedFTE < 1.0,
    isCurrent: currentAdditions.includes('staff_allocation_3'),
    requirements: [
      {
        name: '常勤換算（全スタッフ）',
        met: totalFTE >= 1.0,
        current: totalFTE.toFixed(2),
        required: '1.0以上',
      },
    ],
    reason: totalFTE >= 1.0
      ? `要件充足：加算人員のFTE ${totalFTE.toFixed(2)}`
      : `要件未充足：あと${(1.0 - totalFTE).toFixed(2)} FTE必要`,
    priority: 5,
    exclusiveGroup: 'staff_allocation',
  });

  return results;
}

/**
 * 専門的支援体制加算の判定
 */
export function judgeSpecialistStructureAddition(
  staff: StaffForJudgment[],
  currentAdditions: string[]
): AdditionJudgmentResult {
  // 専門職（PT/OT/ST/心理士）またはビジョントレーナー、
  // または5年以上経験の保育士・児童指導員
  const specialistStaff = staff.filter(s => {
    const hasSpecialist = hasSpecialistQualification(s.qualifications) ||
      hasQualification(s.qualifications, ['VISION_TRAINER']);
    const has5YearsExperience = s.yearsOfExperience >= 5 &&
      hasQualification(s.qualifications, ['NURSERY_TEACHER', 'CHILD_INSTRUCTOR']);
    return hasSpecialist || has5YearsExperience;
  });

  const specialistFTE = specialistStaff.reduce((sum, s) => sum + s.fte, 0);

  return {
    code: 'specialist_structure',
    name: '専門的支援体制加算',
    shortName: '専門体制',
    category: 'system',
    units: 123,
    isEligible: specialistFTE >= 1.0,
    isCurrent: currentAdditions.includes('specialist_structure'),
    requirements: [
      {
        name: '専門職の常勤換算',
        met: specialistFTE >= 1.0,
        current: specialistFTE.toFixed(2),
        required: '1.0以上',
        detail: 'PT/OT/ST/心理士、または5年以上経験の保育士・児童指導員',
      },
    ],
    reason: specialistFTE >= 1.0
      ? `要件充足：専門職のFTE ${specialistFTE.toFixed(2)}`
      : `要件未充足：あと${(1.0 - specialistFTE).toFixed(2)} FTE必要`,
    priority: 1,
    exclusiveGroup: undefined,
  };
}

/**
 * 福祉専門職員配置等加算の判定
 */
export function judgeWelfareProfessionalAddition(
  staff: StaffForJudgment[],
  currentAdditions: string[]
): AdditionJudgmentResult[] {
  const results: AdditionJudgmentResult[] = [];

  // 常勤の児童指導員を抽出
  const fulltimeInstructors = staff.filter(s =>
    (s.workStyle === 'fulltime_dedicated' || s.workStyle === 'fulltime_concurrent') &&
    hasChildInstructorQualification(s.qualifications)
  );

  const totalFulltime = fulltimeInstructors.length;

  // 福祉専門職資格保有者
  const welfareStaff = fulltimeInstructors.filter(s =>
    hasWelfareProfessionalQualification(s.qualifications)
  );
  const welfareCount = welfareStaff.length;
  const welfareRate = totalFulltime > 0 ? (welfareCount / totalFulltime) * 100 : 0;

  // 常勤率（常勤 / 全スタッフ）
  const allStaffCount = staff.length;
  const fulltimeCount = staff.filter(s =>
    s.workStyle === 'fulltime_dedicated' || s.workStyle === 'fulltime_concurrent'
  ).length;
  const fulltimeRate = allStaffCount > 0 ? (fulltimeCount / allStaffCount) * 100 : 0;

  // 3年以上勤続の常勤者（児童指導員・保育士）
  const threeYearsStaff = fulltimeInstructors.filter(s => s.yearsOfExperience >= 3);
  const threeYearsRate = fulltimeInstructors.length > 0
    ? (threeYearsStaff.length / fulltimeInstructors.length) * 100
    : 0;

  // (I) 福祉専門職35%以上
  results.push({
    code: 'welfare_professional_1',
    name: '福祉専門職員配置等加算(I)',
    shortName: '福祉専門(I)',
    category: 'system',
    units: 15,
    isEligible: welfareRate >= 35,
    isCurrent: currentAdditions.includes('welfare_professional_1'),
    requirements: [
      {
        name: '福祉専門職割合',
        met: welfareRate >= 35,
        current: `${welfareRate.toFixed(1)}%`,
        required: '35%以上',
        detail: '常勤の児童指導員のうち、社会福祉士・介護福祉士・精神保健福祉士・公認心理師の割合',
      },
    ],
    reason: welfareRate >= 35
      ? `要件充足：福祉専門職割合 ${welfareRate.toFixed(1)}%`
      : `要件未充足：あと${(35 - welfareRate).toFixed(1)}%必要`,
    priority: 1,
    exclusiveGroup: 'welfare_professional',
  });

  // (II) 福祉専門職25%以上
  results.push({
    code: 'welfare_professional_2',
    name: '福祉専門職員配置等加算(II)',
    shortName: '福祉専門(II)',
    category: 'system',
    units: 10,
    isEligible: welfareRate >= 25 && welfareRate < 35,
    isCurrent: currentAdditions.includes('welfare_professional_2'),
    requirements: [
      {
        name: '福祉専門職割合',
        met: welfareRate >= 25,
        current: `${welfareRate.toFixed(1)}%`,
        required: '25%以上',
      },
    ],
    reason: welfareRate >= 25
      ? `要件充足：福祉専門職割合 ${welfareRate.toFixed(1)}%`
      : `要件未充足：あと${(25 - welfareRate).toFixed(1)}%必要`,
    priority: 2,
    exclusiveGroup: 'welfare_professional',
  });

  // (III) 常勤率75%以上または3年以上勤続者30%以上
  const meetsCondition1 = fulltimeRate >= 75;
  const meetsCondition2 = threeYearsRate >= 30;
  results.push({
    code: 'welfare_professional_3',
    name: '福祉専門職員配置等加算(III)',
    shortName: '福祉専門(III)',
    category: 'system',
    units: 6,
    isEligible: (meetsCondition1 || meetsCondition2) && welfareRate < 25,
    isCurrent: currentAdditions.includes('welfare_professional_3'),
    requirements: [
      {
        name: '常勤率',
        met: meetsCondition1,
        current: `${fulltimeRate.toFixed(1)}%`,
        required: '75%以上',
      },
      {
        name: '3年以上勤続者割合',
        met: meetsCondition2,
        current: `${threeYearsRate.toFixed(1)}%`,
        required: '30%以上',
      },
    ],
    reason: meetsCondition1 || meetsCondition2
      ? `要件充足：${meetsCondition1 ? `常勤率${fulltimeRate.toFixed(1)}%` : `3年以上勤続者${threeYearsRate.toFixed(1)}%`}`
      : '要件未充足：常勤率75%以上または3年以上勤続者30%以上が必要',
    priority: 3,
    exclusiveGroup: 'welfare_professional',
  });

  return results;
}

/**
 * 全ての体制加算を判定
 */
export function judgeAllSystemAdditions(
  staff: StaffForJudgment[],
  currentAdditions: string[] = []
): AdditionJudgmentResult[] {
  const results: AdditionJudgmentResult[] = [];

  // 児童指導員等加配加算
  results.push(...judgeStaffAllocationAddition(staff, currentAdditions));

  // 専門的支援体制加算
  results.push(judgeSpecialistStructureAddition(staff, currentAdditions));

  // 福祉専門職員配置等加算
  results.push(...judgeWelfareProfessionalAddition(staff, currentAdditions));

  return results;
}

/**
 * 排他グループ内で最も優先度の高い取得可能な加算を選択
 */
export function selectBestAdditionInGroup(
  results: AdditionJudgmentResult[]
): AdditionJudgmentResult[] {
  const groups = new Map<string, AdditionJudgmentResult[]>();
  const noGroup: AdditionJudgmentResult[] = [];

  // グループ分け
  results.forEach(r => {
    if (r.exclusiveGroup) {
      const group = groups.get(r.exclusiveGroup) || [];
      group.push(r);
      groups.set(r.exclusiveGroup, group);
    } else {
      noGroup.push(r);
    }
  });

  // 各グループで最適な加算を選択
  const selected: AdditionJudgmentResult[] = [...noGroup];
  groups.forEach(group => {
    // 取得可能なものを優先度順にソート
    const eligible = group.filter(r => r.isEligible).sort((a, b) => a.priority - b.priority);
    if (eligible.length > 0) {
      // 最も優先度が高いものを選択（単位数が高いものを優先）
      const best = eligible.reduce((prev, curr) =>
        curr.units > prev.units ? curr : prev
      );
      selected.push(best);
    } else {
      // 取得可能なものがない場合、最も近いものを候補として追加
      const closest = group.sort((a, b) => a.priority - b.priority)[0];
      selected.push(closest);
    }
  });

  return selected;
}

/**
 * 月間売上シミュレーション
 */
export function simulateMonthlyRevenue(params: {
  baseUnits: number; // 基本報酬単位
  systemAdditionUnits: number; // 体制加算単位合計
  percentAdditions: number; // パーセント加算合計（%）
  childCount: number; // 児童数
  averageUsageDays: number; // 平均利用日数
  regionGrade: number; // 地域区分
  implementationAdditionUnits?: number; // 実施加算単位（日次の合計）
}): {
  totalRevenue: number;
  revenueBreakdown: {
    baseRevenue: number;
    systemAdditionRevenue: number;
    percentAdditionRevenue: number;
    implementationRevenue: number;
  };
  perChildRevenue: number;
} {
  const unitRate = REGION_UNIT_RATES[params.regionGrade] || 10.0;

  // 延べ利用児童数
  const totalUsageDays = params.childCount * params.averageUsageDays;

  // 基本報酬
  const baseRevenue = params.baseUnits * totalUsageDays * unitRate;

  // 体制加算
  const systemAdditionRevenue = params.systemAdditionUnits * totalUsageDays * unitRate;

  // パーセント加算
  const percentBase = baseRevenue + systemAdditionRevenue;
  const percentAdditionRevenue = percentBase * (params.percentAdditions / 100);

  // 実施加算
  const implementationRevenue = (params.implementationAdditionUnits || 0) * unitRate;

  const totalRevenue = baseRevenue + systemAdditionRevenue + percentAdditionRevenue + implementationRevenue;

  return {
    totalRevenue: Math.round(totalRevenue),
    revenueBreakdown: {
      baseRevenue: Math.round(baseRevenue),
      systemAdditionRevenue: Math.round(systemAdditionRevenue),
      percentAdditionRevenue: Math.round(percentAdditionRevenue),
      implementationRevenue: Math.round(implementationRevenue),
    },
    perChildRevenue: params.childCount > 0 ? Math.round(totalRevenue / params.childCount) : 0,
  };
}

/**
 * 最適化提案を生成
 */
export function generateOptimizationSuggestions(
  staff: StaffForJudgment[],
  currentResults: AdditionJudgmentResult[],
  regionGrade: number = 6
): Array<{
  type: 'hire' | 'upgrade' | 'training';
  title: string;
  description: string;
  estimatedImpact: number; // 月間追加収入（円）
  requirements: string[];
  priority: 'high' | 'medium' | 'low';
}> {
  const suggestions: Array<{
    type: 'hire' | 'upgrade' | 'training';
    title: string;
    description: string;
    estimatedImpact: number;
    requirements: string[];
    priority: 'high' | 'medium' | 'low';
  }> = [];

  const unitRate = REGION_UNIT_RATES[regionGrade] || 10.0;
  const avgUsageDays = 20; // 想定月間利用日数
  const avgChildCount = 10; // 想定児童数

  // 児童指導員等加配加算の改善提案
  const staffAllocationResults = currentResults.filter(r => r.exclusiveGroup === 'staff_allocation');
  const currentBest = staffAllocationResults.find(r => r.isCurrent);
  const eligibleBetter = staffAllocationResults
    .filter(r => r.isEligible && (!currentBest || r.units > currentBest.units));

  if (eligibleBetter.length > 0) {
    const best = eligibleBetter[0];
    const impact = currentBest
      ? (best.units - currentBest.units) * avgUsageDays * avgChildCount * unitRate
      : best.units * avgUsageDays * avgChildCount * unitRate;

    suggestions.push({
      type: 'upgrade',
      title: `${best.shortName}に変更`,
      description: `現在の配置で${best.name}の要件を満たしています`,
      estimatedImpact: Math.round(impact),
      requirements: best.requirements.map(r => `${r.name}: ${r.current}/${r.required}`),
      priority: 'high',
    });
  }

  // 加算人員の追加提案
  const additionStaff = staff.filter(s => s.personnelType === 'addition');
  const additionFTE = additionStaff.reduce((sum, s) => sum + s.fte, 0);

  if (additionFTE < 1.0) {
    const neededFTE = 1.0 - additionFTE;
    suggestions.push({
      type: 'hire',
      title: '加算人員の追加',
      description: `常勤換算${neededFTE.toFixed(2)}分の加算人員を追加すると児童指導員等加配加算の要件を満たせます`,
      estimatedImpact: Math.round(90 * avgUsageDays * avgChildCount * unitRate),
      requirements: [`加算人員として常勤換算${neededFTE.toFixed(2)}以上の配置`],
      priority: 'medium',
    });
  }

  // 専門職の追加提案
  const specialistResult = currentResults.find(r => r.code === 'specialist_structure');
  if (specialistResult && !specialistResult.isEligible) {
    suggestions.push({
      type: 'hire',
      title: '専門職の配置',
      description: 'PT/OT/ST/心理士などの専門職を配置すると専門的支援体制加算を取得できます',
      estimatedImpact: Math.round(123 * avgUsageDays * avgChildCount * unitRate),
      requirements: ['専門職（PT/OT/ST/心理士等）の常勤換算1.0以上配置'],
      priority: 'medium',
    });
  }

  // 資格取得の提案
  const nonQualifiedStaff = staff.filter(s =>
    s.personnelType === 'addition' && !hasChildInstructorQualification(s.qualifications)
  );
  if (nonQualifiedStaff.length > 0) {
    suggestions.push({
      type: 'training',
      title: '資格取得支援',
      description: `${nonQualifiedStaff.length}名のスタッフが児童指導員等の資格を取得すると加算単価が向上します`,
      estimatedImpact: Math.round(17 * avgUsageDays * avgChildCount * unitRate), // 90→107単位の差分
      requirements: ['保育士または児童指導員の資格取得'],
      priority: 'low',
    });
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
