/**
 * 月次業務リマインダーパネル
 * 毎月の定常業務（勤怠締め・請求処理・給与振込）の進捗を可視化し、
 * 期限管理と業務漏れを防止する
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  Receipt,
  Banknote,
  ClipboardCheck,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmModal from '@/components/common/ConfirmModal';

interface MonthlyTask {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  deadlineDay: number; // 毎月の期限日
  href: string; // 該当機能へのリンク
  checkStatus: () => Promise<boolean>; // 完了判定
  iconBg: string; // Tailwind bg class
  iconText: string; // Tailwind text class
}

const MonthlyOperationsPanel: React.FC = () => {
  const { facility } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, 'pending' | 'done' | 'overdue'>>({});
  const [loading, setLoading] = useState(true);
  const [statusCheckError, setStatusCheckError] = useState(false);
  const [undoConfirmTaskId, setUndoConfirmTaskId] = useState<string | null>(null);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // 月次業務タスク定義
  const monthlyTasks: MonthlyTask[] = useMemo(() => [
    {
      id: 'attendance_close',
      label: '勤怠データ確認・締め',
      description: '前月分のスタッフ出退勤を確認し、シフトとの差異を修正',
      icon: ClipboardCheck,
      deadlineDay: 5,
      href: '/business?tab=shift',
      checkStatus: async () => {
        if (!facility?.id) return false;
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        // attendance_monthly_closings テーブルで前月の締め状態を確認
        const { data } = await supabase
          .from('attendance_monthly_closings')
          .select('status')
          .eq('facility_id', facility.id)
          .eq('year', prevYear)
          .eq('month', prevMonth)
          .maybeSingle();
        return data?.status === 'closed';
      },
      iconBg: 'bg-indigo-50',
      iconText: 'text-indigo-500',
    },
    {
      id: 'usage_record_confirm',
      label: '利用実績の確認',
      description: '前月の全児童の利用実績（出欠・提供時間）を確定',
      icon: FileText,
      deadlineDay: 5,
      href: '/business?tab=daily-log',
      checkStatus: async () => {
        if (!facility?.id) return false;
        // 前月の利用実績レコードが存在するかチェック
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const endDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-28`;
        const { count } = await supabase
          .from('usage_records')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facility.id)
          .gte('date', startDate)
          .lte('date', endDate);
        return (count || 0) > 0;
      },
      iconBg: 'bg-teal-50',
      iconText: 'text-teal-500',
    },
    {
      id: 'billing',
      label: '国保連請求データ作成・提出',
      description: '利用実績に基づく請求データを作成し、国保連合会へ提出',
      icon: Receipt,
      deadlineDay: 10,
      href: '/business?tab=billing',
      checkStatus: async () => {
        if (!facility?.id) return false;
        // 当月の請求レコードがconfirmed状態かチェック
        const { data } = await supabase
          .from('billing_records')
          .select('status')
          .eq('facility_id', facility.id)
          .eq('billing_year', currentYear)
          .eq('billing_month', currentMonth)
          .in('status', ['confirmed', 'submitted'])
          .limit(1);
        return (data?.length || 0) > 0;
      },
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-500',
    },
    {
      id: 'contract_report',
      label: '契約内容報告書の提出',
      description: '当月の新規・変更・終了の契約内容を行政へ報告',
      icon: FileText,
      deadlineDay: 10,
      href: '/business?tab=contract-report',
      checkStatus: async () => {
        if (!facility?.id) return false;
        const { data } = await supabase
          .from('government_document_submissions')
          .select('status')
          .eq('facility_id', facility.id)
          .eq('target_year', currentYear)
          .eq('target_month', currentMonth)
          .eq('category_id', 'contract_report')
          .in('status', ['submitted', 'received', 'completed'])
          .limit(1);
        return (data?.length || 0) > 0;
      },
      iconBg: 'bg-purple-50',
      iconText: 'text-purple-500',
    },
    {
      id: 'payroll',
      label: '給与計算・振込準備',
      description: '勤怠データに基づく給与計算と振込データの準備',
      icon: Banknote,
      deadlineDay: 25,
      href: '/business?tab=finance',
      checkStatus: async () => {
        // 給与テーブルは未実装のため、localStorage で手動管理
        const key = `payroll_done_${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        return localStorage.getItem(key) === 'true';
      },
      iconBg: 'bg-amber-50',
      iconText: 'text-amber-500',
    },
  ], [facility?.id, currentYear, currentMonth]);

  // タスクのステータスを一括チェック
  useEffect(() => {
    if (!facility?.id) return;

    const checkAll = async () => {
      setLoading(true);
      setStatusCheckError(false);
      const statuses: Record<string, 'pending' | 'done' | 'overdue'> = {};
      let hadError = false;

      // localStorage の手動完了チェック
      const manualKey = `monthly_ops_${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const manualDone = JSON.parse(localStorage.getItem(manualKey) || '{}');

      for (const task of monthlyTasks) {
        try {
          // 手動完了マーク or 自動判定
          const isDone = manualDone[task.id] === true || await task.checkStatus();
          if (isDone) {
            statuses[task.id] = 'done';
          } else if (currentDay > task.deadlineDay) {
            statuses[task.id] = 'overdue';
          } else {
            statuses[task.id] = 'pending';
          }
        } catch {
          hadError = true;
          statuses[task.id] = currentDay > task.deadlineDay ? 'overdue' : 'pending';
        }
      }
      setTaskStatuses(statuses);
      setStatusCheckError(hadError);
      setLoading(false);
    };

    checkAll();
  }, [facility?.id, monthlyTasks, currentDay, currentYear, currentMonth]);

  // 手動で完了/未完了を切り替え
  const handleToggleTask = (taskId: string) => {
    if (taskStatuses[taskId] === 'done') {
      // Un-completing requires confirmation
      setUndoConfirmTaskId(taskId);
      return;
    }
    applyToggle(taskId);
  };

  const applyToggle = (taskId: string) => {
    const manualKey = `monthly_ops_${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const manualDone = JSON.parse(localStorage.getItem(manualKey) || '{}');

    if (taskStatuses[taskId] === 'done') {
      delete manualDone[taskId];
      setTaskStatuses(prev => ({
        ...prev,
        [taskId]: currentDay > (monthlyTasks.find(t => t.id === taskId)?.deadlineDay || 31) ? 'overdue' : 'pending',
      }));
    } else {
      manualDone[taskId] = true;
      setTaskStatuses(prev => ({ ...prev, [taskId]: 'done' }));
    }

    localStorage.setItem(manualKey, JSON.stringify(manualDone));
  };

  const completedCount = Object.values(taskStatuses).filter(s => s === 'done').length;
  const overdueCount = Object.values(taskStatuses).filter(s => s === 'overdue').length;
  const totalCount = monthlyTasks.length;
  const allDone = completedCount === totalCount;

  // 月初〜10日は展開、それ以降は全完了なら折り畳み
  useEffect(() => {
    if (currentDay <= 10) {
      setIsExpanded(true);
    } else if (allDone) {
      setIsExpanded(false);
    }
  }, [currentDay, allDone]);

  if (loading) return null;

  // 全完了かつ月の後半なら非表示
  if (allDone && currentDay > 15) return null;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      overdueCount > 0
        ? 'border-red-200 bg-red-50/30'
        : allDone
          ? 'border-emerald-200 bg-emerald-50/30'
          : 'border-amber-200 bg-amber-50/30'
    }`}>
      {/* ヘッダー */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            overdueCount > 0 ? 'bg-red-100' : allDone ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            <CalendarClock size={18} className={
              overdueCount > 0 ? 'text-red-600' : allDone ? 'text-emerald-600' : 'text-amber-600'
            } />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-800">
              {currentMonth}月の月次業務
              {allDone && <span className="ml-2 text-emerald-600 text-xs font-medium">すべて完了</span>}
              {overdueCount > 0 && <span className="ml-2 text-red-600 text-xs font-medium">{overdueCount}件が期限超過</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {completedCount}/{totalCount} 完了
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* ミニ進捗バー */}
          <div className="hidden sm:flex items-center gap-1">
            {monthlyTasks.map(task => {
              const status = taskStatuses[task.id];
              return (
                <div
                  key={task.id}
                  className={`w-2 h-2 rounded-full ${
                    status === 'done' ? 'bg-emerald-500' : status === 'overdue' ? 'bg-red-500' : 'bg-gray-300'
                  }`}
                />
              );
            })}
          </div>
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* ステータスチェックエラー */}
      {statusCheckError && isExpanded && (
        <div className="mx-4 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">一部のステータスを自動確認できませんでした。手動で更新してください。</p>
        </div>
      )}

      {/* タスク一覧 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {monthlyTasks.map(task => {
            const status = taskStatuses[task.id];
            const Icon = task.icon;
            const daysUntilDeadline = task.deadlineDay - currentDay;

            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  status === 'done'
                    ? 'bg-white/60 opacity-70'
                    : status === 'overdue'
                      ? 'bg-white border border-red-200'
                      : 'bg-white border border-gray-100'
                }`}
              >
                {/* 完了チェック */}
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="shrink-0 focus:outline-none"
                  title={status === 'done' ? '未完了に戻す' : '完了にする'}
                >
                  {status === 'done' ? (
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  ) : status === 'overdue' ? (
                    <AlertTriangle size={20} className="text-red-500" />
                  ) : (
                    <Circle size={20} className="text-gray-300 hover:text-gray-400" />
                  )}
                </button>

                {/* アイコン */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  status === 'done' ? 'bg-gray-100' : task.iconBg
                }`}>
                  <Icon size={16} className={status === 'done' ? 'text-gray-400' : task.iconText} />
                </div>

                {/* タスク情報 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {task.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>
                </div>

                {/* 期限 */}
                <div className="shrink-0 text-right">
                  {status === 'done' ? (
                    <span className="text-xs text-emerald-500 font-medium">完了</span>
                  ) : status === 'overdue' ? (
                    <span className="text-xs text-red-600 font-bold">
                      {Math.abs(daysUntilDeadline)}日超過
                    </span>
                  ) : (
                    <span className={`text-xs font-medium ${
                      daysUntilDeadline <= 3 ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      <Clock size={10} className="inline mr-0.5" />
                      {currentMonth}/{task.deadlineDay}まで
                    </span>
                  )}
                </div>

                {/* リンク */}
                {status !== 'done' && (
                  <a
                    href={task.href}
                    className="shrink-0 w-7 h-7 rounded-lg bg-gray-50 hover:bg-primary/10 flex items-center justify-center transition-colors"
                    title="該当機能へ"
                  >
                    <ArrowRight size={14} className="text-gray-400" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* 完了取消し確認モーダル */}
      <ConfirmModal
        isOpen={undoConfirmTaskId !== null}
        title="完了を取り消しますか？"
        message={`「${monthlyTasks.find(t => t.id === undoConfirmTaskId)?.label ?? ''}」の完了マークを外します。`}
        confirmLabel="取り消す"
        cancelLabel="やめる"
        isDestructive
        onConfirm={() => {
          if (undoConfirmTaskId) {
            applyToggle(undoConfirmTaskId);
          }
          setUndoConfirmTaskId(null);
        }}
        onCancel={() => setUndoConfirmTaskId(null)}
      />
    </div>
  );
};

export default MonthlyOperationsPanel;
