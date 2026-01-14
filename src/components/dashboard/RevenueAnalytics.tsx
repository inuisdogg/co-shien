/**
 * 売上・加算分析ダッシュボード
 * 加算最適化提案と詳細な経営分析機能
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  PieChart,
  ArrowUp,
  ArrowDown,
  Info,
  Settings,
  Calculator,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Child } from '@/types';

// 型定義
interface Addition {
  id: string;
  code: string;
  category_code: string;
  name: string;
  short_name: string;
  units: number | null;
  unit_type: string;
  is_percentage: boolean;
  percentage_rate: number | null;
  applicable_services: string[];
  requirements: string;
  max_times_per_month: number | null;
  max_times_per_day: number;
  display_order: number;
}

interface AdditionCategory {
  code: string;
  name: string;
  display_order: number;
}

interface ChildAddition {
  id: string;
  child_id: string;
  addition_code: string;
  is_enabled: boolean;
  custom_units: number | null;
}

interface FacilityAdditionSetting {
  addition_code: string;
  is_enabled: boolean;
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

interface OptimizationSuggestion {
  type: 'high_impact' | 'medium_impact' | 'quick_win' | 'strategic';
  title: string;
  description: string;
  potentialRevenue: number;
  additionCode: string;
  additionName: string;
  requirements: string;
  affectedChildren: number;
  priority: number;
}

interface RevenueAnalyticsProps {
  facilityId: string;
  childrenData: Child[];
}

export default function RevenueAnalytics({ facilityId, childrenData }: RevenueAnalyticsProps) {
  // childrenDataをchildrenとして使用（内部変数名）
  const children = childrenData;
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [categories, setCategories] = useState<AdditionCategory[]>([]);
  const [childAdditions, setChildAdditions] = useState<ChildAddition[]>([]);
  const [facilitySettings, setFacilitySettings] = useState<FacilityAdditionSetting[]>([]);
  const [regionalUnits, setRegionalUnits] = useState<RegionalUnit[]>([]);
  const [baseRewards, setBaseRewards] = useState<BaseReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['staff_allocation', 'specialist']));
  const [selectedMonth, setSelectedMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [activeTab, setActiveTab] = useState<'overview' | 'optimization' | 'analysis' | 'settings'>('overview');

  // 施設設定（サービス種別・地域区分など）
  const [facilityConfig, setFacilityConfig] = useState<{
    serviceTypeCode: string;
    regionalGrade: string;
    capacity: number;
    treatmentImprovementGrade: string | null;
  }>({
    serviceTypeCode: 'hokago_day',
    regionalGrade: '1級地',
    capacity: 10,
    treatmentImprovementGrade: 'treatment_improvement_1',
  });

  // データ取得
  useEffect(() => {
    fetchData();
  }, [facilityId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 並列でデータ取得
      const [
        { data: additionsData },
        { data: categoriesData },
        { data: childAdditionsData },
        { data: facilitySettingsData },
        { data: regionalData },
        { data: baseRewardsData },
        { data: facilityConfigData },
      ] = await Promise.all([
        supabase.from('additions').select('*').eq('is_active', true).order('display_order'),
        supabase.from('addition_categories').select('*').order('display_order'),
        supabase.from('child_additions').select('*').eq('facility_id', facilityId),
        supabase.from('facility_addition_settings').select('*').eq('facility_id', facilityId),
        supabase.from('regional_units').select('*'),
        supabase.from('base_rewards').select('*'),
        supabase.from('facility_settings').select('service_type_code, regional_grade, capacity, treatment_improvement_grade').eq('facility_id', facilityId).single(),
      ]);

      setAdditions(additionsData || []);
      setCategories(categoriesData || []);
      setChildAdditions(childAdditionsData || []);
      setFacilitySettings(facilitySettingsData || []);
      setRegionalUnits(regionalData || []);
      setBaseRewards(baseRewardsData || []);

      if (facilityConfigData) {
        setFacilityConfig({
          serviceTypeCode: facilityConfigData.service_type_code || 'hokago_day',
          regionalGrade: facilityConfigData.regional_grade || '1級地',
          capacity: facilityConfigData.capacity || 10,
          treatmentImprovementGrade: facilityConfigData.treatment_improvement_grade,
        });
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 地域区分単価
  const unitPrice = useMemo(() => {
    const region = regionalUnits.find(r => r.grade === facilityConfig.regionalGrade);
    return region?.unit_price || 11.20;
  }, [regionalUnits, facilityConfig.regionalGrade]);

  // 基本報酬（時間区分2を基準）
  const baseRewardUnits = useMemo(() => {
    const reward = baseRewards.find(
      r => r.service_type_code === facilityConfig.serviceTypeCode && r.time_category === 2
    );
    return reward?.units || 480;
  }, [baseRewards, facilityConfig.serviceTypeCode]);

  // 施設が取得可能な加算
  const availableAdditions = useMemo(() => {
    return additions.filter(a =>
      a.applicable_services.includes(facilityConfig.serviceTypeCode)
    );
  }, [additions, facilityConfig.serviceTypeCode]);

  // 施設で有効化されている加算
  const enabledFacilityAdditions = useMemo(() => {
    const enabledCodes = new Set(
      facilitySettings.filter(s => s.is_enabled).map(s => s.addition_code)
    );
    return availableAdditions.filter(a => enabledCodes.has(a.code));
  }, [availableAdditions, facilitySettings]);

  // 児童ごとの加算設定マップ
  const childAdditionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    childAdditions.filter(ca => ca.is_enabled).forEach(ca => {
      if (!map.has(ca.child_id)) {
        map.set(ca.child_id, new Set());
      }
      map.get(ca.child_id)!.add(ca.addition_code);
    });
    return map;
  }, [childAdditions]);

  // 月の営業日数を計算
  const businessDays = useMemo(() => {
    const { year, month } = selectedMonth;
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay();
      // 日曜以外を営業日とする（簡易計算）
      if (dayOfWeek !== 0) count++;
    }
    return count;
  }, [selectedMonth]);

  // 売上見込み計算
  const revenueEstimate = useMemo(() => {
    const activeChildren = children.filter(c => c.contractStatus === 'active');
    const avgDaysPerChild = 12; // 平均月間利用日数

    // 基本報酬
    const totalUsageDays = activeChildren.length * avgDaysPerChild;
    const baseRevenueUnits = totalUsageDays * baseRewardUnits;

    // 加算単位計算
    let additionUnits = 0;
    const additionBreakdown: { code: string; name: string; units: number; count: number; totalUnits: number }[] = [];

    // 施設体制加算（全児童に適用）
    enabledFacilityAdditions.forEach(addition => {
      if (addition.unit_type === 'day' && !addition.is_percentage) {
        const units = addition.units || 0;
        const total = units * totalUsageDays;
        additionUnits += total;
        additionBreakdown.push({
          code: addition.code,
          name: addition.name,
          units,
          count: totalUsageDays,
          totalUnits: total,
        });
      }
    });

    // 児童個別加算
    activeChildren.forEach(child => {
      const childAdditionCodes = childAdditionMap.get(child.id);
      if (childAdditionCodes) {
        childAdditionCodes.forEach(code => {
          const addition = additions.find(a => a.code === code);
          if (addition && addition.unit_type === 'day' && !addition.is_percentage) {
            const units = addition.units || 0;
            const total = units * avgDaysPerChild;
            additionUnits += total;

            const existing = additionBreakdown.find(b => b.code === code);
            if (existing) {
              existing.count += avgDaysPerChild;
              existing.totalUnits += total;
            } else {
              additionBreakdown.push({
                code,
                name: addition.name,
                units,
                count: avgDaysPerChild,
                totalUnits: total,
              });
            }
          }
        });
      }
    });

    // 送迎加算（仮に60%が利用と想定）
    const transportAddition = additions.find(a => a.code === 'transport');
    if (transportAddition) {
      const transportCount = Math.floor(totalUsageDays * 0.6 * 2); // 往復
      const transportUnits = (transportAddition.units || 54) * transportCount;
      additionUnits += transportUnits;
      additionBreakdown.push({
        code: 'transport',
        name: '送迎加算',
        units: transportAddition.units || 54,
        count: transportCount,
        totalUnits: transportUnits,
      });
    }

    // 小計
    const subtotalUnits = baseRevenueUnits + additionUnits;

    // 処遇改善加算（%加算）
    let treatmentUnits = 0;
    if (facilityConfig.treatmentImprovementGrade) {
      const treatmentAddition = additions.find(a => a.code === facilityConfig.treatmentImprovementGrade);
      if (treatmentAddition && treatmentAddition.percentage_rate) {
        treatmentUnits = Math.floor(subtotalUnits * (treatmentAddition.percentage_rate / 100));
        additionBreakdown.push({
          code: treatmentAddition.code,
          name: treatmentAddition.name,
          units: treatmentAddition.percentage_rate,
          count: 1,
          totalUnits: treatmentUnits,
        });
      }
    }

    const totalUnits = subtotalUnits + treatmentUnits;
    const totalRevenue = Math.floor(totalUnits * unitPrice);

    return {
      activeChildrenCount: activeChildren.length,
      totalUsageDays,
      baseRewardUnits: baseRevenueUnits,
      additionUnits: additionUnits + treatmentUnits,
      totalUnits,
      unitPrice,
      totalRevenue,
      additionBreakdown: additionBreakdown.sort((a, b) => b.totalUnits - a.totalUnits),
      perChildRevenue: activeChildren.length > 0 ? Math.floor(totalRevenue / activeChildren.length) : 0,
      perDayRevenue: totalUsageDays > 0 ? Math.floor(totalRevenue / totalUsageDays) : 0,
    };
  }, [children, baseRewardUnits, enabledFacilityAdditions, childAdditionMap, additions, unitPrice, facilityConfig]);

  // 加算最適化提案
  const optimizationSuggestions = useMemo((): OptimizationSuggestion[] => {
    const suggestions: OptimizationSuggestion[] = [];
    const enabledCodes = new Set(facilitySettings.filter(s => s.is_enabled).map(s => s.addition_code));
    const activeChildren = children.filter(c => c.contractStatus === 'active');
    const avgDaysPerChild = 12;
    const totalUsageDays = activeChildren.length * avgDaysPerChild;

    availableAdditions.forEach(addition => {
      if (!enabledCodes.has(addition.code) && !addition.is_percentage) {
        const units = addition.units || 0;
        let potentialRevenue = 0;
        let affectedChildren = 0;
        let priority = 3;

        // 日額加算の場合
        if (addition.unit_type === 'day') {
          potentialRevenue = Math.floor(units * totalUsageDays * unitPrice);
          affectedChildren = activeChildren.length;

          // 優先度設定
          if (units >= 150) priority = 1;
          else if (units >= 100) priority = 2;
        }
        // 回数加算の場合
        else if (addition.unit_type === 'time') {
          const maxTimes = addition.max_times_per_month || 2;
          potentialRevenue = Math.floor(units * maxTimes * activeChildren.length * unitPrice);
          affectedChildren = activeChildren.length;
          priority = 2;
        }

        if (potentialRevenue > 0) {
          let type: OptimizationSuggestion['type'] = 'medium_impact';
          if (potentialRevenue >= 100000) type = 'high_impact';
          else if (potentialRevenue >= 50000) type = 'medium_impact';
          else if (potentialRevenue < 20000 && units <= 100) type = 'quick_win';
          else type = 'strategic';

          suggestions.push({
            type,
            title: `${addition.name}の算定`,
            description: `${addition.requirements || '要件を確認してください'}`,
            potentialRevenue,
            additionCode: addition.code,
            additionName: addition.name,
            requirements: addition.requirements || '',
            affectedChildren,
            priority,
          });
        }
      }
    });

    // 児童個別の加算提案
    activeChildren.forEach(child => {
      const childCodes = childAdditionMap.get(child.id) || new Set();

      // 個別サポート加算の提案
      if (!childCodes.has('individual_support_1') && child.is_protected_child) {
        const addition = additions.find(a => a.code === 'individual_support_2');
        if (addition) {
          suggestions.push({
            type: 'quick_win',
            title: `${child.name}さんへの個別サポート加算(II)`,
            description: '要保護・要支援児童として個別サポート加算(II)を算定可能',
            potentialRevenue: Math.floor((addition.units || 125) * avgDaysPerChild * unitPrice),
            additionCode: addition.code,
            additionName: addition.name,
            requirements: addition.requirements || '',
            affectedChildren: 1,
            priority: 1,
          });
        }
      }

      // 強度行動障害支援加算
      if (child.behavior_disorder_score && child.behavior_disorder_score >= 20) {
        const additionCode = child.behavior_disorder_score >= 30 ? 'behavior_support_2' : 'behavior_support_1';
        if (!childCodes.has(additionCode)) {
          const addition = additions.find(a => a.code === additionCode);
          if (addition) {
            suggestions.push({
              type: 'high_impact',
              title: `${child.name}さんへの強度行動障害児支援加算`,
              description: `スコア${child.behavior_disorder_score}点で算定可能`,
              potentialRevenue: Math.floor((addition.units || 200) * avgDaysPerChild * unitPrice),
              additionCode: addition.code,
              additionName: addition.name,
              requirements: addition.requirements || '',
              affectedChildren: 1,
              priority: 1,
            });
          }
        }
      }
    });

    return suggestions.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.potentialRevenue - a.potentialRevenue;
    });
  }, [availableAdditions, facilitySettings, children, childAdditionMap, additions, unitPrice]);

  // カテゴリの展開/折りたたみ
  const toggleCategory = (code: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) newSet.delete(code);
      else newSet.add(code);
      return newSet;
    });
  };

  // 施設加算の有効/無効切り替え
  const toggleFacilityAddition = async (additionCode: string, enabled: boolean) => {
    try {
      const existing = facilitySettings.find(s => s.addition_code === additionCode);

      if (existing) {
        await supabase
          .from('facility_addition_settings')
          .update({ is_enabled: enabled })
          .eq('facility_id', facilityId)
          .eq('addition_code', additionCode);
      } else {
        await supabase
          .from('facility_addition_settings')
          .insert({
            facility_id: facilityId,
            addition_code: additionCode,
            is_enabled: enabled,
          });
      }

      setFacilitySettings(prev => {
        const updated = prev.filter(s => s.addition_code !== additionCode);
        updated.push({ addition_code: additionCode, is_enabled: enabled });
        return updated;
      });
    } catch (error) {
      console.error('加算設定更新エラー:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* タブナビゲーション */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: '売上概要', icon: DollarSign },
            { id: 'optimization', label: '最適化提案', icon: Lightbulb },
            { id: 'analysis', label: '詳細分析', icon: BarChart3 },
            { id: 'settings', label: '加算設定', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#00c4cc] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 売上概要タブ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 月選択 */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedMonth(prev => ({
                  year: prev.month === 1 ? prev.year - 1 : prev.year,
                  month: prev.month === 1 ? 12 : prev.month - 1,
                }))}
                className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                ←
              </button>
              <span className="text-lg font-bold text-gray-800">
                {selectedMonth.year}年{selectedMonth.month}月 売上見込み
              </span>
              <button
                onClick={() => setSelectedMonth(prev => ({
                  year: prev.month === 12 ? prev.year + 1 : prev.year,
                  month: prev.month === 12 ? 1 : prev.month + 1,
                }))}
                className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                →
              </button>
            </div>
            <div className="text-sm text-gray-500">
              営業日数: {businessDays}日 / 単価: {unitPrice}円/単位
            </div>
          </div>

          {/* 主要KPI */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-teal-100 text-sm font-bold">月間売上見込み</span>
                <DollarSign size={20} className="text-teal-200" />
              </div>
              <div className="text-3xl font-bold mb-1">
                ¥{revenueEstimate.totalRevenue.toLocaleString()}
              </div>
              <div className="text-teal-100 text-xs">
                {revenueEstimate.totalUnits.toLocaleString()}単位 × {unitPrice}円
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm font-bold">利用児童数</span>
                <Users size={20} className="text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-800 mb-1">
                {revenueEstimate.activeChildrenCount}名
              </div>
              <div className="text-gray-500 text-xs">
                月間延べ{revenueEstimate.totalUsageDays}日利用
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm font-bold">児童1人あたり</span>
                <Target size={20} className="text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-gray-800 mb-1">
                ¥{revenueEstimate.perChildRevenue.toLocaleString()}
              </div>
              <div className="text-gray-500 text-xs">
                月間平均売上/児童
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm font-bold">1利用あたり</span>
                <Calculator size={20} className="text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-gray-800 mb-1">
                ¥{revenueEstimate.perDayRevenue.toLocaleString()}
              </div>
              <div className="text-gray-500 text-xs">
                日額単価（加算込み）
              </div>
            </div>
          </div>

          {/* 売上内訳 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 単位数内訳 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PieChart size={20} className="text-[#00c4cc]" />
                単位数内訳
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <div className="font-bold text-blue-800">基本報酬</div>
                    <div className="text-xs text-blue-600">{baseRewardUnits}単位 × {revenueEstimate.totalUsageDays}日</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-800">{revenueEstimate.baseRewardUnits.toLocaleString()}単位</div>
                    <div className="text-xs text-blue-600">
                      {((revenueEstimate.baseRewardUnits / revenueEstimate.totalUnits) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="font-bold text-green-800">加算合計</div>
                    <div className="text-xs text-green-600">{revenueEstimate.additionBreakdown.length}種類の加算</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-800">{revenueEstimate.additionUnits.toLocaleString()}単位</div>
                    <div className="text-xs text-green-600">
                      {((revenueEstimate.additionUnits / revenueEstimate.totalUnits) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="border-t pt-3 flex items-center justify-between">
                  <div className="font-bold text-gray-800">合計</div>
                  <div className="font-bold text-gray-800">{revenueEstimate.totalUnits.toLocaleString()}単位</div>
                </div>
              </div>

              {/* 加算率グラフ */}
              <div className="mt-4 h-4 rounded-full overflow-hidden bg-gray-200 flex">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(revenueEstimate.baseRewardUnits / revenueEstimate.totalUnits) * 100}%` }}
                />
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(revenueEstimate.additionUnits / revenueEstimate.totalUnits) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-blue-600">基本報酬</span>
                <span className="text-green-600">加算</span>
              </div>
            </div>

            {/* 加算別内訳 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-[#00c4cc]" />
                加算別売上ランキング
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {revenueEstimate.additionBreakdown.slice(0, 10).map((item, index) => (
                  <div key={item.code} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-orange-300 text-orange-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-sm truncate">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.units}単位 × {item.count}回</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800">¥{Math.floor(item.totalUnits * unitPrice).toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{item.totalUnits.toLocaleString()}単位</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 最適化提案タブ */}
      {activeTab === 'optimization' && (
        <div className="space-y-6">
          {/* サマリー */}
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Zap size={24} />
              <h3 className="text-xl font-bold">加算最適化で売上アップ</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/20 rounded-lg p-4">
                <div className="text-purple-100 text-sm mb-1">潜在的な追加売上</div>
                <div className="text-2xl font-bold">
                  +¥{optimizationSuggestions.reduce((sum, s) => sum + s.potentialRevenue, 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <div className="text-purple-100 text-sm mb-1">提案数</div>
                <div className="text-2xl font-bold">{optimizationSuggestions.length}件</div>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <div className="text-purple-100 text-sm mb-1">高インパクト提案</div>
                <div className="text-2xl font-bold">
                  {optimizationSuggestions.filter(s => s.type === 'high_impact').length}件
                </div>
              </div>
            </div>
          </div>

          {/* 提案リスト */}
          <div className="space-y-4">
            {['high_impact', 'medium_impact', 'quick_win', 'strategic'].map(type => {
              const typeSuggestions = optimizationSuggestions.filter(s => s.type === type);
              if (typeSuggestions.length === 0) return null;

              const typeConfig = {
                high_impact: { label: '高インパクト', color: 'red', icon: TrendingUp, desc: '月10万円以上の売上増が見込める' },
                medium_impact: { label: '中インパクト', color: 'orange', icon: Target, desc: '月5〜10万円の売上増が見込める' },
                quick_win: { label: 'クイックウィン', color: 'green', icon: CheckCircle, desc: '比較的容易に実装可能' },
                strategic: { label: '戦略的施策', color: 'blue', icon: Lightbulb, desc: '中長期的な取り組みで効果を発揮' },
              }[type]!;

              return (
                <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className={`px-6 py-3 bg-${typeConfig.color}-50 border-b border-${typeConfig.color}-100 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <typeConfig.icon size={18} className={`text-${typeConfig.color}-600`} />
                      <span className={`font-bold text-${typeConfig.color}-800`}>{typeConfig.label}</span>
                      <span className="text-sm text-gray-500">({typeSuggestions.length}件)</span>
                    </div>
                    <span className="text-xs text-gray-500">{typeConfig.desc}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {typeSuggestions.map((suggestion, index) => (
                      <div key={`${suggestion.additionCode}-${index}`} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-bold text-gray-800 mb-1">{suggestion.title}</div>
                            <div className="text-sm text-gray-600 mb-2">{suggestion.description}</div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                対象: {suggestion.affectedChildren}名
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-green-600">
                              +¥{suggestion.potentialRevenue.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">月間見込み</div>
                            <button
                              onClick={() => toggleFacilityAddition(suggestion.additionCode, true)}
                              className="mt-2 px-3 py-1 bg-[#00c4cc] text-white text-xs font-bold rounded-lg hover:bg-[#00b0b8] transition-colors"
                            >
                              有効化する
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {optimizationSuggestions.length === 0 && (
              <div className="bg-green-50 rounded-xl p-8 text-center">
                <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
                <div className="text-lg font-bold text-green-800 mb-1">素晴らしい!</div>
                <div className="text-green-600">現在取得可能な主要な加算はすべて有効化されています</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 詳細分析タブ */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* 児童別売上分析 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={20} className="text-[#00c4cc]" />
              児童別売上貢献度
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-bold text-gray-600">児童名</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-600">利用日数</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-600">適用加算</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-600">見込み売上</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-600">貢献度</th>
                  </tr>
                </thead>
                <tbody>
                  {children.filter(c => c.contractStatus === 'active').slice(0, 10).map(child => {
                    const childCodes = childAdditionMap.get(child.id) || new Set();
                    const avgDays = 12;
                    let childUnits = baseRewardUnits * avgDays;

                    // 施設体制加算
                    enabledFacilityAdditions.forEach(a => {
                      if (a.unit_type === 'day' && !a.is_percentage) {
                        childUnits += (a.units || 0) * avgDays;
                      }
                    });

                    // 個別加算
                    childCodes.forEach(code => {
                      const addition = additions.find(a => a.code === code);
                      if (addition && addition.unit_type === 'day' && !addition.is_percentage) {
                        childUnits += (addition.units || 0) * avgDays;
                      }
                    });

                    const childRevenue = Math.floor(childUnits * unitPrice);
                    const contribution = revenueEstimate.totalRevenue > 0
                      ? (childRevenue / revenueEstimate.totalRevenue) * 100
                      : 0;

                    return (
                      <tr key={child.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-gray-800">{child.name}</td>
                        <td className="py-3 px-4 text-right text-gray-600">{avgDays}日</td>
                        <td className="py-3 px-4 text-right text-gray-600">{childCodes.size}種</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-800">¥{childRevenue.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#00c4cc]"
                                style={{ width: `${Math.min(contribution * 5, 100)}%` }}
                              />
                            </div>
                            <span className="text-gray-600 w-12 text-right">{contribution.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* KPI比較 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm font-bold text-gray-500 mb-2">加算取得率</div>
              <div className="text-2xl font-bold text-gray-800">
                {availableAdditions.length > 0
                  ? ((enabledFacilityAdditions.length / availableAdditions.length) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {enabledFacilityAdditions.length} / {availableAdditions.length} 加算
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm font-bold text-gray-500 mb-2">加算比率</div>
              <div className="text-2xl font-bold text-gray-800">
                {revenueEstimate.totalUnits > 0
                  ? ((revenueEstimate.additionUnits / revenueEstimate.totalUnits) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                総単位数に占める加算の割合
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm font-bold text-gray-500 mb-2">平均加算単位/日</div>
              <div className="text-2xl font-bold text-gray-800">
                {revenueEstimate.totalUsageDays > 0
                  ? Math.floor(revenueEstimate.additionUnits / revenueEstimate.totalUsageDays)
                  : 0}単位
              </div>
              <div className="text-xs text-gray-500 mt-1">
                1利用あたりの加算単位
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm font-bold text-gray-500 mb-2">最適化ポテンシャル</div>
              <div className="text-2xl font-bold text-green-600">
                +{revenueEstimate.totalRevenue > 0
                  ? ((optimizationSuggestions.reduce((sum, s) => sum + s.potentialRevenue, 0) / revenueEstimate.totalRevenue) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                売上増加の余地
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 加算設定タブ */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-blue-800 mb-1">施設体制加算の設定</div>
                <div className="text-sm text-blue-700">
                  有効化した加算は、全ての利用児童に自動的に適用されます。
                  届出が必要な加算は、事前に所轄官庁への届出を行ってください。
                </div>
              </div>
            </div>
          </div>

          {categories.map(category => {
            const categoryAdditions = availableAdditions.filter(a => a.category_code === category.code);
            if (categoryAdditions.length === 0) return null;

            const isExpanded = expandedCategories.has(category.code);
            const enabledCount = categoryAdditions.filter(a =>
              facilitySettings.some(s => s.addition_code === a.code && s.is_enabled)
            ).length;

            return (
              <div key={category.code} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.code)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <span className="font-bold text-gray-800">{category.name}</span>
                    <span className="text-sm text-gray-500">
                      ({enabledCount}/{categoryAdditions.length} 有効)
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 divide-y divide-gray-100">
                    {categoryAdditions.map(addition => {
                      const isEnabled = facilitySettings.some(
                        s => s.addition_code === addition.code && s.is_enabled
                      );

                      return (
                        <div key={addition.code} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-bold text-gray-800">{addition.name}</div>
                            <div className="text-sm text-gray-500 mt-1">
                              {addition.units ? `${addition.units}単位/${addition.unit_type === 'day' ? '日' : '回'}` : ''}
                              {addition.is_percentage && addition.percentage_rate ? `${addition.percentage_rate}%` : ''}
                            </div>
                            {addition.requirements && (
                              <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                {addition.requirements}
                              </div>
                            )}
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => toggleFacilityAddition(addition.code, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4cc]"></div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
