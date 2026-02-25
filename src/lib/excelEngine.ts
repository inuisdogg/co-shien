/**
 * Excel Export Engine for Roots
 * 勤務体制一覧表、出勤簿、月次財務サマリーのExcelエクスポート
 */

import * as XLSX from 'xlsx';
import type {
  WorkScheduleReport,
  WorkScheduleStaffAssignment,
  PersonnelType,
  WorkStyle,
  PERSONNEL_TYPE_LABELS,
  WORK_STYLE_LABELS,
} from '@/types';
import type {
  MonthlyFinancial,
  ProfitLossData,
  ProfitLossLineItem,
  ExpenseSummary,
} from '@/types/expense';

// ---------- Helpers ----------

const PERSONNEL_LABELS: Record<PersonnelType, string> = {
  standard: '基準人員',
  addition: '加算人員',
};

const WORK_STYLE_LABEL_MAP: Record<WorkStyle, string> = {
  fulltime_dedicated: '常勤専従',
  fulltime_concurrent: '常勤兼務',
  parttime: '非常勤',
};

/**
 * Apply uniform column widths to a worksheet based on header + data content.
 */
function autoFitColumns(ws: XLSX.WorkSheet, data: unknown[][]): void {
  if (data.length === 0) return;
  const colCount = Math.max(...data.map((row) => row.length));
  const colWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let maxLen = 10; // minimum width
    for (const row of data) {
      const cell = row[c];
      if (cell != null) {
        // Approximate width: CJK characters count as 2
        const str = String(cell);
        let len = 0;
        for (const ch of str) {
          len += ch.charCodeAt(0) > 0xff ? 2 : 1;
        }
        if (len > maxLen) maxLen = len;
      }
    }
    colWidths.push(Math.min(maxLen + 2, 40));
  }
  ws['!cols'] = colWidths.map((w) => ({ wch: w }));
}

/**
 * Convert AOA (array of arrays) data to a worksheet with auto-fit columns.
 */
