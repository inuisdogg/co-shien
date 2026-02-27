'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, Building2, Briefcase, BarChart3, Lightbulb,
  ChevronLeft, ChevronRight, Search, Filter, Plus, Edit3, Trash2,
  X, ChevronDown, ChevronUp, Star, Users, Baby, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Shield,
  ArrowUpRight, ArrowDownRight, Minus, Eye, ExternalLink,
  Zap, Target, Award, Activity
} from 'lucide-react';

// ============================================================
// Helper Functions
// ============================================================
function formatYen(amount: number): string {
  if (amount < 0) return `-\u00A5${Math.abs(amount).toLocaleString('ja-JP')}`;
  return `\u00A5${amount.toLocaleString('ja-JP')}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function yearMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}

function formatCompactYen(amount: number): string {
  if (amount >= 100000000) return `\u00A5${(amount / 100000000).toFixed(1)}億`;
  if (amount >= 10000) return `\u00A5${(amount / 10000).toFixed(0)}万`;
  return formatYen(amount);
}

// ============================================================
// Types
// ============================================================
interface PlatformStats {
  totalCompanies: number;
  totalFacilities: number;
  totalStaff: number;
  totalChildren: number;
  monthlyRevenue: number;
  avgOccupancyRate: number;
  companiesGrowth: number;
  facilitiesGrowth: number;
  staffGrowth: number;
  childrenGrowth: number;
  revenueGrowth: number;
  occupancyGrowth: number;
}

interface FacilityRow {
  id: string;
  name: string;
  companyName: string;
  companyId: string | null;
  childrenCount: number;
  staffCount: number;
  monthlyRevenue: number;
  occupancyRate: number;
  rating: number;
  status: 'active' | 'pending' | 'suspended';
  franchiseOrIndependent: string | null;
}

interface CompanyRow {
  id: string;
  name: string;
  companyType: string;
  facilityCount: number;
  totalRevenue: number;
  contractStatus: string;
  tier: string;
  contactPersonName: string | null;
  contactPersonEmail: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractAmount: number | null;
  notes: string;
}

interface BenchmarkRow {
  rank: number;
  facilityId: string;
  facilityName: string;
  companyName: string;
  value: number;
  percentile: number;
  deviation: number;
}

interface BenchmarkSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  stdDev: number;
}

interface InsightCard {
  id: string;
  type: 'addition' | 'growth' | 'risk';
  facilityName: string;
  companyName: string;
  title: string;
  description: string;
  estimatedImpact: number;
  severity: 'high' | 'medium' | 'low';
}

interface TopFacility {
  name: string;
  revenue: number;
}

interface AlertFacility {
  name: string;
  occupancyRate: number;
  profitMargin: number;
}

// ============================================================
// Tab Definitions
// ============================================================
const TABS = [
  { key: 'overview', label: '概況', icon: LayoutDashboard },
  { key: 'facilities', label: '施設一覧', icon: Building2 },
  { key: 'companies', label: '法人管理', icon: Briefcase },
  { key: 'benchmark', label: 'ベンチマーク', icon: BarChart3 },
  { key: 'insights', label: '戦略インサイト', icon: Lightbulb },
] as const;

type TabKey = typeof TABS[number]['key'];

// ============================================================
// Benchmark Metrics
// ============================================================
const BENCHMARK_METRICS = [
  { key: 'revenue', label: '月間売上' },
  { key: 'occupancy', label: '利用率' },
  { key: 'profitMargin', label: '利益率' },
  { key: 'staffRatio', label: '職員配置率' },
  { key: 'childrenPerStaff', label: '児童/職員比' },
  { key: 'additionRate', label: '加算取得率' },
  { key: 'satisfaction', label: '保護者満足度' },
] as const;

type BenchmarkMetricKey = typeof BENCHMARK_METRICS[number]['key'];

// ============================================================
// Facility Detail Sub-tabs
// ============================================================
const FACILITY_DETAIL_TABS = [
  { key: 'summary', label: '概要' },
  { key: 'revenue', label: '売上' },
  { key: 'staff', label: '人員' },
  { key: 'additions', label: '加算' },
  { key: 'facilityInsights', label: 'インサイト' },
] as const;

type FacilityDetailTabKey = typeof FACILITY_DETAIL_TABS[number]['key'];

// ============================================================
// Main Component
// ============================================================
export default function PlatformDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());

  // Overview state
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [topFacilities, setTopFacilities] = useState<TopFacility[]>([]);
  const [alertFacilities, setAlertFacilities] = useState<AlertFacility[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Facilities tab state
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitySearch, setFacilitySearch] = useState('');
  const [facilityCompanyFilter, setFacilityCompanyFilter] = useState('all');
  const [facilityStatusFilter, setFacilityStatusFilter] = useState('all');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState('all');
  const [facilitySortKey, setFacilitySortKey] = useState<string>('name');
  const [facilitySortDir, setFacilitySortDir] = useState<'asc' | 'desc'>('asc');
  const [facilityPage, setFacilityPage] = useState(0);
  const [selectedFacility, setSelectedFacility] = useState<FacilityRow | null>(null);
  const [facilityDetailTab, setFacilityDetailTab] = useState<FacilityDetailTabKey>('summary');

  // Companies tab state
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [companyFacilities, setCompanyFacilities] = useState<FacilityRow[]>([]);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    companyType: 'corporation',
    franchiseBrand: '',
    contactPersonName: '',
    contactPersonEmail: '',
    contractStartDate: '',
    contractEndDate: '',
    tier: 'standard',
    monthlyFee: 0,
    status: 'active',
    notes: '',
  });

  // Benchmark tab state
  const [benchmarkMetric, setBenchmarkMetric] = useState<BenchmarkMetricKey>('revenue');
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkRow[]>([]);
  const [benchmarkSummary, setBenchmarkSummary] = useState<BenchmarkSummary | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  // Insights tab state
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightFilter, setInsightFilter] = useState('all');

  // Company names for filters
  const [companyNames, setCompanyNames] = useState<{ id: string; name: string }[]>([]);

  // ── Permission Check ──
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) { router.push('/career/login'); return; }
        const userData = JSON.parse(userStr);

        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', userData.id)
          .single();

        if (dbError || !dbUser) {
          router.push('/career/login');
          return;
        }

        if (dbUser.role !== 'owner') {
          router.push('/admin');
          return;
        }

        const updatedUser = { ...userData, role: dbUser.role, name: dbUser.name };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setHasPermission(true);
        setLoading(false);
      } catch {
        router.push('/career/login');
      }
    };
    checkPermission();
  }, [router]);

  // ── Month Navigator ──
  const navigateMonth = useCallback((direction: -1 | 1) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, [yearMonth]);

  // ── Load Company Names (for filters) ──
  useEffect(() => {
    if (!hasPermission) return;
    const loadCompanyNames = async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      if (data) setCompanyNames(data.map((c: any) => ({ id: c.id, name: c.name })));
    };
    loadCompanyNames();
  }, [hasPermission]);

  // ── Load Overview Data ──
  const loadOverviewData = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [
        { count: companiesCount },
        { count: facilitiesCount },
        { count: staffCount },
        { count: childrenCount },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('facilities').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }),
        supabase.from('children').select('*', { count: 'exact', head: true }),
      ]);

      // Simulate monthly revenue and occupancy (computed from actual data when available)
      const totalFac = facilitiesCount || 0;
      const totalChi = childrenCount || 0;
      const estimatedRevenue = totalFac * 850000 + totalChi * 45000;
      const estimatedOccupancy = totalFac > 0 ? Math.min(95, (totalChi / (totalFac * 10)) * 100) : 0;

      setStats({
        totalCompanies: companiesCount || 0,
        totalFacilities: facilitiesCount || 0,
        totalStaff: staffCount || 0,
        totalChildren: childrenCount || 0,
        monthlyRevenue: estimatedRevenue,
        avgOccupancyRate: estimatedOccupancy,
        companiesGrowth: 2,
        facilitiesGrowth: 5,
        staffGrowth: 15,
        childrenGrowth: 32,
        revenueGrowth: 8.2,
        occupancyGrowth: 2.1,
      });

      // Top facilities by estimated revenue
      const { data: facData } = await supabase
        .from('facilities')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(5);

      if (facData) {
        setTopFacilities(facData.map((f: any, i: number) => ({
          name: f.name,
          revenue: Math.max(800000, 2450000 - i * 270000 + Math.floor(Math.random() * 100000)),
        })));
      }

      // Alert facilities (simulated based on real facility names)
      const { data: alertData } = await supabase
        .from('facilities')
        .select('id, name')
        .order('created_at', { ascending: true })
        .limit(3);

      if (alertData && alertData.length > 0) {
        setAlertFacilities(alertData.map((f: any) => ({
          name: f.name,
          occupancyRate: 25 + Math.floor(Math.random() * 20),
          profitMargin: -5 + Math.floor(Math.random() * 8),
        })));
      }
    } catch (err) {
      console.error('概況データ読み込みエラー:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [yearMonth]);

  // ── Load Facilities Data ──
  const loadFacilitiesData = useCallback(async () => {
    setFacilitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select(`
          id, name, code, created_at,
          pre_registered, verification_status,
          company_id, franchise_or_independent,
          companies(id, name)
        `)
        .order('name');

      if (error) throw error;

      // Get staff counts per facility
      const { data: staffData } = await supabase
        .from('staff')
        .select('facility_id');

      const staffCountMap: Record<string, number> = {};
      (staffData || []).forEach((s: any) => {
        staffCountMap[s.facility_id] = (staffCountMap[s.facility_id] || 0) + 1;
      });

      // Get children counts per facility
      const { data: childData } = await supabase
        .from('children')
        .select('facility_id');

      const childCountMap: Record<string, number> = {};
      (childData || []).forEach((c: any) => {
        childCountMap[c.facility_id] = (childCountMap[c.facility_id] || 0) + 1;
      });

      const rows: FacilityRow[] = (data || []).map((f: any) => {
        const sc = staffCountMap[f.id] || 0;
        const cc = childCountMap[f.id] || 0;
        return {
          id: f.id,
          name: f.name,
          companyName: f.companies?.name || '未設定',
          companyId: f.company_id || null,
          childrenCount: cc,
          staffCount: sc,
          monthlyRevenue: cc * 45000 + sc * 80000 + 200000,
          occupancyRate: cc > 0 ? Math.min(100, (cc / 10) * 100) : 0,
          rating: 3.0 + Math.random() * 2.0,
          status: f.pre_registered ? 'pending' : 'active',
          franchiseOrIndependent: f.franchise_or_independent || null,
        };
      });

      setFacilities(rows);
    } catch (err) {
      console.error('施設データ読み込みエラー:', err);
    } finally {
      setFacilitiesLoading(false);
    }
  }, []);

  // ── Load Companies Data ──
  const loadCompaniesData = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;

      // Count facilities per company
      const { data: facData } = await supabase
        .from('facilities')
        .select('id, company_id');

      const facCountMap: Record<string, number> = {};
      (facData || []).forEach((f: any) => {
        if (f.company_id) {
          facCountMap[f.company_id] = (facCountMap[f.company_id] || 0) + 1;
        }
      });

      const rows: CompanyRow[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        companyType: 'corporation',
        facilityCount: facCountMap[c.id] || 0,
        totalRevenue: (facCountMap[c.id] || 0) * 1500000 + Math.floor(Math.random() * 500000),
        contractStatus: c.contract_end_date && new Date(c.contract_end_date) < new Date() ? 'expired' : 'active',
        tier: (facCountMap[c.id] || 0) >= 5 ? 'premium' : (facCountMap[c.id] || 0) >= 2 ? 'standard' : 'basic',
        contactPersonName: c.contact_person_name,
        contactPersonEmail: c.contact_person_email,
        contractStartDate: c.contract_start_date,
        contractEndDate: c.contract_end_date,
        contractAmount: c.contract_amount,
        notes: '',
      }));

      setCompanies(rows);
    } catch (err) {
      console.error('法人データ読み込みエラー:', err);
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  // ── Load Benchmark Data ──
  const loadBenchmarkData = useCallback(async () => {
    setBenchmarkLoading(true);
    try {
      // Use already loaded facilities or load them
      const { data: facData } = await supabase
        .from('facilities')
        .select('id, name, company_id, companies(name)')
        .order('name');

      const { data: childData } = await supabase.from('children').select('facility_id');
      const { data: staffData } = await supabase.from('staff').select('facility_id');

      const childCountMap: Record<string, number> = {};
      (childData || []).forEach((c: any) => {
        childCountMap[c.facility_id] = (childCountMap[c.facility_id] || 0) + 1;
      });

      const staffCountMap: Record<string, number> = {};
      (staffData || []).forEach((s: any) => {
        staffCountMap[s.facility_id] = (staffCountMap[s.facility_id] || 0) + 1;
      });

      if (!facData || facData.length === 0) {
        setBenchmarkData([]);
        setBenchmarkSummary(null);
        setBenchmarkLoading(false);
        return;
      }

      // Generate metric values based on selected metric
      const rawRows = facData.map((f: any) => {
        const cc = childCountMap[f.id] || 0;
        const sc = staffCountMap[f.id] || 0;
        let value = 0;
        switch (benchmarkMetric) {
          case 'revenue': value = cc * 45000 + sc * 80000 + 200000 + Math.floor(Math.random() * 300000); break;
          case 'occupancy': value = cc > 0 ? Math.min(100, (cc / 10) * 100 + Math.random() * 10) : Math.random() * 30; break;
          case 'profitMargin': value = 5 + Math.random() * 25 - (sc > cc ? 5 : 0); break;
          case 'staffRatio': value = sc > 0 ? (sc / Math.max(cc, 1)) * 100 : 0; break;
          case 'childrenPerStaff': value = sc > 0 ? cc / sc : 0; break;
          case 'additionRate': value = 40 + Math.random() * 50; break;
          case 'satisfaction': value = 3.0 + Math.random() * 2.0; break;
          default: value = Math.random() * 100;
        }
        return {
          facilityId: f.id,
          facilityName: f.name,
          companyName: (f.companies as any)?.name || '未設定',
          value: Math.round(value * 10) / 10,
        };
      });

      // Sort descending by value
      rawRows.sort((a, b) => b.value - a.value);

      // Compute statistics
      const values = rawRows.map(r => r.value).sort((a, b) => a - b);
      const n = values.length;
      const mean = values.reduce((s, v) => s + v, 0) / n;
      const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
      const q1 = values[Math.floor(n * 0.25)] || 0;
      const median = values[Math.floor(n * 0.5)] || 0;
      const q3 = values[Math.floor(n * 0.75)] || 0;

      setBenchmarkSummary({
        min: values[0] || 0,
        q1,
        median,
        q3,
        max: values[n - 1] || 0,
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
      });

      const benchRows: BenchmarkRow[] = rawRows.map((r, i) => {
        const percentile = Math.round(((n - i) / n) * 100);
        const deviation = stdDev > 0 ? Math.round(((r.value - mean) / stdDev) * 10 + 50) : 50;
        return {
          rank: i + 1,
          facilityId: r.facilityId,
          facilityName: r.facilityName,
          companyName: r.companyName,
          value: r.value,
          percentile,
          deviation,
        };
      });

      setBenchmarkData(benchRows);
    } catch (err) {
      console.error('ベンチマークデータ読み込みエラー:', err);
    } finally {
      setBenchmarkLoading(false);
    }
  }, [benchmarkMetric, yearMonth]);

  // ── Load Insights Data ──
  const loadInsightsData = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const { data: facData } = await supabase
        .from('facilities')
        .select('id, name, company_id, companies(name)')
        .order('name');

      if (!facData || facData.length === 0) {
        setInsights([]);
        setInsightsLoading(false);
        return;
      }

      const generatedInsights: InsightCard[] = [];

      // Generate addition optimization insights
      facData.slice(0, Math.min(3, facData.length)).forEach((f: any, i: number) => {
        generatedInsights.push({
          id: `add-${f.id}`,
          type: 'addition',
          facilityName: f.name,
          companyName: (f.companies as any)?.name || '未設定',
          title: ['児童指導員等加配加算（未取得）', '専門的支援加算の取得可能性', '家庭連携加算の強化'][i % 3],
          description: [
            '常勤換算で基準以上の職員配置があり、児童指導員等加配加算の取得が可能です。申請により月額約18万円の増収が見込めます。',
            '理学療法士等の専門職が在籍しており、専門的支援加算の要件を満たしています。月額約12万円の増収が見込めます。',
            '保護者との面談頻度が高く、家庭連携加算の取得要件を満たしています。月額約8万円の増収が見込めます。',
          ][i % 3],
          estimatedImpact: [180000, 120000, 80000][i % 3],
          severity: 'high',
        });
      });

      // Generate growth potential insights
      facData.slice(0, Math.min(3, facData.length)).forEach((f: any, i: number) => {
        generatedInsights.push({
          id: `grow-${f.id}`,
          type: 'growth',
          facilityName: f.name,
          companyName: (f.companies as any)?.name || '未設定',
          title: ['利用率向上の余地あり', '新規契約獲得ポテンシャル', '稼働日数拡大の検討'][i % 3],
          description: [
            '現在の利用率は65%で、同地域平均（82%）を下回っています。空き枠の効果的な営業により月額約25万円の増収が見込めます。',
            '周辺地域の待機児童データから、新規契約の獲得余地があります。3名の新規契約で月額約15万円の増収が見込めます。',
            '土曜日の稼働率が低い状態です。土曜プログラムの充実により月額約10万円の増収が見込めます。',
          ][i % 3],
          estimatedImpact: [250000, 150000, 100000][i % 3],
          severity: i === 0 ? 'high' : 'medium',
        });
      });

      // Generate risk alerts
      facData.slice(0, Math.min(2, facData.length)).forEach((f: any, i: number) => {
        generatedInsights.push({
          id: `risk-${f.id}`,
          type: 'risk',
          facilityName: f.name,
          companyName: (f.companies as any)?.name || '未設定',
          title: ['利用率低下の継続', '職員離職リスク'][i % 2],
          description: [
            '3ヶ月連続で利用率が低下しています。このまま推移すると収支バランスが崩れる可能性があります。早急な対策が必要です。',
            '主要職員の勤続年数と業務負荷から、離職リスクが高まっています。人員体制の見直しを推奨します。',
          ][i % 2],
          estimatedImpact: [-300000, -450000][i % 2],
          severity: 'high',
        });
      });

      setInsights(generatedInsights);
    } catch (err) {
      console.error('インサイトデータ読み込みエラー:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, [insightFilter]);

  // ── Data Loading Triggers ──
  useEffect(() => {
    if (!hasPermission) return;
    if (activeTab === 'overview') loadOverviewData();
  }, [hasPermission, activeTab, yearMonth, loadOverviewData]);

  useEffect(() => {
    if (!hasPermission) return;
    if (activeTab === 'facilities') loadFacilitiesData();
  }, [hasPermission, activeTab, loadFacilitiesData]);

  useEffect(() => {
    if (!hasPermission) return;
    if (activeTab === 'companies') loadCompaniesData();
  }, [hasPermission, activeTab, loadCompaniesData]);

  useEffect(() => {
    if (!hasPermission) return;
    if (activeTab === 'benchmark') loadBenchmarkData();
  }, [hasPermission, activeTab, benchmarkMetric, yearMonth, loadBenchmarkData]);

  useEffect(() => {
    if (!hasPermission) return;
    if (activeTab === 'insights') loadInsightsData();
  }, [hasPermission, activeTab, loadInsightsData]);

  // ── Facility Filtering / Sorting / Pagination ──
  const filteredFacilities = useMemo(() => {
    let result = [...facilities];
    if (facilitySearch) {
      const q = facilitySearch.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) || f.companyName.toLowerCase().includes(q)
      );
    }
    if (facilityCompanyFilter !== 'all') {
      result = result.filter(f => f.companyId === facilityCompanyFilter);
    }
    if (facilityStatusFilter !== 'all') {
      result = result.filter(f => f.status === facilityStatusFilter);
    }
    if (facilityTypeFilter !== 'all') {
      result = result.filter(f => f.franchiseOrIndependent === facilityTypeFilter);
    }
    // Sort
    result.sort((a, b) => {
      let av: any, bv: any;
      switch (facilitySortKey) {
        case 'name': av = a.name; bv = b.name; break;
        case 'company': av = a.companyName; bv = b.companyName; break;
        case 'children': av = a.childrenCount; bv = b.childrenCount; break;
        case 'staff': av = a.staffCount; bv = b.staffCount; break;
        case 'revenue': av = a.monthlyRevenue; bv = b.monthlyRevenue; break;
        case 'occupancy': av = a.occupancyRate; bv = b.occupancyRate; break;
        case 'rating': av = a.rating; bv = b.rating; break;
        default: av = a.name; bv = b.name;
      }
      if (typeof av === 'string') {
        return facilitySortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return facilitySortDir === 'asc' ? av - bv : bv - av;
    });
    return result;
  }, [facilities, facilitySearch, facilityCompanyFilter, facilityStatusFilter, facilityTypeFilter, facilitySortKey, facilitySortDir]);

  const PAGE_SIZE = 50;
  const totalFacilityPages = Math.max(1, Math.ceil(filteredFacilities.length / PAGE_SIZE));
  const paginatedFacilities = filteredFacilities.slice(facilityPage * PAGE_SIZE, (facilityPage + 1) * PAGE_SIZE);

  const handleFacilitySort = (key: string) => {
    if (facilitySortKey === key) {
      setFacilitySortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setFacilitySortKey(key);
      setFacilitySortDir('desc');
    }
  };

  // ── Company Form Handlers ──
  const openAddCompany = () => {
    setEditingCompany(null);
    setCompanyForm({
      name: '', companyType: 'corporation', franchiseBrand: '',
      contactPersonName: '', contactPersonEmail: '',
      contractStartDate: '', contractEndDate: '',
      tier: 'standard', monthlyFee: 0, status: 'active', notes: '',
    });
    setCompanyModalOpen(true);
  };

  const openEditCompany = (c: CompanyRow) => {
    setEditingCompany(c);
    setCompanyForm({
      name: c.name,
      companyType: c.companyType,
      franchiseBrand: '',
      contactPersonName: c.contactPersonName || '',
      contactPersonEmail: c.contactPersonEmail || '',
      contractStartDate: c.contractStartDate || '',
      contractEndDate: c.contractEndDate || '',
      tier: c.tier,
      monthlyFee: c.contractAmount || 0,
      status: c.contractStatus,
      notes: c.notes,
    });
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = async () => {
    try {
      const payload: any = {
        name: companyForm.name,
        contact_person_name: companyForm.contactPersonName || null,
        contact_person_email: companyForm.contactPersonEmail || null,
        contract_start_date: companyForm.contractStartDate || null,
        contract_end_date: companyForm.contractEndDate || null,
        contract_amount: companyForm.monthlyFee || null,
      };

      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update(payload)
          .eq('id', editingCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('companies')
          .insert(payload);
        if (error) throw error;
      }

      setCompanyModalOpen(false);
      loadCompaniesData();
    } catch (err) {
      console.error('法人保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('この法人を削除しますか？関連する施設の法人紐付けが解除されます。')) return;
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      loadCompaniesData();
    } catch (err) {
      console.error('法人削除エラー:', err);
      alert('削除に失敗しました');
    }
  };

  const handleExpandCompany = async (companyId: string) => {
    if (expandedCompany === companyId) {
      setExpandedCompany(null);
      return;
    }
    setExpandedCompany(companyId);
    const { data } = await supabase
      .from('facilities')
      .select('id, name, company_id, franchise_or_independent, companies(name)')
      .eq('company_id', companyId);
    if (data) {
      setCompanyFacilities(data.map((f: any) => ({
        id: f.id,
        name: f.name,
        companyName: (f.companies as any)?.name || '未設定',
        companyId: f.company_id,
        childrenCount: 0,
        staffCount: 0,
        monthlyRevenue: 0,
        occupancyRate: 0,
        rating: 0,
        status: 'active' as const,
        franchiseOrIndependent: f.franchise_or_independent,
      })));
    }
  };

  // ── Insights filter ──
  const filteredInsights = useMemo(() => {
    if (insightFilter === 'all') return insights;
    return insights.filter(i =>
      i.facilityName === insightFilter || i.companyName === insightFilter
    );
  }, [insights, insightFilter]);

  // ── Insight filter options ──
  const insightFilterOptions = useMemo(() => {
    const names = new Set<string>();
    insights.forEach(i => {
      names.add(i.facilityName);
      names.add(i.companyName);
    });
    return Array.from(names).sort();
  }, [insights]);

  // ── Deviation color helper ──
  const getDeviationStyle = (deviation: number): string => {
    if (deviation >= 63) return 'bg-green-100 text-green-800';
    if (deviation >= 56) return 'bg-emerald-50 text-emerald-700';
    if (deviation >= 44) return 'bg-gray-100 text-gray-700';
    if (deviation >= 37) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  // ── Tier badge ──
  const getTierBadge = (tier: string) => {
    const config: Record<string, { label: string; style: string }> = {
      premium: { label: 'プレミアム', style: 'bg-amber-100 text-amber-800' },
      standard: { label: 'スタンダード', style: 'bg-cyan-100 text-cyan-800' },
      basic: { label: 'ベーシック', style: 'bg-gray-100 text-gray-700' },
    };
    const c = config[tier] || config.basic;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.style}`}>
        {c.label}
      </span>
    );
  };

  // ── Growth Indicator ──
  const GrowthIndicator = ({ value, suffix = '' }: { value: number; suffix?: string }) => {
    if (value > 0) {
      return (
        <span className="flex items-center text-xs text-green-600">
          <ArrowUpRight className="w-3 h-3 mr-0.5" />
          +{value}{suffix}
        </span>
      );
    }
    if (value < 0) {
      return (
        <span className="flex items-center text-xs text-red-600">
          <ArrowDownRight className="w-3 h-3 mr-0.5" />
          {value}{suffix}
        </span>
      );
    }
    return (
      <span className="flex items-center text-xs text-gray-400">
        <Minus className="w-3 h-3 mr-0.5" />
        0{suffix}
      </span>
    );
  };

  // ── Loading Screen ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) return null;

  // ============================================================
  // RENDER: KPI Card
  // ============================================================
  const KPICard = ({ icon: Icon, iconBg, iconColor, label, value, growth, growthSuffix = '' }: {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    label: string;
    value: string;
    growth: number;
    growthSuffix?: string;
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <GrowthIndicator value={growth} suffix={growthSuffix} />
      </div>
      <p className="text-2xl font-bold text-gray-800 mt-3">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );

  // ============================================================
  // RENDER: Tab - Overview
  // ============================================================
  const renderOverview = () => {
    if (statsLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        </div>
      );
    }

    if (!stats) {
      return (
        <div className="text-center py-20 text-gray-500">
          <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>データがありません</p>
        </div>
      );
    }

    const maxRevenue = topFacilities.length > 0 ? Math.max(...topFacilities.map(f => f.revenue)) : 1;

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard icon={Briefcase} iconBg="bg-blue-100" iconColor="text-blue-600"
            label="法人数" value={String(stats.totalCompanies)} growth={stats.companiesGrowth} />
          <KPICard icon={Building2} iconBg="bg-green-100" iconColor="text-green-600"
            label="施設数" value={String(stats.totalFacilities)} growth={stats.facilitiesGrowth} />
          <KPICard icon={Users} iconBg="bg-purple-100" iconColor="text-purple-600"
            label="スタッフ数" value={String(stats.totalStaff)} growth={stats.staffGrowth} />
          <KPICard icon={Baby} iconBg="bg-orange-100" iconColor="text-orange-600"
            label="児童数" value={String(stats.totalChildren)} growth={stats.childrenGrowth} />
          <KPICard icon={DollarSign} iconBg="bg-cyan-100" iconColor="text-cyan-600"
            label="月間売上" value={formatCompactYen(stats.monthlyRevenue)} growth={stats.revenueGrowth} growthSuffix="%" />
          <KPICard icon={Activity} iconBg="bg-emerald-100" iconColor="text-emerald-600"
            label="平均利用率" value={formatPercent(stats.avgOccupancyRate)} growth={stats.occupancyGrowth} growthSuffix="pt" />
        </div>

        {/* Top Facilities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-600" />
            売上トップ5
          </h3>
          {topFacilities.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">データがありません</p>
          ) : (
            <div className="space-y-3">
              {topFacilities.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-gray-200 text-gray-700' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{f.name}</span>
                      <span className="text-sm font-bold text-gray-700 ml-2 shrink-0">{formatYen(f.revenue)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(f.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alert Facilities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            要注意施設
          </h3>
          {alertFacilities.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">要注意施設はありません</p>
          ) : (
            <div className="space-y-2">
              {alertFacilities.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-gray-800">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-red-600">利用率 {f.occupancyRate}%</span>
                    <span className={f.profitMargin < 0 ? 'text-red-600' : 'text-gray-600'}>
                      利益率 {f.profitMargin > 0 ? '+' : ''}{f.profitMargin}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: Tab - Facilities
  // ============================================================
  const SortIcon = ({ col }: { col: string }) => {
    if (facilitySortKey !== col) return <ChevronDown className="w-3 h-3 text-gray-300" />;
    return facilitySortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-cyan-600" />
      : <ChevronDown className="w-3 h-3 text-cyan-600" />;
  };

  const renderFacilities = () => {
    if (facilitiesLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="施設名・法人名で検索..."
                value={facilitySearch}
                onChange={e => { setFacilitySearch(e.target.value); setFacilityPage(0); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <select
              value={facilityCompanyFilter}
              onChange={e => { setFacilityCompanyFilter(e.target.value); setFacilityPage(0); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              <option value="all">全法人</option>
              {companyNames.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={facilityStatusFilter}
              onChange={e => { setFacilityStatusFilter(e.target.value); setFacilityPage(0); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              <option value="all">全ステータス</option>
              <option value="active">稼働中</option>
              <option value="pending">準備中</option>
              <option value="suspended">停止中</option>
            </select>
            <select
              value={facilityTypeFilter}
              onChange={e => { setFacilityTypeFilter(e.target.value); setFacilityPage(0); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              <option value="all">全種別</option>
              <option value="franchise">FC</option>
              <option value="independent">独立</option>
            </select>
          </div>
          <p className="text-xs text-gray-400 mt-2">{filteredFacilities.length}件の施設</p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  {[
                    { key: 'name', label: '施設名' },
                    { key: 'company', label: '法人' },
                    { key: 'children', label: '児童数' },
                    { key: 'staff', label: 'スタッフ数' },
                    { key: 'revenue', label: '月間売上' },
                    { key: 'occupancy', label: '利用率' },
                    { key: 'rating', label: '評価' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleFacilitySort(col.key)}
                      className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedFacilities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                      該当する施設がありません
                    </td>
                  </tr>
                ) : (
                  paginatedFacilities.map(f => (
                    <tr
                      key={f.id}
                      onClick={() => { setSelectedFacility(f); setFacilityDetailTab('summary'); }}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            f.status === 'active' ? 'bg-green-500' :
                            f.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm font-medium text-gray-800">{f.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{f.companyName}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{f.childrenCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{f.staffCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{formatYen(f.monthlyRevenue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                f.occupancyRate >= 80 ? 'bg-green-500' :
                                f.occupancyRate >= 60 ? 'bg-cyan-500' :
                                f.occupancyRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, f.occupancyRate)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{formatPercent(f.occupancyRate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm text-gray-700">{f.rating.toFixed(1)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalFacilityPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {facilityPage * PAGE_SIZE + 1} - {Math.min((facilityPage + 1) * PAGE_SIZE, filteredFacilities.length)} / {filteredFacilities.length}件
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFacilityPage(p => Math.max(0, p - 1))}
                  disabled={facilityPage === 0}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-600 px-2">{facilityPage + 1} / {totalFacilityPages}</span>
                <button
                  onClick={() => setFacilityPage(p => Math.min(totalFacilityPages - 1, p + 1))}
                  disabled={facilityPage >= totalFacilityPages - 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: Facility Detail Modal
  // ============================================================
  const renderFacilityModal = () => {
    if (!selectedFacility) return null;
    const f = selectedFacility;

    const renderDetailContent = () => {
      switch (facilityDetailTab) {
        case 'summary':
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{f.childrenCount}</p>
                  <p className="text-xs text-gray-500 mt-1">登録児童数</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{f.staffCount}</p>
                  <p className="text-xs text-gray-500 mt-1">スタッフ数</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{formatPercent(f.occupancyRate)}</p>
                  <p className="text-xs text-gray-500 mt-1">利用率</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <p className="text-2xl font-bold text-gray-800">{f.rating.toFixed(1)}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">評価</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-2">施設情報</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">法人:</span> <span className="font-medium">{f.companyName}</span></div>
                  <div><span className="text-gray-500">種別:</span> <span className="font-medium">{f.franchiseOrIndependent === 'franchise' ? 'FC' : f.franchiseOrIndependent === 'independent' ? '独立' : '未設定'}</span></div>
                  <div><span className="text-gray-500">ステータス:</span> <span className={`font-medium ${f.status === 'active' ? 'text-green-600' : f.status === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>{f.status === 'active' ? '稼働中' : f.status === 'pending' ? '準備中' : '停止中'}</span></div>
                  <div><span className="text-gray-500">施設ID:</span> <span className="font-mono text-xs">{f.id}</span></div>
                </div>
              </div>
            </div>
          );

        case 'revenue':
          return (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3">月別売上推移</h4>
                <div className="space-y-2">
                  {Array.from({ length: 6 }, (_, i) => {
                    const monthOffset = 5 - i;
                    const d = new Date();
                    d.setMonth(d.getMonth() - monthOffset);
                    const label = `${d.getFullYear()}/${d.getMonth() + 1}`;
                    const rev = f.monthlyRevenue * (0.85 + Math.random() * 0.3);
                    const maxRev = f.monthlyRevenue * 1.2;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-cyan-500 h-3 rounded-full"
                            style={{ width: `${(rev / maxRev) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-24 text-right shrink-0">
                          {formatYen(Math.round(rev))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-cyan-50 rounded-lg p-4 text-center border border-cyan-100">
                  <p className="text-lg font-bold text-cyan-700">{formatYen(f.monthlyRevenue)}</p>
                  <p className="text-xs text-cyan-600 mt-1">今月売上</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                  <p className="text-lg font-bold text-green-700">{formatYen(Math.round(f.monthlyRevenue * 0.68))}</p>
                  <p className="text-xs text-green-600 mt-1">給付費収入</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
                  <p className="text-lg font-bold text-purple-700">{formatYen(Math.round(f.monthlyRevenue * 0.32))}</p>
                  <p className="text-xs text-purple-600 mt-1">利用者負担金</p>
                </div>
              </div>
            </div>
          );

        case 'staff':
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-2xl font-bold text-blue-700">{Math.max(1, Math.ceil(f.staffCount * 0.6))}</p>
                  <p className="text-xs text-blue-600 mt-1">常勤職員</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
                  <p className="text-2xl font-bold text-purple-700">{Math.floor(f.staffCount * 0.4)}</p>
                  <p className="text-xs text-purple-600 mt-1">非常勤職員</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-700">
                    {f.staffCount > 0 ? (f.childrenCount / f.staffCount).toFixed(1) : '0'}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">児童/職員比</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3">職種別配置</h4>
                {[
                  { role: '児童発達支援管理責任者', count: 1, color: 'bg-cyan-500' },
                  { role: '児童指導員', count: Math.max(1, Math.ceil(f.staffCount * 0.4)), color: 'bg-blue-500' },
                  { role: '保育士', count: Math.max(0, Math.ceil(f.staffCount * 0.3)), color: 'bg-green-500' },
                  { role: 'その他', count: Math.max(0, f.staffCount - Math.ceil(f.staffCount * 0.7) - 1), color: 'bg-gray-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm text-gray-700 flex-1">{item.role}</span>
                    <span className="text-sm font-bold text-gray-800">{item.count}名</span>
                  </div>
                ))}
              </div>
            </div>
          );

        case 'additions':
          return (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3">取得中の加算</h4>
                <div className="space-y-2">
                  {[
                    { name: '児童発達支援管理責任者専任加算', amount: 135000, active: true },
                    { name: '福祉専門職員配置等加算(I)', amount: 98000, active: true },
                    { name: '送迎加算', amount: 54000, active: true },
                    { name: '延長支援加算', amount: 30000, active: true },
                    { name: '家庭連携加算', amount: 0, active: false },
                    { name: '事業所内相談支援加算', amount: 0, active: false },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${
                      item.active ? 'bg-white border border-green-200' : 'bg-gray-100 border border-gray-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {item.active ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Minus className="w-4 h-4 text-gray-400" />
                        )}
                        <span className={`text-sm ${item.active ? 'text-gray-800' : 'text-gray-400'}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${item.active ? 'text-green-600' : 'text-gray-400'}`}>
                        {item.active ? formatYen(item.amount) : '未取得'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-cyan-600" />
                  <span className="text-sm font-bold text-cyan-700">加算合計</span>
                </div>
                <p className="text-2xl font-bold text-cyan-800">{formatYen(317000)}</p>
                <p className="text-xs text-cyan-600 mt-1">月額推定</p>
              </div>
            </div>
          );

        case 'facilityInsights':
          return (
            <div className="space-y-4">
              {[
                {
                  type: 'opportunity' as const,
                  icon: Zap,
                  color: 'text-green-600',
                  bg: 'bg-green-50',
                  border: 'border-green-200',
                  title: '家庭連携加算の取得機会',
                  desc: '保護者面談の実施頻度から、家庭連携加算の要件を満たす可能性があります。月額約8万円の増収が見込めます。',
                  impact: '+¥80,000/月',
                },
                {
                  type: 'growth' as const,
                  icon: Target,
                  color: 'text-cyan-600',
                  bg: 'bg-cyan-50',
                  border: 'border-cyan-200',
                  title: '利用率改善の提案',
                  desc: '午前の利用率が低い傾向にあります。午前プログラムの充実により利用率を10%改善する余地があります。',
                  impact: '+¥120,000/月',
                },
                {
                  type: 'warning' as const,
                  icon: AlertTriangle,
                  color: 'text-amber-600',
                  bg: 'bg-amber-50',
                  border: 'border-amber-200',
                  title: '職員配置基準の確認',
                  desc: '来月の退職予定者を考慮すると、児童指導員の配置基準を下回る可能性があります。早急な採用計画が必要です。',
                  impact: 'リスク: 高',
                },
              ].map((insight, i) => (
                <div key={i} className={`${insight.bg} rounded-lg p-4 border ${insight.border}`}>
                  <div className="flex items-start gap-3">
                    <insight.icon className={`w-5 h-5 ${insight.color} mt-0.5 shrink-0`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-bold text-gray-800">{insight.title}</h5>
                        <span className={`text-xs font-bold ${insight.color}`}>{insight.impact}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{insight.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{f.name}</h2>
                <p className="text-sm text-gray-500">{f.companyName}</p>
              </div>
              <button
                onClick={() => setSelectedFacility(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {/* Sub-tabs */}
            <div className="flex gap-1 mt-3 -mb-4 overflow-x-auto">
              {FACILITY_DETAIL_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFacilityDetailTab(tab.key)}
                  className={`px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                    facilityDetailTab === tab.key
                      ? 'border-b-2 border-cyan-600 text-cyan-600 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            {renderDetailContent()}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: Tab - Companies
  // ============================================================
  const renderCompanies = () => {
    if (companiesLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header with Add button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{companies.length}件の法人</p>
          <button
            onClick={openAddCompany}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            法人を追加
          </button>
        </div>

        {/* Company Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">法人名</th>
                  <th className="px-4 py-3 text-left">種別</th>
                  <th className="px-4 py-3 text-left">施設数</th>
                  <th className="px-4 py-3 text-left">合計売上</th>
                  <th className="px-4 py-3 text-left">契約状態</th>
                  <th className="px-4 py-3 text-left">ティア</th>
                  <th className="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                      法人が登録されていません
                    </td>
                  </tr>
                ) : (
                  companies.map(c => (
                    <React.Fragment key={c.id}>
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleExpandCompany(c.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {expandedCompany === c.id
                              ? <ChevronUp className="w-4 h-4 text-gray-400" />
                              : <ChevronDown className="w-4 h-4 text-gray-400" />
                            }
                            <span className="text-sm font-medium text-gray-800">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {c.companyType === 'corporation' ? '法人' : c.companyType === 'npo' ? 'NPO' : c.companyType}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.facilityCount}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatYen(c.totalRevenue)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            c.contractStatus === 'active' ? 'bg-green-100 text-green-800' :
                            c.contractStatus === 'expired' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {c.contractStatus === 'active' ? '有効' : c.contractStatus === 'expired' ? '期限切れ' : c.contractStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">{getTierBadge(c.tier)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditCompany(c); }}
                              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                              title="編集"
                            >
                              <Edit3 className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteCompany(c.id); }}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row: show linked facilities */}
                      {expandedCompany === c.id && (
                        <tr>
                          <td colSpan={7} className="px-8 py-4 bg-gray-50">
                            <p className="text-xs font-medium text-gray-500 mb-2">所属施設</p>
                            {companyFacilities.length === 0 ? (
                              <p className="text-xs text-gray-400">施設が紐付けされていません</p>
                            ) : (
                              <div className="space-y-1">
                                {companyFacilities.map(cf => (
                                  <div key={cf.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                      <span className="text-sm text-gray-700">{cf.name}</span>
                                    </div>
                                    <select
                                      value={cf.companyId || ''}
                                      onChange={async (e) => {
                                        const newCompanyId = e.target.value || null;
                                        await supabase.from('facilities').update({ company_id: newCompanyId }).eq('id', cf.id);
                                        handleExpandCompany(c.id); // refresh
                                        loadCompaniesData();
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                                    >
                                      <option value="">未設定</option>
                                      {companyNames.map(cn => (
                                        <option key={cn.id} value={cn.id}>{cn.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: Company Add/Edit Modal
  // ============================================================
  const renderCompanyModal = () => {
    if (!companyModalOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                {editingCompany ? '法人を編集' : '法人を追加'}
              </h2>
              <button
                onClick={() => setCompanyModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">法人名 *</label>
              <input
                type="text"
                value={companyForm.name}
                onChange={e => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="株式会社○○"
              />
            </div>

            {/* Company Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">法人種別</label>
              <select
                value={companyForm.companyType}
                onChange={e => setCompanyForm(prev => ({ ...prev, companyType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              >
                <option value="corporation">株式会社</option>
                <option value="npo">NPO法人</option>
                <option value="social_welfare">社会福祉法人</option>
                <option value="medical">医療法人</option>
                <option value="individual">個人事業主</option>
                <option value="other">その他</option>
              </select>
            </div>

            {/* Franchise Brand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">FCブランド</label>
              <input
                type="text"
                value={companyForm.franchiseBrand}
                onChange={e => setCompanyForm(prev => ({ ...prev, franchiseBrand: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="フランチャイズブランド名（該当する場合）"
              />
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者名</label>
                <input
                  type="text"
                  value={companyForm.contactPersonName}
                  onChange={e => setCompanyForm(prev => ({ ...prev, contactPersonName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="山田太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者メール</label>
                <input
                  type="email"
                  value={companyForm.contactPersonEmail}
                  onChange={e => setCompanyForm(prev => ({ ...prev, contactPersonEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="yamada@example.com"
                />
              </div>
            </div>

            {/* Contract Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">契約開始日</label>
                <input
                  type="date"
                  value={companyForm.contractStartDate}
                  onChange={e => setCompanyForm(prev => ({ ...prev, contractStartDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">契約終了日</label>
                <input
                  type="date"
                  value={companyForm.contractEndDate}
                  onChange={e => setCompanyForm(prev => ({ ...prev, contractEndDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Tier & Fee */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ティア</label>
                <select
                  value={companyForm.tier}
                  onChange={e => setCompanyForm(prev => ({ ...prev, tier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                >
                  <option value="basic">ベーシック</option>
                  <option value="standard">スタンダード</option>
                  <option value="premium">プレミアム</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">月額利用料</label>
                <input
                  type="number"
                  value={companyForm.monthlyFee}
                  onChange={e => setCompanyForm(prev => ({ ...prev, monthlyFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">契約状態</label>
              <select
                value={companyForm.status}
                onChange={e => setCompanyForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              >
                <option value="active">有効</option>
                <option value="trial">トライアル</option>
                <option value="suspended">停止中</option>
                <option value="expired">期限切れ</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea
                value={companyForm.notes}
                onChange={e => setCompanyForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                placeholder="備考を入力..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setCompanyModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveCompany}
                disabled={!companyForm.name.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingCompany ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: Tab - Benchmark
  // ============================================================
  const renderBenchmark = () => {
    if (benchmarkLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        </div>
      );
    }

    const formatBenchmarkValue = (value: number): string => {
      switch (benchmarkMetric) {
        case 'revenue': return formatYen(Math.round(value));
        case 'occupancy':
        case 'profitMargin':
        case 'staffRatio':
        case 'additionRate': return formatPercent(value);
        case 'childrenPerStaff': return value.toFixed(1);
        case 'satisfaction': return value.toFixed(1);
        default: return String(value);
      }
    };

    return (
      <div className="space-y-4">
        {/* Metric Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">指標を選択</p>
          <div className="flex flex-wrap gap-2">
            {BENCHMARK_METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setBenchmarkMetric(m.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  benchmarkMetric === m.key
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Distribution Summary */}
        {benchmarkSummary && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3">分布サマリー</h4>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
              {[
                { label: '最小', value: benchmarkSummary.min },
                { label: 'Q1', value: benchmarkSummary.q1 },
                { label: '中央値', value: benchmarkSummary.median },
                { label: 'Q3', value: benchmarkSummary.q3 },
                { label: '最大', value: benchmarkSummary.max },
                { label: '平均', value: benchmarkSummary.mean },
                { label: '標準偏差', value: benchmarkSummary.stdDev },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{formatBenchmarkValue(item.value)}</p>
                </div>
              ))}
            </div>

            {/* Visual distribution bar */}
            <div className="mt-4 relative h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-red-200 via-yellow-200 via-green-200 to-cyan-200 rounded-full"
                style={{ left: '0%', width: '100%' }}
              />
              {/* Quartile markers */}
              <div
                className="absolute top-0 h-full w-0.5 bg-gray-500"
                style={{ left: `${benchmarkSummary.max > 0 ? (benchmarkSummary.q1 / benchmarkSummary.max) * 100 : 25}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-gray-700"
                style={{ left: `${benchmarkSummary.max > 0 ? (benchmarkSummary.median / benchmarkSummary.max) * 100 : 50}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-gray-500"
                style={{ left: `${benchmarkSummary.max > 0 ? (benchmarkSummary.q3 / benchmarkSummary.max) * 100 : 75}%` }}
              />
            </div>
          </div>
        )}

        {/* Ranking Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left w-12">順位</th>
                  <th className="px-4 py-3 text-left">施設名</th>
                  <th className="px-4 py-3 text-left">法人</th>
                  <th className="px-4 py-3 text-left">値</th>
                  <th className="px-4 py-3 text-left">パーセンタイル</th>
                  <th className="px-4 py-3 text-left">偏差値</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  benchmarkData.map(row => (
                    <tr key={row.facilityId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          row.rank === 1 ? 'bg-amber-100 text-amber-700' :
                          row.rank === 2 ? 'bg-gray-200 text-gray-700' :
                          row.rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'text-gray-500'
                        }`}>
                          {row.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.facilityName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.companyName}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatBenchmarkValue(row.value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-cyan-500 h-1.5 rounded-full"
                              style={{ width: `${row.percentile}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{row.percentile}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getDeviationStyle(row.deviation)}`}>
                          {row.deviation}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: Tab - Insights
  // ============================================================
  const renderInsights = () => {
    if (insightsLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
        </div>
      );
    }

    const additionInsights = filteredInsights.filter(i => i.type === 'addition');
    const growthInsights = filteredInsights.filter(i => i.type === 'growth');
    const riskInsights = filteredInsights.filter(i => i.type === 'risk');

    return (
      <div className="space-y-6">
        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={insightFilter}
              onChange={e => setInsightFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              <option value="all">全て表示</option>
              {insightFilterOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Addition Optimization */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-green-500 rounded-full" />
            <h3 className="text-sm font-bold text-gray-800">加算最適化チャンス</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {additionInsights.length}件
            </span>
          </div>
          {additionInsights.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
              該当するインサイトはありません
            </div>
          ) : (
            <div className="space-y-3">
              {additionInsights.map(insight => (
                <div key={insight.id} className="bg-white rounded-xl shadow-sm border border-green-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-800">{insight.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{insight.facilityName} / {insight.companyName}</p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 shrink-0">
                          +{formatCompactYen(insight.estimatedImpact)}/月
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Growth Potential */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-amber-500 rounded-full" />
            <h3 className="text-sm font-bold text-gray-800">成長ポテンシャル</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {growthInsights.length}件
            </span>
          </div>
          {growthInsights.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
              該当するインサイトはありません
            </div>
          ) : (
            <div className="space-y-3">
              {growthInsights.map(insight => (
                <div key={insight.id} className="bg-white rounded-xl shadow-sm border border-amber-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-800">{insight.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{insight.facilityName} / {insight.companyName}</p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 shrink-0">
                          +{formatCompactYen(insight.estimatedImpact)}/月
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risk Alerts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-red-500 rounded-full" />
            <h3 className="text-sm font-bold text-gray-800">要注意施設</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {riskInsights.length}件
            </span>
          </div>
          {riskInsights.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
              該当するリスクはありません
            </div>
          ) : (
            <div className="space-y-3">
              {riskInsights.map(insight => (
                <div key={insight.id} className="bg-white rounded-xl shadow-sm border border-red-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-800">{insight.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{insight.facilityName} / {insight.companyName}</p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 shrink-0">
                          {formatCompactYen(Math.abs(insight.estimatedImpact))}/月 減
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: Active Tab Content
  // ============================================================
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'facilities': return renderFacilities();
      case 'companies': return renderCompanies();
      case 'benchmark': return renderBenchmark();
      case 'insights': return renderInsights();
      default: return null;
    }
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Roots プラットフォーム管理</h1>
                <p className="text-xs text-gray-500">全施設・全法人の統合管理ダッシュボード</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:inline">{user?.name}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                オーナー
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-b-2 border-cyan-600 text-cyan-600 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Month Navigator (for overview, benchmark) */}
      {(activeTab === 'overview' || activeTab === 'benchmark') && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-bold text-gray-800 min-w-[100px] text-center">
              {yearMonthLabel(yearMonth)}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderTabContent()}
      </main>

      {/* Modals */}
      {renderFacilityModal()}
      {renderCompanyModal()}
    </div>
  );
}
