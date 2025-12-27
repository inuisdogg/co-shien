/**
 * 経営ダッシュボードビュー
 */

'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Users, DollarSign, Percent } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts';
import { useFacilityData } from '@/hooks/useFacilityData';
import {
  calculateMonthlyProfit,
  calculateOccupancyRate,
  calculateARPU,
  calculateLaborRatio,
  getAlerts,
  getOccupancyHeatmapData,
  getAddonMatrixData,
  getCancellationTrendData,
  getStaffOptimizationData,
  getStaffProductivityData,
  getCostTrendData,
  getFunnelData,
  getChurnRiskData,
  calculateLTV,
} from '@/utils/dashboardCalculations';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const { children, staff, schedules, requests, usageRecords, facilitySettings } = useFacilityData();
  const currentMonth = new Date();

  // データが存在しない場合のデフォルト値
  const defaultCapacity = facilitySettings?.capacity || { AM: 10, PM: 10 };

  // エラーハンドリング：データが読み込まれていない場合
  if (!facilitySettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">データを読み込んでいます...</div>
      </div>
    );
  }

  // エグゼクティブ・サマリー
  const profitData = useMemo(
    () => calculateMonthlyProfit(usageRecords, currentMonth),
    [usageRecords, currentMonth]
  );
  const occupancyData = useMemo(
    () => calculateOccupancyRate(schedules, defaultCapacity, currentMonth),
    [schedules, defaultCapacity, currentMonth]
  );
  const arpuData = useMemo(
    () => calculateARPU(usageRecords, children, currentMonth),
    [usageRecords, children, currentMonth]
  );
  const laborRatioData = useMemo(
    () => calculateLaborRatio(staff, usageRecords, currentMonth),
    [staff, usageRecords, currentMonth]
  );
  const alerts = useMemo(() => getAlerts(usageRecords, children, currentMonth), [usageRecords, children, currentMonth]);

  // 収益エンジン分析
  const heatmapData = useMemo(() => getOccupancyHeatmapData(schedules, currentMonth), [schedules, currentMonth]);
  const addonData = useMemo(() => getAddonMatrixData(usageRecords, currentMonth), [usageRecords, currentMonth]);
  const cancellationData = useMemo(() => getCancellationTrendData(requests, currentMonth), [requests, currentMonth]);

  // コスト・生産性分析
  const staffOptimizationData = useMemo(
    () => getStaffOptimizationData(schedules, staff, currentMonth),
    [schedules, staff, currentMonth]
  );
  const staffProductivityData = useMemo(
    () => getStaffProductivityData(schedules, usageRecords, staff),
    [schedules, usageRecords, staff]
  );
  const costTrendData = useMemo(() => getCostTrendData(currentMonth), [currentMonth]);

  // 先行指標とリスク予測
  const funnelData = useMemo(() => getFunnelData(children), [children]);
  const churnRiskData = useMemo(() => getChurnRiskData(children, schedules, usageRecords), [children, schedules, usageRecords]);
  const ltvData = useMemo(() => calculateLTV(children, usageRecords), [children, usageRecords]);

  // ヒートマップ用の色分け
  const getHeatmapColor = (occupancy: number, capacity: number) => {
    const rate = (occupancy / capacity) * 100;
    if (rate >= 90) return '#10b981'; // 緑
    if (rate >= 70) return '#3b82f6'; // 青
    if (rate >= 50) return '#f59e0b'; // オレンジ
    return '#ef4444'; // 赤
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 最上段：エグゼクティブ・サマリー */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <Target className="mr-2 text-[#00c4cc]" size={20} />
          エグゼクティブ・サマリー
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">月次想定利益（見込み）</div>
            <div className="text-2xl font-bold text-gray-800">
              ¥{profitData.profit.toLocaleString()}
            </div>
            <div className="text-xs mt-2 flex items-center">
              {profitData.achievementRate >= 100 ? (
                <span className="text-green-600 font-bold flex items-center">
                  <TrendingUp size={14} className="mr-1" />
                  目標100万に対し、達成率{profitData.achievementRate.toFixed(1)}%
                </span>
              ) : (
                <span className="text-red-600 font-bold flex items-center">
                  <TrendingDown size={14} className="mr-1" />
                  目標100万に対し、達成率{profitData.achievementRate.toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">稼働率（月間累計）</div>
            <div className="text-2xl font-bold text-gray-800">{occupancyData.rate.toFixed(1)}%</div>
            <div className="text-xs mt-2">
              {occupancyData.rate >= occupancyData.target ? (
                <span className="text-green-600 font-bold">
                  目標{occupancyData.target}%に対し、現在{occupancyData.rate.toFixed(1)}%
                </span>
              ) : (
                <span className="text-red-600 font-bold">
                  目標{occupancyData.target}%に対し、現在{occupancyData.rate.toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">平均単価（ARPU）</div>
            <div className="text-2xl font-bold text-gray-800">¥{arpuData.arpu.toLocaleString()}</div>
            <div className="text-xs mt-2">
              {arpuData.arpu >= arpuData.target ? (
                <span className="text-green-600 font-bold">
                  目標{arpuData.target.toLocaleString()}円に対し、現在{arpuData.arpu.toLocaleString()}円
                </span>
              ) : (
                <span className="text-red-600 font-bold">
                  目標{arpuData.target.toLocaleString()}円に対し、現在{arpuData.arpu.toLocaleString()}円
                </span>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">人件費率（L/R比）</div>
            <div className="text-2xl font-bold text-gray-800">{laborRatioData.ratio.toFixed(1)}%</div>
            <div className="text-xs mt-2">
              {laborRatioData.ratio <= laborRatioData.target ? (
                <span className="text-green-600 font-bold">
                  目標{laborRatioData.target}%に対し、現在{laborRatioData.ratio.toFixed(1)}%
                </span>
              ) : (
                <span className="text-red-600 font-bold">
                  目標{laborRatioData.target}%に対し、現在{laborRatioData.ratio.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 異常値アラート */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <div className="flex items-center mb-2">
              <AlertTriangle className="text-red-600 mr-2" size={18} />
              <span className="font-bold text-red-800">異常値アラート</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {alerts.map((alert, index) => (
                <li key={index} className="text-red-700 text-sm">{alert}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 中段：収益エンジン分析とコスト・生産性分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 中段左：収益エンジン分析 */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <DollarSign className="mr-2 text-[#00c4cc]" size={20} />
            収益エンジン分析
          </h2>

          {/* 曜日別・時間枠別稼働ヒートマップ */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">曜日別・時間枠別 稼働ヒートマップ</h3>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-2 min-w-[500px]">
                {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                  <div key={day} className="text-center">
                    <div className="text-xs font-bold text-gray-600 mb-1">{day}</div>
                    {['AM', 'PM'].map((slot) => {
                      const data = heatmapData.find((d) => d.dayOfWeek === day && d.slot === slot);
                      const rate = data ? (data.occupancy / data.capacity) * 100 : 0;
                      return (
                        <div
                          key={slot}
                          className="h-12 rounded mb-1 flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: getHeatmapColor(data?.occupancy || 0, data?.capacity || 10) }}
                        >
                          {rate.toFixed(0)}%
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-2 text-xs text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
                  <span>50%未満</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded mr-1"></div>
                  <span>50-70%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded mr-1"></div>
                  <span>70-90%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                  <span>90%以上</span>
                </div>
              </div>
            </div>
          </div>

          {/* 加算取得マトリクス */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">加算取得マトリクス</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={addonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="addon" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="percentage" fill="#00c4cc" radius={[4, 4, 0, 0]}>
                  {addonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.percentage > 50 ? '#10b981' : '#00c4cc'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* キャンセル分析トレンド */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">キャンセル分析トレンド</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cancellationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="cancellationRate" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 中段右：コスト・生産性分析 */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Users className="mr-2 text-[#00c4cc]" size={20} />
            コスト・生産性分析
          </h2>

          {/* スタッフ配置最適化グラフ */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">スタッフ配置最適化グラフ</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={staffOptimizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="childrenCount" fill="#3b82f6" name="児童数" />
                <Line type="monotone" dataKey="staffCount" stroke="#ef4444" strokeWidth={2} name="スタッフ数" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* スタッフ別・生産性指標 */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">スタッフ別・生産性指標</h3>
            <div className="space-y-3">
              {staffProductivityData.map((staff, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-bold text-sm text-gray-800">{staff.staffName}</div>
                    <div className="text-xs text-gray-500">
                      担当児童数: {staff.childrenCount}人 | 個別支援計画: {staff.plansCount}件
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-[#00c4cc]">
                      {staff.childrenCount > 0 ? ((staff.plansCount / staff.childrenCount) * 100).toFixed(0) : 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 固定費・変動費推移 */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">固定費・変動費推移</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={costTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="fixedCost" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="固定費" />
                <Area type="monotone" dataKey="variableCost" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="変動費" />
                <Line type="monotone" dataKey="budget" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="予算" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 下段：先行指標とリスク予測 */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <TrendingUp className="mr-2 text-[#00c4cc]" size={20} />
          先行指標とリスク予測
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 入会ファネル */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">入会ファネル</h3>
            <div className="space-y-3">
              {funnelData.map((stage, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-gray-700">{stage.stage}</span>
                    <span className="text-sm font-bold text-[#00c4cc]">{stage.count}件</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-[#00c4cc] h-4 rounded-full transition-all"
                      style={{ width: `${stage.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">変換率: {stage.percentage.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* チャーン（退会）予兆スコア */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">チャーン（退会）予兆スコア</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {churnRiskData.length > 0 ? (
                churnRiskData.map((risk, index) => (
                  <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-gray-800">{risk.childName}</span>
                      <span className="text-sm font-bold text-red-600">{risk.riskScore.toFixed(0)}点</span>
                    </div>
                    <div className="text-xs text-red-700">{risk.reason}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">リスクのある児童は現在ありません</div>
              )}
            </div>
          </div>

          {/* LTV（ライフタイムバリュー）予測 */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">LTV（ライフタイムバリュー）予測</h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">平均LTV</div>
                <div className="text-2xl font-bold text-blue-600">¥{ltvData.averageLTV.toLocaleString()}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">総LTV</div>
                <div className="text-2xl font-bold text-green-600">¥{ltvData.totalLTV.toLocaleString()}</div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                現在の平均通所期間と予想残存期間から算出した期待収益
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
