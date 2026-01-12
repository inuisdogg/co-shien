/**
 * 苦情・事故・ヒヤリハット報告管理コンポーネント
 * 運営指導で必須の「苦情処理、事故対応」関連書類
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Plus,
  Edit,
  Save,
  X,
  User,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Download,
  Filter,
  Search,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PdfDocument, formatDate, toJapaneseEra } from '@/utils/pdfExport';

// 報告の型定義
type IncidentReport = {
  id: string;
  facilityId: string;
  reportType: 'complaint' | 'accident' | 'near_miss' | 'injury';
  title: string;
  occurredAt: string;
  discoveredAt?: string;
  reportedAt: string;
  location?: string;
  childId?: string;
  childName?: string;
  reporterId?: string;
  reporterName?: string;
  description: string;
  cause?: string;
  immediateAction?: string;
  injuryDetails?: string;
  hospitalVisit: boolean;
  hospitalName?: string;
  diagnosis?: string;
  complainantType?: string;
  complainantName?: string;
  complaintContent?: string;
  responseContent?: string;
  responseDate?: string;
  preventionMeasures?: string;
  improvementPlan?: string;
  followUpNotes?: string;
  familyNotified: boolean;
  familyNotifiedAt?: string;
  staffShared: boolean;
  adminReportRequired: boolean;
  adminReported: boolean;
  attachments?: Array<{ name: string; url: string; type: string }>;
  status: 'draft' | 'submitted' | 'reviewing' | 'resolved' | 'closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
};

// 児童の型定義
type Child = {
  id: string;
  name: string;
};

// DBのsnake_caseからcamelCaseに変換
const mapDbToReport = (row: any): IncidentReport => ({
  id: row.id,
  facilityId: row.facility_id,
  reportType: row.report_type,
  title: row.title,
  occurredAt: row.occurred_at,
  discoveredAt: row.discovered_at,
  reportedAt: row.reported_at,
  location: row.location,
  childId: row.child_id,
  childName: row.child_name,
  reporterId: row.reporter_id,
  reporterName: row.reporter_name,
  description: row.description,
  cause: row.cause,
  immediateAction: row.immediate_action,
  injuryDetails: row.injury_details,
  hospitalVisit: row.hospital_visit || false,
  hospitalName: row.hospital_name,
  diagnosis: row.diagnosis,
  complainantType: row.complainant_type,
  complainantName: row.complainant_name,
  complaintContent: row.complaint_content,
  responseContent: row.response_content,
  responseDate: row.response_date,
  preventionMeasures: row.prevention_measures,
  improvementPlan: row.improvement_plan,
  followUpNotes: row.follow_up_notes,
  familyNotified: row.family_notified || false,
  familyNotifiedAt: row.family_notified_at,
  staffShared: row.staff_shared || false,
  adminReportRequired: row.admin_report_required || false,
  adminReported: row.admin_reported || false,
  attachments: row.attachments,
  status: row.status,
  severity: row.severity,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// camelCaseからsnake_caseに変換
const mapReportToDb = (report: Partial<IncidentReport>) => ({
  facility_id: report.facilityId,
  report_type: report.reportType,
  title: report.title,
  occurred_at: report.occurredAt,
  discovered_at: report.discoveredAt,
  reported_at: report.reportedAt,
  location: report.location,
  child_id: report.childId,
  child_name: report.childName,
  reporter_id: report.reporterId,
  reporter_name: report.reporterName,
  description: report.description,
  cause: report.cause,
  immediate_action: report.immediateAction,
  injury_details: report.injuryDetails,
  hospital_visit: report.hospitalVisit,
  hospital_name: report.hospitalName,
  diagnosis: report.diagnosis,
  complainant_type: report.complainantType,
  complainant_name: report.complainantName,
  complaint_content: report.complaintContent,
  response_content: report.responseContent,
  response_date: report.responseDate,
  prevention_measures: report.preventionMeasures,
  improvement_plan: report.improvementPlan,
  follow_up_notes: report.followUpNotes,
  family_notified: report.familyNotified,
  family_notified_at: report.familyNotifiedAt,
  staff_shared: report.staffShared,
  admin_report_required: report.adminReportRequired,
  admin_reported: report.adminReported,
  attachments: report.attachments,
  status: report.status,
  severity: report.severity,
});

// 報告種別
const reportTypes = {
  complaint: { label: '苦情', color: 'bg-purple-100 text-purple-700', icon: MessageSquare },
  accident: { label: '事故', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  near_miss: { label: 'ヒヤリハット', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  injury: { label: '怪我', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
};

// ステータス
const statusLabels = {
  draft: { label: '下書き', color: 'bg-gray-100 text-gray-700' },
  submitted: { label: '提出済み', color: 'bg-blue-100 text-blue-700' },
  reviewing: { label: '確認中', color: 'bg-yellow-100 text-yellow-700' },
  resolved: { label: '対応完了', color: 'bg-green-100 text-green-700' },
  closed: { label: 'クローズ', color: 'bg-gray-100 text-gray-500' },
};

// 重要度
const severityLabels = {
  low: { label: '軽微', color: 'bg-gray-100 text-gray-600' },
  medium: { label: '中程度', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: '重大', color: 'bg-orange-100 text-orange-700' },
  critical: { label: '緊急', color: 'bg-red-100 text-red-700' },
};

export default function IncidentReportView() {
  const { user, facility } = useAuth();
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // フィルター
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // フォーム状態
  const [formData, setFormData] = useState<Partial<IncidentReport>>({
    reportType: 'near_miss',
    title: '',
    occurredAt: new Date().toISOString().slice(0, 16),
    location: '',
    description: '',
    cause: '',
    immediateAction: '',
    preventionMeasures: '',
    severity: 'low',
    status: 'draft',
    hospitalVisit: false,
    familyNotified: false,
    staffShared: false,
    adminReportRequired: false,
    adminReported: false,
  });

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      // 報告を取得
      const { data: reportData, error: reportError } = await supabase
        .from('incident_reports')
        .select('*')
        .eq('facility_id', facility.id)
        .order('occurred_at', { ascending: false });

      if (reportError) throw reportError;
      setReports((reportData || []).map(mapDbToReport));

      // 児童一覧を取得
      const { data: childData, error: childError } = await supabase
        .from('children')
        .select('id, name')
        .eq('facility_id', facility.id)
        .order('name');

      if (childError) throw childError;
      setChildren(childData || []);
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 保存処理
  const handleSave = async () => {
    if (!facility?.id || !formData.title || !formData.description) {
      alert('タイトルと概要は必須です');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...mapReportToDb(formData),
        facility_id: facility.id,
        reporter_id: user?.id,
        reporter_name: user?.name,
        reported_at: new Date().toISOString(),
      };

      if (selectedReport && isEditing) {
        // 更新
        const { error } = await supabase
          .from('incident_reports')
          .update(dataToSave)
          .eq('id', selectedReport.id);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('incident_reports')
          .insert(dataToSave);

        if (error) throw error;
      }

      await fetchData();
      setIsCreating(false);
      setIsEditing(false);
      setSelectedReport(null);
      resetForm();
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      reportType: 'near_miss',
      title: '',
      occurredAt: new Date().toISOString().slice(0, 16),
      location: '',
      description: '',
      cause: '',
      immediateAction: '',
      preventionMeasures: '',
      severity: 'low',
      status: 'draft',
      hospitalVisit: false,
      familyNotified: false,
      staffShared: false,
      adminReportRequired: false,
      adminReported: false,
    });
  };

  // PDF出力
  const exportPdf = (report: IncidentReport) => {
    const pdf = new PdfDocument({
      title: `${reportTypes[report.reportType].label}報告書`,
      facilityName: facility?.name || '施設名',
      facilityCode: facility?.code,
      createdAt: formatDate(new Date(), 'short'),
    });

    pdf.drawHeader();
    pdf.addSpace(5);

    // 基本情報
    pdf.addLabelValue('報告種別', reportTypes[report.reportType].label);
    pdf.addLabelValue('タイトル', report.title);
    pdf.addLabelValue('発生日時', toJapaneseEra(report.occurredAt));
    pdf.addLabelValue('発生場所', report.location || '-');
    pdf.addLabelValue('重要度', severityLabels[report.severity].label);
    pdf.addLabelValue('報告者', report.reporterName || '-');

    if (report.childName) {
      pdf.addLabelValue('関係児童', report.childName);
    }

    pdf.addSpace(5);
    pdf.addLine();
    pdf.addSpace(5);

    // 詳細
    pdf.addText('概要・状況', { fontSize: 12 });
    pdf.addSpace(3);
    pdf.addMultilineText(report.description);

    if (report.cause) {
      pdf.addSpace(5);
      pdf.addText('原因', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(report.cause);
    }

    if (report.immediateAction) {
      pdf.addSpace(5);
      pdf.addText('応急処置・初期対応', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(report.immediateAction);
    }

    // 怪我・事故の場合
    if ((report.reportType === 'accident' || report.reportType === 'injury') && report.injuryDetails) {
      pdf.addSpace(5);
      pdf.addText('怪我の状況', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(report.injuryDetails);

      if (report.hospitalVisit) {
        pdf.addLabelValue('受診', `${report.hospitalName || ''}${report.diagnosis ? ` (${report.diagnosis})` : ''}`);
      }
    }

    // 苦情の場合
    if (report.reportType === 'complaint') {
      if (report.complainantType) {
        pdf.addLabelValue('申出者', `${report.complainantType}${report.complainantName ? ` (${report.complainantName})` : ''}`);
      }
      if (report.complaintContent) {
        pdf.addSpace(5);
        pdf.addText('苦情内容', { fontSize: 12 });
        pdf.addSpace(3);
        pdf.addMultilineText(report.complaintContent);
      }
      if (report.responseContent) {
        pdf.addSpace(5);
        pdf.addText('対応内容', { fontSize: 12 });
        pdf.addSpace(3);
        pdf.addMultilineText(report.responseContent);
      }
    }

    // 再発防止策
    if (report.preventionMeasures) {
      pdf.addSpace(5);
      pdf.addText('再発防止策', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(report.preventionMeasures);
    }

    // 署名欄
    pdf.addSignatureBlock([
      { role: '報告者', name: report.reporterName, signed: true },
      { role: '確認者', signed: false },
      { role: '管理者', signed: false },
    ]);

    pdf.save(`${reportTypes[report.reportType].label}報告_${report.title}_${formatDate(report.occurredAt, 'short')}.pdf`);
  };

  // フィルター適用
  const filteredReports = reports.filter((report) => {
    if (filterType !== 'all' && report.reportType !== filterType) return false;
    if (filterStatus !== 'all' && report.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        report.title.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.childName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-[#00c4cc]" />
            苦情・事故報告
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            苦情・事故・ヒヤリハットの報告を管理します
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
            setSelectedReport(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg text-sm font-medium hover:bg-[#00b0b8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規報告
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全種別</option>
              <option value="complaint">苦情</option>
              <option value="accident">事故</option>
              <option value="near_miss">ヒヤリハット</option>
              <option value="injury">怪我</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全ステータス</option>
              <option value="draft">下書き</option>
              <option value="submitted">提出済み</option>
              <option value="reviewing">確認中</option>
              <option value="resolved">対応完了</option>
              <option value="closed">クローズ</option>
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 報告一覧 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">報告一覧</h2>
              <p className="text-xs text-gray-500 mt-1">{filteredReports.length}件</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredReports.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  報告がありません
                </div>
              ) : (
                filteredReports.map((report) => {
                  const TypeIcon = reportTypes[report.reportType].icon;
                  return (
                    <button
                      key={report.id}
                      onClick={() => {
                        setSelectedReport(report);
                        setIsCreating(false);
                        setIsEditing(false);
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedReport?.id === report.id ? 'bg-[#00c4cc]/5 border-l-4 border-[#00c4cc]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${reportTypes[report.reportType].color}`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${severityLabels[report.severity].color}`}>
                              {severityLabels[report.severity].label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[report.status].color}`}>
                              {statusLabels[report.status].label}
                            </span>
                          </div>
                          <p className="font-medium text-gray-800 truncate">{report.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(report.occurredAt).toLocaleDateString('ja-JP')}
                            {report.childName && ` / ${report.childName}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 詳細・フォーム */}
        <div className="lg:col-span-2">
          {isCreating || (selectedReport && isEditing) ? (
            // 編集フォーム
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedReport ? '報告を編集' : '新規報告'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* 報告種別 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">報告種別</label>
                  <div className="flex gap-2">
                    {(Object.keys(reportTypes) as Array<keyof typeof reportTypes>).map((type) => {
                      const TypeIcon = reportTypes[type].icon;
                      return (
                        <button
                          key={type}
                          onClick={() => setFormData({ ...formData, reportType: type })}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                            formData.reportType === type
                              ? 'border-[#00c4cc] bg-[#00c4cc]/5 text-[#00c4cc]'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <TypeIcon className="w-4 h-4" />
                          {reportTypes[type].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* タイトル */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">タイトル *</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="報告のタイトルを入力"
                  />
                </div>

                {/* 発生日時・場所 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">発生日時</label>
                    <input
                      type="datetime-local"
                      value={formData.occurredAt || ''}
                      onChange={(e) => setFormData({ ...formData, occurredAt: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">発生場所</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="例: 活動室、園庭"
                    />
                  </div>
                </div>

                {/* 関係児童 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">関係児童</label>
                  <select
                    value={formData.childId || ''}
                    onChange={(e) => {
                      const child = children.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        childId: e.target.value || undefined,
                        childName: child?.name,
                      });
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="">選択してください</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 概要・状況 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">概要・状況 *</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="発生した状況を詳しく記載してください"
                  />
                </div>

                {/* 原因 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">原因</label>
                  <textarea
                    value={formData.cause || ''}
                    onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="原因として考えられることを記載"
                  />
                </div>

                {/* 応急処置・初期対応 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">応急処置・初期対応</label>
                  <textarea
                    value={formData.immediateAction || ''}
                    onChange={(e) => setFormData({ ...formData, immediateAction: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="実施した対応を記載"
                  />
                </div>

                {/* 怪我・事故の場合の追加項目 */}
                {(formData.reportType === 'accident' || formData.reportType === 'injury') && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">怪我の状況</label>
                      <textarea
                        value={formData.injuryDetails || ''}
                        onChange={(e) => setFormData({ ...formData, injuryDetails: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        placeholder="怪我の部位、程度など"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.hospitalVisit || false}
                          onChange={(e) => setFormData({ ...formData, hospitalVisit: e.target.checked })}
                          className="w-4 h-4 text-[#00c4cc] rounded"
                        />
                        <span className="text-sm text-gray-700">病院受診あり</span>
                      </label>
                    </div>
                    {formData.hospitalVisit && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">受診先</label>
                          <input
                            type="text"
                            value={formData.hospitalName || ''}
                            onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">診断内容</label>
                          <input
                            type="text"
                            value={formData.diagnosis || ''}
                            onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 苦情の場合の追加項目 */}
                {formData.reportType === 'complaint' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">申出者種別</label>
                        <select
                          value={formData.complainantType || ''}
                          onChange={(e) => setFormData({ ...formData, complainantType: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        >
                          <option value="">選択してください</option>
                          <option value="保護者">保護者</option>
                          <option value="近隣住民">近隣住民</option>
                          <option value="その他">その他</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">申出者名</label>
                        <input
                          type="text"
                          value={formData.complainantName || ''}
                          onChange={(e) => setFormData({ ...formData, complainantName: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">苦情内容</label>
                      <textarea
                        value={formData.complaintContent || ''}
                        onChange={(e) => setFormData({ ...formData, complaintContent: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">対応内容</label>
                      <textarea
                        value={formData.responseContent || ''}
                        onChange={(e) => setFormData({ ...formData, responseContent: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      />
                    </div>
                  </>
                )}

                {/* 再発防止策 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">再発防止策</label>
                  <textarea
                    value={formData.preventionMeasures || ''}
                    onChange={(e) => setFormData({ ...formData, preventionMeasures: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="今後の対策を記載"
                  />
                </div>

                {/* 重要度・ステータス */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">重要度</label>
                    <select
                      value={formData.severity || 'low'}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    >
                      <option value="low">軽微</option>
                      <option value="medium">中程度</option>
                      <option value="high">重大</option>
                      <option value="critical">緊急</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ステータス</label>
                    <select
                      value={formData.status || 'draft'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    >
                      <option value="draft">下書き</option>
                      <option value="submitted">提出済み</option>
                      <option value="reviewing">確認中</option>
                      <option value="resolved">対応完了</option>
                      <option value="closed">クローズ</option>
                    </select>
                  </div>
                </div>

                {/* 通知チェック */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.familyNotified || false}
                      onChange={(e) => setFormData({ ...formData, familyNotified: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] rounded"
                    />
                    <span className="text-sm text-gray-700">家族に連絡済み</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.staffShared || false}
                      onChange={(e) => setFormData({ ...formData, staffShared: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] rounded"
                    />
                    <span className="text-sm text-gray-700">スタッフ共有済み</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.adminReportRequired || false}
                      onChange={(e) => setFormData({ ...formData, adminReportRequired: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] rounded"
                    />
                    <span className="text-sm text-gray-700">行政報告が必要</span>
                  </label>
                </div>

                {/* 保存ボタン */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedReport ? (
            // 詳細表示
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${reportTypes[selectedReport.reportType].color}`}>
                      {reportTypes[selectedReport.reportType].label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityLabels[selectedReport.severity].color}`}>
                      {severityLabels[selectedReport.severity].label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[selectedReport.status].color}`}>
                      {statusLabels[selectedReport.status].label}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedReport.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedReport.occurredAt).toLocaleString('ja-JP')}
                    {selectedReport.location && ` / ${selectedReport.location}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportPdf(selectedReport)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    PDF出力
                  </button>
                  <button
                    onClick={() => {
                      setFormData({
                        ...selectedReport,
                        occurredAt: selectedReport.occurredAt.slice(0, 16),
                      });
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                    編集
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {selectedReport.childName && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">関係児童</h3>
                    <p className="text-gray-600">{selectedReport.childName}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-2">概要・状況</h3>
                  <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                    {selectedReport.description}
                  </p>
                </div>

                {selectedReport.cause && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">原因</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedReport.cause}
                    </p>
                  </div>
                )}

                {selectedReport.immediateAction && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">応急処置・初期対応</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedReport.immediateAction}
                    </p>
                  </div>
                )}

                {selectedReport.preventionMeasures && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">再発防止策</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedReport.preventionMeasures}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {selectedReport.familyNotified ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600">家族連絡</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedReport.staffShared ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600">スタッフ共有</span>
                  </div>
                  {selectedReport.adminReportRequired && (
                    <div className="flex items-center gap-2">
                      {selectedReport.adminReported ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      )}
                      <span className="text-sm text-gray-600">行政報告</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-400 pt-4 border-t">
                  報告者: {selectedReport.reporterName || '不明'} /
                  報告日時: {new Date(selectedReport.reportedAt).toLocaleString('ja-JP')}
                </div>
              </div>
            </div>
          ) : (
            // 未選択時
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>報告を選択するか、新規報告を作成してください</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
