/**
 * 児童別加算計画カード
 * 各児童の加算計画を入力・表示
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  AlertTriangle,
  Heart,
  Zap,
} from 'lucide-react';
import { ChildSimulationResult } from '@/hooks/useAdditionSimulation';
import { Addition } from '@/utils/additionCalculator';

interface ChildAdditionCardProps {
  result: ChildSimulationResult;
  additions: Addition[];
  onUpdatePlan: (childId: string, additionCode: string, count: number) => void;
  showComparison: boolean;
  monthlyLimits: Record<string, number>;
}

const ChildAdditionCard: React.FC<ChildAdditionCardProps> = ({
  result,
  additions,
  onUpdatePlan,
  showComparison,
  monthlyLimits,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { child, scheduledDays, plans, actualCounts, totalUnits, revenue } = result;

  // 年齢を計算
  const age = useMemo(() => {
    if (!child.birthDate) return null;
    const birth = new Date(child.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, [child.birthDate]);

  // 特別な属性のバッジ
  const badges = useMemo(() => {
    const list = [];
    if ((child as any).medical_care_score && (child as any).medical_care_score >= 16) {
      list.push({ label: '医ケア', color: 'bg-red-100 text-red-700', icon: Heart });
    }
    if ((child as any).behavior_disorder_score && (child as any).behavior_disorder_score >= 20) {
      list.push({ label: '強度行動障害', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle });
    }
    if ((child as any).care_needs_category) {
      list.push({ label: 'ケアニーズ', color: 'bg-blue-100 text-blue-700', icon: Zap });
    }
    return list;
  }, [child]);

  // 加算の計画回数を取得
  const getPlannedCount = (additionCode: string) => {
    const plan = plans.find(p => p.additionCode === additionCode);
    return plan?.plannedCount || 0;
  };

  // 加算の実績回数を取得
  const getActualCount = (additionCode: string) => {
    return actualCounts[additionCode] || 0;
  };

  // 差分の色を決定
  const getDiffColor = (planned: number, actual: number) => {
    if (actual > planned) return 'text-green-600';
    if (actual < planned) return 'text-red-600';
    return 'text-gray-500';
  };

  // 差分のテキストを取得
  const getDiffText = (planned: number, actual: number) => {
    const diff = actual - planned;
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return '±0';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">{child.name}</span>
              {age !== null && (
                <span className="text-sm text-gray-500">({age}歳)</span>
              )}
              {badges.map((badge, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${badge.color}`}
                >
                  <badge.icon className="w-3 h-3" />
                  {badge.label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                予定利用: {scheduledDays}日
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-500">売上見込み</div>
            <div className="font-bold text-purple-600">¥{revenue.toLocaleString()}</div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* 詳細 */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4">
          {/* 加算入力テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">加算名</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium w-24">
                    {showComparison ? '計画' : '回数'}
                  </th>
                  {showComparison && (
                    <>
                      <th className="text-center py-2 px-3 text-gray-600 font-medium w-24">実績</th>
                      <th className="text-center py-2 px-3 text-gray-600 font-medium w-20">差分</th>
                    </>
                  )}
                  <th className="text-right py-2 px-3 text-gray-600 font-medium w-24">単位数</th>
                </tr>
              </thead>
              <tbody>
                {additions.map(addition => {
                  const planned = getPlannedCount(addition.code);
                  const actual = getActualCount(addition.code);
                  const limit = monthlyLimits[addition.code] || addition.max_times_per_month;
                  const units = (addition.units || 0) * planned;

                  return (
                    <tr key={addition.code} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-800">{addition.short_name || addition.name}</span>
                          {limit && (
                            <span className="text-xs text-gray-400">(上限{limit}回)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <select
                          value={planned}
                          onChange={(e) => onUpdatePlan(child.id, addition.code, parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {Array.from({ length: (limit || scheduledDays * 2) + 1 }, (_, i) => (
                            <option key={i} value={i}>{i}回</option>
                          ))}
                        </select>
                      </td>
                      {showComparison && (
                        <>
                          <td className="py-2 px-3 text-center">
                            <span className="text-gray-700">{actual}回</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-medium ${getDiffColor(planned, actual)}`}>
                              {getDiffText(planned, actual)}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-2 px-3 text-right">
                        <span className="text-gray-700">{units.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 自動加算表示 */}
          {(result.autoAdditionUnits > 0) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-xs font-medium text-blue-700 mb-2">自動算定加算（児童属性に基づく）</div>
              <div className="text-sm text-blue-600">
                {(child as any).care_needs_category && (
                  <span className="inline-block mr-4">個別サポート(I): {scheduledDays}日</span>
                )}
                {((child as any).behavior_disorder_score || 0) >= 20 && (
                  <span className="inline-block">強度行動障害支援: {scheduledDays}日</span>
                )}
              </div>
            </div>
          )}

          {/* サマリー */}
          <div className="mt-4 flex justify-end gap-6 text-sm">
            <div>
              <span className="text-gray-500">基本報酬: </span>
              <span className="font-medium text-gray-700">{result.baseUnits.toLocaleString()}単位</span>
            </div>
            <div>
              <span className="text-gray-500">加算合計: </span>
              <span className="font-medium text-gray-700">{(result.additionUnits + result.autoAdditionUnits).toLocaleString()}単位</span>
            </div>
            <div>
              <span className="text-gray-500">合計: </span>
              <span className="font-bold text-purple-600">{totalUnits.toLocaleString()}単位</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChildAdditionCard;
