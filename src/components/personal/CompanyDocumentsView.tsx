/**
 * CompanyDocumentsView - 会社書類表示
 * 施設からの配布書類を確認
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FolderOpen, Download, FileText, ChevronRight, Calendar, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CompanyDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileType: string;
  uploadedAt: string;
  isRead: boolean;
}

interface CompanyDocumentsViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onBack: () => void;
}

export default function CompanyDocumentsView({ userId, facilityId, facilityName, onBack }: CompanyDocumentsViewProps) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [userId, facilityId]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('company_documents')
        .select('*, company_document_reads!left(read_at)')
        .eq('facility_id', facilityId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      setDocuments((data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        description: d.description || '',
        category: d.category || '一般',
        fileUrl: d.file_url,
        fileType: d.file_type || 'pdf',
        uploadedAt: d.uploaded_at,
        isRead: d.company_document_reads?.some((r: any) => r.read_at) || false,
      })));
    } catch (err) {
      console.error('会社書類取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (docId: string) => {
    try {
      await supabase
        .from('company_document_reads')
        .upsert({
          document_id: docId,
          user_id: userId,
          read_at: new Date().toISOString(),
        });

      setDocuments(prev => prev.map(d =>
        d.id === docId ? { ...d, isRead: true } : d
      ));
    } catch (err) {
      console.error('既読マークエラー:', err);
    }
  };

  const handleOpenDocument = (doc: CompanyDocument) => {
    if (!doc.isRead) {
      markAsRead(doc.id);
    }
    window.open(doc.fileUrl, '_blank');
  };

  const categoryColors: Record<string, string> = {
    '一般': 'bg-gray-100 text-gray-700',
    '重要': 'bg-red-100 text-red-700',
    '福利厚生': 'bg-green-100 text-green-700',
    '研修': 'bg-blue-100 text-blue-700',
    'その他': 'bg-yellow-100 text-yellow-700',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
      >
        <span>&#8592;</span> 業務ツールに戻る
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-[#818CF8]" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">会社書類</h2>
              <p className="text-sm text-gray-500">{facilityName}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleOpenDocument(doc)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                    doc.isRead ? 'bg-gray-50 hover:bg-gray-100' : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${doc.isRead ? 'text-gray-400' : 'text-blue-500'}`} />
                    <div className="text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[doc.category] || 'bg-gray-100 text-gray-700'}`}>
                          {doc.category}
                        </span>
                        {!doc.isRead && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500 text-white">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className={`font-bold ${doc.isRead ? 'text-gray-600' : 'text-gray-800'}`}>
                        {doc.title}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.uploadedAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.isRead && <Eye className="w-4 h-4 text-gray-400" />}
                    <Download className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">配布書類はまだありません</p>
              <p className="text-sm text-gray-400 mt-1">施設から配布されると、ここに表示されます</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
