'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  FileText,
  Download,
  Database,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  Clock,
  X,
  Edit3,
  Save,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBilling } from '@/hooks/useBilling';
import { BillingRecord, BillingDetail, ServiceCode, BillingAddition, BillingStatus } from '@/types';

// ─── ステータスバッジ設定 ───
const STATUS_CONFIG: Record<BillingStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'text-gray-600', bg: 'bg-gray-100', icon: Edit3 },
  confirmed: { label: '確定', color: 'text-blue-700', bg: 'bg-blue-100', icon: CheckCircle },
  submitted: { label: '提出済', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: FileText },
  paid: { label: '入金済', color: 'text-teal-700', bg: 'bg-teal-100', icon: Receipt },
};

type TabId = 'monthly' | 'detail' | 'csv' | 'codes';

const TAB_ITEMS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'monthly', label: '月次請求', icon: Receipt },
  { id: 'detail', label: '明細確認', icon: FileText },
  { id: 'csv', label: 'CSV出力', icon: Download },
  { id: 'codes', label: 'サービスコード', icon: Database },
];

const BillingView: React.FC = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const {
    billingRecords,
    billingDetails,
    serviceCodes,
    isLoading,
    error,
    fetchBillingRecords,
    fetchBillingDetails,
    fetchServiceCodes,
    generateMonthlyBilling,
    updateBillingRecord,
    updateBillingDetail,
    confirmBilling,
    exportCSV,
  } = useBilling();

  const [activeTab, setActiveTab] = useState<TabId>('monthly');
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [csvPreview, setCsvPreview] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const [codeCategory, setCodeCategory] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // 初期データ取得
  useEffect(() => {
    if (facilityId) {
      fetchBillingRecords(facilityId, yearMonth);
      fetchServiceCodes();
    }
  }, [facilityId, yearMonth, fetchBillingRecords, fetchServiceCodes]);

  // 成功メッセージ自動クリア
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ─── 月変更 ───
  const changeMonth = useCallback(
    (delta: number) => {
      const [y, m] = yearMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      const newYm = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      setYearMonth(newYm);
      setSelectedRecord(null);
      setShowDetailModal(false);
    },
    [yearMonth]
  );

  const yearMonthLabel = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number);
    return `${y}年${m}月`;
  }, [yearMonth]);

  // ─── 自動生成 ───
  const handleGenerate = useCallback(async () => {
    if (!facilityId) return;
    setIsGenerating(true);
    const records = await generateMonthlyBilling(facilityId, yearMonth);
    setIsGenerating(false);
    if (records.length > 0) {
      setSuccessMessage(`${records.length}件の請求データを生成しました`);
    }
  }, [facilityId, yearMonth, generateMonthlyBilling]);

  // ─── 一括確定 ───
  const handleConfirm = useCallback(async () => {
    if (!facilityId) return;
    setIsConfirming(true);
    const ok = await confirmBilling(facilityId, yearMonth);
    if (ok) {
      await fetchBillingRecords(facilityId, yearMonth);
      setSuccessMessage('全件を確定しました');
    }
    setIsConfirming(false);
  }, [facilityId, yearMonth, confirmBilling, fetchBillingRecords]);

  // ─── 行クリック → 明細モーダル ───
  const handleRowClick = useCallback(
    async (record: BillingRecord) => {
      setSelectedRecord(record);
      await fetchBillingDetails(record.id);
      setShowDetailModal(true);
    },
    [fetchBillingDetails]
  );

  // ─── CSV出力 ───
  const handleExportCSV = useCallback(async () => {
    if (!facilityId) return;
    const csv = await exportCSV(facilityId, yearMonth);
    setCsvPreview(csv);
  }, [facilityId, yearMonth, exportCSV]);

  const handleDownloadCSV = useCallback(() => {
    if (!csvPreview) return;
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvPreview], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `国保連請求_${yearMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [csvPreview, yearMonth]);

  // ─── 明細タブ用の児童選択 ───
  const uniqueChildren = useMemo(() => {
    const map = new Map<string, string>();
    billingRecords.forEach((r) => {
      if (!map.has(r.childId)) {
        map.set(r.childId, r.childName || r.childId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [billingRecords]);

  const selectedChildRecord = useMemo(
    () => billingRecords.find((r) => r.childId === selectedChildId) || null,
    [billingRecords, selectedChildId]
  );

  useEffect(() => {
    if (activeTab === 'detail' && uniqueChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(uniqueChildren[0].id);
    }
  }, [activeTab, uniqueChildren, selectedChildId]);

  useEffect(() => {
    if (activeTab === 'detail' && selectedChildRecord) {
      fetchBillingDetails(selectedChildRecord.id);
    }
  }, [activeTab, selectedChildRecord, fetchBillingDetails]);

  // CSV preview when switching to csv tab
  useEffect(() => {
    if (activeTab === 'csv' && facilityId) {
      handleExportCSV();
    }
  }, [activeTab, facilityId, handleExportCSV]);

  // ─── 明細編集ハンドラ ───
  const handleDetailUnitChange = useCallback(
    async (detail: BillingDetail, newUnits: number) => {
      await updateBillingDetail(detail.id, { unitCount: newUnits });
      // 合計を再計算
      if (selectedChildRecord) {
        const allDetails = billingDetails.map((d) =>
          d.id === detail.id ? { ...d, unitCount: newUnits } : d
        );
        const newTotal = allDetails.reduce((sum, d) => sum + d.unitCount, 0);
        const totalAmount = newTotal * selectedChildRecord.unitPrice;
        const copayAmount = Math.min(
          Math.floor(totalAmount * 0.1),
          selectedChildRecord.upperLimitAmount > 0 ? selectedChildRecord.upperLimitAmount : totalAmount
        );
        await updateBillingRecord(selectedChildRecord.id, {
          totalUnits: newTotal,
          totalAmount,
          copayAmount,
          insuranceAmount: totalAmount - copayAmount,
        });
        fetchBillingRecords(facilityId, yearMonth);
      }
    },
    [billingDetails, selectedChildRecord, updateBillingDetail, updateBillingRecord, facilityId, yearMonth, fetchBillingRecords]
  );

  const handleAddAddition = useCallback(
    async (detail: BillingDetail, addition: BillingAddition) => {
      const newAdditions = [...detail.additions, addition];
      const additionUnitsTotal = newAdditions.reduce((s, a) => s + a.units, 0);
      const baseUnits = detail.unitCount - detail.additions.reduce((s, a) => s + a.units, 0);
      const newUnitCount = baseUnits + additionUnitsTotal;
      await updateBillingDetail(detail.id, { additions: newAdditions, unitCount: newUnitCount });
      if (selectedChildRecord) {
        await fetchBillingDetails(selectedChildRecord.id);
        fetchBillingRecords(facilityId, yearMonth);
      }
    },
    [updateBillingDetail, selectedChildRecord, fetchBillingDetails, facilityId, yearMonth, fetchBillingRecords]
  );

  const handleRemoveAddition = useCallback(
    async (detail: BillingDetail, index: number) => {
      const removed = detail.additions[index];
      const newAdditions = detail.additions.filter((_, i) => i !== index);
      const newUnitCount = detail.unitCount - removed.units;
      await updateBillingDetail(detail.id, { additions: newAdditions, unitCount: newUnitCount });
      if (selectedChildRecord) {
        await fetchBillingDetails(selectedChildRecord.id);
        fetchBillingRecords(facilityId, yearMonth);
      }
    },
    [updateBillingDetail, selectedChildRecord, fetchBillingDetails, facilityId, yearMonth, fetchBillingRecords]
  );

  // ─── サービスコードフィルタ ───
  const filteredCodes = useMemo(() => {
    let codes = serviceCodes;
    if (codeCategory !== 'all') {
      codes = codes.filter((c) => c.category === codeCategory);
    }
    if (codeSearch) {
      const q = codeSearch.toLowerCase();
      codes = codes.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }
    return codes;
  }, [serviceCodes, codeCategory, codeSearch]);

  const codeCategories = useMemo(() => {
    const cats = new Set(serviceCodes.map((c) => c.category));
    return ['all', ...Array.from(cats)];
  }, [serviceCodes]);

  // ─── 集計値 ───
  const summary = useMemo(() => {
    const totalChildren = billingRecords.length;
    const totalUnits = billingRecords.reduce((s, r) => s + r.totalUnits, 0);
    const totalAmount = billingRecords.reduce((s, r) => s + r.totalAmount, 0);
    const totalInsurance = billingRecords.reduce((s, r) => s + r.insuranceAmount, 0);
    const totalCopay = billingRecords.reduce((s, r) => s + r.copayAmount, 0);
    const draftCount = billingRecords.filter((r) => r.status === 'draft').length;
    const confirmedCount = billingRecords.filter((r) => r.status === 'confirmed').length;
    return { totalChildren, totalUnits, totalAmount, totalInsurance, totalCopay, draftCount, confirmedCount };
  }, [billingRecords]);

  // ─── CSV検証 ───
  const csvWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (billingRecords.some((r) => r.status === 'draft')) {
      warnings.push('未確定（下書き）の請求データがあります。確定してから提出してください。');
    }
    billingRecords.forEach((r) => {
      if (r.totalUnits === 0) {
        warnings.push(`${r.childName || '不明'}: 単位数が0です。`);
      }
    });
    return warnings;
  }, [billingRecords]);

  // ─── UI ───
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">国保連請求</h1>
          <p className="text-sm text-gray-500 mt-1">障害児通所支援 介護給付費等明細書</p>
        </div>
      </div>

      {/* 成功メッセージ */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          <span className="text-sm text-emerald-700">{successMessage}</span>
        </div>
      )}

      {/* エラーメッセージ */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* タブ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-teal-500 text-teal-700 bg-teal-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* ═══ Tab 1: 月次請求 ═══ */}
          {activeTab === 'monthly' && (
            <div className="space-y-6">
              {/* 年月セレクター + アクション */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-lg font-bold text-gray-800 min-w-[120px] text-center">{yearMonthLabel}</div>
                  <button onClick={() => changeMonth(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <ChevronRight size={16} />
                  </button>
                  <input
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    className="ml-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || isGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                    自動生成
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isLoading || isConfirming || summary.draftCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <CheckCircle size={14} />
                    一括確定
                  </button>
                </div>
              </div>

              {/* サマリーカード */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <SummaryCard label="対象児童数" value={`${summary.totalChildren}名`} color="teal" />
                <SummaryCard label="単位数合計" value={summary.totalUnits.toLocaleString()} color="blue" />
                <SummaryCard label="請求額合計" value={`${summary.totalAmount.toLocaleString()}円`} color="indigo" />
                <SummaryCard label="保険請求額" value={`${summary.totalInsurance.toLocaleString()}円`} color="emerald" />
                <SummaryCard label="利用者負担額" value={`${summary.totalCopay.toLocaleString()}円`} color="amber" />
              </div>

              {/* 一覧テーブル */}
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-t-transparent border-teal-500 rounded-full animate-spin" />
                  </div>
                ) : billingRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Receipt size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">請求データがありません</p>
                    <p className="text-xs mt-1">「自動生成」ボタンで利用実績から生成できます</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">児童名</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">サービス種別</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">利用日数</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">単位数合計</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">請求額</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">利用者負担額</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingRecords.map((record) => {
                        const st = STATUS_CONFIG[record.status];
                        const StatusIcon = st.icon;
                        return (
                          <tr
                            key={record.id}
                            onClick={() => handleRowClick(record)}
                            className="border-b border-gray-100 hover:bg-teal-50/30 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3 font-medium text-gray-800">{record.childName || record.childId}</td>
                            <td className="px-4 py-3 text-gray-600">{record.serviceType}</td>
                            <td className="px-4 py-3 text-right text-gray-700">-</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{record.totalUnits.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-800 font-medium">
                              {record.totalAmount.toLocaleString()}円
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-600">
                              {record.copayAmount.toLocaleString()}円
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                                <StatusIcon size={12} />
                                {st.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ═══ Tab 2: 明細確認 ═══ */}
          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-lg font-bold text-gray-800 min-w-[120px] text-center">{yearMonthLabel}</div>
                  <button onClick={() => changeMonth(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[200px]"
                >
                  <option value="">児童を選択</option>
                  {uniqueChildren.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedChildRecord && (
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">サービス種別</div>
                    <div className="font-medium">{selectedChildRecord.serviceType}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">単位数合計</div>
                    <div className="font-medium font-mono">{selectedChildRecord.totalUnits.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">請求額</div>
                    <div className="font-medium font-mono">{selectedChildRecord.totalAmount.toLocaleString()}円</div>
                  </div>
                  <div>
                    <div className="text-gray-500">利用者負担額</div>
                    <div className="font-medium font-mono">{selectedChildRecord.copayAmount.toLocaleString()}円</div>
                  </div>
                </div>
              )}

              {billingDetails.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">明細データがありません</p>
                  {!selectedChildId && <p className="text-xs mt-1">児童を選択してください</p>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">日付</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">サービスコード</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">単位数</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">欠席</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">加算</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingDetails.map((detail) => (
                        <DetailRow
                          key={detail.id}
                          detail={detail}
                          serviceCodes={serviceCodes}
                          onUnitChange={(units) => handleDetailUnitChange(detail, units)}
                          onAddAddition={(addition) => handleAddAddition(detail, addition)}
                          onRemoveAddition={(index) => handleRemoveAddition(detail, index)}
                          disabled={selectedChildRecord?.status !== 'draft'}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ Tab 3: CSV出力 ═══ */}
          {activeTab === 'csv' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">国保連フォーマット CSV</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <RefreshCw size={14} />
                    プレビュー更新
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    disabled={!csvPreview}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <Download size={14} />
                    CSVダウンロード
                  </button>
                </div>
              </div>

              {/* 警告 */}
              {csvWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                    <AlertTriangle size={14} />
                    提出前の確認事項
                  </div>
                  {csvWarnings.map((w, i) => (
                    <div key={i} className="text-sm text-amber-600 ml-6">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* サマリー */}
              <div className="grid grid-cols-3 gap-4">
                <SummaryCard label="対象児童数" value={`${summary.totalChildren}名`} color="teal" />
                <SummaryCard label="単位数合計" value={summary.totalUnits.toLocaleString()} color="blue" />
                <SummaryCard label="請求額合計" value={`${summary.totalAmount.toLocaleString()}円`} color="indigo" />
              </div>

              {/* プレビュー */}
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                  {csvPreview || '(データなし)'}
                </pre>
              </div>
            </div>
          )}

          {/* ═══ Tab 4: サービスコード ═══ */}
          {activeTab === 'codes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-lg font-bold text-gray-800">サービスコードマスタ</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={codeCategory}
                    onChange={(e) => setCodeCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {codeCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? '全カテゴリ' : cat}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="コード・名称で検索"
                      value={codeSearch}
                      onChange={(e) => setCodeSearch(e.target.value)}
                      className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-[240px]"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">コード</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">名称</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">カテゴリ</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">基本単位数</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">説明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCodes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                          該当するサービスコードがありません
                        </td>
                      </tr>
                    ) : (
                      filteredCodes.map((code) => (
                        <tr key={code.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-teal-700 font-medium">{code.code}</td>
                          <td className="px-4 py-3 text-gray-800">{code.name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                code.category === '加算'
                                  ? 'bg-purple-100 text-purple-700'
                                  : code.category === '児童発達支援'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {code.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-700">{code.baseUnits.toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{code.description || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ 明細モーダル ═══ */}
      {showDetailModal && selectedRecord && (
        <DetailModal
          record={selectedRecord}
          details={billingDetails}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedRecord(null);
          }}
        />
      )}
    </div>
  );
};

export default BillingView;

// ─── サマリーカード ───
function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color] || colorClasses.teal}`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

// ─── 明細行コンポーネント ───
function DetailRow({
  detail,
  serviceCodes,
  onUnitChange,
  onAddAddition,
  onRemoveAddition,
  disabled,
}: {
  detail: BillingDetail;
  serviceCodes: ServiceCode[];
  onUnitChange: (units: number) => void;
  onAddAddition: (addition: BillingAddition) => void;
  onRemoveAddition: (index: number) => void;
  disabled: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editUnits, setEditUnits] = useState(detail.unitCount);
  const [showAddition, setShowAddition] = useState(false);

  const codeInfo = serviceCodes.find((c) => c.code === detail.serviceCode);
  const additionCodes = serviceCodes.filter((c) => c.category === '加算');

  const dateLabel = useMemo(() => {
    const d = new Date(detail.serviceDate);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  }, [detail.serviceDate]);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-700">{dateLabel}</td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-teal-600">{detail.serviceCode}</span>
        {codeInfo && <span className="text-gray-500 text-xs ml-1">({codeInfo.name})</span>}
      </td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              value={editUnits}
              onChange={(e) => setEditUnits(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 border rounded text-right text-xs"
            />
            <button
              onClick={() => {
                onUnitChange(editUnits);
                setIsEditing(false);
              }}
              className="p-1 text-teal-600 hover:bg-teal-50 rounded"
            >
              <Save size={14} />
            </button>
          </div>
        ) : (
          <span className="font-mono text-gray-700">{detail.unitCount.toLocaleString()}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {detail.isAbsence ? (
          <span className="inline-block px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
            {detail.absenceType || '欠席'}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {detail.additions.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs">
              {a.name} (+{a.units})
              {!disabled && (
                <button onClick={() => onRemoveAddition(i)} className="text-purple-400 hover:text-purple-600">
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
          {!disabled && (
            <div className="relative">
              <button
                onClick={() => setShowAddition(!showAddition)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 text-xs"
              >
                <Plus size={10} /> 加算
              </button>
              {showAddition && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {additionCodes.map((code) => (
                    <button
                      key={code.id}
                      onClick={() => {
                        onAddAddition({ code: code.code, name: code.name, units: code.baseUnits });
                        setShowAddition(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs border-b border-gray-100 last:border-b-0"
                    >
                      <span className="font-mono text-teal-600">{code.code}</span>
                      <span className="ml-2 text-gray-700">{code.name}</span>
                      <span className="ml-1 text-gray-400">(+{code.baseUnits})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {!disabled && (
          <button
            onClick={() => {
              setEditUnits(detail.unitCount);
              setIsEditing(!isEditing);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50"
          >
            <Edit3 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── 明細モーダル ───
function DetailModal({
  record,
  details,
  onClose,
}: {
  record: BillingRecord;
  details: BillingDetail[];
  onClose: () => void;
}) {
  const st = STATUS_CONFIG[record.status];
  const StatusIcon = st.icon;

  // カレンダー形式で表示するための月のデータ生成
  const calendarData = useMemo(() => {
    const [y, m] = record.yearMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();

    const detailMap = new Map<string, BillingDetail>();
    details.forEach((d) => {
      detailMap.set(d.serviceDate, d);
    });

    const weeks: Array<Array<{ day: number; detail: BillingDetail | null } | null>> = [];
    let currentWeek: Array<{ day: number; detail: BillingDetail | null } | null> = [];

    // 先頭の空セル
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${record.yearMonth}-${day.toString().padStart(2, '0')}`;
      const detail = detailMap.get(dateStr) || null;
      currentWeek.push({ day, detail });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 末尾の空セル
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [record.yearMonth, details]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{record.childName || record.childId}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{record.serviceType} - {record.yearMonth}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
              <StatusIcon size={12} />
              {st.label}
            </span>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* サマリー */}
        <div className="p-6 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b border-gray-200">
          <div>
            <div className="text-gray-500">単位数合計</div>
            <div className="text-lg font-bold text-gray-800 font-mono">{record.totalUnits.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500">請求額</div>
            <div className="text-lg font-bold text-gray-800 font-mono">{record.totalAmount.toLocaleString()}円</div>
          </div>
          <div>
            <div className="text-gray-500">保険請求額</div>
            <div className="text-lg font-bold text-emerald-700 font-mono">{record.insuranceAmount.toLocaleString()}円</div>
          </div>
          <div>
            <div className="text-gray-500">利用者負担額</div>
            <div className="text-lg font-bold text-amber-700 font-mono">{record.copayAmount.toLocaleString()}円</div>
          </div>
        </div>

        {/* カレンダー表示 */}
        <div className="p-6">
          <h4 className="text-sm font-bold text-gray-700 mb-3">日別サービス提供状況</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">
                  {d}
                </div>
              ))}
            </div>
            {calendarData.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                {week.map((cell, ci) => (
                  <div key={ci} className="min-h-[72px] border-r border-gray-100 last:border-r-0 p-1">
                    {cell && (
                      <>
                        <div className="text-xs text-gray-400">{cell.day}</div>
                        {cell.detail && (
                          <div className="mt-0.5 space-y-0.5">
                            <div
                              className={`text-[10px] px-1 py-0.5 rounded ${
                                cell.detail.isAbsence
                                  ? 'bg-orange-50 text-orange-600'
                                  : 'bg-teal-50 text-teal-700'
                              }`}
                            >
                              {cell.detail.isAbsence ? '欠席' : cell.detail.serviceCode}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {cell.detail.unitCount}単位
                            </div>
                            {cell.detail.additions.length > 0 && (
                              <div className="text-[9px] text-purple-500">
                                +{cell.detail.additions.length}加算
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
