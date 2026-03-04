'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Shield,
  ChevronDown,
  ChevronRight,
  Plus,
  Download,
  Calendar,
  MapPin,
  User,
  FileText,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

type ReportType = 'complaint' | 'accident' | 'near_miss' | 'injury';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'draft' | 'submitted' | 'reviewing' | 'resolved' | 'closed';

interface IncidentReport {
  id: string;
  facilityId: string;
  reportType: ReportType;
  title: string;
  description: string | null;
  occurredAt: string;
  discoveredAt: string | null;
  reportedAt: string | null;
  location: string | null;
  childId: string | null;
  childName: string | null;
  reporterName: string | null;
  cause: string | null;
  immediateAction: string | null;
  injuryDetails: string | null;
  hospitalVisit: boolean;
  complainantName: string | null;
  complaintContent: string | null;
  responseContent: string | null;
  preventionMeasures: string | null;
  improvementPlan: string | null;
  familyNotified: boolean;
  adminReportRequired: boolean;
  adminReported: boolean;
  severity: Severity;
  status: IncidentStatus;
  responseDueDate: string | null;
  responseCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  reportType: ReportType;
  title: string;
  description: string;
  occurredAt: string;
  location: string;
  childId: string;
  childName: string;
  reporterName: string;
  cause: string;
  immediateAction: string;
  injuryDetails: string;
  hospitalVisit: boolean;
  complainantName: string;
  complaintContent: string;
  responseContent: string;
  preventionMeasures: string;
  improvementPlan: string;
  familyNotified: boolean;
  adminReportRequired: boolean;
  severity: Severity;
  status: IncidentStatus;
}

const EMPTY_FORM: FormData = {
  reportType: 'near_miss',
  title: '',
  description: '',
  occurredAt: new Date().toISOString().slice(0, 16),
  location: '',
  childId: '',
  childName: '',
  reporterName: '',
  cause: '',
  immediateAction: '',
  injuryDetails: '',
  hospitalVisit: false,
  complainantName: '',
  complaintContent: '',
  responseContent: '',
  preventionMeasures: '',
  improvementPlan: '',
  familyNotified: false,
  adminReportRequired: false,
  severity: 'low',
  status: 'draft',
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  complaint: '苦情',
  accident: '事故',
  near_miss: 'ヒヤリハット',
  injury: '怪我',
};

