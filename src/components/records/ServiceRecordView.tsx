'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Download,
  Printer,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  FileSpreadsheet,
  BarChart3,
  Search,
  Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  generateServiceRecord,
  generateMonthlyServiceRecords,
  exportServiceRecordToExcel,
  exportAllServiceRecordsToExcel,
  generateServiceRecordHTML,
} from '@/lib/serviceRecordGenerator';
import type {
  ServiceRecord,
  ServiceRecordSummary,
  DailyServiceRecord,
} from '@/lib/serviceRecordGenerator';
import { openPrintWindow } from '@/lib/wordEngine';
import { supabase } from '@/lib/supabase';

// ---------- Types ----------

interface ChildOption {
  id: string;
  name: string;
  beneficiaryNumber?: string;
}

// ---------- Component ----------

export default function ServiceRecordView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  // Date selection
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // Child selection
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childSearchTerm, setChildSearchTerm] = useState('');

  // Data
  const [singleRecord, setSingleRecord] = useState<ServiceRecord | null>(null);
  const [summary, setSummary] = useState<ServiceRecordSummary | null>(null);

  // UI state
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'all'>('single');

  // Fetch children list
  useEffect(() => {
    if (!facilityId) {
      setLoadingChildren(false);
      return;
    }

    const fetchChildren = async () => {
      setLoadingChildren(true);
      try {
        const { data, error } = await supabase
          .from('children')
          .select('id, name, beneficiary_number')
          .eq('facility_id', facilityId)
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching children:', error);
          return;
        }

        const opts: ChildOption[] = (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          beneficiaryNumber: (row.beneficiary_number as string) ?? undefined,
        }));
        setChildren(opts);

        if (opts.length > 0 && !selectedChildId) {
          setSelectedChildId(opts[0].id);
        }
      } catch (err) {
        console.error('Error fetching children:', err);
      } finally {
        setLoadingChildren(false);
      }
    };

    fetchChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  // Filtered children for search
  const filteredChildren = useMemo(() => {
    if (!childSearchTerm) return children;
    const term = childSearchTerm.toLowerCase();
    return children.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.beneficiaryNumber && c.beneficiaryNumber.includes(term)),
    );
  }, [children, childSearchTerm]);

  // Navigate month
  const goToPreviousMonth = useCallback(() => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setSingleRecord(null);
    setSummary(null);
  }, [selectedMonth]);

  const goToNextMonth = useCallback(() => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setSingleRecord(null);
    setSummary(null);
  }, [selectedMonth]);

  // Generate single record
  const handleGenerateSingle = useCallback(async () => {
    if (!facilityId || !selectedChildId) return;
    setGenerating(true);
    setSingleRecord(null);
    try {
      const record = await generateServiceRecord(
        facilityId,
        selectedChildId,
        selectedYear,
        selectedMonth,
      );
      setSingleRecord(record);
    } catch (err) {
      console.error('Error generating service record:', err);
    } finally {
      setGenerating(false);
    }
  }, [facilityId, selectedChildId, selectedYear, selectedMonth]);

  // Generate all records
  const handleGenerateAll = useCallback(async () => {
    if (!facilityId) return;
    setGeneratingAll(true);
    setSummary(null);
    try {
      const result = await generateMonthlyServiceRecords(
        facilityId,
        selectedYear,
        selectedMonth,
      );
      setSummary(result);
    } catch (err) {
      console.error('Error generating all service records:', err);
    } finally {
      setGeneratingAll(false);
    }
  }, [facilityId, selectedYear, selectedMonth]);

  // Export single record to Excel
  const handleExportSingleExcel = useCallback(() => {
    if (!singleRecord) return;
    setExporting(true);
    try {
      exportServiceRecordToExcel(singleRecord);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [singleRecord]);

  // Export all records to Excel
  const handleExportAllExcel = useCallback(() => {
    if (!summary) return;
    setExporting(true);
    try {
      exportAllServiceRecordsToExcel(summary, selectedYear, selectedMonth);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [summary, selectedYear, selectedMonth]);

  // Print single record
  const handlePrintSingle = useCallback(() => {
    if (!singleRecord) return;
    const html = generateServiceRecordHTML(singleRecord);
    openPrintWindow(html);
  }, [singleRecord]);

  // Print from summary (specific child)
  const handlePrintFromSummary = useCallback((record: ServiceRecord) => {
    const html = generateServiceRecordHTML(record);
    openPrintWindow(html);
  }, []);

  // Export from summary (specific child)
  const handleExportFromSummary = useCallback((record: ServiceRecord) => {
    exportServiceRecordToExcel(record);
  }, []);

  // Get selected child name
  const selectedChildName = useMemo(() => {
    return children.find((c) => c.id === selectedChildId)?.name ?? '';
  }, [children, selectedChildId]);

  // Render loading state
  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
        <span className="text-gray-600">児童データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              サービス提供記録 / 月次実績記録票
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              児童ごとの月次サービス提供実績を生成・エクスポート
            </p>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="前月"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">
              {selectedYear}年{selectedMonth}月
            </span>
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="翌月"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'single'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-1" />
            個別生成
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            一括生成
          </button>
        </div>
      </div>

      {/* Single child tab */}
      {activeTab === 'single' && (
        <div className="space-y-4">
          {/* Child selector */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">児童を選択</h3>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={childSearchTerm}
                onChange={(e) => setChildSearchTerm(e.target.value)}
                placeholder="児童名・受給者番号で検索..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Child list */}
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {filteredChildren.length === 0 ? (
                <div className="p-3 text-sm text-gray-400 text-center">
                  該当する児童がいません
                </div>
              ) : (
                filteredChildren.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => {
                      setSelectedChildId(child.id);
                      setSingleRecord(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition-colors ${
                      selectedChildId === child.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {selectedChildId === child.id && (
                        <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{child.name}</span>
                      {child.beneficiaryNumber && (
                        <span className="text-xs text-gray-400">
                          ({child.beneficiaryNumber})
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Generate button */}
            <div className="mt-4">
              <button
                onClick={handleGenerateSingle}
                disabled={generating || !selectedChildId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {generating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {generating ? '生成中...' : `${selectedChildName}の記録を生成`}
              </button>
            </div>
          </div>

          {/* Single record preview */}
          {singleRecord && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Record header */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {singleRecord.childName} - {singleRecord.year}年{singleRecord.month}月
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      受給者番号: {singleRecord.recipientNumber || '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportSingleExcel}
                      disabled={exporting}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Excel
                    </button>
                    <button
                      onClick={handlePrintSingle}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      印刷
                    </button>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white rounded-lg p-3 text-center border">
                    <p className="text-2xl font-bold text-blue-700">{singleRecord.totalDays}</p>
                    <p className="text-xs text-gray-500">利用日数</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border">
                    <p className="text-2xl font-bold text-red-600">{singleRecord.totalAbsences}</p>
                    <p className="text-xs text-gray-500">欠席日数</p>
                  </div>
                </div>
              </div>

              {/* Record table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                        日付
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                        曜日
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                        利用
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                        開始
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                        終了
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                        支援内容
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                        担当者
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                        備考
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {singleRecord.dailyRecords.map((dr) => (
                      <DailyRecordRow
                        key={dr.date}
                        record={dr}
                        month={singleRecord.month}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All children tab */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Generate all button */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-700">全児童の記録を一括生成</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedYear}年{selectedMonth}月の全児童分のサービス提供記録を生成します
                </p>
              </div>
              <button
                onClick={handleGenerateAll}
                disabled={generatingAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {generatingAll ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                {generatingAll ? '生成中...' : '全児童の記録を生成'}
              </button>
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <>
              {/* Summary cards */}
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    サマリー
                  </h3>
                  <button
                    onClick={handleExportAllExcel}
                    disabled={exporting}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    全児童をExcelエクスポート
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{summary.totalChildren}</p>
                    <p className="text-xs text-blue-600">対象児童数</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{summary.totalServiceDays}</p>
                    <p className="text-xs text-green-600">利用日数合計</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">
                      {summary.averageDaysPerChild}
                    </p>
                    <p className="text-xs text-purple-600">平均利用日数</p>
                  </div>
                </div>
              </div>

              {/* Children list */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-700">児童別実績一覧</h3>
                </div>
                <div className="divide-y">
                  {summary.records.length === 0 ? (
                    <div className="p-8 text-center">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        該当する記録がありません
                      </p>
                    </div>
                  ) : (
                    summary.records.map((record) => (
                      <div
                        key={record.childId}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {record.childName}
                            </span>
                            {record.recipientNumber && (
                              <span className="text-xs text-gray-400">
                                ({record.recipientNumber})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-blue-600">
                              利用: {record.totalDays}日
                            </span>
                            {record.totalAbsences > 0 && (
                              <span className="text-xs text-red-500">
                                欠席: {record.totalAbsences}日
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <button
                            onClick={() => handleExportFromSummary(record)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            Excel
                          </button>
                          <button
                            onClick={() => handlePrintFromSummary(record)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Printer className="w-3 h-3" />
                            印刷
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state when no data generated yet */}
      {activeTab === 'single' && !singleRecord && !generating && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            児童を選択して「記録を生成」ボタンをクリックしてください
          </p>
        </div>
      )}

      {activeTab === 'all' && !summary && !generatingAll && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            「全児童の記録を生成」ボタンをクリックしてください
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

interface DailyRecordRowProps {
  record: DailyServiceRecord;
  month: number;
}

function DailyRecordRow({ record, month }: DailyRecordRowProps) {
  const isWeekend = record.dayOfWeek === '日' || record.dayOfWeek === '土';

  const attendLabel = record.attended ? '○' : record.isAbsence ? '欠' : '';
  const attendColor = record.attended
    ? 'text-green-600 font-bold'
    : record.isAbsence
      ? 'text-red-500 font-bold'
      : '';

  const rowBg = record.attended
    ? ''
    : record.isAbsence
      ? 'bg-red-50'
      : isWeekend
        ? 'bg-gray-50'
        : '';

  const weekdayColor =
    record.dayOfWeek === '日'
      ? 'text-red-500'
      : record.dayOfWeek === '土'
        ? 'text-blue-500'
        : 'text-gray-700';

  return (
    <tr className={`${rowBg} hover:bg-blue-50/30 transition-colors`}>
      <td className="px-3 py-1.5 text-sm text-gray-700 whitespace-nowrap">
        {month}/{record.date}
      </td>
      <td className={`px-2 py-1.5 text-sm text-center whitespace-nowrap ${weekdayColor}`}>
        {record.dayOfWeek}
      </td>
      <td className={`px-2 py-1.5 text-sm text-center ${attendColor}`}>
        {attendLabel}
      </td>
      <td className="px-2 py-1.5 text-sm text-center text-gray-600 whitespace-nowrap">
        {record.startTime ?? ''}
      </td>
      <td className="px-2 py-1.5 text-sm text-center text-gray-600 whitespace-nowrap">
        {record.endTime ?? ''}
      </td>
      <td className="px-3 py-1.5 text-xs text-gray-600 max-w-[200px] truncate">
        {record.serviceContent ?? ''}
      </td>
      <td className="px-2 py-1.5 text-xs text-center text-gray-600 whitespace-nowrap">
        {record.staffName ?? ''}
      </td>
      <td className="px-3 py-1.5 text-xs text-gray-500 max-w-[200px] truncate">
        {record.isAbsence && record.absenceReason
          ? record.absenceReason
          : record.notes ?? ''}
      </td>
    </tr>
  );
}
