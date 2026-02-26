'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Calendar,
  Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import WorkScheduleView from './WorkScheduleView';
import AttendanceOverviewPanel from './AttendanceOverviewPanel';
import OvertimeDashboardPanel from './OvertimeDashboardPanel';
import PaidLeaveManagementPanel from './PaidLeaveManagementPanel';
import {
  StaffPersonnelSettings,
  PersonnelType,
  WorkStyle,
  ComplianceStatus,
  DailyStaffingCompliance,
  PERSONNEL_TYPE_LABELS,
  WORK_STYLE_LABELS,
  COMPLIANCE_STATUS_CONFIG,
  QUALIFICATION_CODES,
} from '@/types';

interface StaffRow {
  id: string;
  name: string;
  qualifications: string[];
  role?: string;
  type?: string;
  personnelSettings?: StaffPersonnelSettings;
}

const STATUS_ICONS: Record<ComplianceStatus, React.ElementType> = {
  compliant: CheckCircle,
  warning: AlertTriangle,
  non_compliant: XCircle,
};

function calculateFTE(workStyle: WorkStyle, contractedHours: number | undefined, standardHours: number): number {
  if (workStyle === 'fulltime_dedicated') return 1.0;
  if (workStyle === 'fulltime_concurrent') return 0.75;
  if (!contractedHours || !standardHours) return 0;
  return Math.min(contractedHours / standardHours, 1.0);
}

