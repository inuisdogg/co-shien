'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderOpen,
  Upload,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Download,
  RefreshCw,
  Building2,
  Users,
  Shield,
  ClipboardList,
  Send,
  FolderArchive,
  UploadCloud,
  ChevronRight,
  Eye,
} from 'lucide-react';
import dynamicImport from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFacilityData } from '@/hooks/useFacilityData';
import { ChildDocument, DocumentStatus } from '@/types';

const AuditExportView = dynamicImport(
  () => import('@/components/audit/AuditExportView'),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-t-transparent border-gray-400 rounded-full animate-spin" /></div> }
);

const ServiceRecordView = dynamicImport(
  () => import('@/components/records/ServiceRecordView'),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-t-transparent border-gray-400 rounded-full animate-spin" /></div> }
);

// --- Consistent status badge styles ---
const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  required: { label: '未作成', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: Clock },
  submitted: { label: '提出済', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: FileText },
  approved: { label: '完了', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  expired: { label: '要更新', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
  rejected: { label: '差戻し', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
};

// Document category configuration with icons
const DOCUMENT_CATEGORIES = [
  { key: 'all', label: '全カテゴリ', icon: FolderOpen, types: [] as string[] },
  { key: 'operations', label: '運営関係', icon: Building2, types: ['contract', 'support_plan', 'special_support_plan'] },
  { key: 'hr', label: '人事・労務', icon: Users, types: [] as string[] },
  { key: 'client', label: '利用者関係', icon: ClipboardList, types: ['assessment', 'beneficiary_cert', 'medical_cert', 'insurance_card', 'emergency_contact', 'photo_consent'] },
  { key: 'safety', label: '安全管理', icon: Shield, types: [] as string[] },
  { key: 'government', label: '行政提出', icon: Send, types: [] as string[] },
  { key: 'other', label: 'その他', icon: FolderArchive, types: ['other'] },
];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contract: '利用契約書',
  assessment: 'アセスメントシート',
  support_plan: '個別支援計画書',
  special_support_plan: '特別支援計画書',
  beneficiary_cert: '受給者証',
  medical_cert: '医療証',
  insurance_card: '保険証',
  emergency_contact: '緊急連絡先',
  photo_consent: '写真使用同意書',
  other: 'その他',
};

function mapRowToDocument(row: any): ChildDocument {
  return {
    id: row.id,
    facilityId: row.facility_id,
    childId: row.child_id,
    documentType: row.document_type,
    documentName: row.document_name,
    description: row.description,
    status: row.status,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    dueDate: row.due_date,
    expiryDate: row.expiry_date,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    rejectionReason: row.rejection_reason,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Skeleton loading
function SkeletonRow() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-100 rounded w-48" />
        </div>
        <div className="h-6 bg-gray-100 rounded-full w-16" />
      </div>
    </div>
  );
}

// Format file size
function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

// Format date
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

// Expiry badge
function ExpiryBadge({ expiryDate }: { expiryDate: string | undefined }) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">期限切れ</span>;
  }
  if (days <= 30) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">残り{days}日</span>;
  }
  return null;
}

