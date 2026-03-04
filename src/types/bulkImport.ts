/**
 * 一括登録・招待リンク型定義
 */

// CSV解析結果の1行
export interface ParsedCSVRow {
  rowIndex: number;
  lastName: string;
  firstName: string;
  lastNameKana?: string;
  firstNameKana?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  facilityRole?: string;
  employmentType?: string;
  startDate?: string;
  qualifications?: string;
  monthlySalary?: string;
  hourlyWage?: string;
  memo?: string;
}

// バリデーション結果
export interface RowValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  validRows: ParsedCSVRow[];
  errors: RowValidationError[];
}

// 一括インポート結果
export interface BulkImportRowResult {
  rowIndex: number;
  success: boolean;
  name: string;
  email?: string;
  invitationToken?: string;
  activationUrl?: string;
  error?: string;
}

export interface BulkImportResult {
  batchId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  results: BulkImportRowResult[];
}

// 施設招待リンク
export interface FacilityInviteLink {
  id: string;
  facilityId: string;
  code: string;
  label?: string;
  isActive: boolean;
  maxUses?: number;
  useCount: number;
  defaultRole: string;
  defaultEmploymentType: string;
  expiresAt?: string;
  createdBy?: string;
  createdAt: string;
}

// 一括インポートバッチ
export interface BulkImportBatch {
  id: string;
  facilityId: string;
  importType: 'full' | 'minimal';
  totalRows: number;
  successCount: number;
  errorCount: number;
  status: 'processing' | 'completed' | 'failed';
  errorDetails: Array<{ rowIndex: number; error: string }>;
  createdBy?: string;
  createdAt: string;
  completedAt?: string;
}
