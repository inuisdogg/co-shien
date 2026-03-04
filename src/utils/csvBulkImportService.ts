/**
 * CSV一括インポートサービス
 * フル/簡易の2モードでスタッフを一括登録
 */

import { supabase } from '@/lib/supabase';
import { ProxyAccountData, StaffInvitation } from '@/types';
import {
  ParsedCSVRow,
  ValidationResult,
  RowValidationError,
  BulkImportResult,
  BulkImportRowResult,
} from '@/types/bulkImport';
import { createProxyAccount } from '@/utils/staffInvitationService';

// ---- CSV解析 ----

const FULL_HEADERS = [
  '姓', '名', 'セイ', 'メイ', 'メールアドレス', '電話番号',
  '生年月日', '性別', '職種', '雇用形態', '入職日',
  '資格', '月給', '時給', 'メモ',
];

const MINIMAL_HEADERS = ['姓', '名', 'メールアドレス'];

/**
 * CSVファイルを解析して行データに変換
 */
export async function parseStaffCSV(file: File): Promise<{ rows: ParsedCSVRow[]; detectedMode: 'full' | 'minimal' }> {
  const text = await file.text();
  // BOM除去
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error('CSVファイルにデータがありません（ヘッダー行 + 1行以上のデータが必要です）');
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // ヘッダーからモード自動検出
  const detectedMode = headers.length > 5 ? 'full' : 'minimal';

  const rows: ParsedCSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every(v => v.trim() === '')) continue; // 空行スキップ

    if (detectedMode === 'full') {
      rows.push({
        rowIndex: i,
        lastName: values[0]?.trim() || '',
        firstName: values[1]?.trim() || '',
        lastNameKana: values[2]?.trim() || undefined,
        firstNameKana: values[3]?.trim() || undefined,
        email: values[4]?.trim() || undefined,
        phone: values[5]?.trim() || undefined,
        birthDate: values[6]?.trim() || undefined,
        gender: values[7]?.trim() || undefined,
        facilityRole: values[8]?.trim() || undefined,
        employmentType: values[9]?.trim() || undefined,
        startDate: values[10]?.trim() || undefined,
        qualifications: values[11]?.trim() || undefined,
        monthlySalary: values[12]?.trim() || undefined,
        hourlyWage: values[13]?.trim() || undefined,
        memo: values[14]?.trim() || undefined,
      });
    } else {
      rows.push({
        rowIndex: i,
        lastName: values[0]?.trim() || '',
        firstName: values[1]?.trim() || '',
        email: values[2]?.trim() || undefined,
      });
    }
  }

  return { rows, detectedMode };
}

/**
 * CSV行をパース（ダブルクォート対応）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ---- バリデーション ----

import { isValidEmail } from '@/utils/validation';
const EMAIL_REGEX = { test: (v: string) => isValidEmail(v) };
const DATE_REGEX = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;

/**
 * CSVの行データをバリデーション
 */
export function validateCSVRows(
  rows: ParsedCSVRow[],
  mode: 'full' | 'minimal'
): ValidationResult {
  const errors: RowValidationError[] = [];
  const validRows: ParsedCSVRow[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const rowErrors: RowValidationError[] = [];

    // 共通: 姓名は必須
    if (!row.lastName) {
      rowErrors.push({ rowIndex: row.rowIndex, field: '姓', message: '姓は必須です' });
    }
    if (!row.firstName) {
      rowErrors.push({ rowIndex: row.rowIndex, field: '名', message: '名は必須です' });
    }

    // 簡易モード: メールアドレス必須
    if (mode === 'minimal' && !row.email) {
      rowErrors.push({ rowIndex: row.rowIndex, field: 'メールアドレス', message: '簡易モードではメールアドレスが必須です' });
    }

    // メールアドレス形式チェック
    if (row.email) {
      if (!EMAIL_REGEX.test(row.email)) {
        rowErrors.push({ rowIndex: row.rowIndex, field: 'メールアドレス', message: 'メールアドレスの形式が正しくありません' });
      } else if (seenEmails.has(row.email.toLowerCase())) {
        rowErrors.push({ rowIndex: row.rowIndex, field: 'メールアドレス', message: 'メールアドレスが重複しています' });
      } else {
        seenEmails.add(row.email.toLowerCase());
      }
    }

    // フルモード固有チェック
    if (mode === 'full') {
      if (row.birthDate && !DATE_REGEX.test(row.birthDate)) {
        rowErrors.push({ rowIndex: row.rowIndex, field: '生年月日', message: '日付形式が正しくありません（YYYY-MM-DD）' });
      }
      if (row.startDate && !DATE_REGEX.test(row.startDate)) {
        rowErrors.push({ rowIndex: row.rowIndex, field: '入職日', message: '日付形式が正しくありません（YYYY-MM-DD）' });
      }
      if (row.gender && !['男性', '女性', 'その他', 'male', 'female', 'other'].includes(row.gender)) {
        rowErrors.push({ rowIndex: row.rowIndex, field: '性別', message: '性別は「男性」「女性」「その他」のいずれかを入力してください' });
      }
      if (row.monthlySalary && isNaN(Number(row.monthlySalary))) {
        rowErrors.push({ rowIndex: row.rowIndex, field: '月給', message: '月給は数値で入力してください' });
      }
      if (row.hourlyWage && isNaN(Number(row.hourlyWage))) {
        rowErrors.push({ rowIndex: row.rowIndex, field: '時給', message: '時給は数値で入力してください' });
      }
    }

    if (rowErrors.length === 0) {
      validRows.push(row);
    }
    errors.push(...rowErrors);
  }

  return {
    isValid: errors.length === 0,
    validRows,
    errors,
  };
}

