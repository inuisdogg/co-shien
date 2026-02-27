/**
 * プラットフォーム管理者フック
 * 全施設横断データの取得・法人管理・ベンチマーク分析・戦略インサイト生成
 * owner ロールのユーザーが全施設のデータを閲覧・管理するために使用
 */

'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CompanyExtended,
  PlatformStats,
  FacilitySummary,
  FacilityDeepView,
  BenchmarkMetric,
  FacilityBenchmark,
  StrategicInsight,
  BenchmarkMetricKey,
} from '@/types';

// 1単位あたりの円単価（デフォルト）
const DEFAULT_UNIT_PRICE = 10;

// ─── ヘルパー関数 ───

/** 対象年月の営業日数（概算：平日数） */
function getBusinessDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  // 概算: 日数 * 5/7
  return Math.round(daysInMonth * 5 / 7);
}

/** 前月の年月文字列を返す */
function getPreviousMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** 対象年月の開始日と終了日を返す */
function getMonthRange(yearMonth: string): { startDate: string; endDate: string } {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** 配列の合計を計算 */
function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** 安全な除算（ゼロ除算回避） */
function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0) return fallback;
  return numerator / denominator;
}

// ─── ベンチマーク指標定義 ───

export const BENCHMARK_METRICS: {
  key: BenchmarkMetricKey;
  label: string;
  unit: string;
  format: (v: number) => string;
}[] = [
  { key: 'revenue_per_child', label: '児童1人あたり月額売上', unit: '円', format: (v) => `\u00A5${v.toLocaleString()}` },
  { key: 'staff_child_ratio', label: '職員児童比率', unit: '倍', format: (v) => `${v.toFixed(2)}倍` },
  { key: 'utilization_rate', label: '利用率', unit: '%', format: (v) => `${v.toFixed(1)}%` },
  { key: 'addition_count', label: '加算取得数', unit: '個', format: (v) => `${v}個` },
  { key: 'profit_margin', label: '利益率', unit: '%', format: (v) => `${v.toFixed(1)}%` },
  { key: 'staff_retention', label: '職員定着率', unit: '%', format: (v) => `${v.toFixed(1)}%` },
  { key: 'average_rating', label: '平均評価', unit: '点', format: (v) => `${v.toFixed(1)}点` },
];

// ─── フック本体 ───

