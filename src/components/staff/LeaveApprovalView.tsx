/**
 * LeaveApprovalView - 休暇申請承認画面（管理側）
 * 管理者がスタッフの休暇申請を承認・却下する
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  User,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Minus,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LeaveRequestType, LEAVE_REQUEST_TYPE_LABELS } from '@/types';

// --- 型定義 ---

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface LeaveRequestRow {
  id: string;
  user_id: string;
  facility_id: string;
  request_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // JOINで取得
  user_name?: string;
}

// --- ステータス設定 ---

const STATUS_CONFIG: Record<
  LeaveStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType; borderStyle: string; fontWeight: string }
> = {
  pending: { label: '申請中', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Clock, borderStyle: 'border-l-2 border-l-gray-300', fontWeight: 'font-normal' },
  approved: { label: '承認済', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: CheckCircle, borderStyle: 'border-l-2 border-l-gray-500', fontWeight: 'font-semibold' },
  rejected: { label: '却下', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: XCircle, borderStyle: 'border-l-2 border-l-gray-300 border-dashed', fontWeight: 'font-normal' },
  cancelled: { label: '取消', color: 'text-gray-400', bgColor: 'bg-gray-50', icon: Minus, borderStyle: 'border-l-2 border-l-gray-200', fontWeight: 'font-normal' },
};

// --- ヘルパー ---

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateRange = (start: string, end: string): string => {
  if (start === end) return formatDate(start);
  return `${formatDate(start)} - ${formatDate(end)}`;
};

// --- メインコンポーネント ---

export default function LeaveApprovalView() {
  const { user: authUser, facility } = useAuth();
  const facilityId = facility?.id || '';

  // データ
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // フィルター
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // 展開
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 却下理由モーダル
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // --- データ取得 ---

  const fetchRequests = useCallback(async () => {
    if (!facilityId) return;

    setLoading(true);
    try {
      // leave_requests を取得し、users テーブルから名前をJOIN
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          users!leave_requests_user_id_fkey ( name, last_name, first_name )
        `)
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (error) {
        // JOINが失敗した場合はフォールバック
        console.warn('JOIN取得失敗、フォールバック:', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (fallbackError) {
          console.error('休暇申請取得エラー:', fallbackError);
          return;
        }

        if (fallbackData) {
          // ユーザー名を別途取得
          const userIds = [...new Set(fallbackData.map((r: LeaveRequestRow) => r.user_id))];
          const { data: usersData } = await supabase
            .from('users')
            .select('id, name, last_name, first_name')
            .in('id', userIds);

          const userMap = new Map<string, string>();
          usersData?.forEach((u: { id: string; name: string; last_name?: string; first_name?: string }) => {
            const displayName =
              u.last_name && u.first_name ? `${u.last_name} ${u.first_name}` : u.name || '不明';
            userMap.set(u.id, displayName);
          });

          setRequests(
            fallbackData.map((r: LeaveRequestRow) => ({
              ...r,
              user_name: userMap.get(r.user_id) || '不明',
            }))
          );
        }
        return;
      }

      if (data) {
        setRequests(
          data.map((r: any) => {
            const userInfo = r.users;
            const displayName = userInfo
              ? userInfo.last_name && userInfo.first_name
                ? `${userInfo.last_name} ${userInfo.first_name}`
                : userInfo.name || '不明'
              : '不明';
            return {
              ...r,
              users: undefined,
              user_name: displayName,
            } as LeaveRequestRow;
          })
        );
      }
    } catch (error) {
      console.error('休暇申請取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // --- 統計 ---

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    const total = requests.length;
    return { pending, approved, rejected, total };
  }, [requests]);

  // --- フィルタリング ---

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nameMatch = r.user_name?.toLowerCase().includes(term) || false;
        const typeMatch = LEAVE_REQUEST_TYPE_LABELS[r.request_type]?.includes(searchTerm) || false;
        const reasonMatch = r.reason?.toLowerCase().includes(term) || false;
        if (!nameMatch && !typeMatch && !reasonMatch) return false;
      }
      return true;
    });
  }, [requests, statusFilter, searchTerm]);

  // --- 承認 ---

  const handleApprove = async (requestId: string) => {
    if (!authUser) return;
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: authUser.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('facility_id', facilityId);

      if (error) {
        console.error('承認エラー:', error);
        alert('承認に失敗しました');
        return;
      }

      await fetchRequests();
    } catch (error) {
      console.error('承認エラー:', error);
      alert('承認に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  // --- 却下 ---

  const handleReject = async () => {
    if (!authUser || !rejectModalId) return;
    setProcessing(rejectModalId);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: authUser.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectModalId)
        .eq('facility_id', facilityId);

      if (error) {
        console.error('却下エラー:', error);
        alert('却下に失敗しました');
        return;
      }

      setRejectModalId(null);
      setRejectionReason('');
      await fetchRequests();
    } catch (error) {
      console.error('却下エラー:', error);
      alert('却下に失敗しました');
    } finally {
      setProcessing(null);
    }
  };

  // --- ローディング ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-[#00c4cc]" />
        <h1 className="text-xl font-bold text-gray-800">休暇申請管理</h1>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">全申請</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">承認待ち</p>
          <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">承認済み</p>
          <p className="text-2xl font-bold text-gray-800">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">却下</p>
          <p className="text-2xl font-bold text-gray-800">{stats.rejected}</p>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="スタッフ名・申請種別・理由で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-10 pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] transition-all duration-200"
            />
          </div>
        </div>
        {/* クイックフィルタ pills */}
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { key: 'pending', label: '未承認', count: stats.pending },
              { key: 'approved', label: '承認済', count: stats.approved },
              { key: 'rejected', label: '却下', count: stats.rejected },
              { key: 'all', label: '全て', count: stats.total },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`min-h-10 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                statusFilter === item.key
                  ? 'bg-[#00c4cc] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.label}
              <span className="ml-1.5 opacity-80">({item.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 申請一覧 */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {requests.length === 0
                ? '休暇申請がまだありません'
                : '条件に一致する申請がありません'}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const statusConf = STATUS_CONFIG[request.status];
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === request.id;
            const isProcessing = processing === request.id;

            return (
              <div
                key={request.id}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${statusConf.borderStyle}`}
              >
                {/* メイン行 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100"
                  >
                    <StatusIcon size={16} className="text-gray-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-gray-800 text-sm">
                        <User size={14} className="text-gray-400" />
                        {request.user_name || '不明'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                        {LEAVE_REQUEST_TYPE_LABELS[request.request_type]}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusConf.fontWeight} bg-gray-100 ${statusConf.color}`}
                      >
                        <StatusIcon size={10} />
                        {statusConf.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateRange(request.start_date, request.end_date)}
                      <span className="ml-2">({request.days_count}日)</span>
                      <span className="ml-2">
                        申請: {formatDate(request.created_at)}
                      </span>
                    </p>
                  </div>

                  {/* 承認待ちの場合はクイックアクション */}
                  {request.status === 'pending' && !isExpanded && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(request.id);
                        }}
                        disabled={isProcessing}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        title="承認"
                      >
                        <CheckCircle size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectModalId(request.id);
                        }}
                        disabled={isProcessing}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        title="却下"
                      >
                        <XCircle size={20} />
                      </button>
                    </div>
                  )}

                  {isExpanded ? (
                    <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* 詳細 */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">スタッフ</span>
                        <p className="font-medium text-gray-800">{request.user_name || '不明'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">申請種別</span>
                        <p className="font-medium text-gray-800">
                          {LEAVE_REQUEST_TYPE_LABELS[request.request_type]}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">日数</span>
                        <p className="font-medium text-gray-800">{request.days_count}日</p>
                      </div>
                      <div>
                        <span className="text-gray-500">開始日</span>
                        <p className="font-medium text-gray-800">
                          {formatDate(request.start_date)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">終了日</span>
                        <p className="font-medium text-gray-800">
                          {formatDate(request.end_date)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">申請日</span>
                        <p className="font-medium text-gray-800">
                          {formatDate(request.created_at)}
                        </p>
                      </div>
                    </div>

                    {request.reason && (
                      <div className="text-sm">
                        <span className="text-gray-500">理由</span>
                        <p className="font-medium text-gray-800 mt-0.5">{request.reason}</p>
                      </div>
                    )}

                    {request.rejection_reason && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        <span className="text-gray-600 font-medium">却下理由:</span>
                        <p className="text-gray-700 mt-0.5">{request.rejection_reason}</p>
                      </div>
                    )}

                    {request.approved_at && (
                      <p className="text-xs text-gray-500">
                        処理日時: {formatDate(request.approved_at)}
                      </p>
                    )}

                    {/* アクションボタン（承認待ちのみ） */}
                    {request.status === 'pending' && (
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <CheckCircle size={16} />
                          )}
                          承認する
                        </button>
                        <button
                          onClick={() => setRejectModalId(request.id)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          却下する
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 却下理由モーダル */}
      {rejectModalId && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => {
              setRejectModalId(null);
              setRejectionReason('');
            }}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 z-50 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={20} className="text-gray-500" />
              <h3 className="text-lg font-bold text-gray-800">却下理由</h3>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              却下の理由を入力してください（任意）
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none text-sm"
              placeholder="却下理由を入力..."
              autoFocus
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectModalId(null);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                disabled={processing === rejectModalId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {processing === rejectModalId ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <XCircle size={16} />
                )}
                却下する
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
