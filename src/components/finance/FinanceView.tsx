'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  Plus,
  Download,
  Minus,
  ArrowRight,
  Printer,
  X,
  Receipt,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseStatus, MonthlyFinancial } from '@/types/expense';

const EXPENSE_STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: '申請中', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  approved: { label: '承認済', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  rejected: { label: '却下', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
};

const CATEGORY_ICONS: Record<string, string> = {
  '交通費': '🚃',
  '消耗品費': '📦',
  '食費': '🍱',
  '通信費': '📞',
  '水道光熱費': '💡',
  '修繕費': '🔧',
  '研修費': '📚',
  'その他': '📋',
};

const DEFAULT_CATEGORIES = ['交通費', '消耗品費', '食費', '通信費', '水道光熱費', '修繕費', '研修費', 'その他'];

type TabId = 'expenses' | 'pl' | 'cashflow';

function mapExpenseRow(row: any): Expense {
  return {
    id: row.id,
    facilityId: row.facility_id,
    staffId: row.staff_id,
    submittedByUserId: row.submitted_by_user_id,
    title: row.title,
    amount: row.amount,
    expenseDate: row.expense_date,
    category: row.category,
    subcategory: row.subcategory,
    description: row.description,
    receiptUrl: row.receipt_url,
    receiptFileName: row.receipt_file_name,
    receiptFileSize: row.receipt_file_size,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFinancialRow(row: any): MonthlyFinancial {
  return {
    id: row.id,
    facilityId: row.facility_id,
    year: row.year,
    month: row.month,
    revenueService: row.revenue_service || 0,
    revenueOther: row.revenue_other || 0,
    expensePersonnel: row.expense_personnel || 0,
    expenseFixed: row.expense_fixed || 0,
    expenseVariable: row.expense_variable || 0,
    expenseOther: row.expense_other || 0,
    grossProfit: row.gross_profit || 0,
    operatingProfit: row.operating_profit || 0,
    netCashFlow: row.net_cash_flow || 0,
    budgetRevenue: row.budget_revenue,
    budgetExpense: row.budget_expense,
    isFinalized: row.is_finalized || false,
    finalizedAt: row.finalized_at,
    finalizedBy: row.finalized_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(1)}万円`;
  }
  return formatCurrency(amount);
}

// Skeleton loader
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
      <div className="h-8 bg-gray-100 rounded w-24" />
    </div>
  );
}

export default function FinanceView() {
  const { facility, user } = useAuth();
  const facilityId = facility?.id || '';

  const [activeTab, setActiveTab] = useState<TabId>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [financials, setFinancials] = useState<MonthlyFinancial[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount'>('newest');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddFinancialModal, setShowAddFinancialModal] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);

  // Add expense form
  const [newExpense, setNewExpense] = useState({
    title: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    category: DEFAULT_CATEGORIES[0],
    description: '',
  });

  // Add monthly financial form
  const currentDate = new Date();
  const [newFinancial, setNewFinancial] = useState({
    year: String(currentDate.getFullYear()),
    month: String(currentDate.getMonth() + 1),
    revenueService: '',
    revenueOther: '',
    expensePersonnel: '',
    expenseFixed: '',
    expenseVariable: '',
    expenseOther: '',
    notes: '',
  });

  useEffect(() => {
    if (!facilityId) return;
    const fetchData = async () => {
      try {
        const [expRes, finRes] = await Promise.all([
          supabase.from('expenses').select('*').eq('facility_id', facilityId).order('expense_date', { ascending: false }),
          supabase.from('monthly_financials').select('*').eq('facility_id', facilityId).order('year', { ascending: false }).order('month', { ascending: false }),
        ]);
        if (expRes.data) setExpenses(expRes.data.map(mapExpenseRow));
        if (finRes.data) setFinancials(finRes.data.map(mapFinancialRow));
      } catch (error) {
        console.error('Error fetching finance data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId]);

  // KPI calculations
  const kpi = useMemo(() => {
    const latest = financials[0];
    const previous = financials[1];
    if (!latest) return null;

    const revenue = latest.revenueService + latest.revenueOther;
    const totalExpense = latest.expensePersonnel + latest.expenseFixed + latest.expenseVariable + latest.expenseOther;
    const profit = revenue - totalExpense;

    let revenueChange = 0;
    if (previous) {
      const prevRevenue = previous.revenueService + previous.revenueOther;
      revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
    }

    return { revenue, totalExpense, profit, revenueChange, month: latest.month, year: latest.year };
  }, [financials]);

  const expenseStats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const approved = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
    const pending = expenses.filter(e => e.status === 'pending').length;
    const byCategory = new Map<string, number>();
    expenses.filter(e => e.status === 'approved').forEach(e => {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    });
    return { total, approved, pending, byCategory };
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    let result = expenses.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (searchTerm && !e.title.includes(searchTerm) && !e.category.includes(searchTerm)) return false;
      return true;
    });

    if (sortBy === 'oldest') {
      result.sort((a, b) => a.expenseDate.localeCompare(b.expenseDate));
    } else if (sortBy === 'amount') {
      result.sort((a, b) => b.amount - a.amount);
    }

    return result;
  }, [expenses, statusFilter, searchTerm, sortBy]);

  // Monthly trend chart data (last 6 months)
  const trendData = useMemo(() => {
    return [...financials].reverse().slice(-6).map(f => {
      const revenue = f.revenueService + f.revenueOther;
      const expense = f.expensePersonnel + f.expenseFixed + f.expenseVariable + f.expenseOther;
      return { label: `${f.month}月`, revenue, expense, profit: revenue - expense };
    });
  }, [financials]);

  const trendMaxValue = useMemo(() => {
    if (trendData.length === 0) return 1;
    return Math.max(...trendData.flatMap(d => [d.revenue, d.expense]));
  }, [trendData]);

  // Category breakdown for expense bar chart
  const categoryBreakdown = useMemo(() => {
    const entries = Array.from(expenseStats.byCategory.entries()).sort((a, b) => b[1] - a[1]);
    const maxAmount = entries.length > 0 ? entries[0][1] : 1;
    return entries.map(([cat, amount]) => ({ category: cat, amount, percentage: (amount / maxAmount) * 100 }));
  }, [expenseStats.byCategory]);

  const handleApprove = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', expenseId);
      if (error) throw error;
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'approved' as ExpenseStatus, approvedAt: new Date().toISOString() } : e));
    } catch (error) {
      console.error('Error approving expense:', error);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.title || !newExpense.amount || !facilityId || !user) return;
    setSavingExpense(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          facility_id: facilityId,
          staff_id: user.id,
          submitted_by_user_id: user.id,
          title: newExpense.title,
          amount: parseFloat(newExpense.amount),
          expense_date: newExpense.expenseDate,
          category: newExpense.category,
          description: newExpense.description || null,
          status: 'pending',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setExpenses(prev => [mapExpenseRow(data), ...prev]);
      }
      setNewExpense({
        title: '',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        category: DEFAULT_CATEGORIES[0],
        description: '',
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('経費の追加に失敗しました');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleAddMonthlyFinancial = async () => {
    if (!newFinancial.year || !newFinancial.month || !facilityId) return;
    setSavingFinancial(true);
    try {
      const now = new Date().toISOString();
      const revenueService = parseFloat(newFinancial.revenueService) || 0;
      const revenueOther = parseFloat(newFinancial.revenueOther) || 0;
      const expPersonnel = parseFloat(newFinancial.expensePersonnel) || 0;
      const expFixed = parseFloat(newFinancial.expenseFixed) || 0;
      const expVariable = parseFloat(newFinancial.expenseVariable) || 0;
      const expOther = parseFloat(newFinancial.expenseOther) || 0;
      const totalRevenue = revenueService + revenueOther;
      const totalExpense = expPersonnel + expFixed + expVariable + expOther;
      const grossProfit = totalRevenue - expPersonnel;
      const operatingProfit = totalRevenue - totalExpense;
      const netCashFlow = operatingProfit;

      const { data, error } = await supabase
        .from('monthly_financials')
        .insert({
          facility_id: facilityId,
          year: parseInt(newFinancial.year),
          month: parseInt(newFinancial.month),
          revenue_service: revenueService,
          revenue_other: revenueOther,
          expense_personnel: expPersonnel,
          expense_fixed: expFixed,
          expense_variable: expVariable,
          expense_other: expOther,
          gross_profit: grossProfit,
          operating_profit: operatingProfit,
          net_cash_flow: netCashFlow,
          notes: newFinancial.notes || null,
          is_finalized: false,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setFinancials(prev => {
          const updated = [mapFinancialRow(data), ...prev];
          updated.sort((a, b) => b.year - a.year || b.month - a.month);
          return updated;
        });
      }
      const resetDate = new Date();
      setNewFinancial({
        year: String(resetDate.getFullYear()),
        month: String(resetDate.getMonth() + 1),
        revenueService: '',
        revenueOther: '',
        expensePersonnel: '',
        expenseFixed: '',
        expenseVariable: '',
        expenseOther: '',
        notes: '',
      });
      setShowAddFinancialModal(false);
    } catch (error) {
      console.error('Error adding monthly financial:', error);
      alert('月次財務データの追加に失敗しました');
    } finally {
      setSavingFinancial(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">財務管理</h1>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          <Printer className="w-4 h-4" />
          月次レポート
        </button>
      </div>

      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00c4cc]/10 rounded-lg"><Wallet className="w-5 h-5 text-[#00c4cc]" /></div>
              <div>
                <p className="text-xs text-gray-500">月間売上 ({kpi.month}月)</p>
                <p className="text-xl font-bold text-gray-800">{formatCompactCurrency(kpi.revenue)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><Receipt className="w-5 h-5 text-red-500" /></div>
              <div>
                <p className="text-xs text-gray-500">月間経費</p>
                <p className="text-xl font-bold text-gray-800">{formatCompactCurrency(kpi.totalExpense)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <PiggyBank className={`w-5 h-5 ${kpi.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">純利益</p>
                <p className={`text-xl font-bold ${kpi.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatCompactCurrency(kpi.profit)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.revenueChange >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {kpi.revenueChange >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">前月比</p>
                <p className={`text-xl font-bold ${kpi.revenueChange >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {kpi.revenueChange >= 0 ? '+' : ''}{kpi.revenueChange.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Trend Chart (CSS-based) */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">月次推移（直近6ヶ月）</h2>
          <div className="flex items-end gap-3 h-32">
            {trendData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end justify-center h-24">
                  {/* Revenue bar */}
                  <div
                    className="flex-1 max-w-4 bg-[#00c4cc]/30 rounded-t-sm transition-all"
                    style={{ height: `${(d.revenue / trendMaxValue) * 100}%`, minHeight: d.revenue > 0 ? '2px' : '0' }}
                    title={`売上: ${formatCurrency(d.revenue)}`}
                  />
                  {/* Expense bar */}
                  <div
                    className="flex-1 max-w-4 bg-red-300/50 rounded-t-sm transition-all"
                    style={{ height: `${(d.expense / trendMaxValue) * 100}%`, minHeight: d.expense > 0 ? '2px' : '0' }}
                    title={`経費: ${formatCurrency(d.expense)}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#00c4cc]/30" /> 売上
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-300/50" /> 経費
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex gap-1">
        {([
          { id: 'expenses' as TabId, label: '経費管理' },
          { id: 'pl' as TabId, label: '損益計算書' },
          { id: 'cashflow' as TabId, label: 'キャッシュフロー' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-[#00c4cc] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <>
          {/* Expense Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">経費総額</p>
              <p className="text-xl font-bold text-gray-800">{formatCompactCurrency(expenseStats.total)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">承認済み</p>
              <p className="text-xl font-bold text-gray-800">{formatCompactCurrency(expenseStats.approved)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">申請中</p>
              <p className="text-2xl font-bold text-amber-600">{expenseStats.pending}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">カテゴリ数</p>
              <p className="text-2xl font-bold text-gray-800">{expenseStats.byCategory.size}</p>
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4">カテゴリ別内訳</h2>
              <div className="space-y-3">
                {categoryBreakdown.map(item => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center">{CATEGORY_ICONS[item.category] || '📋'}</span>
                    <span className="text-sm text-gray-700 w-24 flex-shrink-0">{item.category}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00c4cc] rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-800 w-24 text-right">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="タイトル・カテゴリで検索..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
            >
              <option value="all">全ステータス</option>
              {Object.entries(EXPENSE_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="amount">金額順</option>
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors"
            >
              <Plus className="w-4 h-4" />
              経費追加
            </button>
          </div>

          {/* Expense List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredExpenses.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
                  <Receipt className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 mb-2">
                  {expenses.length === 0 ? '経費がまだ登録されていません' : '条件に一致する経費がありません'}
                </p>
                {expenses.length === 0 && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    経費を追加
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredExpenses.map(exp => {
                  const sc = EXPENSE_STATUS_CONFIG[exp.status];
                  const StatusIcon = sc.icon;
                  return (
                    <div key={exp.id} className="p-4 hover:bg-gray-50/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        {/* Category icon */}
                        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-lg flex-shrink-0">
                          {CATEGORY_ICONS[exp.category] || '📋'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-gray-800 truncate">{exp.title}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 flex-shrink-0">
                              {exp.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{exp.expenseDate}</span>
                            {exp.description && <span className="truncate">{exp.description}</span>}
                          </div>
                        </div>

                        {/* Amount */}
                        <p className="text-base font-bold text-gray-800 flex-shrink-0">{formatCurrency(exp.amount)}</p>

                        {/* Status */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${sc.bg} ${sc.color} ${sc.border}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>

                        {/* Approve button */}
                        {exp.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(exp.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            承認
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* P&L Tab */}
      {activeTab === 'pl' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">損益計算書</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddFinancialModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#00c4cc] rounded-lg hover:bg-[#00b0b8] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                月次データ追加
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <Printer className="w-3.5 h-3.5" />
                印刷
              </button>
            </div>
          </div>
          {financials.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 mb-2">月次財務データがありません</p>
              <button
                onClick={() => setShowAddFinancialModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors mt-2"
              >
                <Plus className="w-4 h-4" />
                記録を作成
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">年月</th>
                    <th className="text-right p-3 font-medium text-gray-600">売上</th>
                    <th className="text-right p-3 font-medium text-gray-600">人件費</th>
                    <th className="text-right p-3 font-medium text-gray-600">固定費</th>
                    <th className="text-right p-3 font-medium text-gray-600">変動費</th>
                    <th className="text-right p-3 font-medium text-gray-600">粗利益</th>
                    <th className="text-right p-3 font-medium text-gray-600">営業利益</th>
                    <th className="text-center p-3 font-medium text-gray-600">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {financials.map(f => {
                    const totalRevenue = f.revenueService + f.revenueOther;
                    const isProfit = f.operatingProfit >= 0;
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{f.year}年{f.month}月</td>
                        <td className="p-3 text-right text-gray-800">{formatCurrency(totalRevenue)}</td>
                        <td className="p-3 text-right text-gray-600">{formatCurrency(f.expensePersonnel)}</td>
                        <td className="p-3 text-right text-gray-600">{formatCurrency(f.expenseFixed)}</td>
                        <td className="p-3 text-right text-gray-600">{formatCurrency(f.expenseVariable)}</td>
                        <td className="p-3 text-right text-gray-800">{formatCurrency(f.grossProfit)}</td>
                        <td className={`p-3 text-right font-medium ${isProfit ? 'text-emerald-700' : 'text-red-600'}`}>
                          <span className="inline-flex items-center gap-1">
                            {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {formatCurrency(f.operatingProfit)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            f.isFinalized
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}>
                            {f.isFinalized ? '確定' : '未確定'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">キャッシュフロー推移</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddFinancialModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#00c4cc] rounded-lg hover:bg-[#00b0b8] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                月次データ追加
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <Printer className="w-3.5 h-3.5" />
                印刷
              </button>
            </div>
          </div>
          {financials.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 mb-2">月次財務データがありません</p>
              <button
                onClick={() => setShowAddFinancialModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors mt-2"
              >
                <Plus className="w-4 h-4" />
                記録を作成
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">年月</th>
                    <th className="text-right p-3 font-medium text-gray-600">収入</th>
                    <th className="text-right p-3 font-medium text-gray-600">支出</th>
                    <th className="text-right p-3 font-medium text-gray-600">収支</th>
                    <th className="text-right p-3 font-medium text-gray-600">累計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(() => {
                    let cumulative = 0;
                    return [...financials].reverse().map(f => {
                      const totalRevenue = f.revenueService + f.revenueOther;
                      const totalExpense = f.expensePersonnel + f.expenseFixed + f.expenseVariable + f.expenseOther;
                      const cashFlow = totalRevenue - totalExpense;
                      cumulative += cashFlow;
                      const isPositive = cashFlow >= 0;
                      const isCumPositive = cumulative >= 0;
                      return (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-800">{f.year}年{f.month}月</td>
                          <td className="p-3 text-right text-gray-800">{formatCurrency(totalRevenue)}</td>
                          <td className="p-3 text-right text-gray-600">{formatCurrency(totalExpense)}</td>
                          <td className={`p-3 text-right font-medium ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                            <span className="inline-flex items-center gap-1">
                              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {formatCurrency(cashFlow)}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-medium ${isCumPositive ? 'text-gray-800' : 'text-red-600'}`}>
                            {formatCurrency(cumulative)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Monthly Financial Modal */}
      {showAddFinancialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">月次財務データを追加</h2>
              <button onClick={() => setShowAddFinancialModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    年 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={newFinancial.year}
                    onChange={e => setNewFinancial(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                    placeholder="2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    月 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={newFinancial.month}
                    onChange={e => setNewFinancial(prev => ({ ...prev, month: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}月</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">収入</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">サービス収入</label>
                    <input
                      type="number"
                      value={newFinancial.revenueService}
                      onChange={e => setNewFinancial(prev => ({ ...prev, revenueService: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">その他収入</label>
                    <input
                      type="number"
                      value={newFinancial.revenueOther}
                      onChange={e => setNewFinancial(prev => ({ ...prev, revenueOther: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">支出</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">人件費</label>
                    <input
                      type="number"
                      value={newFinancial.expensePersonnel}
                      onChange={e => setNewFinancial(prev => ({ ...prev, expensePersonnel: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">固定費</label>
                    <input
                      type="number"
                      value={newFinancial.expenseFixed}
                      onChange={e => setNewFinancial(prev => ({ ...prev, expenseFixed: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">変動費</label>
                    <input
                      type="number"
                      value={newFinancial.expenseVariable}
                      onChange={e => setNewFinancial(prev => ({ ...prev, expenseVariable: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">その他経費</label>
                    <input
                      type="number"
                      value={newFinancial.expenseOther}
                      onChange={e => setNewFinancial(prev => ({ ...prev, expenseOther: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={newFinancial.notes}
                  onChange={e => setNewFinancial(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  placeholder="補足メモ..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddFinancialModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddMonthlyFinancial}
                disabled={!newFinancial.year || !newFinancial.month || savingFinancial}
                className="px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingFinancial ? '保存中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">経費を追加</h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newExpense.title}
                  onChange={e => setNewExpense(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  placeholder="経費の名称"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    金額 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={e => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={newExpense.expenseDate}
                    onChange={e => setNewExpense(prev => ({ ...prev, expenseDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <select
                  value={newExpense.category}
                  onChange={e => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                >
                  {DEFAULT_CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_ICONS[c] || ''} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={newExpense.description}
                  onChange={e => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  placeholder="補足説明..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddExpense}
                disabled={!newExpense.title || !newExpense.amount || savingExpense}
                className="px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingExpense ? '保存中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
