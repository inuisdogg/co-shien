'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  FileText, Upload, Search, Filter, Eye, Download, Trash2,
  CheckCircle, Clock, ChevronDown, Users, X, AlertCircle, ArrowUpDown,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';
import DocumentPreviewModal from '@/components/common/DocumentPreviewModal';
import ConfirmModal from '@/components/common/ConfirmModal';

interface StaffMember {
  id: string;
  name: string;
  userId: string | null;
}

interface StaffDocument {
  id: string;
  facilityId: string;
  userId: string;
  staffName: string;
  documentType: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  targetYear: number | null;
  targetMonth: number | null;
  issuedAt: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const DOCUMENT_TYPES = [
  { key: 'payslip', label: '給与明細', icon: '💰' },
  { key: 'employment_contract', label: '雇用契約書', icon: '📝' },
  { key: 'withholding_tax', label: '源泉徴収票', icon: '🧾' },
  { key: 'wage_notice', label: '賃金通知書', icon: '💵' },
  { key: 'social_insurance', label: '社会保険関連', icon: '🏥' },
  { key: 'year_end_adjustment', label: '年末調整', icon: '📋' },
  { key: 'other', label: 'その他', icon: '📄' },
] as const;

export default function StaffDocumentView() {
  const { facility } = useAuth();
  const { toast } = useToast();
  const facilityId = facility?.id || '';

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [selectedStaffId, setSelectedStaffId] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'type'>('newest');

  // Upload form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadStaffId, setUploadStaffId] = useState('');
  const [uploadType, setUploadType] = useState('payslip');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear());
  const [uploadMonth, setUploadMonth] = useState(new Date().getMonth() + 1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<StaffDocument | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchData = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      // スタッフ一覧
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, user_id')
        .eq('facility_id', facilityId)
        .order('name');

      setStaffList((staffData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        userId: s.user_id,
      })));

      // 書類一覧
      const { data: docsData } = await supabase
        .from('staff_documents')
        .select('*')
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (docsData) {
        // user_id → staff名のマップ
        const staffMap = new Map((staffData || []).map((s: any) => [s.user_id, s.name]));
        setDocuments(docsData.map((d: any) => ({
          id: d.id,
          facilityId: d.facility_id,
          userId: d.user_id,
          staffName: staffMap.get(d.user_id) || '不明',
          documentType: d.document_type,
          title: d.title,
          description: d.description,
          fileUrl: d.file_url,
          fileName: d.file_name,
          fileType: d.file_type,
          fileSize: d.file_size,
          targetYear: d.target_year,
          targetMonth: d.target_month,
          issuedAt: d.issued_at,
          isRead: d.is_read || false,
          readAt: d.read_at,
          createdAt: d.created_at,
        })));
      }
    } catch (err) {
      console.error('Error fetching staff documents:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // フィルタリング＆ソート
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let result = documents.filter(doc => {
      if (selectedStaffId !== 'all' && doc.userId !== selectedStaffId) return false;
      if (selectedType !== 'all' && doc.documentType !== selectedType) return false;
      if (q && !doc.title.toLowerCase().includes(q) && !doc.staffName.toLowerCase().includes(q) && !doc.fileName.toLowerCase().includes(q)) return false;
      return true;
    });

    // ソート
    switch (sortOrder) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'type':
        result.sort((a, b) => a.documentType.localeCompare(b.documentType));
        break;
    }

    return result;
  }, [documents, selectedStaffId, selectedType, searchQuery, sortOrder]);

  // 統計
  const stats = useMemo(() => {
    const total = documents.length;
    const unread = documents.filter(d => !d.isRead).length;
    const thisMonth = documents.filter(d => {
      const now = new Date();
      return d.targetYear === now.getFullYear() && d.targetMonth === (now.getMonth() + 1);
    }).length;
    return { total, unread, thisMonth };
  }, [documents]);

  // アップロード処理
  const handleUpload = async () => {
    if (!uploadFile || !uploadStaffId || !facilityId) return;

    const staff = staffList.find(s => s.id === uploadStaffId);
    if (!staff?.userId) {
      setError('このスタッフにはユーザーアカウントが紐付いていません');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // ファイルアップロード
      const fileExt = uploadFile.name.split('.').pop();
      const filePath = `staff-docs/${facilityId}/${staff.userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile);

      if (uploadError) throw new Error(`ファイルアップロード失敗: ${uploadError.message}`);

      // タイトル自動生成
      const typeLabel = DOCUMENT_TYPES.find(t => t.key === uploadType)?.label || uploadType;
      const title = uploadTitle.trim() || `${typeLabel} ${uploadYear}年${uploadMonth}月`;

      // DBレコード作成
      const { error: insertError } = await supabase
        .from('staff_documents')
        .insert({
          facility_id: facilityId,
          user_id: staff.userId,
          document_type: uploadType,
          document_category: 'distributed',
          title,
          description: uploadDescription.trim() || null,
          file_url: filePath,
          file_name: uploadFile.name,
          file_type: uploadFile.type || null,
          file_size: uploadFile.size,
          target_year: uploadYear,
          target_month: uploadMonth,
          issued_at: new Date().toISOString(),
          is_read: false,
        });

      if (insertError) throw new Error(`保存に失敗: ${insertError.message}`);

      // 通知
      await supabase.from('notifications').insert({
        id: `notif-${Date.now()}-${staff.userId}`,
        user_id: staff.userId,
        title: '新しい書類が届きました',
        message: `${typeLabel}「${title}」が配布されました`,
        type: 'document_available',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      setSuccess(`${staff.name}さんに「${title}」を配布しました`);
      setTimeout(() => setSuccess(''), 3000);

      // リセット
      setShowUploadForm(false);
      setUploadStaffId('');
      setUploadTitle('');
      setUploadDescription('');
      setUploadFile(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // 書類削除
  const handleDelete = (doc: StaffDocument) => {
    setConfirmModal({
      isOpen: true,
      title: '書類の削除',
      message: `「${doc.title}」を削除しますか？`,
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await supabase.storage.from('documents').remove([doc.fileUrl]);
          await supabase.from('staff_documents').delete().eq('id', doc.id);
          fetchData();
        } catch (err) {
          console.error('Delete error:', err);
        }
      },
    });
  };

  // ダウンロード
  const handleDownload = async (doc: StaffDocument) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.fileUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // プレビュー
  const handlePreview = (doc: StaffDocument) => {
    setPreviewDoc(doc);
  };

  // 既読マーク
  const markAsRead = async (doc: StaffDocument) => {
    if (doc.isRead) return;
    try {
      await supabase
        .from('staff_documents')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', doc.id);
      setDocuments(prev =>
        prev.map(d => d.id === doc.id ? { ...d, isRead: true, readAt: new Date().toISOString() } : d)
      );
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-800">書類配布</h1>
        </div>
        <button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          書類をアップロード
        </button>
      </div>

      {/* 通知 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{success}
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">配布済み書類</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">未読</p>
          <p className="text-2xl font-bold text-amber-600">{stats.unread}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">今月配布</p>
          <p className="text-2xl font-bold text-primary">{stats.thisMonth}</p>
        </div>
      </div>

      {/* アップロードフォーム */}
      {showUploadForm && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-primary p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">書類をアップロード</h3>
            <button onClick={() => setShowUploadForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">スタッフ <span className="text-red-500">*</span></label>
              <select
                value={uploadStaffId}
                onChange={e => setUploadStaffId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">選択してください</option>
                {staffList.filter(s => s.userId).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">書類タイプ</label>
              <select
                value={uploadType}
                onChange={e => setUploadType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {DOCUMENT_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">対象年月</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={uploadYear}
                  onChange={e => setUploadYear(parseInt(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min={2020}
                  max={2030}
                />
                <select
                  value={uploadMonth}
                  onChange={e => setUploadMonth(parseInt(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}月</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">タイトル（空欄で自動生成）</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="例: 2026年2月 給与明細"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">ファイル <span className="text-red-500">*</span></label>
              {!uploadFile ? (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-primary transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">PDF / 画像 / Excel（10MB以下）</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm text-gray-800 flex-1 truncate">{uploadFile.name}</span>
                  <span className="text-xs text-gray-500">{formatSize(uploadFile.size)}</span>
                  <button onClick={() => setUploadFile(null)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setShowUploadForm(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
            >
              キャンセル
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadStaffId}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'アップロード中...' : 'アップロード'}
            </button>
          </div>
        </div>
      )}

      {/* 検索・フィルター・ソート */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        {/* 検索バー */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="タイトル・スタッフ名・ファイル名で検索"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        {/* フィルター・ソート */}
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="all">全スタッフ</option>
            {staffList.filter(s => s.userId).map(s => (
              <option key={s.id} value={s.userId!}>{s.name}</option>
            ))}
          </select>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="all">全タイプ</option>
            {DOCUMENT_TYPES.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest' | 'type')}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="newest">作成日新しい順</option>
              <option value="oldest">作成日古い順</option>
              <option value="type">タイプ別</option>
            </select>
          </div>
        </div>
        {/* 検索結果件数 */}
        {(searchQuery || selectedStaffId !== 'all' || selectedType !== 'all') && (
          <p className="text-xs text-gray-500">{filtered.length} 件の書類が見つかりました</p>
        )}
      </div>

      {/* 書類一覧 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <EmptyState
              icon={<FileText className="w-7 h-7 text-gray-400" />}
              title="配布済みの書類はありません"
              action={
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="text-sm text-primary hover:underline"
                >
                  書類をアップロードする
                </button>
              }
            />
          </div>
        ) : (
          filtered.map(doc => {
            const typeInfo = DOCUMENT_TYPES.find(t => t.key === doc.documentType);
            return (
              <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0 mt-0.5">{typeInfo?.icon || '📄'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => handlePreview(doc)}
                        className="font-bold text-gray-800 truncate hover:text-primary transition-colors text-left"
                      >
                        {doc.title}
                      </button>
                      {!doc.isRead && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">未読</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{doc.staffName}</span>
                      <span>{typeInfo?.label}</span>
                      {doc.targetYear && <span>{doc.targetYear}年{doc.targetMonth}月</span>}
                      <span>{formatSize(doc.fileSize)}</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {doc.isRead ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 mr-2">
                        <CheckCircle className="w-3 h-3" />既読
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400 mr-2">
                        <Clock className="w-3 h-3" />未読
                      </span>
                    )}
                    <button
                      onClick={() => handlePreview(doc)}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      title="プレビュー"
                    >
                      <Eye className="w-4 h-4 text-gray-500 hover:text-blue-500" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="ダウンロード"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* プレビューモーダル */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          filePath={previewDoc.fileUrl}
          fileName={previewDoc.fileName}
          mimeType={previewDoc.fileType}
          title={previewDoc.title}
          bucket="documents"
          onViewed={() => markAsRead(previewDoc)}
        />
      )}
    </div>
  );
}