function DocumentManagementContent() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const { children } = useFacilityData();

  const [documents, setDocuments] = useState<ChildDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'status'>('updated');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!facilityId) return;
    const fetchDocuments = async () => {
      try {
        const { data, error } = await supabase
          .from('child_documents')
          .select('*')
          .eq('facility_id', facilityId)
          .order('updated_at', { ascending: false });
        if (error) {
          console.error('Error fetching documents:', error);
          return;
        }
        if (data) setDocuments(data.map(mapRowToDocument));
      } catch (error) {
        console.error('Error in fetchDocuments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [facilityId]);

  // Statistics
  const stats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'approved').length;
    const submitted = documents.filter(d => d.status === 'submitted').length;
    const expired = documents.filter(d => d.status === 'expired').length;
    const rejected = documents.filter(d => d.status === 'rejected').length;
    const expiring = documents.filter(d => {
      if (!d.expiryDate) return false;
      const days = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86400000);
      return days > 0 && days <= 30;
    }).length;
    const needsAction = expired + rejected + expiring;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, submitted, expired, expiring, needsAction, rejected, rate };
  }, [documents]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DOCUMENT_CATEGORIES.forEach(cat => {
      if (cat.key === 'all') {
        counts[cat.key] = documents.length;
      } else {
        counts[cat.key] = documents.filter(d => cat.types.includes(d.documentType)).length;
      }
    });
    return counts;
  }, [documents]);

  // Filtered and sorted documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
      if (activeCategory !== 'all') {
        const cat = DOCUMENT_CATEGORIES.find(c => c.key === activeCategory);
        if (cat && cat.types.length > 0 && !cat.types.includes(doc.documentType)) return false;
      }
      if (searchTerm) {
        const child = children.find(c => c.id === doc.childId);
        const nameMatch = child?.name.includes(searchTerm);
        const docMatch = doc.documentName?.includes(searchTerm);
        const typeMatch = DOCUMENT_TYPE_LABELS[doc.documentType]?.includes(searchTerm);
        if (!nameMatch && !docMatch && !typeMatch) return false;
      }
      return true;
    });

    // Sort
    if (sortBy === 'name') {
      filtered.sort((a, b) => (a.documentName || '').localeCompare(b.documentName || ''));
    } else if (sortBy === 'status') {
      const order: Record<DocumentStatus, number> = { expired: 0, rejected: 1, required: 2, submitted: 3, approved: 4 };
      filtered.sort((a, b) => order[a.status] - order[b.status]);
    }
    // default: already sorted by updated_at desc from DB

    return filtered;
  }, [documents, statusFilter, activeCategory, searchTerm, children, sortBy]);

  const handleStatusUpdate = async (docId: string, newStatus: DocumentStatus) => {
    try {
      const updates: Record<string, string> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'approved') updates.reviewed_at = new Date().toISOString();
      const { error } = await supabase.from('child_documents').update(updates).eq('id', docId);
      if (error) throw error;
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d));
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  };

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // File handling would go here - placeholder for now
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      alert(`${files.length}件のファイルがドロップされました。アップロード機能は準備中です。`);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">書類管理</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <Download className="w-4 h-4" />
            一括DL
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors">
            <Upload className="w-4 h-4" />
            アップロード
          </button>
        </div>
      </div>

      {/* Progress Dashboard */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-700">書類完成状況</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.total}文書中 {stats.completed}完了 ({stats.rate}%)
            </p>
          </div>
          {stats.needsAction > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              {stats.needsAction}件の対応が必要
            </span>
          )}
        </div>
        {/* Progress Bar */}
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className="h-full flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0}%` }}
            />
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${stats.total > 0 ? ((stats.expired + stats.rejected) / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 完了 {stats.completed}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 確認中 {stats.submitted}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> 要対応 {stats.expired + stats.rejected}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-200" /> 未作成 {stats.total - stats.completed - stats.submitted - stats.expired - stats.rejected}
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg"><FileText className="w-5 h-5 text-gray-500" /></div>
            <div>
              <p className="text-sm text-gray-500">登録書類</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-sm text-gray-500">完了率</p>
              <p className="text-2xl font-bold text-gray-800">{stats.rate}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-sm text-gray-500">期限間近</p>
              <p className="text-2xl font-bold text-gray-800">{stats.expiring}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <div>
              <p className="text-sm text-gray-500">要更新</p>
              <p className="text-2xl font-bold text-gray-800">{stats.expired}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {DOCUMENT_CATEGORIES.map(cat => {
            const CatIcon = cat.icon;
            const count = categoryCounts[cat.key] || 0;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-[#00c4cc] text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CatIcon className="w-4 h-4" />
                {cat.label}
                {cat.key !== 'all' && count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeCategory === cat.key ? 'bg-white/20' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="児童名・書類名で検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          >
            <option value="all">全ステータス</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          >
            <option value="updated">更新日順</option>
            <option value="name">名前順</option>
            <option value="status">ステータス順</option>
          </select>
        </div>
      </div>

      {/* Drag & Drop Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          isDragging
            ? 'border-[#00c4cc] bg-[#00c4cc]/5'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <UploadCloud className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-[#00c4cc]' : 'text-gray-300'}`} />
        <p className={`text-sm ${isDragging ? 'text-[#00c4cc] font-medium' : 'text-gray-400'}`}>
          {isDragging ? 'ファイルをドロップしてアップロード' : 'ファイルをドラッグ&ドロップ、またはクリックしてアップロード'}
        </p>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 mb-1">
              {documents.length === 0 ? '書類がまだ登録されていません' : '条件に一致する書類がありません'}
            </p>
            <p className="text-sm text-gray-400">
              {documents.length === 0 ? 'アップロードボタンから書類を追加してください' : '検索条件やフィルターを変更してください'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map(doc => {
              const child = children.find(c => c.id === doc.childId);
              const statusConf = STATUS_CONFIG[doc.status];
              const StatusIcon = statusConf.icon;
              return (
                <div key={doc.id} className="p-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    {/* Document Icon */}
                    <div className={`p-2.5 rounded-lg ${statusConf.bg} flex-shrink-0`}>
                      <FileText className={`w-5 h-5 ${statusConf.color}`} />
                    </div>

                    {/* Document Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-gray-800 truncate">
                          {doc.documentName || DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                        </p>
                        <ExpiryBadge expiryDate={doc.expiryDate} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{child?.name || '不明'}</span>
                        <span>{DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}</span>
                        {doc.updatedAt && <span>更新: {formatDate(doc.updatedAt)}</span>}
                        {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConf.bg} ${statusConf.color} ${statusConf.border}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConf.label}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.filePath && (
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="ダウンロード">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="更新">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      {doc.status === 'submitted' && (
                        <button
                          onClick={() => handleStatusUpdate(doc.id, 'approved')}
                          className="px-3 py-1.5 text-xs font-medium bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors"
                        >
                          承認
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const DOCUMENT_TABS = [
  { id: 'documents', label: '書類管理' },
  { id: 'audit-export', label: '監査エクスポート' },
  { id: 'service-records', label: 'サービス提供記録' },
] as const;

export default function DocumentManagementView() {
  const [activeTab, setActiveTab] = useState<string>('documents');

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          {DOCUMENT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#00c4cc] text-gray-800'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' && <DocumentManagementContent />}
      {activeTab === 'audit-export' && <AuditExportView />}
      {activeTab === 'service-records' && <ServiceRecordView />}
    </div>
  );
}
