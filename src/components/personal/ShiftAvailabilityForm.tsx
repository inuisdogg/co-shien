/**
 * ShiftAvailabilityForm - 希望シフト提出フォーム（スタッフ側）
 * カレンダー形式で出勤可能日を選択・提出
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Save,
} from 'lucide-react';
import {
  ShiftAvailabilitySubmission,
  ShiftAvailabilityDeadline,
} from '@/types';
import { supabase } from '@/lib/supabase';

interface ShiftAvailabilityFormProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onClose: () => void;
}

// 日付ヘルパー関数
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

export default function ShiftAvailabilityForm({
  userId,
  facilityId,
  facilityName,
  onClose,
}: ShiftAvailabilityFormProps) {
  const [currentYear, setCurrentYear] = useState(() => {
    // デフォルトは翌月
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.getMonth() + 1;
  });

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState<ShiftAvailabilityDeadline | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<ShiftAvailabilitySubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 月の日付一覧
  const daysInMonth = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // カレンダーグリッド用の日付配列（前月の余白含む）
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const days: (Date | null)[] = [];

    // 前月の余白
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // 当月の日付
    daysInMonth.forEach((date) => days.push(date));

    return days;
  }, [daysInMonth, currentYear, currentMonth]);

  // データ取得
  useEffect(() => {
    fetchData();
  }, [userId, facilityId, currentYear, currentMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 締切設定を取得
      const { data: deadlineData } = await supabase
        .from('shift_availability_deadlines')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single();

      if (deadlineData) {
        setDeadline({
          id: deadlineData.id,
          facilityId: deadlineData.facility_id,
          year: deadlineData.year,
          month: deadlineData.month,
          deadlineDate: deadlineData.deadline_date,
          isOpen: deadlineData.is_open,
          createdAt: deadlineData.created_at,
          updatedAt: deadlineData.updated_at,
        });
      } else {
        setDeadline(null);
      }

      // 既存の提出データを取得
      const { data: submissionData } = await supabase
        .from('shift_availability_submissions')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('user_id', userId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single();

      if (submissionData) {
        setExistingSubmission({
          id: submissionData.id,
          facilityId: submissionData.facility_id,
          userId: submissionData.user_id,
          year: submissionData.year,
          month: submissionData.month,
          availableDates: submissionData.available_dates || [],
          notes: submissionData.notes,
          submittedAt: submissionData.submitted_at,
          createdAt: submissionData.created_at,
          updatedAt: submissionData.updated_at,
        });
        setSelectedDates(new Set(submissionData.available_dates || []));
        setNotes(submissionData.notes || '');
      } else {
        setExistingSubmission(null);
        setSelectedDates(new Set());
        setNotes('');
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 月移動
  const goToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 日付トグル
  const toggleDate = (date: Date) => {
    const dateStr = formatDate(date);
    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  // 全選択
  const selectAll = () => {
    const allDates = new Set(daysInMonth.map((d) => formatDate(d)));
    setSelectedDates(allDates);
  };

  // 平日のみ選択
  const selectWeekdays = () => {
    const weekdays = new Set(
      daysInMonth
        .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
        .map((d) => formatDate(d))
    );
    setSelectedDates(weekdays);
  };

  // 選択クリア
  const clearAll = () => {
    setSelectedDates(new Set());
  };

  // 保存（下書き）
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const availableDates = Array.from(selectedDates).sort();

      if (existingSubmission) {
        // 更新
        await supabase
          .from('shift_availability_submissions')
          .update({
            available_dates: availableDates,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSubmission.id);
      } else {
        // 新規作成
        await supabase
          .from('shift_availability_submissions')
          .insert({
            facility_id: facilityId,
            user_id: userId,
            year: currentYear,
            month: currentMonth,
            available_dates: availableDates,
            notes: notes || null,
          });
      }

      fetchData();
    } catch (error) {
      console.error('保存エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 提出
  const handleSubmit = async () => {
    if (!confirm('希望シフトを提出しますか？\n提出後も締切までは修正できます。')) return;

    setIsSaving(true);
    try {
      const availableDates = Array.from(selectedDates).sort();
      const now = new Date().toISOString();

      if (existingSubmission) {
        // 更新
        await supabase
          .from('shift_availability_submissions')
          .update({
            available_dates: availableDates,
            notes: notes || null,
            submitted_at: now,
            updated_at: now,
          })
          .eq('id', existingSubmission.id);
      } else {
        // 新規作成
        await supabase
          .from('shift_availability_submissions')
          .insert({
            facility_id: facilityId,
            user_id: userId,
            year: currentYear,
            month: currentMonth,
            available_dates: availableDates,
            notes: notes || null,
            submitted_at: now,
          });
      }

      fetchData();
    } catch (error) {
      console.error('提出エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 締切状態の判定
  const isDeadlinePassed = deadline && new Date(deadline.deadlineDate) < new Date();
  const canEdit = !deadline || (deadline.isOpen && !isDeadlinePassed);
  const isSubmitted = !!existingSubmission?.submittedAt;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          {/* ヘッダー */}
          <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-teal-500 to-teal-600 text-white">
            <div>
              <h2 className="text-lg font-bold">希望シフト提出</h2>
              <p className="text-sm text-teal-100">{facilityName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* 月ナビゲーション */}
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h3 className="text-lg font-bold">
                  {currentYear}年{currentMonth}月
                </h3>
                <button
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* 締切・ステータス表示 */}
              <div className="p-4 space-y-3">
                {deadline ? (
                  <div className={`p-3 rounded-lg flex items-center gap-3 ${
                    canEdit
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <Clock className={`w-5 h-5 ${canEdit ? 'text-green-600' : 'text-gray-500'}`} />
                    <div>
                      <span className="font-medium">締切: {deadline.deadlineDate}</span>
                      {canEdit ? (
                        <span className="ml-2 text-green-600 text-sm">（受付中）</span>
                      ) : (
                        <span className="ml-2 text-gray-500 text-sm">（締切済み）</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-700">
                      この月の希望シフト受付はまだ開始されていません
                    </span>
                  </div>
                )}

                {isSubmitted && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-700">
                      提出済み（{new Date(existingSubmission.submittedAt!).toLocaleString('ja-JP')}）
                    </span>
                  </div>
                )}
              </div>

              {/* 選択ボタン */}
              {canEdit && (
                <div className="px-4 pb-2 flex gap-2 flex-wrap">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    全選択
                  </button>
                  <button
                    onClick={selectWeekdays}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    平日のみ
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    クリア
                  </button>
                  <span className="ml-auto text-sm text-gray-500 self-center">
                    選択中: {selectedDates.size}日
                  </span>
                </div>
              )}

              {/* カレンダーグリッド */}
              <div className="p-4">
                {/* 曜日ヘッダー */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map((day, i) => (
                    <div
                      key={day}
                      className={`text-center text-sm font-medium py-2 ${
                        i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* 日付グリッド */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, index) => {
                    if (!date) {
                      return <div key={`empty-${index}`} className="h-12" />;
                    }

                    const dateStr = formatDate(date);
                    const isSelected = selectedDates.has(dateStr);
                    const dayOfWeek = date.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => canEdit && toggleDate(date)}
                        disabled={!canEdit}
                        className={`h-12 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                          canEdit ? 'hover:border-teal-400 cursor-pointer' : 'cursor-not-allowed opacity-70'
                        } ${
                          isSelected
                            ? 'bg-teal-500 border-teal-500 text-white'
                            : isWeekend
                            ? 'bg-red-50 border-gray-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <span className={`text-sm font-medium ${
                          isSelected
                            ? 'text-white'
                            : dayOfWeek === 0
                            ? 'text-red-500'
                            : dayOfWeek === 6
                            ? 'text-blue-500'
                            : 'text-gray-700'
                        }`}>
                          {date.getDate()}
                        </span>
                        {isSelected && (
                          <span className="text-xs">○</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 備考欄 */}
              <div className="px-4 pb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  備考（任意）
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEdit}
                  placeholder="希望事項があれば記入してください"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* フッター */}
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <p className="text-sm text-gray-500">
              出勤できる日をタップして選択してください
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !canEdit}
                className="px-4 py-2 text-gray-600 bg-white border hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                下書き保存
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || !canEdit || selectedDates.size === 0}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitted ? '再提出' : '提出'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
