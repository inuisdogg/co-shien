'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  Package,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { WorkScheduleReport } from '@/types';
import type { MonthlyFinancial, ExpenseSummary } from '@/types/expense';
import {
  exportWorkScheduleToExcel,
  exportAttendanceToExcel,
  exportFinancialSummaryToExcel,
} from '@/lib/excelEngine';
import type { StaffAttendanceData, FinancialExportData } from '@/lib/excelEngine';
import {
  generateIncidentReportHTML,
  generateTrainingRecordHTML,
  generateCommitteeMeetingHTML,
  openPrintWindow,
} from '@/lib/wordEngine';
import type {
  IncidentReportData,
  TrainingRecordData,
  CommitteeMeetingData,
} from '@/lib/wordEngine';

// ---------- Types ----------

type DocumentCompletionStatus = 'complete' | 'partial' | 'missing';

interface AuditDocument {
  id: string;
  name: string;
  category: AuditDocumentCategory;
  description: string;
  status: DocumentCompletionStatus;
  count?: number;
  exportType: 'excel' | 'print' | 'pdf' | 'none';
}

type AuditDocumentCategory =
  | 'governance'
  | 'personnel'
  | 'service'
  | 'safety'
  | 'finance'
  | 'children'
  | 'training'
  | 'committees';

const CATEGORY_LABELS: Record<AuditDocumentCategory, string> = {
  governance: '運営・管理体制',
  personnel: '人員配置・勤務',
  service: 'サービス提供',
  safety: '安全管理・事故対応',
  finance: '経理・財務',
  children: '児童関連書類',
  training: '研修・教育',
  committees: '委員会・会議',
};

const CATEGORY_ICONS: Record<AuditDocumentCategory, React.ElementType> = {
  governance: Shield,
  personnel: FileText,
  service: FileText,
  safety: AlertTriangle,
  finance: FileSpreadsheet,
  children: FileText,
  training: FileText,
  committees: FileText,
};