function aoaToSheet(data: unknown[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(data);
  autoFitColumns(ws, data);
  return ws;
}

/**
 * Trigger download of a workbook as .xlsx in the browser.
 */
function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert a workbook to a Blob (useful when caller wants to handle download separately).
 */
function workbookToBlob(wb: XLSX.WorkBook): Blob {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Zero-pad a number to two digits.
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Get the number of days in a given month.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Get the Japanese weekday label for a date.
 */
function jpWeekday(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

// ---------- 1. Work Schedule (勤務体制一覧表) ----------

export interface ExportWorkScheduleOptions {
  /** When true, return a Blob instead of triggering a download. */
  asBlob?: boolean;
}

/**
 * Export a WorkScheduleReport to an Excel file (勤務体制一覧表).
 *
 * The sheet contains:
 *  - Header rows with facility / period information
 *  - A table of staff assignments with columns for name, type, work style,
 *    qualifications, weekly hours, FTE, role, and assigned additions.
 *  - Summary rows at the bottom with totals.
 */
export function exportWorkScheduleToExcel(
  report: WorkScheduleReport,
  facilityName?: string,
  options?: ExportWorkScheduleOptions,
): Blob | void {
  const { year, month, staffAssignments, totalStandardStaff, totalAdditionStaff, fteTotal } = report;

  // -- Build AOA data --
  const data: unknown[][] = [];

  // Title
  data.push(['勤務体制一覧表']);
  data.push([]);

  // Meta information
  data.push(['施設名', facilityName ?? '', '', '対象年月', `${year}年${month}月`]);
  data.push([
    '作成日',
    report.generatedAt
      ? new Date(report.generatedAt).toLocaleDateString('ja-JP')
      : new Date().toLocaleDateString('ja-JP'),
    '',
    'ステータス',
    report.status === 'approved' ? '承認済' : report.status === 'submitted' ? '提出済' : '下書き',
  ]);
  if (report.submittedTo) {
    data.push(['提出先', report.submittedTo]);
  }
  data.push([]);

  // Column headers
  data.push([
    'No.',
    '氏名',
    '人員区分',
    '勤務形態',
    '資格',
    '経験年数',
    '週所定労働時間',
    '常勤換算 (FTE)',
    '役割',
    '配置加算',
  ]);

  // Data rows
  staffAssignments.forEach((sa: WorkScheduleStaffAssignment, idx: number) => {
    data.push([
      idx + 1,
      sa.name,
      PERSONNEL_LABELS[sa.personnelType] ?? sa.personnelType,
      WORK_STYLE_LABEL_MAP[sa.workStyle] ?? sa.workStyle,
      (sa.qualifications ?? []).join(', '),
      sa.yearsOfExperience != null ? `${sa.yearsOfExperience}年` : '-',
      `${sa.weeklyHours}h`,
      sa.fte,
      sa.role ?? '-',
      (sa.assignedAdditions ?? []).join(', ') || '-',
    ]);
  });

  // Blank row + Summary
  data.push([]);
  data.push(['合計', '', '', '', '', '', '', '', '', '']);
  data.push(['基準人員数', totalStandardStaff]);
  data.push(['加算人員数', totalAdditionStaff]);
  data.push(['常勤換算合計', fteTotal]);

  if (report.notes) {
    data.push([]);
    data.push(['備考', report.notes]);
  }

  // -- Create workbook --
  const wb = XLSX.utils.book_new();
  const ws = aoaToSheet(data);

  // Merge title cell across columns
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];

  XLSX.utils.book_append_sheet(wb, ws, '勤務体制一覧表');

  const filename = `勤務体制一覧表_${year}年${pad2(month)}月.xlsx`;

  if (options?.asBlob) {
    return workbookToBlob(wb);
  }
  downloadWorkbook(wb, filename);
}

// ---------- 2. Attendance Record (出勤簿) ----------

export interface AttendanceDay {
  date: string;          // YYYY-MM-DD
  startTime?: string;    // HH:mm
  endTime?: string;      // HH:mm
  breakMinutes?: number;
  workMinutes?: number;
  overtimeMinutes?: number;
  leaveType?: string;    // 有給, 欠勤, 振替, etc.
  note?: string;
}

export interface StaffAttendanceData {
  staffId: string;
  staffName: string;
  role?: string;
  days: AttendanceDay[];
}

export interface ExportAttendanceOptions {
  asBlob?: boolean;
}

/**
 * Export staff attendance records for a given year/month to Excel (出勤簿).
 *
 * Generates one sheet per staff member, each containing:
 *  - Daily rows with start/end time, break, work hours, overtime, leave type, notes
 *  - A summary row at the bottom with totals.
 */
export function exportAttendanceToExcel(
  staffData: StaffAttendanceData[],
  year: number,
  month: number,
  facilityName?: string,
  options?: ExportAttendanceOptions,
): Blob | void {
  const wb = XLSX.utils.book_new();
  const totalDays = daysInMonth(year, month);

  for (const staff of staffData) {
    const data: unknown[][] = [];

    // Header
    data.push(['出勤簿']);
    data.push([]);
    data.push(['施設名', facilityName ?? '', '', '対象年月', `${year}年${month}月`]);
    data.push(['氏名', staff.staffName, '', '役職', staff.role ?? '-']);
    data.push([]);

    // Column headers
    data.push([
      '日付',
      '曜日',
      '出勤時間',
      '退勤時間',
      '休憩(分)',
      '勤務時間(h)',
      '残業時間(h)',
      '休暇区分',
      '備考',
    ]);

    // Build a lookup from date string to day record
    const dayMap = new Map<string, AttendanceDay>();
    for (const d of staff.days) {
      dayMap.set(d.date, d);
    }

    let totalWorkMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalBreakMinutes = 0;
    let workDaysCount = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
      const dateObj = new Date(year, month - 1, day);
      const weekday = jpWeekday(dateObj);
      const record = dayMap.get(dateStr);

      if (record) {
        const workH = record.workMinutes != null ? (record.workMinutes / 60).toFixed(1) : '-';
        const otH = record.overtimeMinutes != null ? (record.overtimeMinutes / 60).toFixed(1) : '-';

        if (record.workMinutes) {
          totalWorkMinutes += record.workMinutes;
          workDaysCount++;
        }
        if (record.overtimeMinutes) totalOvertimeMinutes += record.overtimeMinutes;
        if (record.breakMinutes) totalBreakMinutes += record.breakMinutes;

        data.push([
          `${month}/${day}`,
          weekday,
          record.startTime ?? '-',
          record.endTime ?? '-',
          record.breakMinutes ?? '-',
          workH,
          otH,
          record.leaveType ?? '-',
          record.note ?? '',
        ]);
      } else {
        data.push([`${month}/${day}`, weekday, '-', '-', '-', '-', '-', '-', '']);
      }
    }

    // Summary
    data.push([]);
    data.push([
      '合計',
      '',
      '',
      '',
      totalBreakMinutes,
      (totalWorkMinutes / 60).toFixed(1),
      (totalOvertimeMinutes / 60).toFixed(1),
      '',
      '',
    ]);
    data.push(['出勤日数', workDaysCount]);

    const ws = aoaToSheet(data);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

    // Sheet name: truncate to 31 characters (Excel limit)
    const sheetName = staff.staffName.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // If no staff data, add an empty sheet to avoid a corrupt workbook
  if (staffData.length === 0) {
    const ws = aoaToSheet([['出勤データがありません']]);
    XLSX.utils.book_append_sheet(wb, ws, '出勤簿');
  }

  const filename = `出勤簿_${year}年${pad2(month)}月.xlsx`;

  if (options?.asBlob) {
    return workbookToBlob(wb);
  }
  downloadWorkbook(wb, filename);
}

// ---------- 3. Monthly Financial Summary (月次財務サマリー) ----------

export interface ExportFinancialOptions {
  asBlob?: boolean;
}

export interface FinancialExportData {
  /** The monthly financial records (typically 12 months for a fiscal year). */
  monthlies: MonthlyFinancial[];
  /** Optional P/L data to include as a separate sheet. */
  profitLoss?: ProfitLossData;
  /** Optional expense category breakdown. */
  expenseSummaries?: ExpenseSummary[];
  /** Fiscal year label. */
  fiscalYear?: number;
  /** Facility name. */
  facilityName?: string;
}

/**
 * Export monthly financial summary to Excel.
 *
 * Generates up to three sheets:
 *  1. 月次財務サマリー - Monthly overview with revenue, expense, and profit columns
 *  2. 損益計算書 (if profitLoss data is provided) - P/L line items
 *  3. 経費カテゴリ内訳 (if expenseSummaries is provided) - Expense breakdown by category
 */
export function exportFinancialSummaryToExcel(
  financials: FinancialExportData,
  options?: ExportFinancialOptions,
): Blob | void {
  const wb = XLSX.utils.book_new();
  const { monthlies, profitLoss, expenseSummaries, fiscalYear, facilityName } = financials;

  const yearLabel = fiscalYear ?? (monthlies.length > 0 ? monthlies[0].year : new Date().getFullYear());

  // ---- Sheet 1: Monthly Financial Summary ----
  {
    const data: unknown[][] = [];
    data.push(['月次財務サマリー']);
    data.push([]);
    data.push(['施設名', facilityName ?? '', '', '年度', `${yearLabel}年度`]);
    data.push([]);

    // Column headers
    data.push([
      '年月',
      'サービス収入',
      'その他収入',
      '収入合計',
      '人件費',
      '固定費',
      '変動費',
      'その他経費',
      '支出合計',
      '粗利益',
      '営業利益',
      'ネットCF',
      '予算(収入)',
      '予算(支出)',
      '確定',
    ]);

    // Sort monthlies by year+month
    const sorted = [...monthlies].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    let sumRevService = 0;
    let sumRevOther = 0;
    let sumExpPersonnel = 0;
    let sumExpFixed = 0;
    let sumExpVariable = 0;
    let sumExpOther = 0;
    let sumGrossProfit = 0;
    let sumOpProfit = 0;
    let sumNetCF = 0;

    for (const m of sorted) {
      const totalRevenue = m.revenueService + m.revenueOther;
      const totalExpense = m.expensePersonnel + m.expenseFixed + m.expenseVariable + m.expenseOther;

      sumRevService += m.revenueService;
      sumRevOther += m.revenueOther;
      sumExpPersonnel += m.expensePersonnel;
      sumExpFixed += m.expenseFixed;
      sumExpVariable += m.expenseVariable;
      sumExpOther += m.expenseOther;
      sumGrossProfit += m.grossProfit;
      sumOpProfit += m.operatingProfit;
      sumNetCF += m.netCashFlow;

      data.push([
        `${m.year}/${pad2(m.month)}`,
        m.revenueService,
        m.revenueOther,
        totalRevenue,
        m.expensePersonnel,
        m.expenseFixed,
        m.expenseVariable,
        m.expenseOther,
        totalExpense,
        m.grossProfit,
        m.operatingProfit,
        m.netCashFlow,
        m.budgetRevenue ?? '-',
        m.budgetExpense ?? '-',
        m.isFinalized ? '確定' : '未確定',
      ]);
    }

    // Totals row
    data.push([]);
    data.push([
      '年間合計',
      sumRevService,
      sumRevOther,
      sumRevService + sumRevOther,
      sumExpPersonnel,
      sumExpFixed,
      sumExpVariable,
      sumExpOther,
      sumExpPersonnel + sumExpFixed + sumExpVariable + sumExpOther,
      sumGrossProfit,
      sumOpProfit,
      sumNetCF,
      '',
      '',
      '',
    ]);

    const ws = aoaToSheet(data);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }];
    XLSX.utils.book_append_sheet(wb, ws, '月次財務サマリー');
  }

  // ---- Sheet 2: Profit & Loss (損益計算書) ----
  if (profitLoss) {
    const data: unknown[][] = [];
    data.push(['損益計算書']);
    data.push([]);
    data.push(['年度', `${profitLoss.fiscalYear}年度`]);
    data.push([]);

    // Build month headers
    const monthHeaders = ['科目'];
    for (let m = 4; m <= 12; m++) monthHeaders.push(`${m}月`);
    for (let m = 1; m <= 3; m++) monthHeaders.push(`${m}月`);
    monthHeaders.push('年間合計');
    data.push(monthHeaders);

    for (const line of profitLoss.lines) {
      const indent = line.indent ? '　'.repeat(line.indent) : '';
      const label = line.isTotal ? `【${line.label}】` : line.isSubtotal ? `＜${line.label}＞` : `${indent}${line.label}`;
      const row: unknown[] = [label];

      // Months 4..12, then 1..3 (Japanese fiscal year: April - March)
      for (let m = 4; m <= 12; m++) row.push(line.values[m] ?? 0);
      for (let m = 1; m <= 3; m++) row.push(line.values[m] ?? 0);
      row.push(line.yearTotal);

      data.push(row);
    }

    const ws = aoaToSheet(data);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }];
    XLSX.utils.book_append_sheet(wb, ws, '損益計算書');
  }

  // ---- Sheet 3: Expense Category Breakdown (経費カテゴリ内訳) ----
  if (expenseSummaries && expenseSummaries.length > 0) {
    const data: unknown[][] = [];
    data.push(['経費カテゴリ内訳']);
    data.push([]);

    data.push([
      'カテゴリ',
      '件数',
      '合計金額',
      '承認済件数',
      '承認済金額',
      '未承認件数',
      '未承認金額',
    ]);

    let totalCount = 0;
    let totalAmount = 0;
    let totalApprovedCount = 0;
    let totalApprovedAmount = 0;

    for (const es of expenseSummaries) {
      data.push([
        es.categoryName,
        es.count,
        es.totalAmount,
        es.approvedCount,
        es.approvedAmount,
        es.pendingCount,
        es.pendingAmount,
      ]);
      totalCount += es.count;
      totalAmount += es.totalAmount;
      totalApprovedCount += es.approvedCount;
      totalApprovedAmount += es.approvedAmount;
    }

    data.push([]);
    data.push([
      '合計',
      totalCount,
      totalAmount,
      totalApprovedCount,
      totalApprovedAmount,
      totalCount - totalApprovedCount,
      totalAmount - totalApprovedAmount,
    ]);

    const ws = aoaToSheet(data);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    XLSX.utils.book_append_sheet(wb, ws, '経費カテゴリ内訳');
  }

  const filename = `財務サマリー_${yearLabel}年度.xlsx`;

  if (options?.asBlob) {
    return workbookToBlob(wb);
  }
  downloadWorkbook(wb, filename);
}
