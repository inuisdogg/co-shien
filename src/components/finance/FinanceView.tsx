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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseStatus, MonthlyFinancial } from '@/types/expense';

const EXPENSE_STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending: { label: '申請中', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
  approved: { label: '承認済', color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle },
  rejected: { label: '却下', color: 'text-gray-500', bg: 'bg-gray-100', icon: XCircle },
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

export default function FinanceView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [activeTab, setActiveTab] = useState<TabId>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [financials, setFinancials] = useState<MonthlyFinancial[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    return expenses.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (searchTerm && !e.title.includes(searchTerm) && !e.category.includes(searchTerm)) return false;
      return true;
    });
  }, [expenses, statusFilter, searchTerm]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-[#00c4cc]" />
        <h1 className="text-xl font-bold text-gray-800">財務管理</h1>
      </div>

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
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-sm text-gray-500">経費総額</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(expenseStats.total)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-sm text-gray-500">承認済み</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(expenseStats.approved)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-sm text-gray-500">申請中</p>
              <p className="text-2xl font-bold text-gray-800">{expenseStats.pending}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-sm text-gray-500">カテゴリ数</p>
              <p className="text-2xl font-bold text-gray-800">{expenseStats.byCategory.size}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="タイトル・カテゴリで検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="all">全ステータス</option>
              {Object.entries(EXPENSE_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Expense List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {expenses.length === 0 ? '経費がまだ登録されていません' : '条件に一致する経費がありません'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredExpenses.map(exp => {
                  const sc = EXPENSE_STATUS_CONFIG[exp.status];
                  const StatusIcon = sc.icon;
                  return (
                    <div key={exp.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">{exp.title}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{exp.category}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span>{exp.expenseDate}</span>
                            {exp.description && <span className="line-clamp-1">{exp.description}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-gray-800">{formatCurrency(exp.amount)}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${sc.bg} ${sc.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {sc.label}
                          </span>
                          {exp.status === 'pending' && (
                            <button onClick={() => handleApprove(exp.id)} className="text-xs px-3 py-1 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8]">承認</button>
                          )}
                        </div>
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
          {financials.length === 0 ? (
            <div className="p-8 text-center text-gray-500">月次財務データがありません</div>
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
                        <td className="p-3 text-right font-medium text-gray-800">
                          <span className="inline-flex items-center gap-1">
                            {isProfit ? <TrendingUp className="w-3.5 h-3.5 text-gray-500" /> : <TrendingDown className="w-3.5 h-3.5 text-gray-500" />}
                            {formatCurrency(f.operatingProfit)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${f.isFinalized ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>
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
          {financials.length === 0 ? (
            <div className="p-8 text-center text-gray-500">月次財務データがありません</div>
          ) : (
            <>
              {/* Cash Flow Summary */}
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">キャッシュフロー推移</h2>
              </div>
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
                        return (
                          <tr key={f.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-800">{f.year}年{f.month}月</td>
                            <td className="p-3 text-right text-gray-800">{formatCurrency(totalRevenue)}</td>
                            <td className="p-3 text-right text-gray-600">{formatCurrency(totalExpense)}</td>
                            <td className="p-3 text-right font-medium text-gray-800">
                              {formatCurrency(cashFlow)}
                            </td>
                            <td className="p-3 text-right font-medium text-gray-800">
                              {formatCurrency(cumulative)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
