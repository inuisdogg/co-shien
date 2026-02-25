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
  ArrowUpDown,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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
  createdAt: string;
  updatedAt: string;
}

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// Skeleton loader
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
  const { facility } = useAuth();
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

  const stats = useMemo(() => {
    const total = reports.length;
    const open = reports.filter(r => !['resolved', 'closed'].includes(r.status)).length;
    const critical = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length;
    const needsAdminReport = reports.filter(r => r.adminReportRequired && !r.adminReported).length;
    return { total, open, critical, needsAdminReport };
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

    // Sort
    if (sortBy === 'oldest') {
      result.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    } else if (sortBy === 'severity') {
      const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      result.sort((a, b) => order[a.severity] - order[b.severity]);
    }
    // newest is default (from DB)

    return result;
  }, [reports, typeFilter, statusFilter, searchTerm, sortBy, dateFrom, dateTo]);

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
          <AlertTriangle className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">苦情・事故報告</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <Download className="w-4 h-4" />
            エクスポート
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors">
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          >
            <option value="all">全種別</option>
            {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          >
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
            <option value="severity">重大度順</option>
          </select>
        </div>
        {/* Date range filter */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">期間:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          />
          <span className="text-gray-400">〜</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-[#00c4cc] hover:underline"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* Timeline Report List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 mb-2">
              {reports.length === 0 ? '報告がまだ登録されていません' : '条件に一致する報告がありません'}
            </p>
            {reports.length === 0 && (
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors mt-2">
                <Plus className="w-4 h-4" />
                記録を追加
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gray-100" />

            {filtered.map((report, index) => {
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
                    {/* Timeline dot with severity color */}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
