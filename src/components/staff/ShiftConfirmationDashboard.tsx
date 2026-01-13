/**
 * ShiftConfirmationDashboard - シフト確認状況ダッシュボード
 * 管理者がスタッフの回答状況を確認し、相談に対応
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Send,
  X,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShiftPattern,
  ShiftConfirmation,
  Staff,
  SHIFT_CONFIRMATION_STATUS_LABELS,
  MONTHLY_SHIFT_STATUS_LABELS,
} from '@/types';
import { supabase } from '@/lib/supabase';

interface ShiftConfirmationDashboardProps {
  facilityId: string;
}

type StaffConfirmationSummary = {
  staffId: string;
  staffName: string;
  userId: string;
  total: number;
  confirmed: number;
  pending: number;
  needsDiscussion: number;
  requiresReconfirm: number;
  discussions: Array<{
    shiftId: string;
    date: string;
    comment: string;
    confirmationId: string;
  }>;
};

export default function ShiftConfirmationDashboard({ facilityId }: ShiftConfirmationDashboardProps) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [summaries, setSummaries] = useState<StaffConfirmationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const [selectedDiscussion, setSelectedDiscussion] = useState<{
    staffName: string;
    date: string;
    comment: string;
    confirmationId: string;
  } | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // データ取得
  useEffect(() => {
    fetchData();
  }, [facilityId, currentYear, currentMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // スケジュールステータス取得
      const { data: scheduleData } = await supabase
        .from('monthly_shift_schedules')
        .select('status')
        .eq('facility_id', facilityId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single();

      setScheduleStatus(scheduleData?.status || null);

      if (!scheduleData || scheduleData.status === 'draft') {
        setSummaries([]);
        setIsLoading(false);
        return;
      }

      // スタッフ一覧取得
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, user_id')
        .eq('facility_id', facilityId)
        .order('name');

      if (!staffData || staffData.length === 0) {
        setSummaries([]);
        setIsLoading(false);
        return;
      }

      // 該当月のシフト取得
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('id, staff_id, date, has_shift')
        .eq('facility_id', facilityId)
        .eq('has_shift', true)
        .gte('date', startDate)
        .lte('date', endDate);

      // 確認レコード取得
      const shiftIds = (shiftsData || []).map((s) => s.id);
      const { data: confirmationsData } = await supabase
        .from('shift_confirmations')
        .select('*')
        .in('shift_id', shiftIds.length > 0 ? shiftIds : ['']);

      // スタッフごとのサマリー作成
      const staffSummaries: StaffConfirmationSummary[] = staffData.map((staff) => {
        const staffShifts = (shiftsData || []).filter((s) => s.staff_id === staff.id);
        const staffConfirmations = (confirmationsData || []).filter((c) =>
          staffShifts.some((s) => s.id === c.shift_id)
        );

        const confirmed = staffConfirmations.filter((c) => c.status === 'confirmed' && !c.requires_reconfirm).length;
        const needsDiscussion = staffConfirmations.filter((c) => c.status === 'needs_discussion').length;
        const requiresReconfirm = staffConfirmations.filter((c) => c.requires_reconfirm && c.status === 'pending').length;
        const pending = staffShifts.length - confirmed - needsDiscussion - requiresReconfirm;

        const discussions = staffConfirmations
          .filter((c) => c.status === 'needs_discussion')
          .map((c) => {
            const shift = staffShifts.find((s) => s.id === c.shift_id);
            return {
              shiftId: c.shift_id,
              date: shift?.date || '',
              comment: c.comment || '',
              confirmationId: c.id,
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        return {
          staffId: staff.id,
          staffName: staff.name,
          userId: staff.user_id || '',
          total: staffShifts.length,
          confirmed,
          pending,
          needsDiscussion,
          requiresReconfirm,
          discussions,
        };
      });

      setSummaries(staffSummaries);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 月移動
  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 相談に回答
  const handleResolve = async () => {
    if (!selectedDiscussion || !resolutionNote.trim()) {
      alert('回答内容を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('shift_confirmations')
        .update({
          status: 'confirmed',
          resolution_note: resolutionNote.trim(),
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDiscussion.confirmationId);

      if (error) throw error;

      setSelectedDiscussion(null);
      setResolutionNote('');
      fetchData();
    } catch (error) {
      console.error('回答エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 全体サマリー
  const overallSummary = useMemo(() => {
    const total = summaries.reduce((sum, s) => sum + s.total, 0);
    const confirmed = summaries.reduce((sum, s) => sum + s.confirmed, 0);
    const pending = summaries.reduce((sum, s) => sum + s.pending, 0);
    const needsDiscussion = summaries.reduce((sum, s) => sum + s.needsDiscussion, 0);
    const requiresReconfirm = summaries.reduce((sum, s) => sum + s.requiresReconfirm, 0);
    const canConfirm = total > 0 && pending === 0 && needsDiscussion === 0 && requiresReconfirm === 0;
    return { total, confirmed, pending, needsDiscussion, requiresReconfirm, canConfirm };
  }, [summaries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-bold text-gray-800">
            {currentYear}年{currentMonth}月
          </h3>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>

          {scheduleStatus && (
            <span
              className={`px-2 py-1 text-xs font-bold rounded ${MONTHLY_SHIFT_STATUS_LABELS[scheduleStatus as keyof typeof MONTHLY_SHIFT_STATUS_LABELS]?.color || 'bg-gray-100 text-gray-600'}`}
            >
              {MONTHLY_SHIFT_STATUS_LABELS[scheduleStatus as keyof typeof MONTHLY_SHIFT_STATUS_LABELS]?.label || scheduleStatus}
            </span>
          )}
        </div>
      </div>

      {scheduleStatus === 'draft' || !scheduleStatus ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600">シフトがまだ公開されていません</p>
          <p className="text-sm text-gray-500">公開後に確認状況を確認できます</p>
        </div>
      ) : (
        <>
          {/* 全員承認通知 */}
          {overallSummary.canConfirm && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-bold text-green-700">全員が承認しました</p>
                <p className="text-sm text-green-600">シフトを確定できます</p>
              </div>
            </div>
          )}

          {/* 全体サマリー */}
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-gray-800">{overallSummary.total}</p>
              <p className="text-sm text-gray-500">総シフト数</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{overallSummary.confirmed}</p>
              <p className="text-sm text-gray-500">確認済み</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-gray-600">{overallSummary.pending}</p>
              <p className="text-sm text-gray-500">未回答</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{overallSummary.requiresReconfirm}</p>
              <p className="text-sm text-gray-500">再確認待ち</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{overallSummary.needsDiscussion}</p>
              <p className="text-sm text-gray-500">相談中</p>
            </div>
          </div>

          {/* スタッフ別一覧 */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              スタッフ別確認状況
            </h4>

            {summaries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                スタッフがいません
              </div>
            ) : (
              summaries.map((summary) => (
                <div
                  key={summary.staffId}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800">{summary.staffName}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-600">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        {summary.confirmed}
                      </span>
                      <span className="text-gray-500">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {summary.pending}
                      </span>
                      {summary.requiresReconfirm > 0 && (
                        <span className="text-blue-600">
                          <RefreshCw className="w-4 h-4 inline mr-1" />
                          {summary.requiresReconfirm}
                        </span>
                      )}
                      <span className="text-orange-600">
                        <MessageCircle className="w-4 h-4 inline mr-1" />
                        {summary.needsDiscussion}
                      </span>
                    </div>
                  </div>

                  {/* プログレスバー */}
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${summary.total > 0 ? (summary.confirmed / summary.total) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* 相談一覧 */}
                  {summary.discussions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-orange-600">相談中のシフト:</p>
                      {summary.discussions.map((disc) => (
                        <div
                          key={disc.confirmationId}
                          className="flex items-center justify-between bg-orange-50 rounded-lg p-2"
                        >
                          <div>
                            <span className="text-sm font-medium text-gray-700">
                              {new Date(disc.date).getMonth() + 1}月{new Date(disc.date).getDate()}日
                            </span>
                            <p className="text-xs text-gray-600 mt-0.5">{disc.comment}</p>
                          </div>
                          <button
                            onClick={() =>
                              setSelectedDiscussion({
                                staffName: summary.staffName,
                                date: disc.date,
                                comment: disc.comment,
                                confirmationId: disc.confirmationId,
                              })
                            }
                            className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors"
                          >
                            対応する
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 相談対応モーダル */}
      <AnimatePresence>
        {selectedDiscussion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDiscussion(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">相談に対応</h3>
                <button
                  onClick={() => setSelectedDiscussion(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{selectedDiscussion.staffName}</span>さん -
                  {new Date(selectedDiscussion.date).getMonth() + 1}月
                  {new Date(selectedDiscussion.date).getDate()}日
                </p>
                <p className="text-sm text-gray-800 mt-1">{selectedDiscussion.comment}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  回答内容
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="回答・対応内容を入力してください"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedDiscussion(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isSubmitting || !resolutionNote.trim()}
                  className="px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? '送信中...' : '回答して確定'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
