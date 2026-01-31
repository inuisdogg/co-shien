/**
 * DocumentOutputView - 書類出力
 * 各種証明書・申請書類の出力
 */

'use client';

import React, { useState } from 'react';
import { FileOutput, Download, FileText, Printer, CheckCircle, Calendar, Building2 } from 'lucide-react';

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresApproval: boolean;
}

interface DocumentOutputViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  userName: string;
  onBack: () => void;
}

const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'employment_certificate',
    name: '在職証明書',
    description: '現在の在職状況を証明する書類',
    category: '証明書',
    requiresApproval: true,
  },
  {
    id: 'income_certificate',
    name: '収入証明書',
    description: '給与収入を証明する書類',
    category: '証明書',
    requiresApproval: true,
  },
  {
    id: 'attendance_record',
    name: '出勤簿（月別）',
    description: '指定月の出勤記録',
    category: '勤怠',
    requiresApproval: false,
  },
  {
    id: 'leave_certificate',
    name: '休暇取得証明書',
    description: '有給休暇の取得状況を証明',
    category: '証明書',
    requiresApproval: true,
  },
  {
    id: 'withholding_slip',
    name: '源泉徴収票',
    description: '年末調整用の源泉徴収票',
    category: '税務',
    requiresApproval: false,
  },
  {
    id: 'social_insurance',
    name: '社会保険料控除証明書',
    description: '社会保険料の控除額証明',
    category: '税務',
    requiresApproval: false,
  },
];

export default function DocumentOutputView({ userId, facilityId, facilityName, userName, onBack }: DocumentOutputViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categoryColors: Record<string, string> = {
    '証明書': 'bg-blue-100 text-blue-700',
    '勤怠': 'bg-green-100 text-green-700',
    '税務': 'bg-purple-100 text-purple-700',
  };

  const handleRequest = async () => {
    if (!selectedTemplate) return;

    if (selectedTemplate.requiresApproval && !requestReason.trim()) {
      alert('申請理由を入力してください');
      return;
    }

    setSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    setSubmitting(false);
    setSubmitted(true);
  };

  const handleDownload = async () => {
    if (!selectedTemplate) return;

    // In a real implementation, this would generate and download the PDF
    alert(`${selectedTemplate.name}のダウンロードを開始します（デモ）`);
  };

  if (selectedTemplate) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedTemplate(null); setSubmitted(false); setRequestReason(''); }}
          className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
        >
          <span>&#8592;</span> 書類一覧に戻る
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#818CF8]/10 rounded-lg">
              <FileText className="w-6 h-6 text-[#818CF8]" />
            </div>
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-1 ${categoryColors[selectedTemplate.category]}`}>
                {selectedTemplate.category}
              </span>
              <h2 className="text-xl font-bold text-gray-800">{selectedTemplate.name}</h2>
              <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
            </div>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                {selectedTemplate.requiresApproval ? '申請が完了しました' : 'ダウンロード準備完了'}
              </h3>
              <p className="text-gray-600 mb-6">
                {selectedTemplate.requiresApproval
                  ? '承認後、ダウンロード可能になります。通知をお待ちください。'
                  : '書類のダウンロードが可能です。'}
              </p>
              {!selectedTemplate.requiresApproval && (
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-[#818CF8] text-white font-bold rounded-lg hover:bg-[#6366F1]"
                >
                  <Download className="w-5 h-5" />
                  ダウンロード
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">出力情報</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">氏名</p>
                    <p className="font-bold text-gray-800">{userName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">所属施設</p>
                    <p className="font-bold text-gray-800">{facilityName}</p>
                  </div>
                </div>
              </div>

              {selectedTemplate.id === 'attendance_record' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    対象月
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
                  />
                </div>
              )}

              {(selectedTemplate.id === 'withholding_slip' || selectedTemplate.id === 'social_insurance') && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    対象年度
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <option key={year} value={year}>{year}年</option>
                      );
                    })}
                  </select>
                </div>
              )}

              {selectedTemplate.requiresApproval && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    申請理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    rows={3}
                    placeholder="書類が必要な理由を入力してください"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#818CF8] resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    この書類は管理者の承認が必要です
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                {selectedTemplate.requiresApproval ? (
                  <button
                    onClick={handleRequest}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#818CF8] text-white font-bold rounded-lg hover:bg-[#6366F1] disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                      <>
                        <FileOutput className="w-5 h-5" />
                        申請する
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleDownload}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#818CF8] text-white font-bold rounded-lg hover:bg-[#6366F1]"
                    >
                      <Download className="w-5 h-5" />
                      ダウンロード
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100"
                    >
                      <Printer className="w-5 h-5" />
                      印刷
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const groupedTemplates = DOCUMENT_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, DocumentTemplate[]>);

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
            <FileOutput className="w-6 h-6 text-[#818CF8]" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">書類出力</h2>
              <p className="text-sm text-gray-500">{facilityName}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {Object.entries(groupedTemplates).map(([category, templates]) => (
            <div key={category}>
              <h3 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[category]}`}>
                  {category}
                </span>
              </h3>
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div className="text-left">
                        <p className="font-bold text-gray-800">{template.name}</p>
                        <p className="text-xs text-gray-500">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {template.requiresApproval && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
                          要承認
                        </span>
                      )}
                      <Download className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
