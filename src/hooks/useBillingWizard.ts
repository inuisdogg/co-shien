/**
 * 請求ウィザード用フック（完全版）
 * useBilling をラップし、ステップごとのバリデーション・検証機能を追加する
 *
 * - 利用実績の検証（時刻・所得区分・受給者証）
 * - 施設設定の検証（地域区分・定員・加算届出）
 * - 上限額管理チェック
 * - 月次請求ステータス管理
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
  actionLabel?: string;   // 「設定画面へ」等のアクションラベル
  actionPath?: string;    // アクションのリンク先
};

export type ChildUsageSummary = {
  childId: string;
  childName: string;
  usageDays: number;
  billingDays: number;
  excludedDays: number;
  hasIncomeCategory: boolean;
  incomeCategory?: string;
  missingTimes: string[];
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

export type FacilityBillingReadiness = {
  isReady: boolean;
  hasRegionalGrade: boolean;
  regionalGrade?: string;
  unitPrice?: number;
  hasCapacity: boolean;
  capacity?: number;
  hasServiceType: boolean;
  serviceTypeCode?: string;
  enabledAdditionCount: number;
  validations: ValidationItem[];
};

// ─── ヘルパー関数 ───

function getFirstDayOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

function getLastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;
}

function getDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

// ─── メインフック ───

export const useBillingWizard = () => {
  const billing = useBilling();

  // ─── 施設の請求準備状態を検証 ───
  const checkFacilityReadiness = useCallback(
    async (facilityId: string): Promise<FacilityBillingReadiness> => {
      const validations: ValidationItem[] = [];

      try {
        // 施設設定を取得
        const { data: settings } = await supabase
          .from('facility_settings')
          .select('regional_grade, capacity, service_type_code')
          .eq('facility_id', facilityId)
          .single();

        const regionalGrade = (settings?.regional_grade as string) || null;
        const capacityVal = (settings?.capacity as number) || null;
        const serviceTypeCode = (settings?.service_type_code as string) || null;

        // 地域区分の検証
        let unitPrice: number | undefined;
        if (!regionalGrade) {
          validations.push({
            severity: 'error',
            message: '地域区分が設定されていません。正確な単位単価を算出できません（デフォルト10円で計算されます）',
            actionLabel: '施設設定へ',
            actionPath: '/settings',
          });
        } else {
          // 単位単価を取得
          const { data: regionData } = await supabase
            .from('regional_units')
            .select('unit_price')
            .eq('grade', regionalGrade)
            .single();

          unitPrice = regionData?.unit_price ? Number(regionData.unit_price) : undefined;

          if (!unitPrice) {
            validations.push({
              severity: 'warning',
              message: `地域区分「${regionalGrade}」に対応する単位単価がマスタに存在しません`,
            });
          }
        }

        // 定員の検証
        if (!capacityVal || capacityVal <= 0) {
          validations.push({
            severity: 'warning',
            message: '定員が設定されていません。基本報酬の区分判定に影響する可能性があります（デフォルト10名で計算）',
            actionLabel: '施設設定へ',
            actionPath: '/settings',
          });
        }

        // サービス種別の検証
        if (!serviceTypeCode) {
          validations.push({
            severity: 'info',
            message: 'サービス種別コードが未設定です。利用実績の時間帯からサービス種別を自動推定します',
          });
        }

        // 加算設定の確認
        const { count: additionCount } = await supabase
          .from('facility_addition_settings')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .eq('is_enabled', true);

        const enabledAdditions = additionCount || 0;

        if (enabledAdditions === 0) {
          validations.push({
            severity: 'info',
            message: '有効な加算設定がありません。加算を算定する場合は加算設定画面で有効化してください',
            actionLabel: '加算設定へ',
            actionPath: '/addition-settings',
          });
        }

        const isReady = !validations.some((v) => v.severity === 'error');

        return {
          isReady,
          hasRegionalGrade: !!regionalGrade,
          regionalGrade: regionalGrade || undefined,
          unitPrice,
          hasCapacity: !!capacityVal && capacityVal > 0,
          capacity: capacityVal || undefined,
          hasServiceType: !!serviceTypeCode,
          serviceTypeCode: serviceTypeCode || undefined,
          enabledAdditionCount: enabledAdditions,
          validations,
        };
      } catch {
        return {
          isReady: false,
          hasRegionalGrade: false,
          hasCapacity: false,
          hasServiceType: false,
          enabledAdditionCount: 0,
          validations: [{
            severity: 'error',
            message: '施設設定の取得に失敗しました',
          }],
        };
      }
    },
    []
  );

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

        if (usageRecords.length === 0) {
          validations.push({
            severity: 'error',
            message: `${yearMonth} の利用実績が0件です`,
          });
        }

        // 6. 児童別サマリー構築
        const childSummaries: ChildUsageSummary[] = [];
        const childIdsWithUsage = new Set(childUsageMap.keys());

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

              const actualStart = usage.actual_start_time as string | null;
              const actualEnd = usage.actual_end_time as string | null;
              if (!actualStart || !actualEnd) {
                const dateStr = usage.date as string;
                missingTimes.push(dateStr);
                validations.push({
                  severity: 'warning',
                  message: `${childName}：${dateStr} の実績時刻が未入力です（請求対象）。時間区分による基本報酬の正確な算定ができません`,
                  childId,
                  childName,
                  date: dateStr,
                });
              } else {
                // 時間区分の整合性チェック
                const [sh, sm] = actualStart.split(':').map(Number);
                const [eh, em] = actualEnd.split(':').map(Number);
                const minutes = (eh * 60 + em) - (sh * 60 + sm);

                if (minutes < 30) {
                  const dateStr = usage.date as string;
                  validations.push({
                    severity: 'warning',
                    message: `${childName}：${dateStr} のサービス提供時間が30分未満（${minutes}分）です。基本報酬の最低区分は30分以上です`,
                    childId,
                    childName,
                    date: dateStr,
                  });
                }

                if (minutes > 600) {
                  const dateStr = usage.date as string;
                  validations.push({
                    severity: 'info',
                    message: `${childName}：${dateStr} のサービス提供時間が10時間以上（${Math.floor(minutes / 60)}時間${minutes % 60}分）です。入力に誤りがないか確認してください`,
                    childId,
                    childName,
                    date: dateStr,
                  });
                }
              }
            } else {
              childExcludedDays++;
            }
          }

          // 利用実績があるのに所得区分未設定
          if (usages.length > 0 && childBillingDays > 0 && !incomeCategory) {
            validations.push({
              severity: 'error',
              message: `${childName}：所得区分が設定されていません。請求額の計算に必須です`,
              childId,
              childName,
              actionLabel: '児童情報へ',
            });
          }

          // 利用実績があるのに受給者証番号未設定
          if (usages.length > 0 && childBillingDays > 0 && !beneficiaryNumber) {
            validations.push({
              severity: 'warning',
              message: `${childName}：受給者証番号が設定されていません。国保連CSVに出力できません`,
              childId,
              childName,
              actionLabel: '児童情報へ',
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

        // 児童マスタにない利用実績
        for (const childId of childIdsWithUsage) {
          if (!childMap.has(childId)) {
            validations.push({
              severity: 'error',
              message: `child_id=${childId} の利用実績がありますが、児童マスタに存在しません`,
              childId,
            });
          }
        }

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
              message: '対象月の請求レコードがありません。先に請求データを生成してください',
            }],
          };
        }

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

          const calculatedCopay = Math.floor(recordTotalAmount * 0.1);
          const appliedCopay = copayAmount;

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

          if (isAtLimit) {
            validations.push({
              severity: 'warning',
              message: `${childName}：利用者負担額が上限月額（${upperLimitAmount.toLocaleString()}円）に到達しています。上限管理結果票の作成が必要です`,
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

          if ((incomeCategory === 'low_income' || incomeCategory === 'welfare') && appliedCopay > 0) {
            validations.push({
              severity: 'error',
              message: `${childName}：${incomeCategory === 'low_income' ? '低所得' : '生活保護'}区分ですが利用者負担額（${appliedCopay.toLocaleString()}円）が発生しています。所得区分の設定を確認してください`,
              childId,
              childName,
            });
          }

          // 単位単価の整合性チェック
          const recordUnitPrice = (record.unit_price as number) || 0;
          if (recordUnitPrice === 10) {
            validations.push({
              severity: 'info',
              message: `${childName}：単位単価が10.00円（デフォルト値）です。地域区分が正しく設定されているか確認してください`,
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
    checkFacilityReadiness,
    fetchUsageVerification,
    fetchUpperLimitCheck,
    getMonthlyBillingStatus,
  };
};
