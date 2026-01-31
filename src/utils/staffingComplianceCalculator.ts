/**
 * 人員配置コンプライアンス計算エンジン
 * Staffing Compliance Calculation Engine
 *
 * 障害児通所支援事業の人員配置基準と加算要件を自動判定
 */

import {
  StaffPersonnelSettings,
  DailyStaffingCompliance,
  ComplianceStatus,
  ComplianceWarning,
  ComplianceWarningType,
  StaffComplianceBreakdown,
  AdditionStaffRequirement,
  WorkStyle,
  PersonnelType,
  Staff,
  ShiftWithPattern,
  FacilityStaffingSettings,
} from '@/types';

// ============================================
// 基本計算関数
// ============================================

/**
 * シフトの実働時間を計算（分単位）
 */
export function calculateWorkMinutes(
  startTime?: string,
  endTime?: string,
  breakMinutes: number = 0
): number {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // 日跨ぎ対応
  let totalMinutes = endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : (24 * 60 - startMinutes) + endMinutes;

  return Math.max(0, totalMinutes - breakMinutes);
}

/**
 * シフトの実働時間を計算（時間単位）
 */
export function calculateWorkHours(
  startTime?: string,
  endTime?: string,
  breakMinutes: number = 0
): number {
  const minutes = calculateWorkMinutes(startTime, endTime, breakMinutes);
  return Math.round(minutes / 60 * 100) / 100; // 小数点2桁
}

/**
 * 常勤換算（FTE: Full-Time Equivalent）を計算
 *
 * @param weeklyHours - スタッフの週労働時間
 * @param standardWeeklyHours - 施設の週所定労働時間（常勤の基準）
 * @returns FTE値（0.0〜1.0以上）
 */
export function calculateFTE(
  weeklyHours: number,
  standardWeeklyHours: number
): number {
  if (standardWeeklyHours <= 0) return 0;
  const fte = weeklyHours / standardWeeklyHours;
  return Math.round(fte * 100) / 100; // 小数点2桁
}

/**
 * 日次のシフト時間から週換算で常勤換算を計算
 * （1日のシフトを5日分として週時間を推定）
 *
 * @param dailyWorkHours - その日の実働時間
 * @param standardWeeklyHours - 施設の週所定労働時間
 * @param daysPerWeek - 週の稼働日数（デフォルト5日）
 */
export function calculateDailyFTE(
  dailyWorkHours: number,
  standardWeeklyHours: number,
  daysPerWeek: number = 5
): number {
  if (standardWeeklyHours <= 0) return 0;
  const estimatedWeeklyHours = dailyWorkHours * daysPerWeek;
  return calculateFTE(estimatedWeeklyHours, standardWeeklyHours);
}

// ============================================
// コンプライアンスチェック関数
// ============================================

/**
 * 日次人員配置コンプライアンスを計算
 *
 * 基準人員要件:
 * - 2名以上の基準人員が必須
 * - うち1名: 常勤専従（フルタイム専属）
 * - うち1名: 常勤または常勤換算1人分
 *
 * @param date - 対象日
 * @param shifts - その日のシフト一覧
 * @param personnelSettings - スタッフ人員設定
 * @param staffList - スタッフマスタ
 * @param facilitySettings - 施設設定（週所定労働時間など）
 * @param additionRequirements - 加算スタッフ要件（オプション）
 */
