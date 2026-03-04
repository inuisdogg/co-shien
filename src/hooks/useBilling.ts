/**
 * 国保連請求データ管理フック（完全版）
 *
 * - 地域区分に応じた単位単価の自動取得
 * - 時間区分に基づく基本報酬の正確な算定
 * - 施設加算・児童加算の自動適用
 * - 処遇改善加算等のパーセント加算対応
 * - billing_records / billing_details テーブルの生成・CRUD
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

// ━━━ 定数 ━━━

// 上限月額の区分定数
const UPPER_LIMIT_MAP: Record<string, number> = {
  general: 37200,      // 一般（年収890万円超）
  general_low: 4600,   // 一般（年収890万円以下）
  low_income: 0,       // 低所得
  welfare: 0,          // 生活保護
};

// フォールバック単位単価（regional_units が取得できない場合）
const FALLBACK_UNIT_PRICE = 10;

// サービス種別コードマッピング
const SERVICE_TYPE_CODE_MAP: Record<string, string> = {
  '児童発達支援': 'jido_hattatsu',
  '放課後等デイサービス': 'hokago_day',
};

// ━━━ 内部型定義 ━━━

type BaseReward = {
  serviceTypeCode: string;
  timeCategory: number;
  minMinutes: number;
  maxMinutes: number | null;
  capacityMin: number;
  capacityMax: number;
  units: number;
  applicableDays: string[];
};

type AdditionMaster = {
  code: string;
  name: string;
  shortName?: string;
  units: number | null;
  unitType: string;
  isPercentage: boolean;
  percentageRate: number | null;
  applicableServices: string[];
  maxTimesPerMonth: number | null;
  maxTimesPerDay: number;
  additionType: string;
  isActive: boolean;
};

type FacilityAdditionSetting = {
  additionCode: string;
  isEnabled: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
};

type ChildAddition = {
  childId: string;
  additionCode: string;
  isEnabled: boolean;
  startDate?: string;
  endDate?: string;
  customUnits?: number;
};

type DailyAdditionRecord = {
  childId: string;
  date: string;
  additionCode: string;
  units: number;
  times: number;
};

// ━━━ メインフック ━━━

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

  // ─── 地域区分から単位単価を取得 ───
  const fetchUnitPrice = useCallback(
    async (targetFacilityId: string): Promise<number> => {
      try {
        // facility_settings から regional_grade を取得
        const { data: settings } = await supabase
          .from('facility_settings')
          .select('regional_grade')
          .eq('facility_id', targetFacilityId)
          .single();

        const grade = (settings?.regional_grade as string) || null;
        if (!grade) return FALLBACK_UNIT_PRICE;

        // regional_units テーブルから単位単価を取得
        const { data: regionData } = await supabase
          .from('regional_units')
          .select('unit_price')
          .eq('grade', grade)
          .single();

        if (regionData?.unit_price) {
          return Number(regionData.unit_price);
        }
        return FALLBACK_UNIT_PRICE;
      } catch {
        return FALLBACK_UNIT_PRICE;
      }
    },
    []
  );

  // ─── 基本報酬マスタ取得 ───
  const fetchBaseRewards = useCallback(async (): Promise<BaseReward[]> => {
    try {
      const { data } = await supabase
        .from('base_rewards')
        .select('*')
        .order('service_type_code')
        .order('time_category');

      if (!data) return [];

      return data.map((row: Record<string, unknown>) => ({
        serviceTypeCode: row.service_type_code as string,
        timeCategory: row.time_category as number,
        minMinutes: (row.min_minutes as number) || 0,
        maxMinutes: (row.max_minutes as number) || null,
        capacityMin: (row.capacity_min as number) || 1,
        capacityMax: (row.capacity_max as number) || 99,
        units: (row.units as number) || 0,
        applicableDays: (row.applicable_days as string[]) || ['全日'],
      }));
    } catch {
      return [];
    }
  }, []);

  // ─── 施設の加算設定を取得 ───
  const fetchFacilityAdditions = useCallback(
    async (targetFacilityId: string): Promise<FacilityAdditionSetting[]> => {
      try {
        const { data } = await supabase
          .from('facility_addition_settings')
          .select('*')
          .eq('facility_id', targetFacilityId)
          .eq('is_enabled', true);

        if (!data) return [];

        return data.map((row: Record<string, unknown>) => ({
          additionCode: row.addition_code as string,
          isEnabled: true,
          effectiveFrom: (row.effective_from as string) || undefined,
          effectiveTo: (row.effective_to as string) || undefined,
        }));
      } catch {
        return [];
      }
    },
    []
  );

  // ─── 児童別加算設定を取得 ───
  const fetchChildAdditions = useCallback(
    async (targetFacilityId: string, childIds: string[]): Promise<ChildAddition[]> => {
      try {
        if (childIds.length === 0) return [];
        const { data } = await supabase
          .from('child_additions')
          .select('*')
          .eq('facility_id', targetFacilityId)
          .in('child_id', childIds)
          .eq('is_enabled', true);

        if (!data) return [];

        return data.map((row: Record<string, unknown>) => ({
          childId: row.child_id as string,
          additionCode: row.addition_code as string,
          isEnabled: true,
          startDate: (row.start_date as string) || undefined,
          endDate: (row.end_date as string) || undefined,
          customUnits: (row.custom_units as number) || undefined,
        }));
      } catch {
        return [];
      }
    },
    []
  );

  // ─── 日別加算実績を取得 ───
  const fetchDailyAdditionRecords = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<DailyAdditionRecord[]> => {
      try {
        const startDate = `${yearMonth}-01`;
        const endDate = getLastDayOfMonth(yearMonth);

        const { data } = await supabase
          .from('daily_addition_records')
          .select('*')
          .eq('facility_id', targetFacilityId)
          .gte('date', startDate)
          .lte('date', endDate);

        if (!data) return [];

        return data.map((row: Record<string, unknown>) => ({
          childId: row.child_id as string,
          date: row.date as string,
          additionCode: row.addition_code as string,
          units: (row.units as number) || 0,
          times: (row.times as number) || 1,
        }));
      } catch {
        return [];
      }
    },
    []
  );

  // ─── 加算マスタ取得 ───
  const fetchAdditionsMaster = useCallback(async (): Promise<AdditionMaster[]> => {
    try {
      const { data } = await supabase
        .from('additions')
        .select('*')
        .eq('is_active', true);

      if (!data) return [];

      return data.map((row: Record<string, unknown>) => ({
        code: row.code as string,
        name: row.name as string,
        shortName: (row.short_name as string) || undefined,
        units: (row.units as number) || null,
        unitType: (row.unit_type as string) || 'day',
        isPercentage: (row.is_percentage as boolean) || false,
        percentageRate: (row.percentage_rate as number) || null,
        applicableServices: (row.applicable_services as string[]) || [],
        maxTimesPerMonth: (row.max_times_per_month as number) || null,
        maxTimesPerDay: (row.max_times_per_day as number) || 1,
        additionType: (row.addition_type as string) || 'monthly',
        isActive: true,
      }));
    } catch {
      return [];
    }
  }, []);

  // ─── 施設定員取得 ───
  const fetchFacilityCapacity = useCallback(
    async (targetFacilityId: string): Promise<number> => {
      try {
        const { data } = await supabase
          .from('facility_settings')
          .select('capacity')
          .eq('facility_id', targetFacilityId)
          .single();

        // capacity カラム（INTEGER）は migration で追加済み
        const cap = data?.capacity as number | null;
        if (cap && cap > 0) return cap;

        // フォールバック: JSONB の capacity.AM / capacity.PM を使用
        const { data: jsonSettings } = await supabase
          .from('facility_settings')
          .select('capacity')
          .eq('facility_id', targetFacilityId)
          .single();

        if (jsonSettings?.capacity && typeof jsonSettings.capacity === 'object') {
          const capObj = jsonSettings.capacity as Record<string, unknown>;
          const am = (capObj.am as number) || (capObj.AM as number) || 0;
          const pm = (capObj.pm as number) || (capObj.PM as number) || 0;
          return Math.max(am, pm, 10);
        }
        return 10; // デフォルト定員
      } catch {
        return 10;
      }
    },
    []
  );

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
      const tenPercent = Math.floor(totalAmount * 0.1);
      if (upperLimit <= 0) return 0;
      return Math.min(tenPercent, upperLimit);
    },
    []
  );

  // ─── サービス提供時間（分）を計算 ───
  const calculateServiceMinutes = (
    actualStartTime: string | null | undefined,
    actualEndTime: string | null | undefined
  ): number => {
    if (!actualStartTime || !actualEndTime) return 0;
    const [sh, sm] = actualStartTime.split(':').map(Number);
    const [eh, em] = actualEndTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  // ─── 時間区分の判定 ───
  const determineTimeCategory = (
    serviceMinutes: number,
    baseRewards: BaseReward[],
    serviceTypeCode: string,
    capacity: number
  ): BaseReward | null => {
    // サービス種別 + 定員に合致する基本報酬をフィルタ
    const candidates = baseRewards.filter(
      (br) =>
        br.serviceTypeCode === serviceTypeCode &&
        capacity >= br.capacityMin &&
        capacity <= br.capacityMax
    );

    if (candidates.length === 0) return null;

    // 時間に基づいて最適な区分を選択
    for (const br of candidates) {
      const min = br.minMinutes;
      const max = br.maxMinutes;
      if (serviceMinutes >= min && (max === null || serviceMinutes <= max)) {
        return br;
      }
    }

    // 最低区分を返す（30分以上のチェックは外で行う）
    if (serviceMinutes > 0 && candidates.length > 0) {
      return candidates[candidates.length - 1];
    }

    return null;
  };

  // ─── 月次請求自動生成（完全版） ───
  const generateMonthlyBilling = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<BillingRecord[]> => {
      setIsLoading(true);
      setError(null);
      try {
        // ━━━ 1. マスタデータの一括取得 ━━━
        const [
          unitPrice,
          baseRewards,
          additionsMaster,
          facilityAdditions,
          capacity,
        ] = await Promise.all([
          fetchUnitPrice(targetFacilityId),
          fetchBaseRewards(),
          fetchAdditionsMaster(),
          fetchFacilityAdditions(targetFacilityId),
          fetchFacilityCapacity(targetFacilityId),
        ]);

        // 加算マスタをコードでインデックス
        const additionMap = new Map(additionsMaster.map((a) => [a.code, a]));
        // 施設で有効な加算コードセット
        const enabledFacilityAdditions = new Set(facilityAdditions.map((fa) => fa.additionCode));

        // ━━━ 2. 利用実績を取得 ━━━
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
          return [];
        }

        if (!usageData || usageData.length === 0) {
          setError('対象月の利用実績がありません');
          return [];
        }

        // ━━━ 3. 児童マスタ取得 ━━━
        const childIds = [...new Set(usageData.map((r: Record<string, unknown>) => r.child_id as string))];
        const { data: childrenData } = await supabase
          .from('children')
          .select('id, name, income_category, beneficiary_number')
          .in('id', childIds);

        const childMap = new Map(
          (childrenData || []).map((c: Record<string, unknown>) => [c.id as string, c])
        );

        // ━━━ 4. 児童別加算・日別加算実績を取得 ━━━
        const [childAdditions, dailyAdditionRecords] = await Promise.all([
          fetchChildAdditions(targetFacilityId, childIds),
          fetchDailyAdditionRecords(targetFacilityId, yearMonth),
        ]);

        // 児童別加算をグルーピング
        const childAdditionMap = new Map<string, ChildAddition[]>();
        for (const ca of childAdditions) {
          if (!childAdditionMap.has(ca.childId)) {
            childAdditionMap.set(ca.childId, []);
          }
          childAdditionMap.get(ca.childId)!.push(ca);
        }

        // 日別加算実績をグルーピング（childId+date → records）
        const dailyAdditionMap = new Map<string, DailyAdditionRecord[]>();
        for (const dar of dailyAdditionRecords) {
          const key = `${dar.childId}_${dar.date}`;
          if (!dailyAdditionMap.has(key)) {
            dailyAdditionMap.set(key, []);
          }
          dailyAdditionMap.get(key)!.push(dar);
        }

        // ━━━ 5. サービスコード取得 ━━━
        const codes = serviceCodes.length > 0 ? serviceCodes : await fetchServiceCodes();

        // 欠席時対応加算コード
        const absenceCode = codes.find((c) => c.code === '617101');

        // ━━━ 6. 利用実績を児童ごとにグルーピング ━━━
        const childUsageMap = new Map<string, Array<Record<string, unknown>>>();
        for (const usage of usageData) {
          const cid = usage.child_id as string;
          if (!childUsageMap.has(cid)) {
            childUsageMap.set(cid, []);
          }
          childUsageMap.get(cid)!.push(usage);
        }

        // ━━━ 7. 既存の下書き請求レコードを削除 ━━━
        await supabase
          .from('billing_records')
          .delete()
          .eq('facility_id', targetFacilityId)
          .eq('year_month', yearMonth)
          .eq('status', 'draft');

        const newRecords: BillingRecord[] = [];

        // ━━━ 8. 児童ごとに請求レコード生成 ━━━
        for (const [childId, usages] of childUsageMap.entries()) {
          const child = childMap.get(childId) as Record<string, unknown> | undefined;
          const childName = (child?.name as string) || '不明';
          const incomeCategory = (child?.income_category as string) || 'general';
          const upperLimit = UPPER_LIMIT_MAP[incomeCategory] ?? 37200;

          // ── サービス種別判定 ──
          // 利用実績の時間帯から推定: 午前利用が過半数なら児発、それ以外は放デイ
          let serviceType = '放課後等デイサービス';
          const amCount = usages.filter((u: Record<string, unknown>) => {
            const st = u.actual_start_time as string | undefined;
            return st && parseInt(st.split(':')[0], 10) < 12;
          }).length;
          if (amCount > usages.length / 2) {
            serviceType = '児童発達支援';
          }
          const serviceTypeCode = SERVICE_TYPE_CODE_MAP[serviceType] || 'hokago_day';

          // この児童に適用される加算一覧
          const thisChildAdditions = childAdditionMap.get(childId) || [];

          // ── 日別明細の生成 ──
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
          // 月次加算の回数カウンタ（月上限管理用）
          const monthlyAdditionCounts = new Map<string, number>();

          for (const usage of usages) {
            const serviceStatus = usage.service_status as string;
            const isAbsence = serviceStatus === '欠席(加算なし)' || serviceStatus === '加算のみ';
            const additions: BillingAddition[] = [];
            let dayUnits = 0;
            const usageDate = usage.date as string;

            if (!isAbsence) {
              // ── 基本報酬の算定（時間区分対応） ──
              const actualStart = usage.actual_start_time as string | null;
              const actualEnd = usage.actual_end_time as string | null;
              const serviceMinutes = calculateServiceMinutes(actualStart, actualEnd);

              // usage_records の time_category があればそれを優先、なければ時間から算出
              const existingTimeCategory = usage.time_category as string | null;
              let baseReward: BaseReward | null = null;

              if (existingTimeCategory) {
                // time_category が既に設定されている場合、それに合致する基本報酬を検索
                const tc = parseInt(existingTimeCategory.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(tc)) {
                  baseReward = baseRewards.find(
                    (br) =>
                      br.serviceTypeCode === serviceTypeCode &&
                      br.timeCategory === tc &&
                      capacity >= br.capacityMin &&
                      capacity <= br.capacityMax
                  ) || null;
                }
              }

              if (!baseReward && serviceMinutes > 0) {
                baseReward = determineTimeCategory(serviceMinutes, baseRewards, serviceTypeCode, capacity);
              }

              // 基本報酬単位数の決定
              if (baseReward) {
                dayUnits = baseReward.units;
              } else {
                // フォールバック: service_codes テーブルから取得
                const fallbackCode = serviceType === '児童発達支援'
                  ? codes.find((c) => c.category === '児童発達支援' && c.code === '611111')
                  : codes.find((c) => c.category === '放課後等デイサービス' && c.code === '631111');
                dayUnits = fallbackCode?.baseUnits || 604;
              }

              // ── 送迎加算 ──
              const hasPickup = usage.pickup === 'あり';
              const hasDropoff = usage.dropoff === 'あり';
              if (hasPickup) {
                const pickupAddition = additionMap.get('616701');
                if (pickupAddition && pickupAddition.units) {
                  additions.push({ code: '616701', name: pickupAddition.name, units: pickupAddition.units });
                  dayUnits += pickupAddition.units;
                } else {
                  // フォールバック
                  additions.push({ code: '616701', name: '送迎加算（片道）', units: 54 });
                  dayUnits += 54;
                }
              }
              if (hasDropoff) {
                const dropoffAddition = additionMap.get('616702');
                if (dropoffAddition && dropoffAddition.units) {
                  additions.push({ code: '616702', name: dropoffAddition.name, units: dropoffAddition.units });
                  dayUnits += dropoffAddition.units;
                } else {
                  additions.push({ code: '616702', name: '送迎加算（片道）', units: 54 });
                  dayUnits += 54;
                }
              }

              // ── 日別加算実績（daily_addition_records）の適用 ──
              const dailyKey = `${childId}_${usageDate}`;
              const dailyRecords = dailyAdditionMap.get(dailyKey) || [];
              for (const dar of dailyRecords) {
                // 送迎加算は上で処理済みなのでスキップ
                if (dar.additionCode === '616701' || dar.additionCode === '616702') continue;

                const addMaster = additionMap.get(dar.additionCode);
                if (addMaster && !addMaster.isPercentage) {
                  const addUnits = dar.units * dar.times;
                  additions.push({
                    code: dar.additionCode,
                    name: addMaster.name,
                    units: addUnits,
                  });
                  dayUnits += addUnits;
                }
              }

              // ── 施設加算の自動適用（日次型） ──
              for (const addCode of enabledFacilityAdditions) {
                const addMaster = additionMap.get(addCode);
                if (!addMaster || addMaster.isPercentage) continue;
                if (addMaster.additionType !== 'daily') continue;
                // 既に日別実績で追加済みならスキップ
                if (additions.some((a) => a.code === addCode)) continue;
                // 送迎加算はスキップ（上で処理済み）
                if (addCode === '616701' || addCode === '616702') continue;
                // サービス種別チェック
                if (addMaster.applicableServices.length > 0 &&
                    !addMaster.applicableServices.includes(serviceTypeCode)) continue;
                // 月上限チェック
                const currentCount = monthlyAdditionCounts.get(addCode) || 0;
                if (addMaster.maxTimesPerMonth && currentCount >= addMaster.maxTimesPerMonth) continue;

                const addUnits = addMaster.units || 0;
                if (addUnits > 0) {
                  additions.push({ code: addCode, name: addMaster.name, units: addUnits });
                  dayUnits += addUnits;
                  monthlyAdditionCounts.set(addCode, currentCount + 1);
                }
              }

              // ── 児童個別加算の自動適用（日次型） ──
              for (const ca of thisChildAdditions) {
                const addMaster = additionMap.get(ca.additionCode);
                if (!addMaster || addMaster.isPercentage) continue;
                if (addMaster.additionType !== 'daily') continue;
                if (additions.some((a) => a.code === ca.additionCode)) continue;
                // 有効期間チェック
                if (ca.startDate && usageDate < ca.startDate) continue;
                if (ca.endDate && usageDate > ca.endDate) continue;
                // サービス種別チェック
                if (addMaster.applicableServices.length > 0 &&
                    !addMaster.applicableServices.includes(serviceTypeCode)) continue;

                const addUnits = ca.customUnits || addMaster.units || 0;
                if (addUnits > 0) {
                  additions.push({ code: ca.additionCode, name: addMaster.name, units: addUnits });
                  dayUnits += addUnits;
                }
              }

              // ── addon_items（手動選択加算）からの適用 ──
              const addonItems = (usage.addon_items as string[]) || [];
              for (const addonName of addonItems) {
                // 既に追加済みならスキップ
                if (additions.some((a) => a.name.includes(addonName))) continue;

                // 加算マスタから名前で検索
                const matchedMaster = additionsMaster.find(
                  (a) => a.name.includes(addonName) || (a.shortName && a.shortName.includes(addonName))
                );
                if (matchedMaster && matchedMaster.units && !matchedMaster.isPercentage) {
                  additions.push({
                    code: matchedMaster.code,
                    name: matchedMaster.name,
                    units: matchedMaster.units,
                  });
                  dayUnits += matchedMaster.units;
                } else {
                  // service_codes からもフォールバック検索
                  const matchedCode = codes.find(
                    (c) => c.category === '加算' && c.name.includes(addonName)
                  );
                  if (matchedCode) {
                    additions.push({ code: matchedCode.code, name: matchedCode.name, units: matchedCode.baseUnits });
                    dayUnits += matchedCode.baseUnits;
                  }
                }
              }

            } else if (serviceStatus === '加算のみ' && absenceCode) {
              // ── 欠席時対応加算 ──
              const absMaster = additionMap.get('617101');
              const absUnits = absMaster?.units || absenceCode.baseUnits || 94;
              additions.push({ code: '617101', name: '欠席時対応加算', units: absUnits });
              dayUnits = absUnits;
            }

            totalUnits += dayUnits;

            // 基本サービスコードの決定
            const baseServiceCode = serviceType === '児童発達支援' ? '611111' : '631111';

            detailInserts.push({
              billing_record_id: '',
              service_date: usageDate,
              service_code: isAbsence ? '617101' : baseServiceCode,
              unit_count: dayUnits,
              is_absence: isAbsence,
              absence_type: isAbsence ? serviceStatus : null,
              additions,
            });
          }

          // ── 月次加算の適用（施設加算 + 児童加算） ──
          let monthlyAdditionUnits = 0;
          const monthlyAdditions: BillingAddition[] = [];

          // 施設の月次加算
          for (const addCode of enabledFacilityAdditions) {
            const addMaster = additionMap.get(addCode);
            if (!addMaster) continue;
            if (addMaster.additionType !== 'monthly' && addMaster.additionType !== 'facility_preset') continue;
            if (addMaster.isPercentage) continue; // パーセント加算は後で処理
            if (addMaster.applicableServices.length > 0 &&
                !addMaster.applicableServices.includes(serviceTypeCode)) continue;

            const addUnits = addMaster.units || 0;
            if (addUnits > 0) {
              monthlyAdditions.push({ code: addCode, name: addMaster.name, units: addUnits });
              monthlyAdditionUnits += addUnits;
            }
          }

          // 児童の月次加算
          for (const ca of thisChildAdditions) {
            const addMaster = additionMap.get(ca.additionCode);
            if (!addMaster) continue;
            if (addMaster.additionType !== 'monthly') continue;
            if (addMaster.isPercentage) continue;
            if (monthlyAdditions.some((a) => a.code === ca.additionCode)) continue;

            const addUnits = ca.customUnits || addMaster.units || 0;
            if (addUnits > 0) {
              monthlyAdditions.push({ code: ca.additionCode, name: addMaster.name, units: addUnits });
              monthlyAdditionUnits += addUnits;
            }
          }

          totalUnits += monthlyAdditionUnits;

          // 月次加算を最終日の明細に追加（or 専用行として記録）
          if (monthlyAdditions.length > 0 && detailInserts.length > 0) {
            const lastDetail = detailInserts[detailInserts.length - 1];
            lastDetail.additions = [...lastDetail.additions, ...monthlyAdditions];
            lastDetail.unit_count += monthlyAdditionUnits;
          }

          // ── パーセント加算の計算（処遇改善加算等） ──
          let percentageAdditionUnits = 0;
          const percentageAdditions: BillingAddition[] = [];

          for (const addCode of enabledFacilityAdditions) {
            const addMaster = additionMap.get(addCode);
            if (!addMaster || !addMaster.isPercentage || !addMaster.percentageRate) continue;
            if (addMaster.applicableServices.length > 0 &&
                !addMaster.applicableServices.includes(serviceTypeCode)) continue;

            // パーセント加算 = 基本報酬合計単位 × percentageRate / 100
            const pctUnits = Math.floor(totalUnits * addMaster.percentageRate / 100);
            if (pctUnits > 0) {
              percentageAdditions.push({ code: addCode, name: addMaster.name, units: pctUnits });
              percentageAdditionUnits += pctUnits;
            }
          }

          totalUnits += percentageAdditionUnits;

          // パーセント加算を最終日の明細に追加
          if (percentageAdditions.length > 0 && detailInserts.length > 0) {
            const lastDetail = detailInserts[detailInserts.length - 1];
            lastDetail.additions = [...lastDetail.additions, ...percentageAdditions];
            lastDetail.unit_count += percentageAdditionUnits;
          }

          // ── 金額計算（地域区分対応） ──
          const totalAmount = Math.floor(totalUnits * unitPrice);
          const copayAmount = calculateCopay(totalAmount, upperLimit);
          const insuranceAmount = totalAmount - copayAmount;

          // ── 請求レコード挿入 ──
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

          // ── 明細挿入 ──
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
    [serviceCodes, fetchServiceCodes, calculateCopay, fetchUnitPrice, fetchBaseRewards,
     fetchAdditionsMaster, fetchFacilityAdditions, fetchChildAdditions, fetchDailyAdditionRecords,
     fetchFacilityCapacity]
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

  // ─── 一括提出 ───
  const submitBilling = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<boolean> => {
      try {
        const now = new Date().toISOString();
        const { error: submitError } = await supabase
          .from('billing_records')
          .update({ status: 'submitted', submitted_at: now, updated_at: now })
          .eq('facility_id', targetFacilityId)
          .eq('year_month', yearMonth)
          .eq('status', 'confirmed');

        if (submitError) {
          console.error('Error submitting billing:', submitError);
          return false;
        }

        setBillingRecords((prev) =>
          prev.map((r) =>
            r.facilityId === targetFacilityId && r.yearMonth === yearMonth && r.status === 'confirmed'
              ? { ...r, status: 'submitted' as BillingStatus, submittedAt: now }
              : r
          )
        );
        return true;
      } catch (err) {
        console.error('Error in submitBilling:', err);
        return false;
      }
    },
    []
  );

  // ─── 入金記録 ───
  const markAsPaid = useCallback(
    async (targetFacilityId: string, yearMonth: string): Promise<boolean> => {
      try {
        const { error: paidError } = await supabase
          .from('billing_records')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('facility_id', targetFacilityId)
          .eq('year_month', yearMonth)
          .eq('status', 'submitted');

        if (paidError) {
          console.error('Error marking as paid:', paidError);
          return false;
        }

        setBillingRecords((prev) =>
          prev.map((r) =>
            r.facilityId === targetFacilityId && r.yearMonth === yearMonth && r.status === 'submitted'
              ? { ...r, status: 'paid' as BillingStatus }
              : r
          )
        );
        return true;
      } catch (err) {
        console.error('Error in markAsPaid:', err);
        return false;
      }
    },
    []
  );

  // ─── CSV出力（国保連フォーマット — 介護給付費明細書） ───
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

        // 明細も取得
        const recordIds = records.map((r: Record<string, unknown>) => r.id as string);
        const { data: allDetails } = await supabase
          .from('billing_details')
          .select('*')
          .in('billing_record_id', recordIds)
          .order('service_date', { ascending: true });

        // 明細をレコードIDでグルーピング
        const detailsByRecord = new Map<string, Array<Record<string, unknown>>>();
        for (const d of (allDetails || [])) {
          const rid = d.billing_record_id as string;
          if (!detailsByRecord.has(rid)) {
            detailsByRecord.set(rid, []);
          }
          detailsByRecord.get(rid)!.push(d);
        }

        // 施設情報取得
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('name, code, business_number')
          .eq('id', targetFacilityId)
          .single();

        const facilityName = (facilityData?.name as string) || '';
        const facilityCode = (facilityData?.business_number as string) || (facilityData?.code as string) || '';

        // ── JDフォーマット出力 ──
        const lines: string[] = [];
        const ym = yearMonth.replace('-', '');
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        // ファイルヘッダー
        lines.push([
          'JD',                      // 交換情報識別番号（障害児通所）
          facilityCode,              // 事業所番号
          facilityName,              // 事業所名称
          ym,                        // サービス提供年月
          today,                     // 作成年月日
          records.length,            // 総件数
        ].join(','));

        let totalInsuranceAll = 0;
        let totalCopayAll = 0;
        let totalAmountAll = 0;

        // ── 児童ごとの明細 ──
        for (const rec of records) {
          const childData = rec.children as Record<string, unknown> | null;
          const childName = (childData?.name as string) || '';
          const beneficiaryNumber = (childData?.beneficiary_number as string) || '';
          const serviceType = rec.service_type as string;
          const serviceTypeCodeCSV = serviceType === '児童発達支援' ? '63' : '64';
          const details = detailsByRecord.get(rec.id as string) || [];
          const usageDays = details.filter((d: Record<string, unknown>) => !(d.is_absence as boolean)).length;

          totalInsuranceAll += (rec.insurance_amount as number) || 0;
          totalCopayAll += (rec.copay_amount as number) || 0;
          totalAmountAll += (rec.total_amount as number) || 0;

          // レコード種別1: 基本情報
          lines.push([
            '1',                              // レコード種別
            beneficiaryNumber,                 // 受給者証番号
            childName,                         // 利用者氏名
            '',                                // 市区町村コード
            serviceTypeCodeCSV,                // サービス種類コード
            usageDays,                         // 利用日数
            rec.total_units,                   // サービス単位数合計
            rec.unit_price,                    // 単位数単価
            rec.total_amount,                  // 費用合計
            rec.upper_limit_amount,            // 利用者負担上限月額
            rec.copay_amount,                  // 利用者負担額
            rec.insurance_amount,              // 給付費請求額
          ].join(','));

          // レコード種別2: 日別明細
          for (const detail of details) {
            const additionsData = (detail.additions as BillingAddition[]) || [];
            const additionCodes = additionsData.map((a) => `${a.code}:${a.units}`).join(';');

            lines.push([
              '2',                                           // レコード種別
              beneficiaryNumber,                              // 受給者証番号
              (detail.service_date as string).replace(/-/g, ''), // サービス提供日
              detail.service_code || '',                       // サービスコード
              detail.unit_count,                               // 単位数
              (detail.is_absence as boolean) ? '1' : '0',     // 欠席フラグ
              additionCodes,                                   // 加算コード
            ].join(','));
          }
        }

        // レコード種別9: 集計
        lines.push([
          '9',                        // レコード種別
          records.length,             // 明細件数
          totalAmountAll,             // 費用合計
          totalInsuranceAll,          // 給付費請求額合計
          totalCopayAll,              // 利用者負担額合計
        ].join(','));

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
    submitBilling,
    markAsPaid,
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
