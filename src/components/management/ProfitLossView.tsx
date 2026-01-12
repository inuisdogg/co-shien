/**
 * 損益計算書(P&L)ビュー
 * 月次の収益・費用を一覧表示し、予算対比・前年比を分析
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ProfitLossData, ProfitLossLineItem } from '@/types/expense';
import { DEFAULT_CATEGORY_IDS, getCategoryInfo } from '@/constants/expenseCategories';

type Props = {
  facilityId: string;
};

type MonthlyData = {
  month: number;
  revenue: number;
  revenueOther: number;
  personnelCost: number;
  fixedCost: number;
  expenses: Record<string, number>;
  expenseTotal: number;
};

export default function ProfitLossView({ facilityId }: Props) {
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(() => {
    const now = new Date();
    // 日本の会計年度: 4月開始なので、1-3月は前年度
    return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [previousYearData, setPreviousYearData] = useState<MonthlyData[]>([]);
  const [budgetData, setBudgetData] = useState<{ revenue: number; expense: number } | null>(null);
  const [managementTargets, setManagementTargets] = useState<any>(null);

  // 会計年度の月リスト（4月〜3月）
  const fiscalMonths = useMemo(() => {
    const months = [];
    for (let i = 4; i <= 12; i++) months.push({ year: fiscalYear, month: i });
    for (let i = 1; i <= 3; i++) months.push({ year: fiscalYear + 1, month: i });
    return months;
  }, [fiscalYear]);

  // 月次データを取得
  const fetchMonthlyData = useCallback(async (targetYear: number): Promise<MonthlyData[]> => {
    const data: MonthlyData[] = [];

    // 会計年度の各月のデータを取得
    const months = [];
    for (let i = 4; i <= 12; i++) months.push({ year: targetYear, month: i });
    for (let i = 1; i <= 3; i++) months.push({ year: targetYear + 1, month: i });

    for (const { year, month } of months) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 売上（利用実績から計算）
      const { data: usageData, error: usageError } = await supabase
        .from('usage_records')
        .select('amount, actual_fee')
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      const revenue = usageData?.reduce((sum, r) => sum + (Number(r.actual_fee) || 0), 0) || 0;

      // 承認済み経費
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('category, amount')
        .eq('facility_id', facilityId)
        .eq('status', 'approved')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      const expenses: Record<string, number> = {};
      let expenseTotal = 0;
      expenseData?.forEach(e => {
        const cat = e.category;
        const amount = Number(e.amount);
        expenses[cat] = (expenses[cat] || 0) + amount;
        expenseTotal += amount;
      });

      data.push({
        month,
        revenue,
        revenueOther: 0, // その他収入（今後拡張）
        personnelCost: 0, // 後で設定
        fixedCost: 0, // 後で設定
        expenses,
        expenseTotal,
      });
    }

    return data;
  }, [facilityId]);

  // 経営目標データを取得
  const fetchManagementTargets = useCallback(async () => {
    const { data, error } = await supabase
      .from('management_targets')
      .select('*')
      .eq('facility_id', facilityId)
      .single();

    if (!error && data) {
      setManagementTargets(data);

      // 人件費・固定費を月次データに反映
      const personnelCost = data.staff_salaries?.reduce((sum: number, s: any) => sum + (Number(s.monthlySalary) || 0), 0) || 0;
      const fixedCost = data.fixed_cost_items?.reduce((sum: number, f: any) => sum + (Number(f.monthlyAmount) || 0), 0) || 0;

      setMonthlyData(prev =>
        prev.map(m => ({
          ...m,
          personnelCost,
          fixedCost,
        }))
      );

      // 予算設定
      if (data.target_monthly_revenue) {
        setBudgetData({
          revenue: Number(data.target_monthly_revenue),
          expense: personnelCost + fixedCost,
        });
      }
    }
  }, [facilityId]);

  // データ取得
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [currentData, previousData] = await Promise.all([
          fetchMonthlyData(fiscalYear),
          fetchMonthlyData(fiscalYear - 1),
        ]);
        setMonthlyData(currentData);
        setPreviousYearData(previousData);
        await fetchManagementTargets();
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fiscalYear, fetchMonthlyData, fetchManagementTargets]);

  // 損益計算
  const calculateProfitLoss = useCallback((data: MonthlyData) => {
    const totalRevenue = data.revenue + data.revenueOther;
    const grossProfit = totalRevenue - data.personnelCost;
    const operatingExpense = data.fixedCost + data.expenseTotal;
    const operatingProfit = grossProfit - operatingExpense;
    const profitMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, grossProfit, operatingExpense, operatingProfit, profitMargin };
  }, []);

  // 年間合計
  const yearTotals = useMemo(() => {
    const totals = {
      revenue: 0,
      revenueOther: 0,
      personnelCost: 0,
      fixedCost: 0,
      expenseTotal: 0,
      expenses: {} as Record<string, number>,
    };

    monthlyData.forEach(m => {
      totals.revenue += m.revenue;
      totals.revenueOther += m.revenueOther;
      totals.personnelCost += m.personnelCost;
      totals.fixedCost += m.fixedCost;
      totals.expenseTotal += m.expenseTotal;

      Object.entries(m.expenses).forEach(([cat, amount]) => {
        totals.expenses[cat] = (totals.expenses[cat] || 0) + amount;
      });
    });

    return totals;
  }, [monthlyData]);

  // フォーマット
  const formatCurrency = (amount: number, short = false) => {
    if (short && Math.abs(amount) >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Excel出力
  const exportToExcel = () => {
    const headers = ['項目', ...fiscalMonths.map(m => `${m.month}月`), '年計'];
    const rows: string[][] = [];

    // 売上
    rows.push(['【売上高】', ...fiscalMonths.map(() => ''), '']);
    rows.push(['サービス売上', ...monthlyData.map(m => formatCurrency(m.revenue)), formatCurrency(yearTotals.revenue)]);
    rows.push(['その他収入', ...monthlyData.map(m => formatCurrency(m.revenueOther)), formatCurrency(yearTotals.revenueOther)]);
    rows.push(['売上高合計', ...monthlyData.map(m => formatCurrency(m.revenue + m.revenueOther)), formatCurrency(yearTotals.revenue + yearTotals.revenueOther)]);
    rows.push(['', ...fiscalMonths.map(() => ''), '']);

    // 売上原価
    rows.push(['【売上原価】', ...fiscalMonths.map(() => ''), '']);
    rows.push(['人件費', ...monthlyData.map(m => formatCurrency(m.personnelCost)), formatCurrency(yearTotals.personnelCost)]);
    rows.push(['', ...fiscalMonths.map(() => ''), '']);

    // 売上総利益
    const grossProfits = monthlyData.map(m => m.revenue + m.revenueOther - m.personnelCost);
    rows.push(['【売上総利益】', ...grossProfits.map(p => formatCurrency(p)), formatCurrency(yearTotals.revenue + yearTotals.revenueOther - yearTotals.personnelCost)]);
    rows.push(['', ...fiscalMonths.map(() => ''), '']);

    // 販管費
    rows.push(['【販管費】', ...fiscalMonths.map(() => ''), '']);
    rows.push(['固定費', ...monthlyData.map(m => formatCurrency(m.fixedCost)), formatCurrency(yearTotals.fixedCost)]);

    // カテゴリ別経費
    const categories = [
      DEFAULT_CATEGORY_IDS.TRANSPORT,
      DEFAULT_CATEGORY_IDS.SUPPLIES,
      DEFAULT_CATEGORY_IDS.FOOD,
      DEFAULT_CATEGORY_IDS.TELECOM,
      DEFAULT_CATEGORY_IDS.UTILITIES,
      DEFAULT_CATEGORY_IDS.REPAIR,
      DEFAULT_CATEGORY_IDS.TRAINING,
      DEFAULT_CATEGORY_IDS.OTHER,
    ];

    categories.forEach(cat => {
      const info = getCategoryInfo(cat);
      rows.push([
        info?.name || cat,
        ...monthlyData.map(m => formatCurrency(m.expenses[cat] || 0)),
        formatCurrency(yearTotals.expenses[cat] || 0),
      ]);
    });

    rows.push(['販管費合計', ...monthlyData.map(m => formatCurrency(m.fixedCost + m.expenseTotal)), formatCurrency(yearTotals.fixedCost + yearTotals.expenseTotal)]);
    rows.push(['', ...fiscalMonths.map(() => ''), '']);

    // 営業利益
    const opProfits = monthlyData.map(m => {
      const { operatingProfit } = calculateProfitLoss(m);
      return operatingProfit;
    });
    const yearOpProfit = yearTotals.revenue + yearTotals.revenueOther - yearTotals.personnelCost - yearTotals.fixedCost - yearTotals.expenseTotal;
    rows.push(['【営業利益】', ...opProfits.map(p => formatCurrency(p)), formatCurrency(yearOpProfit)]);

    // CSV形式で出力
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `損益計算書_${fiscalYear}年度.csv`;
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
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">損益計算書</h2>
            <p className="text-sm text-gray-500">月次収益・費用の一覧</p>
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
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors ml-2"
          >
            <Download className="w-4 h-4" />
            Excel出力
          </button>
        </div>
      </div>

      {/* 年間サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">年間売上</div>
          <div className="text-2xl font-bold text-gray-800">
            {formatCurrency(yearTotals.revenue + yearTotals.revenueOther)}
          </div>
          {budgetData && (
            <div className={`text-sm flex items-center gap-1 ${
              yearTotals.revenue >= budgetData.revenue * 12 ? 'text-green-600' : 'text-red-600'
            }`}>
              {yearTotals.revenue >= budgetData.revenue * 12 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              予算比 {formatPercent(((yearTotals.revenue / (budgetData.revenue * 12)) - 1) * 100)}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">年間経費</div>
          <div className="text-2xl font-bold text-gray-800">
            {formatCurrency(yearTotals.personnelCost + yearTotals.fixedCost + yearTotals.expenseTotal)}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">営業利益</div>
          {(() => {
            const profit = yearTotals.revenue + yearTotals.revenueOther - yearTotals.personnelCost - yearTotals.fixedCost - yearTotals.expenseTotal;
            return (
              <>
                <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profit)}
                </div>
                <div className="text-sm text-gray-500">
                  利益率 {((profit / (yearTotals.revenue + yearTotals.revenueOther || 1)) * 100).toFixed(1)}%
                </div>
              </>
            );
          })()}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500 mb-1">前年比</div>
          {(() => {
            const currentTotal = yearTotals.revenue + yearTotals.revenueOther;
            const previousTotal = previousYearData.reduce((sum, m) => sum + m.revenue + m.revenueOther, 0);
            const change = previousTotal > 0 ? ((currentTotal / previousTotal) - 1) * 100 : 0;
            return (
              <div className={`text-2xl font-bold flex items-center gap-1 ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {change >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                {formatPercent(change)}
              </div>
            );
          })()}
        </div>
      </div>

      {/* P&L表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-bold text-gray-700 sticky left-0 bg-gray-50 min-w-[160px]">
                  項目
                </th>
                {fiscalMonths.map(({ month }) => (
                  <th key={month} className="text-right px-3 py-3 font-bold text-gray-700 min-w-[80px]">
                    {month}月
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-bold text-gray-700 bg-blue-50 min-w-[100px]">
                  年計
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 売上高セクション */}
              <tr className="bg-blue-50/50">
                <td colSpan={14} className="px-4 py-2 font-bold text-blue-700 sticky left-0 bg-blue-50/50">
                  【売上高】
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">サービス売上</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right text-gray-800">
                    {formatCurrency(m.revenue, true)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-50">
                  {formatCurrency(yearTotals.revenue)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">その他収入</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right text-gray-800">
                    {formatCurrency(m.revenueOther, true)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-50">
                  {formatCurrency(yearTotals.revenueOther)}
                </td>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50">
                <td className="px-4 py-2 font-bold text-gray-700 sticky left-0 bg-gray-50">売上高合計</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right font-bold text-gray-800">
                    {formatCurrency(m.revenue + m.revenueOther, true)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-100">
                  {formatCurrency(yearTotals.revenue + yearTotals.revenueOther)}
                </td>
              </tr>

              {/* 売上原価セクション */}
              <tr className="bg-orange-50/50">
                <td colSpan={14} className="px-4 py-2 font-bold text-orange-700 sticky left-0 bg-orange-50/50">
                  【売上原価】
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">人件費</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right text-gray-800">
                    {formatCurrency(m.personnelCost, true)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-50">
                  {formatCurrency(yearTotals.personnelCost)}
                </td>
              </tr>

              {/* 売上総利益 */}
              <tr className="border-b border-gray-200 bg-green-50">
                <td className="px-4 py-2 font-bold text-green-700 sticky left-0 bg-green-50">【売上総利益】</td>
                {monthlyData.map((m, i) => {
                  const grossProfit = m.revenue + m.revenueOther - m.personnelCost;
                  return (
                    <td key={i} className={`px-3 py-2 text-right font-bold ${grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatCurrency(grossProfit, true)}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-bold text-green-700 bg-green-100">
                  {formatCurrency(yearTotals.revenue + yearTotals.revenueOther - yearTotals.personnelCost)}
                </td>
              </tr>

              {/* 販管費セクション */}
              <tr className="bg-red-50/50">
                <td colSpan={14} className="px-4 py-2 font-bold text-red-700 sticky left-0 bg-red-50/50">
                  【販管費】
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">固定費（家賃等）</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right text-gray-800">
                    {formatCurrency(m.fixedCost, true)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-50">
                  {formatCurrency(yearTotals.fixedCost)}
                </td>
              </tr>
              {/* カテゴリ別経費 */}
              {[
                DEFAULT_CATEGORY_IDS.TRANSPORT,
                DEFAULT_CATEGORY_IDS.SUPPLIES,
                DEFAULT_CATEGORY_IDS.FOOD,
                DEFAULT_CATEGORY_IDS.TELECOM,
                DEFAULT_CATEGORY_IDS.UTILITIES,
                DEFAULT_CATEGORY_IDS.REPAIR,
                DEFAULT_CATEGORY_IDS.TRAINING,
                DEFAULT_CATEGORY_IDS.OTHER,
              ].map(cat => {
                const info = getCategoryInfo(cat);
                const hasData = yearTotals.expenses[cat] > 0;
                if (!hasData) return null;
                return (
                  <tr key={cat} className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white pl-6">
                      {info?.name || cat}
                    </td>
                    {monthlyData.map((m, i) => (
                      <td key={i} className="px-3 py-2 text-right text-gray-800">
                        {formatCurrency(m.expenses[cat] || 0, true)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-50">
                      {formatCurrency(yearTotals.expenses[cat] || 0)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b border-gray-200 bg-gray-50">
                <td className="px-4 py-2 font-bold text-gray-700 sticky left-0 bg-gray-50">販管費合計</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right font-bold text-gray-800">
                    {formatCurrency(m.fixedCost + m.expenseTotal, true)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-100">
                  {formatCurrency(yearTotals.fixedCost + yearTotals.expenseTotal)}
                </td>
              </tr>

              {/* 営業利益 */}
              <tr className="bg-purple-50">
                <td className="px-4 py-2 font-bold text-purple-700 sticky left-0 bg-purple-50">【営業利益】</td>
                {monthlyData.map((m, i) => {
                  const { operatingProfit } = calculateProfitLoss(m);
                  return (
                    <td key={i} className={`px-3 py-2 text-right font-bold ${operatingProfit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                      {formatCurrency(operatingProfit, true)}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-bold text-purple-700 bg-purple-100">
                  {formatCurrency(yearTotals.revenue + yearTotals.revenueOther - yearTotals.personnelCost - yearTotals.fixedCost - yearTotals.expenseTotal)}
                </td>
              </tr>
              <tr className="bg-purple-50/50">
                <td className="px-4 py-2 text-gray-600 sticky left-0 bg-purple-50/50">営業利益率</td>
                {monthlyData.map((m, i) => {
                  const { profitMargin } = calculateProfitLoss(m);
                  return (
                    <td key={i} className={`px-3 py-2 text-right ${profitMargin >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                      {profitMargin.toFixed(1)}%
                    </td>
                  );
                })}
                {(() => {
                  const totalRevenue = yearTotals.revenue + yearTotals.revenueOther;
                  const totalProfit = totalRevenue - yearTotals.personnelCost - yearTotals.fixedCost - yearTotals.expenseTotal;
                  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
                  return (
                    <td className={`px-4 py-2 text-right font-bold bg-purple-100 ${margin >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                      {margin.toFixed(1)}%
                    </td>
                  );
                })()}
              </tr>

              {/* 予算対比（予算データがある場合） */}
              {budgetData && (
                <>
                  <tr className="bg-yellow-50/50">
                    <td colSpan={14} className="px-4 py-2 font-bold text-yellow-700 sticky left-0 bg-yellow-50/50">
                      【予算対比】
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">予算（売上）</td>
                    {fiscalMonths.map((_, i) => (
                      <td key={i} className="px-3 py-2 text-right text-gray-600">
                        {formatCurrency(budgetData.revenue, true)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-bold text-gray-800 bg-blue-50">
                      {formatCurrency(budgetData.revenue * 12)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">差異</td>
                    {monthlyData.map((m, i) => {
                      const diff = m.revenue - budgetData.revenue;
                      return (
                        <td key={i} className={`px-3 py-2 text-right ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff, true)}
                        </td>
                      );
                    })}
                    {(() => {
                      const diff = yearTotals.revenue - budgetData.revenue * 12;
                      return (
                        <td className={`px-4 py-2 text-right font-bold bg-blue-50 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        </td>
                      );
                    })()}
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">達成率</td>
                    {monthlyData.map((m, i) => {
                      const rate = budgetData.revenue > 0 ? (m.revenue / budgetData.revenue) * 100 : 0;
                      return (
                        <td key={i} className={`px-3 py-2 text-right ${rate >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {rate.toFixed(1)}%
                        </td>
                      );
                    })}
                    {(() => {
                      const rate = budgetData.revenue > 0 ? (yearTotals.revenue / (budgetData.revenue * 12)) * 100 : 0;
                      return (
                        <td className={`px-4 py-2 text-right font-bold bg-blue-50 ${rate >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {rate.toFixed(1)}%
                        </td>
                      );
                    })()}
                  </tr>
                </>
              )}

              {/* 前年比 */}
              {previousYearData.length > 0 && (
                <>
                  <tr className="bg-gray-100/50">
                    <td colSpan={14} className="px-4 py-2 font-bold text-gray-700 sticky left-0 bg-gray-100/50">
                      【前年同月比】
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">前年売上</td>
                    {previousYearData.map((m, i) => (
                      <td key={i} className="px-3 py-2 text-right text-gray-600">
                        {formatCurrency(m.revenue, true)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-bold text-gray-600 bg-blue-50">
                      {formatCurrency(previousYearData.reduce((sum, m) => sum + m.revenue, 0))}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-700 sticky left-0 bg-white">増減率</td>
                    {monthlyData.map((m, i) => {
                      const prev = previousYearData[i]?.revenue || 0;
                      const change = prev > 0 ? ((m.revenue / prev) - 1) * 100 : 0;
                      return (
                        <td key={i} className={`px-3 py-2 text-right ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(change)}
                        </td>
                      );
                    })}
                    {(() => {
                      const prevTotal = previousYearData.reduce((sum, m) => sum + m.revenue, 0);
                      const change = prevTotal > 0 ? ((yearTotals.revenue / prevTotal) - 1) * 100 : 0;
                      return (
                        <td className={`px-4 py-2 text-right font-bold bg-blue-50 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(change)}
                        </td>
                      );
                    })()}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 注記 */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p>※ 売上はサービス利用実績から算出しています。</p>
          <p>※ 人件費・固定費は経営目標設定の値を使用しています。</p>
          <p>※ 販管費は承認済みの経費申請から集計しています。</p>
        </div>
      </div>
    </div>
  );
}
