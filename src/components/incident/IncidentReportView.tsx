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

const REPORT_TYPE_COLORS: Record<ReportType, { color: string; bg: string }> = {
  complaint: { color: 'text-gray-600', bg: 'bg-gray-100' },
  accident: { color: 'text-gray-600', bg: 'bg-gray-100' },
  near_miss: { color: 'text-gray-600', bg: 'bg-gray-100' },
  injury: { color: 'text-gray-600', bg: 'bg-gray-100' },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
  low: { label: '軽微', color: 'text-gray-500', bg: 'bg-gray-50' },
  medium: { label: '中程度', color: 'text-gray-600', bg: 'bg-gray-100' },
  high: { label: '重大', color: 'text-gray-700', bg: 'bg-gray-100' },
  critical: { label: '緊急', color: 'text-gray-800', bg: 'bg-gray-200' },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
  submitted: { label: '報告済', color: 'text-gray-600', bg: 'bg-gray-100', icon: AlertCircle },
  reviewing: { label: '確認中', color: 'text-gray-600', bg: 'bg-gray-100', icon: Eye },
  resolved: { label: '対応完了', color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle },
  closed: { label: '完了', color: 'text-gray-400', bg: 'bg-gray-50', icon: Shield },
};

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

export default function IncidentReportView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    const fetch = async () => {
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
    fetch();
  }, [facilityId]);

  const stats = useMemo(() => {
    const total = reports.length;
    const open = reports.filter(r => !['resolved', 'closed'].includes(r.status)).length;
    const critical = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length;
    const needsAdminReport = reports.filter(r => r.adminReportRequired && !r.adminReported).length;
    return { total, open, critical, needsAdminReport };
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (typeFilter !== 'all' && r.reportType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchTerm && !r.title.includes(searchTerm) && !r.childName?.includes(searchTerm) && !r.description?.includes(searchTerm)) return false;
      return true;
    });
  }, [reports, typeFilter, statusFilter, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-[#00c4cc]" />
        <h1 className="text-xl font-bold text-gray-800">苦情・事故報告</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">総報告数</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">未対応</p>
          <p className="text-2xl font-bold text-gray-800">{stats.open}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">重大/緊急</p>
          <p className="text-2xl font-bold text-gray-800">{stats.critical}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">行政報告待ち</p>
          <p className="text-2xl font-bold text-gray-800">{stats.needsAdminReport}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="タイトル・児童名で検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">全種別</option>
            {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">全ステータス</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Report List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {reports.length === 0 ? '報告がまだ登録されていません' : '条件に一致する報告がありません'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(report => {
              const sc = STATUS_CONFIG[report.status];
              const tc = REPORT_TYPE_COLORS[report.reportType];
              const sev = SEVERITY_CONFIG[report.severity];
              const StatusIcon = sc.icon;
              const isExpanded = expandedReport === report.id;
              return (
                <div key={report.id}>
                  <button
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 mt-1 text-gray-400" /> : <ChevronRight className="w-4 h-4 mt-1 text-gray-400" />}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-800">{report.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${tc.bg} ${tc.color}`}>
                              {REPORT_TYPE_LABELS[report.reportType]}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${sev.bg} ${sev.color}`}>
                              {sev.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span>発生: {new Date(report.occurredAt).toLocaleDateString('ja-JP')}</span>
                            {report.childName && <span>児童: {report.childName}</span>}
                            {report.location && <span>場所: {report.location}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.adminReportRequired && !report.adminReported && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700 font-medium">行政報告要</span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${sc.bg} ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 space-y-3">
                      {report.description && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">概要</p><p className="text-sm text-gray-700">{report.description}</p></div>
                      )}
                      {report.cause && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">原因</p><p className="text-sm text-gray-700">{report.cause}</p></div>
                      )}
                      {report.immediateAction && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">応急対応</p><p className="text-sm text-gray-700">{report.immediateAction}</p></div>
                      )}
                      {report.injuryDetails && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">怪我の詳細</p><p className="text-sm text-gray-700">{report.injuryDetails}{report.hospitalVisit && ' (通院あり)'}</p></div>
                      )}
                      {report.complaintContent && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">苦情内容</p><p className="text-sm text-gray-700">{report.complaintContent}</p></div>
                      )}
                      {report.responseContent && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">対応内容</p><p className="text-sm text-gray-700">{report.responseContent}</p></div>
                      )}
                      {report.preventionMeasures && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">再発防止策</p><p className="text-sm text-gray-700">{report.preventionMeasures}</p></div>
                      )}
                      {report.improvementPlan && (
                        <div><p className="text-xs font-medium text-gray-400 mb-1">改善計画</p><p className="text-sm text-gray-700">{report.improvementPlan}</p></div>
                      )}
                      <div className="flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-200">
                        <span>家族通知: {report.familyNotified ? '済' : '未'}</span>
                        <span>行政報告要: {report.adminReportRequired ? (report.adminReported ? '報告済' : '未報告') : '不要'}</span>
                        <span>報告者: {report.reporterName || '不明'}</span>
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
