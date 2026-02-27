/**
 * 国保連請求データ管理フック
 * billing_records / billing_details / service_codes テーブルの取得・CRUD操作
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  BillingRecord,
  BillingDetail,
  BillingAddition,
  ServiceCode,
  BillingStatus,
} from '@/types';

// 上限月額の区分定数
const UPPER_LIMIT_MAP: Record<string, number> = {
  general: 37200,      // 一般（年収890万円超）
  general_low: 4600,   // 一般（年収890万円以下）
  low_income: 0,       // 低所得
  welfare: 0,          // 生活保護
};

// 地域区分に応じた単位単価（1単位あたりの円単価） - デフォルトは10円
const DEFAULT_UNIT_PRICE = 10;

export const useBilling = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetail[]>([]);
  const [serviceCodes, setServiceCodes] = useState<ServiceCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── サービスコード取得 ───
  const fetchServiceCodes = useCallback(async (): Promise<ServiceCode[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('service_codes')
        .select('*')
        .order('code', { ascending: true });

      if (fetchError) {
        console.error('Error fetching service codes:', fetchError);
        return [];
      }

      const codes: ServiceCode[] = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        code: row.code as string,
        name: row.name as string,
        category: row.category as string,
        baseUnits: (row.base_units as number) || 0,
        description: (row.description as string) || undefined,
        effectiveFrom: (row.effective_from as string) || undefined,
        effectiveTo: (row.effective_to as string) || undefined,
        createdAt: row.created_at as string,
      }));
      setServiceCodes(codes);
      return codes;
    } catch (err) {
      console.error('Error in fetchServiceCodes:', err);
      return [];
    }
  }, []);

  // ─── 月次請求レコード取得 ───
  const fetchBillingRecords = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<BillingRecord[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('billing_records')
          .select('*, children(name)')
          .eq('facility_id', targetFacilityId)
          .eq('year_month', yearMonth)
          .order('created_at', { ascending: true });

        if (fetchError) {
          setError('請求データの取得に失敗しました');
          console.error('Error fetching billing records:', fetchError);
          return [];
        }

        const records: BillingRecord[] = (data || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          facilityId: row.facility_id as string,
          childId: row.child_id as string,
          yearMonth: row.year_month as string,
          serviceType: row.service_type as string,
          totalUnits: (row.total_units as number) || 0,
          unitPrice: (row.unit_price as number) || 0,
          totalAmount: (row.total_amount as number) || 0,
          copayAmount: (row.copay_amount as number) || 0,
          insuranceAmount: (row.insurance_amount as number) || 0,
          upperLimitAmount: (row.upper_limit_amount as number) || 0,
          status: (row.status as BillingStatus) || 'draft',
          submittedAt: (row.submitted_at as string) || undefined,
          notes: (row.notes as string) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
          childName: (row.children as Record<string, unknown> | null)?.name as string | undefined,
        }));

        setBillingRecords(records);
        return records;
      } catch (err) {
        setError('請求データの取得中にエラーが発生しました');
        console.error('Error in fetchBillingRecords:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ─── 請求明細取得 ───
  const fetchBillingDetails = useCallback(
    async (billingRecordId: string): Promise<BillingDetail[]> => {
      try {
        const { data, error: fetchError } = await supabase
          .from('billing_details')
          .select('*')
          .eq('billing_record_id', billingRecordId)
          .order('service_date', { ascending: true });

        if (fetchError) {
          console.error('Error fetching billing details:', fetchError);
          return [];
        }

        const details: BillingDetail[] = (data || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          billingRecordId: row.billing_record_id as string,
          serviceDate: row.service_date as string,
          serviceCode: (row.service_code as string) || undefined,
          unitCount: (row.unit_count as number) || 0,
          isAbsence: (row.is_absence as boolean) || false,
          absenceType: (row.absence_type as string) || undefined,
          additions: (row.additions as BillingAddition[]) || [],
          createdAt: row.created_at as string,
        }));

        setBillingDetails(details);
        return details;
      } catch (err) {
        console.error('Error in fetchBillingDetails:', err);
        return [];
      }
    },
    []
  );

  // ─── 利用者負担額計算 ───
  const calculateCopay = useCallback(
    (totalAmount: number, upperLimit: number): number => {
      // 利用者負担 = 総額の10%（ただし上限月額を超えない）
      const tenPercent = Math.floor(totalAmount * 0.1);
      if (upperLimit <= 0) return 0;
      return Math.min(tenPercent, upperLimit);
    },
    []
  );

  // ─── 月次請求自動生成 ───
  const generateMonthlyBilling = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<BillingRecord[]> => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. 対象月の利用実績を取得
        const startDate = `${yearMonth}-01`;
        const endDate = getLastDayOfMonth(yearMonth);

        const { data: usageData, error: usageError } = await supabase
          .from('usage_records')
          .select('*')
          .eq('facility_id', targetFacilityId)
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('billing_target', '請求する');

        if (usageError) {
          setError('利用実績の取得に失敗しました');
          console.error('Error fetching usage records:', usageError);
          return [];
        }

        if (!usageData || usageData.length === 0) {
          setError('対象月の利用実績がありません');
          return [];
        }

        // 2. 児童マスタ取得
        const childIds = [...new Set(usageData.map((r: Record<string, unknown>) => r.child_id as string))];
        const { data: childrenData } = await supabase
          .from('children')
          .select('id, name, income_category, beneficiary_number')
          .in('id', childIds);

        const childMap = new Map(
          (childrenData || []).map((c: Record<string, unknown>) => [c.id as string, c])
        );

        // 3. サービスコード取得
        const codes = serviceCodes.length > 0 ? serviceCodes : await fetchServiceCodes();

        // デフォルトの基本報酬コードを決定
        const jihatsuBaseCode = codes.find(
          (c) => c.category === '児童発達支援' && c.code === '611111'
        );
        const houkagouBaseCode = codes.find(
          (c) => c.category === '放課後等デイサービス' && c.code === '631111'
        );

        // 送迎加算コード
        const pickupCode = codes.find((c) => c.code === '616701');
        const roundTripCode = codes.find((c) => c.code === '616702');
        // 欠席時対応加算
        const absenceCode = codes.find((c) => c.code === '617101');

        // 4. 児童ごとにグルーピング
        const childUsageMap = new Map<string, Array<Record<string, unknown>>>();
        for (const usage of usageData) {
          const cid = usage.child_id as string;
          if (!childUsageMap.has(cid)) {
            childUsageMap.set(cid, []);
          }
          childUsageMap.get(cid)!.push(usage);
        }

        // 5. 既存の請求レコードを削除（下書きのみ）
        await supabase
          .from('billing_records')
          .delete()
          .eq('facility_id', targetFacilityId)
          .eq('year_month', yearMonth)
          .eq('status', 'draft');

        const newRecords: BillingRecord[] = [];

        // 6. 児童ごとに請求レコード生成
        for (const [childId, usages] of childUsageMap.entries()) {
          const child = childMap.get(childId) as Record<string, unknown> | undefined;
          const childName = (child?.name as string) || '不明';
          const incomeCategory = (child?.income_category as string) || 'general';
          const upperLimit = UPPER_LIMIT_MAP[incomeCategory] ?? 37200;

          // サービス種別判定（利用実績のサービス時間帯から推定）
          // 午前利用が多ければ児発、午後利用が多ければ放デイ
          let serviceType = '放課後等デイサービス';
          const amCount = usages.filter((u: Record<string, unknown>) => {
            const st = u.actual_start_time as string | undefined;
            return st && parseInt(st.split(':')[0], 10) < 12;
          }).length;
          if (amCount > usages.length / 2) {
            serviceType = '児童発達支援';
          }
          const baseCode = serviceType === '児童発達支援' ? jihatsuBaseCode : houkagouBaseCode;
          const baseUnits = baseCode?.baseUnits || 604;
          const baseServiceCode = baseCode?.code || '631111';

          // 日別明細の生成
          const detailInserts: Array<{
            billing_record_id: string;
            service_date: string;
            service_code: string;
            unit_count: number;
            is_absence: boolean;
            absence_type: string | null;
            additions: BillingAddition[];
          }> = [];

          let totalUnits = 0;

          for (const usage of usages) {
            const serviceStatus = usage.service_status as string;
            const isAbsence = serviceStatus === '欠席(加算なし)' || serviceStatus === '加算のみ';
            const additions: BillingAddition[] = [];

            let dayUnits = 0;

            if (!isAbsence) {
              // 基本報酬
              dayUnits = baseUnits;

              // 送迎加算
              const hasPickup = usage.pickup === 'あり';
              const hasDropoff = usage.dropoff === 'あり';
              if (hasPickup && hasDropoff && roundTripCode) {
                additions.push({
                  code: roundTripCode.code,
                  name: roundTripCode.name,
                  units: roundTripCode.baseUnits,
                });
                dayUnits += roundTripCode.baseUnits;
              } else if ((hasPickup || hasDropoff) && pickupCode) {
                additions.push({
                  code: pickupCode.code,
                  name: pickupCode.name,
                  units: pickupCode.baseUnits,
                });
                dayUnits += pickupCode.baseUnits;
              }

              // その他の加算（addonItemsから）
              const addonItems = (usage.addon_items as string[]) || [];
              for (const addonName of addonItems) {
                const matchedCode = codes.find(
                  (c) => c.category === '加算' && c.name.includes(addonName)
                );
                if (matchedCode) {
                  additions.push({
                    code: matchedCode.code,
                    name: matchedCode.name,
                    units: matchedCode.baseUnits,
                  });
                  dayUnits += matchedCode.baseUnits;
                }
              }
            } else if (serviceStatus === '加算のみ' && absenceCode) {
              // 欠席時対応加算
              additions.push({
                code: absenceCode.code,
                name: absenceCode.name,
                units: absenceCode.baseUnits,
              });
              dayUnits = absenceCode.baseUnits;
            }

            totalUnits += dayUnits;

            detailInserts.push({
              billing_record_id: '', // 後で設定
              service_date: usage.date as string,
              service_code: isAbsence ? (absenceCode?.code || '') : baseServiceCode,
              unit_count: dayUnits,
              is_absence: isAbsence,
              absence_type: isAbsence ? (serviceStatus as string) : null,
              additions,
            });
          }

          // 金額計算
          const unitPrice = DEFAULT_UNIT_PRICE;
          const totalAmount = totalUnits * unitPrice;
          const copayAmount = calculateCopay(totalAmount, upperLimit);
          const insuranceAmount = totalAmount - copayAmount;

          // 請求レコード挿入
          const recordId = `billing-${Date.now()}-${childId.substring(0, 8)}`;
          const now = new Date().toISOString();

          const { error: insertError } = await supabase.from('billing_records').insert({
            id: recordId,
            facility_id: targetFacilityId,
            child_id: childId,
            year_month: yearMonth,
            service_type: serviceType,
            total_units: totalUnits,
            unit_price: unitPrice,
            total_amount: totalAmount,
            copay_amount: copayAmount,
            insurance_amount: insuranceAmount,
            upper_limit_amount: upperLimit,
            status: 'draft',
            notes: null,
            created_at: now,
            updated_at: now,
          });

          if (insertError) {
            console.error('Error inserting billing record:', insertError);
            continue;
          }

          // 明細挿入
          const detailRows = detailInserts.map((d) => ({
            billing_record_id: recordId,
            service_date: d.service_date,
            service_code: d.service_code,
            unit_count: d.unit_count,
            is_absence: d.is_absence,
            absence_type: d.absence_type,
            additions: d.additions,
          }));

          if (detailRows.length > 0) {
            const { error: detailError } = await supabase.from('billing_details').insert(detailRows);
            if (detailError) {
              console.error('Error inserting billing details:', detailError);
            }
          }

          newRecords.push({
            id: recordId,
            facilityId: targetFacilityId,
            childId,
            yearMonth,
            serviceType,
            totalUnits,
            unitPrice,
            totalAmount,
            copayAmount,
            insuranceAmount,
            upperLimitAmount: upperLimit,
            status: 'draft',
            createdAt: now,
            updatedAt: now,
            childName,
          });
        }

        setBillingRecords(newRecords);
        return newRecords;
      } catch (err) {
        setError('請求データの生成中にエラーが発生しました');
        console.error('Error in generateMonthlyBilling:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [serviceCodes, fetchServiceCodes, calculateCopay]
  );

  // ─── 請求レコード更新 ───
  const updateBillingRecord = useCallback(
    async (id: string, updates: Partial<BillingRecord>): Promise<boolean> => {
      try {
        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updates.totalUnits !== undefined) dbUpdates.total_units = updates.totalUnits;
        if (updates.unitPrice !== undefined) dbUpdates.unit_price = updates.unitPrice;
        if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount;
        if (updates.copayAmount !== undefined) dbUpdates.copay_amount = updates.copayAmount;
        if (updates.insuranceAmount !== undefined) dbUpdates.insurance_amount = updates.insuranceAmount;
        if (updates.upperLimitAmount !== undefined) dbUpdates.upper_limit_amount = updates.upperLimitAmount;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.submittedAt !== undefined) dbUpdates.submitted_at = updates.submittedAt;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.serviceType !== undefined) dbUpdates.service_type = updates.serviceType;

        const { error: updateError } = await supabase
          .from('billing_records')
          .update(dbUpdates)
          .eq('id', id);

        if (updateError) {
          console.error('Error updating billing record:', updateError);
          return false;
        }

        setBillingRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: dbUpdates.updated_at as string } : r))
        );
        return true;
      } catch (err) {
        console.error('Error in updateBillingRecord:', err);
        return false;
      }
    },
    []
  );

  // ─── 明細更新 ───
  const updateBillingDetail = useCallback(
    async (id: string, updates: Partial<BillingDetail>): Promise<boolean> => {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.serviceCode !== undefined) dbUpdates.service_code = updates.serviceCode;
        if (updates.unitCount !== undefined) dbUpdates.unit_count = updates.unitCount;
        if (updates.isAbsence !== undefined) dbUpdates.is_absence = updates.isAbsence;
        if (updates.absenceType !== undefined) dbUpdates.absence_type = updates.absenceType;
        if (updates.additions !== undefined) dbUpdates.additions = updates.additions;

        const { error: updateError } = await supabase
          .from('billing_details')
          .update(dbUpdates)
          .eq('id', id);

        if (updateError) {
          console.error('Error updating billing detail:', updateError);
          return false;
        }

        setBillingDetails((prev) =>
          prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
        );
        return true;
      } catch (err) {
        console.error('Error in updateBillingDetail:', err);
        return false;
      }
    },
    []
  );

  // ─── 一括確定 ───
  const confirmBilling = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<boolean> => {
      try {
        const { error: confirmError } = await supabase
          .from('billing_records')
          .update({ status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('facility_id', targetFacilityId)
          .eq('year_month', yearMonth)
          .eq('status', 'draft');

        if (confirmError) {
          console.error('Error confirming billing:', confirmError);
          return false;
        }

        setBillingRecords((prev) =>
          prev.map((r) =>
            r.facilityId === targetFacilityId && r.yearMonth === yearMonth && r.status === 'draft'
              ? { ...r, status: 'confirmed' as BillingStatus }
              : r
          )
        );
        return true;
      } catch (err) {
        console.error('Error in confirmBilling:', err);
        return false;
      }
    },
    []
  );

  // ─── CSV出力（国保連フォーマット） ───
  const exportCSV = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<string> => {
      try {
        // 請求レコード取得
        const { data: records } = await supabase
          .from('billing_records')
          .select('*, children(name, beneficiary_number)')
          .eq('facility_id', targetFacilityId)
          .eq('year_month', yearMonth);

        if (!records || records.length === 0) return '';

        // 施設情報取得
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('name, code')
          .eq('id', targetFacilityId)
          .single();

        const facilityName = (facilityData?.name as string) || '';
        const facilityCode = (facilityData?.code as string) || '';

        // ヘッダーレコード
        const lines: string[] = [];
        const ym = yearMonth.replace('-', '');
        lines.push(
          [
            '1',                    // レコード種別（1=ヘッダー）
            facilityCode,           // 事業所番号
            facilityName,           // 事業所名
            ym,                     // 対象年月
            records.length.toString(), // 明細件数
          ].join(',')
        );

        // 明細レコード
        let totalInsuranceAll = 0;
        let totalCopayAll = 0;

        for (const rec of records) {
          const childData = rec.children as Record<string, unknown> | null;
          const childName = (childData?.name as string) || '';
          const beneficiaryNumber = (childData?.beneficiary_number as string) || '';

          totalInsuranceAll += (rec.insurance_amount as number) || 0;
          totalCopayAll += (rec.copay_amount as number) || 0;

          lines.push(
            [
              '2',                            // レコード種別（2=明細）
              beneficiaryNumber,               // 受給者証番号
              childName,                       // 利用者名
              rec.service_type as string,      // サービス種別
              (rec.total_units as number).toString(),      // 単位数合計
              (rec.unit_price as number).toString(),       // 単位単価
              (rec.total_amount as number).toString(),     // 請求額
              (rec.copay_amount as number).toString(),     // 利用者負担額
              (rec.insurance_amount as number).toString(), // 保険請求額
              (rec.upper_limit_amount as number).toString(), // 上限月額
              rec.status as string,            // ステータス
            ].join(',')
          );
        }

        // サマリーレコード
        lines.push(
          [
            '3',                          // レコード種別（3=サマリー）
            records.length.toString(),    // 合計件数
            totalInsuranceAll.toString(), // 保険請求額合計
            totalCopayAll.toString(),     // 利用者負担額合計
            (totalInsuranceAll + totalCopayAll).toString(), // 総額
          ].join(',')
        );

        return lines.join('\n');
      } catch (err) {
        console.error('Error in exportCSV:', err);
        return '';
      }
    },
    []
  );

  return {
    billingRecords,
    billingDetails,
    serviceCodes,
    isLoading,
    error,
    fetchBillingRecords,
    fetchBillingDetails,
    fetchServiceCodes,
    generateMonthlyBilling,
    updateBillingRecord,
    updateBillingDetail,
    confirmBilling,
    exportCSV,
    calculateCopay,
  };
};

// ─── ヘルパー ───

function getLastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;
}
