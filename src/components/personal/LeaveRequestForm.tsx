/**
 * LeaveRequestForm - 有給休暇申請フォーム（個人側）
 * スタッフが自分の休暇申請を作成・管理する
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LeaveRequestType, LEAVE_REQUEST_TYPE_LABELS } from '@/types';

// --- 型定義 ---

interface LeaveRequestRow {
  id: string;
  user_id: string;
  facility_id: string;
  request_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface PaidLeaveBalance {
  id: string;
  user_id: string;
  facility_id: string;
  fiscal_year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  granted_date: string | null;
  expires_date: string | null;
}

interface LeaveRequestFormProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onClose?: () => void;
}

// --- ステータス設定 ---

const STATUS_CONFIG: Record<
  LeaveRequestRow['status'],
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  pending: { label: '承認待ち', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
  approved: { label: '承認済み', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  rejected: { label: '却下', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  cancelled: { label: 'キャンセル', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: X },
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

const getCurrentFiscalYear = (): number => {
  const now = new Date();
  // 日本の会計年度: 4月始まり
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const calcDaysCount = (start: string, end: string, requestType: LeaveRequestType): number => {
  if (requestType === 'half_day_am' || requestType === 'half_day_pm') {
    return 0.5;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
};

// --- メインコンポーネント ---

export default function LeaveRequestForm({
  userId,
  facilityId,
  facilityName,
  onClose,
}: LeaveRequestFormProps) {
  // データ
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [balance, setBalance] = useState<PaidLeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // フォーム
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    request_type: 'paid_leave' as LeaveRequestType,
    start_date: getTodayString(),
    end_date: getTodayString(),
    reason: '',
  });
  const [formError, setFormError] = useState('');

  // フィルター
  const [statusFilter, setStatusFilter] = useState<LeaveRequestRow['status'] | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // キャンセル確認
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // --- データ取得 ---

  const fetchData = useCallback(async () => {
    if (!userId || !facilityId) return;

    setLoading(true);
    try {
      // 休暇申請一覧を取得
      const { data: requestsData, error: requestsError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('休暇申請取得エラー:', requestsError);
      } else if (requestsData) {
        setRequests(requestsData);
      }

      // 有給残日数を取得
      const fiscalYear = getCurrentFiscalYear();
      const { data: balanceData, error: balanceError } = await supabase
        .from('paid_leave_balances')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .eq('fiscal_year', fiscalYear)
        .maybeSingle();

      if (balanceError) {
        console.error('有給残日数取得エラー:', balanceError);
      } else if (balanceData) {
        setBalance(balanceData);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, facilityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 統計 ---

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    return { pending, approved, rejected };
  }, [requests]);

  // --- フィルタリング ---

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  // --- フォームのバリデーション ---

  const validateForm = (): boolean => {
    if (!formData.start_date) {
      setFormError('開始日を入力してください');
      return false;
    }
    if (!formData.end_date) {
      setFormError('終了日を入力してください');
      return false;
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setFormError('終了日は開始日以降を指定してください');
      return false;
    }
    // 半休の場合は同日のみ
    if (
      (formData.request_type === 'half_day_am' || formData.request_type === 'half_day_pm') &&
      formData.start_date !== formData.end_date
    ) {
      setFormError('半休は1日のみ指定可能です');
      return false;
    }
    // 有給系の場合、残日数チェック
    if (
      balance &&
      (formData.request_type === 'paid_leave' ||
        formData.request_type === 'half_day_am' ||
        formData.request_type === 'half_day_pm')
    ) {
      const daysNeeded = calcDaysCount(formData.start_date, formData.end_date, formData.request_type);
      if (daysNeeded > balance.remaining_days) {
        setFormError(`有給残日数が不足しています（残: ${balance.remaining_days}日、申請: ${daysNeeded}日）`);
        return false;
      }
    }
    setFormError('');
    return true;
  };

  // --- 申請送信 ---

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const daysCount = calcDaysCount(formData.start_date, formData.end_date, formData.request_type);

      const { error } = await supabase.from('leave_requests').insert({
        user_id: userId,
        facility_id: facilityId,
        request_type: formData.request_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days_count: daysCount,
        reason: formData.reason || null,
        status: 'pending',
      });

      if (error) {
        console.error('休暇申請エラー:', error);
        setFormError('申請に失敗しました。もう一度お試しください。');
        return;
      }

      // リセット
      setFormData({
        request_type: 'paid_leave',
        start_date: getTodayString(),
        end_date: getTodayString(),
        reason: '',
      });
      setShowForm(false);
      setFormError('');
      await fetchData();
    } catch (error) {
      console.error('休暇申請エラー:', error);
      setFormError('申請に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  // --- キャンセル ---

  const handleCancel = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('user_id', userId);

      if (error) {
        console.error('キャンセルエラー:', error);
        alert('キャンセルに失敗しました');
        return;
      }

      setCancellingId(null);
      await fetchData();
    } catch (error) {
      console.error('キャンセルエラー:', error);
      alert('キャンセルに失敗しました');
    }
  };

  // --- 計算された日数 ---

  const calculatedDays = useMemo(() => {
    return calcDaysCount(formData.start_date, formData.end_date, formData.request_type);
  }, [formData.start_date, formData.end_date, formData.request_type]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#00c4cc]" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">休暇申請</h2>
            <p className="text-sm text-gray-500">{facilityName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              新規申請
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 有給残日数カード */}
      {balance && (
        <div className="bg-gradient-to-br from-[#00c4cc]/5 to-[#00c4cc]/10 rounded-xl p-5 border border-[#00c4cc]/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#00c4cc]">
              {balance.fiscal_year}年度 有給休暇残日数
            </span>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <span className="text-4xl font-bold text-[#00c4cc]">{balance.remaining_days}</span>
              <span className="text-[#00c4cc] ml-1">日</span>
            </div>
            <div className="flex gap-4 text-sm text-[#00c4cc] pb-1">
              <span>付与: {balance.total_days}日</span>
              <span>使用: {balance.used_days}日</span>
            </div>
          </div>
          {balance.expires_date && (
            <p className="text-xs text-[#00c4cc] mt-2">
              有効期限: {formatDate(balance.expires_date)}
            </p>
          )}
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
          <p className="text-xs text-gray-500">承認待ち</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
          <p className="text-xs text-gray-500">承認済み</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
          <p className="text-xs text-gray-500">却下</p>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      {/* 新規申請フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-[#00c4cc]" />
              新規休暇申請
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError('');
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {/* 申請種別 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申請種別</label>
              <select
                value={formData.request_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    request_type: e.target.value as LeaveRequestType,
                    // 半休時は終了日を開始日に合わせる
                    end_date:
                      e.target.value === 'half_day_am' || e.target.value === 'half_day_pm'
                        ? formData.start_date
                        : formData.end_date,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
              >
                {Object.entries(LEAVE_REQUEST_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 期間 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      start_date: e.target.value,
                      end_date:
                        formData.request_type === 'half_day_am' ||
                        formData.request_type === 'half_day_pm'
                          ? e.target.value
                          : formData.end_date < e.target.value
                            ? e.target.value
                            : formData.end_date,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                <input
                  type="date"
                  value={formData.end_date}
                  min={formData.start_date}
                  disabled={
                    formData.request_type === 'half_day_am' ||
                    formData.request_type === 'half_day_pm'
                  }
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* 日数表示 */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Clock size={14} className="text-gray-500" />
              <span className="text-sm text-gray-600">
                申請日数: <span className="font-bold text-gray-800">{calculatedDays}日</span>
              </span>
              {balance &&
                (formData.request_type === 'paid_leave' ||
                  formData.request_type === 'half_day_am' ||
                  formData.request_type === 'half_day_pm') && (
                  <span className="text-sm text-gray-500 ml-auto">
                    残: {balance.remaining_days}日
                  </span>
                )}
            </div>

            {/* 理由 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                理由・備考（任意）
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm resize-none"
                placeholder="理由があれば入力してください..."
              />
            </div>

            {/* エラー */}
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{formError}</span>
              </div>
            )}

            {/* 送信ボタン */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors text-sm font-medium disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    申請する
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { key: 'all', label: '全て' },
            { key: 'pending', label: '承認待ち' },
            { key: 'approved', label: '承認済み' },
            { key: 'rejected', label: '却下' },
            { key: 'cancelled', label: 'キャンセル' },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            onClick={() => setStatusFilter(item.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === item.key
                ? 'bg-[#00c4cc] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {item.label}
            {item.key !== 'all' && (
              <span className="ml-1">
                ({requests.filter((r) => r.status === item.key).length})
              </span>
            )}
          </button>
        ))}
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
            {requests.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-[#00c4cc] hover:text-[#00c4cc] text-sm font-medium"
              >
                最初の申請を作成する
              </button>
            )}
          </div>
        ) : (
          filteredRequests.map((request) => {
            const statusConf = STATUS_CONFIG[request.status];
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === request.id;

            return (
              <div
                key={request.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* メイン行 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusConf.bgColor}`}
                  >
                    <StatusIcon size={16} className={statusConf.color} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm">
                        {LEAVE_REQUEST_TYPE_LABELS[request.request_type]}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${statusConf.bgColor} ${statusConf.color}`}
                      >
                        {statusConf.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateRange(request.start_date, request.end_date)}
                      <span className="ml-2">({request.days_count}日)</span>
                    </p>
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* 詳細 */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">開始日</span>
                        <p className="font-medium text-gray-800">{formatDate(request.start_date)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">終了日</span>
                        <p className="font-medium text-gray-800">{formatDate(request.end_date)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">日数</span>
                        <p className="font-medium text-gray-800">{request.days_count}日</p>
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
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                        <span className="text-red-600 font-medium">却下理由:</span>
                        <p className="text-red-700 mt-0.5">{request.rejection_reason}</p>
                      </div>
                    )}

                    {request.approved_at && (
                      <div className="text-sm text-gray-500">
                        {request.status === 'approved' ? '承認' : '処理'}日時:{' '}
                        {formatDate(request.approved_at)}
                      </div>
                    )}

                    {/* キャンセルボタン（承認待ちのみ） */}
                    {request.status === 'pending' && (
                      <div className="pt-2">
                        {cancellingId === request.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              本当にキャンセルしますか？
                            </span>
                            <button
                              onClick={() => handleCancel(request.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                            >
                              はい
                            </button>
                            <button
                              onClick={() => setCancellingId(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
                            >
                              いいえ
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCancellingId(request.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                          >
                            <Trash2 size={14} />
                            申請をキャンセル
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
