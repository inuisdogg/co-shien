/**
 * 請求ウィザード用フック
 * useBilling をラップし、ステップごとのバリデーション・検証機能を追加する
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useBilling } from '@/hooks/useBilling';

// ─── 上限月額の区分定数（useBilling.ts と同一） ───
const UPPER_LIMIT_MAP: Record<string, number> = {
  general: 37200,      // 一般（年収890万円超）
  general_low: 4600,   // 一般（年収890万円以下）
  low_income: 0,       // 低所得
  welfare: 0,          // 生活保護
};

// ─── ローカル型定義 ───

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationItem = {
  severity: ValidationSeverity;
  message: string;
  childId?: string;
  childName?: string;
  date?: string;
};

export type ChildUsageSummary = {
  childId: string;
  childName: string;
  usageDays: number;
  billingDays: number;
  excludedDays: number;
  hasIncomeCategory: boolean;
  incomeCategory?: string;
  missingTimes: string[];  // dates with missing actual_start_time or actual_end_time
  hasBeneficiaryNumber: boolean;
};

export type UsageVerificationResult = {
  totalDays: number;
  recordedDays: number;
  billingTargetDays: number;
  excludedDays: number;
  childCount: number;
  completionRate: number;
  validations: ValidationItem[];
  childSummaries: ChildUsageSummary[];
};

export type UpperLimitChildResult = {
  childId: string;
  childName: string;
  incomeCategory: string;
  upperLimitAmount: number;
  calculatedCopay: number;
  appliedCopay: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
  percentOfLimit: number;
};

export type UpperLimitCheckResult = {
  children: UpperLimitChildResult[];
  totalCopay: number;
  totalInsurance: number;
  validations: ValidationItem[];
};

export type MonthlyBillingStatus = {
  hasRecords: boolean;
  draftCount: number;
  confirmedCount: number;
  submittedCount: number;
  paidCount: number;
  totalAmount: number;
  usageRecordCount: number;
};

// ─── ヘルパー関数 ───

/** 対象月の初日を返す */
function getFirstDayOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

/** 対象月の末日を返す */
function getLastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;
}

/** 対象月のカレンダー日数を返す */
function getDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

// ─── メインフック ───

