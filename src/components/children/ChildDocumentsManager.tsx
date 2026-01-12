/**
 * 児童書類管理コンポーネント
 * 契約書、アセスメントシートなどの必要書類を管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  Eye,
  Trash2,
  Plus,
  Calendar,
} from 'lucide-react';
import {
  ChildDocument,
  DocumentTemplate,
  DocumentType,
  DocumentStatus,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
} from '@/types';
import { supabase } from '@/lib/supabase';

type Props = {
  childId: string;
  childName: string;
  facilityId: string;
  onClose: () => void;
};

const STATUS_ICONS: Record<DocumentStatus, typeof CheckCircle> = {
  required: AlertCircle,
  submitted: Clock,
  approved: CheckCircle,
  expired: AlertTriangle,
  rejected: AlertTriangle,
};

export const ChildDocumentsManager: React.FC<Props> = ({
  childId,
  childName,
  facilityId,
  onClose,
}) => {
  const [documents, setDocuments] = useState<ChildDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDocument, setNewDocument] = useState<{
    documentType: DocumentType;
    documentName: string;
    dueDate: string;
  }>({
    documentType: 'contract',
    documentName: '',
    dueDate: '',
  });

  useEffect(() => {
    fetchData();
  }, [childId, facilityId]);

  const fetchData = async () => {
    try {
      // 既存の書類を取得
      const { data: docs } = await supabase
        .from('child_documents')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('child_id', childId)
        .order('document_type', { ascending: true })
        .order('created_at', { ascending: false });

      if (docs) {
        setDocuments(
          docs.map((d) => ({
            id: d.id,
            facilityId: d.facility_id,
            childId: d.child_id,
            documentType: d.document_type as DocumentType,
            documentName: d.document_name,
            description: d.description,
            status: d.status as DocumentStatus,
            filePath: d.file_path,
            fileName: d.file_name,
            fileSize: d.file_size,
            mimeType: d.mime_type,
            dueDate: d.due_date,
            expiryDate: d.expiry_date,
            submittedAt: d.submitted_at,
            submittedBy: d.submitted_by,
            reviewedAt: d.reviewed_at,
            reviewedBy: d.reviewed_by,
            rejectionReason: d.rejection_reason,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            version: d.version,
          }))
        );
      }

      // テンプレートを取得
      const { data: tpls } = await supabase
        .from('document_templates')
        .select('*')
        .eq('facility_id', facilityId)
        .order('document_type', { ascending: true });

      if (tpls) {
        setTemplates(
          tpls.map((t) => ({
            id: t.id,
            facilityId: t.facility_id,
            documentType: t.document_type as DocumentType,
            documentName: t.document_name,
            description: t.description,
            isRequired: t.is_required,
            defaultDueDays: t.default_due_days,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // テンプレートから必要書類を自動生成
  const initializeFromTemplates = async () => {
    try {
      const today = new Date();
      const newDocs = templates
        .filter((t) => !documents.some((d) => d.documentType === t.documentType))
        .map((t) => {
          const dueDate = t.defaultDueDays
            ? new Date(today.getTime() + t.defaultDueDays * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0]
            : null;
          return {
            id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            facility_id: facilityId,
            child_id: childId,
            document_type: t.documentType,
            document_name: t.documentName,
            description: t.description,
            status: 'required' as const,
            due_date: dueDate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            version: 1,
          };
        });

      if (newDocs.length > 0) {
        await supabase.from('child_documents').insert(newDocs);
        fetchData();
      }
    } catch (error) {
      console.error('Error initializing documents:', error);
    }
  };

  // 書類ステータスを更新
  const updateStatus = async (docId: string, newStatus: DocumentStatus) => {
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'submitted') {
        updateData.submitted_at = new Date().toISOString();
      } else if (newStatus === 'approved') {
        updateData.reviewed_at = new Date().toISOString();
      }

      await supabase.from('child_documents').update(updateData).eq('id', docId);
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // 書類を削除
  const deleteDocument = async (docId: string) => {
    if (!confirm('この書類を削除しますか？')) return;
    try {
      await supabase.from('child_documents').delete().eq('id', docId);
      fetchData();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  // 新規書類を追加
  const addDocument = async () => {
    if (!newDocument.documentName) {
      alert('書類名を入力してください');
      return;
    }
    try {
      await supabase.from('child_documents').insert({
        id: `doc-${Date.now()}`,
        facility_id: facilityId,
        child_id: childId,
        document_type: newDocument.documentType,
        document_name: newDocument.documentName,
        status: 'required',
        due_date: newDocument.dueDate || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      });
      setShowAddForm(false);
      setNewDocument({ documentType: 'contract', documentName: '', dueDate: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding document:', error);
    }
  };

  // 統計を計算
  const stats = {
    total: documents.length,
    required: documents.filter((d) => d.status === 'required').length,
    submitted: documents.filter((d) => d.status === 'submitted').length,
    approved: documents.filter((d) => d.status === 'approved').length,
    expired: documents.filter((d) => d.status === 'expired').length,
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc] mx-auto"></div>
          <p className="text-gray-600 mt-4">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">必要書類管理</h2>
            <p className="text-sm text-gray-500">{childName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 統計バー */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              全{stats.total}件
            </span>
            {stats.required > 0 && (
              <span className="text-orange-600 font-medium">
                未提出: {stats.required}
              </span>
            )}
            {stats.submitted > 0 && (
              <span className="text-blue-600 font-medium">
                確認中: {stats.submitted}
              </span>
            )}
            {stats.approved > 0 && (
              <span className="text-green-600 font-medium">
                承認済: {stats.approved}
              </span>
            )}
            {stats.expired > 0 && (
              <span className="text-red-600 font-medium">
                期限切: {stats.expired}
              </span>
            )}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">登録された書類がありません</p>
              {templates.length > 0 && (
                <button
                  onClick={initializeFromTemplates}
                  className="px-4 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors"
                >
                  テンプレートから必要書類を登録
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const StatusIcon = STATUS_ICONS[doc.status];
                const statusInfo = DOCUMENT_STATUS_LABELS[doc.status];
                const isOverdue =
                  doc.status === 'required' &&
                  doc.dueDate &&
                  new Date(doc.dueDate) < new Date();

                return (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-lg border ${
                      isOverdue
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            doc.status === 'approved'
                              ? 'bg-green-100'
                              : doc.status === 'required'
                              ? 'bg-orange-100'
                              : 'bg-gray-100'
                          }`}
                        >
                          <FileText
                            size={20}
                            className={
                              doc.status === 'approved'
                                ? 'text-green-600'
                                : doc.status === 'required'
                                ? 'text-orange-600'
                                : 'text-gray-600'
                            }
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-800">
                              {doc.documentName}
                            </h4>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}
                            >
                              <StatusIcon size={12} />
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {DOCUMENT_TYPE_LABELS[doc.documentType]}
                            {doc.description && ` - ${doc.description}`}
                          </p>
                          {doc.dueDate && (
                            <p
                              className={`text-xs mt-1 flex items-center gap-1 ${
                                isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
                              }`}
                            >
                              <Calendar size={12} />
                              提出期限: {doc.dueDate}
                              {isOverdue && ' （期限超過）'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.status === 'required' && (
                          <button
                            onClick={() => updateStatus(doc.id, 'submitted')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="提出済みにする"
                          >
                            <Upload size={16} />
                          </button>
                        )}
                        {doc.status === 'submitted' && (
                          <button
                            onClick={() => updateStatus(doc.id, 'approved')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="承認する"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {doc.filePath && (
                          <button
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="ファイルを表示"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 新規追加フォーム */}
          {showAddForm && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="font-bold text-sm text-gray-700 mb-3">新規書類追加</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={newDocument.documentType}
                  onChange={(e) =>
                    setNewDocument({
                      ...newDocument,
                      documentType: e.target.value as DocumentType,
                    })
                  }
                  className="border border-gray-300 rounded-md p-2 text-sm"
                >
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newDocument.documentName}
                  onChange={(e) =>
                    setNewDocument({ ...newDocument, documentName: e.target.value })
                  }
                  placeholder="書類名"
                  className="border border-gray-300 rounded-md p-2 text-sm"
                />
                <input
                  type="date"
                  value={newDocument.dueDate}
                  onChange={(e) =>
                    setNewDocument({ ...newDocument, dueDate: e.target.value })
                  }
                  className="border border-gray-300 rounded-md p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={addDocument}
                  className="px-3 py-1.5 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] text-sm"
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            {!showAddForm && (
              <>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors text-sm"
                >
                  <Plus size={16} />
                  書類を追加
                </button>
                {templates.length > 0 &&
                  documents.length > 0 &&
                  documents.length < templates.length && (
                    <button
                      onClick={initializeFromTemplates}
                      className="flex items-center gap-1 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors text-sm"
                    >
                      <FileText size={16} />
                      不足書類を追加
                    </button>
                  )}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChildDocumentsManager;
