'use client';

import React from 'react';
import {
  TrendingUp,
  Users,
  Calendar,
  MapPin,
  Percent,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { SimulationParams, SimulationResult } from '@/hooks/useAdditionSimulator';
import { REGION_UNIT_RATES } from '@/utils/additionJudgment';

interface Props {
  simulationParams: SimulationParams;
  setSimulationParams: (params: Partial<SimulationParams>) => void;
  simulationResult: SimulationResult | null;
}

// 地域区分の選択肢
const REGION_OPTIONS = [
  { value: 1, label: '1級地', rate: 11.12 },
  { value: 2, label: '2級地', rate: 10.88 },
  { value: 3, label: '3級地', rate: 10.70 },
  { value: 4, label: '4級地', rate: 10.52 },
  { value: 5, label: '5級地', rate: 10.28 },
  { value: 6, label: '6級地', rate: 10.10 },
  { value: 7, label: '7級地', rate: 10.00 },
  { value: 8, label: 'その他', rate: 10.00 },
];

// 処遇改善加算の選択肢
const TREATMENT_OPTIONS = [
  { value: 13.1, label: '処遇改善(I)', description: '13.1%' },
  { value: 10.0, label: '処遇改善(II)', description: '10.0%' },
  { value: 8.1, label: '処遇改善(III)', description: '8.1%' },
  { value: 5.5, label: '処遇改善(IV)', description: '5.5%' },
  { value: 0, label: 'なし', description: '0%' },
];

export default function MonthlyRevenueTab({
  simulationParams,
  setSimulationParams,
  simulationResult,
}: Props) {
  const unitRate = REGION_UNIT_RATES[simulationParams.regionGrade] || 10.0;

  return (
    <div className="space-y-6">
      {/* 入力パラメータ */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
          <PieChart size={16} className="text-[#00c4cc]" />
          シミュレーション条件
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 児童数 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Users size={12} />
              利用児童数
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={simulationParams.childCount}
              onChange={(e) => setSimulationParams({ childCount: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#00c4cc]"
            />
          </div>

          {/* 平均利用日数 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Calendar size={12} />
              平均利用日数/月
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={simulationParams.averageUsageDays}
              onChange={(e) => setSimulationParams({ averageUsageDays: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#00c4cc]"
            />
          </div>

          {/* 基本報酬単位 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <DollarSign size={12} />
              基本報酬単位
            </label>
            <input
              type="number"
              min={100}
              max={2000}
              value={simulationParams.baseUnits}
              onChange={(e) => setSimulationParams({ baseUnits: parseInt(e.target.value) || 700 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#00c4cc]"
            />
          </div>

          {/* 地域区分 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <MapPin size={12} />
              地域区分
            </label>
            <select
              value={simulationParams.regionGrade}
              onChange={(e) => setSimulationParams({ regionGrade: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#00c4cc]"
            >
              {REGION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.rate}円/単位)
                </option>
              ))}
            </select>
          </div>

          {/* 処遇改善加算 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Percent size={12} />
              処遇改善加算
            </label>
            <select
              value={simulationParams.percentAdditions}
              onChange={(e) => setSimulationParams({ percentAdditions: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#00c4cc]"
            >
              {TREATMENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.description})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 売上結果 */}
      {simulationResult && (
        <>
          {/* 合計売上 */}
          <div className="bg-gradient-to-r from-[#00c4cc]/10 to-[#00c4cc]/5 rounded-lg p-6">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">月間見込み売上</div>
              <div className="text-4xl font-bold text-[#00c4cc]">
                ¥{simulationResult.totalRevenue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                1児童あたり: ¥{simulationResult.perChildRevenue.toLocaleString()}/月
              </div>
            </div>
          </div>

          {/* 内訳 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-[#00c4cc]" />
              売上内訳
            </h3>

            <div className="space-y-3">
              <RevenueBreakdownItem
                label="基本報酬"
                value={simulationResult.revenueBreakdown.baseRevenue}
                total={simulationResult.totalRevenue}
                color="bg-blue-500"
                description={`${simulationParams.baseUnits}単位 × ${simulationParams.childCount}名 × ${simulationParams.averageUsageDays}日 × ${unitRate}円`}
              />
              <RevenueBreakdownItem
                label="体制加算"
                value={simulationResult.revenueBreakdown.systemAdditionRevenue}
                total={simulationResult.totalRevenue}
                color="bg-green-500"
                description={`${simulationResult.selectedAdditions.filter(a => a.isEligible).reduce((sum, a) => sum + a.units, 0)}単位/日`}
              />
              <RevenueBreakdownItem
                label="処遇改善加算"
                value={simulationResult.revenueBreakdown.percentAdditionRevenue}
                total={simulationResult.totalRevenue}
                color="bg-purple-500"
                description={`${simulationParams.percentAdditions}%`}
              />
              <RevenueBreakdownItem
                label="実施加算"
                value={simulationResult.revenueBreakdown.implementationRevenue}
                total={simulationResult.totalRevenue}
                color="bg-orange-500"
                description="送迎、専門的支援等"
              />
            </div>
          </div>

          {/* 取得中の体制加算 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">取得可能な体制加算</h3>
            <div className="flex flex-wrap gap-2">
              {simulationResult.selectedAdditions
                .filter(a => a.isEligible)
                .map(a => (
                  <span
                    key={a.code}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                  >
                    {a.shortName} ({a.units}単位)
                  </span>
                ))}
              {simulationResult.selectedAdditions.filter(a => a.isEligible).length === 0 && (
                <span className="text-sm text-gray-400">取得可能な体制加算はありません</span>
              )}
            </div>
          </div>

          {/* 計算式 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-xs font-medium text-gray-600 mb-2">計算式</h4>
            <div className="text-xs text-gray-500 font-mono">
              <p>月間売上 = (基本報酬 + 体制加算) × 延べ利用日数 × 単価 × (1 + 処遇改善率)</p>
              <p className="mt-1">
                = ({simulationParams.baseUnits} + {simulationResult.selectedAdditions.filter(a => a.isEligible).reduce((sum, a) => sum + a.units, 0)}) × {simulationParams.childCount * simulationParams.averageUsageDays} × {unitRate} × (1 + {simulationParams.percentAdditions / 100})
              </p>
              <p className="mt-1 text-[#00c4cc] font-bold">
                = ¥{simulationResult.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 売上内訳アイテム
function RevenueBreakdownItem({
  label,
  value,
  total,
  color,
  description,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  description: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${color}`} />
          <span className="text-sm text-gray-700">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-medium text-gray-800">
            ¥{value.toLocaleString()}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            ({percentage.toFixed(1)}%)
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 w-32 text-right">{description}</span>
      </div>
    </div>
  );
}
