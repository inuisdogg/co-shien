'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Download,
  Users,
  CheckCircle,
  Clock,
  FileText,
  Send,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { exportWorkScheduleToExcel } from '@/lib/excelEngine';
import {
  WorkScheduleReport,
  WorkScheduleStaffAssignment,
  WorkScheduleReportStatus,
  PERSONNEL_TYPE_LABELS,
  WORK_STYLE_LABELS,
  QUALIFICATION_CODES,
} from '@/types';

const STATUS_CONFIG: Record<WorkScheduleReportStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'text-gray-600', bg: 'bg-gray-100' },
  submitted: { label: '提出済', color: 'text-blue-600', bg: 'bg-blue-100' },
  approved: { label: '承認済', color: 'text-green-600', bg: 'bg-green-100' },
};

function mapRowToReport(row: any): WorkScheduleReport {
  return {
    id: row.id,
    facilityId: row.facility_id,
    year: row.year,
    month: row.month,
    staffAssignments: row.staff_assignments || [],
    totalStandardStaff: row.total_standard_staff,
    totalAdditionStaff: row.total_addition_staff,
    fteTotal: row.fte_total,
    status: row.status,
    generatedAt: row.generated_at,
    submittedAt: row.submitted_at,
    submittedTo: row.submitted_to,
    approvedAt: row.approved_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default function WorkScheduleView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [reports, setReports] = useState<WorkScheduleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WorkScheduleReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Month selector state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // Year options: current year -1 to current year +1
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  useEffect(() => {
    if (!facilityId) return;
    const fetchReports = async () => {
      try {
        const { data, error } = await supabase
          .from('work_schedule_reports')
          .select('*')
          .eq('facility_id', facilityId)
          .order('year', { ascending: false })
          .order('month', { ascending: false });

        if (error) {
          console.error('Error fetching work schedule reports:', error);
          return;
        }
        if (data) {
          const mapped = data.map(mapRowToReport);
          setReports(mapped);
          if (mapped.length > 0) setSelectedReport(mapped[0]);
        }
      } catch (error) {
        console.error('Error in fetchReports:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [facilityId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const year = selectedYear;
      const month = selectedMonth;

      // Fetch current staff personnel settings to generate report
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, qualifications')
        .eq('facility_id', facilityId);

      const { data: settingsData } = await supabase
        .from('staff_personnel_settings')
        .select('*')
        .eq('facility_id', facilityId);

      const { data: facilityData } = await supabase
        .from('facility_settings')
        .select('standard_weekly_hours')
        .eq('facility_id', facilityId)
        .single();

      const stdHours = facilityData?.standard_weekly_hours || 40;

      const settingsMap = new Map<string, any>();
      (settingsData || []).forEach((row: any) => {
        settingsMap.set(row.staff_id, row);
      });

      const assignments: WorkScheduleStaffAssignment[] = (staffData || [])
        .filter((s: any) => settingsMap.has(s.id))
        .map((s: any) => {
          const ps = settingsMap.get(s.id)!;
          const weeklyHours = ps.contracted_weekly_hours || stdHours;
          let fte: number;
          if (ps.work_style === 'fulltime_dedicated') fte = 1.0;
          else if (ps.work_style === 'fulltime_concurrent') fte = 0.75;
          else fte = Math.min(weeklyHours / stdHours, 1.0);

          const role = ps.is_service_manager ? '児童発達支援管理責任者' : ps.is_manager ? '管理者' : undefined;

          return {
            staffId: s.id,
            name: s.name,
            personnelType: ps.personnel_type,
            workStyle: ps.work_style,
            qualifications: s.qualifications || [],
            weeklyHours,
            fte: Math.round(fte * 100) / 100,
            assignedAdditions: ps.assigned_addition_codes || [],
            role,
          };
        });

      const totalStandard = assignments.filter(a => a.personnelType === 'standard').length;
      const totalAddition = assignments.filter(a => a.personnelType === 'addition').length;
      const fteTotal = assignments.reduce((sum, a) => sum + a.fte, 0);

      // Check if report already exists for this month
      const existing = reports.find(r => r.year === year && r.month === month);

      if (existing) {
        const { error } = await supabase
          .from('work_schedule_reports')
          .update({
            staff_assignments: assignments,
            total_standard_staff: totalStandard,
            total_addition_staff: totalAddition,
            fte_total: Math.round(fteTotal * 100) / 100,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;

        const updated = { ...existing, staffAssignments: assignments, totalStandardStaff: totalStandard, totalAdditionStaff: totalAddition, fteTotal: Math.round(fteTotal * 100) / 100, generatedAt: new Date().toISOString() };
        setReports(prev => prev.map(r => r.id === existing.id ? updated : r));
        setSelectedReport(updated);
      } else {
        const { data, error } = await supabase
          .from('work_schedule_reports')
          .insert({
            facility_id: facilityId,
            year,
            month,
            staff_assignments: assignments,
            total_standard_staff: totalStandard,
            total_addition_staff: totalAddition,
            fte_total: Math.round(fteTotal * 100) / 100,
            status: 'draft',
            generated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const mapped = mapRowToReport(data);
          setReports(prev => [mapped, ...prev]);
          setSelectedReport(mapped);
        }
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusTransition = async (report: WorkScheduleReport, newStatus: WorkScheduleReportStatus) => {
    setUpdatingStatus(report.id);
    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'submitted') {
        updates.submitted_at = new Date().toISOString();
      } else if (newStatus === 'approved') {
        updates.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('work_schedule_reports')
        .update(updates)
        .eq('id', report.id);

      if (error) throw error;

      const updated = {
        ...report,
        status: newStatus,
        ...(newStatus === 'submitted' ? { submittedAt: new Date().toISOString() } : {}),
        ...(newStatus === 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      };
      setReports(prev => prev.map(r => r.id === report.id ? updated : r));
      if (selectedReport?.id === report.id) {
        setSelectedReport(updated);
      }
    } catch (error) {
      console.error('Error updating report status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">勤務体制一覧表</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Month selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50 text-sm"
          >
            {generating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {selectedYear}年{selectedMonth}月分を生成
          </button>

          <button
            onClick={() => {
              if (reports.length > 0) {
                const latestReport = selectedReport || reports[0];
                exportWorkScheduleToExcel(latestReport, facility?.name);
              }
            }}
            disabled={reports.length === 0}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Excel出力
          </button>
        </div>
      </div>

      {/* Report List */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium">勤務体制一覧表がありません</p>
          <p className="text-sm mt-1">「今月分を生成」ボタンで現在の人員配置から一覧表を作成できます</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Report selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-700">一覧表一覧</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {reports.map(r => {
                const isSelected = selectedReport?.id === r.id;
                const sc = STATUS_CONFIG[r.status];
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-[#00c4cc]/5' : ''}`}
                  >
                    <p className="font-medium text-gray-800 text-sm">{r.year}年{r.month}月</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                      <span className="text-xs text-gray-400">FTE: {r.fteTotal}</span>
                    </div>
                    {/* Status transition buttons */}
                    <div className="flex items-center gap-1 mt-2">
                      {r.status === 'draft' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusTransition(r, 'submitted'); }}
                          disabled={updatingStatus === r.id}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          提出
                        </button>
                      )}
                      {r.status === 'submitted' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusTransition(r, 'approved'); }}
                          disabled={updatingStatus === r.id}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          <CheckSquare className="w-3 h-3" />
                          承認
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected report detail */}
          <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {selectedReport ? (
              <>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-800">{selectedReport.year}年{selectedReport.month}月 勤務体制一覧表</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      基準人員: {selectedReport.totalStandardStaff}名 / 加算人員: {selectedReport.totalAdditionStaff}名 / FTE合計: {selectedReport.fteTotal}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_CONFIG[selectedReport.status].bg} ${STATUS_CONFIG[selectedReport.status].color}`}>
                    {STATUS_CONFIG[selectedReport.status].label}
                  </span>
                </div>

                {selectedReport.staffAssignments.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">スタッフ配置データがありません</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-600">氏名</th>
                          <th className="text-left p-3 font-medium text-gray-600">役割</th>
                          <th className="text-left p-3 font-medium text-gray-600">人員区分</th>
                          <th className="text-left p-3 font-medium text-gray-600">勤務形態</th>
                          <th className="text-left p-3 font-medium text-gray-600">資格</th>
                          <th className="text-right p-3 font-medium text-gray-600">週時間</th>
                          <th className="text-right p-3 font-medium text-gray-600">FTE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedReport.staffAssignments.map((a, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-800">{a.name}</td>
                            <td className="p-3 text-gray-600">{a.role || '-'}</td>
                            <td className="p-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${a.personnelType === 'standard' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                {PERSONNEL_TYPE_LABELS[a.personnelType]}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600">{WORK_STYLE_LABELS[a.workStyle]}</td>
                            <td className="p-3 text-gray-600 text-xs">
                              {a.qualifications.length > 0
                                ? a.qualifications.map(q => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q).join(', ')
                                : '-'
                              }
                            </td>
                            <td className="p-3 text-right text-gray-600">{a.weeklyHours}h</td>
                            <td className="p-3 text-right font-medium text-gray-800">{a.fte.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-medium">
                        <tr>
                          <td colSpan={5} className="p-3 text-gray-600">合計</td>
                          <td className="p-3 text-right text-gray-600">
                            {selectedReport.staffAssignments.reduce((s, a) => s + a.weeklyHours, 0)}h
                          </td>
                          <td className="p-3 text-right text-gray-800">
                            {selectedReport.fteTotal.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">レポートを選択してください</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
