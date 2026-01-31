/**
 * PayslipView - 給与明細・書類表示
 * 施設から配布された書類（給与明細、源泉徴収票、雇用契約書など）を確認
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Download, Calendar, ChevronRight, FileText, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StaffDocument {
  id: string;
  documentType: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  targetYear?: number;
  targetMonth?: number;
  issuedAt: string;
  isRead: boolean;
}

interface PayslipViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onBack: () => void;
}

const DOCUMENT_TYPES = {
  payslip: { label: '給与明細', color: 'bg-blue-100 text-blue-700', icon: Wallet },
  withholding_tax: { label: '源泉徴収票', color: 'bg-green-100 text-green-700', icon: FileText },
  employment_contract: { label: '雇用契約書', color: 'bg-purple-100 text-purple-700', icon: FileText },
  wage_notice: { label: '賃金通知書', color: 'bg-yellow-100 text-yellow-700', icon: FileText },
  social_insurance: { label: '社会保険関連', color: 'bg-pink-100 text-pink-700', icon: FileText },
  year_end_adjustment: { label: '年末調整', color: 'bg-orange-100 text-orange-700', icon: FileText },
  other: { label: 'その他', color: 'bg-gray-100 text-gray-700', icon: FileText },
};

export default function PayslipView({ userId, facilityId, facilityName, onBack }: PayslipViewProps) {
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadDocuments();
  }, [userId, facilityId]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_documents')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .order('target_year', { ascending: false })
        .order('target_month', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDocuments((data || []).map((d: any) => ({
        id: d.id,
        documentType: d.document_type,
        title: d.title,
        description: d.description,
        fileUrl: d.file_url,
        fileName: d.file_name,
        targetYear: d.target_year,
        targetMonth: d.target_month,
        issuedAt: d.issued_at,
        isRead: d.is_read,
      })));
    } catch (err) {
      console.error('書類取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (docId: string) => {
    try {
      await supabase
        .from('staff_documents')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', docId);
    } catch (err) {
      console.error('既読更新エラー:', err);
    }
  };

  const handleOpenDocument = (doc: StaffDocument) => {
    if (!doc.isRead) {
      markAsRead(doc.id);
      setDocuments(documents.map(d => d.id === doc.id ? { ...d, isRead: true } : d));
    }
    window.open(doc.fileUrl, '_blank');
  };

  const filteredDocuments = filterType === 'all'
    ? documents
    : documents.filter(d => d.documentType === filterType);

  // ドキュメントタイプごとのカウント
  const typeCounts: Record<string, number> = {};
  documents.forEach(d => {
    typeCounts[d.documentType] = (typeCounts[d.documentType] || 0) + 1;
  });

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6 text-[#818CF8]" />
              <div>
                <h2 className="text-lg font-bold text-gray-800">書類・給与明細</h2>
                <p className="text-sm text-gray-500">{facilityName}</p>
              </div>
            </div>
            {documents.length > 0 && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="all">すべて ({documents.length})</option>
                {Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => (
                  typeCounts[key] > 0 && (
                    <option key={key} value={key}>{label} ({typeCounts[key]})</option>
                  )
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="p-4">
          {filteredDocuments.length > 0 ? (
            <div className="space-y-2">
              {filteredDocuments.map((doc) => {
                const typeInfo = DOCUMENT_TYPES[doc.documentType as keyof typeof DOCUMENT_TYPES] || DOCUMENT_TYPES.other;
                const Icon = typeInfo.icon;
                return (
                  <button
                    key={doc.id}
                    onClick={() => handleOpenDocument(doc)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                      doc.isRead ? 'bg-gray-50 hover:bg-gray-100' : 'bg-[#818CF8]/5 hover:bg-[#818CF8]/10 border border-[#818CF8]/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          {!doc.isRead && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">新着</span>
                          )}
                          {doc.targetYear && (
                            <span className="text-xs text-gray-500">
                              {doc.targetYear}年{doc.targetMonth ? `${doc.targetMonth}月` : ''}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-gray-800 mt-1">{doc.title}</p>
                        {doc.fileName && (
                          <p className="text-xs text-gray-500">{doc.fileName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">書類はまだありません</p>
              <p className="text-sm text-gray-400 mt-1">施設から配布されると、ここに表示されます</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