export const useBillingWizard = () => {
  const billing = useBilling();

  // ─── 利用実績の検証 ───
  const fetchUsageVerification = useCallback(
    async (facilityId: string, yearMonth: string): Promise<UsageVerificationResult> => {
      try {
        const firstDay = getFirstDayOfMonth(yearMonth);
        const lastDay = getLastDayOfMonth(yearMonth);
        const totalDays = getDaysInMonth(yearMonth);

        // 1. 利用実績を取得
        const { data: usageData, error: usageError } = await supabase
          .from('usage_records')
          .select('*')
          .eq('facility_id', facilityId)
          .gte('date', firstDay)
          .lte('date', lastDay);

        if (usageError) {
          return {
            totalDays,
            recordedDays: 0,
            billingTargetDays: 0,
            excludedDays: 0,
            childCount: 0,
            completionRate: 0,
            validations: [{
              severity: 'error',
              message: '利用実績の取得に失敗しました',
            }],
            childSummaries: [],
          };
        }

        const usageRecords = usageData || [];

        // 2. 施設に所属する児童マスタを取得
        const { data: childrenData, error: childrenError } = await supabase
          .from('children')
          .select('id, name, income_category, beneficiary_number')
          .eq('facility_id', facilityId);

        if (childrenError) {
          return {
            totalDays,
            recordedDays: 0,
            billingTargetDays: 0,
            excludedDays: 0,
            childCount: 0,
            completionRate: 0,
            validations: [{
              severity: 'error',
              message: '児童マスタの取得に失敗しました',
            }],
            childSummaries: [],
          };
        }

        const children = childrenData || [];
        const childMap = new Map(
          children.map((c: Record<string, unknown>) => [c.id as string, c])
        );

        // 3. 利用実績を児童ごとにグルーピング
        const childUsageMap = new Map<string, Array<Record<string, unknown>>>();
        for (const record of usageRecords) {
          const childId = record.child_id as string;
          if (!childUsageMap.has(childId)) {
            childUsageMap.set(childId, []);
          }
          childUsageMap.get(childId)!.push(record);
        }

        // 4. 集計
        const allDates = new Set(usageRecords.map((r: Record<string, unknown>) => r.date as string));
        const recordedDays = allDates.size;

        let billingTargetDays = 0;
        let excludedDays = 0;

        for (const record of usageRecords) {
          if (record.billing_target === '請求する') {
            billingTargetDays++;
          } else {
            excludedDays++;
          }
        }

        const completionRate = totalDays > 0
          ? Math.round((recordedDays / totalDays) * 100)
          : 0;

        // 5. バリデーション生成
        const validations: ValidationItem[] = [];

        // ERROR: 利用実績が0件
        if (usageRecords.length === 0) {
          validations.push({
            severity: 'error',
            message: `${yearMonth} の利用実績が0件です`,
          });
        }

        // 6. 児童別サマリー構築
        const childSummaries: ChildUsageSummary[] = [];

        // 利用実績がある児童のIDを収集
        const childIdsWithUsage = new Set(childUsageMap.keys());

        // 全児童を走査（利用実績がない児童も含む）
        for (const child of children) {
          const childId = child.id as string;
          const childName = child.name as string;
          const incomeCategory = child.income_category as string | null;
          const beneficiaryNumber = child.beneficiary_number as string | null;
          const usages = childUsageMap.get(childId) || [];

          let childBillingDays = 0;
          let childExcludedDays = 0;
          const missingTimes: string[] = [];

          for (const usage of usages) {
            const bt = usage.billing_target as string;
            if (bt === '請求する') {
              childBillingDays++;

              // WARNING: 請求対象なのに実績時刻が欠けている
              const actualStart = usage.actual_start_time as string | null;
              const actualEnd = usage.actual_end_time as string | null;
              if (!actualStart || !actualEnd) {
                const dateStr = usage.date as string;
                missingTimes.push(dateStr);
                validations.push({
                  severity: 'warning',
                  message: `${childName}：${dateStr} の実績時刻が未入力です（請求対象）`,
                  childId,
                  childName,
                  date: dateStr,
                });
              }
            } else {
              childExcludedDays++;
            }
          }

          // ERROR: 所得区分未設定
          if (!incomeCategory) {
            validations.push({
              severity: 'error',
              message: `${childName}：所得区分が設定されていません`,
              childId,
              childName,
            });
          }

          // WARNING: 受給者証番号未設定
          if (!beneficiaryNumber) {
            validations.push({
              severity: 'warning',
              message: `${childName}：受給者証番号が設定されていません`,
              childId,
              childName,
            });
          }

          childSummaries.push({
            childId,
            childName,
            usageDays: usages.length,
            billingDays: childBillingDays,
            excludedDays: childExcludedDays,
            hasIncomeCategory: !!incomeCategory,
            incomeCategory: incomeCategory || undefined,
            missingTimes,
            hasBeneficiaryNumber: !!beneficiaryNumber,
          });
        }

        // 利用実績はあるが児童マスタにない child_id があればスキップ（不整合）
        for (const childId of childIdsWithUsage) {
          if (!childMap.has(childId)) {
            validations.push({
              severity: 'error',
              message: `child_id=${childId} の利用実績がありますが、児童マスタに存在しません`,
              childId,
            });
          }
        }

        // INFO: 請求対象外の日数
        if (excludedDays > 0) {
          validations.push({
            severity: 'info',
            message: `${excludedDays}日分が「請求しない」に設定されています`,
          });
        }

        return {
          totalDays,
          recordedDays,
          billingTargetDays,
          excludedDays,
          childCount: childSummaries.length,
          completionRate,
          validations,
          childSummaries,
        };
      } catch {
        return {
          totalDays: 0,
          recordedDays: 0,
          billingTargetDays: 0,
          excludedDays: 0,
          childCount: 0,
          completionRate: 0,
          validations: [{
            severity: 'error',
            message: '利用実績の検証中にエラーが発生しました',
          }],
          childSummaries: [],
        };
      }
    },
    []
  );

  // ─── 上限額管理チェック ───
  const fetchUpperLimitCheck = useCallback(
    async (facilityId: string, yearMonth: string): Promise<UpperLimitCheckResult> => {
      try {
        // 1. 対象月の請求レコードを取得
        const { data: recordsData, error: recordsError } = await supabase
          .from('billing_records')
          .select('*, children(id, name, income_category)')
          .eq('facility_id', facilityId)
          .eq('year_month', yearMonth);

        if (recordsError) {
          return {
            children: [],
            totalCopay: 0,
            totalInsurance: 0,
            validations: [{
              severity: 'error',
              message: '請求レコードの取得に失敗しました',
            }],
          };
        }

        const records = recordsData || [];

        if (records.length === 0) {
          return {
            children: [],
            totalCopay: 0,
            totalInsurance: 0,
            validations: [{
              severity: 'info',
              message: '対象月の請求レコードがありません',
            }],
          };
        }

        // 2. 児童ごとに上限額チェック
        const childResults: UpperLimitChildResult[] = [];
        const validations: ValidationItem[] = [];
        let totalCopay = 0;
        let totalInsurance = 0;

        for (const record of records) {
          const childData = record.children as Record<string, unknown> | null;
          const childId = (childData?.id as string) || (record.child_id as string);
          const childName = (childData?.name as string) || '不明';
          const incomeCategory = (childData?.income_category as string) || 'general';
          const upperLimitAmount = UPPER_LIMIT_MAP[incomeCategory] ?? 37200;
          const recordTotalAmount = (record.total_amount as number) || 0;
          const copayAmount = (record.copay_amount as number) || 0;

          // 10%計算による利用者負担
          const calculatedCopay = Math.floor(recordTotalAmount * 0.1);

          // 実際に適用された利用者負担
          const appliedCopay = copayAmount;

          // 上限到達・接近判定
          const isAtLimit = upperLimitAmount > 0 && appliedCopay >= upperLimitAmount;
          const isNearLimit = upperLimitAmount > 0 && appliedCopay > upperLimitAmount * 0.8;
          const percentOfLimit = upperLimitAmount > 0
            ? Math.round((appliedCopay / upperLimitAmount) * 100)
            : 0;

          childResults.push({
            childId,
            childName,
            incomeCategory,
            upperLimitAmount,
            calculatedCopay,
            appliedCopay,
            isAtLimit,
            isNearLimit,
            percentOfLimit,
          });

          totalCopay += appliedCopay;
          totalInsurance += (record.insurance_amount as number) || 0;

          // バリデーション: 上限到達
          if (isAtLimit) {
            validations.push({
              severity: 'warning',
              message: `${childName}：利用者負担額が上限月額（${upperLimitAmount.toLocaleString()}円）に到達しています`,
              childId,
              childName,
            });
          } else if (isNearLimit) {
            validations.push({
              severity: 'info',
              message: `${childName}：利用者負担額が上限月額の${percentOfLimit}%に達しています（${appliedCopay.toLocaleString()}円 / ${upperLimitAmount.toLocaleString()}円）`,
              childId,
              childName,
            });
          }

          // バリデーション: 低所得・生活保護で負担額が発生
          if ((incomeCategory === 'low_income' || incomeCategory === 'welfare') && appliedCopay > 0) {
            validations.push({
              severity: 'error',
              message: `${childName}：${incomeCategory === 'low_income' ? '低所得' : '生活保護'}区分ですが利用者負担額（${appliedCopay.toLocaleString()}円）が発生しています`,
              childId,
              childName,
            });
          }
        }

        return {
          children: childResults,
          totalCopay,
          totalInsurance,
          validations,
        };
      } catch {
        return {
          children: [],
          totalCopay: 0,
          totalInsurance: 0,
          validations: [{
            severity: 'error',
            message: '上限額チェック中にエラーが発生しました',
          }],
        };
      }
    },
    []
  );

  // ─── 月次請求ステータス取得 ───
  const getMonthlyBillingStatus = useCallback(
    async (facilityId: string, yearMonth: string): Promise<MonthlyBillingStatus> => {
      try {
        const firstDay = getFirstDayOfMonth(yearMonth);
        const lastDay = getLastDayOfMonth(yearMonth);

        // 1. 請求レコードをステータス別に集計
        const { data: billingData, error: billingError } = await supabase
          .from('billing_records')
          .select('status, total_amount')
          .eq('facility_id', facilityId)
          .eq('year_month', yearMonth);

        if (billingError) {
          return {
            hasRecords: false,
            draftCount: 0,
            confirmedCount: 0,
            submittedCount: 0,
            paidCount: 0,
            totalAmount: 0,
            usageRecordCount: 0,
          };
        }

        const billingRecords = billingData || [];

        let draftCount = 0;
        let confirmedCount = 0;
        let submittedCount = 0;
        let paidCount = 0;
        let totalAmount = 0;

        for (const record of billingRecords) {
          const status = record.status as string;
          const amount = (record.total_amount as number) || 0;
          totalAmount += amount;

          switch (status) {
            case 'draft':
              draftCount++;
              break;
            case 'confirmed':
              confirmedCount++;
              break;
            case 'submitted':
              submittedCount++;
              break;
            case 'paid':
              paidCount++;
              break;
          }
        }

        // 2. 利用実績の件数を取得
        const { count: usageCount, error: usageError } = await supabase
          .from('usage_records')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .gte('date', firstDay)
          .lte('date', lastDay);

        const usageRecordCount = usageError ? 0 : (usageCount || 0);

        return {
          hasRecords: billingRecords.length > 0,
          draftCount,
          confirmedCount,
          submittedCount,
          paidCount,
          totalAmount,
          usageRecordCount,
        };
      } catch {
        return {
          hasRecords: false,
          draftCount: 0,
          confirmedCount: 0,
          submittedCount: 0,
          paidCount: 0,
          totalAmount: 0,
          usageRecordCount: 0,
        };
      }
    },
    []
  );

  // ─── 返却値 ───
  return {
    ...billing,
    fetchUsageVerification,
    fetchUpperLimitCheck,
    getMonthlyBillingStatus,
  };
};
