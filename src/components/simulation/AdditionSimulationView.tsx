/**
 * 加算シミュレーションビュー
 * 児発管向け：児童別月間加算計画と売上見込み
 */

'use client';

import React, { useState } from 'react';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Save,
  Copy,
  BarChart3,
  Users,
  Calendar,
  AlertCircle,
  Check,
  Settings,
} from 'lucide-react';
import { useAdditionSimulation, PLANNABLE_ADDITIONS } from '@/hooks/useAdditionSimulation';
import ChildAdditionCard from './ChildAdditionCard';
import SimulationSummaryPanel from './SimulationSummaryPanel';

const AdditionSimulationView: React.FC = () => {
  const {
    selectedMonth,
    setSelectedMonth,
    children,
    plannableAdditions,
    plans,
    childResults,
    summary,
    showComparison,
    setShowComparison,
    isLoading,
    isSaving,
    error,
    updatePlan,
    savePlans,
    copyFromPreviousMonth,
    monthlyLimits,
    isConfigured,
  } = useAdditionSimulation();

  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 月を変更
  const changeMonth = (delta: number) => {
    const newMonth = selectedMonth.month + delta;
    if (newMonth < 1) {
      setSelectedMonth({ year: selectedMonth.year - 1, month: 12 });
    } else if (newMonth > 12) {
      setSelectedMonth({ year: selectedMonth.year + 1, month: 1 });
    } else {
      setSelectedMonth({ ...selectedMonth, month: newMonth });
    }
  };

  // 保存処理
  const handleSave = async () => {
    await savePlans();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // 前月コピー処理
  const handleCopy = async () => {
    await copyFromPreviousMonth();
    setShowCopyConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">データを読み込み中...</span>
      </div>
    );
  }

  // 施設設定が未完了の場合はガイダンスを表示
  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calculator className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">加算シミュレーション</h1>
              <p className="text-sm text-gray-500">児童別の月間加算計画と売上見込み</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            施設設定が必要です
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            加算シミュレーションを行うには、まず施設情報で<br />
            <strong>サービス種別</strong>と<strong>地域区分</strong>を設定してください。
          </p>
          <p className="text-xs text-gray-500">
            設定することで、正確な報酬単価と基本報酬を使った<br />
            シミュレーションが可能になります。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calculator className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">加算シミュレーション</h1>
              <p className="text-sm text-gray-500">児童別の月間加算計画と売上見込み</p>
            </div>
          </div>

          {/* 月選択 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="font-bold text-gray-800 min-w-[100px] text-center">
                {selectedMonth.year}年{selectedMonth.month}月
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showComparison
                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-medium">計画/実績</span>
            </button>

            <button
              onClick={() => setShowCopyConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span className="text-sm font-medium">前月コピー</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {saveSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {isSaving ? '保存中...' : saveSuccess ? '保存完了' : '計画を保存'}
              </span>
            </button>
          </div>
        </div>

        {/* サマリーバー */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>対象児童</span>
            </div>
            <div className="text-lg font-bold text-gray-800">{summary.totalChildren}名</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>予定利用日数</span>
            </div>
            <div className="text-lg font-bold text-gray-800">{summary.totalScheduledDays}日</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">総単位数</div>
            <div className="text-lg font-bold text-purple-700">{summary.totalUnits.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3 text-white">
            <div className="text-purple-100 text-xs mb-1">売上見込み</div>
            <div className="text-lg font-bold">¥{summary.totalRevenue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 児童別計画 */}
        <div className="lg:col-span-2 space-y-4">
          {children.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">対象児童がいません</p>
              <p className="text-sm text-gray-400 mt-1">
                スケジュールに登録された児童がここに表示されます
              </p>
            </div>
          ) : (
            childResults.map(result => (
              <ChildAdditionCard
                key={result.child.id}
                result={result}
                additions={plannableAdditions}
                onUpdatePlan={updatePlan}
                showComparison={showComparison}
                monthlyLimits={monthlyLimits}
              />
            ))
          )}
        </div>

        {/* サマリーパネル */}
        <div className="lg:col-span-1">
          <SimulationSummaryPanel
            summary={summary}
            additions={plannableAdditions}
            showComparison={showComparison}
          />
        </div>
      </div>

      {/* 前月コピー確認モーダル */}
      {showCopyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-3">前月の計画をコピー</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedMonth.month === 1 ? selectedMonth.year - 1 : selectedMonth.year}年
              {selectedMonth.month === 1 ? 12 : selectedMonth.month - 1}月の計画を
              コピーしますか？
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
              現在の入力内容は上書きされます。保存前にコピーすることをお勧めします。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCopyConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                コピーする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdditionSimulationView;
