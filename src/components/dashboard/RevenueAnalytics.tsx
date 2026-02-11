/**
 * 売上・加算分析ダッシュボード
 * - 排他制御（同時取得不可の加算）
 * - 月間上限
 * - スタッフベースの加算提案
 * - 要件チェック・アラート
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  Target,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  BarChart3,
  ArrowUp,
  Info,
  Settings,
  Calculator,
  Zap,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Child } from '@/types';
import {
  calculateRevenue,
  resolveExclusiveGroups,
  EXCLUSIVE_GROUPS,
  MONTHLY_LIMITS,
  Addition,
  AdditionSelection,
  CalculationResult,
  Staff,
  FacilityAdditionSetting,
  categorizeAdditionsByType,
  mergeWithFacilitySettings,
} from '@/utils/additionCalculator';

// 型定義
interface AdditionCategory {
  code: string;
  name: string;
  display_order: number;
}

interface RegionalUnit {
  grade: string;
  unit_price: number;
}

interface BaseReward {
  service_type_code: string;
  time_category: number;
  units: number;
  time_description: string;
}

interface RevenueAnalyticsProps {
  facilityId: string;
  childrenData: Child[];
}

// カテゴリのアイコン
const categoryIcons: Record<string, React.ElementType> = {
  staff_allocation: Users,
  specialist: Target,
  family_support: Users,
  individual_support: CheckCircle,
  transport: Calendar,
  time_extension: Calendar,
  daily_care: CheckCircle,
  behavior_support: AlertTriangle,
  medical_care: AlertTriangle,
  treatment_improvement: DollarSign,
};

export default function RevenueAnalytics({ facilityId, childrenData }: RevenueAnalyticsProps) {
  const children = childrenData;

  // State
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [categories, setCategories] = useState<AdditionCategory[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [regionalUnits, setRegionalUnits] = useState<RegionalUnit[]>([]);
  const [baseRewards, setBaseRewards] = useState<BaseReward[]>([]);
  const [facilityAdditionSettings, setFacilityAdditionSettings] = useState<FacilityAdditionSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['staff_allocation', 'specialist']));
  const [selectedMonth, setSelectedMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [activeTab, setActiveTab] = useState<'simulator' | 'suggestions' | 'alerts'>('simulator');

  // 施設設定
  const [facilityConfig, setFacilityConfig] = useState({
    serviceTypeCode: '',  // 空文字 = 未設定
    regionalGrade: '',    // 空文字 = 未設定
    capacity: 0,          // 0 = 未設定
    isConfigured: false,  // 設定済みフラグ
  });

  // 加算選択状態（シミュレーション用）
  const [additionSelections, setAdditionSelections] = useState<Map<string, AdditionSelection>>(new Map());

  // データ取得
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        { data: additionsData },
        { data: categoriesData },
        { data: staffData },
        { data: regionalData },
        { data: baseRewardsData },
        { data: facilityConfigData },
        { data: facilitySettingsData },
      ] = await Promise.all([
        supabase.from('additions').select('*').eq('is_active', true).order('display_order'),
        supabase.from('addition_categories').select('*').order('display_order'),
        supabase.from('staff').select('*').eq('facility_id', facilityId),
        supabase.from('regional_units').select('*'),
        supabase.from('base_rewards').select('*'),
        supabase.from('facility_settings').select('service_type_code, regional_grade, capacity').eq('facility_id', facilityId).single(),
        supabase.from('facility_addition_settings').select('*').eq('facility_id', facilityId),
      ]);

      setAdditions(additionsData || []);
      setCategories(categoriesData || []);
      setStaffList(staffData || []);
      setRegionalUnits(regionalData || []);
      setBaseRewards(baseRewardsData || []);
      setFacilityAdditionSettings(facilitySettingsData || []);

      if (facilityConfigData) {
        const hasServiceType = !!facilityConfigData.service_type_code;
        const hasRegionalGrade = !!facilityConfigData.regional_grade;
        setFacilityConfig({
          serviceTypeCode: facilityConfigData.service_type_code || '',
          regionalGrade: facilityConfigData.regional_grade || '',
          capacity: facilityConfigData.capacity ?? 0,
          isConfigured: hasServiceType && hasRegionalGrade,
        });
      }

      // 初期選択状態を設定（月次選択型のみ手動選択、事前届出型は自動適用）
      const initialSelections = new Map<string, AdditionSelection>();
      (facilitySettingsData || []).forEach((setting: FacilityAdditionSetting) => {
        const addition = additionsData?.find(a => a.code === setting.addition_code);
        // 事前届出型はステータスがactiveの場合のみ自動適用
        if (addition?.addition_type === 'facility_preset') {
          if (setting.is_enabled && setting.status === 'active') {
            initialSelections.set(setting.addition_code, {
              code: setting.addition_code,
              enabled: true,
            });
          }
        } else {
          // 月次選択型は従来通り
          initialSelections.set(setting.addition_code, {
            code: setting.addition_code,
            enabled: setting.is_enabled,
          });
        }
      });
      setAdditionSelections(initialSelections);

    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 地域区分単価（未設定時は0）
  const unitPrice = useMemo(() => {
    if (!facilityConfig.isConfigured || !facilityConfig.regionalGrade) return 0;
    const region = regionalUnits.find(r => r.grade === facilityConfig.regionalGrade);
    return region?.unit_price || 0;
  }, [regionalUnits, facilityConfig.regionalGrade, facilityConfig.isConfigured]);

  // 基本報酬（時間区分2を基準、未設定時は0）
  const baseRewardUnits = useMemo(() => {
    if (!facilityConfig.isConfigured || !facilityConfig.serviceTypeCode) return 0;
    const reward = baseRewards.find(
      r => r.service_type_code === facilityConfig.serviceTypeCode && r.time_category === 2
    );
    return reward?.units || 0;
  }, [baseRewards, facilityConfig.serviceTypeCode, facilityConfig.isConfigured]);

  // 営業日数
  const businessDays = useMemo(() => {
    const { year, month } = selectedMonth;
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0) count++; // 日曜以外
    }
    return count;
  }, [selectedMonth]);

  // 施設が取得可能な加算
  const availableAdditions = useMemo(() => {
    return additions.filter(a =>
      a.applicable_services?.includes(facilityConfig.serviceTypeCode)
    );
  }, [additions, facilityConfig.serviceTypeCode]);

  // 加算をタイプ別に分類
  const { facilityPreset: presetAdditions, monthly: monthlyAdditions, daily: dailyAdditions } = useMemo(() => {
    return categorizeAdditionsByType(availableAdditions);
  }, [availableAdditions]);

  // 適用中の事前届出型加算
  const activePresetAdditions = useMemo(() => {
    return presetAdditions.filter(addition => {
      const setting = facilityAdditionSettings.find(s => s.addition_code === addition.code);
      return setting?.is_enabled && setting?.status === 'active';
    });
  }, [presetAdditions, facilityAdditionSettings]);

  // 月次/日次選択型加算をカテゴリ別にグループ化
  const selectableAdditionsByCategory = useMemo(() => {
    const map = new Map<string, Addition[]>();
    [...monthlyAdditions, ...dailyAdditions].forEach(addition => {
      const cat = addition.category_code || 'other';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(addition);
    });
    return map;
  }, [monthlyAdditions, dailyAdditions]);

  // カテゴリ別に加算をグループ化（従来互換用）
  const additionsByCategory = useMemo(() => {
    const map = new Map<string, Addition[]>();
    availableAdditions.forEach(addition => {
      const cat = addition.category_code || 'other';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(addition);
    });
    return map;
  }, [availableAdditions]);

  // 現在の選択から計算結果を取得
  const calculationResult = useMemo((): CalculationResult => {
    const selections = Array.from(additionSelections.values());

    // 適切な型に変換
    const typedAdditions: Addition[] = additions.map(a => ({
      ...a,
      exclusive_with: a.exclusive_with || null,
      requirements_json: null,
    }));

    const typedStaff: Staff[] = staffList.map(s => ({
      id: s.id,
      name: s.name || `${s.last_name || ''}${s.first_name || ''}`,
      qualifications: s.qualifications || [],
      years_of_experience: s.years_of_experience || 0,
      employment_type: s.employment_type || 'fulltime',
      weekly_hours: s.weekly_hours || 40,
      is_active: s.is_active !== false,
    }));

    const typedChildren = children.map(c => ({
      id: c.id,
      name: c.name,
      medical_care_score: c.medical_care_score,
      behavior_disorder_score: c.behavior_disorder_score,
      care_needs_category: c.care_needs_category,
      is_protected_child: c.is_protected_child,
      income_category: c.income_category,
    }));

    return calculateRevenue(
      selections,
      typedAdditions,
      typedStaff,
      typedChildren,
      baseRewardUnits,
      businessDays,
      unitPrice
    );
  }, [additionSelections, additions, staffList, children, baseRewardUnits, businessDays, unitPrice]);

  // 加算のON/OFF切り替え
  const toggleAddition = (code: string) => {
    const newSelections = new Map(additionSelections);
    const current = newSelections.get(code);
    if (current) {
      newSelections.set(code, { ...current, enabled: !current.enabled });
    } else {
      newSelections.set(code, { code, enabled: true });
    }
    setAdditionSelections(newSelections);
  };

  // 月間日数の変更（上限ありの加算用）
  const updateDaysPerMonth = (code: string, days: number) => {
    const newSelections = new Map(additionSelections);
    const current = newSelections.get(code) || { code, enabled: true };
    newSelections.set(code, { ...current, customDaysPerMonth: days });
    setAdditionSelections(newSelections);
  };

  // カテゴリ展開トグル
  const toggleCategory = (categoryCode: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryCode)) {
      newExpanded.delete(categoryCode);
    } else {
      newExpanded.add(categoryCode);
    }
    setExpandedCategories(newExpanded);
  };

  // 排他グループの説明を取得
  const getExclusiveGroupInfo = (code: string): string | null => {
    for (const [groupName, codes] of Object.entries(EXCLUSIVE_GROUPS)) {
      if (codes.includes(code)) {
        const groupLabels: Record<string, string> = {
          staff_allocation: '児童指導員等加配加算',
          treatment_improvement: '処遇改善加算',
          extension: '延長支援加算',
          behavior_support: '強度行動障害児支援加算',
          individual_support_1: '個別サポート加算(I)',
        };
        return `${groupLabels[groupName] || groupName}グループ（最大1つ選択可）`;
      }
    }
    return null;
  };

  // 月間上限の取得
  const getMonthlyLimit = (code: string): number | null => {
    return MONTHLY_LIMITS[code] || null;
  };

  // 利用児童数・利用日数
  const activeChildrenCount = children.filter(c => c.contractStatus === 'active').length;
  const avgDaysPerChild = 12;
  const totalUsageDays = activeChildrenCount * avgDaysPerChild;

  // 月間売上計算
  const monthlyRevenue = useMemo(() => {
    const activeAdditions = calculationResult.breakdown.filter(b => b.status === 'active');

    // 基本報酬
    const baseUnits = baseRewardUnits * totalUsageDays;

    // 加算単位（日額加算 × 利用日数）
    let additionUnits = 0;
    activeAdditions.forEach(b => {
      if (!b.isPercentage) {
        additionUnits += b.unitsPerDay * totalUsageDays;
      }
    });

    // 処遇改善加算
    const treatmentAddition = activeAdditions.find(b => b.code.startsWith('treatment_improvement'));
    let treatmentUnits = 0;
    if (treatmentAddition && treatmentAddition.percentageRate) {
      treatmentUnits = Math.floor((baseUnits + additionUnits) * (treatmentAddition.percentageRate / 100));
    }

    const totalUnits = baseUnits + additionUnits + treatmentUnits;
    const totalRevenue = Math.floor(totalUnits * unitPrice);

    return {
      baseUnits,
      additionUnits,
      treatmentUnits,
      totalUnits,
      totalRevenue,
    };
  }, [calculationResult, baseRewardUnits, totalUsageDays, unitPrice]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 施設設定が未完了の場合はガイダンスを表示
  if (!facilityConfig.isConfigured) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-purple-600" />
            売上シミュレーター
          </h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            施設設定が必要です
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            売上シミュレーションを行うには、まず施設情報で<br />
            <strong>サービス種別</strong>と<strong>地域区分</strong>を設定してください。
          </p>
          <div className="bg-white rounded-lg p-4 border border-amber-100 inline-block">
            <p className="text-xs text-gray-500 mb-2">設定が必要な項目:</p>
            <div className="flex gap-3 justify-center text-sm">
              <span className={`px-3 py-1 rounded ${facilityConfig.serviceTypeCode ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {facilityConfig.serviceTypeCode ? '✓' : '×'} サービス種別
              </span>
              <span className={`px-3 py-1 rounded ${facilityConfig.regionalGrade ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {facilityConfig.regionalGrade ? '✓' : '×'} 地域区分
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-purple-600" />
              売上シミュレーター
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              加算のON/OFFで売上がどう変わるかシミュレーションできます
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                value={`${selectedMonth.year}-${selectedMonth.month}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-').map(Number);
                  setSelectedMonth({ year, month });
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {Array.from({ length: 6 }, (_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + i);
                  return (
                    <option key={i} value={`${d.getFullYear()}-${d.getMonth() + 1}`}>
                      {d.getFullYear()}年{d.getMonth() + 1}月
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="text-sm text-gray-500">
              営業日数: <span className="font-bold text-gray-700">{businessDays}日</span>
            </div>
          </div>
        </div>

        {/* 売上サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">月間売上見込み</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">
              {monthlyRevenue.totalRevenue.toLocaleString()}円
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">基本報酬</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {monthlyRevenue.baseUnits.toLocaleString()}単位
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">加算</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {(monthlyRevenue.additionUnits + monthlyRevenue.treatmentUnits).toLocaleString()}単位
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">利用児童</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {activeChildrenCount}名 × {avgDaysPerChild}日
            </div>
          </div>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'simulator', label: '加算シミュレーター', icon: Calculator },
          { id: 'suggestions', label: '加算提案', icon: Lightbulb, badge: calculationResult.suggestions.length },
          { id: 'alerts', label: 'アラート', icon: AlertTriangle, badge: calculationResult.warnings.filter(w => w.severity === 'error').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                tab.id === 'alerts' ? 'bg-red-500 text-white' : 'bg-purple-100 text-purple-700'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* シミュレータータブ */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 加算選択パネル */}
          <div className="lg:col-span-2 space-y-4">
            {/* 適用中の体制加算（事前届出型） */}
            {activePresetAdditions.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 overflow-hidden">
                <div className="px-4 py-3 bg-green-100/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">適用中の体制加算</span>
                    <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                      自動適用
                    </span>
                  </div>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // サイドバーの加算体制設定へ遷移
                      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'addition-settings' } }));
                    }}
                    className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1"
                  >
                    <Settings className="w-4 h-4" />
                    設定変更
                  </a>
                </div>
                <div className="divide-y divide-green-100">
                  {activePresetAdditions.map(addition => {
                    const breakdown = calculationResult.breakdown.find(b => b.code === addition.code);
                    return (
                      <div key={addition.code} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{addition.name}</div>
                          <div className="text-sm text-gray-500">
                            {addition.is_percentage ? (
                              <span>{addition.percentage_rate}%加算</span>
                            ) : (
                              <span>{addition.units}単位/日</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-green-600">
                            +{(breakdown?.totalUnits || 0).toLocaleString()}単位
                          </div>
                          <div className="text-xs text-gray-500">/月</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 月次/日次選択型加算 */}
            <div className="flex items-center gap-2 pt-2">
              <Zap className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-gray-700">月次選択加算</span>
              <span className="text-xs text-gray-500">（利用実績に応じて選択）</span>
            </div>

            {categories.map(category => {
              const categoryAdditions = selectableAdditionsByCategory.get(category.code) || [];
              if (categoryAdditions.length === 0) return null;

              const isExpanded = expandedCategories.has(category.code);
              const enabledCount = categoryAdditions.filter(a =>
                additionSelections.get(a.code)?.enabled
              ).length;
              const CategoryIcon = categoryIcons[category.code] || Target;

              return (
                <div key={category.code} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.code)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CategoryIcon className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-gray-800">{category.name}</span>
                      {enabledCount > 0 && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {enabledCount}件選択中
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {categoryAdditions.map(addition => {
                        const selection = additionSelections.get(addition.code);
                        const isEnabled = selection?.enabled || false;
                        const breakdown = calculationResult.breakdown.find(b => b.code === addition.code);
                        const exclusiveGroup = getExclusiveGroupInfo(addition.code);
                        const monthlyLimit = getMonthlyLimit(addition.code);
                        const isExcluded = breakdown?.status === 'excluded';
                        const isInvalid = breakdown?.status === 'invalid';

                        return (
                          <div
                            key={addition.code}
                            className={`px-4 py-3 ${isExcluded ? 'bg-yellow-50' : isInvalid ? 'bg-red-50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => toggleAddition(addition.code)}
                                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className={`font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                                      {addition.name}
                                    </span>
                                  </label>
                                  {exclusiveGroup && (
                                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                      排他
                                    </span>
                                  )}
                                  {monthlyLimit && (
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                      月{monthlyLimit}日上限
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 text-sm text-gray-500">
                                  {addition.is_percentage ? (
                                    <span>{addition.percentage_rate}%加算</span>
                                  ) : (
                                    <span>{addition.units}単位/{addition.unit_type === 'day' ? '日' : '回'}</span>
                                  )}
                                  {addition.requirements && (
                                    <span className="ml-2 text-gray-400">| {addition.requirements.substring(0, 40)}...</span>
                                  )}
                                </div>

                                {/* 排他除外の警告 */}
                                {isExcluded && breakdown?.statusReason && (
                                  <div className="mt-2 flex items-center gap-1 text-sm text-amber-600">
                                    <AlertCircle className="w-4 h-4" />
                                    {breakdown.statusReason}
                                  </div>
                                )}

                                {/* 要件未充足の警告 */}
                                {isInvalid && breakdown?.statusReason && (
                                  <div className="mt-2 flex items-center gap-1 text-sm text-red-600">
                                    <AlertTriangle className="w-4 h-4" />
                                    {breakdown.statusReason}
                                  </div>
                                )}
                              </div>

                              {/* 月間日数入力（上限ありの場合） */}
                              {isEnabled && monthlyLimit && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={monthlyLimit}
                                    value={selection?.customDaysPerMonth || monthlyLimit}
                                    onChange={(e) => updateDaysPerMonth(addition.code, parseInt(e.target.value) || 1)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                  />
                                  <span className="text-sm text-gray-500">日/月</span>
                                </div>
                              )}

                              {/* 加算単位表示 */}
                              {isEnabled && !isExcluded && !isInvalid && breakdown && (
                                <div className="text-right">
                                  <div className="text-sm font-medium text-purple-600">
                                    +{(breakdown.totalUnits || 0).toLocaleString()}単位
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    /月
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 計算結果パネル */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                選択中の加算
              </h3>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {calculationResult.breakdown
                  .filter(b => b.status === 'active')
                  .map(b => (
                    <div key={b.code} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-700">{b.name}</span>
                      <span className="text-sm font-medium text-purple-600">
                        {b.isPercentage ? `${b.percentageRate}%` : `${b.totalUnits.toLocaleString()}単位`}
                      </span>
                    </div>
                  ))}
                {calculationResult.breakdown.filter(b => b.status === 'active').length === 0 && (
                  <div className="text-center py-4 text-gray-400">
                    加算が選択されていません
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">加算合計</span>
                  <span className="font-bold text-gray-900">
                    {calculationResult.totalUnitsPerMonth.toLocaleString()}単位/月
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">売上見込み</span>
                  <span className="font-bold text-purple-600 text-lg">
                    {monthlyRevenue.totalRevenue.toLocaleString()}円
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提案タブ */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-purple-800">スタッフの状況から取得可能な加算を提案</p>
                <p className="text-sm text-purple-600 mt-1">
                  現在のスタッフの資格・経験年数・常勤換算を分析し、まだ取得していない加算を提案しています。
                </p>
              </div>
            </div>
          </div>

          {calculationResult.suggestions.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-gray-600">現時点で追加提案できる加算はありません</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {calculationResult.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`bg-white rounded-lg border p-4 ${
                    suggestion.priority === 'high' ? 'border-purple-300 bg-purple-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          suggestion.priority === 'high' ? 'bg-purple-100 text-purple-700' :
                          suggestion.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {suggestion.priority === 'high' ? '優先度高' : suggestion.priority === 'medium' ? '優先度中' : '優先度低'}
                        </span>
                        <h4 className="font-medium text-gray-900">{suggestion.additionName}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{suggestion.reason}</p>
                      <p className="text-xs text-gray-500 mt-1">要件: {suggestion.requirements}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-purple-600">
                        +{suggestion.potentialUnits.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">単位/月</div>
                      <button
                        onClick={() => toggleAddition(suggestion.additionCode)}
                        className="mt-2 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* アラートタブ */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {calculationResult.warnings.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-gray-600">アラートはありません</p>
            </div>
          ) : (
            <>
              {/* エラー（要件未充足） */}
              {calculationResult.warnings.filter(w => w.severity === 'error').length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-red-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    要件未充足（売上に反映されません）
                  </h3>
                  {calculationResult.warnings
                    .filter(w => w.severity === 'error')
                    .map((warning, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="font-medium text-red-800">{warning.additionName}</div>
                        <div className="text-sm text-red-600 mt-1">{warning.message}</div>
                      </div>
                    ))}
                </div>
              )}

              {/* 警告（排他制御等） */}
              {calculationResult.warnings.filter(w => w.severity === 'warning').length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    注意事項
                  </h3>
                  {calculationResult.warnings
                    .filter(w => w.severity === 'warning')
                    .map((warning, index) => (
                      <div key={index} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="font-medium text-amber-800">{warning.additionName}</div>
                        <div className="text-sm text-amber-600 mt-1">{warning.message}</div>
                      </div>
                    ))}
                </div>
              )}

              {/* 情報（月間上限等） */}
              {calculationResult.warnings.filter(w => w.severity === 'info').length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-blue-800 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    情報
                  </h3>
                  {calculationResult.warnings
                    .filter(w => w.severity === 'info')
                    .map((warning, index) => (
                      <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="font-medium text-blue-800">{warning.additionName}</div>
                        <div className="text-sm text-blue-600 mt-1">{warning.message}</div>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
