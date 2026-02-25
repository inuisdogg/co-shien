/**
 * Service Record Generator for Roots
 * サービス提供記録/月次実績記録票の生成
 *
 * - 児童ごとの月次サービス提供記録を生成
 * - Excel エクスポート (xlsx)
 * - 印刷用 HTML 生成
 */

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// ---------- Types ----------

export type DailyServiceRecord = {
  date: number; // day of month
  dayOfWeek: string;
  attended: boolean;
  startTime?: string;
  endTime?: string;
  serviceContent?: string; // 支援内容
  staffName?: string; // 担当者
  notes?: string;
  isAbsence?: boolean;
  absenceReason?: string;
};

export type ServiceRecord = {
  childName: string;
  childId: string;
  recipientNumber: string; // 受給者番号
  facilityName: string;
  year: number;
  month: number;
  dailyRecords: DailyServiceRecord[];
  totalDays: number; // 利用日数合計
  totalAbsences: number; // 欠席日数
};

export type ServiceRecordSummary = {
  totalChildren: number;
  totalServiceDays: number;
  averageDaysPerChild: number;
  records: ServiceRecord[];
};

// ---------- Helpers ----------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function jpWeekday(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Apply uniform column widths to a worksheet based on header + data content.
 */
function autoFitColumns(ws: XLSX.WorkSheet, data: unknown[][]): void {
  if (data.length === 0) return;
  const colCount = Math.max(...data.map((row) => row.length));
  const colWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let maxLen = 10;
    for (const row of data) {
      const cell = row[c];
      if (cell != null) {
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

function aoaToSheet(data: unknown[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(data);
  autoFitColumns(ws, data);
  return ws;
}

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

function workbookToBlob(wb: XLSX.WorkBook): Blob {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ---------- Data Fetching ----------

interface ChildRow {
  id: string;
  name: string;
  beneficiary_number?: string;
}

interface ScheduleRow {
  id: string;
  child_id: string;
  child_name: string;
  date: string;
  slot: string;
  staff_id?: string;
}

interface UsageRecordRow {
  id: string;
  child_id: string;
  child_name: string;
  date: string;
  service_status: string;
  actual_start_time?: string;
  actual_end_time?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  memo?: string;
  record_sheet_remarks?: string;
  instruction_form?: string;
}

interface DailyLogRow {
  id: string;
  child_id: string;
  date: string;
  staff_name?: string;
  support_content?: string;
  progress_notes?: string;
  special_notes?: string;
}

interface StaffRow {
  id: string;
  name?: string;
  last_name?: string;
  first_name?: string;
}

/**
 * Fetch facility name by facility ID.
 */
async function fetchFacilityName(facilityId: string): Promise<string> {
  const { data } = await supabase
    .from('facilities')
    .select('name')
    .eq('id', facilityId)
    .single();
  return (data as { name: string } | null)?.name ?? '';
}

/**
 * Fetch all active children for a facility.
 */
async function fetchChildren(facilityId: string): Promise<ChildRow[]> {
  const { data, error } = await supabase
    .from('children')
    .select('id, name, beneficiary_number')
    .eq('facility_id', facilityId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching children:', error);
    return [];
  }
  return (data ?? []) as ChildRow[];
}

/**
 * Fetch a single child by ID.
 */
async function fetchChild(childId: string): Promise<ChildRow | null> {
  const { data, error } = await supabase
    .from('children')
    .select('id, name, beneficiary_number')
    .eq('id', childId)
    .single();

  if (error) {
    console.error('Error fetching child:', error);
    return null;
  }
  return (data ?? null) as ChildRow | null;
}

/**
 * Fetch schedules for a given facility, child, and month.
 */
async function fetchSchedules(
  facilityId: string,
  childId: string,
  year: number,
  month: number,
): Promise<ScheduleRow[]> {
  const startDate = `${year}-${pad2(month)}-01`;
  const endDate = `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`;

  const { data, error } = await supabase
    .from('schedules')
    .select('id, child_id, child_name, date, slot, staff_id')
    .eq('facility_id', facilityId)
    .eq('child_id', childId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }
  return (data ?? []) as ScheduleRow[];
}

/**
 * Fetch usage records (attendance/service records) for a given facility, child, and month.
 */
async function fetchUsageRecords(
  facilityId: string,
  childId: string,
  year: number,
  month: number,
): Promise<UsageRecordRow[]> {
  const startDate = `${year}-${pad2(month)}-01`;
  const endDate = `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`;

  const { data, error } = await supabase
    .from('usage_records')
    .select(
      'id, child_id, child_name, date, service_status, actual_start_time, actual_end_time, planned_start_time, planned_end_time, memo, record_sheet_remarks, instruction_form',
    )
    .eq('facility_id', facilityId)
    .eq('child_id', childId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching usage records:', error);
    return [];
  }
  return (data ?? []) as UsageRecordRow[];
}

/**
 * Fetch daily log entries for a given child and month.
 */
async function fetchDailyLogs(
  facilityId: string,
  childId: string,
  year: number,
  month: number,
): Promise<DailyLogRow[]> {
  const startDate = `${year}-${pad2(month)}-01`;
  const endDate = `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`;

  const { data, error } = await supabase
    .from('daily_logs')
    .select('id, child_id, date, staff_name, support_content, progress_notes, special_notes')
    .eq('facility_id', facilityId)
    .eq('child_id', childId)
    .eq('log_type', 'child')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching daily logs:', error);
    return [];
  }
  return (data ?? []) as DailyLogRow[];
}

/**
 * Fetch staff name by user ID.
 */
async function fetchStaffNames(staffIds: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (staffIds.length === 0) return nameMap;

  const uniqueIds = [...new Set(staffIds)];
  const { data, error } = await supabase
    .from('users')
    .select('id, name, last_name, first_name')
    .in('id', uniqueIds);

  if (error) {
    console.error('Error fetching staff names:', error);
    return nameMap;
  }

  for (const row of (data ?? []) as StaffRow[]) {
    const name =
      row.name ||
      (row.last_name && row.first_name ? `${row.last_name} ${row.first_name}` : row.last_name ?? row.first_name ?? '');
    if (name) {
      nameMap.set(row.id, name);
    }
  }
  return nameMap;
}

// ---------- Record Generation ----------

/**
 * Generate a single child's monthly service record.
 */
export async function generateServiceRecord(
  facilityId: string,
  childId: string,
  year: number,
  month: number,
): Promise<ServiceRecord | null> {
  // Fetch data in parallel
  const [facilityName, child, schedules, usageRecords, dailyLogs] = await Promise.all([
    fetchFacilityName(facilityId),
    fetchChild(childId),
    fetchSchedules(facilityId, childId, year, month),
    fetchUsageRecords(facilityId, childId, year, month),
    fetchDailyLogs(facilityId, childId, year, month),
  ]);

  if (!child) {
    console.error('Child not found:', childId);
    return null;
  }

  // Gather staff IDs from schedules to resolve names
  const staffIds = schedules
    .map((s) => s.staff_id)
    .filter((id): id is string => id != null);
  const staffNameMap = await fetchStaffNames(staffIds);

  // Build lookup maps by date
  const scheduleByDate = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    const dateKey = s.date;
    const existing = scheduleByDate.get(dateKey) ?? [];
    existing.push(s);
    scheduleByDate.set(dateKey, existing);
  }

  const usageByDate = new Map<string, UsageRecordRow[]>();
  for (const u of usageRecords) {
    const dateKey = u.date;
    const existing = usageByDate.get(dateKey) ?? [];
    existing.push(u);
    usageByDate.set(dateKey, existing);
  }

  const logByDate = new Map<string, DailyLogRow>();
  for (const l of dailyLogs) {
    logByDate.set(l.date, l);
  }

  // Build daily records for every day in the month
  const totalDaysInMonth = daysInMonth(year, month);
  const dailyRecordsList: DailyServiceRecord[] = [];
  let totalAttendedDays = 0;
  let totalAbsenceDays = 0;

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = jpWeekday(dateObj);

    const daySchedules = scheduleByDate.get(dateStr) ?? [];
    const dayUsage = usageByDate.get(dateStr) ?? [];
    const dayLog = logByDate.get(dateStr);

    // Determine if child had a schedule or usage record for this day
    const hasSchedule = daySchedules.length > 0;
    const hasUsage = dayUsage.length > 0;

    if (!hasSchedule && !hasUsage) {
      // No activity on this day - include as empty row
      dailyRecordsList.push({
        date: day,
        dayOfWeek,
        attended: false,
      });
      continue;
    }

    // Determine attendance from usage records
    const attendedUsage = dayUsage.filter((u) => u.service_status === '利用');
    const absenceUsage = dayUsage.filter(
      (u) => u.service_status === '欠席(加算なし)' || u.service_status === '加算のみ',
    );

    const attended = attendedUsage.length > 0;
    const isAbsence = !attended && (absenceUsage.length > 0 || (hasSchedule && !hasUsage));

    if (attended) {
      totalAttendedDays++;
    }
    if (isAbsence) {
      totalAbsenceDays++;
    }

    // Get times from usage records
    const primaryUsage = attendedUsage[0] ?? absenceUsage[0] ?? dayUsage[0];
    const startTime =
      primaryUsage?.actual_start_time?.slice(0, 5) ??
      primaryUsage?.planned_start_time?.slice(0, 5);
    const endTime =
      primaryUsage?.actual_end_time?.slice(0, 5) ??
      primaryUsage?.planned_end_time?.slice(0, 5);

    // Get staff name from schedule
    const staffId = daySchedules[0]?.staff_id;
    const staffName = staffId ? staffNameMap.get(staffId) : dayLog?.staff_name;

    // Build service content from daily log or usage record
    const serviceContentParts: string[] = [];
    if (dayLog?.support_content) {
      serviceContentParts.push(dayLog.support_content);
    }
    if (primaryUsage?.instruction_form) {
      serviceContentParts.push(primaryUsage.instruction_form);
    }
    if (dayLog?.progress_notes) {
      serviceContentParts.push(dayLog.progress_notes);
    }
    const serviceContent = serviceContentParts.join(' / ') || undefined;

    // Build notes
    const notesParts: string[] = [];
    if (primaryUsage?.memo) notesParts.push(primaryUsage.memo);
    if (primaryUsage?.record_sheet_remarks) notesParts.push(primaryUsage.record_sheet_remarks);
    if (dayLog?.special_notes) notesParts.push(dayLog.special_notes);
    const notes = notesParts.join(' / ') || undefined;

    // Absence reason
    let absenceReason: string | undefined;
    if (isAbsence && absenceUsage.length > 0) {
      absenceReason = absenceUsage[0].service_status;
      if (absenceUsage[0].memo) {
        absenceReason += `: ${absenceUsage[0].memo}`;
      }
    }

    dailyRecordsList.push({
      date: day,
      dayOfWeek,
      attended,
      startTime,
      endTime,
      serviceContent,
      staffName: staffName ?? undefined,
      notes,
      isAbsence,
      absenceReason,
    });
  }

  return {
    childName: child.name,
    childId: child.id,
    recipientNumber: child.beneficiary_number ?? '',
    facilityName,
    year,
    month,
    dailyRecords: dailyRecordsList,
    totalDays: totalAttendedDays,
    totalAbsences: totalAbsenceDays,
  };
}

/**
 * Generate monthly service records for all children in a facility.
 */
export async function generateMonthlyServiceRecords(
  facilityId: string,
  year: number,
  month: number,
): Promise<ServiceRecordSummary> {
  const children = await fetchChildren(facilityId);

  const records: ServiceRecord[] = [];

  for (const child of children) {
    const record = await generateServiceRecord(facilityId, child.id, year, month);
    if (record) {
      records.push(record);
    }
  }

  const totalServiceDays = records.reduce((sum, r) => sum + r.totalDays, 0);

  return {
    totalChildren: records.length,
    totalServiceDays,
    averageDaysPerChild: records.length > 0 ? Math.round((totalServiceDays / records.length) * 10) / 10 : 0,
    records,
  };
}

// ---------- Excel Export ----------

export interface ExportServiceRecordOptions {
  asBlob?: boolean;
}

/**
 * Export a single child's service record to Excel.
 */
export function exportServiceRecordToExcel(
  record: ServiceRecord,
  options?: ExportServiceRecordOptions,
): Blob | void {
  const wb = XLSX.utils.book_new();
  const data = buildServiceRecordSheetData(record);
  const ws = aoaToSheet(data);

  // Merge title cell across columns
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  const sheetName = `${record.childName}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const filename = `サービス提供記録_${record.childName}_${record.year}年${pad2(record.month)}月.xlsx`;

  if (options?.asBlob) {
    return workbookToBlob(wb);
  }
  downloadWorkbook(wb, filename);
}

/**
 * Export all children's service records for a month to a single Excel workbook.
 */
export function exportAllServiceRecordsToExcel(
  summary: ServiceRecordSummary,
  year: number,
  month: number,
  options?: ExportServiceRecordOptions,
): Blob | void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData: unknown[][] = [];
  summaryData.push(['月次実績記録票 サマリー']);
  summaryData.push([]);
  summaryData.push(['対象年月', `${year}年${month}月`]);
  summaryData.push(['対象児童数', summary.totalChildren]);
  summaryData.push(['利用日数合計', summary.totalServiceDays]);
  summaryData.push(['平均利用日数', summary.averageDaysPerChild]);
  summaryData.push([]);
  summaryData.push(['児童名', '受給者番号', '利用日数', '欠席日数']);

  for (const r of summary.records) {
    summaryData.push([r.childName, r.recipientNumber, r.totalDays, r.totalAbsences]);
  }

  const summaryWs = aoaToSheet(summaryData);
  summaryWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'サマリー');

  // Individual sheets per child
  for (const record of summary.records) {
    const data = buildServiceRecordSheetData(record);
    const ws = aoaToSheet(data);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

    const sheetName = record.childName.slice(0, 31);
    // Avoid duplicate sheet names
    let finalName = sheetName;
    let counter = 1;
    const existingNames = wb.SheetNames;
    while (existingNames.includes(finalName)) {
      finalName = `${sheetName.slice(0, 28)}_${counter}`;
      counter++;
    }
    XLSX.utils.book_append_sheet(wb, ws, finalName);
  }

  if (summary.records.length === 0) {
    const ws = aoaToSheet([['該当する児童のデータがありません']]);
    XLSX.utils.book_append_sheet(wb, ws, 'データなし');
  }

  const filename = `月次実績記録票_${year}年${pad2(month)}月_全児童.xlsx`;

  if (options?.asBlob) {
    return workbookToBlob(wb);
  }
  downloadWorkbook(wb, filename);
}

/**
 * Build AOA data for a single child's service record sheet.
 */
function buildServiceRecordSheetData(record: ServiceRecord): unknown[][] {
  const data: unknown[][] = [];

  // Title
  data.push(['サービス提供記録 / 月次実績記録票']);
  data.push([]);

  // Meta information
  data.push(['施設名', record.facilityName, '', '対象年月', `${record.year}年${record.month}月`]);
  data.push(['児童名', record.childName, '', '受給者番号', record.recipientNumber || '-']);
  data.push([
    '作成日',
    new Date().toLocaleDateString('ja-JP'),
    '',
    '利用日数合計',
    record.totalDays,
    '',
    '欠席日数',
    record.totalAbsences,
  ]);
  data.push([]);

  // Column headers
  data.push([
    '日付',
    '曜日',
    '利用',
    '開始時間',
    '終了時間',
    '支援内容',
    '担当者',
    '備考',
  ]);

  // Data rows
  for (const dr of record.dailyRecords) {
    const attendLabel = dr.attended ? '○' : dr.isAbsence ? '欠' : '-';

    data.push([
      `${record.month}/${dr.date}`,
      dr.dayOfWeek,
      attendLabel,
      dr.startTime ?? '-',
      dr.endTime ?? '-',
      dr.serviceContent ?? '',
      dr.staffName ?? '',
      dr.isAbsence && dr.absenceReason ? dr.absenceReason : dr.notes ?? '',
    ]);
  }

  // Summary
  data.push([]);
  data.push(['合計', '', '', '', '', '', '', '']);
  data.push(['利用日数', record.totalDays]);
  data.push(['欠席日数', record.totalAbsences]);

  return data;
}

// ---------- HTML (Print) Generation ----------

/**
 * Generate printable HTML for a service record.
 */
export function generateServiceRecordHTML(record: ServiceRecord): string {
  const dailyRows = record.dailyRecords
    .map((dr) => {
      const attendLabel = dr.attended ? '○' : dr.isAbsence ? '欠' : '';
      const rowClass = dr.attended
        ? ''
        : dr.isAbsence
          ? 'absence-row'
          : dr.dayOfWeek === '日' || dr.dayOfWeek === '土'
            ? 'weekend-row'
            : '';

      return `
      <tr class="${rowClass}">
        <td class="text-center">${record.month}/${dr.date}</td>
        <td class="text-center">${dr.dayOfWeek}</td>
        <td class="text-center font-bold">${attendLabel}</td>
        <td class="text-center">${escapeHtml(dr.startTime) || ''}</td>
        <td class="text-center">${escapeHtml(dr.endTime) || ''}</td>
        <td>${escapeHtml(dr.serviceContent) || ''}</td>
        <td class="text-center">${escapeHtml(dr.staffName) || ''}</td>
        <td>${dr.isAbsence && dr.absenceReason ? escapeHtml(dr.absenceReason) : escapeHtml(dr.notes) || ''}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>サービス提供記録 - ${escapeHtml(record.childName)} ${record.year}年${record.month}月</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", "Yu Gothic", sans-serif;
      font-size: 9pt;
      line-height: 1.4;
      color: #1a1a1a;
      background: white;
    }
    .page {
      max-width: 297mm;
      margin: 0 auto;
      padding: 5mm;
    }
    .title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4mm;
      border-bottom: 2px solid #333;
      padding-bottom: 2mm;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4mm;
    }
    .meta-table td {
      padding: 2px 6px;
      font-size: 9pt;
      vertical-align: top;
    }
    .meta-table .label {
      font-weight: bold;
      width: 80px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
    }
    .meta-table .value {
      border: 1px solid #ddd;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .data-table th {
      background-color: #e8edf2;
      border: 1px solid #999;
      padding: 3px 4px;
      text-align: center;
      font-weight: bold;
      white-space: nowrap;
    }
    .data-table td {
      border: 1px solid #999;
      padding: 2px 4px;
      vertical-align: top;
    }
    .data-table .text-center {
      text-align: center;
    }
    .data-table .font-bold {
      font-weight: bold;
    }
    .absence-row {
      background-color: #fff3f3;
    }
    .weekend-row {
      background-color: #f8f8f8;
    }
    .summary-table {
      width: auto;
      border-collapse: collapse;
      margin-top: 4mm;
      font-size: 9pt;
    }
    .summary-table td {
      border: 1px solid #999;
      padding: 3px 10px;
    }
    .summary-table .label {
      background-color: #f0f4f8;
      font-weight: bold;
    }
    .stamp-area {
      float: right;
      display: flex;
      gap: 3mm;
      margin-bottom: 3mm;
    }
    .stamp-box {
      width: 18mm;
      height: 18mm;
      border: 1px solid #999;
      text-align: center;
      font-size: 7pt;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-bottom: 2px;
    }
    .clearfix::after {
      content: "";
      display: table;
      clear: both;
    }
    .footer {
      margin-top: 4mm;
      padding-top: 2mm;
      border-top: 1px solid #ccc;
      font-size: 7pt;
      color: #888;
      text-align: right;
    }
    @media print {
      body { background: white; }
      .page { padding: 0; max-width: none; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Stamp area -->
    <div class="stamp-area">
      <div class="stamp-box">施設長</div>
      <div class="stamp-box">管理者</div>
      <div class="stamp-box">担当</div>
    </div>
    <div class="clearfix"></div>

    <div class="title">サービス提供記録 / 月次実績記録票</div>

    <!-- Meta Information -->
    <table class="meta-table">
      <tr>
        <td class="label">施設名</td>
        <td class="value">${escapeHtml(record.facilityName)}</td>
        <td class="label">対象年月</td>
        <td class="value">${record.year}年${record.month}月</td>
      </tr>
      <tr>
        <td class="label">児童名</td>
        <td class="value">${escapeHtml(record.childName)}</td>
        <td class="label">受給者番号</td>
        <td class="value">${escapeHtml(record.recipientNumber) || '-'}</td>
      </tr>
    </table>

    <!-- Daily Records Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:50px">日付</th>
          <th style="width:30px">曜日</th>
          <th style="width:30px">利用</th>
          <th style="width:50px">開始</th>
          <th style="width:50px">終了</th>
          <th>支援内容</th>
          <th style="width:70px">担当者</th>
          <th>備考</th>
        </tr>
      </thead>
      <tbody>
        ${dailyRows}
      </tbody>
    </table>

    <!-- Summary -->
    <table class="summary-table">
      <tr>
        <td class="label">利用日数合計</td>
        <td>${record.totalDays} 日</td>
        <td class="label">欠席日数</td>
        <td>${record.totalAbsences} 日</td>
      </tr>
    </table>

    <div class="footer">
      作成日: ${new Date().toLocaleDateString('ja-JP')} | Roots システム出力
    </div>
  </div>
</body>
</html>`;
}