export function calculateDailyCompliance(
  date: string,
  shifts: ShiftWithPattern[],
  personnelSettings: StaffPersonnelSettings[],
  staffList: Staff[],
  facilitySettings: FacilityStaffingSettings,
  additionRequirements?: AdditionStaffRequirement[]
): DailyStaffingCompliance {
  const warnings: ComplianceWarning[] = [];
  const staffBreakdown: StaffComplianceBreakdown[] = [];

  // 出勤シフト（hasShift=true かつ 休み以外）をフィルタ
  const workingShifts = shifts.filter(
    (s) => s.hasShift && s.shiftPattern && !s.shiftPattern.isDayOff
  );

  // スタッフごとの情報を構築
  const personnelMap = new Map(
    personnelSettings.map((p) => [p.staffId, p])
  );
  const staffMap = new Map(staffList.map((s) => [s.id, s]));

  let standardStaffCount = 0;
  let additionStaffCount = 0;
  let totalFTE = 0;
  let hasFulltimeDedicated = false;
  let hasManager = false;
  let hasServiceManager = false;
  let fulltimeOrEquivalentCount = 0;

  for (const shift of workingShifts) {
    const personnel = personnelMap.get(shift.staffId);
    const staff = staffMap.get(shift.staffId);

    // シフトの実働時間を計算
    const workHours = calculateWorkHours(
      shift.startTime || shift.shiftPattern?.startTime,
      shift.endTime || shift.shiftPattern?.endTime,
      shift.breakMinutes ?? shift.shiftPattern?.breakMinutes ?? 0
    );

    // FTE計算（週所定労働時間に基づく）
    const fte = personnel?.contractedWeeklyHours
      ? calculateFTE(personnel.contractedWeeklyHours, facilitySettings.standardWeeklyHours)
      : calculateDailyFTE(workHours, facilitySettings.standardWeeklyHours);

    // 人員区分の判定
    const personnelType: PersonnelType = personnel?.personnelType || 'standard';
    const workStyle: WorkStyle = personnel?.workStyle || 'parttime';

    // カウント
    if (personnelType === 'standard') {
      standardStaffCount++;

      // 常勤専従チェック
      if (workStyle === 'fulltime_dedicated') {
        hasFulltimeDedicated = true;
        fulltimeOrEquivalentCount++;
      } else if (workStyle === 'fulltime_concurrent') {
        fulltimeOrEquivalentCount++;
      } else if (fte >= 1.0) {
        fulltimeOrEquivalentCount++;
      }
    } else {
      additionStaffCount++;
    }

    totalFTE += fte;

    // 管理者・児発管チェック
    if (personnel?.isManager) {
      hasManager = true;
    }
    if (personnel?.isServiceManager) {
      hasServiceManager = true;
    }

    // スタッフ内訳に追加
    staffBreakdown.push({
      staffId: shift.staffId,
      name: shift.staffName || staff?.name || '',
      personnelType,
      workStyle,
      scheduledHours: workHours,
      fte,
      qualifications: staff?.qualifications?.split(',').map((q) => q.trim()),
      assignedAdditions: personnel?.assignedAdditionCodes,
      isManager: personnel?.isManager,
      isServiceManager: personnel?.isServiceManager,
    });
  }

  // 2名配置チェック
  const hasTwoStaff = standardStaffCount >= 2;

  // 2人目の要件チェック（常勤または常勤換算1.0以上）
  const hasSecondStaff = fulltimeOrEquivalentCount >= 2 ||
    (hasFulltimeDedicated && (fulltimeOrEquivalentCount >= 1 || totalFTE >= 2.0));

  // 警告生成
  if (standardStaffCount < 2) {
    warnings.push({
      type: 'staffing_shortage',
      message: `基準人員が不足しています（現在${standardStaffCount}名、必要2名）`,
      severity: 'error',
    });
  }

  if (!hasFulltimeDedicated && standardStaffCount > 0) {
    warnings.push({
      type: 'fulltime_dedicated_absent',
      message: '常勤専従のスタッフが配置されていません',
      severity: 'error',
    });
  }

  if (hasTwoStaff && !hasSecondStaff) {
    warnings.push({
      type: 'fte_insufficient',
      message: '2人目の基準人員が常勤または常勤換算1.0に満たしていません',
      severity: 'warning',
    });
  }

  if (!hasManager) {
    warnings.push({
      type: 'manager_absent',
      message: '管理者が配置されていません',
      severity: 'warning',
    });
  }

  if (!hasServiceManager) {
    warnings.push({
      type: 'service_manager_absent',
      message: '児童発達支援管理責任者が配置されていません',
      severity: 'warning',
    });
  }

  // 加算別コンプライアンスチェック
  const additionCompliance: Record<string, { met: boolean; reason: string }> = {};

  if (additionRequirements) {
    for (const requirement of additionRequirements) {
      const result = checkAdditionRequirement(
        requirement,
        staffBreakdown,
        personnelSettings,
        staffList
      );
      additionCompliance[requirement.additionCode] = result;

      if (!result.met) {
        warnings.push({
          type: 'addition_requirement',
          message: `${requirement.description || requirement.additionCode}: ${result.reason}`,
          severity: 'warning',
          relatedAdditionCode: requirement.additionCode,
        });
      }
    }
  }

  // 総合ステータス判定
  let overallStatus: ComplianceStatus = 'compliant';
  if (warnings.some((w) => w.severity === 'error')) {
    overallStatus = 'non_compliant';
  } else if (warnings.length > 0) {
    overallStatus = 'warning';
  }

  return {
    id: '', // 保存時に生成
    facilityId: '', // 呼び出し元で設定
    date,
    overallStatus,
    hasTwoStaff,
    hasFulltimeDedicated,
    hasSecondStaff,
    fteTotal: Math.round(totalFTE * 100) / 100,
    hasManager,
    hasServiceManager,
    scheduledStaffCount: workingShifts.length,
    standardStaffCount,
    additionStaffCount,
    additionCompliance,
    staffBreakdown,
    warnings,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * 加算スタッフ要件をチェック
 */
export function checkAdditionRequirement(
  requirement: AdditionStaffRequirement,
  staffBreakdown: StaffComplianceBreakdown[],
  personnelSettings: StaffPersonnelSettings[],
  staffList: Staff[]
): { met: boolean; reason: string } {
  // 加算人員としてアサインされたスタッフを抽出
  const assignedStaff = staffBreakdown.filter((s) => {
    const personnel = personnelSettings.find((p) => p.staffId === s.staffId);
    return personnel?.assignedAdditionCodes?.includes(requirement.additionCode);
  });

  // 人数チェック
  if (assignedStaff.length < requirement.minStaffCount) {
    return {
      met: false,
      reason: `配置人数が不足しています（現在${assignedStaff.length}名、必要${requirement.minStaffCount}名）`,
    };
  }

  // 各スタッフの要件チェック
  for (const assigned of assignedStaff) {
    const staff = staffList.find((s) => s.id === assigned.staffId);
    const personnel = personnelSettings.find((p) => p.staffId === assigned.staffId);

    // 資格チェック
    if (requirement.requiredQualifications && requirement.requiredQualifications.length > 0) {
      const staffQuals = assigned.qualifications || [];
      const hasQualification = requirement.anyQualification
        ? requirement.requiredQualifications.some((q) => staffQuals.includes(q))
        : requirement.requiredQualifications.every((q) => staffQuals.includes(q));

      if (!hasQualification) {
        return {
          met: false,
          reason: `必要な資格を持つスタッフが配置されていません`,
        };
      }
    }

    // 経験年数チェック
    if (requirement.minYearsExperience !== undefined && requirement.minYearsExperience !== null) {
      const yearsExp = staff?.yearsOfExperience || 0;
      if (yearsExp < requirement.minYearsExperience) {
        return {
          met: false,
          reason: `経験年数が不足しています（必要${requirement.minYearsExperience}年以上）`,
        };
      }
    }

    // 勤務形態チェック
    if (requirement.requiredWorkStyle) {
      if (personnel?.workStyle !== requirement.requiredWorkStyle) {
        return {
          met: false,
          reason: `必要な勤務形態（${requirement.requiredWorkStyle}）のスタッフが配置されていません`,
        };
      }
    }

    // FTEチェック
    if (requirement.minFte !== undefined && requirement.minFte !== null) {
      if (assigned.fte < requirement.minFte) {
        return {
          met: false,
          reason: `常勤換算が不足しています（必要${requirement.minFte}以上）`,
        };
      }
    }
  }

  return { met: true, reason: '要件を満たしています' };
}

/**
 * 月次コンプライアンスを一括計算
 */
export function calculateMonthlyCompliance(
  year: number,
  month: number,
  allShifts: ShiftWithPattern[],
  personnelSettings: StaffPersonnelSettings[],
  staffList: Staff[],
  facilitySettings: FacilityStaffingSettings,
  additionRequirements?: AdditionStaffRequirement[]
): Map<string, DailyStaffingCompliance> {
  const results = new Map<string, DailyStaffingCompliance>();

  // 月の日数を取得
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // その日のシフトをフィルタ
    const dayShifts = allShifts.filter((s) => s.date === date);

    // コンプライアンス計算
    const compliance = calculateDailyCompliance(
      date,
      dayShifts,
      personnelSettings,
      staffList,
      facilitySettings,
      additionRequirements
    );

    results.set(date, compliance);
  }

  return results;
}

/**
 * 月次サマリーを計算
 */
export function calculateMonthlySummary(
  complianceResults: Map<string, DailyStaffingCompliance>
): {
  totalDays: number;
  compliantDays: number;
  warningDays: number;
  nonCompliantDays: number;
  commonWarnings: { type: ComplianceWarningType; count: number }[];
} {
  const results = Array.from(complianceResults.values());
  const warningCounts = new Map<ComplianceWarningType, number>();

  let compliantDays = 0;
  let warningDays = 0;
  let nonCompliantDays = 0;

  for (const daily of results) {
    switch (daily.overallStatus) {
      case 'compliant':
        compliantDays++;
        break;
      case 'warning':
        warningDays++;
        break;
      case 'non_compliant':
        nonCompliantDays++;
        break;
    }

    for (const warning of daily.warnings) {
      warningCounts.set(warning.type, (warningCounts.get(warning.type) || 0) + 1);
    }
  }

  const commonWarnings = Array.from(warningCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalDays: results.length,
    compliantDays,
    warningDays,
    nonCompliantDays,
    commonWarnings,
  };
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * コンプライアンス状態から表示用アイコンを取得
 */
export function getComplianceIcon(status: ComplianceStatus): string {
  switch (status) {
    case 'compliant':
      return '○';
    case 'warning':
      return '△';
    case 'non_compliant':
      return '×';
    default:
      return '-';
  }
}

/**
 * コンプライアンス状態から色を取得
 */
export function getComplianceColor(status: ComplianceStatus): string {
  switch (status) {
    case 'compliant':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'non_compliant':
      return 'text-red-600';
    default:
      return 'text-gray-400';
  }
}

/**
 * 勤務形態のラベルを取得
 */
export function getWorkStyleLabel(workStyle: WorkStyle): string {
  switch (workStyle) {
    case 'fulltime_dedicated':
      return '常勤専従';
    case 'fulltime_concurrent':
      return '常勤兼務';
    case 'parttime':
      return '非常勤';
    default:
      return '不明';
  }
}

/**
 * 人員区分のラベルを取得
 */
export function getPersonnelTypeLabel(type: PersonnelType): string {
  switch (type) {
    case 'standard':
      return '基準人員';
    case 'addition':
      return '加算人員';
    default:
      return '不明';
  }
}
