/**
 * 経費管理・経営分析機能の型定義
 */

// 経費ステータス
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

// 経費カテゴリ
export type ExpenseCategory = {
  id: string;
  facilityId: string | null;
  name: string;
  parentId: string | null;
  keywords: string[];
  icon: string;
  color: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

// 経費トランザクション
export type Expense = {
  id: string;
  facilityId: string;
  staffId: string;
  submittedByUserId: string;

  // 基本情報
  title: string;
  amount: number;
  expenseDate: string;

  // カテゴリ
  category: string;
  subcategory?: string;

  // 詳細
  description?: string;
  receiptUrl?: string;
  receiptFileName?: string;
  receiptFileSize?: number;

  // 承認フロー
  status: ExpenseStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;

  // メタ
  createdAt: string;
  updatedAt: string;

  // JOINデータ（オプション）
  staffName?: string;
  approverName?: string;
};

// 新規経費申請フォーム
export type ExpenseFormData = {
  title: string;
  amount: number;
  expenseDate: string;
  category: string;
  subcategory?: string;
  description?: string;
  receiptFile?: File;
};

// 月次財務サマリー
export type MonthlyFinancial = {
  id: string;
  facilityId: string;
  year: number;
  month: number;

  // 収入
  revenueService: number;
  revenueOther: number;

  // 支出
  expensePersonnel: number;
  expenseFixed: number;
  expenseVariable: number;
  expenseOther: number;

  // 計算値
  grossProfit: number;
  operatingProfit: number;
  netCashFlow: number;

  // 予算
  budgetRevenue?: number;
  budgetExpense?: number;

  // 確定フラグ
  isFinalized: boolean;
  finalizedAt?: string;
  finalizedBy?: string;

  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// 損益計算書の行項目
export type ProfitLossLineItem = {
  label: string;
  category: 'revenue' | 'cost' | 'expense' | 'profit';
  isSubtotal?: boolean;
  isTotal?: boolean;
  indent?: number;
  values: Record<number, number>; // month -> amount
  yearTotal: number;
};

// 損益計算書データ
export type ProfitLossData = {
  fiscalYear: number;
  lines: ProfitLossLineItem[];
  budgetComparison?: {
    budget: Record<number, number>;
    variance: Record<number, number>;
    achievementRate: Record<number, number>;
  };
  yearOverYear?: {
    previousYear: Record<number, number>;
    change: Record<number, number>;
    changeRate: Record<number, number>;
  };
};

// キャッシュフローデータ
export type CashFlowData = {
  fiscalYear: number;
  months: CashFlowMonth[];
};

export type CashFlowMonth = {
  month: number;
  revenue: number;
  expense: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  previousYearCashFlow?: number;
};

// 経費サマリー（カテゴリ別集計）
export type ExpenseSummary = {
  category: string;
  categoryName: string;
  count: number;
  totalAmount: number;
  approvedCount: number;
  approvedAmount: number;
  pendingCount: number;
  pendingAmount: number;
};

// 経費承認統計
export type ExpenseApprovalStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
};

// カテゴリ分類結果
export type CategoryClassification = {
  categoryId: string;
  categoryName: string;
  confidence: number;
};