const STATUS_CONFIG: Record<
  DocumentCompletionStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  complete: { label: '完了', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  partial: { label: '一部完了', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock },
  missing: { label: '未作成', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
};

// ---------- The 38 Audit Document Types ----------

function buildAuditDocumentList(): Omit<AuditDocument, 'status' | 'count'>[] {
  return [
    // Governance (運営・管理体制) - 6 docs
    { id: 'gov_01', name: '運営規程', category: 'governance', description: '事業所の運営方針・体制を定めた規程', exportType: 'none' },
    { id: 'gov_02', name: '重要事項説明書', category: 'governance', description: '利用者への重要事項説明文書', exportType: 'none' },
    { id: 'gov_03', name: '利用契約書', category: 'governance', description: '利用者との契約書一式', exportType: 'none' },
    { id: 'gov_04', name: '個人情報保護方針', category: 'governance', description: '個人情報の取扱いに関する方針', exportType: 'none' },
    { id: 'gov_05', name: '秘密保持誓約書', category: 'governance', description: 'スタッフの秘密保持に関する誓約書', exportType: 'none' },
    { id: 'gov_06', name: '苦情解決体制', category: 'governance', description: '苦情受付・解決フローの文書', exportType: 'none' },

    // Personnel (人員配置・勤務) - 5 docs
    { id: 'per_01', name: '勤務体制一覧表', category: 'personnel', description: '月別の人員配置・勤務体制', exportType: 'excel' },
    { id: 'per_02', name: '出勤簿', category: 'personnel', description: 'スタッフ別の月次出勤記録', exportType: 'excel' },
    { id: 'per_03', name: '資格証明書一覧', category: 'personnel', description: 'スタッフの保有資格一覧', exportType: 'excel' },
    { id: 'per_04', name: '雇用契約書', category: 'personnel', description: 'スタッフとの雇用契約書', exportType: 'none' },
    { id: 'per_05', name: '組織図', category: 'personnel', description: '事業所の組織体制図', exportType: 'none' },

    // Service (サービス提供) - 5 docs
    { id: 'svc_01', name: 'サービス提供記録', category: 'service', description: '日々のサービス提供記録', exportType: 'excel' },
    { id: 'svc_02', name: '個別支援計画書', category: 'service', description: '児童ごとの支援計画書', exportType: 'print' },
    { id: 'svc_03', name: 'アセスメントシート', category: 'service', description: '利用開始時のアセスメント記録', exportType: 'print' },
    { id: 'svc_04', name: 'モニタリング記録', category: 'service', description: '支援計画の達成状況モニタリング', exportType: 'print' },
    { id: 'svc_05', name: '連絡帳', category: 'service', description: '保護者との日々の連絡記録', exportType: 'none' },

    // Safety (安全管理・事故対応) - 6 docs
    { id: 'saf_01', name: '事故報告書', category: 'safety', description: '事故発生時の報告書', exportType: 'print' },
    { id: 'saf_02', name: 'ヒヤリハット報告書', category: 'safety', description: 'ヒヤリハット事例の報告書', exportType: 'print' },
    { id: 'saf_03', name: '苦情受付記録', category: 'safety', description: '苦情の受付・対応記録', exportType: 'print' },
    { id: 'saf_04', name: '避難訓練記録', category: 'safety', description: '避難訓練の実施記録', exportType: 'print' },
    { id: 'saf_05', name: '感染症対策マニュアル', category: 'safety', description: '感染症予防・対応マニュアル', exportType: 'none' },
    { id: 'saf_06', name: '安全管理チェックリスト', category: 'safety', description: '施設安全の点検記録', exportType: 'none' },

    // Finance (経理・財務) - 5 docs
    { id: 'fin_01', name: '月次財務サマリー', category: 'finance', description: '月別の収支・損益サマリー', exportType: 'excel' },
    { id: 'fin_02', name: '経費明細', category: 'finance', description: '経費申請・承認の詳細', exportType: 'excel' },
    { id: 'fin_03', name: '請求書一覧', category: 'finance', description: '利用料請求書の一覧', exportType: 'excel' },
    { id: 'fin_04', name: '領収書台帳', category: 'finance', description: '領収書の管理台帳', exportType: 'none' },
    { id: 'fin_05', name: '予算実績対比表', category: 'finance', description: '予算と実績の対比分析', exportType: 'excel' },

    // Children (児童関連書類) - 5 docs
    { id: 'chi_01', name: '受給者証', category: 'children', description: '児童の受給者証コピー', exportType: 'none' },
    { id: 'chi_02', name: '個人情報同意書', category: 'children', description: '個人情報使用に関する同意書', exportType: 'none' },
    { id: 'chi_03', name: '医療情報', category: 'children', description: '児童の医療・健康情報', exportType: 'none' },
    { id: 'chi_04', name: '緊急連絡先一覧', category: 'children', description: '保護者・緊急連絡先の一覧', exportType: 'excel' },
    { id: 'chi_05', name: '写真使用同意書', category: 'children', description: '写真撮影・使用に関する同意書', exportType: 'none' },

    // Training (研修・教育) - 3 docs
    { id: 'trn_01', name: '研修計画', category: 'training', description: '年間研修計画書', exportType: 'print' },
    { id: 'trn_02', name: '研修実施記録', category: 'training', description: '研修の実施記録・議事録', exportType: 'print' },
    { id: 'trn_03', name: '研修受講管理台帳', category: 'training', description: 'スタッフの研修受講状況管理', exportType: 'excel' },

    // Committees (委員会・会議) - 3 docs
    { id: 'com_01', name: '運営推進会議議事録', category: 'committees', description: '運営推進会議の議事録', exportType: 'print' },
    { id: 'com_02', name: '虐待防止委員会議事録', category: 'committees', description: '虐待防止委員会の議事録', exportType: 'print' },
    { id: 'com_03', name: '身体拘束適正化委員会議事録', category: 'committees', description: '身体拘束適正化委員会の議事録', exportType: 'print' },
  ];
}

// ---------- Component ----------

export default function AuditExportView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const facilityName = facility?.name || '';

  // State
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AuditDocumentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentCompletionStatus | 'all'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Data for exports
  const [workSchedules, setWorkSchedules] = useState<WorkScheduleReport[]>([]);
  const [financials, setFinancials] = useState<MonthlyFinancial[]>([]);
  const [incidentCount, setIncidentCount] = useState(0);
  const [trainingCount, setTrainingCount] = useState(0);
  const [committeeCount, setCommitteeCount] = useState(0);
  const [childDocCount, setChildDocCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);

  // Fetch document completion data
  useEffect(() => {
    if (!facilityId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch counts in parallel
        const [
          wsResult,
          finResult,
          incResult,
          trainResult,
          comResult,
          childDocResult,
          staffResult,
          expResult,
        ] = await Promise.all([
          supabase
            .from('work_schedule_reports')
            .select('*')
            .eq('facility_id', facilityId)
            .order('year', { ascending: false })
            .limit(12),
          supabase
            .from('monthly_financials')
            .select('*')
            .eq('facility_id', facilityId)
            .order('year', { ascending: false })
            .limit(12),
          supabase
            .from('incident_reports')
            .select('id', { count: 'exact' })
            .eq('facility_id', facilityId),
          supabase
            .from('training_records')
            .select('id', { count: 'exact' })
            .eq('facility_id', facilityId),
          supabase
            .from('committee_meetings')
            .select('id', { count: 'exact' })
            .eq('facility_id', facilityId),
          supabase
            .from('child_documents')
            .select('id', { count: 'exact' })
            .eq('facility_id', facilityId),
          supabase
            .from('users')
            .select('id', { count: 'exact' })
            .eq('facility_id', facilityId)
            .eq('user_type', 'staff'),
          supabase
            .from('expenses')
            .select('id', { count: 'exact' })
            .eq('facility_id', facilityId),
        ]);

        // Map work schedules
        const wsData: WorkScheduleReport[] = (wsResult.data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          facilityId: row.facility_id as string,
          year: row.year as number,
          month: row.month as number,
          staffAssignments: (row.staff_assignments as WorkScheduleReport['staffAssignments']) ?? [],
          totalStandardStaff: (row.total_standard_staff as number) ?? 0,
          totalAdditionStaff: (row.total_addition_staff as number) ?? 0,
          fteTotal: (row.fte_total as number) ?? 0,
          status: (row.status as WorkScheduleReport['status']) ?? 'draft',
          generatedAt: row.generated_at as string | undefined,
          submittedAt: row.submitted_at as string | undefined,
          submittedTo: row.submitted_to as string | undefined,
          approvedAt: row.approved_at as string | undefined,
          notes: row.notes as string | undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        }));
        setWorkSchedules(wsData);

        // Map financials
        const finData: MonthlyFinancial[] = (finResult.data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          facilityId: row.facility_id as string,
          year: row.year as number,
          month: row.month as number,
          revenueService: (row.revenue_service as number) ?? 0,
          revenueOther: (row.revenue_other as number) ?? 0,
          expensePersonnel: (row.expense_personnel as number) ?? 0,
          expenseFixed: (row.expense_fixed as number) ?? 0,
          expenseVariable: (row.expense_variable as number) ?? 0,
          expenseOther: (row.expense_other as number) ?? 0,
          grossProfit: (row.gross_profit as number) ?? 0,
          operatingProfit: (row.operating_profit as number) ?? 0,
          netCashFlow: (row.net_cash_flow as number) ?? 0,
          budgetRevenue: row.budget_revenue as number | undefined,
          budgetExpense: row.budget_expense as number | undefined,
          isFinalized: (row.is_finalized as boolean) ?? false,
          finalizedAt: row.finalized_at as string | undefined,
          finalizedBy: row.finalized_by as string | undefined,
          notes: row.notes as string | undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        }));
        setFinancials(finData);

        setIncidentCount(incResult.count ?? 0);
        setTrainingCount(trainResult.count ?? 0);
        setCommitteeCount(comResult.count ?? 0);
        setChildDocCount(childDocResult.count ?? 0);
        setStaffCount(staffResult.count ?? 0);
        setExpenseCount(expResult.count ?? 0);
      } catch (err) {
        console.error('Failed to fetch audit data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId]);

  // Build document list with computed statuses
  useEffect(() => {
    const templates = buildAuditDocumentList();

    const docs: AuditDocument[] = templates.map((tmpl) => {
      let status: DocumentCompletionStatus = 'missing';
      let count: number | undefined;

      switch (tmpl.id) {
        case 'per_01':
          count = workSchedules.length;
          status = count > 0 ? 'complete' : 'missing';
          break;
        case 'per_02':
          // Attendance derived from staff count
          status = staffCount > 0 ? 'partial' : 'missing';
          count = staffCount;
          break;
        case 'per_03':
          status = staffCount > 0 ? 'partial' : 'missing';
          count = staffCount;
          break;
        case 'saf_01':
        case 'saf_02':
        case 'saf_03':
          count = incidentCount;
          status = count > 0 ? 'complete' : 'missing';
          break;
        case 'fin_01':
        case 'fin_05':
          count = financials.length;
          status = count >= 12 ? 'complete' : count > 0 ? 'partial' : 'missing';
          break;
        case 'fin_02':
          count = expenseCount;
          status = count > 0 ? 'complete' : 'missing';
          break;
        case 'trn_01':
        case 'trn_02':
        case 'trn_03':
          count = trainingCount;
          status = count > 0 ? 'complete' : 'missing';
          break;
        case 'com_01':
        case 'com_02':
        case 'com_03':
          count = committeeCount;
          status = count > 0 ? 'complete' : 'missing';
          break;
        case 'chi_01':
        case 'chi_02':
        case 'chi_03':
        case 'chi_04':
        case 'chi_05':
          count = childDocCount;
          status = count > 0 ? 'partial' : 'missing';
          break;
        case 'svc_01':
        case 'svc_02':
        case 'svc_03':
        case 'svc_04':
          count = childDocCount;
          status = count > 0 ? 'partial' : 'missing';
          break;
        default:
          // Governance and other docs: mark as partial if facility exists
          status = facilityId ? 'partial' : 'missing';
          break;
      }

      return { ...tmpl, status, count };
    });

    setDocuments(docs);
  }, [workSchedules, financials, incidentCount, trainingCount, committeeCount, childDocCount, staffCount, expenseCount, facilityId]);

  // Summary stats
  const stats = useMemo(() => {
    const total = documents.length;
    const complete = documents.filter((d) => d.status === 'complete').length;
    const partial = documents.filter((d) => d.status === 'partial').length;
    const missing = documents.filter((d) => d.status === 'missing').length;
    const completionRate = total > 0 ? Math.round(((complete + partial * 0.5) / total) * 100) : 0;
    return { total, complete, partial, missing, completionRate };
  }, [documents]);

  // Grouped documents
  const groupedDocuments = useMemo(() => {
    const groups: Record<AuditDocumentCategory, AuditDocument[]> = {
      governance: [],
      personnel: [],
      service: [],
      safety: [],
      finance: [],
      children: [],
      training: [],
      committees: [],
    };

    for (const doc of documents) {
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) continue;
      if (statusFilter !== 'all' && doc.status !== statusFilter) continue;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !doc.name.toLowerCase().includes(term) &&
          !doc.description.toLowerCase().includes(term)
        ) {
          continue;
        }
      }
      groups[doc.category].push(doc);
    }

    return groups;
  }, [documents, categoryFilter, statusFilter, searchTerm]);

  // Toggle category expansion
  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // Expand all by default
  useEffect(() => {
    setExpandedCategories(new Set(Object.keys(CATEGORY_LABELS)));
  }, []);

  // Handle individual document export
  const handleExport = useCallback(
    async (doc: AuditDocument) => {
      setExportingId(doc.id);
      try {
        switch (doc.id) {
          case 'per_01': {
            // Export latest work schedule
            const latest = workSchedules[0];
            if (latest) {
              exportWorkScheduleToExcel(latest, facilityName);
            }
            break;
          }
          case 'fin_01':
          case 'fin_05': {
            // Export financial summary
            const exportData: FinancialExportData = {
              monthlies: financials,
              facilityName,
              fiscalYear: financials.length > 0 ? financials[0].year : new Date().getFullYear(),
            };
            exportFinancialSummaryToExcel(exportData);
            break;
          }
          case 'saf_01':
          case 'saf_02':
          case 'saf_03': {
            // Fetch incidents and print latest
            const reportTypeMap: Record<string, string> = {
              saf_01: 'accident',
              saf_02: 'near_miss',
              saf_03: 'complaint',
            };
            const reportType = reportTypeMap[doc.id] ?? 'accident';
            const { data } = await supabase
              .from('incident_reports')
              .select('*')
              .eq('facility_id', facilityId)
              .eq('report_type', reportType)
              .order('created_at', { ascending: false })
              .limit(1);

            if (data && data.length > 0) {
              const row = data[0];
              const report: IncidentReportData = {
                id: row.id,
                facilityName,
                reportType: row.report_type,
                title: row.title,
                description: row.description,
                occurredAt: row.occurred_at,
                discoveredAt: row.discovered_at,
                reportedAt: row.reported_at,
                location: row.location,
                childName: row.child_name,
                reporterName: row.reporter_name,
                cause: row.cause,
                immediateAction: row.immediate_action,
                injuryDetails: row.injury_details,
                hospitalVisit: row.hospital_visit ?? false,
                complainantName: row.complainant_name,
                complaintContent: row.complaint_content,
                responseContent: row.response_content,
                preventionMeasures: row.prevention_measures,
                improvementPlan: row.improvement_plan,
                familyNotified: row.family_notified ?? false,
                adminReportRequired: row.admin_report_required ?? false,
                adminReported: row.admin_reported ?? false,
                severity: row.severity ?? 'low',
                status: row.status,
                createdAt: row.created_at,
              };
              const html = generateIncidentReportHTML(report);
              openPrintWindow(html);
            }
            break;
          }
          case 'trn_01':
          case 'trn_02': {
            // Fetch latest training record and print
            const { data } = await supabase
              .from('training_records')
              .select('*')
              .eq('facility_id', facilityId)
              .order('training_date', { ascending: false })
              .limit(1);

            if (data && data.length > 0) {
              const row = data[0];
              const record: TrainingRecordData = {
                id: row.id,
                facilityName,
                trainingName: row.training_name,
                trainingType: row.training_type,
                trainingCategory: row.training_category,
                trainingDate: row.training_date,
                startTime: row.start_time,
                endTime: row.end_time,
                durationHours: row.duration_hours,
                location: row.location,
                instructorName: row.instructor_name,
                instructorAffiliation: row.instructor_affiliation,
                participants: row.participants ?? [],
                evaluationMethod: row.evaluation_method,
                contentSummary: row.content_summary,
                cost: row.cost,
                status: row.status,
              };
              const html = generateTrainingRecordHTML(record);
              openPrintWindow(html);
            }
            break;
          }
          case 'com_01':
          case 'com_02':
          case 'com_03': {
            // Fetch latest committee meeting and print
            const committeeTypeMap: Record<string, string> = {
              com_01: 'operation_promotion',
              com_02: 'abuse_prevention',
              com_03: 'restraint_review',
            };
            const committeeType = committeeTypeMap[doc.id] ?? 'operation_promotion';
            const { data } = await supabase
              .from('committee_meetings')
              .select('*')
              .eq('facility_id', facilityId)
              .eq('committee_type', committeeType)
              .order('meeting_date', { ascending: false })
              .limit(1);

            if (data && data.length > 0) {
              const row = data[0];
              const meeting: CommitteeMeetingData = {
                id: row.id,
                facilityName,
                committeeType: row.committee_type,
                committeeName: row.committee_name,
                meetingDate: row.meeting_date,
                location: row.location,
                meetingType: row.meeting_type,
                attendees: row.attendees ?? [],
                agenda: row.agenda ?? [],
                decisions: row.decisions,
                actionItems: row.action_items ?? [],
                reports: row.reports,
                status: row.status,
                approvedBy: row.approved_by,
                approvedAt: row.approved_at,
              };
              const html = generateCommitteeMeetingHTML(meeting);
              openPrintWindow(html);
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error('Export failed:', err);
      } finally {
        setExportingId(null);
      }
    },
    [workSchedules, financials, facilityId, facilityName],
  );

  // Generate full audit package
  const handleGeneratePackage = useCallback(async () => {
    setGenerating(true);
    try {
      // Export work schedule
      if (workSchedules.length > 0) {
        exportWorkScheduleToExcel(workSchedules[0], facilityName);
      }

      // Export financials
      if (financials.length > 0) {
        const exportData: FinancialExportData = {
          monthlies: financials,
          facilityName,
          fiscalYear: financials[0].year,
        };
        exportFinancialSummaryToExcel(exportData);
      }

      // Brief delay between downloads so browser can handle them
      await new Promise((resolve) => setTimeout(resolve, 500));

      alert('監査パッケージの生成が完了しました。ダウンロードフォルダをご確認ください。');
    } catch (err) {
      console.error('Package generation failed:', err);
      alert('監査パッケージの生成中にエラーが発生しました。');
    } finally {
      setGenerating(false);
    }
  }, [workSchedules, financials, facilityName]);

  // Render
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
        <span className="text-gray-600">監査書類を確認中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              監査書類エクスポート
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              実地指導・監査に必要な書類の完成状況確認とエクスポート
            </p>
          </div>
          <button
            onClick={handleGeneratePackage}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {generating ? '生成中...' : '監査パッケージ生成'}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">書類総数</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.complete}</p>
            <p className="text-xs text-green-600">完了</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{stats.partial}</p>
            <p className="text-xs text-yellow-600">一部完了</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.missing}</p>
            <p className="text-xs text-red-600">未作成</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.completionRate}%</p>
            <p className="text-xs text-blue-600">完成率</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="書類名で検索..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as AuditDocumentCategory | 'all')}
              className="pl-9 pr-8 py-2 border rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">全カテゴリ</option>
              {(Object.entries(CATEGORY_LABELS) as [AuditDocumentCategory, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DocumentCompletionStatus | 'all')}
            className="px-3 py-2 border rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">全ステータス</option>
            <option value="complete">完了</option>
            <option value="partial">一部完了</option>
            <option value="missing">未作成</option>
          </select>
        </div>
      </div>

      {/* Document list by category */}
      <div className="space-y-3">
        {(Object.entries(CATEGORY_LABELS) as [AuditDocumentCategory, string][]).map(([catKey, catLabel]) => {
          const catDocs = groupedDocuments[catKey];
          if (!catDocs || catDocs.length === 0) return null;

          const isExpanded = expandedCategories.has(catKey);
          const CatIcon = CATEGORY_ICONS[catKey];
          const catComplete = catDocs.filter((d) => d.status === 'complete').length;

          return (
            <div key={catKey} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(catKey)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <CatIcon className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">{catLabel}</span>
                  <span className="text-xs text-gray-400">
                    ({catComplete}/{catDocs.length} 完了)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{
                        width: `${catDocs.length > 0 ? (catComplete / catDocs.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </button>

              {/* Document rows */}
              {isExpanded && (
                <div className="border-t divide-y">
                  {catDocs.map((doc) => {
                    const statusConf = STATUS_CONFIG[doc.status];
                    const StatusIcon = statusConf.icon;
                    const canExport = doc.exportType !== 'none' && doc.status !== 'missing';
                    const isExporting = exportingId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusConf.color}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {doc.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{doc.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          {doc.count != null && (
                            <span className="text-xs text-gray-400">{doc.count}件</span>
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConf.bg} ${statusConf.color}`}
                          >
                            {statusConf.label}
                          </span>

                          {canExport && (
                            <button
                              onClick={() => handleExport(doc)}
                              disabled={isExporting}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                            >
                              {isExporting ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : doc.exportType === 'excel' ? (
                                <FileSpreadsheet className="w-3 h-3" />
                              ) : (
                                <Printer className="w-3 h-3" />
                              )}
                              {doc.exportType === 'excel' ? 'Excel' : '印刷'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {Object.values(groupedDocuments).every((g) => g.length === 0) && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">検索条件に一致する書類がありません</p>
        </div>
      )}
    </div>
  );
}
