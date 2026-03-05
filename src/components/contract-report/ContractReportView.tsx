/**
 * 契約内容報告書管理ビュー
 * 新規・変更・終了の契約変更を検出し、行政への報告書を管理
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Printer,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  Info,
  Building2,
  UserPlus,
  RefreshCw,
  Edit,
  X,
} from 'lucide-react';
import { useContractReport, DetectedChange } from '@/hooks/useContractReport';
import { ContractReportItem } from '@/types';
import { printContractReport } from '@/lib/regulatoryDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import ConfirmModal from '@/components/common/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';

const REPORT_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: '新規', color: 'text-blue-700', bg: 'bg-blue-100' },
  change: { label: '変更', color: 'text-amber-700', bg: 'bg-amber-100' },
  termination: { label: '終了', color: 'text-red-700', bg: 'bg-red-100' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'text-gray-600' },
  submitted: { label: '提出済み', color: 'text-blue-600' },
  received: { label: '受領済み', color: 'text-green-600' },
  returned: { label: '差し戻し', color: 'text-red-600' },
  completed: { label: '完了', color: 'text-emerald-600' },
};

const ContractReportView: React.FC = () => {
  const { facility } = useAuth();
  const { toast } = useToast();
  const {
    loading,
    reportData,
    fetchContractReport,
    createSubmission,
    addReportItem,
    deleteReportItem,
    updateSubmissionStatus,
    addDetectedChanges,
  } = useContractReport();

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingChanges, setAddingChanges] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [manualForm, setManualForm] = useState({
    childName: '',
    reportType: 'new' as 'new' | 'change' | 'termination',
    recipientNumber: '',
    contractStartDate: '',
    contractEndDate: '',
    daysPerMonth: '',
    changeContent: '',
    terminationReason: '',
  });

  // データ読み込み
  useEffect(() => {
    fetchContractReport(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, fetchContractReport]);

  // 月を切り替え
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // 自動検出された変更を一括追加
  const handleAddDetectedChanges = async () => {
    if (reportData.detectedChanges.length === 0) return;
    setAddingChanges(true);

    try {
      let submissionId: string | null = reportData.submission?.id ?? null;

      // 提出レコードがなければ作成
      if (!submissionId) {
        submissionId = await createSubmission(selectedYear, selectedMonth);
        if (!submissionId) {
          toast.warning('行政機関が設定されていません。施設設定から管轄行政機関を設定してください。');
          setAddingChanges(false);
          return;
        }
      }

      await addDetectedChanges(submissionId, reportData.detectedChanges);
      await fetchContractReport(selectedYear, selectedMonth);
      toast.success(`${reportData.detectedChanges.length}件の変更を追加しました`);
    } catch (error) {
      console.error('一括追加エラー:', error);
      toast.error('一括追加に失敗しました');
    } finally {
      setAddingChanges(false);
    }
  };

  // 手動で項目を追加
  const handleManualAdd = async () => {
    if (!manualForm.childName.trim()) return;

    try {
      let submissionId: string | null = reportData.submission?.id ?? null;

      if (!submissionId) {
        submissionId = await createSubmission(selectedYear, selectedMonth);
        if (!submissionId) {
          toast.warning('行政機関が設定されていません。施設設定から管轄行政機関を設定してください。');
          return;
        }
      }

      await addReportItem(submissionId, {
        childId: `manual_${Date.now()}`,
        reportType: manualForm.reportType,
        childName: manualForm.childName,
        recipientNumber: manualForm.recipientNumber || undefined,
        contractStartDate: manualForm.contractStartDate || undefined,
        contractEndDate: manualForm.contractEndDate || undefined,
        daysPerMonth: manualForm.daysPerMonth ? parseInt(manualForm.daysPerMonth) : undefined,
        changeContent: manualForm.changeContent || undefined,
        terminationReason: manualForm.terminationReason || undefined,
      });

      setIsAddModalOpen(false);
      setManualForm({
        childName: '',
        reportType: 'new',
        recipientNumber: '',
        contractStartDate: '',
        contractEndDate: '',
        daysPerMonth: '',
        changeContent: '',
        terminationReason: '',
      });
      await fetchContractReport(selectedYear, selectedMonth);
      toast.success('報告項目を追加しました');
    } catch (error) {
      console.error('手動追加エラー:', error);
      toast.error('項目の追加に失敗しました');
    }
  };

  // 項目を削除
  const handleDeleteItem = (itemId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '項目の削除',
      message: 'この項目を削除しますか？',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await deleteReportItem(itemId);
        await fetchContractReport(selectedYear, selectedMonth);
      },
    });
  };

  // ステータスを更新
  const handleStatusUpdate = (status: 'submitted' | 'completed') => {
    if (!reportData.submission) return;
    const labels = { submitted: '提出済み', completed: '完了' };
    setConfirmModal({
      isOpen: true,
      title: 'ステータスの変更',
      message: `この報告書を「${labels[status]}」にしますか？`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await updateSubmissionStatus(reportData.submission!.id, status);
        await fetchContractReport(selectedYear, selectedMonth);
      },
    });
  };

  // 印刷
  const handlePrint = () => {
    if (!facility || reportData.items.length === 0) return;

    printContractReport({
      facilityName: facility.name || '',
      facilityCode: facility.code || '',
      governmentOrgName: reportData.governmentOrg?.name || '',
      year: selectedYear,
      month: selectedMonth,
      items: reportData.items.map(item => ({
        childName: item.childName,
        recipientNumber: item.recipientNumber || '',
        reportType: item.reportType,
        contractStartDate: item.contractStartDate || '',
        contractEndDate: item.contractEndDate || '',
        daysPerMonth: item.daysPerMonth,
        changeContent: item.changeContent || '',
        terminationReason: item.terminationReason || '',
      })),
    });
  };

  const { submission, items, detectedChanges, governmentOrg } = reportData;
  const statusInfo = submission ? STATUS_LABELS[submission.status] || STATUS_LABELS.draft : null;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">契約内容報告書</h2>
          <p className="text-sm text-gray-500 mt-1">
            新規・変更・終了の契約内容を行政へ報告
          </p>
        </div>

        {/* 年月セレクター */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="text-sm font-bold text-gray-800 min-w-[120px] text-center">
            {selectedYear}年{selectedMonth}月
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* 行政機関情報 */}
      {!governmentOrg ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">管轄行政機関が設定されていません</p>
            <p className="text-xs text-gray-500 mt-1">
              施設設定から管轄行政機関を登録してください。報告書の作成・提出には行政機関の設定が必要です。
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Building2 size={16} className="text-gray-400" />
          <span>提出先: <span className="font-medium text-gray-800">{governmentOrg.name}</span></span>
          {statusInfo && (
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} bg-gray-100`}>
              {statusInfo.label}
            </span>
          )}
        </div>
      )}

      {/* 自動検出バナー */}
      {detectedChanges.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {detectedChanges.length}件の契約変更が検出されました
                </p>
                <div className="mt-2 space-y-1">
                  {detectedChanges.map((change) => {
                    const typeInfo = REPORT_TYPE_LABELS[change.reportType];
                    return (
                      <div key={change.childId} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${typeInfo.bg} ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span>{change.childName}</span>
                        {change.changeDetail && (
                          <span className="text-gray-400">({change.changeDetail})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              onClick={handleAddDetectedChanges}
              disabled={addingChanges || !governmentOrg}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {addingChanges ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              一括追加
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* 報告項目一覧 */}
          {items.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-7 h-7 text-gray-400" />}
              title={`${selectedYear}年${selectedMonth}月の報告項目はまだありません`}
              description="自動検出された変更を追加するか、手動で項目を追加してください"
            />
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => {
                const typeInfo = REPORT_TYPE_LABELS[item.reportType] || REPORT_TYPE_LABELS.new;
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-gray-500 shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeInfo.bg} ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                            <span className="text-sm font-bold text-gray-800">{item.childName}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2">
                            {item.recipientNumber && (
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">受給者証番号</span>
                                <p className="text-xs text-gray-700 font-mono">{item.recipientNumber}</p>
                              </div>
                            )}
                            {item.contractStartDate && (
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">契約開始日</span>
                                <p className="text-xs text-gray-700">{item.contractStartDate}</p>
                              </div>
                            )}
                            {item.contractEndDate && (
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">契約終了日</span>
                                <p className="text-xs text-gray-700">{item.contractEndDate}</p>
                              </div>
                            )}
                            {item.daysPerMonth && (
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase">契約日数/月</span>
                                <p className="text-xs text-gray-700">{item.daysPerMonth}日</p>
                              </div>
                            )}
                          </div>
                          {item.changeContent && (
                            <p className="text-xs text-gray-500 mt-1.5">変更内容: {item.changeContent}</p>
                          )}
                          {item.terminationReason && (
                            <p className="text-xs text-gray-500 mt-1.5">終了理由: {item.terminationReason}</p>
                          )}
                        </div>
                      </div>

                      {/* 削除ボタン（下書き時のみ） */}
                      {(!submission || submission.status === 'draft') && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* フッターアクション */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              disabled={!governmentOrg}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              手動追加
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchContractReport(selectedYear, selectedMonth)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw size={14} />
                更新
              </button>

              {items.length > 0 && (
                <>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Printer size={16} />
                    印刷
                  </button>

                  {(!submission || submission.status === 'draft') && (
                    <button
                      onClick={() => handleStatusUpdate('submitted')}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      <Send size={16} />
                      提出済みにする
                    </button>
                  )}

                  {submission?.status === 'submitted' && (
                    <button
                      onClick={() => handleStatusUpdate('completed')}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      <CheckCircle size={16} />
                      確認済みにする
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 手動追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">報告項目を手動追加</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  児童名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="例: 山田 太郎"
                  value={manualForm.childName}
                  onChange={(e) => setManualForm({ ...manualForm, childName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">報告種別</label>
                <div className="flex gap-2">
                  {(['new', 'change', 'termination'] as const).map((type) => {
                    const info = REPORT_TYPE_LABELS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setManualForm({ ...manualForm, reportType: type })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          manualForm.reportType === type
                            ? `${info.bg} ${info.color} ring-2 ring-offset-1 ring-current`
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">受給者証番号</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="10桁の番号"
                  value={manualForm.recipientNumber}
                  onChange={(e) => setManualForm({ ...manualForm, recipientNumber: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">契約開始日</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    value={manualForm.contractStartDate}
                    onChange={(e) => setManualForm({ ...manualForm, contractStartDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">契約終了日</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    value={manualForm.contractEndDate}
                    onChange={(e) => setManualForm({ ...manualForm, contractEndDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">契約日数/月</label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="例: 10"
                  value={manualForm.daysPerMonth}
                  onChange={(e) => setManualForm({ ...manualForm, daysPerMonth: e.target.value })}
                />
              </div>

              {manualForm.reportType === 'change' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">変更内容</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    rows={2}
                    placeholder="変更内容を入力"
                    value={manualForm.changeContent}
                    onChange={(e) => setManualForm({ ...manualForm, changeContent: e.target.value })}
                  />
                </div>
              )}

              {manualForm.reportType === 'termination' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">終了理由</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    rows={2}
                    placeholder="終了理由を入力"
                    value={manualForm.terminationReason}
                    onChange={(e) => setManualForm({ ...manualForm, terminationReason: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleManualAdd}
                disabled={!manualForm.childName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
                追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractReportView;
