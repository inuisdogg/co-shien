'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Download, ChevronLeft, ChevronRight, Filter, Calendar, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface AuditLog {
  id: string;
  facility_id: string | null;
  user_id: string | null;
  user_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: '作成',
  update: '更新',
  delete: '削除',
  login: 'ログイン',
  logout: 'ログアウト',
  export: 'エクスポート',
  view_sensitive: '閲覧',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-gray-100 text-gray-700',
  logout: 'bg-gray-100 text-gray-600',
  export: 'bg-purple-100 text-purple-700',
  view_sensitive: 'bg-amber-100 text-amber-700',
};

const RESOURCE_LABELS: Record<string, string> = {
  child: '児童',
  staff: 'スタッフ',
  usage_record: '利用記録',
  support_plan: '支援計画',
  billing: '請求',
  settings: '設定',
  user: 'ユーザー',
  document: '書類',
};

const RESOURCE_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'child', label: '児童' },
  { value: 'staff', label: 'スタッフ' },
  { value: 'usage_record', label: '利用記録' },
  { value: 'support_plan', label: '支援計画' },
  { value: 'billing', label: '請求' },
  { value: 'settings', label: '設定' },
  { value: 'user', label: 'ユーザー' },
  { value: 'document', label: '書類' },
];

const PAGE_SIZE = 50;

export default function AuditLogView() {
  const { facility } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch distinct users who appear in audit logs
  useEffect(() => {
    if (!facility?.id) return;
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('user_id, user_name')
        .eq('facility_id', facility.id)
        .not('user_id', 'is', null)
        .not('user_name', 'is', null);
      if (data) {
        const uniqueMap = new Map<string, string>();
        data.forEach((row: { user_id: string | null; user_name: string | null }) => {
          if (row.user_id && row.user_name) {
            uniqueMap.set(row.user_id, row.user_name);
          }
        });
        setUsers(Array.from(uniqueMap.entries()).map(([id, name]) => ({ id, name })));
      }
    };
    fetchUsers();
  }, [facility?.id]);

  const fetchLogs = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }
      if (resourceTypeFilter) {
        query = query.eq('resource_type', resourceTypeFilter);
      }
      if (userFilter) {
        query = query.eq('user_id', userFilter);
      }

      const { data, count, error } = await query;
      if (error) {
        console.error('Failed to fetch audit logs:', error);
        return;
      }
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, [facility?.id, page, dateFrom, dateTo, resourceTypeFilter, userFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = ['日時', 'ユーザー', '操作', '対象', 'リソースID', '詳細'];
    const rows = logs.map(log => [
      new Date(log.created_at).toLocaleString('ja-JP'),
      log.user_name || '-',
      ACTION_LABELS[log.action] || log.action,
      RESOURCE_LABELS[log.resource_type] || log.resource_type,
      log.resource_id || '-',
      log.details ? JSON.stringify(log.details) : '-',
    ]);

    const bom = '\uFEFF';
    const csvContent = bom + [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setResourceTypeFilter('');
    setUserFilter('');
    setPage(0);
  };

  const formatDetails = (details: Record<string, unknown> | null): string => {
    if (!details) return '-';
    if (details.field && (details.old !== undefined || details.new !== undefined)) {
      return `${details.field}: ${details.old ?? '(なし)'} -> ${details.new ?? '(なし)'}`;
    }
    return JSON.stringify(details);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00c4cc]/10 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#00c4cc]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">監査ログ</h1>
            <p className="text-sm text-gray-500">操作履歴の確認とエクスポート</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition-colors ${
              showFilters ? 'bg-[#00c4cc]/10 border-[#00c4cc] text-[#00c4cc]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            フィルター
          </button>
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                開始日
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                終了日
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                <Filter className="w-3 h-3 inline mr-1" />
                対象タイプ
              </label>
              <select
                value={resourceTypeFilter}
                onChange={(e) => { setResourceTypeFilter(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              >
                {RESOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                <User className="w-3 h-3 inline mr-1" />
                ユーザー
              </label>
              <select
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              >
                <option value="">すべて</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleResetFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              フィルターをリセット
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent border-[#00c4cc] rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">監査ログはまだありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">日時</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">ユーザー</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">操作</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">対象</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">詳細</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                      {log.user_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {RESOURCE_LABELS[log.resource_type] || log.resource_type}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {formatDetails(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              {totalCount}件中 {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)}件表示
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 font-medium">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
