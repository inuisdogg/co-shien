/**
 * ShiftAvailabilityDashboard - 希望シフト管理ダッシュボード（管理側）
 * スタッフの希望提出状況の確認と締切設定
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
} from 'lucide-react';
import {
  ShiftAvailabilityDeadline,
  ShiftAvailabilitySubmission,
  StaffAvailabilityStatus,
  Staff,
} from '@/types';
import { supabase } from '@/lib/supabase';

interface ShiftAvailabilityDashboardProps {
  facilityId: string;
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

export default function ShiftAvailabilityDashboard({ facilityId }: ShiftAvailabilityDashboardProps) {
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
  const [deadline, setDeadline] = useState<ShiftAvailabilityDeadline | null>(null);
  const [staffStatuses, setStaffStatuses] = useState<StaffAvailabilityStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState('');

  // 月の日付一覧
  const daysInMonth = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // 集計データ
  const summary = useMemo(() => {
    const total = staffStatuses.length;
    const submitted = staffStatuses.filter(s => s.submitted).length;
    const pending = total - submitted;
    return { total, submitted, pending };
  }, [staffStatuses]);

  // 日付ごとの希望者数を集計
  const availabilityByDate = useMemo(() => {
    const map = new Map<string, number>();
    staffStatuses.forEach(status => {
      status.availableDates.forEach(date => {
        map.set(date, (map.get(date) || 0) + 1);
      });
    });
    return map;
  }, [staffStatuses]);

  // データ取得
  useEffect(() => {
    fetchData();
  }, [facilityId, currentYear, currentMonth]);

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
        setDeadlineInput(deadlineData.deadline_date);
      } else {
        setDeadline(null);
        // デフォルトで前月25日
        const defaultDate = new Date(currentYear, currentMonth - 2, 25);
        setDeadlineInput(formatDate(defaultDate));
      }

      // スタッフ一覧を取得
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, user_id, first_name, last_name, employment_type, role')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('display_order');

      // 希望提出データを取得
      const { data: submissionsData } = await supabase
        .from('shift_availability_submissions')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year', currentYear)
        .eq('month', currentMonth);

      // スタッフごとの状況をマッピング
      const statuses: StaffAvailabilityStatus[] = (staffData || [])
        .filter(s => s.user_id) // アカウント連携済みのスタッフのみ
        .map(s => {
          const submission = submissionsData?.find(sub => sub.user_id === s.user_id);
          return {
            staffId: s.id,
            staffName: `${s.last_name || ''}${s.first_name || ''}`.trim() || '名前未設定',
            userId: s.user_id,
            submitted: !!submission?.submitted_at,
            submittedAt: submission?.submitted_at,
            availableDates: submission?.available_dates || [],
            notes: submission?.notes,
          };
        });

      setStaffStatuses(statuses);
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

  // 締切設定の保存
  const handleSaveDeadline = async () => {
    if (!deadlineInput) return;

    setIsSaving(true);
    try {
      if (deadline) {
        // 更新
        await supabase
          .from('shift_availability_deadlines')
          .update({
            deadline_date: deadlineInput,
            is_open: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deadline.id);
      } else {
        // 新規作成
        await supabase
          .from('shift_availability_deadlines')
          .insert({
            facility_id: facilityId,
            year: currentYear,
            month: currentMonth,
            deadline_date: deadlineInput,
            is_open: true,
          });
      }

      setShowDeadlineModal(false);
      fetchData();
    } catch (error) {
      console.error('締切保存エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 締切を閉じる
  const handleCloseDeadline = async () => {
    if (!deadline) return;

    if (!confirm('希望提出の受付を締め切りますか？')) return;

    setIsSaving(true);
    try {
      await supabase
        .from('shift_availability_deadlines')
        .update({
          is_open: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deadline.id);

      fetchData();
    } catch (error) {
      console.error('締切クローズエラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 締切を再開
  const handleReopenDeadline = async () => {
    if (!deadline) return;

    setIsSaving(true);
    try {
      await supabase
        .from('shift_availability_deadlines')
        .update({
          is_open: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deadline.id);

      fetchData();
    } catch (error) {
      console.error('締切再開エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 締切状態の判定
  const isDeadlinePassed = deadline && new Date(deadline.deadlineDate) < new Date();
  const isAccepting = deadline?.isOpen && !isDeadlinePassed;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-xl font-bold">
            {currentYear}年{currentMonth}月 希望シフト
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {deadline?.isOpen ? (
            <button
              onClick={handleCloseDeadline}
              disabled={isSaving}
              className="px-4 py-2 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              受付を締め切る
            </button>
          ) : deadline && !deadline.isOpen ? (
            <button
              onClick={handleReopenDeadline}
              disabled={isSaving}
              className="px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              受付を再開
            </button>
          ) : null}
          <button
            onClick={() => setShowDeadlineModal(true)}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            締切設定
          </button>
        </div>
      </div>

      {/* 締切表示 */}
      {deadline && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          isAccepting
            ? 'bg-green-50 border border-green-200'
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <Calendar className={`w-5 h-5 ${isAccepting ? 'text-green-600' : 'text-gray-500'}`} />
          <div>
            <span className="font-medium">
              締切: {deadline.deadlineDate}
            </span>
            {isAccepting ? (
              <span className="ml-2 text-green-600 text-sm">（受付中）</span>
            ) : (
              <span className="ml-2 text-gray-500 text-sm">（締切済み）</span>
            )}
          </div>
        </div>
      )}

      {!deadline && (
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-700">
            締切が設定されていません。「締切設定」ボタンから設定してください。
          </span>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">対象スタッフ</span>
          </div>
          <p className="text-2xl font-bold">{summary.total}名</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">提出済み</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{summary.submitted}名</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">未提出</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{summary.pending}名</p>
        </div>
      </div>

      {/* 希望カレンダービュー */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-500" />
            希望状況カレンダー
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            各日付の数字は出勤希望者数を表しています
          </p>
        </div>

        <div className="p-4 overflow-x-auto">
          {/* 日付ヘッダー */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${daysInMonth.length}, minmax(36px, 1fr))` }}>
            <div className="text-sm font-medium text-gray-500 p-2">スタッフ</div>
            {daysInMonth.map((date) => {
              const dayOfWeek = date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <div
                  key={formatDate(date)}
                  className={`text-center text-xs p-1 ${
                    isWeekend ? 'bg-red-50' : ''
                  }`}
                >
                  <div className={dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}>
                    {date.getDate()}
                  </div>
                  <div className={`text-[10px] ${
                    dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    {WEEKDAYS[dayOfWeek]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 集計行 */}
          <div
            className="grid gap-1 border-b-2 border-teal-200 pb-2 mb-2"
            style={{ gridTemplateColumns: `120px repeat(${daysInMonth.length}, minmax(36px, 1fr))` }}
          >
            <div className="text-sm font-medium text-teal-600 p-2">
              希望者数
            </div>
            {daysInMonth.map((date) => {
              const dateStr = formatDate(date);
              const count = availabilityByDate.get(dateStr) || 0;
              const maxCount = summary.submitted;
              const intensity = maxCount > 0 ? count / maxCount : 0;
              const dayOfWeek = date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div
                  key={dateStr}
                  className={`h-10 flex items-center justify-center text-sm font-bold rounded ${
                    isWeekend ? 'bg-red-50' : ''
                  }`}
                  style={{
                    backgroundColor: count > 0
                      ? `rgba(0, 196, 204, ${0.2 + intensity * 0.6})`
                      : undefined,
                  }}
                >
                  {count > 0 ? count : '-'}
                </div>
              );
            })}
          </div>

          {/* スタッフごとの希望 */}
          {staffStatuses.map((status) => (
            <div
              key={status.staffId}
              className="grid gap-1 border-b border-gray-100 py-1"
              style={{ gridTemplateColumns: `120px repeat(${daysInMonth.length}, minmax(36px, 1fr))` }}
            >
              <div className="text-sm p-2 flex items-center gap-2">
                <span className="truncate">{status.staffName}</span>
                {status.submitted ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                )}
              </div>
              {daysInMonth.map((date) => {
                const dateStr = formatDate(date);
                const isAvailable = status.availableDates.includes(dateStr);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div
                    key={dateStr}
                    className={`h-8 flex items-center justify-center rounded ${
                      isWeekend ? 'bg-red-50' : ''
                    }`}
                  >
                    {isAvailable && (
                      <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">○</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {staffStatuses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              アカウント連携済みのスタッフがいません
            </div>
          )}
        </div>
      </div>

      {/* スタッフ一覧 */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-500" />
            スタッフ別提出状況
          </h3>
        </div>
        <div className="divide-y">
          {staffStatuses.map((status) => (
            <div key={status.staffId} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 font-medium">
                    {status.staffName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{status.staffName}</p>
                  {status.notes && (
                    <p className="text-sm text-gray-500">{status.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  希望日数: {status.availableDates.length}日
                </span>
                {status.submitted ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    提出済み
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    未提出
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 締切設定モーダル */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">締切設定</h3>
            <p className="text-sm text-gray-600 mb-4">
              {currentYear}年{currentMonth}月分の希望シフト提出締切を設定します。
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                締切日
              </label>
              <input
                type="date"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeadlineModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveDeadline}
                disabled={isSaving || !deadlineInput}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
