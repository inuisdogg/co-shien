'use client';

/**
 * 採用分析ダッシュボード
 * 施設管理者向けの採用活動KPIとトレンドを表示する。
 * CSS ベースのチャートを使用（外部チャートライブラリ不要）。
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Users,
  TrendingUp,
  Clock,
  Send,
  Star,
  BarChart3,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useRecruitmentAnalytics, DateRange } from '@/hooks/useRecruitmentAnalytics';

// ================================================================
// Props
// ================================================================

interface RecruitmentAnalyticsViewProps {
  facilityId: string;
}

// ================================================================
// Date Range Presets
// ================================================================

type PresetKey = 'this_month' | 'last_month' | '3_months' | '6_months' | '1_year' | 'all';

const DATE_PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'this_month', label: '今月' },
  { key: 'last_month', label: '先月' },
  { key: '3_months', label: '3ヶ月' },
  { key: '6_months', label: '半年' },
  { key: '1_year', label: '1年' },
  { key: 'all', label: '全期間' },
];

function getDateRange(preset: PresetKey): DateRange | undefined {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  switch (preset) {
    case 'this_month': {
      const start = new Date(year, month, 1);
      return {
        start: formatDateISO(start),
        end: formatDateISO(now),
      };
    }
    case 'last_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0); // last day of previous month
      return {
        start: formatDateISO(start),
        end: formatDateISO(end),
      };
    }
    case '3_months': {
      const start = new Date(year, month - 2, 1);
      return {
        start: formatDateISO(start),
        end: formatDateISO(now),
      };
    }
    case '6_months': {
      const start = new Date(year, month - 5, 1);
      return {
        start: formatDateISO(start),
        end: formatDateISO(now),
      };
    }
    case '1_year': {
      const start = new Date(year - 1, month, 1);
      return {
        start: formatDateISO(start),
        end: formatDateISO(now),
      };
    }
    case 'all':
      return undefined;
  }
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ================================================================
// Status labels & colors
// ================================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  applied: { label: '応募', color: 'bg-blue-500', bgColor: 'bg-blue-100 text-blue-700' },
  screening: { label: '選考中', color: 'bg-yellow-500', bgColor: 'bg-yellow-100 text-yellow-700' },
  interview_scheduled: { label: '面接予定', color: 'bg-purple-400', bgColor: 'bg-purple-100 text-purple-700' },
  interviewed: { label: '面接済', color: 'bg-purple-600', bgColor: 'bg-purple-100 text-purple-700' },
  offer_sent: { label: '内定通知', color: 'bg-green-400', bgColor: 'bg-green-100 text-green-700' },
  offer_accepted: { label: '内定承諾', color: 'bg-green-600', bgColor: 'bg-green-100 text-green-700' },
  hired: { label: '採用', color: 'bg-emerald-500', bgColor: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '不採用', color: 'bg-red-500', bgColor: 'bg-red-100 text-red-700' },
  withdrawn: { label: '辞退', color: 'bg-gray-400', bgColor: 'bg-gray-100 text-gray-600' },
};

// Ordered statuses for the stacked bar
const STATUS_ORDER = [
  'applied',
  'screening',
  'interview_scheduled',
  'interviewed',
  'offer_sent',
  'offer_accepted',
  'hired',
  'rejected',
  'withdrawn',
];

// ================================================================
// Helper
// ================================================================

function formatMonthLabel(ym: string): string {
  const parts = ym.split('-');
  if (parts.length !== 2) return ym;
  return `${Number(parts[1])}月`;
}

function formatMonthLabelFull(ym: string): string {
  const parts = ym.split('-');
  if (parts.length !== 2) return ym;
  return `${parts[0]}年${Number(parts[1])}月`;
}

// ================================================================
// Component
// ================================================================

export default function RecruitmentAnalyticsView({ facilityId }: RecruitmentAnalyticsViewProps) {
  const { metrics, loading, error, fetchMetrics } = useRecruitmentAnalytics();
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('all');

  // Fetch on mount and when preset changes
  useEffect(() => {
    if (!facilityId) return;
    const range = getDateRange(selectedPreset);
    fetchMetrics(facilityId, range);
  }, [facilityId, selectedPreset, fetchMetrics]);

  // Max value for bar chart scaling
  const maxMonthlyCount = useMemo(() => {
    if (metrics.applicationsByMonth.length === 0) return 1;
    return Math.max(...metrics.applicationsByMonth.map(m => m.count), 1);
  }, [metrics.applicationsByMonth]);

  // Total across all statuses for stacked bar
  const totalStatusCount = useMemo(() => {
    return Object.values(metrics.applicationsByStatus).reduce((s, v) => s + v, 0);
  }, [metrics.applicationsByStatus]);

  // Render stars
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const filled = rating >= i;
      const half = !filled && rating >= i - 0.5;
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${
            filled
              ? 'text-yellow-400 fill-yellow-400'
              : half
              ? 'text-yellow-400 fill-yellow-200'
              : 'text-gray-300'
          }`}
        />
      );
    }
    return stars;
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading && totalStatusCount === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#00c4cc] mr-2" />
        <span className="text-gray-500">分析データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* Header */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-[#00c4cc]" />
          <h2 className="text-lg font-bold text-gray-800">採用分析ダッシュボード</h2>
        </div>

        {/* Date range preset buttons */}
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map(preset => (
            <button
              key={preset.key}
              onClick={() => setSelectedPreset(preset.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                selectedPreset === preset.key
                  ? 'bg-[#00c4cc] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ============================================================ */}
      {/* KPI Cards (6-grid) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Card 1: 掲載中 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-[#0d9488]" />
            </div>
            <span className="text-xs text-gray-500">掲載中の求人</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-800">{metrics.activeJobPostings}</span>
            <span className="text-xs text-gray-400">/ {metrics.totalJobPostings} 件</span>
          </div>
        </div>

        {/* Card 2: 総応募数 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">総応募数</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-800">{metrics.totalApplications}</span>
            <span className="text-xs text-gray-400">件</span>
          </div>
        </div>

        {/* Card 3: 採用率 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500">採用率</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-800">{metrics.conversionRate}</span>
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>

        {/* Card 4: 平均採用日数 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-xs text-gray-500">平均採用日数</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-800">
              {metrics.averageTimeToHire > 0 ? metrics.averageTimeToHire : '-'}
            </span>
            {metrics.averageTimeToHire > 0 && (
              <span className="text-sm text-gray-500">日</span>
            )}
          </div>
        </div>

        {/* Card 5: スカウト返信率 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Send className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">スカウト</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-800">
              {metrics.scoutsSent > 0 ? `${metrics.scoutResponseRate}%` : '-'}
            </span>
            {metrics.scoutsSent > 0 && (
              <span className="text-xs text-gray-400">返信 ({metrics.scoutsSent}件送信)</span>
            )}
          </div>
        </div>

        {/* Card 6: 平均評価 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Star className="w-4 h-4 text-yellow-500" />
            </div>
            <span className="text-xs text-gray-500">平均評価</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-800">
              {metrics.averageRating > 0 ? metrics.averageRating : '-'}
            </span>
            {metrics.averageRating > 0 && (
              <div className="flex items-center gap-0.5">
                {renderStars(metrics.averageRating)}
              </div>
            )}
          </div>
          {metrics.reviewCount > 0 && (
            <p className="text-xs text-gray-400 mt-1">{metrics.reviewCount}件のレビュー</p>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Application Status Breakdown (Stacked Bar) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">応募ステータス内訳</h3>

        {totalStatusCount === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">応募データがありません</p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="flex h-8 rounded-lg overflow-hidden mb-4">
              {STATUS_ORDER.map(status => {
                const count = metrics.applicationsByStatus[status] || 0;
                if (count === 0) return null;
                const pct = (count / totalStatusCount) * 100;
                const cfg = STATUS_CONFIG[status];
                return (
                  <div
                    key={status}
                    className={`${cfg?.color || 'bg-gray-300'} relative group transition-all`}
                    style={{ width: `${pct}%`, minWidth: count > 0 ? '4px' : '0' }}
                    title={`${cfg?.label || status}: ${count}件 (${Math.round(pct)}%)`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                      <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {cfg?.label || status}: {count}件
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {STATUS_ORDER.map(status => {
                const count = metrics.applicationsByStatus[status] || 0;
                if (count === 0) return null;
                const cfg = STATUS_CONFIG[status];
                return (
                  <div key={status} className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2.5 h-2.5 rounded-sm ${cfg?.color || 'bg-gray-300'}`} />
                    <span className="text-gray-600">{cfg?.label || status}</span>
                    <span className="font-medium text-gray-800">{count}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* Monthly Applications Chart */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">月別応募数推移</h3>

        {metrics.applicationsByMonth.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">応募データがありません</p>
        ) : (
          <div className="flex items-end gap-2 h-48 px-2">
            {metrics.applicationsByMonth.map(({ month, count }) => {
              const heightPct = (count / maxMonthlyCount) * 100;
              return (
                <div
                  key={month}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                >
                  {/* Count label */}
                  <span className="text-xs font-medium text-gray-600">{count}</span>

                  {/* Bar */}
                  <div className="w-full flex justify-center" style={{ height: '140px' }}>
                    <div className="relative w-full max-w-[40px] flex items-end">
                      <div
                        className="w-full bg-[#00c4cc] rounded-t-md transition-all duration-500 hover:bg-[#0d9488]"
                        style={{
                          height: `${Math.max(heightPct, 2)}%`,
                        }}
                        title={`${formatMonthLabelFull(month)}: ${count}件`}
                      />
                    </div>
                  </div>

                  {/* Month label */}
                  <span className="text-xs text-gray-500 truncate w-full text-center">
                    {formatMonthLabel(month)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Top Performing Job Postings */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">求人別パフォーマンス</h3>

        {metrics.topJobPostings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">求人データがありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">求人タイトル</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">応募数</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">採用数</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">採用率</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topJobPostings.map((posting, idx) => {
                  const rate = posting.applicationCount > 0
                    ? Math.round((posting.hiredCount / posting.applicationCount) * 1000) / 10
                    : 0;
                  return (
                    <tr
                      key={posting.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        idx === 0 ? '' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400 w-4">{idx + 1}</span>
                          <span className="text-gray-800 truncate max-w-[200px] sm:max-w-[300px]">
                            {posting.title}
                          </span>
                          <ExternalLink className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-gray-700">
                        {posting.applicationCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                        {posting.hiredCount}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          rate > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-50 text-gray-500'
                        }`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Scout Performance */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">スカウト実績</h3>

        {metrics.scoutsSent === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">スカウトデータがありません</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Sent count */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">送信数</p>
              <p className="text-xl font-bold text-gray-800">{metrics.scoutsSent}</p>
              <p className="text-xs text-gray-400">件</p>
            </div>

            {/* Response rate */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">返信率</p>
              <p className="text-xl font-bold text-[#00c4cc]">{metrics.scoutResponseRate}%</p>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00c4cc] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(metrics.scoutResponseRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Response count */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">返信数</p>
              <p className="text-xl font-bold text-gray-800">
                {metrics.scoutsSent > 0
                  ? Math.round(metrics.scoutsSent * metrics.scoutResponseRate / 100)
                  : 0}
              </p>
              <p className="text-xs text-gray-400">件</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
