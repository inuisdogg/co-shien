/**
 * キャッシュフロービュー
 * 月次の収入・支出・キャッシュフロー推移を可視化
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  Download,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Loader2,
  BarChart3,
  Table,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CashFlowMonth } from '@/types/expense';

type Props = {
  facilityId: string;
};

type ViewMode = 'chart' | 'table';

export default function CashFlowView({ facilityId }: Props) {
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(() => {
    const now = new Date();
    return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [cashFlowData, setCashFlowData] = useState<CashFlowMonth[]>([]);
  const [previousYearData, setPreviousYearData] = useState<CashFlowMonth[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [managementTargets, setManagementTargets] = useState<any>(null);

  // 会計年度の月リスト（4月〜3月）
  const fiscalMonths = useMemo(() => {
    const months = [];
    for (let i = 4; i <= 12; i++) months.push({ year: fiscalYear, month: i });
    for (let i = 1; i <= 3; i++) months.push({ year: fiscalYear + 1, month: i });
    return months;
  }, [fiscalYear]);

  // キャッシュフローデータを取得
  const fetchCashFlowData = useCallback(async (targetYear: number): Promise<CashFlowMonth[]> => {
    const data: CashFlowMonth[] = [];
    let cumulativeCashFlow = 0;

    const months = [];
    for (let i = 4; i <= 12; i++) months.push({ year: targetYear, month: i });
    for (let i = 1; i <= 3; i++) months.push({ year: targetYear + 1, month: i });

    for (const { year, month } of months) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 売上（収入）
      const { data: usageData } = await supabase
        .from('usage_records')
        .select('actual_fee')
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      const revenue = usageData?.reduce((sum, r) => sum + (Number(r.actual_fee) || 0), 0) || 0;

      // 経費（支出）- 承認済みのみ
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('facility_id', facilityId)
        .eq('status', 'approved')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      const expenseTotal = expenseData?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

      // 人件費・固定費（management_targetsから取得する場合は後で追加）
      let personnelCost = 0;
      let fixedCost = 0;

      if (managementTargets) {
        personnelCost = managementTargets.staff_salaries?.reduce((sum: number, s: any) => sum + (Number(s.monthlySalary) || 0), 0) || 0;
        fixedCost = managementTargets.fixed_cost_items?.reduce((sum: number, f: any) => sum + (Number(f.monthlyAmount) || 0), 0) || 0;
      }

      const totalExpense = expenseTotal + personnelCost + fixedCost;
      const cashFlow = revenue - totalExpense;
      cumulativeCashFlow += cashFlow;

      data.push({
        month,
        revenue,
        expense: totalExpense,
        cashFlow,
        cumulativeCashFlow,
      });
    }

    return data;
  }, [facilityId, managementTargets]);

  // 経営目標データを取得
  const fetchManagementTargets = useCallback(async () => {
    const { data, error } = await supabase
      .from('management_targets')
      .select('*')
      .eq('facility_id', facilityId)
      .single();

    if (!error && data) {
      setManagementTargets(data);
    }
  }, [facilityId]);

  // データ取得
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchManagementTargets();
      } catch (err) {
        console.error('経営目標取得エラー:', err);
      }
    };
    loadData();
  }, [fetchManagementTargets]);

  useEffect(() => {
    const loadCashFlow = async () => {
      if (!managementTargets && fiscalYear) {
        // managementTargetsなしでも動作するように
      }
      setLoading(true);
      try {
        const [currentData, previousData] = await Promise.all([
          fetchCashFlowData(fiscalYear),
          fetchCashFlowData(fiscalYear - 1),
        ]);

        // 前年データを付与
        const dataWithPrevious = currentData.map((m, i) => ({
          ...m,
          previousYearCashFlow: previousData[i]?.cashFlow,
        }));

        setCashFlowData(dataWithPrevious);
        setPreviousYearData(previousData);
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCashFlow();
  }, [fiscalYear, fetchCashFlowData, managementTargets]);

  // 年間集計
  const yearTotals = useMemo(() => {
    return {
      revenue: cashFlowData.reduce((sum, m) => sum + m.revenue, 0),
      expense: cashFlowData.reduce((sum, m) => sum + m.expense, 0),
      cashFlow: cashFlowData.reduce((sum, m) => sum + m.cashFlow, 0),
      previousRevenue: previousYearData.reduce((sum, m) => sum + m.revenue, 0),
      previousCashFlow: previousYearData.reduce((sum, m) => sum + m.cashFlow, 0),
    };
  }, [cashFlowData, previousYearData]);

  // フォーマット
  const formatCurrency = (amount: number, short = false) => {
    if (short && Math.abs(amount) >= 10000) {
      return `${(amount / 10000).toFixed(1)}万`;
    }
    if (short && Math.abs(amount) >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // グラフの最大値計算
  const maxValue = useMemo(() => {
    let max = 0;
    cashFlowData.forEach(m => {
      max = Math.max(max, Math.abs(m.revenue), Math.abs(m.expense), Math.abs(m.cumulativeCashFlow));
    });
    return max * 1.1; // 10%余裕
  }, [cashFlowData]);

  // CSV出力
  const exportCSV = () => {
    const headers = ['月', '収入', '支出', 'キャッシュフロー', '累計CF', '前年CF', '前年比'];
    const rows = cashFlowData.map(m => [
      `${m.month}月`,
      formatCurrency(m.revenue),
      formatCurrency(m.expense),
      formatCurrency(m.cashFlow),
      formatCurrency(m.cumulativeCashFlow),
      m.previousYearCashFlow !== undefined ? formatCurrency(m.previousYearCashFlow) : '-',
      m.previousYearCashFlow !== undefined && m.previousYearCashFlow !== 0
        ? formatPercent(((m.cashFlow / m.previousYearCashFlow) - 1) * 100)
        : '-',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `キャッシュフロー_${fiscalYear}年度.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">キャッシュフロー</h2>
            <p className="text-sm text-gray-500">月次収支の推移</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiscalYear(y => y - 1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="px-4 py-2 bg-gray-100 rounded-lg font-bold text-gray-800">
            {fiscalYear}年度
          </span>
          <button
            onClick={() => setFiscalYear(y => y + 1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center bg-gray-100 rounded-lg p-1 ml-2">
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                viewMode === 'chart' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              グラフ
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-600'
              }`}
            >
              <Table className="w-4 h-4" />
              表
            </button>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors ml-2"
          >
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">年間収入</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(yearTotals.revenue)}
          </div>
          {yearTotals.previousRevenue > 0 && (
            <div className={`text-sm flex items-center gap-1 ${
              yearTotals.revenue >= yearTotals.previousRevenue ? 'text-green-600' : 'text-red-600'
            }`}>
              {yearTotals.revenue >= yearTotals.previousRevenue ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
              前年比 {formatPercent(((yearTotals.revenue / yearTotals.previousRevenue) - 1) * 100)}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">年間支出</div>
          <div className="text-2xl font-bold text-red-500">
            {formatCurrency(yearTotals.expense)}
          </div>
          <div className="text-sm text-gray-500">
            月平均 {formatCurrency(yearTotals.expense / 12, true)}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">年間キャッシュフロー</div>
          <div className={`text-2xl font-bold ${yearTotals.cashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(yearTotals.cashFlow)}
          </div>
          {yearTotals.previousCashFlow !== 0 && (
            <div className={`text-sm flex items-center gap-1 ${
              yearTotals.cashFlow >= yearTotals.previousCashFlow ? 'text-green-600' : 'text-red-600'
            }`}>
              {yearTotals.cashFlow >= yearTotals.previousCashFlow ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              前年比 {formatPercent(((yearTotals.cashFlow / yearTotals.previousCashFlow) - 1) * 100)}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">累計キャッシュフロー</div>
          <div className={`text-2xl font-bold ${
            cashFlowData[cashFlowData.length - 1]?.cumulativeCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {formatCurrency(cashFlowData[cashFlowData.length - 1]?.cumulativeCashFlow || 0)}
          </div>
          <div className="text-sm text-gray-500">
            年度末時点
          </div>
        </div>
      </div>

      {/* グラフ表示 */}
      {viewMode === 'chart' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">月次キャッシュフロー推移</h3>

          {/* 凡例 */}
          <div className="flex items-center gap-6 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              <span className="text-gray-600">収入</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-400 rounded" />
              <span className="text-gray-600">支出</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded" />
              <span className="text-gray-600">キャッシュフロー</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 border-t-2 border-dashed border-purple-500" style={{ width: '16px' }} />
              <span className="text-gray-600">累計CF</span>
            </div>
          </div>

          {/* シンプルなバーチャート */}
          <div className="relative h-64">
            <div className="absolute inset-0 flex items-end justify-around gap-1 px-2">
              {cashFlowData.map((m, i) => {
                const revenueHeight = maxValue > 0 ? (m.revenue / maxValue) * 100 : 0;
                const expenseHeight = maxValue > 0 ? (m.expense / maxValue) * 100 : 0;
                const cfHeight = maxValue > 0 ? (Math.abs(m.cashFlow) / maxValue) * 100 : 0;
                const cumulativeHeight = maxValue > 0 ? (Math.abs(m.cumulativeCashFlow) / maxValue) * 100 : 0;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-48 flex items-end justify-center gap-0.5 relative">
                      {/* 収入バー */}
                      <div
                        className="w-3 bg-blue-500 rounded-t transition-all"
                        style={{ height: `${revenueHeight}%` }}
                        title={`収入: ${formatCurrency(m.revenue)}`}
                      />
                      {/* 支出バー */}
                      <div
                        className="w-3 bg-red-400 rounded-t transition-all"
                        style={{ height: `${expenseHeight}%` }}
                        title={`支出: ${formatCurrency(m.expense)}`}
                      />
                      {/* CFバー */}
                      <div
                        className={`w-3 rounded-t transition-all ${m.cashFlow >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ height: `${cfHeight}%` }}
                        title={`CF: ${formatCurrency(m.cashFlow)}`}
                      />
                      {/* 累計CFライン（ドット） */}
                      <div
                        className="absolute w-2 h-2 bg-purple-500 rounded-full"
                        style={{
                          bottom: `${m.cumulativeCashFlow >= 0 ? cumulativeHeight : 0}%`,
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }}
                        title={`累計CF: ${formatCurrency(m.cumulativeCashFlow)}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{m.month}月</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Y軸ラベル */}
          <div className="flex justify-between text-xs text-gray-400 mt-2 px-2">
            <span>0</span>
            <span>{formatCurrency(maxValue / 2, true)}</span>
            <span>{formatCurrency(maxValue, true)}</span>
          </div>
        </div>
      )}

      {/* テーブル表示 */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-bold text-gray-700 sticky left-0 bg-gray-50">月</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-700">収入</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-700">支出</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-700">キャッシュフロー</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-700">累計CF</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-700">前年CF</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-700">前年比</th>
                </tr>
              </thead>
              <tbody>
                {cashFlowData.map((m, i) => {
                  const yoyChange = m.previousYearCashFlow && m.previousYearCashFlow !== 0
                    ? ((m.cashFlow / m.previousYearCashFlow) - 1) * 100
                    : null;

                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-800 sticky left-0 bg-white">
                        {m.month}月
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 font-bold">
                        {formatCurrency(m.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 font-bold">
                        {formatCurrency(m.expense)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        m.cashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(m.cashFlow)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        m.cumulativeCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(m.cumulativeCashFlow)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {m.previousYearCashFlow !== undefined
                          ? formatCurrency(m.previousYearCashFlow)
                          : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        yoyChange !== null
                          ? yoyChange >= 0 ? 'text-green-600' : 'text-red-600'
                          : 'text-gray-400'
                      }`}>
                        {yoyChange !== null ? formatPercent(yoyChange) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {/* 合計行 */}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-4 py-3 text-gray-800 sticky left-0 bg-gray-50">年間合計</td>
                  <td className="px-4 py-3 text-right text-blue-600">
                    {formatCurrency(yearTotals.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {formatCurrency(yearTotals.expense)}
                  </td>
                  <td className={`px-4 py-3 text-right ${
                    yearTotals.cashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(yearTotals.cashFlow)}
                  </td>
                  <td className={`px-4 py-3 text-right ${
                    cashFlowData[cashFlowData.length - 1]?.cumulativeCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(cashFlowData[cashFlowData.length - 1]?.cumulativeCashFlow || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {formatCurrency(yearTotals.previousCashFlow)}
                  </td>
                  <td className={`px-4 py-3 text-right ${
                    yearTotals.previousCashFlow !== 0
                      ? yearTotals.cashFlow >= yearTotals.previousCashFlow ? 'text-green-600' : 'text-red-600'
                      : 'text-gray-400'
                  }`}>
                    {yearTotals.previousCashFlow !== 0
                      ? formatPercent(((yearTotals.cashFlow / yearTotals.previousCashFlow) - 1) * 100)
                      : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 月別詳細カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cashFlowData.slice(0, 6).map((m, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-gray-800">{m.month}月</span>
              <span className={`text-sm font-bold px-2 py-1 rounded ${
                m.cashFlow >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                {m.cashFlow >= 0 ? '+' : ''}{formatCurrency(m.cashFlow, true)}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">収入</span>
                <span className="text-blue-600 font-bold">{formatCurrency(m.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">支出</span>
                <span className="text-red-500 font-bold">{formatCurrency(m.expense)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-gray-500">累計</span>
                <span className={`font-bold ${m.cumulativeCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(m.cumulativeCashFlow)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
