/**
 * 個別支援計画管理コンポーネント
 * 左: 児童一覧、右: PDFファイル登録・管理
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Upload,
  FileText,
  User,
  Calendar,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// 支援計画ファイルの型
type SupportPlanFile = {
  id: string;
  childId: string;
  planType: 'initial' | 'renewal' | 'modification';
  periodStart: string;
  periodEnd: string;
  planCreatedDate: string;
  planCreatorName?: string;
  fileName: string;
  filePath?: string;
  fileSize?: number;
  status: 'draft' | 'active' | 'completed' | 'archived';
  notes?: string;
  uploadedAt: string;
};

// 児童の型
type Child = {
  id: string;
  name: string;
};

// ステータスラベル
const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'text-gray-600', bg: 'bg-gray-100' },
  active: { label: '有効', color: 'text-green-700', bg: 'bg-green-100' },
  completed: { label: '期間終了', color: 'text-blue-700', bg: 'bg-blue-100' },
  archived: { label: 'アーカイブ', color: 'text-gray-500', bg: 'bg-gray-50' },
};

// 計画種別ラベル
const planTypeLabels: Record<string, string> = {
  initial: '初回作成',
  renewal: '更新',
  modification: '変更',
};

export default function ServicePlanView() {
  const { user, facility } = useAuth();
  const [files, setFiles] = useState<SupportPlanFile[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // アップロードモーダル
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    planType: 'renewal' as 'initial' | 'renewal' | 'modification',
    periodStart: '',
    periodEnd: '',
    planCreatedDate: new Date().toISOString().split('T')[0],
    planCreatorName: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      // 児童一覧
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name')
        .eq('facility_id', facility.id)
        .order('name');

      if (childrenData) {
        setChildren(childrenData);
        // 最初の児童を選択
        if (childrenData.length > 0 && !selectedChildId) {
          setSelectedChildId(childrenData[0].id);
        }
      }

      // 支援計画ファイル
      const { data: filesData } = await supabase
        .from('support_plan_files')
        .select('*')
        .eq('facility_id', facility.id)
        .order('period_start', { ascending: false });

      if (filesData) {
        setFiles(filesData.map((f: any) => ({
          id: f.id,
          childId: f.child_id,
          planType: f.plan_type,
          periodStart: f.period_start,
          periodEnd: f.period_end,
          planCreatedDate: f.plan_created_date,
          planCreatorName: f.plan_creator_name,
          fileName: f.file_name,
          filePath: f.file_path,
          fileSize: f.file_size,
          status: f.status,
          notes: f.notes,
          uploadedAt: f.uploaded_at,
        })));
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id, selectedChildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 選択中の児童のファイル
  const selectedChildFiles = files.filter(f => f.childId === selectedChildId);
  const selectedChild = children.find(c => c.id === selectedChildId);

  // ドラッグ&ドロップハンドラー
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!selectedChildId) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFile = droppedFiles.find(f => f.type === 'application/pdf');

    if (pdfFile) {
      openUploadModal(pdfFile);
    } else {
      alert('PDFファイルを選択してください');
    }
  };

  // アップロードモーダルを開く
  const openUploadModal = (file: File) => {
    setUploadFile(file);
    setUploadForm({
      planType: 'renewal',
      periodStart: '',
      periodEnd: '',
      planCreatedDate: new Date().toISOString().split('T')[0],
      planCreatorName: user?.name || '',
      notes: '',
    });
    setShowUploadModal(true);
  };

  // ファイル選択ハンドラー
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      openUploadModal(file);
    } else if (file) {
      alert('PDFファイルを選択してください');
    }
    // リセットして同じファイルを再選択できるようにする
    e.target.value = '';
  };

  // アップロード処理
  const handleUpload = async () => {
    if (!uploadFile || !selectedChildId || !facility?.id || !user?.id) return;
    if (!uploadForm.periodStart || !uploadForm.periodEnd) {
      alert('計画期間を入力してください');
      return;
    }

    setSaving(true);
    try {
      // Supabase Storageにアップロード
      const fileName = `${facility.id}/${selectedChildId}/${Date.now()}_${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('support-plans')
        .upload(fileName, uploadFile);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
      }

      // メタデータをDBに保存
      const { error: dbError } = await supabase
        .from('support_plan_files')
        .insert({
          facility_id: facility.id,
          child_id: selectedChildId,
          plan_type: uploadForm.planType,
          period_start: uploadForm.periodStart,
          period_end: uploadForm.periodEnd,
          plan_created_date: uploadForm.planCreatedDate,
          plan_creator_name: uploadForm.planCreatorName,
          file_name: uploadFile.name,
          file_path: uploadError ? null : fileName,
          file_size: uploadFile.size,
          status: 'active',
          notes: uploadForm.notes,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      await fetchData();
      setShowUploadModal(false);
      setUploadFile(null);
    } catch (err) {
      console.error('アップロードエラー:', err);
      alert('アップロードに失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // ファイルダウンロード
  const handleDownload = async (file: SupportPlanFile) => {
    if (!file.filePath) {
      alert('ファイルが見つかりません');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('support-plans')
        .download(file.filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ダウンロードエラー:', err);
      alert('ダウンロードに失敗しました');
    }
  };

  // ファイル削除
  const handleDelete = async (file: SupportPlanFile) => {
    if (!confirm(`「${file.fileName}」を削除しますか？`)) return;

    try {
      if (file.filePath) {
        await supabase.storage.from('support-plans').remove([file.filePath]);
      }
      await supabase.from('support_plan_files').delete().eq('id', file.id);
      await fetchData();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました');
    }
  };

  // 警告チェック
  const getFileWarning = (file: SupportPlanFile): string | null => {
    const today = new Date();
    const endDate = new Date(file.periodEnd);
    const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (file.status === 'active') {
      if (daysUntilEnd < 0) return '期限切れ';
      if (daysUntilEnd <= 30) return `残り${daysUntilEnd}日`;
    }
    return null;
  };

  // 児童ごとの有効計画チェック
  const getChildStatus = (childId: string) => {
    const childFiles = files.filter(f => f.childId === childId);
    const activeFile = childFiles.find(f => f.status === 'active');
    if (!activeFile) return { hasActive: false, warning: null };

    const warning = getFileWarning(activeFile);
    return { hasActive: true, warning };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-[#00c4cc]" />
          個別支援計画
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          児童を選択してPDFファイルを登録できます
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左: 児童一覧 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="font-bold text-gray-700 text-sm">児童一覧</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {children.map((child) => {
                const status = getChildStatus(child.id);
                const isSelected = selectedChildId === child.id;
                const fileCount = files.filter(f => f.childId === child.id).length;

                return (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-[#00c4cc]/10 border-l-4 border-[#00c4cc]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className={`text-sm font-medium ${isSelected ? 'text-[#00c4cc]' : 'text-gray-700'}`}>
                          {child.name}
                        </span>
                      </div>
                      {status.warning ? (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">
                          <AlertCircle className="w-3 h-3" />
                        </span>
                      ) : status.hasActive ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : null}
                    </div>
                    <span className="text-xs text-gray-400 ml-6">{fileCount}件</span>
                  </button>
                );
              })}
              {children.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  児童が登録されていません
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右: ファイル登録・一覧 */}
        <div className="lg:col-span-3">
          {selectedChild ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* 児童名 */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h2 className="font-bold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {selectedChild.name}
                </h2>
              </div>

              <div className="p-4 space-y-4">
                {/* ドロップゾーン */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? 'border-[#00c4cc] bg-[#00c4cc]/5'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${
                    isDragging ? 'text-[#00c4cc]' : 'text-gray-400'
                  }`} />
                  <p className="text-gray-600 mb-2">
                    PDFファイルをドラッグ&ドロップ
                  </p>
                  <p className="text-gray-400 text-sm mb-4">または</p>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  >
                    ファイルを選択
                  </button>
                </div>

                {/* 登録済みファイル一覧 */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">
                    登録済みの計画 ({selectedChildFiles.length}件)
                  </h3>
                  {selectedChildFiles.length > 0 ? (
                    <div className="space-y-2">
                      {selectedChildFiles.map(file => {
                        const warning = getFileWarning(file);
                        return (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="w-5 h-5 text-red-500 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-800 truncate">
                                    {file.fileName}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[file.status]?.bg} ${statusLabels[file.status]?.color}`}>
                                    {statusLabels[file.status]?.label}
                                  </span>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                    {planTypeLabels[file.planType]}
                                  </span>
                                  {warning && (
                                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                                      <AlertCircle className="w-3 h-3" />
                                      {warning}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {file.periodStart} 〜 {file.periodEnd}
                                  </span>
                                  {file.planCreatorName && (
                                    <span className="ml-3">作成: {file.planCreatorName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {file.filePath && (
                                <button
                                  onClick={() => handleDownload(file)}
                                  className="p-2 text-gray-500 hover:text-[#00c4cc] hover:bg-white rounded-lg transition-colors"
                                  title="ダウンロード"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(file)}
                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">登録されている計画はありません</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">左から児童を選択してください</p>
            </div>
          )}
        </div>
      </div>

      {/* アップロードモーダル */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">支援計画PDFの登録</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* ファイル情報 */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="w-8 h-8 text-red-500" />
                <div>
                  <p className="font-medium text-gray-800">{uploadFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {uploadFile && (uploadFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              {/* 対象児童 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  対象児童
                </label>
                <p className="text-gray-800 font-medium">{selectedChild?.name}</p>
              </div>

              {/* 計画種別 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  計画種別
                </label>
                <select
                  value={uploadForm.planType}
                  onChange={(e) => setUploadForm({ ...uploadForm, planType: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="initial">初回作成</option>
                  <option value="renewal">更新</option>
                  <option value="modification">変更</option>
                </select>
              </div>

              {/* 計画期間 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={uploadForm.periodStart}
                    onChange={(e) => setUploadForm({ ...uploadForm, periodStart: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={uploadForm.periodEnd}
                    onChange={(e) => setUploadForm({ ...uploadForm, periodEnd: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* 作成日・作成者 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    作成日
                  </label>
                  <input
                    type="date"
                    value={uploadForm.planCreatedDate}
                    onChange={(e) => setUploadForm({ ...uploadForm, planCreatedDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    作成者
                  </label>
                  <input
                    type="text"
                    value={uploadForm.planCreatorName}
                    onChange={(e) => setUploadForm({ ...uploadForm, planCreatorName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="児発管名など"
                  />
                </div>
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考
                </label>
                <textarea
                  value={uploadForm.notes}
                  onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[60px]"
                  placeholder="メモがあれば入力"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleUpload}
                disabled={saving || !uploadForm.periodStart || !uploadForm.periodEnd}
                className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '登録中...' : '登録する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