const REPORT_TYPE_COLORS: Record<ReportType, { color: string; bg: string; border: string }> = {
  complaint: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  accident: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  near_miss: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  injury: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; dot: string }> = {
  low: { label: '軽微', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
  medium: { label: '中程度', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
  high: { label: '重大', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
  critical: { label: '緊急', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600' },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: Clock },
  submitted: { label: '報告済', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertCircle },
  reviewing: { label: '確認中', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Eye },
  resolved: { label: '対応完了', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  closed: { label: '完了', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Shield },
};

type SortOption = 'newest' | 'oldest' | 'severity';

function mapRow(row: any): IncidentReport {
  return {
    id: row.id,
    facilityId: row.facility_id,
    reportType: row.report_type,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
    discoveredAt: row.discovered_at,
    reportedAt: row.reported_at,
    location: row.location,
    childId: row.child_id,
    childName: row.child_name,
    reporterName: row.reporter_name,
    cause: row.cause,
    immediateAction: row.immediate_action,
    injuryDetails: row.injury_details,
    hospitalVisit: row.hospital_visit || false,
    complainantName: row.complainant_name,
    complaintContent: row.complaint_content,
    responseContent: row.response_content,
    preventionMeasures: row.prevention_measures,
    improvementPlan: row.improvement_plan,
    familyNotified: row.family_notified || false,
    adminReportRequired: row.admin_report_required || false,
    adminReported: row.admin_reported || false,
    severity: row.severity || 'medium',
    status: row.status,
    responseDueDate: row.response_due_date || null,
    responseCompletedAt: row.response_completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function SkeletonCard() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-3 h-3 bg-gray-200 rounded-full mt-2" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-3 bg-gray-100 rounded w-64" />
        </div>
        <div className="h-6 bg-gray-100 rounded-full w-16" />
      </div>
    </div>
  );
}

export default function IncidentReportView() {
  const { facility, user } = useAuth();
  const { toast } = useToast();
  const facilityId = facility?.id || '';

  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<IncidentReport | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    const fetchReports = async () => {
      try {
        const { data, error } = await supabase
          .from('incident_reports')
          .select('*')
          .eq('facility_id', facilityId)
          .order('occurred_at', { ascending: false });
        if (error) {
          console.error('Error fetching incident reports:', error);
          return;
        }
        if (data) setReports(data.map(mapRow));
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [facilityId]);

  // Load children for selector when form opens
  useEffect(() => {
    if (!showForm || !facilityId) return;
    supabase
      .from('children')
      .select('id, name')
      .eq('facility_id', facilityId)
      .order('name')
      .then(({ data }) => {
        if (data) setChildren(data);
      });
  }, [showForm, facilityId]);

  const stats = useMemo(() => {
    const total = reports.length;
    const open = reports.filter(r => !['resolved', 'closed'].includes(r.status)).length;
    const critical = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length;
    const needsAdminReport = reports.filter(r => r.adminReportRequired && !r.adminReported).length;
    const overdueComplaints = reports.filter(r =>
      r.reportType === 'complaint' &&
      r.responseDueDate &&
      !['resolved', 'closed'].includes(r.status) &&
      daysUntilDate(r.responseDueDate) < 0
    ).length;
    return { total, open, critical, needsAdminReport, overdueComplaints };
  }, [reports]);

  const filtered = useMemo(() => {
    let result = reports.filter(r => {
      if (typeFilter !== 'all' && r.reportType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchTerm && !r.title.includes(searchTerm) && !r.childName?.includes(searchTerm) && !r.description?.includes(searchTerm)) return false;
      if (dateFrom && r.occurredAt < dateFrom) return false;
      if (dateTo && r.occurredAt > dateTo + 'T23:59:59') return false;
      return true;
    });

    if (sortBy === 'oldest') {
      result.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    } else if (sortBy === 'severity') {
      const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      result.sort((a, b) => order[a.severity] - order[b.severity]);
    }

    return result;
  }, [reports, typeFilter, statusFilter, searchTerm, sortBy, dateFrom, dateTo]);

  const openCreateForm = () => {
    setEditingReport(null);
    setFormData({
      ...EMPTY_FORM,
      reporterName: user?.name || '',
      occurredAt: new Date().toISOString().slice(0, 16),
    });
    setShowForm(true);
  };

  const openEditForm = (report: IncidentReport) => {
    setEditingReport(report);
    setFormData({
      reportType: report.reportType,
      title: report.title,
      description: report.description || '',
      occurredAt: report.occurredAt ? report.occurredAt.slice(0, 16) : '',
      location: report.location || '',
      childId: report.childId || '',
      childName: report.childName || '',
      reporterName: report.reporterName || '',
      cause: report.cause || '',
      immediateAction: report.immediateAction || '',
      injuryDetails: report.injuryDetails || '',
      hospitalVisit: report.hospitalVisit,
      complainantName: report.complainantName || '',
      complaintContent: report.complaintContent || '',
      responseContent: report.responseContent || '',
      preventionMeasures: report.preventionMeasures || '',
      improvementPlan: report.improvementPlan || '',
      familyNotified: report.familyNotified,
      adminReportRequired: report.adminReportRequired,
      severity: report.severity,
      status: report.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('タイトルを入力してください');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('概要を入力してください');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const dbRow: any = {
        facility_id: facilityId,
        report_type: formData.reportType,
        title: formData.title.trim(),
        description: formData.description.trim(),
        occurred_at: formData.occurredAt || now,
        location: formData.location || null,
        child_id: formData.childId || null,
        child_name: formData.childName || null,
        reporter_name: formData.reporterName || null,
        cause: formData.cause || null,
        immediate_action: formData.immediateAction || null,
        injury_details: formData.injuryDetails || null,
        hospital_visit: formData.hospitalVisit,
        complainant_name: formData.complainantName || null,
        complaint_content: formData.complaintContent || null,
        response_content: formData.responseContent || null,
        prevention_measures: formData.preventionMeasures || null,
        improvement_plan: formData.improvementPlan || null,
        family_notified: formData.familyNotified,
        admin_report_required: formData.adminReportRequired,
        severity: formData.severity,
        status: formData.status,
        updated_at: now,
      };

      // 苦情の場合は90日後の回答期限を自動設定
      if (formData.reportType === 'complaint' && !editingReport) {
        const dueDate = new Date(formData.occurredAt || now);
        dueDate.setDate(dueDate.getDate() + 90);
        dbRow.response_due_date = dueDate.toISOString().slice(0, 10);
      }

      if (editingReport) {
        // Update
        const { error } = await supabase
          .from('incident_reports')
          .update(dbRow)
          .eq('id', editingReport.id);

        if (error) throw error;

        setReports(prev => prev.map(r =>
          r.id === editingReport.id ? { ...mapRow({ ...dbRow, id: r.id, created_at: r.createdAt }) } : r
        ));
        toast.success('報告を更新しました');
      } else {
        // Create
        dbRow.reporter_id = user?.id || null;
        dbRow.reported_at = now;
        dbRow.created_at = now;

        const { data, error } = await supabase
          .from('incident_reports')
          .insert(dbRow)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setReports(prev => [mapRow(data), ...prev]);
        }
        toast.success('報告を作成しました');
      }

      setShowForm(false);
      setEditingReport(null);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('incident_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      setReports(prev => prev.filter(r => r.id !== reportId));
      setDeleteConfirmId(null);
      setExpandedReport(null);
      toast.success('報告を削除しました');
    } catch (err: any) {
      toast.error(err.message || '削除に失敗しました');
    }
  };

  const handleStatusUpdate = async (reportId: string, newStatus: IncidentStatus) => {
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'resolved') {
        updates.response_completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('incident_reports')
        .update(updates)
        .eq('id', reportId);

      if (error) throw error;

      setReports(prev => prev.map(r =>
        r.id === reportId ? { ...r, status: newStatus, ...(newStatus === 'resolved' ? { responseCompletedAt: updates.response_completed_at } : {}) } : r
      ));
      toast.success(`ステータスを「${STATUS_CONFIG[newStatus].label}」に変更しました`);
    } catch (err: any) {
      toast.error(err.message || 'ステータス更新に失敗しました');
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.warning('エクスポートするデータがありません');
      return;
    }

    const headers = ['種別', '重要度', 'ステータス', 'タイトル', '発生日時', '場所', '児童名', '報告者', '概要', '原因', '対応', '再発防止策'];
    const rows = filtered.map(r => [
      REPORT_TYPE_LABELS[r.reportType],
      SEVERITY_CONFIG[r.severity].label,
      STATUS_CONFIG[r.status].label,
      r.title,
      r.occurredAt ? formatDateTime(r.occurredAt) : '',
      r.location || '',
      r.childName || '',
      r.reporterName || '',
      r.description || '',
      r.cause || '',
      r.immediateAction || '',
      r.preventionMeasures || '',
    ]);

    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows].map(row =>
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `事故報告_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSVをダウンロードしました');
  };

  const handleChildSelect = (childId: string) => {
    const child = children.find(c => c.id === childId);
    setFormData(prev => ({
      ...prev,
      childId,
      childName: child?.name || '',
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
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
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-800">苦情・事故報告</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            エクスポート
          </button>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            記録を追加
          </button>
        </div>
      </div>

      {/* Urgent Alert */}
      {stats.needsAdminReport > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">{stats.needsAdminReport}件の行政報告が必要です</p>
            <p className="text-sm text-red-600 mt-0.5">速やかに所轄官庁への報告を行ってください</p>
          </div>
        </div>
      )}

      {/* Overdue Complaints Alert */}
      {stats.overdueComplaints > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">回答期限超過: {stats.overdueComplaints}件</p>
            <p className="text-sm text-red-600 mt-0.5">苦情の回答期限（90日）を超過しています。早急に対応してください</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg"><FileText className="w-5 h-5 text-gray-500" /></div>
            <div>
              <p className="text-sm text-gray-500">総報告数</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-sm text-gray-500">未対応</p>
              <p className="text-2xl font-bold text-gray-800">{stats.open}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <div>
              <p className="text-sm text-gray-500">重大/緊急</p>
              <p className="text-2xl font-bold text-gray-800">{stats.critical}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-sm text-gray-500">行政報告待ち</p>
              <p className="text-2xl font-bold text-gray-800">{stats.needsAdminReport}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="タイトル・児童名で検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">全種別</option>
            {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">全ステータス</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
            <option value="severity">重大度順</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">期間:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <span className="text-gray-400">〜</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-primary hover:underline"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* Timeline Report List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="w-7 h-7 text-gray-400" />}
            title={reports.length === 0 ? '報告がまだ登録されていません' : '条件に一致する報告がありません'}
            action={reports.length === 0 ? (
              <button
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                記録を追加
              </button>
            ) : undefined}
          />
        ) : (
          <div className="relative">
            <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gray-100" />

            {filtered.map((report) => {
              const sc = STATUS_CONFIG[report.status];
              const tc = REPORT_TYPE_COLORS[report.reportType];
              const sev = SEVERITY_CONFIG[report.severity];
              const StatusIcon = sc.icon;
              const isExpanded = expandedReport === report.id;

              return (
                <div key={report.id} className="relative">
                  <button
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    className="w-full text-left p-4 pl-12 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className={`absolute left-[22px] top-6 w-3 h-3 rounded-full border-2 border-white ${sev.dot} z-10`} />

                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-medium text-gray-800">{report.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tc.bg} ${tc.color} ${tc.border}`}>
                            {REPORT_TYPE_LABELS[report.reportType]}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${sev.bg} ${sev.color} ${sev.border} font-medium`}>
                            {sev.label}
                          </span>
                          {report.adminReportRequired && !report.adminReported && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                              行政報告要
                            </span>
                          )}
                          {report.reportType === 'complaint' && report.responseDueDate && (() => {
                            if (['resolved', 'closed'].includes(report.status) || report.responseCompletedAt) {
                              return (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                  回答済み
                                </span>
                              );
                            }
                            const daysLeft = daysUntilDate(report.responseDueDate);
                            if (daysLeft < 0) {
                              return (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                                  期限超過 ({Math.abs(daysLeft)}日)
                                </span>
                              );
                            }
                            if (daysLeft <= 14) {
                              return (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                  期限間近 (残り{daysLeft}日)
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            発生: {formatDateTime(report.occurredAt)}
                          </span>
                          {report.childName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {report.childName}
                            </span>
                          )}
                          {report.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {report.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${sc.bg} ${sc.color} ${sc.border}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="ml-12 mr-4 mb-4 bg-gray-50 rounded-xl p-5 space-y-4 border border-gray-100">
                      {/* Detail fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {report.description && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">概要</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.description}</p>
                          </div>
                        )}
                        {report.cause && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">原因</p>
                            <p className="text-sm text-gray-700">{report.cause}</p>
                          </div>
                        )}
                        {report.immediateAction && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">応急対応</p>
                            <p className="text-sm text-gray-700">{report.immediateAction}</p>
                          </div>
                        )}
                        {report.injuryDetails && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">怪我の詳細</p>
                            <p className="text-sm text-gray-700">
                              {report.injuryDetails}
                              {report.hospitalVisit && (
                                <span className="inline-flex items-center gap-1 ml-2 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">通院あり</span>
                              )}
                            </p>
                          </div>
                        )}
                        {report.complaintContent && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">苦情内容</p>
                            <p className="text-sm text-gray-700">{report.complaintContent}</p>
                            {report.complainantName && (
                              <p className="text-xs text-gray-400 mt-1">申立者: {report.complainantName}</p>
                            )}
                          </div>
                        )}
                        {report.responseContent && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">対応内容</p>
                            <p className="text-sm text-gray-700">{report.responseContent}</p>
                          </div>
                        )}
                        {report.preventionMeasures && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">再発防止策</p>
                            <p className="text-sm text-gray-700">{report.preventionMeasures}</p>
                          </div>
                        )}
                        {report.improvementPlan && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">改善計画</p>
                            <p className="text-sm text-gray-700">{report.improvementPlan}</p>
                          </div>
                        )}
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 pt-3 border-t border-gray-200">
                        <span className="flex items-center gap-1">
                          家族通知:
                          {report.familyNotified ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600"><CheckCircle className="w-3 h-3" />済</span>
                          ) : (
                            <span className="text-gray-500">未</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          行政報告:
                          {report.adminReportRequired ? (
                            report.adminReported ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600"><CheckCircle className="w-3 h-3" />報告済</span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-red-600 font-medium"><AlertCircle className="w-3 h-3" />未報告</span>
                            )
                          ) : (
                            <span className="text-gray-500">不要</span>
                          )}
                        </span>
                        <span>報告者: {report.reporterName || '不明'}</span>
                        {report.reportedAt && <span>報告日: {formatDate(report.reportedAt)}</span>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditForm(report); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          編集
                        </button>
                        {report.status === 'draft' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(report.id, 'submitted'); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            報告提出
                          </button>
                        )}
                        {report.status === 'submitted' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(report.id, 'reviewing'); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            確認中にする
                          </button>
                        )}
                        {(report.status === 'submitted' || report.status === 'reviewing') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(report.id, 'resolved'); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            対応完了
                          </button>
                        )}
                        {report.status === 'resolved' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(report.id, 'closed'); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            クローズ
                          </button>
                        )}
                        <div className="flex-1" />
                        {deleteConfirmId === report.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600">本当に削除しますか？</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                              className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600"
                            >
                              削除
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                              className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(report.id); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto pt-8 pb-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editingReport ? '報告を編集' : '新規報告作成'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingReport(null); }}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Row 1: Type + Severity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">種別 <span className="text-red-500">*</span></label>
                  <select
                    value={formData.reportType}
                    onChange={e => setFormData(prev => ({ ...prev, reportType: e.target.value as ReportType }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">重要度 <span className="text-red-500">*</span></label>
                  <select
                    value={formData.severity}
                    onChange={e => setFormData(prev => ({ ...prev, severity: e.target.value as Severity }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="報告のタイトル"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">概要・状況 <span className="text-red-500">*</span></label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="発生状況を詳しく記載してください"
                />
              </div>

              {/* Row: Date + Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">発生日時 <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={formData.occurredAt}
                    onChange={e => setFormData(prev => ({ ...prev, occurredAt: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">発生場所</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="例: 園庭、教室"
                  />
                </div>
              </div>

              {/* Row: Child + Reporter */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">関係児童</label>
                  <select
                    value={formData.childId}
                    onChange={e => handleChildSelect(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">選択なし</option>
                    {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">報告者</label>
                  <input
                    type="text"
                    value={formData.reporterName}
                    onChange={e => setFormData(prev => ({ ...prev, reporterName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Cause */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
                <textarea
                  value={formData.cause}
                  onChange={e => setFormData(prev => ({ ...prev, cause: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Immediate Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">応急処置・初期対応</label>
                <textarea
                  value={formData.immediateAction}
                  onChange={e => setFormData(prev => ({ ...prev, immediateAction: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Injury details (for accident/injury) */}
              {(formData.reportType === 'accident' || formData.reportType === 'injury') && (
                <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <div>
                    <label className="block text-sm font-medium text-orange-800 mb-1">怪我の詳細</label>
                    <textarea
                      value={formData.injuryDetails}
                      onChange={e => setFormData(prev => ({ ...prev, injuryDetails: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.hospitalVisit}
                      onChange={e => setFormData(prev => ({ ...prev, hospitalVisit: e.target.checked }))}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-orange-800">通院あり</span>
                  </label>
                </div>
              )}

              {/* Complaint fields */}
              {formData.reportType === 'complaint' && (
                <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">申立者名</label>
                    <input
                      type="text"
                      value={formData.complainantName}
                      onChange={e => setFormData(prev => ({ ...prev, complainantName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">苦情内容</label>
                    <textarea
                      value={formData.complaintContent}
                      onChange={e => setFormData(prev => ({ ...prev, complaintContent: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-1">対応内容</label>
                    <textarea
                      value={formData.responseContent}
                      onChange={e => setFormData(prev => ({ ...prev, responseContent: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Prevention measures */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">再発防止策</label>
                <textarea
                  value={formData.preventionMeasures}
                  onChange={e => setFormData(prev => ({ ...prev, preventionMeasures: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.familyNotified}
                    onChange={e => setFormData(prev => ({ ...prev, familyNotified: e.target.checked }))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  家族に通知済み
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.adminReportRequired}
                    onChange={e => setFormData(prev => ({ ...prev, adminReportRequired: e.target.checked }))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  行政報告が必要
                </label>
              </div>

              {/* Status (edit only) */}
              {editingReport && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as IncidentStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setEditingReport(null); }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : editingReport ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
