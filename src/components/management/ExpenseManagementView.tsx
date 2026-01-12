/**
 * 経費管理ビュー（管理者用）
 * 経費申請の承認・却下、月次サマリー表示
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  Search,
  Eye,
  Check,
  X,
  AlertCircle,
  User,
  Calendar,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseStatus, ExpenseSummary, ExpenseApprovalStats } from '@/types/expense';
import { getCategoryInfo, DEFAULT_EXPENSE_CATEGORIES } from '@/constants/expenseCategories';

type Props = {
  facilityId: string;
  approverId: string;
  approverName: string;
};

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all';

export default function ExpenseManagementView({ facilityId, approverId, approverName }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('pending');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [stats, setStats] = useState<ExpenseApprovalStats | null>(null);
  const [categorySummary, setCategorySummary] = useState<ExpenseSummary[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 経費一覧を取得
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      let query = supabase
        .from('expenses')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('created_at', { ascending: false });

      if (activeFilter !== 'all') {
        query = query.eq('status', activeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedExpenses = (data || []).map(row => ({
        id: row.id,
        facilityId: row.facility_id,
        staffId: row.staff_id,
        submittedByUserId: row.submitted_by_user_id,
        title: row.title,
        amount: Number(row.amount),
        expenseDate: row.expense_date,
        category: row.category,
        subcategory: row.subcategory,
        description: row.description,
        receiptUrl: row.receipt_url,
        receiptFileName: row.receipt_file_name,
        receiptFileSize: row.receipt_file_size,
        status: row.status as ExpenseStatus,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        rejectionReason: row.rejection_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        staffName: row.staff_name,
      }));

      setExpenses(mappedExpenses);
    } catch (err) {
      console.error('経費取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId, selectedMonth, activeFilter]);

  // 統計情報を取得
  const fetchStats = useCallback(async () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('expenses')
        .select('status, amount')
        .eq('facility_id', facilityId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (error) throw error;

      const statsData: ExpenseApprovalStats = {
        total: data.length,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalAmount: 0,
        approvedAmount: 0,
        pendingAmount: 0,
      };

      data.forEach(row => {
        const amount = Number(row.amount);
        statsData.totalAmount += amount;

        if (row.status === 'pending') {
          statsData.pending++;
          statsData.pendingAmount += amount;
        } else if (row.status === 'approved') {
          statsData.approved++;
          statsData.approvedAmount += amount;
        } else if (row.status === 'rejected') {
          statsData.rejected++;
        }
      });

      setStats(statsData);
    } catch (err) {
      console.error('統計取得エラー:', err);
    }
  }, [facilityId, selectedMonth]);

  // カテゴリ別サマリーを取得
  const fetchCategorySummary = useCallback(async () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('expenses')
        .select('category, status, amount')
        .eq('facility_id', facilityId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (error) throw error;

      const summaryMap = new Map<string, ExpenseSummary>();

      data.forEach(row => {
        const amount = Number(row.amount);
        const existing = summaryMap.get(row.category) || {
          category: row.category,
          categoryName: getCategoryInfo(row.category)?.name || row.category,
          count: 0,
          totalAmount: 0,
          approvedCount: 0,
          approvedAmount: 0,
          pendingCount: 0,
          pendingAmount: 0,
        };

        existing.count++;
        existing.totalAmount += amount;

        if (row.status === 'approved') {
          existing.approvedCount++;
          existing.approvedAmount += amount;
        } else if (row.status === 'pending') {
          existing.pendingCount++;
          existing.pendingAmount += amount;
        }

        summaryMap.set(row.category, existing);
      });

      setCategorySummary(Array.from(summaryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount));
    } catch (err) {
      console.error('カテゴリサマリー取得エラー:', err);
    }
  }, [facilityId, selectedMonth]);

  useEffect(() => {
    fetchExpenses();
    fetchStats();
    fetchCategorySummary();
  }, [fetchExpenses, fetchStats, fetchCategorySummary]);

  // 経費を承認
  const approveExpense = async (expenseId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;

      await fetchExpenses();
      await fetchStats();
      await fetchCategorySummary();
    } catch (err) {
      console.error('承認エラー:', err);
      alert('承認に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  // 経費を却下
  const rejectExpense = async (expenseId: string, reason: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;

      setShowRejectModal(null);
      setRejectionReason('');
      await fetchExpenses();
      await fetchStats();
      await fetchCategorySummary();
    } catch (err) {
      console.error('却下エラー:', err);
      alert('却下に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  // 一括承認
  const bulkApprove = async () => {
    if (selectedExpenses.size === 0) return;
    if (!confirm(`${selectedExpenses.size}件の経費を一括承認しますか？`)) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', Array.from(selectedExpenses));

      if (error) throw error;

      setSelectedExpenses(new Set());
      await fetchExpenses();
      await fetchStats();
      await fetchCategorySummary();
    } catch (err) {
      console.error('一括承認エラー:', err);
      alert('一括承認に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  // CSVエクスポート
  const exportCSV = () => {
    const headers = ['日付', 'タイトル', 'カテゴリ', '金額', 'ステータス', '申請者', '説明'];
    const rows = expenses.map(exp => [
      exp.expenseDate,
      exp.title,
      getCategoryInfo(exp.category)?.name || exp.category,
      exp.amount.toString(),
      exp.status === 'pending' ? '承認待ち' : exp.status === 'approved' ? '承認済み' : '却下',
      exp.staffName || '-',
      exp.description || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `経費一覧_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // フィルタリング
  const filteredExpenses = expenses.filter(exp => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      exp.title.toLowerCase().includes(q) ||
      exp.description?.toLowerCase().includes(q) ||
      exp.staffName?.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  };

  const getStatusBadge = (status: ExpenseStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            承認待ち
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            承認済み
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            却下
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">経費管理</h2>
            <p className="text-sm text-gray-500">経費申請の承認・管理</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        </div>
      </div>

      {/* 統計カード */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Receipt className="w-4 h-4" />
              総申請数
            </div>
            <div className="text-2xl font-bold text-gray-800">{stats.total}件</div>
            <div className="text-sm text-gray-500">{formatCurrency(stats.totalAmount)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
              <Clock className="w-4 h-4" />
              承認待ち
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}件</div>
            <div className="text-sm text-gray-500">{formatCurrency(stats.pendingAmount)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              承認済み
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.approved}件</div>
            <div className="text-sm text-gray-500">{formatCurrency(stats.approvedAmount)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
              <XCircle className="w-4 h-4" />
              却下
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}件</div>
          </div>
        </div>
      )}

      {/* カテゴリ別サマリー */}
      {categorySummary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-gray-800 mb-3">カテゴリ別サマリー</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categorySummary.slice(0, 8).map(cat => {
              const info = getCategoryInfo(cat.category);
              return (
                <div
                  key={cat.category}
                  className={`p-3 rounded-lg ${info?.tailwindBg || 'bg-gray-100'}`}
                >
                  <div className={`text-sm font-bold ${info?.tailwindText || 'text-gray-700'}`}>
                    {cat.categoryName}
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {formatCurrency(cat.totalAmount)}
                  </div>
                  <div className="text-xs text-gray-500">{cat.count}件</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* フィルタータブ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                activeFilter === tab
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'pending' && '承認待ち'}
              {tab === 'approved' && '承認済み'}
              {tab === 'rejected' && '却下'}
              {tab === 'all' && 'すべて'}
              {tab === 'pending' && stats && stats.pending > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="検索..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {activeFilter === 'pending' && selectedExpenses.size > 0 && (
            <button
              onClick={bulkApprove}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {selectedExpenses.size}件を一括承認
            </button>
          )}
        </div>
      </div>

      {/* 経費一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Receipt className="w-12 h-12 mb-2 opacity-50" />
            <p>経費申請がありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredExpenses.map(expense => {
              const isExpanded = expandedExpenseId === expense.id;
              const categoryInfo = getCategoryInfo(expense.category);

              return (
                <div key={expense.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {activeFilter === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedExpenses.has(expense.id)}
                        onChange={e => {
                          const newSet = new Set(selectedExpenses);
                          if (e.target.checked) {
                            newSet.add(expense.id);
                          } else {
                            newSet.delete(expense.id);
                          }
                          setSelectedExpenses(newSet);
                        }}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                    )}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        categoryInfo?.tailwindBg || 'bg-gray-100'
                      }`}
                    >
                      <Receipt className={`w-5 h-5 ${categoryInfo?.tailwindText || 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{expense.title}</span>
                        {getStatusBadge(expense.status)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {expense.expenseDate}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${categoryInfo?.tailwindBg || 'bg-gray-100'} ${categoryInfo?.tailwindText || 'text-gray-600'}`}>
                          {categoryInfo?.name || expense.category}
                        </span>
                        {expense.staffName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {expense.staffName}
                          </span>
                        )}
                      </div>
                      {expense.description && (
                        <p className="text-sm text-gray-500 mt-1 truncate">{expense.description}</p>
                      )}
                      {expense.status === 'rejected' && expense.rejectionReason && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          却下理由: {expense.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-800">
                        {formatCurrency(expense.amount)}
                      </div>
                      {expense.status === 'pending' && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => approveExpense(expense.id)}
                            disabled={processing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            承認
                          </button>
                          <button
                            onClick={() => setShowRejectModal(expense.id)}
                            disabled={processing}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            却下
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedExpenseId(isExpanded ? null : expense.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* 展開時の詳細 */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 ml-13">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">申請日時:</span>
                          <span className="ml-2 text-gray-800">
                            {new Date(expense.createdAt).toLocaleString('ja-JP')}
                          </span>
                        </div>
                        {expense.approvedAt && (
                          <div>
                            <span className="text-gray-500">
                              {expense.status === 'approved' ? '承認日時:' : '却下日時:'}
                            </span>
                            <span className="ml-2 text-gray-800">
                              {new Date(expense.approvedAt).toLocaleString('ja-JP')}
                            </span>
                          </div>
                        )}
                      </div>
                      {expense.receiptUrl && (
                        <div className="mt-3">
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            領収書を見る
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 却下モーダル */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">経費申請を却下</h3>
            </div>
            <div className="p-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">却下理由</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="却下理由を入力してください"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => rejectExpense(showRejectModal, rejectionReason)}
                disabled={processing || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                却下する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