function StaffingContent() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<DailyStaffingCompliance[]>([]);
  const [standardWeeklyHours, setStandardWeeklyHours] = useState(40);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    const fetchData = async () => {
      try {
        // Fetch staff with personnel settings
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, name, qualifications, role, type')
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

        if (facilityData?.standard_weekly_hours) {
          setStandardWeeklyHours(facilityData.standard_weekly_hours);
        }

        const settingsMap = new Map<string, StaffPersonnelSettings>();
        (settingsData || []).forEach((row: any) => {
          settingsMap.set(row.staff_id, {
            id: row.id,
            facilityId: row.facility_id,
            staffId: row.staff_id,
            personnelType: row.personnel_type,
            workStyle: row.work_style,
            isManager: row.is_manager,
            isServiceManager: row.is_service_manager,
            contractedWeeklyHours: row.contracted_weekly_hours,
            assignedAdditionCodes: row.assigned_addition_codes || [],
            effectiveFrom: row.effective_from,
            effectiveTo: row.effective_to,
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        });

        setStaffList((staffData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          qualifications: s.qualifications || [],
          role: s.role,
          type: s.type,
          personnelSettings: settingsMap.get(s.id),
        })));

        // Fetch compliance records for selected month
        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data: compData } = await supabase
          .from('daily_staffing_compliance')
          .select('*')
          .eq('facility_id', facilityId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date');

        if (compData) {
          setComplianceRecords(compData.map((row: any) => ({
            id: row.id,
            facilityId: row.facility_id,
            date: row.date,
            overallStatus: row.overall_status,
            hasTwoStaff: row.has_two_staff,
            hasFulltimeDedicated: row.has_fulltime_dedicated,
            hasSecondStaff: row.has_second_staff,
            fteTotal: row.fte_total,
            hasManager: row.has_manager,
            hasServiceManager: row.has_service_manager,
            scheduledStaffCount: row.scheduled_staff_count,
            standardStaffCount: row.standard_staff_count,
            additionStaffCount: row.addition_staff_count,
            additionCompliance: row.addition_compliance || {},
            staffBreakdown: row.staff_breakdown || [],
            warnings: row.warnings || [],
            calculatedAt: row.calculated_at,
            calculatedBy: row.calculated_by,
          })));
        }
      } catch (error) {
        console.error('Error fetching staffing data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId, selectedMonth]);

  const stats = useMemo(() => {
    const totalStaff = staffList.length;
    const configured = staffList.filter(s => s.personnelSettings).length;
    const standardCount = staffList.filter(s => s.personnelSettings?.personnelType === 'standard').length;
    const additionCount = staffList.filter(s => s.personnelSettings?.personnelType === 'addition').length;
    const totalFTE = staffList.reduce((sum, s) => {
      if (!s.personnelSettings) return sum;
      return sum + calculateFTE(s.personnelSettings.workStyle, s.personnelSettings.contractedWeeklyHours, standardWeeklyHours);
    }, 0);
    const hasManager = staffList.some(s => s.personnelSettings?.isManager);
    const hasServiceManager = staffList.some(s => s.personnelSettings?.isServiceManager);

    const compliantDays = complianceRecords.filter(c => c.overallStatus === 'compliant').length;
    const warningDays = complianceRecords.filter(c => c.overallStatus === 'warning').length;
    const nonCompliantDays = complianceRecords.filter(c => c.overallStatus === 'non_compliant').length;

    return { totalStaff, configured, standardCount, additionCount, totalFTE, hasManager, hasServiceManager, compliantDays, warningDays, nonCompliantDays };
  }, [staffList, complianceRecords, standardWeeklyHours]);

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
        <Shield className="w-6 h-6 text-[#00c4cc]" />
        <h1 className="text-xl font-bold text-gray-800">人員配置管理</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">登録スタッフ</p>
          <p className="text-2xl font-bold text-gray-800">{stats.totalStaff}</p>
          <p className="text-xs text-gray-400">{stats.configured}名設定済み</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">常勤換算合計</p>
          <p className="text-2xl font-bold text-gray-800">{stats.totalFTE.toFixed(2)}</p>
          <p className="text-xs text-gray-400">基準{stats.standardCount} / 加算{stats.additionCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">管理者</p>
          <p className="text-2xl font-bold text-gray-800">
            {stats.hasManager ? '配置済' : '未配置'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">児発管</p>
          <p className="text-2xl font-bold text-gray-800">
            {stats.hasServiceManager ? '配置済' : '未配置'}
          </p>
        </div>
      </div>

      {/* Staff Configuration List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            スタッフ人員区分
          </h2>
        </div>
        {staffList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">スタッフが登録されていません</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {staffList.map(staff => {
              const ps = staff.personnelSettings;
              const fte = ps ? calculateFTE(ps.workStyle, ps.contractedWeeklyHours, standardWeeklyHours) : 0;
              const isExpanded = expandedStaff === staff.id;

              return (
                <div key={staff.id}>
                  <button
                    onClick={() => setExpandedStaff(isExpanded ? null : staff.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${ps ? 'bg-gray-600' : 'bg-gray-300'}`} />
                      <div className="text-left">
                        <p className="font-medium text-gray-800">{staff.name}</p>
                        {ps ? (
                          <p className="text-xs text-gray-500">
                            {PERSONNEL_TYPE_LABELS[ps.personnelType]} / {WORK_STYLE_LABELS[ps.workStyle]} / FTE: {fte.toFixed(2)}
                            {ps.isManager && ' / 管理者'}
                            {ps.isServiceManager && ' / 児発管'}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">人員区分未設定</p>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">人員区分</p>
                          <p className="font-medium">{ps ? PERSONNEL_TYPE_LABELS[ps.personnelType] : '未設定'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">勤務形態</p>
                          <p className="font-medium">{ps ? WORK_STYLE_LABELS[ps.workStyle] : '未設定'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">常勤換算値</p>
                          <p className="font-medium">{fte.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">週所定時間</p>
                          <p className="font-medium">{ps?.contractedWeeklyHours || standardWeeklyHours}h</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">資格</p>
                          <p className="font-medium">
                            {staff.qualifications.length > 0
                              ? staff.qualifications.map(q => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q).join(', ')
                              : 'なし'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">配置先加算</p>
                          <p className="font-medium">{ps?.assignedAdditionCodes?.length ? ps.assignedAdditionCodes.join(', ') : 'なし'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Compliance Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            月間コンプライアンス
          </h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        {complianceRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p>この月のコンプライアンスデータはまだありません</p>
            <p className="text-xs text-gray-400 mt-1">シフトが登録されると自動的に計算されます</p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="px-4 py-3 flex gap-4 text-sm border-b border-gray-50">
              <span className="text-gray-700 font-medium">充足 {stats.compliantDays}日</span>
              <span className="text-gray-500 font-medium">注意 {stats.warningDays}日</span>
              <span className="text-gray-500 font-medium">不足 {stats.nonCompliantDays}日</span>
            </div>

            {/* Calendar grid */}
            <div className="p-4 grid grid-cols-7 gap-1">
              {['月', '火', '水', '木', '金', '土', '日'].map(day => (
                <div key={day} className="text-center text-xs text-gray-400 font-medium py-1">{day}</div>
              ))}
              {(() => {
                const [year, month] = selectedMonth.split('-').map(Number);
                const firstDay = new Date(year, month - 1, 1).getDay();
                const daysInMonth = new Date(year, month, 0).getDate();
                const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
                const cells = [];

                for (let i = 0; i < offset; i++) {
                  cells.push(<div key={`empty-${i}`} />);
                }

                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const record = complianceRecords.find(c => c.date === dateStr);
                  const status = record?.overallStatus;
                  const bgColor = status === 'compliant' ? 'bg-gray-100 text-gray-700'
                    : status === 'warning' ? 'bg-gray-200 text-gray-600'
                    : status === 'non_compliant' ? 'bg-gray-300 text-gray-800 font-medium'
                    : 'bg-gray-50 text-gray-400';

                  cells.push(
                    <div key={d} className={`text-center text-xs rounded-lg py-2 ${bgColor}`} title={record ? `FTE: ${record.fteTotal} / 人数: ${record.scheduledStaffCount}` : ''}>
                      {d}
                    </div>
                  );
                }

                return cells;
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Org Chart: groups staff by role in a visual hierarchy */
interface OrgGroup {
  label: string;
  members: StaffRow[];
}

function classifyStaff(staffList: StaffRow[]): OrgGroup[] {
  const groups: Record<string, StaffRow[]> = {
    'service_manager': [],
    'manager': [],
    'fulltime': [],
    'parttime': [],
  };

  for (const staff of staffList) {
    const ps = staff.personnelSettings;

    if (ps) {
      // Use personnel settings when available
      if (ps.isServiceManager) {
        groups['service_manager'].push(staff);
      } else if (ps.isManager) {
        groups['manager'].push(staff);
      } else if (ps.workStyle === 'fulltime_dedicated' || ps.workStyle === 'fulltime_concurrent') {
        groups['fulltime'].push(staff);
      } else if (ps.workStyle === 'parttime') {
        groups['parttime'].push(staff);
      } else {
        groups['fulltime'].push(staff);
      }
    } else {
      // Fallback to employment_records / staff role
      const role = staff.role || '';
      if (role === '管理者' || role === 'マネージャー') {
        groups['manager'].push(staff);
      } else if (staff.type === '常勤' || role === '一般スタッフ常勤') {
        groups['fulltime'].push(staff);
      } else if (staff.type === '非常勤' || role === '一般スタッフ非常勤') {
        groups['parttime'].push(staff);
      } else {
        // Default to fulltime group
        groups['fulltime'].push(staff);
      }
    }
  }

  const result: OrgGroup[] = [];
  if (groups['manager'].length > 0) {
    result.push({ label: '管理者', members: groups['manager'] });
  }
  if (groups['service_manager'].length > 0) {
    result.push({ label: '児童発達支援管理責任者', members: groups['service_manager'] });
  }
  if (groups['fulltime'].length > 0) {
    result.push({ label: '常勤スタッフ', members: groups['fulltime'] });
  }
  if (groups['parttime'].length > 0) {
    result.push({ label: '非常勤スタッフ', members: groups['parttime'] });
  }

  return result;
}

function OrgChartContent() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!facilityId) return;
    const fetchData = async () => {
      try {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, name, qualifications, role, type')
          .eq('facility_id', facilityId);

        const { data: settingsData } = await supabase
          .from('staff_personnel_settings')
          .select('*')
          .eq('facility_id', facilityId);

        const settingsMap = new Map<string, StaffPersonnelSettings>();
        (settingsData || []).forEach((row: any) => {
          settingsMap.set(row.staff_id, {
            id: row.id,
            facilityId: row.facility_id,
            staffId: row.staff_id,
            personnelType: row.personnel_type,
            workStyle: row.work_style,
            isManager: row.is_manager,
            isServiceManager: row.is_service_manager,
            contractedWeeklyHours: row.contracted_weekly_hours,
            assignedAdditionCodes: row.assigned_addition_codes || [],
            effectiveFrom: row.effective_from,
            effectiveTo: row.effective_to,
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        });

        setStaffList((staffData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          qualifications: s.qualifications || [],
          role: s.role,
          type: s.type,
          personnelSettings: settingsMap.get(s.id),
        })));
      } catch (error) {
        console.error('Error fetching staff for org chart:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId]);

  const orgGroups = useMemo(() => classifyStaff(staffList), [staffList]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  if (staffList.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
        スタッフが登録されていません
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-[#00c4cc]" />
        <h1 className="text-xl font-bold text-gray-800">組織図</h1>
        <span className="text-sm text-gray-400 ml-2">{staffList.length}名</span>
      </div>

      {/* Org Chart Tree */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="space-y-0">
          {orgGroups.map((group, groupIndex) => (
            <div key={group.label} className="relative">
              {/* Vertical connecting line from previous group */}
              {groupIndex > 0 && (
                <div className="absolute left-[11px] -top-2 w-px h-2 bg-gray-200" />
              )}

              {/* Group header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-[22px] h-[22px] rounded-md bg-gray-800 text-white flex items-center justify-center shrink-0">
                  <Users className="w-3 h-3" />
                </div>
                <span className="text-sm font-bold text-gray-800">{group.label}</span>
                <span className="text-xs text-gray-400">({group.members.length}名)</span>
              </div>

              {/* Members */}
              <div className="ml-[11px] border-l border-gray-200 pl-6 pb-4 space-y-1">
                {group.members.map((staff, memberIndex) => {
                  const ps = staff.personnelSettings;
                  const workStyleLabel = ps
                    ? WORK_STYLE_LABELS[ps.workStyle]
                    : staff.type || '';
                  const quals = staff.qualifications
                    .map(q => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q)
                    .filter(Boolean);

                  return (
                    <div key={staff.id} className="relative flex items-center gap-3 py-2">
                      {/* Horizontal connector line */}
                      <div className="absolute -left-6 top-1/2 w-6 h-px bg-gray-200" />
                      {/* Vertical segment for last item rounded corner */}
                      {memberIndex === group.members.length - 1 && (
                        <div className="absolute -left-[1px] top-1/2 bottom-0 w-px bg-white" />
                      )}

                      {/* Staff card */}
                      <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-100 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-gray-600">
                            {staff.name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-800 truncate">{staff.name}</span>
                            {workStyleLabel && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">
                                {workStyleLabel}
                              </span>
                            )}
                            {ps?.isManager && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-white shrink-0">
                                管理者
                              </span>
                            )}
                            {ps?.isServiceManager && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-white shrink-0">
                                児発管
                              </span>
                            )}
                          </div>
                          {quals.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {quals.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STAFFING_TABS = [
  { id: 'staffing', label: '人員配置' },
  { id: 'attendance', label: '出退勤' },
  { id: 'overtime', label: '残業・36協定' },
  { id: 'paid-leave', label: '有給管理' },
  { id: 'work-schedule', label: '勤務体制一覧' },
  { id: 'org-chart', label: '組織図' },
] as const;

export default function StaffingView() {
  const [activeTab, setActiveTab] = useState<string>('staffing');

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto" aria-label="Tabs">
          {STAFFING_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#00c4cc] text-gray-800'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'staffing' && <StaffingContent />}
      {activeTab === 'attendance' && <AttendanceOverviewPanel />}
      {activeTab === 'overtime' && <OvertimeDashboardPanel />}
      {activeTab === 'paid-leave' && <PaidLeaveManagementPanel />}
      {activeTab === 'work-schedule' && <WorkScheduleView />}
      {activeTab === 'org-chart' && <OrgChartContent />}
    </div>
  );
}