// ---- 一括インポート実行 ----

/**
 * 性別文字列を内部形式に変換
 */
function normalizeGender(gender?: string): 'male' | 'female' | 'other' | undefined {
  if (!gender) return undefined;
  const map: Record<string, 'male' | 'female' | 'other'> = {
    '男性': 'male', '女性': 'female', 'その他': 'other',
    'male': 'male', 'female': 'female', 'other': 'other',
  };
  return map[gender] || undefined;
}

/**
 * 一括インポート実行
 * full → createProxyAccount() をループ
 * minimal → inviteStaff (staff_invitations) をループ
 */
export async function executeBulkImport(
  facilityId: string,
  rows: ParsedCSVRow[],
  importType: 'full' | 'minimal',
  userId?: string,
): Promise<BulkImportResult> {
  // バッチ記録を作成
  const { data: batch } = await supabase
    .from('bulk_import_batches')
    .insert({
      facility_id: facilityId,
      import_type: importType,
      total_rows: rows.length,
      status: 'processing',
      created_by: userId,
    })
    .select('id')
    .single();

  const batchId = batch?.id || `batch-${Date.now()}`;
  const results: BulkImportRowResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  const errorDetails: Array<{ rowIndex: number; error: string }> = [];

  for (const row of rows) {
    try {
      const name = `${row.lastName} ${row.firstName}`.trim();

      if (importType === 'full') {
        // フルモード: 代理アカウント作成
        const proxyData: ProxyAccountData = {
          facilityId,
          name,
          lastName: row.lastName,
          firstName: row.firstName,
          lastNameKana: row.lastNameKana,
          firstNameKana: row.firstNameKana,
          nameKana: row.lastNameKana && row.firstNameKana
            ? `${row.lastNameKana} ${row.firstNameKana}`
            : undefined,
          email: row.email,
          phone: row.phone,
          birthDate: row.birthDate?.replace(/\//g, '-'),
          gender: normalizeGender(row.gender),
          role: (row.facilityRole as any) || '一般スタッフ',
          employmentType: (row.employmentType as any) || '常勤',
          startDate: row.startDate?.replace(/\//g, '-') || new Date().toISOString().split('T')[0],
          qualifications: row.qualifications ? row.qualifications.split(',').map(q => q.trim()).filter(Boolean) : undefined,
          monthlySalary: row.monthlySalary ? Number(row.monthlySalary) : undefined,
          hourlyWage: row.hourlyWage ? Number(row.hourlyWage) : undefined,
          memo: row.memo,
        };

        const result = await createProxyAccount(facilityId, proxyData);
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const activationUrl = `${baseUrl}/facility/join?token=${result.invitationToken}`;

        results.push({
          rowIndex: row.rowIndex,
          success: true,
          name,
          email: row.email,
          invitationToken: result.invitationToken,
          activationUrl,
        });
        successCount++;
      } else {
        // 簡易モード: staff_invitations に作成
        const token = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const { error } = await supabase.from('staff_invitations').insert({
          facility_id: facilityId,
          email: row.email!,
          name,
          token,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        if (error) throw error;

        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const activationUrl = `${baseUrl}/facility/join?token=${token}`;

        results.push({
          rowIndex: row.rowIndex,
          success: true,
          name,
          email: row.email,
          invitationToken: token,
          activationUrl,
        });
        successCount++;
      }
    } catch (err: any) {
      const errorMsg = err.message || '不明なエラー';
      results.push({
        rowIndex: row.rowIndex,
        success: false,
        name: `${row.lastName} ${row.firstName}`.trim(),
        email: row.email,
        error: errorMsg,
      });
      errorCount++;
      errorDetails.push({ rowIndex: row.rowIndex, error: errorMsg });
    }
  }

  // バッチ記録を更新
  await supabase
    .from('bulk_import_batches')
    .update({
      success_count: successCount,
      error_count: errorCount,
      status: errorCount === rows.length ? 'failed' : 'completed',
      error_details: errorDetails,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  return {
    batchId,
    totalRows: rows.length,
    successCount,
    errorCount,
    results,
  };
}

// ---- テンプレートCSVダウンロード ----

/**
 * CSVテンプレートをダウンロード
 */
export function downloadCSVTemplate(type: 'full' | 'minimal'): void {
  const headers = type === 'full' ? FULL_HEADERS : MINIMAL_HEADERS;

  let sampleData: string[];
  if (type === 'full') {
    sampleData = [
      '山田,太郎,ヤマダ,タロウ,yamada@example.com,090-1234-5678,1990-01-15,男性,児童指導員,常勤,2026-04-01,保育士,250000,,入職予定',
    ];
  } else {
    sampleData = [
      '山田,太郎,yamada@example.com',
    ];
  }

  const csvContent = [headers.join(','), ...sampleData].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = type === 'full'
    ? 'スタッフ一括登録テンプレート_フル.csv'
    : 'スタッフ一括登録テンプレート_簡易.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * インポート結果をCSVでダウンロード
 */
export function downloadImportResultCSV(results: BulkImportRowResult[]): void {
  const headers = ['行番号', '名前', 'メールアドレス', '結果', 'アクティベーションURL', 'エラー'];
  const rows = results.map(r => [
    String(r.rowIndex),
    r.name,
    r.email || '',
    r.success ? '成功' : '失敗',
    r.activationUrl || '',
    r.error || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `一括登録結果_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
