/**
 * DailyReportView - 日報作成・閲覧
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Calendar, ChevronRight, Send, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DailyReport {
  id: string;
  date: string;
  content: string;
  status: 'draft' | 'submitted' | 'approved';
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
}

interface DailyReportViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onBack: () => void;
}

export default function DailyReportView({ userId, facilityId, facilityName, onBack }: DailyReportViewProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportContent, setReportContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReports();
  }, [userId, facilityId]);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .order('date', { ascending: false })
        .limit(30);

      if (error) throw error;

      setReports((data || []).map((r: any) => ({
        id: r.id,
        date: r.date,
        content: r.content,
        status: r.status || 'draft',
        submittedAt: r.submitted_at,
        approvedAt: r.approved_at,
        approvedBy: r.approved_by,
        createdAt: r.created_at,
      })));
    } catch (err) {
      console.error('日報取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!reportContent.trim()) {
      alert('日報内容を入力してください');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('daily_reports')
        .upsert({
          user_id: userId,
          facility_id: facilityId,
          date: reportDate,
          content: reportContent,
          status: asDraft ? 'draft' : 'submitted',
          submitted_at: asDraft ? null : new Date().toISOString(),
        }, {
          onConflict: 'user_id,facility_id,date',
        });

      if (error) throw error;

      await loadReports();
      setShowForm(false);
      setReportContent('');
      alert(asDraft ? '下書きを保存しました' : '日報を提出しました');
    } catch (err: any) {
      console.error('日報保存エラー:', err);
      alert('保存に失敗しました: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig = {
    draft: { label: '下書き', color: 'bg-gray-100 text-gray-600' },
    submitted: { label: '提出済み', color: 'bg-blue-100 text-blue-600' },
    approved: { label: '承認済み', color: 'bg-green-100 text-green-600' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" />
      </div>
    );
  }

  if (showForm || selectedReport) {
    const isEditing = selectedReport?.status === 'draft';
    const isViewOnly = Boolean(selectedReport && selectedReport.status !== 'draft');

    return (
      <div className="space-y-4">
        <button
          onClick={() => { setShowForm(false); setSelectedReport(null); setReportContent(''); }}
          className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
        >
          <span>&#8592;</span> 一覧に戻る
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {isViewOnly ? '日報詳細' : (selectedReport ? '日報編集' : '日報作成')}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">日付</label>
              <input
                type="date"
                value={selectedReport?.date || reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                disabled={!!selectedReport}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#818CF8] disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">内容</label>
              <textarea
                value={selectedReport?.content || reportContent}
                onChange={(e) => selectedReport ? null : setReportContent(e.target.value)}
                disabled={isViewOnly}
                rows={10}
                placeholder="本日の業務内容、気づいた点、明日の予定など..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#818CF8] disabled:bg-gray-100 resize-none"
              />
            </div>

            {selectedReport && (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusConfig[selectedReport.status].color}`}>
                  {statusConfig[selectedReport.status].label}
                </span>
                {selectedReport.submittedAt && (
                  <span className="text-sm text-gray-500">
                    提出: {new Date(selectedReport.submittedAt).toLocaleString('ja-JP')}
                  </span>
                )}
              </div>
            )}

            {!isViewOnly && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  下書き保存
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#818CF8] text-white font-bold rounded-lg hover:bg-[#6366F1] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  提出する
                </button>
              </div>
            )}
          </div>
        </div>
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
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#818CF8]" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">日報</h2>
              <p className="text-sm text-gray-500">{facilityName}</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#818CF8] text-white font-bold rounded-lg hover:bg-[#6366F1]"
          >
            <Plus className="w-4 h-4" />
            新規作成
          </button>
        </div>

        <div className="p-4">
          {reports.length > 0 ? (
            <div className="space-y-2">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div className="text-left">
                      <p className="font-bold text-gray-800">
                        {new Date(report.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {report.content.substring(0, 50)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${statusConfig[report.status].color}`}>
                      {statusConfig[report.status].label}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">日報はまだありません</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-[#818CF8] font-bold hover:underline"
              >
                日報を作成する
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