export const usePlatformAdmin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ════════════════════════════════════════════
  // 統計ヘルパー
  // ════════════════════════════════════════════

  /** 偏差値を計算（平均50、標準偏差10） */
  const calculateDeviationScore = useCallback((value: number, mean: number, stdDev: number): number => {
    if (stdDev === 0) return 50;
    return Math.round(50 + 10 * (value - mean) / stdDev);
  }, []);

  /** パーセンタイル順位を計算 */
  const calculatePercentile = useCallback((value: number, sortedValues: number[]): number => {
    if (sortedValues.length === 0) return 0;
    const below = sortedValues.filter(v => v < value).length;
    return Math.round((below / sortedValues.length) * 100);
  }, []);

  /** ソート済み配列から指定パーセンタイルの値を取得 */
  const getPercentileValue = useCallback((sortedValues: number[], percentile: number): number => {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)] || 0;
  }, []);

  // ════════════════════════════════════════════
  // プラットフォーム全体統計
  // ════════════════════════════════════════════

  const fetchPlatformStats = useCallback(async (yearMonth: string): Promise<PlatformStats> => {
    setIsLoading(true);
    setError(null);

    const emptyStats: PlatformStats = {
      totalCompanies: 0,
      totalFacilities: 0,
      totalStaff: 0,
      totalChildren: 0,
      totalMonthlyRevenue: 0,
      averageUtilizationRate: 0,
      companyGrowth: 0,
      facilityGrowth: 0,
      staffGrowth: 0,
      childrenGrowth: 0,
      revenueGrowth: 0,
    };

    try {
      const prevMonth = getPreviousMonth(yearMonth);
      const { startDate, endDate } = getMonthRange(yearMonth);
      const { startDate: prevStartDate, endDate: prevEndDate } = getMonthRange(prevMonth);

      // 並列でカウント・売上データを取得
      const [
        companiesResult,
        facilitiesResult,
        staffResult,
        childrenResult,
        billingResult,
        prevBillingResult,
        usageResult,
        facilitiesForCapacity,
      ] = await Promise.all([
        // 法人数
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        // 施設数
        supabase.from('facilities').select('*', { count: 'exact', head: true }),
        // 職員数
        supabase.from('staff').select('*', { count: 'exact', head: true }),
        // 児童数（契約中）
        supabase.from('children').select('*', { count: 'exact', head: true })
          .in('contract_status', ['active', 'pre-contract']),
        // 当月売上
        supabase.from('billing_records').select('total_amount')
          .eq('year_month', yearMonth),
        // 前月売上
        supabase.from('billing_records').select('total_amount')
          .eq('year_month', prevMonth),
        // 利用実績（当月）
        supabase.from('usage_records').select('facility_id, child_id')
          .gte('date', startDate)
          .lte('date', endDate),
        // 施設定員（利用率計算用）
        supabase.from('facilities').select('id, capacity_total'),
      ]);

      const totalCompanies = companiesResult.count || 0;
      const totalFacilities = facilitiesResult.count || 0;
      const totalStaff = staffResult.count || 0;
      const totalChildren = childrenResult.count || 0;

      // 当月売上合計
      const totalMonthlyRevenue = sum(
        (billingResult.data || []).map((r: Record<string, unknown>) => (r.total_amount as number) || 0)
      );

      // 前月売上合計
      const prevMonthlyRevenue = sum(
        (prevBillingResult.data || []).map((r: Record<string, unknown>) => (r.total_amount as number) || 0)
      );

      // 利用率計算
      const usageData = usageResult.data || [];
      const totalUsageDays = usageData.length;
      const businessDays = getBusinessDaysInMonth(yearMonth);
      const totalCapacityDays = sum(
        (facilitiesForCapacity.data || []).map(
          (f: Record<string, unknown>) => ((f.capacity_total as number) || 10) * businessDays
        )
      );
      const averageUtilizationRate = safeDivide(totalUsageDays, totalCapacityDays) * 100;

      // 前月比の計算（簡易：売上のみ正確に比較、他は0とする）
      const revenueGrowth = prevMonthlyRevenue > 0
        ? ((totalMonthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100
        : 0;

      const stats: PlatformStats = {
        totalCompanies,
        totalFacilities,
        totalStaff,
        totalChildren,
        totalMonthlyRevenue,
        averageUtilizationRate,
        companyGrowth: 0, // 前月法人数の差分は別途比較が必要
        facilityGrowth: 0,
        staffGrowth: 0,
        childrenGrowth: 0,
        revenueGrowth,
      };

      return stats;
    } catch (err) {
      const message = 'プラットフォーム統計の取得に失敗しました';
      console.error(message, err);
      setError(message);
      return emptyStats;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ════════════════════════════════════════════
  // 全施設一覧
  // ════════════════════════════════════════════

  const fetchAllFacilities = useCallback(async (yearMonth: string): Promise<FacilitySummary[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getMonthRange(yearMonth);
      const businessDays = getBusinessDaysInMonth(yearMonth);

      // 1. 全施設取得（法人名JOIN）
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('facilities')
        .select(`
          id, name, code, company_id, franchise_or_independent,
          prefecture_code, city_code, pre_registered, verification_status,
          certification_status, average_rating, review_count,
          platform_notes, capacity_total, service_category,
          created_at,
          companies(name)
        `)
        .order('created_at', { ascending: false });

      if (facilitiesError) {
        console.error('Error fetching facilities:', facilitiesError);
        setError('施設一覧の取得に失敗しました');
        return [];
      }

      const facilities = facilitiesData || [];
      const facilityIds = facilities.map((f: Record<string, unknown>) => f.id as string);

      if (facilityIds.length === 0) return [];

      // 2. 並列で集計データを取得
      const [
        billingResult,
        staffResult,
        childrenResult,
        usageResult,
        additionResult,
      ] = await Promise.all([
        // 施設ごとの売上
        supabase.from('billing_records')
          .select('facility_id, total_amount')
          .eq('year_month', yearMonth)
          .in('facility_id', facilityIds),
        // 施設ごとの職員数
        supabase.from('staff')
          .select('facility_id')
          .in('facility_id', facilityIds),
        // 施設ごとの児童数
        supabase.from('children')
          .select('facility_id')
          .in('facility_id', facilityIds)
          .in('contract_status', ['active', 'pre-contract']),
        // 施設ごとの利用実績（当月）
        supabase.from('usage_records')
          .select('facility_id')
          .gte('date', startDate)
          .lte('date', endDate)
          .in('facility_id', facilityIds),
        // 施設ごとの有効加算数
        supabase.from('facility_addition_settings')
          .select('facility_id')
          .eq('is_enabled', true)
          .in('facility_id', facilityIds),
      ]);

      // JS側でグルーピング
      const revenueByFacility = new Map<string, number>();
      for (const rec of (billingResult.data || [])) {
        const fid = rec.facility_id as string;
        revenueByFacility.set(fid, (revenueByFacility.get(fid) || 0) + ((rec.total_amount as number) || 0));
      }

      const staffCountByFacility = new Map<string, number>();
      for (const rec of (staffResult.data || [])) {
        const fid = rec.facility_id as string;
        staffCountByFacility.set(fid, (staffCountByFacility.get(fid) || 0) + 1);
      }

      const childCountByFacility = new Map<string, number>();
      for (const rec of (childrenResult.data || [])) {
        const fid = rec.facility_id as string;
        childCountByFacility.set(fid, (childCountByFacility.get(fid) || 0) + 1);
      }

      const usageCountByFacility = new Map<string, number>();
      for (const rec of (usageResult.data || [])) {
        const fid = rec.facility_id as string;
        usageCountByFacility.set(fid, (usageCountByFacility.get(fid) || 0) + 1);
      }

      const additionCountByFacility = new Map<string, number>();
      for (const rec of (additionResult.data || [])) {
        const fid = rec.facility_id as string;
        additionCountByFacility.set(fid, (additionCountByFacility.get(fid) || 0) + 1);
      }

      // 3. マージして FacilitySummary[] を生成
      const summaries: FacilitySummary[] = facilities.map((f: Record<string, unknown>) => {
        const fid = f.id as string;
        const capacity = (f.capacity_total as number) || 10;
        const usageCount = usageCountByFacility.get(fid) || 0;
        const totalCapacityDays = capacity * businessDays;
        const utilizationRate = safeDivide(usageCount, totalCapacityDays) * 100;

        const company = f.companies as Record<string, unknown> | null;

        return {
          id: fid,
          name: f.name as string,
          code: (f.code as string) || '',
          companyId: (f.company_id as string) || undefined,
          companyName: (company?.name as string) || undefined,
          franchiseOrIndependent: (f.franchise_or_independent as string) || undefined,
          prefectureCode: (f.prefecture_code as string) || undefined,
          cityCode: (f.city_code as string) || undefined,
          preRegistered: (f.pre_registered as boolean) || false,
          verificationStatus: (f.verification_status as string) || undefined,
          certificationStatus: (f.certification_status as string) || undefined,
          averageRating: (f.average_rating as number) || undefined,
          reviewCount: (f.review_count as number) || undefined,
          platformNotes: (f.platform_notes as string) || undefined,
          capacityTotal: capacity,
          serviceCategory: (f.service_category as string) || undefined,
          createdAt: f.created_at as string,
          staffCount: staffCountByFacility.get(fid) || 0,
          childrenCount: childCountByFacility.get(fid) || 0,
          monthlyRevenue: revenueByFacility.get(fid) || 0,
          utilizationRate: Math.round(utilizationRate * 10) / 10,
          additionCount: additionCountByFacility.get(fid) || 0,
        };
      });

      return summaries;
    } catch (err) {
      const message = '施設一覧の取得中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ════════════════════════════════════════════
  // 施設ディープビュー
  // ════════════════════════════════════════════

  const fetchFacilityDeepView = useCallback(async (
    facilityId: string,
    yearMonth: string
  ): Promise<FacilityDeepView | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getMonthRange(yearMonth);
      const businessDays = getBusinessDaysInMonth(yearMonth);

      // 並列で各データを取得
      const [
        facilityResult,
        billingResult,
        staffResult,
        employmentResult,
        childrenResult,
        usageResult,
        additionSettingsResult,
        additionsMasterResult,
      ] = await Promise.all([
        // 施設基本情報
        supabase.from('facilities')
          .select(`
            id, name, code, company_id, franchise_or_independent,
            prefecture_code, city_code, pre_registered, verification_status,
            certification_status, average_rating, review_count,
            platform_notes, capacity_total, service_category,
            created_at,
            companies(name)
          `)
          .eq('id', facilityId)
          .single(),
        // 請求レコード
        supabase.from('billing_records')
          .select('*, children(name)')
          .eq('facility_id', facilityId)
          .eq('year_month', yearMonth),
        // スタッフ
        supabase.from('staff')
          .select('id, name, qualifications, years_of_experience')
          .eq('facility_id', facilityId),
        // 雇用情報
        supabase.from('employment_records')
          .select('id, user_id, facility_id, role, employment_type, start_date, end_date')
          .eq('facility_id', facilityId),
        // 児童
        supabase.from('children')
          .select('id, name, contract_status, grant_days')
          .eq('facility_id', facilityId)
          .in('contract_status', ['active', 'pre-contract']),
        // 利用実績（当月）
        supabase.from('usage_records')
          .select('child_id')
          .eq('facility_id', facilityId)
          .gte('date', startDate)
          .lte('date', endDate),
        // 加算設定
        supabase.from('facility_addition_settings')
          .select('addition_code, is_enabled')
          .eq('facility_id', facilityId),
        // 加算マスタ
        supabase.from('additions')
          .select('code, name, units')
          .eq('is_active', true),
      ]);

      if (facilityResult.error || !facilityResult.data) {
        console.error('Error fetching facility:', facilityResult.error);
        setError('施設情報の取得に失敗しました');
        return null;
      }

      const f = facilityResult.data as Record<string, unknown>;
      const company = f.companies as Record<string, unknown> | null;
      const capacity = (f.capacity_total as number) || 10;

      // ── 請求データ集計 ──
      const billingRecords = (billingResult.data || []).map((r: Record<string, unknown>) => ({
        childName: ((r.children as Record<string, unknown> | null)?.name as string) || '不明',
        serviceType: (r.service_type as string) || '',
        totalUnits: (r.total_units as number) || 0,
        totalAmount: (r.total_amount as number) || 0,
        copayAmount: (r.copay_amount as number) || 0,
        insuranceAmount: (r.insurance_amount as number) || 0,
        status: (r.status as string) || 'draft',
      }));

      const totalRevenue = sum(billingRecords.map(r => r.totalAmount));
      const copayTotal = sum(billingRecords.map(r => r.copayAmount));

      // 加算売上は総売上の概算（加算比率を簡易推定）
      // 基本報酬を仮定して差分を加算売上とする
      const baseRevenueEstimate = billingRecords.length > 0
        ? sum(billingRecords.map(() => 604 * DEFAULT_UNIT_PRICE)) // 基本単位604（放デイ想定）
        : 0;
      const additionRevenue = Math.max(0, totalRevenue - baseRevenueEstimate);

      const revenueBreakdown = {
        baseRevenue: baseRevenueEstimate,
        additionRevenue,
        totalRevenue,
        copayTotal,
      };

      // ── スタッフデータ ──
      const staffData = staffResult.data || [];
      const employmentData = employmentResult.data || [];

      // 雇用情報をuser_idでマップ
      const employmentMap = new Map<string, Record<string, unknown>>();
      for (const emp of employmentData) {
        employmentMap.set(emp.user_id as string, emp as Record<string, unknown>);
      }

      const staffList = staffData.map((s: Record<string, unknown>) => {
        const emp = employmentMap.get(s.id as string);
        let qualifications: string[] = [];
        if (s.qualifications) {
          if (Array.isArray(s.qualifications)) {
            qualifications = s.qualifications as string[];
          } else if (typeof s.qualifications === 'string') {
            qualifications = (s.qualifications as string).split(',').map((q: string) => q.trim());
          }
        }

        return {
          id: s.id as string,
          name: (s.name as string) || '',
          role: (emp?.role as string) || 'staff',
          employmentType: (emp?.employment_type as string) || 'unknown',
          qualifications,
          startDate: (emp?.start_date as string) || '',
        };
      });

      // スタッフ構成
      const fulltimeCount = staffList.filter(s => s.employmentType === 'fulltime').length;
      const parttimeCount = staffList.length - fulltimeCount;
      const qualifiedCount = staffList.filter(s => s.qualifications.length > 0).length;
      // 常勤換算（フルタイム=1.0、パートタイム=0.5概算）
      const fte = fulltimeCount + parttimeCount * 0.5;

      const staffComposition = {
        fulltime: fulltimeCount,
        parttime: parttimeCount,
        qualified: qualifiedCount,
        total: staffList.length,
        fte,
      };

      // ── 児童データ ──
      const childrenData = childrenResult.data || [];
      const usageData = usageResult.data || [];

      // 児童ごとの利用日数
      const usageCountByChild = new Map<string, number>();
      for (const u of usageData) {
        const cid = u.child_id as string;
        usageCountByChild.set(cid, (usageCountByChild.get(cid) || 0) + 1);
      }

      const childrenList = childrenData.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: (c.name as string) || '',
        contractStatus: (c.contract_status as string) || '',
        grantDays: (c.grant_days as number) || undefined,
        usageDaysThisMonth: usageCountByChild.get(c.id as string) || 0,
      }));

      // ── 加算データ ──
      const additionSettings = additionSettingsResult.data || [];
      const additionsMaster = additionsMasterResult.data || [];

      // 加算マスタをコードでマップ
      const additionMasterMap = new Map<string, Record<string, unknown>>();
      for (const a of additionsMaster) {
        additionMasterMap.set(a.code as string, a as Record<string, unknown>);
      }

      const activeAdditions = additionSettings.map((a: Record<string, unknown>) => {
        const master = additionMasterMap.get(a.addition_code as string);
        return {
          code: a.addition_code as string,
          name: (master?.name as string) || a.addition_code as string,
          units: (master?.units as number) || 0,
          isActive: (a.is_enabled as boolean) || false,
        };
      });

      // 未取得加算の機会（有効でない加算を特定）
      const enabledCodes = new Set(
        additionSettings
          .filter((a: Record<string, unknown>) => a.is_enabled)
          .map((a: Record<string, unknown>) => a.addition_code as string)
      );

      const additionOpportunities: FacilityDeepView['additionOpportunities'] = [];
      for (const master of additionsMaster) {
        const code = master.code as string;
        if (!enabledCodes.has(code)) {
          const units = (master.units as number) || 0;
          const estimatedRevenue = units * DEFAULT_UNIT_PRICE * childrenData.length * 20; // 月20日想定
          if (estimatedRevenue > 0) {
            additionOpportunities.push({
              name: (master.name as string) || code,
              estimatedRevenue,
              gapDescription: `${(master.name as string) || code}が未取得です。取得により月額約${estimatedRevenue.toLocaleString()}円の増収が見込めます。`,
            });
          }
        }
      }
      // 上位5件に制限
      additionOpportunities.sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);
      additionOpportunities.splice(5);

      // ── 利用率 ──
      const totalCapacityDays = capacity * businessDays;
      const actualUsageDays = usageData.length;
      const utilizationRate = safeDivide(actualUsageDays, totalCapacityDays) * 100;

      // ── FacilitySummary構築 ──
      const facilitySummary: FacilitySummary = {
        id: f.id as string,
        name: f.name as string,
        code: (f.code as string) || '',
        companyId: (f.company_id as string) || undefined,
        companyName: (company?.name as string) || undefined,
        franchiseOrIndependent: (f.franchise_or_independent as string) || undefined,
        prefectureCode: (f.prefecture_code as string) || undefined,
        cityCode: (f.city_code as string) || undefined,
        preRegistered: (f.pre_registered as boolean) || false,
        verificationStatus: (f.verification_status as string) || undefined,
        certificationStatus: (f.certification_status as string) || undefined,
        averageRating: (f.average_rating as number) || undefined,
        reviewCount: (f.review_count as number) || undefined,
        platformNotes: (f.platform_notes as string) || undefined,
        capacityTotal: capacity,
        serviceCategory: (f.service_category as string) || undefined,
        createdAt: f.created_at as string,
        staffCount: staffList.length,
        childrenCount: childrenData.length,
        monthlyRevenue: totalRevenue,
        utilizationRate: Math.round(utilizationRate * 10) / 10,
        additionCount: activeAdditions.filter(a => a.isActive).length,
      };

      const deepView: FacilityDeepView = {
        facility: facilitySummary,
        billingRecords,
        revenueBreakdown,
        staffList,
        staffComposition,
        childrenList,
        activeAdditions,
        additionOpportunities,
        utilizationDetails: {
          totalCapacityDays,
          actualUsageDays,
          rate: Math.round(utilizationRate * 10) / 10,
        },
      };

      return deepView;
    } catch (err) {
      const message = '施設詳細の取得中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ════════════════════════════════════════════
  // 法人管理
  // ════════════════════════════════════════════

  const fetchCompanies = useCallback(async (yearMonth: string): Promise<CompanyExtended[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. 全法人取得
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

      if (companiesError) {
        console.error('Error fetching companies:', companiesError);
        setError('法人一覧の取得に失敗しました');
        return [];
      }

      const companies = companiesData || [];
      if (companies.length === 0) return [];

      const companyIds = companies.map((c: Record<string, unknown>) => c.id as string);

      // 2. 施設・売上集計を並列取得
      const [facilitiesResult, billingResult, staffResult, childrenResult] = await Promise.all([
        // 法人ごとの施設数
        supabase.from('facilities')
          .select('id, company_id')
          .in('company_id', companyIds),
        // 法人ごとの売上（施設→法人の紐付けが必要）
        supabase.from('billing_records')
          .select('facility_id, total_amount')
          .eq('year_month', yearMonth),
        // 職員数（施設経由）
        supabase.from('staff')
          .select('facility_id'),
        // 児童数（施設経由）
        supabase.from('children')
          .select('facility_id')
          .in('contract_status', ['active', 'pre-contract']),
      ]);

      // 施設→法人のマッピング
      const facilityToCompany = new Map<string, string>();
      const facilityCountByCompany = new Map<string, number>();
      for (const fac of (facilitiesResult.data || [])) {
        const companyId = fac.company_id as string;
        const facId = fac.id as string;
        if (companyId) {
          facilityToCompany.set(facId, companyId);
          facilityCountByCompany.set(companyId, (facilityCountByCompany.get(companyId) || 0) + 1);
        }
      }

      // 法人ごとの売上集計
      const revenueByCompany = new Map<string, number>();
      for (const rec of (billingResult.data || [])) {
        const facId = rec.facility_id as string;
        const companyId = facilityToCompany.get(facId);
        if (companyId) {
          revenueByCompany.set(companyId, (revenueByCompany.get(companyId) || 0) + ((rec.total_amount as number) || 0));
        }
      }

      // 法人ごとの職員数集計
      const staffByCompany = new Map<string, number>();
      for (const rec of (staffResult.data || [])) {
        const facId = rec.facility_id as string;
        const companyId = facilityToCompany.get(facId);
        if (companyId) {
          staffByCompany.set(companyId, (staffByCompany.get(companyId) || 0) + 1);
        }
      }

      // 法人ごとの児童数集計
      const childrenByCompany = new Map<string, number>();
      for (const rec of (childrenResult.data || [])) {
        const facId = rec.facility_id as string;
        const companyId = facilityToCompany.get(facId);
        if (companyId) {
          childrenByCompany.set(companyId, (childrenByCompany.get(companyId) || 0) + 1);
        }
      }

      // 3. CompanyExtended[] を構築
      const result: CompanyExtended[] = companies.map((c: Record<string, unknown>) => {
        const cid = c.id as string;
        return {
          id: cid,
          name: (c.name as string) || '',
          companyType: (c.company_type as CompanyExtended['companyType']) || 'independent',
          franchiseBrand: (c.franchise_brand as string) || undefined,
          contactPersonName: (c.contact_person_name as string) || undefined,
          contactPersonEmail: (c.contact_person_email as string) || undefined,
          contractStartDate: (c.contract_start_date as string) || undefined,
          contractEndDate: (c.contract_end_date as string) || undefined,
          contractAmount: (c.contract_amount as number) || undefined,
          contractTier: (c.contract_tier as CompanyExtended['contractTier']) || 'standard',
          monthlyFee: (c.monthly_fee as number) || undefined,
          contractStatus: (c.contract_status as CompanyExtended['contractStatus']) || 'active',
          address: (c.address as string) || undefined,
          phone: (c.phone as string) || undefined,
          notes: (c.notes as string) || undefined,
          createdAt: c.created_at as string,
          updatedAt: c.updated_at as string,
          facilityCount: facilityCountByCompany.get(cid) || 0,
          totalRevenue: revenueByCompany.get(cid) || 0,
          totalStaff: staffByCompany.get(cid) || 0,
          totalChildren: childrenByCompany.get(cid) || 0,
        };
      });

      return result;
    } catch (err) {
      const message = '法人一覧の取得中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCompany = useCallback(async (data: Partial<CompanyExtended>): Promise<CompanyExtended | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      const insertData: Record<string, unknown> = {
        name: data.name || '',
        company_type: data.companyType || 'independent',
        franchise_brand: data.franchiseBrand || null,
        contact_person_name: data.contactPersonName || null,
        contact_person_email: data.contactPersonEmail || null,
        contract_start_date: data.contractStartDate || null,
        contract_end_date: data.contractEndDate || null,
        contract_amount: data.contractAmount || null,
        contract_tier: data.contractTier || 'standard',
        monthly_fee: data.monthlyFee || null,
        contract_status: data.contractStatus || 'active',
        address: data.address || null,
        phone: data.phone || null,
        notes: data.notes || null,
        created_at: now,
        updated_at: now,
      };

      const { data: result, error: insertError } = await supabase
        .from('companies')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating company:', insertError);
        setError('法人の作成に失敗しました');
        return null;
      }

      const row = result as Record<string, unknown>;
      return {
        id: row.id as string,
        name: (row.name as string) || '',
        companyType: (row.company_type as CompanyExtended['companyType']) || 'independent',
        franchiseBrand: (row.franchise_brand as string) || undefined,
        contactPersonName: (row.contact_person_name as string) || undefined,
        contactPersonEmail: (row.contact_person_email as string) || undefined,
        contractStartDate: (row.contract_start_date as string) || undefined,
        contractEndDate: (row.contract_end_date as string) || undefined,
        contractAmount: (row.contract_amount as number) || undefined,
        contractTier: (row.contract_tier as CompanyExtended['contractTier']) || 'standard',
        monthlyFee: (row.monthly_fee as number) || undefined,
        contractStatus: (row.contract_status as CompanyExtended['contractStatus']) || 'active',
        address: (row.address as string) || undefined,
        phone: (row.phone as string) || undefined,
        notes: (row.notes as string) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        facilityCount: 0,
        totalRevenue: 0,
      };
    } catch (err) {
      const message = '法人の作成中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCompany = useCallback(async (id: string, data: Partial<CompanyExtended>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) dbUpdates.name = data.name;
      if (data.companyType !== undefined) dbUpdates.company_type = data.companyType;
      if (data.franchiseBrand !== undefined) dbUpdates.franchise_brand = data.franchiseBrand;
      if (data.contactPersonName !== undefined) dbUpdates.contact_person_name = data.contactPersonName;
      if (data.contactPersonEmail !== undefined) dbUpdates.contact_person_email = data.contactPersonEmail;
      if (data.contractStartDate !== undefined) dbUpdates.contract_start_date = data.contractStartDate;
      if (data.contractEndDate !== undefined) dbUpdates.contract_end_date = data.contractEndDate;
      if (data.contractAmount !== undefined) dbUpdates.contract_amount = data.contractAmount;
      if (data.contractTier !== undefined) dbUpdates.contract_tier = data.contractTier;
      if (data.monthlyFee !== undefined) dbUpdates.monthly_fee = data.monthlyFee;
      if (data.contractStatus !== undefined) dbUpdates.contract_status = data.contractStatus;
      if (data.address !== undefined) dbUpdates.address = data.address;
      if (data.phone !== undefined) dbUpdates.phone = data.phone;
      if (data.notes !== undefined) dbUpdates.notes = data.notes;

      const { error: updateError } = await supabase
        .from('companies')
        .update(dbUpdates)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating company:', updateError);
        setError('法人の更新に失敗しました');
        return false;
      }

      return true;
    } catch (err) {
      const message = '法人の更新中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteCompany = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 紐付き施設があるか確認
      const { count } = await supabase
        .from('facilities')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', id);

      if (count && count > 0) {
        setError(`この法人には${count}件の施設が紐付いています。先に施設の紐付けを解除してください。`);
        return false;
      }

      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting company:', deleteError);
        setError('法人の削除に失敗しました');
        return false;
      }

      return true;
    } catch (err) {
      const message = '法人の削除中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const linkFacilityToCompany = useCallback(async (
    facilityId: string,
    companyId: string | null
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('facilities')
        .update({
          company_id: companyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', facilityId);

      if (updateError) {
        console.error('Error linking facility to company:', updateError);
        setError('施設の法人紐付けに失敗しました');
        return false;
      }

      return true;
    } catch (err) {
      const message = '施設の法人紐付け中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ════════════════════════════════════════════
  // ベンチマーク
  // ════════════════════════════════════════════

  const fetchBenchmarkData = useCallback(async (
    yearMonth: string,
    metricKey: BenchmarkMetricKey
  ): Promise<{
    metric: BenchmarkMetric;
    facilities: FacilityBenchmark[];
  }> => {
    setIsLoading(true);
    setError(null);

    const emptyResult = {
      metric: {
        metricName: metricKey,
        metricLabel: BENCHMARK_METRICS.find(m => m.key === metricKey)?.label || metricKey,
        p25: 0, p50: 0, p75: 0, p90: 0,
        meanValue: 0, stdDev: 0, sampleSize: 0,
      },
      facilities: [],
    };

    try {
      const { startDate, endDate } = getMonthRange(yearMonth);
      const businessDays = getBusinessDaysInMonth(yearMonth);

      // 全施設の基本情報を取得
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('facilities')
        .select('id, name, company_id, capacity_total, average_rating, companies(name)');

      if (facilitiesError || !facilitiesData || facilitiesData.length === 0) {
        console.error('Error fetching facilities for benchmark:', facilitiesError);
        return emptyResult;
      }

      const facilityIds = facilitiesData.map((f: Record<string, unknown>) => f.id as string);

      // 指標に応じたデータを取得
      let facilityValues: { facilityId: string; facilityName: string; companyName?: string; value: number }[] = [];

      if (metricKey === 'revenue_per_child') {
        // 児童1人あたり月額売上
        const [billingResult, childrenResult] = await Promise.all([
          supabase.from('billing_records')
            .select('facility_id, total_amount')
            .eq('year_month', yearMonth)
            .in('facility_id', facilityIds),
          supabase.from('children')
            .select('facility_id')
            .in('facility_id', facilityIds)
            .in('contract_status', ['active', 'pre-contract']),
        ]);

        const revenueByFacility = new Map<string, number>();
        for (const r of (billingResult.data || [])) {
          const fid = r.facility_id as string;
          revenueByFacility.set(fid, (revenueByFacility.get(fid) || 0) + ((r.total_amount as number) || 0));
        }

        const childCountByFacility = new Map<string, number>();
        for (const c of (childrenResult.data || [])) {
          const fid = c.facility_id as string;
          childCountByFacility.set(fid, (childCountByFacility.get(fid) || 0) + 1);
        }

        facilityValues = facilitiesData
          .filter((f: Record<string, unknown>) => (childCountByFacility.get(f.id as string) || 0) > 0)
          .map((f: Record<string, unknown>) => {
            const fid = f.id as string;
            const revenue = revenueByFacility.get(fid) || 0;
            const children = childCountByFacility.get(fid) || 1;
            const company = f.companies as Record<string, unknown> | null;
            return {
              facilityId: fid,
              facilityName: f.name as string,
              companyName: (company?.name as string) || undefined,
              value: Math.round(revenue / children),
            };
          });

      } else if (metricKey === 'staff_child_ratio') {
        // 職員児童比率
        const [staffResult, childrenResult] = await Promise.all([
          supabase.from('staff')
            .select('facility_id')
            .in('facility_id', facilityIds),
          supabase.from('children')
            .select('facility_id')
            .in('facility_id', facilityIds)
            .in('contract_status', ['active', 'pre-contract']),
        ]);

        const staffCountByFacility = new Map<string, number>();
        for (const s of (staffResult.data || [])) {
          const fid = s.facility_id as string;
          staffCountByFacility.set(fid, (staffCountByFacility.get(fid) || 0) + 1);
        }

        const childCountByFacility = new Map<string, number>();
        for (const c of (childrenResult.data || [])) {
          const fid = c.facility_id as string;
          childCountByFacility.set(fid, (childCountByFacility.get(fid) || 0) + 1);
        }

        facilityValues = facilitiesData
          .filter((f: Record<string, unknown>) => (childCountByFacility.get(f.id as string) || 0) > 0)
          .map((f: Record<string, unknown>) => {
            const fid = f.id as string;
            const staff = staffCountByFacility.get(fid) || 0;
            const children = childCountByFacility.get(fid) || 1;
            const company = f.companies as Record<string, unknown> | null;
            return {
              facilityId: fid,
              facilityName: f.name as string,
              companyName: (company?.name as string) || undefined,
              value: Math.round((staff / children) * 100) / 100,
            };
          });

      } else if (metricKey === 'utilization_rate') {
        // 利用率
        const { data: usageData } = await supabase
          .from('usage_records')
          .select('facility_id')
          .gte('date', startDate)
          .lte('date', endDate)
          .in('facility_id', facilityIds);

        const usageCountByFacility = new Map<string, number>();
        for (const u of (usageData || [])) {
          const fid = u.facility_id as string;
          usageCountByFacility.set(fid, (usageCountByFacility.get(fid) || 0) + 1);
        }

        facilityValues = facilitiesData.map((f: Record<string, unknown>) => {
          const fid = f.id as string;
          const capacity = (f.capacity_total as number) || 10;
          const totalCapacity = capacity * businessDays;
          const usageCount = usageCountByFacility.get(fid) || 0;
          const rate = safeDivide(usageCount, totalCapacity) * 100;
          const company = f.companies as Record<string, unknown> | null;
          return {
            facilityId: fid,
            facilityName: f.name as string,
            companyName: (company?.name as string) || undefined,
            value: Math.round(rate * 10) / 10,
          };
        });

      } else if (metricKey === 'addition_count') {
        // 加算取得数
        const { data: additionData } = await supabase
          .from('facility_addition_settings')
          .select('facility_id')
          .eq('is_enabled', true)
          .in('facility_id', facilityIds);

        const additionCountByFacility = new Map<string, number>();
        for (const a of (additionData || [])) {
          const fid = a.facility_id as string;
          additionCountByFacility.set(fid, (additionCountByFacility.get(fid) || 0) + 1);
        }

        facilityValues = facilitiesData.map((f: Record<string, unknown>) => {
          const fid = f.id as string;
          const company = f.companies as Record<string, unknown> | null;
          return {
            facilityId: fid,
            facilityName: f.name as string,
            companyName: (company?.name as string) || undefined,
            value: additionCountByFacility.get(fid) || 0,
          };
        });

      } else if (metricKey === 'profit_margin') {
        // 利益率（キャッシュフローから）
        const { data: cashflowData } = await supabase
          .from('cashflow_entries')
          .select('facility_id, category, amount')
          .eq('year_month', yearMonth)
          .in('facility_id', facilityIds);

        const incomeByFacility = new Map<string, number>();
        const expenseByFacility = new Map<string, number>();

        for (const entry of (cashflowData || [])) {
          const fid = entry.facility_id as string;
          const amount = (entry.amount as number) || 0;
          if (entry.category === 'income') {
            incomeByFacility.set(fid, (incomeByFacility.get(fid) || 0) + amount);
          } else {
            expenseByFacility.set(fid, (expenseByFacility.get(fid) || 0) + amount);
          }
        }

        facilityValues = facilitiesData
          .filter((f: Record<string, unknown>) => (incomeByFacility.get(f.id as string) || 0) > 0)
          .map((f: Record<string, unknown>) => {
            const fid = f.id as string;
            const income = incomeByFacility.get(fid) || 0;
            const expense = expenseByFacility.get(fid) || 0;
            const margin = safeDivide((income - expense), income) * 100;
            const company = f.companies as Record<string, unknown> | null;
            return {
              facilityId: fid,
              facilityName: f.name as string,
              companyName: (company?.name as string) || undefined,
              value: Math.round(margin * 10) / 10,
            };
          });

      } else if (metricKey === 'staff_retention') {
        // 職員定着率
        const { data: employmentData } = await supabase
          .from('employment_records')
          .select('facility_id, end_date')
          .in('facility_id', facilityIds);

        const totalByFacility = new Map<string, number>();
        const activeByFacility = new Map<string, number>();

        for (const emp of (employmentData || [])) {
          const fid = emp.facility_id as string;
          totalByFacility.set(fid, (totalByFacility.get(fid) || 0) + 1);
          if (!emp.end_date) {
            activeByFacility.set(fid, (activeByFacility.get(fid) || 0) + 1);
          }
        }

        facilityValues = facilitiesData
          .filter((f: Record<string, unknown>) => (totalByFacility.get(f.id as string) || 0) > 0)
          .map((f: Record<string, unknown>) => {
            const fid = f.id as string;
            const total = totalByFacility.get(fid) || 1;
            const active = activeByFacility.get(fid) || 0;
            const retention = safeDivide(active, total) * 100;
            const company = f.companies as Record<string, unknown> | null;
            return {
              facilityId: fid,
              facilityName: f.name as string,
              companyName: (company?.name as string) || undefined,
              value: Math.round(retention * 10) / 10,
            };
          });

      } else if (metricKey === 'average_rating') {
        // 平均評価
        facilityValues = facilitiesData
          .filter((f: Record<string, unknown>) => (f.average_rating as number) != null)
          .map((f: Record<string, unknown>) => {
            const company = f.companies as Record<string, unknown> | null;
            return {
              facilityId: f.id as string,
              facilityName: f.name as string,
              companyName: (company?.name as string) || undefined,
              value: Math.round(((f.average_rating as number) || 0) * 10) / 10,
            };
          });
      }

      // サンプルが無い場合
      if (facilityValues.length === 0) {
        return emptyResult;
      }

      // ── 統計計算 ──
      const values = facilityValues.map(fv => fv.value);
      const sortedValues = [...values].sort((a, b) => a - b);
      const sampleSize = sortedValues.length;
      const meanValue = sum(sortedValues) / sampleSize;
      const variance = sum(sortedValues.map(v => (v - meanValue) ** 2)) / sampleSize;
      const stdDev = Math.sqrt(variance);

      const metric: BenchmarkMetric = {
        metricName: metricKey,
        metricLabel: BENCHMARK_METRICS.find(m => m.key === metricKey)?.label || metricKey,
        p25: getPercentileValue(sortedValues, 25),
        p50: getPercentileValue(sortedValues, 50),
        p75: getPercentileValue(sortedValues, 75),
        p90: getPercentileValue(sortedValues, 90),
        meanValue: Math.round(meanValue * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        sampleSize,
      };

      // ── 施設ごとのベンチマーク結果 ──
      const facilities: FacilityBenchmark[] = facilityValues.map(fv => ({
        facilityId: fv.facilityId,
        facilityName: fv.facilityName,
        companyName: fv.companyName,
        value: fv.value,
        percentile: calculatePercentile(fv.value, sortedValues),
        deviationScore: calculateDeviationScore(fv.value, meanValue, stdDev),
        rank: 0, // ランクは後で計算
      }));

      // ランクを降順（値が大きい方が上位）で設定
      facilities.sort((a, b) => b.value - a.value);
      facilities.forEach((f, index) => {
        f.rank = index + 1;
      });

      return { metric, facilities };
    } catch (err) {
      const message = 'ベンチマークデータの取得中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return emptyResult;
    } finally {
      setIsLoading(false);
    }
  }, [calculateDeviationScore, calculatePercentile, getPercentileValue]);

  // ════════════════════════════════════════════
  // 戦略インサイト生成
  // ════════════════════════════════════════════

  const generateInsights = useCallback(async (
    yearMonth: string,
    targetFacilityId?: string
  ): Promise<StrategicInsight[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getMonthRange(yearMonth);
      const businessDays = getBusinessDaysInMonth(yearMonth);
      const prevMonth = getPreviousMonth(yearMonth);
      const prevPrevMonth = getPreviousMonth(prevMonth);

      const insights: StrategicInsight[] = [];

      // 施設一覧を取得
      const { data: facilitiesData } = await supabase
        .from('facilities')
        .select('id, name, company_id, capacity_total, companies(name)');

      if (!facilitiesData || facilitiesData.length === 0) return [];

      // 対象施設の絞り込み
      const targetFacilities = targetFacilityId
        ? facilitiesData.filter((f: Record<string, unknown>) => f.id === targetFacilityId)
        : facilitiesData;

      const facilityIds = targetFacilities.map((f: Record<string, unknown>) => f.id as string);
      const allFacilityIds = facilitiesData.map((f: Record<string, unknown>) => f.id as string);

      // 並列で各分析用データを取得
      const [
        additionsMasterResult,
        additionSettingsResult,
        billingCurrentResult,
        billingPrevResult,
        billingPrevPrevResult,
        usageResult,
        childrenResult,
        cashflowResult,
      ] = await Promise.all([
        // 全加算マスタ
        supabase.from('additions')
          .select('code, name, units')
          .eq('is_active', true),
        // 加算設定
        supabase.from('facility_addition_settings')
          .select('facility_id, addition_code, is_enabled')
          .in('facility_id', facilityIds),
        // 当月売上
        supabase.from('billing_records')
          .select('facility_id, total_amount')
          .eq('year_month', yearMonth)
          .in('facility_id', facilityIds),
        // 前月売上
        supabase.from('billing_records')
          .select('facility_id, total_amount')
          .eq('year_month', prevMonth)
          .in('facility_id', facilityIds),
        // 前々月売上
        supabase.from('billing_records')
          .select('facility_id, total_amount')
          .eq('year_month', prevPrevMonth)
          .in('facility_id', facilityIds),
        // 利用実績
        supabase.from('usage_records')
          .select('facility_id')
          .gte('date', startDate)
          .lte('date', endDate)
          .in('facility_id', facilityIds),
        // 児童数
        supabase.from('children')
          .select('facility_id')
          .in('facility_id', facilityIds)
          .in('contract_status', ['active', 'pre-contract']),
        // キャッシュフロー
        supabase.from('cashflow_entries')
          .select('facility_id, category, amount')
          .eq('year_month', yearMonth)
          .in('facility_id', facilityIds),
      ]);

      // 加算マスタコード一覧
      const allAdditionCodes = new Set(
        (additionsMasterResult.data || []).map((a: Record<string, unknown>) => a.code as string)
      );
      const additionNameMap = new Map<string, string>();
      const additionUnitsMap = new Map<string, number>();
      for (const a of (additionsMasterResult.data || [])) {
        additionNameMap.set(a.code as string, a.name as string);
        additionUnitsMap.set(a.code as string, (a.units as number) || 0);
      }

      // 施設ごとの有効加算コード
      const enabledAdditionsByFacility = new Map<string, Set<string>>();
      for (const setting of (additionSettingsResult.data || [])) {
        const fid = setting.facility_id as string;
        if (!enabledAdditionsByFacility.has(fid)) {
          enabledAdditionsByFacility.set(fid, new Set());
        }
        if (setting.is_enabled) {
          enabledAdditionsByFacility.get(fid)!.add(setting.addition_code as string);
        }
      }

      // 売上集計
      const revenueByFacility = (data: Record<string, unknown>[]) => {
        const map = new Map<string, number>();
        for (const r of data) {
          const fid = r.facility_id as string;
          map.set(fid, (map.get(fid) || 0) + ((r.total_amount as number) || 0));
        }
        return map;
      };

      const currentRevenue = revenueByFacility(billingCurrentResult.data || []);
      const prevRevenue = revenueByFacility(billingPrevResult.data || []);
      const prevPrevRevenue = revenueByFacility(billingPrevPrevResult.data || []);

      // 利用日数集計
      const usageCountByFacility = new Map<string, number>();
      for (const u of (usageResult.data || [])) {
        const fid = u.facility_id as string;
        usageCountByFacility.set(fid, (usageCountByFacility.get(fid) || 0) + 1);
      }

      // 児童数集計
      const childCountByFacility = new Map<string, number>();
      for (const c of (childrenResult.data || [])) {
        const fid = c.facility_id as string;
        childCountByFacility.set(fid, (childCountByFacility.get(fid) || 0) + 1);
      }

      // キャッシュフロー集計
      const incomeByFacility = new Map<string, number>();
      const expenseByFacility = new Map<string, number>();
      for (const entry of (cashflowResult.data || [])) {
        const fid = entry.facility_id as string;
        const amount = (entry.amount as number) || 0;
        if (entry.category === 'income') {
          incomeByFacility.set(fid, (incomeByFacility.get(fid) || 0) + amount);
        } else {
          expenseByFacility.set(fid, (expenseByFacility.get(fid) || 0) + amount);
        }
      }

      // ── インサイト生成 ──
      let insightCounter = 0;

      for (const f of targetFacilities) {
        const fid = f.id as string;
        const fname = f.name as string;
        const company = (f as unknown as Record<string, unknown>).companies as Record<string, unknown> | null;
        const cname = (company?.name as string) || undefined;
        const capacity = (f.capacity_total as number) || 10;
        const childCount = childCountByFacility.get(fid) || 0;

        // === 1. 加算最適化（Addition Opportunity） ===
        const enabledCodes = enabledAdditionsByFacility.get(fid) || new Set();
        const missingAdditions: { code: string; name: string; units: number }[] = [];

        for (const code of Array.from(allAdditionCodes)) {
          if (!enabledCodes.has(code)) {
            missingAdditions.push({
              code,
              name: additionNameMap.get(code) || code,
              units: additionUnitsMap.get(code) || 0,
            });
          }
        }

        // 推定インパクト順にソート
        missingAdditions.sort((a, b) => b.units - a.units);
        const topMissing = missingAdditions.slice(0, 3);

        if (topMissing.length > 0) {
          const totalEstimatedUnits = sum(topMissing.map(a => a.units));
          const avgUsageDays = childCount > 0 ? 20 : 0; // 月20日想定
          const estimatedImpact = totalEstimatedUnits * DEFAULT_UNIT_PRICE * childCount * avgUsageDays;
          const additionNames = topMissing.map(a => a.name).join('、');

          insights.push({
            id: `insight-${++insightCounter}`,
            facilityId: fid,
            facilityName: fname,
            companyName: cname,
            type: 'addition_opportunity',
            priority: estimatedImpact > 100000 ? 'high' : estimatedImpact > 30000 ? 'medium' : 'low',
            title: `未取得加算の最適化余地あり`,
            description: `${additionNames}など${missingAdditions.length}件の加算が未取得です。上位3加算の取得により月額約${estimatedImpact.toLocaleString()}円の増収が見込めます。`,
            estimatedImpact,
            metadata: {
              missingAdditions: topMissing,
              totalMissingCount: missingAdditions.length,
            },
          });
        }

        // === 2. 成長ポテンシャル（Growth Potential） ===
        const usageCount = usageCountByFacility.get(fid) || 0;
        const totalCapacityDays = capacity * businessDays;
        const utilizationRate = safeDivide(usageCount, totalCapacityDays) * 100;

        if (utilizationRate < 60 && capacity > 0) {
          const vacantDays = totalCapacityDays - usageCount;
          const avgRevenuePerDay = childCount > 0
            ? safeDivide(currentRevenue.get(fid) || 0, usageCount)
            : 6040; // デフォルト（604単位 * 10円）

          const growthPotential = Math.round(vacantDays * avgRevenuePerDay * 0.5); // 空き枠の50%活用想定

          insights.push({
            id: `insight-${++insightCounter}`,
            facilityId: fid,
            facilityName: fname,
            companyName: cname,
            type: 'growth_potential',
            priority: utilizationRate < 40 ? 'high' : 'medium',
            title: `利用率${utilizationRate.toFixed(1)}% - 成長余地あり`,
            description: `現在の利用率は${utilizationRate.toFixed(1)}%です。空き枠の50%活用で月額約${growthPotential.toLocaleString()}円の増収ポテンシャルがあります。営業強化や受入枠の最適化を検討してください。`,
            estimatedImpact: growthPotential,
            metadata: {
              utilizationRate,
              vacantDays,
              capacity,
            },
          });
        }

        // === 3. リスクアラート（Risk Alert） ===

        // 3a. 売上減少（3ヶ月連続減少 or 前月比20%以上減）
        const curr = currentRevenue.get(fid) || 0;
        const prev = prevRevenue.get(fid) || 0;
        const prevPrev = prevPrevRevenue.get(fid) || 0;

        const isConsecutiveDecline = curr < prev && prev < prevPrev && prevPrev > 0;
        const declineRate = prev > 0 ? ((prev - curr) / prev) * 100 : 0;

        if (isConsecutiveDecline || declineRate > 20) {
          const alertTitle = isConsecutiveDecline
            ? '3ヶ月連続の売上減少'
            : `前月比${declineRate.toFixed(1)}%の売上減少`;

          insights.push({
            id: `insight-${++insightCounter}`,
            facilityId: fid,
            facilityName: fname,
            companyName: cname,
            type: 'risk_alert',
            priority: isConsecutiveDecline ? 'high' : 'medium',
            title: alertTitle,
            description: `当月売上: ${curr.toLocaleString()}円、前月売上: ${prev.toLocaleString()}円。${isConsecutiveDecline ? '3ヶ月連続で売上が減少しています。' : `前月比${declineRate.toFixed(1)}%の大幅な減少です。`}原因分析と対策が必要です。`,
            estimatedImpact: -(prev - curr),
            metadata: {
              currentRevenue: curr,
              previousRevenue: prev,
              prevPrevRevenue: prevPrev,
              declineRate,
              isConsecutiveDecline,
            },
          });
        }

        // 3b. 利益率が低い
        const income = incomeByFacility.get(fid) || 0;
        const expense = expenseByFacility.get(fid) || 0;
        if (income > 0) {
          const profitMargin = safeDivide(income - expense, income) * 100;
          if (profitMargin < 5) {
            insights.push({
              id: `insight-${++insightCounter}`,
              facilityId: fid,
              facilityName: fname,
              companyName: cname,
              type: 'risk_alert',
              priority: profitMargin < 0 ? 'high' : 'medium',
              title: `利益率${profitMargin.toFixed(1)}% - 収支改善が必要`,
              description: `収入${income.toLocaleString()}円に対し支出${expense.toLocaleString()}円で、利益率は${profitMargin.toFixed(1)}%です。${profitMargin < 0 ? '赤字状態が続いています。' : '利益率が非常に低い状態です。'}コスト構造の見直しを検討してください。`,
              estimatedImpact: income - expense,
              metadata: {
                income,
                expense,
                profitMargin,
              },
            });
          }
        }
      }

      // 優先度順にソート（high > medium > low）
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      insights.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

      return insights;
    } catch (err) {
      const message = '戦略インサイトの生成中にエラーが発生しました';
      console.error(message, err);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ════════════════════════════════════════════
  // 公開API
  // ════════════════════════════════════════════

  return {
    isLoading,
    error,
    // プラットフォーム統計
    fetchPlatformStats,
    // 施設管理
    fetchAllFacilities,
    fetchFacilityDeepView,
    // 法人管理
    fetchCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    linkFacilityToCompany,
    // ベンチマーク
    BENCHMARK_METRICS,
    fetchBenchmarkData,
    calculateDeviationScore,
    calculatePercentile,
    getPercentileValue,
    // 戦略インサイト
    generateInsights,
  };
};
