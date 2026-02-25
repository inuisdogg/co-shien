/**
 * 給与計算ユーティリティ
 * 常勤/非常勤の基本給・時給計算、残業、控除
 */

export type EmploymentType = 'fulltime' | 'parttime';

export type PayrollInput = {
  staffId: string;
  staffName: string;
  employmentType: EmploymentType;
  // 常勤
  baseSalary?: number;         // 月額基本給
  // 非常勤
  hourlyWage?: number;         // 時給
  // 勤務実績
  scheduledDays: number;       // 所定出勤日数
  actualDays: number;          // 実出勤日数
  totalHours: number;          // 総勤務時間
  overtimeHours: number;       // 残業時間
  lateNightHours: number;      // 深夜勤務時間
  holidayHours: number;        // 休日勤務時間
  paidLeaveDays: number;       // 有給消化日数
  absentDays: number;          // 欠勤日数
  // 手当
  commutingAllowance?: number;  // 通勤手当
  positionAllowance?: number;   // 役職手当
  qualificationAllowance?: number; // 資格手当
  otherAllowances?: number;    // その他手当
};

export type PayrollResult = {
  staffId: string;
  staffName: string;
  // 支給
  basePay: number;             // 基本給（または時給×時間）
  overtimePay: number;         // 残業手当
  lateNightPay: number;        // 深夜手当
  holidayPay: number;          // 休日手当
  commutingAllowance: number;
  positionAllowance: number;
  qualificationAllowance: number;
  otherAllowances: number;
  grossPay: number;            // 総支給額
  // 控除
  healthInsurance: number;     // 健康保険
  pensionInsurance: number;    // 厚生年金
  employmentInsurance: number; // 雇用保険
  incomeTax: number;           // 所得税（概算）
  residentTax: number;         // 住民税（概算）
  totalDeductions: number;     // 控除合計
  // 差引
  netPay: number;              // 手取り
};

export type PayrollSummary = {
  year: number;
  month: number;
  staffPayrolls: PayrollResult[];
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalLaborCost: number;      // 法定福利費込み
};

// 社会保険料率（概算値 - 実際の料率は年度・地域で異なる）
const INSURANCE_RATES = {
  healthInsurance: 0.05,       // 健康保険（従業員負担 約5%）
  pensionInsurance: 0.0915,    // 厚生年金（従業員負担 9.15%）
  employmentInsurance: 0.006,  // 雇用保険（従業員負担 0.6%）
  employerHealthInsurance: 0.05, // 事業主負担
  employerPension: 0.0915,     // 事業主負担
  employerEmployment: 0.0095,  // 事業主負担（0.95%）
  workersComp: 0.003,          // 労災保険（事業主全額）
};

// 残業割増率
const OVERTIME_RATE = 1.25;
const LATE_NIGHT_RATE = 1.5;  // 深夜は25%追加
const HOLIDAY_RATE = 1.35;

/**
 * 個人の給与を計算
 */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  let basePay: number;

  if (input.employmentType === 'fulltime') {
    // 常勤：月給制
    basePay = input.baseSalary || 0;
    // 欠勤控除
    if (input.absentDays > 0 && input.scheduledDays > 0) {
      const dailyRate = basePay / input.scheduledDays;
      basePay -= dailyRate * input.absentDays;
    }
  } else {
    // 非常勤：時給制
    basePay = (input.hourlyWage || 0) * input.totalHours;
  }

  // 時給ベース（残業計算用）
  const hourlyBase = input.employmentType === 'fulltime'
    ? (input.baseSalary || 0) / (input.scheduledDays * 8) // 1日8時間前提
    : (input.hourlyWage || 0);

  const overtimePay = Math.round(hourlyBase * input.overtimeHours * OVERTIME_RATE);
  const lateNightPay = Math.round(hourlyBase * input.lateNightHours * LATE_NIGHT_RATE);
  const holidayPay = Math.round(hourlyBase * input.holidayHours * HOLIDAY_RATE);

  const commutingAllowance = input.commutingAllowance || 0;
  const positionAllowance = input.positionAllowance || 0;
  const qualificationAllowance = input.qualificationAllowance || 0;
  const otherAllowances = input.otherAllowances || 0;

  const grossPay = Math.round(basePay + overtimePay + lateNightPay + holidayPay +
    commutingAllowance + positionAllowance + qualificationAllowance + otherAllowances);

  // 社会保険料計算（通勤手当は保険料算定基礎に含む）
  const insuranceBase = grossPay;
  const healthInsurance = Math.round(insuranceBase * INSURANCE_RATES.healthInsurance);
  const pensionInsurance = Math.round(insuranceBase * INSURANCE_RATES.pensionInsurance);
  const employmentInsurance = Math.round(insuranceBase * INSURANCE_RATES.employmentInsurance);

  // 所得税（概算 - 扶養人数等考慮せず簡易計算）
  const taxableIncome = grossPay - healthInsurance - pensionInsurance - employmentInsurance;
  const incomeTax = Math.round(estimateMonthlyIncomeTax(taxableIncome));

  // 住民税（概算 - 前年所得ベースのため固定値的に概算）
  const residentTax = Math.round(taxableIncome * 0.1 / 12); // 年間約10%の月割

  const totalDeductions = healthInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax;
  const netPay = grossPay - totalDeductions;

  return {
    staffId: input.staffId,
    staffName: input.staffName,
    basePay: Math.round(basePay),
    overtimePay,
    lateNightPay,
    holidayPay,
    commutingAllowance,
    positionAllowance,
    qualificationAllowance,
    otherAllowances,
    grossPay,
    healthInsurance,
    pensionInsurance,
    employmentInsurance,
    incomeTax,
    residentTax,
    totalDeductions,
    netPay,
  };
}

/**
 * 月次給与計算の概算所得税
 */
function estimateMonthlyIncomeTax(monthlyTaxableIncome: number): number {
  // 簡易月額表ベース概算
  if (monthlyTaxableIncome <= 88000) return 0;
  if (monthlyTaxableIncome <= 162500) return (monthlyTaxableIncome - 88000) * 0.05;
  if (monthlyTaxableIncome <= 275000) return 3730 + (monthlyTaxableIncome - 162500) * 0.1;
  if (monthlyTaxableIncome <= 579167) return 14980 + (monthlyTaxableIncome - 275000) * 0.2;
  return 75813 + (monthlyTaxableIncome - 579167) * 0.23;
}

/**
 * 月次給与サマリーを計算
 */
export function calculatePayrollSummary(
  year: number,
  month: number,
  inputs: PayrollInput[]
): PayrollSummary {
  const staffPayrolls = inputs.map(calculatePayroll);
  const totalGrossPay = staffPayrolls.reduce((sum, p) => sum + p.grossPay, 0);
  const totalDeductions = staffPayrolls.reduce((sum, p) => sum + p.totalDeductions, 0);
  const totalNetPay = staffPayrolls.reduce((sum, p) => sum + p.netPay, 0);

  // 法定福利費（事業主負担分）
  const employerInsurance = totalGrossPay * (
    INSURANCE_RATES.employerHealthInsurance +
    INSURANCE_RATES.employerPension +
    INSURANCE_RATES.employerEmployment +
    INSURANCE_RATES.workersComp
  );
  const totalLaborCost = Math.round(totalGrossPay + employerInsurance);

  return {
    year,
    month,
    staffPayrolls,
    totalGrossPay,
    totalDeductions,
    totalNetPay,
    totalLaborCost,
  };
}
