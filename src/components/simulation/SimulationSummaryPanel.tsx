/**
 * シミュレーションサマリーパネル
 * 全体の売上見込みと加算内訳を表示
 */

'use client';

import React from 'react';
import {
  TrendingUp,
  BarChart3,
  Coins,
  Zap,
} from 'lucide-react';
import { SimulationSummary } from '@/hooks/useAdditionSimulation';
import { Addition } from '@/utils/additionCalculator';

interface SimulationSummaryPanelProps {
  summary: SimulationSummary;
  additions: Addition[];
  showComparison: boolean;
}

const SimulationSummaryPanel: React.FC<SimulationSummaryPanelProps> = ({
  summary,
  additions,
  showComparison,
}) => {
  // 加算コードから加算情報を取得
  const getAddition = (code: string) => additions.find(a => a.code === code);

  // 差分の色を決定
  const getDiffColor = (planned: number, actual: number) => {
    if (actual > planned) return 'text-green-600';
    if (actual < planned) return 'text-red-600';
    return 'text-gray-500';
  };

  // 差分のインジケーターを取得
  const getDiffIndicator = (planned: number, actual: number) => {
    if (actual > planned) return '🟢';
    if (actual < planned) return '🔴';
    return '';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-4">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h2 className="font-bold text-gray-800">売上見込み</h2>
        </div>
      </div>

      {/* メイン数値 */}
      <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
        <div className="text-purple-100 text-sm mb-1">月間売上見込み</div>
        <div className="text-3xl font-bold">
          ¥{summary.totalRevenue.toLocaleString()}
        </div>
        <div className="text-purple-200 text-sm mt-2">
          {summary.totalUnits.toLocaleString()} 単位
        </div>
      </div>

      {/* 内訳 */}
      <div className="p-4 space-y-4">
        {/* 基本報酬・加算 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
              <Coins className="w-3.5 h-3.5" />
              <span>基本報酬</span>
            </div>
            <div className="font-bold text-gray-800">
              {summary.totalBaseUnits.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">単位</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-1 text-purple-600 text-xs mb-1">
              <Zap className="w-3.5 h-3.5" />
              <span>加算合計</span>
            </div>
            <div className="font-bold text-purple-700">
              {summary.totalAdditionUnits.toLocaleString()}
            </div>
            <div className="text-xs text-purple-400">単位</div>
          </div>
        </div>

        {/* 加算内訳 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">加算内訳</span>
          </div>

          <div className="space-y-2">
            {Object.entries(summary.additionBreakdown).map(([code, data]) => {
              const addition = getAddition(code);
              if (!addition || (data.planned === 0 && data.actual === 0)) return null;

              const plannedUnits = data.planned * data.units;

              return (
                <div
                  key={code}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <div className="text-sm text-gray-700">
                      {addition.short_name || addition.name}
                    </div>
                    {showComparison ? (
                      <div className="text-xs text-gray-500 mt-0.5">
                        計画: {data.planned}回 / 実績: {data.actual}回
                        {data.planned !== data.actual && (
                          <span className={`ml-2 ${getDiffColor(data.planned, data.actual)}`}>
                            {getDiffIndicator(data.planned, data.actual)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {data.planned}回 × {data.units}単位
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">
                      {plannedUnits.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">単位</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 備考 */}
        <div className="pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-400 space-y-1">
            <p>* 売上見込みは計画に基づく概算です</p>
            <p>* 処遇改善加算は別途計算されます</p>
            <p>* 実際の請求額とは異なる場合があります</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationSummaryPanel;
