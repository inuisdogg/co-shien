'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Upload,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFacilityData } from '@/hooks/useFacilityData';
import { ChildDocument, DocumentStatus } from '@/types';

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  required: { label: '未提出', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
  submitted: { label: '提出済', color: 'text-blue-600', bg: 'bg-blue-100', icon: FileText },
  approved: { label: '承認済', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  expired: { label: '期限切れ', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
  rejected: { label: '差戻し', color: 'text-orange-600', bg: 'bg-orange-100', icon: XCircle },
};

const DOCUMENT_CATEGORIES = [
  { key: 'contract', label: '契約書類', types: ['contract'] },
  { key: 'assessment', label: 'アセスメント', types: ['assessment'] },
  { key: 'support_plan', label: '支援計画', types: ['support_plan'] },
  { key: 'certificates', label: '受給者証・証明書', types: ['beneficiary_cert', 'medical_cert', 'insurance_card'] },
  { key: 'consent', label: '同意書', types: ['photo_consent', 'emergency_contact'] },
  { key: 'other', label: 'その他', types: ['other'] },
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

export default function DocumentManagementView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const { children } = useFacilityData();

  const [documents, setDocuments] = useState<ChildDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');

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

  const stats = useMemo(() => {
    const total = documents.length;
    const submitted = documents.filter(d => ['submitted', 'approved'].includes(d.status)).length;
    const expired = documents.filter(d => d.status === 'expired').length;
    const expiring = documents.filter(d => {
      if (!d.expiryDate) return false;
      const days = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86400000);
      return days > 0 && days <= 30;
    }).length;
    return { total, submitted, expired, expiring, rate: total > 0 ? Math.round((submitted / total) * 100) : 0 };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
      if (activeCategory !== 'all') {
        const cat = DOCUMENT_CATEGORIES.find(c => c.key === activeCategory);
        if (cat && !cat.types.includes(doc.documentType)) return false;
      }
      if (searchTerm) {
        const child = children.find(c => c.id === doc.childId);
        const nameMatch = child?.name.includes(searchTerm);
        const docMatch = doc.documentName?.includes(searchTerm);
        if (!nameMatch && !docMatch) return false;
      }
      return true;
    });
  }, [documents, statusFilter, activeCategory, searchTerm, children]);

  // Group by child for matrix view
  const documentMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, ChildDocument | undefined>> = {};
    children.forEach(c => {
      matrix[c.id] = {};
      filteredDocuments.filter(d => d.childId === c.id).forEach(d => {
        matrix[c.id][d.documentType] = d;
      });
    });
    return matrix;
  }, [children, filteredDocuments]);

  const handleStatusUpdate = async (docId: string, newStatus: DocumentStatus) => {
    try {
      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'approved') updates.reviewed_at = new Date().toISOString();
      const { error } = await supabase.from('child_documents').update(updates).eq('id', docId);
      if (error) throw error;
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d));
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-cyan-500" />
          <h1 className="text-xl font-bold text-gray-800">書類管理</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">登録書類数</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">提出率</p>
          <p className="text-2xl font-bold text-cyan-600">{stats.rate}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">期限間近</p>
          <p className="text-2xl font-bold text-amber-600">{stats.expiring}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">期限切れ</p>
          <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="児童名・書類名で検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">全ステータス</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setActiveCategory('all')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeCategory === 'all' ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>全カテゴリ</button>
          {DOCUMENT_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeCategory === cat.key ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {documents.length === 0 ? '書類がまだ登録されていません' : '条件に一致する書類がありません'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map(doc => {
              const child = children.find(c => c.id === doc.childId);
              const statusConf = STATUS_CONFIG[doc.status];
              const StatusIcon = statusConf.icon;
              return (
                <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-800">{doc.documentName || DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}</p>
                        <p className="text-sm text-gray-500">{child?.name || '不明'} / {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.expiryDate && (
                        <span className="text-xs text-gray-500">期限: {doc.expiryDate}</span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConf.bg} ${statusConf.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConf.label}
                      </span>
                      {doc.status === 'submitted' && (
                        <button onClick={() => handleStatusUpdate(doc.id, 'approved')} className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">承認</button>
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
