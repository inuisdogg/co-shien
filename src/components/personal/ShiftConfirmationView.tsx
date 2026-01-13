/**
 * ShiftConfirmationView - シフト確認画面（個人側）
 * スタッフが自分のシフトを確認し、OK/相談したいを回答
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MessageCircle,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShiftPattern,
  ShiftWithPattern,
  ShiftConfirmation,
  SHIFT_CONFIRMATION_STATUS_LABELS,
} from '@/types';
import { supabase } from '@/lib/supabase';

interface ShiftConfirmationViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onClose: () => void;
}

// 日付ヘルパー
const getDaysInMonth = (year: number, month: number): Date[] => {
  const days: Date[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type ShiftWithConfirmation = ShiftWithPattern & {
  confirmation?: ShiftConfirmation & {
    requiresReconfirm?: boolean;
    previousShiftPatternId?: string;
  };
  previousPattern?: ShiftPattern;
};

export default function ShiftConfirmationView({
  userId,
  facilityId,
  facilityName,
  onClose,
}: ShiftConfirmationViewProps) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [myShifts, setMyShifts] = useState<Map<string, ShiftWithConfirmation>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<ShiftWithConfirmation | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);

  // 月の日付一覧
  const daysInMonth = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // データ取得
  useEffect(() => {
    fetchData();
  }, [facilityId, userId, currentYear, currentMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // シフトパターン取得
      const { data: patternsData } = await supabase
        .from('shift_patterns')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_active', true);

      const mappedPatterns: ShiftPattern[] = (patternsData || []).map((row) => ({
        id: row.id,
        facilityId: row.facility_id,
        name: row.name,
        shortName: row.short_name,
        startTime: row.start_time,
        endTime: row.end_time,
        breakMinutes: row.break_minutes || 60,
        color: row.color || '#00c4cc',
        displayOrder: row.display_order || 0,
        isDayOff: row.is_day_off || false,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      setPatterns(mappedPatterns);

      // スケジュールステータス取得
      const { data: scheduleData } = await supabase
        .from('monthly_shift_schedules')
        .select('status')
        .eq('facility_id', facilityId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single();

      setScheduleStatus(scheduleData?.status || null);

      // staffテーブルからstaff_idを取得
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('facility_id', facilityId)
        .eq('user_id', userId)
        .single();

      if (!staffData) {
        setMyShifts(new Map());
        setIsLoading(false);
        return;
      }

      // 自分のシフト取得
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('staff_id', staffData.id)
        .gte('date', startDate)
        .lte('date', endDate);

      // 確認レコード取得
      const shiftIds = (shiftsData || []).map((s) => s.id);
      const { data: confirmationsData } = await supabase
        .from('shift_confirmations')
        .select('*')
        .eq('user_id', userId)
        .in('shift_id', shiftIds.length > 0 ? shiftIds : ['']);

      const confirmationsMap = new Map<string, ShiftConfirmation & {
        requiresReconfirm?: boolean;
        previousShiftPatternId?: string;
      }>();
      (confirmationsData || []).forEach((row) => {
        confirmationsMap.set(row.shift_id, {
          id: row.id,
          shiftId: row.shift_id,
          userId: row.user_id,
          status: row.status,
          comment: row.comment,
          respondedAt: row.responded_at,
          resolvedAt: row.resolved_at,
          resolutionNote: row.resolution_note,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          requiresReconfirm: row.requires_reconfirm || false,
          previousShiftPatternId: row.previous_shift_pattern_id,
        });
      });

      // シフトマップ作成
      const shiftsMap = new Map<string, ShiftWithConfirmation>();
      (shiftsData || []).forEach((row) => {
        const pattern = mappedPatterns.find((p) => p.id === row.shift_pattern_id);
        const conf = confirmationsMap.get(row.id);
        const previousPattern = conf?.previousShiftPatternId
          ? mappedPatterns.find((p) => p.id === conf.previousShiftPatternId)
          : undefined;
        shiftsMap.set(row.date, {
          id: row.id,
          facilityId: row.facility_id,
          staffId: row.staff_id,
          date: row.date,
          hasShift: row.has_shift,
          shiftPatternId: row.shift_pattern_id,
          monthlyScheduleId: row.monthly_schedule_id,
          startTime: row.start_time,
          endTime: row.end_time,
          breakMinutes: row.break_minutes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          shiftPattern: pattern,
          confirmation: conf,
          previousPattern,
        });
      });

      setMyShifts(shiftsMap);
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

  // OK回答
  const handleConfirm = async (shift: ShiftWithConfirmation) => {
    setIsSubmitting(true);
    try {
      if (shift.confirmation?.id) {
        // 更新（再確認フラグもクリア）
        await supabase
          .from('shift_confirmations')
          .update({
            status: 'confirmed',
            responded_at: new Date().toISOString(),
            comment: null,
            requires_reconfirm: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shift.confirmation.id);
      } else {
        // 新規作成
        await supabase.from('shift_confirmations').insert({
          shift_id: shift.id,
          user_id: userId,
          status: 'confirmed',
          responded_at: new Date().toISOString(),
        });
      }
      fetchData();
    } catch (error) {
      console.error('確認エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 相談したい回答
  const handleNeedsDiscussion = async () => {
    if (!selectedShift || !comment.trim()) {
      alert('相談内容を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedShift.confirmation?.id) {
        await supabase
          .from('shift_confirmations')
          .update({
            status: 'needs_discussion',
            comment: comment.trim(),
            responded_at: new Date().toISOString(),
            requires_reconfirm: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedShift.confirmation.id);
      } else {
        await supabase.from('shift_confirmations').insert({
          shift_id: selectedShift.id,
          user_id: userId,
          status: 'needs_discussion',
          comment: comment.trim(),
          responded_at: new Date().toISOString(),
        });
      }
      setShowCommentModal(false);
      setSelectedShift(null);
      setComment('');
      fetchData();
    } catch (error) {
      console.error('相談エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 回答状況サマリー
  const summary = useMemo(() => {
    const shifts = Array.from(myShifts.values()).filter((s) => s.hasShift);
    const confirmed = shifts.filter((s) => s.confirmation?.status === 'confirmed' && !s.confirmation?.requiresReconfirm).length;
    const requiresReconfirm = shifts.filter((s) => s.confirmation?.requiresReconfirm).length;
    const pending = shifts.filter((s) => (!s.confirmation || s.confirmation.status === 'pending') && !s.confirmation?.requiresReconfirm).length;
    const needsDiscussion = shifts.filter((s) => s.confirmation?.status === 'needs_discussion').length;
    return { total: shifts.length, confirmed, pending, needsDiscussion, requiresReconfirm };
  }, [myShifts]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">シフト確認</h2>
            <p className="text-sm text-gray-500">{facilityName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
            </div>
          ) : scheduleStatus !== 'published' && scheduleStatus !== 'confirmed' ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-600">まだシフトが公開されていません</p>
              <p className="text-sm text-gray-500">公開されるまでお待ちください</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 月ナビゲーション */}
              <div className="flex items-center justify-between">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-bold">
                  {currentYear}年{currentMonth}月
                </h3>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* 再確認が必要な場合のバナー */}
              {summary.requiresReconfirm > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-blue-800">シフトが変更されました</p>
                    <p className="text-sm text-blue-600">
                      {summary.requiresReconfirm}件のシフトで再確認が必要です
                    </p>
                  </div>
                </div>
              )}

              {/* サマリー */}
              <div className={`grid gap-2 ${summary.requiresReconfirm > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{summary.pending}</p>
                  <p className="text-xs text-gray-500">未回答</p>
                </div>
                {summary.requiresReconfirm > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 text-center border-2 border-blue-300">
                    <p className="text-2xl font-bold text-blue-600">{summary.requiresReconfirm}</p>
                    <p className="text-xs text-blue-500">再確認</p>
                  </div>
                )}
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{summary.confirmed}</p>
                  <p className="text-xs text-gray-500">OK</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{summary.needsDiscussion}</p>
                  <p className="text-xs text-gray-500">相談中</p>
                </div>
              </div>

              {/* シフト一覧 */}
              <div className="space-y-2">
                {daysInMonth.map((date) => {
                  const dateStr = formatDate(date);
                  const shift = myShifts.get(dateStr);
                  const dayOfWeek = date.getDay();

                  if (!shift || !shift.hasShift) return null;

                  const pattern = shift.shiftPattern;
                  const confirmation = shift.confirmation;
                  const requiresReconfirm = confirmation?.requiresReconfirm || false;
                  const statusLabel = requiresReconfirm
                    ? { label: '再確認', color: 'bg-blue-100 text-blue-700' }
                    : confirmation?.status
                    ? SHIFT_CONFIRMATION_STATUS_LABELS[confirmation.status]
                    : SHIFT_CONFIRMATION_STATUS_LABELS.pending;

                  return (
                    <div
                      key={dateStr}
                      className={`flex items-center gap-3 p-3 bg-white rounded-lg border-2 ${
                        requiresReconfirm
                          ? 'border-blue-300 bg-blue-50/50'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* 日付 */}
                      <div className={`text-center w-12 ${
                        dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
                      }`}>
                        <div className="text-lg font-bold">{date.getDate()}</div>
                        <div className="text-xs">{WEEKDAYS[dayOfWeek]}</div>
                      </div>

                      {/* シフト情報 */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 再確認時：変更前パターンを取り消し線で表示 */}
                          {requiresReconfirm && shift.previousPattern && (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold line-through opacity-50"
                              style={{
                                backgroundColor: shift.previousPattern.color + '20',
                                color: shift.previousPattern.color,
                              }}
                            >
                              {shift.previousPattern.name}
                            </span>
                          )}
                          {requiresReconfirm && shift.previousPattern && (
                            <span className="text-gray-400">→</span>
                          )}
                          {/* 現在のパターン */}
                          {pattern && (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                backgroundColor: pattern.color + '30',
                                color: pattern.color,
                              }}
                            >
                              {pattern.name}
                            </span>
                          )}
                          {!pattern?.isDayOff && shift.startTime && shift.endTime && (
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {shift.startTime.slice(0, 5)} - {shift.endTime.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        {confirmation?.comment && (
                          <p className="text-xs text-gray-500 mt-1">
                            相談: {confirmation.comment}
                          </p>
                        )}
                        {confirmation?.resolutionNote && (
                          <p className="text-xs text-green-600 mt-1">
                            回答: {confirmation.resolutionNote}
                          </p>
                        )}
                      </div>

                      {/* ステータス・アクション */}
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${statusLabel.color}`}>
                          {statusLabel.label}
                        </span>

                        {scheduleStatus === 'published' && (confirmation?.status !== 'confirmed' || requiresReconfirm) && (
                          <>
                            <button
                              onClick={() => handleConfirm(shift)}
                              disabled={isSubmitting}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                requiresReconfirm
                                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                  : 'bg-green-100 text-green-600 hover:bg-green-200'
                              }`}
                              title={requiresReconfirm ? '変更を承認' : 'OK'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedShift(shift);
                                setComment(confirmation?.comment || '');
                                setShowCommentModal(true);
                              }}
                              disabled={isSubmitting}
                              className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50"
                              title="相談したい"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {summary.total === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>この月のシフトはありません</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* 相談コメントモーダル */}
      <AnimatePresence>
        {showCommentModal && selectedShift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4"
            onClick={() => setShowCommentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-2">相談内容を入力</h3>
              <p className="text-sm text-gray-500 mb-4">
                {new Date(selectedShift.date).getMonth() + 1}月{new Date(selectedShift.date).getDate()}日のシフトについて
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="相談したい内容を入力してください"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowCommentModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleNeedsDiscussion}
                  disabled={isSubmitting || !comment.trim()}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? '送信中...' : '送信'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
