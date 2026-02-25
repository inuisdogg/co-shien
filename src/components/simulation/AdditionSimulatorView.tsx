'use client';

import React, { useState } from 'react';
import {
  Calculator,
  Users,
  TrendingUp,
  Lightbulb,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAdditionSimulator } from '@/hooks/useAdditionSimulator';
import SystemAdditionsTab from './SystemAdditionsTab';
import MonthlyRevenueTab from './MonthlyRevenueTab';
import OptimizationTab from './OptimizationTab';

type TabId = 'system' | 'revenue' | 'optimization';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'system', label: '体制加算', icon: Users },
  { id: 'revenue', label: '月間売上', icon: TrendingUp },
  { id: 'optimization', label: '最適化提案', icon: Lightbulb },
];

export default function AdditionSimulatorView() {
  const [activeTab, setActiveTab] = useState<TabId>('system');

  const {
    staff,
    children,
    facilitySettings,
    simulationParams,
    setSimulationParams,
    simulationResult,
    loading,
    error,
    refresh,
  } = useAdditionSimulator();

  // サマリーカードのデータ
  const eligibleCount = simulationResult?.selectedAdditions.filter(a => a.isEligible).length || 0;
  const totalSystemUnits = simulationResult?.selectedAdditions
    .filter(a => a.isEligible)
    .reduce((sum, a) => sum + a.units, 0) || 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#00c4cc]/10 rounded-lg">
            <Calculator size={24} className="text-[#00c4cc]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">加算シミュレーター</h1>
            <p className="text-sm text-gray-500">
              人員配置と加算の最適化をシミュレーション
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          更新
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">月間見込み売上</span>
            <TrendingUp size={20} className="text-[#00c4cc]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-800">
              {simulationResult ? `¥${simulationResult.totalRevenue.toLocaleString()}` : '-'}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {simulationParams.childCount}名 × {simulationParams.averageUsageDays}日/月
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">取得可能な体制加算</span>
            <Users size={20} className="text-green-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-800">{eligibleCount}件</span>
            <span className="ml-2 text-sm text-gray-500">/ {totalSystemUnits}単位</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            スタッフ{staff.length}名で判定
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">改善提案</span>
            <Lightbulb size={20} className="text-yellow-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-800">
              {simulationResult?.optimizationSuggestions.length || 0}件
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            収益改善の可能性
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[#00c4cc] border-b-2 border-[#00c4cc] bg-[#00c4cc]/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={18} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className="animate-spin text-[#00c4cc]" />
              <span className="ml-2 text-gray-500">読み込み中...</span>
            </div>
          ) : (
            <>
              {activeTab === 'system' && (
                <SystemAdditionsTab
                  staff={staff}
                  simulationResult={simulationResult}
                />
              )}
              {activeTab === 'revenue' && (
                <MonthlyRevenueTab
                  simulationParams={simulationParams}
                  setSimulationParams={setSimulationParams}
                  simulationResult={simulationResult}
                />
              )}
              {activeTab === 'optimization' && (
                <OptimizationTab
                  suggestions={simulationResult?.optimizationSuggestions || []}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
