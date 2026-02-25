/**
 * 児童書類管理コンポーネント
 * カテゴリ別にPDFをドラッグ&ドロップで登録・管理
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Download,
  Trash2,
  Calendar,
  ClipboardList,
  FileCheck,
  FileSearch,
  FileSignature,
  File,
  Save,
} from 'lucide-react';
import {
  DocumentType,
  DocumentCategoryId,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_CATEGORIES,
} from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Props = {
  childId: string;
  childName: string;
  facilityId: string;
  onClose: () => void;
};

type ChildDocument = {
  id: string;
  documentType: DocumentType;
  documentName: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  expiryDate?: string;
  status: 'active' | 'expired';
  uploadedAt: string;
  notes?: string;
};

// カテゴリアイコンマッピング
const CATEGORY_ICONS = {
  ClipboardList,
  FileCheck,
  FileSearch,
  FileSignature,
  File,
};

export const ChildDocumentsManager: React.FC<Props> = ({
  childId,
  childName,
  facilityId,
  onClose,
}) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ChildDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategoryId>(DOCUMENT_CATEGORIES[0].id);
  const [isDragging, setIsDragging] = useState(false);

  // アップロードモーダル
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    documentType: '' as DocumentType,
    documentName: '',
    expiryDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const { data: docs } = await supabase
        .from('child_documents')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('child_id', childId)
        .order('created_at', { ascending: false });

      if (docs) {
        setDocuments(
          docs.map((d) => ({
            id: d.id,
            documentType: d.document_type as DocumentType,
            documentName: d.document_name,
            fileName: d.file_name,
            filePath: d.file_path,
            fileSize: d.file_size,
            expiryDate: d.expiry_date,
            status: d.expiry_date && new Date(d.expiry_date) < new Date() ? 'expired' : 'active',
            uploadedAt: d.created_at,
            notes: d.description,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [childId, facilityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 現在のカテゴリ情報
  const currentCategory = DOCUMENT_CATEGORIES.find(c => c.id === selectedCategory)!;
  const CategoryIcon = CATEGORY_ICONS[currentCategory.icon as keyof typeof CATEGORY_ICONS];

  // カテゴリ内の書類
  const categoryDocuments = documents.filter(d =>
    currentCategory.types.includes(d.documentType)
  );

  // カテゴリごとの書類数
  const getCategoryCount = (categoryId: string) => {
    const cat = DOCUMENT_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return 0;
    return documents.filter(d => cat.types.includes(d.documentType)).length;
  };

  // ドラッグ&ドロップ
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

    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFile = droppedFiles.find(f => f.type === 'application/pdf');

    if (pdfFile) {
      openUploadModal(pdfFile);
    } else {
      alert('PDFファイルを選択してください');
    }
  };

  // アップロードモーダル
  const openUploadModal = (file: File) => {
    setUploadFile(file);
    setUploadForm({
      documentType: currentCategory.types[0],
      documentName: file.name.replace('.pdf', ''),
      expiryDate: '',
      notes: '',
    });
    setShowUploadModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      openUploadModal(file);
    } else if (file) {
      alert('PDFファイルを選択してください');
    }
    e.target.value = '';
  };

  // アップロード処理
  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.documentType || !user?.id) return;

    setSaving(true);
    try {
      // Supabase Storageにアップロード
      const fileName = `${facilityId}/${childId}/${Date.now()}_${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('child-documents')
        .upload(fileName, uploadFile);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
      }

      // メタデータをDBに保存
      const { error: dbError } = await supabase
        .from('child_documents')
        .insert({
          id: `doc-${Date.now()}`,
          facility_id: facilityId,
          child_id: childId,
          document_type: uploadForm.documentType,
          document_name: uploadForm.documentName || uploadFile.name,
          file_name: uploadFile.name,
          file_path: uploadError ? null : fileName,
          file_size: uploadFile.size,
          expiry_date: uploadForm.expiryDate || null,
          description: uploadForm.notes || null,
          status: 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
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

  // ダウンロード
  const handleDownload = async (doc: ChildDocument) => {
    if (!doc.filePath) {
      alert('ファイルが見つかりません');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('child-documents')
        .download(doc.filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ダウンロードエラー:', err);
      alert('ダウンロードに失敗しました');
    }
  };

  // 削除
  const handleDelete = async (doc: ChildDocument) => {
    if (!confirm(`「${doc.documentName}」を削除しますか？`)) return;

    try {
      if (doc.filePath) {
        await supabase.storage.from('child-documents').remove([doc.filePath]);
      }
      await supabase.from('child_documents').delete().eq('id', doc.id);
      await fetchData();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 rounded w-24" />
                <div className="h-3 bg-gray-200 rounded w-16" />
              </div>
              <div className="w-6 h-6 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="flex">
            <div className="w-48 border-r border-gray-200 bg-gray-50 p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse h-10 bg-gray-200 rounded" />
              ))}
            </div>
            <div className="flex-1 p-4 space-y-4">
              <div className="animate-pulse h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-200" />
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-16 bg-gray-100 rounded" />
                <div className="h-16 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">書類管理</h2>
            <p className="text-sm text-gray-500">{childName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左: カテゴリ */}
          <div className="w-48 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            {DOCUMENT_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS];
              const count = getCategoryCount(cat.id);
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full px-4 py-3 text-left flex items-center gap-2 transition-colors ${
                    isSelected
                      ? 'bg-white border-l-4 border-[#00c4cc] text-[#00c4cc]'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium flex-1">{cat.label}</span>
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-[#00c4cc]/10' : 'bg-gray-200'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 右: ファイル一覧 */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* ドロップゾーン */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors mb-4 ${
                isDragging
                  ? 'border-[#00c4cc] bg-[#00c4cc]/5'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Upload className={`w-8 h-8 mx-auto mb-2 ${
                isDragging ? 'text-[#00c4cc]' : 'text-gray-400'
              }`} />
              <p className="text-gray-600 text-sm mb-2">
                PDFをドラッグ&ドロップ
              </p>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-medium py-1.5 px-4 rounded-lg transition-colors"
              >
                ファイルを選択
              </button>
            </div>

            {/* カテゴリタイトル */}
            <div className="flex items-center gap-2 mb-3">
              <CategoryIcon size={18} className="text-gray-500" />
              <h3 className="text-sm font-bold text-gray-700">
                {currentCategory.label}
              </h3>
              <span className="text-xs text-gray-400">
                ({categoryDocuments.length}件)
              </span>
            </div>

            {/* 書類タイプ別表示 */}
            {currentCategory.types.map(docType => {
              const typeDocs = categoryDocuments.filter(d => d.documentType === docType);
              if (typeDocs.length === 0) return null;

              return (
                <div key={docType} className="mb-4">
                  <div className="text-xs font-medium text-gray-500 mb-2 px-1">
                    {DOCUMENT_TYPE_LABELS[docType]}
                  </div>
                  <div className="space-y-2">
                    {typeDocs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-red-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800 truncate">
                                {doc.documentName}
                              </span>
                              {doc.status === 'expired' && (
                                <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                  <AlertCircle className="w-3 h-3" />
                                  期限切れ
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {doc.expiryDate && (
                                <span className="inline-flex items-center gap-1 mr-3">
                                  <Calendar className="w-3 h-3" />
                                  有効期限: {doc.expiryDate}
                                </span>
                              )}
                              {doc.fileName && (
                                <span className="text-gray-400">{doc.fileName}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.filePath && (
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-2 text-gray-500 hover:text-[#00c4cc] hover:bg-white rounded-lg transition-colors"
                              title="ダウンロード"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {categoryDocuments.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">書類がまだ登録されていません</p>
                <p className="text-xs text-gray-400">上のドロップゾーンにPDFをドラッグするか、「ファイルを選択」をクリックしてください</p>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* アップロードモーダル */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">書類の登録</h2>
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

              {/* 書類タイプ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  書類タイプ <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadForm.documentType}
                  onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value as DocumentType })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {currentCategory.types.map(type => (
                    <option key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 書類名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  書類名
                </label>
                <input
                  type="text"
                  value={uploadForm.documentName}
                  onChange={(e) => setUploadForm({ ...uploadForm, documentName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="例: 2024年度 受給者証"
                />
              </div>

              {/* 有効期限 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  有効期限
                </label>
                <input
                  type="date"
                  value={uploadForm.expiryDate}
                  onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">受給者証など期限がある書類の場合に設定</p>
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
                disabled={saving || !uploadForm.documentType}
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
};

export default ChildDocumentsManager;
