/**
 * 変更届管理リストコンポーネント（一気通貫フロー対応版）
 *
 * 変更検知 → 影響分析 → 書類自動生成 → PDF出力 → 提出管理
 * ローカルファイル操作不要、Roots上で全て完結
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Download,
  Send,
  Eye,
  History,
  Filter,
  Calendar,
  ArrowRight,
  Printer,
  FileCheck,
  ListChecks,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import type { ChangeNotification, ChangeNotificationStatus, ChangeNotificationType, FacilitySettings } from '@/types';
import {
  CHANGE_NOTIFICATION_TYPE_LABELS,
  CHANGE_NOTIFICATION_STATUS_CONFIG,
} from '@/types';
import {
  daysUntilDeadline,
  getDeadlineColor,
  getDeadlineBgColor,
} from '@/hooks/useChangeNotifications';
import { exportChangeNotificationToExcel } from '@/lib/excelEngine';
import {
  generateChangeNotificationHTML,
  generateOperatingRegulationsHTML,
  openPrintWindow,
  analyzeChangeImpact,
  CHANGE_IMPACT_MAP,
  CHANGE_TYPE_LABELS,
  type FacilityInfo,
  type ChangeImpactAnalysis,
} from '@/lib/changeDocumentEngine';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

type ViewMode = 'active' | 'timeline';

interface ChangeNotificationListProps {
  notifications: ChangeNotification[];
  onUpdateStatus: (id: string, status: ChangeNotificationStatus) => Promise<void>;
  onRefetch: () => Promise<void>;
  facilitySettings?: FacilitySettings;
  facilityInfo?: FacilityInfo;
  designationDate?: string;
  designatedServiceTypes?: string[];
  socialInsurance?: Record<string, boolean>;
  complaintResolution?: Record<string, string>;
  primaryDisabilityTypes?: string[];
}

export default function ChangeNotificationList({
  notifications,
  onUpdateStatus,
  onRefetch,
  facilitySettings,
  facilityInfo,
  designationDate,
  designatedServiceTypes,
  socialInsurance,
  complaintResolution,
  primaryDisabilityTypes,
}: ChangeNotificationListProps) {
  const { facility } = useAuth();
  const { toast } = useToast();
  const [selectedNotification, setSelectedNotification] = useState<ChangeNotification | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = notifications;

    if (filter !== 'all') {
      result = result.filter((n) => {
        if (filter === 'pending') return n.status === 'pending' || n.status === 'in_progress';
        return n.status === filter;
      });
    }

    if (viewMode === 'timeline') {
      if (dateFrom) {
        const from = new Date(dateFrom);
        result = result.filter((n) => new Date(n.detectedAt) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        result = result.filter((n) => new Date(n.detectedAt) <= to);
      }
    }

    return result;
  }, [notifications, filter, viewMode, dateFrom, dateTo]);

  // 施設情報（PDF生成用）
  const fi: FacilityInfo = facilityInfo || {
    name: facility?.name || '',
    code: facility?.code || '',
  };

  // ──── 変更届出書PDF生成 ────
  const handleGenerateChangeNotification = useCallback((notification: ChangeNotification) => {
    setGeneratingDoc(notification.id);
    try {
      const html = generateChangeNotificationHTML({
        facility: fi,
        changeType: notification.changeType,
        changeDescription: notification.changeDescription || '',
        oldValue: notification.oldValue || {},
        newValue: notification.newValue || {},
        detectedAt: notification.detectedAt,
        deadline: notification.deadline,
      });
      openPrintWindow(html);
    } finally {
      setTimeout(() => setGeneratingDoc(null), 1000);
    }
  }, [fi]);

  // ──── 運営規程PDF生成 ────
  const handleGenerateRegulations = useCallback((notification: ChangeNotification) => {
    if (!facilitySettings) {
      toast.error('施設設定を読み込めませんでした');
      return;
    }

    // 変更された条文をハイライト
    const impact = analyzeChangeImpact(notification.changeType, new Date(notification.detectedAt));
    const html = generateOperatingRegulationsHTML({
      facility: fi,
      settings: facilitySettings,
      designationDate,
      designatedServiceTypes,
      complaintResolution,
      primaryDisabilityTypes,
      changedSections: impact.affectedRegulationSections,
    });
    openPrintWindow(html);
  }, [fi, facilitySettings, designationDate, designatedServiceTypes, complaintResolution, primaryDisabilityTypes]);

  // ──── Excel出力（従来互換） ────
  const handleExport = (notification: ChangeNotification) => {
    exportChangeNotificationToExcel(notification, facility?.name);
  };

  // ──── CSV出力 ────
  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) return;
    const headers = ['検出日', '変更タイプ', '説明', 'ステータス', '期限', '提出日', '変更前', '変更後'];
    const rows = filtered.map((n) => [
      new Date(n.detectedAt).toLocaleDateString('ja-JP'),
      CHANGE_NOTIFICATION_TYPE_LABELS[n.changeType],
      n.changeDescription || '',
      CHANGE_NOTIFICATION_STATUS_CONFIG[n.status].label,
      new Date(n.deadline).toLocaleDateString('ja-JP'),
      n.submittedAt ? new Date(n.submittedAt).toLocaleDateString('ja-JP') : '',
      JSON.stringify(n.oldValue || {}),
      JSON.stringify(n.newValue || {}),
    ]);
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `変更届履歴_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // タイムラインのグループ化
  const timelineGroups = useMemo(() => {
    const groups: Record<string, ChangeNotification[]> = {};
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
    sorted.forEach((n) => {
      const d = new Date(n.detectedAt);
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  }, [filtered]);

  // ──── 影響書類の取得 ────
  const getImpactDocs = (changeType: string) => {
    return CHANGE_IMPACT_MAP[changeType] || [];
  };

  // 変更前後の読みやすい表示
  const formatChangePreview = (changeType: string, value: Record<string, any>): string => {
    if (!value || Object.keys(value).length === 0) return '-';
    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
    switch (changeType) {
      case 'business_hours': {
        const bh = value.businessHours;
        const holidays = value.regularHolidays;
        let text = '';
        if (bh && bh.AM && bh.PM) {
          text += `${bh.AM.start}〜${bh.AM.end} / ${bh.PM.start}〜${bh.PM.end}`;
        }
        if (Array.isArray(holidays) && holidays.length > 0) {
          text += ` 休: ${holidays.map((d: number) => WEEKDAYS[d]).join('')}`;
        }
        return text || JSON.stringify(value).substring(0, 80);
      }
      case 'capacity': {
        const cap = value.capacity;
        return cap ? `午前${cap.AM}名/午後${cap.PM}名` : JSON.stringify(value).substring(0, 80);
      }
      case 'facility_name':
        return value.facilityName || '-';
      case 'address':
        return `〒${value.postalCode || ''} ${value.address || ''}`;
      default:
        return JSON.stringify(value).substring(0, 80);
    }
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              変更届管理
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              設定変更 → 書類自動生成 → PDF出力 → 提出管理をワンストップで
            </p>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold"
            >
              <Download size={12} />
              CSV出力
            </button>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 mt-4">
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === 'active'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ListChecks size={12} className="inline mr-1" />
              届出管理
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === 'timeline'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <History size={12} className="inline mr-1" />
              変更履歴
            </button>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {[
            { id: 'all' as const, label: '全て' },
            { id: 'pending' as const, label: '未対応' },
            { id: 'submitted' as const, label: '提出済' },
            { id: 'completed' as const, label: '完了' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                filter === f.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.id === 'pending' && notifications.filter(n => n.status === 'pending' || n.status === 'in_progress').length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full">
                  {notifications.filter(n => n.status === 'pending' || n.status === 'in_progress').length}
                </span>
              )}
            </button>
          ))}

          {viewMode === 'timeline' && (
            <div className="flex items-center gap-2 ml-auto">
              <Filter size={12} className="text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary"
              />
              <span className="text-xs text-gray-400">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  クリア
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== Active View ========== */}
      {viewMode === 'active' && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="font-medium text-gray-600">
                {filter === 'pending' ? '未対応の変更届はありません' : '変更届がありません'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                施設設定の変更時に自動的に通知が作成されます
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((notification) => {
                const daysLeft = daysUntilDeadline(notification.deadline);
                const statusConfig = CHANGE_NOTIFICATION_STATUS_CONFIG[notification.status];
                const isSelected = selectedNotification?.id === notification.id;
                const impactDocs = getImpactDocs(notification.changeType);
                const autoGenerableDocs = impactDocs.filter(d => d.autoGenerable);
                const manualDocs = impactDocs.filter(d => !d.autoGenerable);

                return (
                  <div
                    key={notification.id}
                    className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                      isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100'
                    }`}
                  >
                    {/* メイン行 */}
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedNotification(isSelected ? null : notification)}
                    >
                      <div className="flex items-center gap-4">
                        {/* 期限インジケーター */}
                        <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center shrink-0 ${getDeadlineBgColor(daysLeft)}`}>
                          {notification.status === 'completed' || notification.status === 'submitted' ? (
                            <CheckCircle size={20} className="text-green-600" />
                          ) : daysLeft < 0 ? (
                            <>
                              <AlertTriangle size={14} className="text-red-600" />
                              <span className="text-[9px] font-bold text-red-700">超過</span>
                            </>
                          ) : (
                            <>
                              <span className={`text-lg font-bold ${getDeadlineColor(daysLeft)}`}>{daysLeft}</span>
                              <span className={`text-[9px] ${getDeadlineColor(daysLeft)}`}>日</span>
                            </>
                          )}
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-800">
                              {CHANGE_NOTIFICATION_TYPE_LABELS[notification.changeType]}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            {autoGenerableDocs.length > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">
                                <Sparkles size={9} className="inline mr-0.5" />
                                {autoGenerableDocs.length}件自動生成可
                              </span>
                            )}
                          </div>

                          {/* 変更前→変更後のプレビュー */}
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                              {formatChangePreview(notification.changeType, notification.oldValue || {})}
                            </span>
                            <ArrowRight size={10} className="text-gray-400 shrink-0" />
                            <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded truncate max-w-[180px] font-bold">
                              {formatChangePreview(notification.changeType, notification.newValue || {})}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                            <span>検出: {new Date(notification.detectedAt).toLocaleDateString('ja-JP')}</span>
                            <span>期限: {new Date(notification.deadline).toLocaleDateString('ja-JP')}</span>
                            {notification.submittedAt && (
                              <span>提出: {new Date(notification.submittedAt).toLocaleDateString('ja-JP')}</span>
                            )}
                          </div>
                        </div>

                        {/* 展開アイコン */}
                        <div className="shrink-0">
                          {isSelected ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} className="text-gray-400" />}
                        </div>
                      </div>
                    </div>

                    {/* ====== 展開時: 一気通貫フロー ====== */}
                    {isSelected && (
                      <div className="border-t border-gray-100">
                        {/* Step 1: 影響分析 */}
                        <div className="p-4 bg-gradient-to-r from-blue-50/50 to-transparent">
                          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-3">
                            <ListChecks size={14} className="text-blue-600" />
                            必要書類一覧
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {impactDocs.map((doc, i) => (
                              <div
                                key={i}
                                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                                  doc.autoGenerable
                                    ? 'bg-emerald-50/50 border-emerald-200'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {doc.autoGenerable ? (
                                    <Sparkles size={12} className="text-emerald-600 shrink-0" />
                                  ) : (
                                    <FileText size={12} className="text-gray-400 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <span className="font-bold text-gray-800 block truncate">{doc.name}</span>
                                    <span className="text-[10px] text-gray-500">{doc.description}</span>
                                  </div>
                                </div>
                                {doc.autoGenerable && doc.generator === 'change_notification' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGenerateChangeNotification(notification);
                                    }}
                                    disabled={generatingDoc === notification.id}
                                    className="shrink-0 ml-2 flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                  >
                                    <Printer size={10} />
                                    PDF
                                  </button>
                                )}
                                {doc.autoGenerable && doc.generator === 'operating_regulations' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGenerateRegulations(notification);
                                    }}
                                    className="shrink-0 ml-2 flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors"
                                  >
                                    <Printer size={10} />
                                    PDF
                                  </button>
                                )}
                                {!doc.autoGenerable && (
                                  <span className="shrink-0 ml-2 text-[10px] text-gray-400 px-2 py-1 bg-gray-100 rounded">
                                    手動準備
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Step 2: 変更前後の詳細比較 */}
                        <div className="p-4 bg-gray-50/50">
                          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-3">
                            <Eye size={14} className="text-gray-600" />
                            変更前後の詳細
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] font-bold text-red-600 mb-1">変更前</div>
                              <div className="bg-white p-3 rounded-lg border border-red-100 text-xs text-gray-700 whitespace-pre-wrap min-h-[60px]">
                                {formatChangePreview(notification.changeType, notification.oldValue || {})}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-green-700 mb-1">変更後</div>
                              <div className="bg-white p-3 rounded-lg border border-green-100 text-xs text-gray-700 whitespace-pre-wrap min-h-[60px] font-bold">
                                {formatChangePreview(notification.changeType, notification.newValue || {})}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Step 3: アクションバー */}
                        <div className="p-4 bg-white border-t border-gray-100 flex flex-wrap items-center gap-2">
                          {/* 一括PDF生成 */}
                          {autoGenerableDocs.length > 0 && (notification.status === 'pending' || notification.status === 'in_progress') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateChangeNotification(notification);
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-bold shadow-sm"
                            >
                              <Printer size={14} />
                              変更届出書を生成
                            </button>
                          )}

                          {facilitySettings && (notification.status === 'pending' || notification.status === 'in_progress') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateRegulations(notification);
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-sm"
                            >
                              <FileCheck size={14} />
                              運営規程を生成
                            </button>
                          )}

                          {/* Excel出力（従来互換） */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExport(notification);
                            }}
                            className="flex items-center gap-1 px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold"
                          >
                            <Download size={12} />
                            Excel
                          </button>

                          {/* ステータス変更 */}
                          <div className="ml-auto flex items-center gap-2">
                            {notification.status === 'pending' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateStatus(notification.id, 'in_progress');
                                }}
                                className="flex items-center gap-1 px-3 py-2 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-bold"
                              >
                                <Clock size={12} />
                                対応中にする
                              </button>
                            )}
                            {(notification.status === 'pending' || notification.status === 'in_progress') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateStatus(notification.id, 'submitted');
                                }}
                                className="flex items-center gap-1 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-bold"
                              >
                                <Send size={12} />
                                提出済にする
                              </button>
                            )}
                            {notification.status === 'submitted' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateStatus(notification.id, 'completed');
                                }}
                                className="flex items-center gap-1 px-3 py-2 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-bold"
                              >
                                <CheckCircle size={12} />
                                完了にする
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========== Timeline View ========== */}
      {viewMode === 'timeline' && (
        <>
          {Object.keys(timelineGroups).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <EmptyState
                icon={<History className="w-7 h-7 text-gray-400" />}
                title="変更履歴がありません"
                description="施設設定の変更時に履歴が自動的に記録されます"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(timelineGroups).map(([monthLabel, items]) => (
                <div key={monthLabel}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} className="text-primary" />
                    <h4 className="text-sm font-bold text-gray-700">{monthLabel}</h4>
                    <span className="text-xs text-gray-400">{items.length}件</span>
                  </div>

                  <div className="relative ml-4 pl-6 border-l-2 border-gray-200 space-y-4">
                    {items.map((notification) => {
                      const statusConfig = CHANGE_NOTIFICATION_STATUS_CONFIG[notification.status];
                      const detectedDate = new Date(notification.detectedAt);

                      return (
                        <div key={notification.id} className="relative">
                          <div
                            className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white ${
                              notification.status === 'completed'
                                ? 'bg-green-500'
                                : notification.status === 'submitted'
                                ? 'bg-blue-500'
                                : notification.status === 'in_progress'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          />

                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-gray-800">
                                    {CHANGE_NOTIFICATION_TYPE_LABELS[notification.changeType]}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                                    {statusConfig.label}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {notification.changeDescription || '変更内容の説明なし'}
                                </p>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <p className="text-xs font-bold text-gray-600">
                                  {detectedDate.getMonth() + 1}/{detectedDate.getDate()}
                                </p>
                                <p className="text-[10px] text-gray-400">{detectedDate.getFullYear()}</p>
                              </div>
                            </div>

                            {notification.oldValue && Object.keys(notification.oldValue).length > 0 && (
                              <div className="mt-3 flex items-center gap-3 text-xs">
                                <div className="bg-red-50 rounded px-2 py-1 text-red-700 flex-1 truncate">
                                  {formatChangePreview(notification.changeType, notification.oldValue)}
                                </div>
                                <ArrowRight size={12} className="text-gray-400 shrink-0" />
                                <div className="bg-green-50 rounded px-2 py-1 text-green-700 flex-1 truncate font-bold">
                                  {formatChangePreview(notification.changeType, notification.newValue || {})}
                                </div>
                              </div>
                            )}

                            <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-400">
                              <span>期限: {new Date(notification.deadline).toLocaleDateString('ja-JP')}</span>
                              {notification.submittedAt && (
                                <span>提出日: {new Date(notification.submittedAt).toLocaleDateString('ja-JP')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
