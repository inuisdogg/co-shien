'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { runDeductionCheck, type DeductionCheckResult } from '@/lib/deductionEngine';
import { checkQualificationExpiry, type QualificationCheckResult } from '@/lib/qualificationTracker';
import { checkCommitteeMeetings, type CommitteeCheckResult } from '@/lib/committeeTracker';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  ChevronRight,
  Download,
  Send,
  History,
  Bell,
  FileSpreadsheet,
  FileIcon,
  Settings,
  TrendingUp,
  AlertCircle,
  Info
} from 'lucide-react';

// Types
interface Addition {
  code: string;
  name: string;
  short_name: string;
  units: number;
  category_code: string;
}

interface FacilityAdditionSetting {
  id: string;
  facility_id: string;
  addition_code: string;
  is_enabled: boolean;
  status: string;
  planned_start_date: string | null;
  submission_deadline: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  addition?: Addition;
}

interface DeadlineAlert {
  id: string;
  alert_type: string;
  deadline_date: string;
  title: string;
  message: string;
  priority: string;
  is_dismissed: boolean;
  related_id: string;
}

interface DocumentTemplate {
  id: string;
  code: string;
  name: string;
  file_type: string;
  template_path: string;
  output_strategy: string;
  is_required: boolean;
  display_order: number;
}

interface DocumentSubmission {
  id: string;
  document_type: string;
  document_name: string;
  target_month: string | null;
  submission_deadline: string | null;
  status: string;
  generated_at: string | null;
  submitted_at: string | null;
}

interface ComplianceManagementProps {
  facilityId: string;
}

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  planned: { label: '計画中', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Clock },
  applying: { label: '届出準備中', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: FileText },
  submitted: { label: '届出済み', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Send },
  active: { label: '適用中', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  inactive: { label: '停止', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertCircle },
};

// Helper functions
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateJP(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const reiwaYear = year - 2018;
  return `令和${reiwaYear}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function calculateDeadline(targetStartDate: string): string {
  const target = new Date(targetStartDate);
  // 前月15日
  target.setMonth(target.getMonth() - 1);
  target.setDate(15);
  return target.toISOString().split('T')[0];
}

function getDaysUntilDeadline(deadlineStr: string): number {
  const deadline = new Date(deadlineStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ComplianceManagement({ facilityId }: ComplianceManagementProps) {
  const [activeTab, setActiveTab] = useState<'lifecycle' | 'alerts' | 'documents' | 'history' | 'deduction'>('lifecycle');
  const [additionSettings, setAdditionSettings] = useState<FacilityAdditionSetting[]>([]);
  const [allAdditions, setAllAdditions] = useState<Addition[]>([]);
  const [deadlineAlerts, setDeadlineAlerts] = useState<DeadlineAlert[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [documentSubmissions, setDocumentSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddition, setSelectedAddition] = useState<FacilityAdditionSetting | null>(null);
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deductionResult, setDeductionResult] = useState<DeductionCheckResult | null>(null);
  const [qualificationResult, setQualificationResult] = useState<QualificationCheckResult | null>(null);
  const [committeeResult, setCommitteeResult] = useState<CommitteeCheckResult | null>(null);
  const [deductionLoading, setDeductionLoading] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all additions
      const { data: additions } = await supabase
        .from('additions')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      // Fetch facility addition settings
      const { data: settings } = await supabase
        .from('facility_addition_settings')
        .select('*')
        .eq('facility_id', facilityId);

      // Fetch deadline alerts
      const { data: alerts } = await supabase
        .from('deadline_alerts')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_dismissed', false)
        .order('deadline_date');

      // Fetch document templates
      const { data: templates } = await supabase
        .from('document_templates')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      // Fetch document submissions
      const { data: submissions } = await supabase
        .from('document_submissions')
        .select('*')
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (additions) setAllAdditions(additions);

      // Merge addition info with settings
      if (settings && additions) {
        const merged = settings.map(s => ({
          ...s,
          addition: additions.find(a => a.code === s.addition_code)
        }));
        setAdditionSettings(merged);
      }

      if (alerts) setDeadlineAlerts(alerts);
      if (templates) setDocumentTemplates(templates);
      if (submissions) setDocumentSubmissions(submissions);

    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch deduction/compliance risk data
  const fetchDeductionRisks = useCallback(async () => {
    setDeductionLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: facilityData } = await supabase
        .from('facility_settings')
        .select('capacity')
        .eq('facility_id', facilityId)
        .single();
      const capacity = facilityData?.capacity || 10;

      const [deduction, qualification, committee] = await Promise.all([
        runDeductionCheck(facilityId, today, capacity),
        checkQualificationExpiry(facilityId),
        checkCommitteeMeetings(facilityId),
      ]);
      setDeductionResult(deduction);
      setQualificationResult(qualification);
      setCommitteeResult(committee);
    } catch (error) {
      console.error('Error fetching deduction risks:', error);
    } finally {
      setDeductionLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchDeductionRisks();
  }, [fetchDeductionRisks]);

  // Update addition status
  const updateAdditionStatus = async (settingId: string, newStatus: string, additionalData?: Partial<FacilityAdditionSetting>) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus, ...additionalData };

      // Calculate deadline if moving to applying status
      if (newStatus === 'applying' && additionalData?.planned_start_date) {
        updateData.submission_deadline = calculateDeadline(additionalData.planned_start_date);
      }

      // Set timestamps
      if (newStatus === 'submitted') {
        updateData.submitted_at = new Date().toISOString();
      }
      if (newStatus === 'active') {
        updateData.approved_at = new Date().toISOString();
        updateData.is_enabled = true;
      }
      if (newStatus === 'inactive') {
        updateData.is_enabled = false;
        updateData.effective_to = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('facility_addition_settings')
        .update(updateData)
        .eq('id', settingId);

      if (error) throw error;

      // Create deadline alert if applying
      if (newStatus === 'applying' && updateData.submission_deadline) {
        await supabase.from('deadline_alerts').insert({
          facility_id: facilityId,
          alert_type: 'addition_deadline',
          related_id: settingId,
          deadline_date: updateData.submission_deadline,
          alert_date: new Date().toISOString().split('T')[0],
          title: '加算届出期限',
          message: `${additionalData?.planned_start_date}からの加算適用には${updateData.submission_deadline}までの届出が必要です`,
          priority: 'high'
        });
      }

      fetchData();
    } catch (error) {
      console.error('Error updating addition status:', error);
    }
  };

  // Add new addition setting
  const addNewAdditionSetting = async (additionCode: string) => {
    try {
      const { error } = await supabase.from('facility_addition_settings').insert({
        facility_id: facilityId,
        addition_code: additionCode,
        status: 'planned',
        is_enabled: false
      });

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error adding addition setting:', error);
    }
  };

  // Dismiss alert
  const dismissAlert = async (alertId: string) => {
    try {
      await supabase
        .from('deadline_alerts')
        .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
        .eq('id', alertId);
      fetchData();
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  // Render status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.planned;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // Tab content renderers
  const renderLifecycleTab = () => {
    // Group by status
    const grouped = {
      active: additionSettings.filter(s => s.status === 'active'),
      applying: additionSettings.filter(s => s.status === 'applying' || s.status === 'submitted'),
      planned: additionSettings.filter(s => s.status === 'planned'),
      inactive: additionSettings.filter(s => s.status === 'inactive'),
    };

    // Available additions (not yet added)
    const addedCodes = new Set(additionSettings.map(s => s.addition_code));
    const availableAdditions = allAdditions.filter(a => !addedCodes.has(a.code));

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">適用中</span>
            </div>
            <div className="text-2xl font-bold text-green-800 mt-2">{grouped.active.length}件</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-700">
              <FileText className="w-5 h-5" />
              <span className="font-medium">届出中</span>
            </div>
            <div className="text-2xl font-bold text-yellow-800 mt-2">{grouped.applying.length}件</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="w-5 h-5" />
              <span className="font-medium">計画中</span>
            </div>
            <div className="text-2xl font-bold text-gray-800 mt-2">{grouped.planned.length}件</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700">
              <TrendingUp className="w-5 h-5" />
              <span className="font-medium">追加可能</span>
            </div>
            <div className="text-2xl font-bold text-blue-800 mt-2">{availableAdditions.length}件</div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">15日締切ルール</p>
              <p className="text-sm text-amber-700 mt-1">
                加算を新規取得・区分変更する場合、<strong>適用月の前月15日まで</strong>に行政へ変更届を提出する必要があります。
                届出が完了するまで売上予測には反映されません。
              </p>
            </div>
          </div>
        </div>

        {/* Active Additions */}
        {grouped.active.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
              <h3 className="font-medium text-green-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                適用中の加算（売上に反映）
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {grouped.active.map(setting => (
                <div key={setting.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{setting.addition?.name || setting.addition_code}</span>
                      <StatusBadge status={setting.status} />
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {setting.addition?.units}単位/日 | 適用開始: {formatDate(setting.effective_from)}
                    </div>
                  </div>
                  <button
                    onClick={() => updateAdditionStatus(setting.id, 'inactive')}
                    className="text-sm text-red-600 hover:text-red-800 hover:underline"
                  >
                    停止する
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Applying Additions */}
        {grouped.applying.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50">
              <h3 className="font-medium text-yellow-800 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                届出準備中・届出済み（売上未反映）
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {grouped.applying.map(setting => {
                const daysUntil = setting.submission_deadline ? getDaysUntilDeadline(setting.submission_deadline) : null;
                return (
                  <div key={setting.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{setting.addition?.name}</span>
                          <StatusBadge status={setting.status} />
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {setting.addition?.units}単位/日 | 適用予定: {formatDate(setting.planned_start_date)}
                        </div>
                      </div>
                      {daysUntil !== null && (
                        <div className={`text-sm font-medium ${daysUntil <= 3 ? 'text-red-600' : daysUntil <= 7 ? 'text-yellow-600' : 'text-gray-600'}`}>
                          締切まで {daysUntil}日
                        </div>
                      )}
                    </div>
                    {setting.submission_deadline && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                        <span className="text-yellow-700">届出期限: {formatDateJP(setting.submission_deadline)}</span>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {setting.status === 'applying' && (
                        <>
                          <button
                            onClick={() => updateAdditionStatus(setting.id, 'submitted')}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            届出完了
                          </button>
                          <button className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            書類出力
                          </button>
                        </>
                      )}
                      {setting.status === 'submitted' && (
                        <button
                          onClick={() => updateAdditionStatus(setting.id, 'active', { effective_from: setting.planned_start_date })}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          受理確認
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Planned Additions */}
        {grouped.planned.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                計画中（売上未反映）
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {grouped.planned.map(setting => (
                <div key={setting.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{setting.addition?.name}</span>
                        <StatusBadge status={setting.status} />
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {setting.addition?.units}単位/日
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm text-gray-600 mb-1">適用開始予定日</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                        onChange={(e) => setSelectedAddition({ ...setting, planned_start_date: e.target.value })}
                      />
                      <button
                        onClick={() => {
                          if (selectedAddition?.planned_start_date) {
                            updateAdditionStatus(setting.id, 'applying', { planned_start_date: selectedAddition.planned_start_date });
                          }
                        }}
                        className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        届出準備開始
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Addition */}
        {availableAdditions.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-800">新規加算を計画に追加</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {availableAdditions.map(addition => (
                  <button
                    key={addition.code}
                    onClick={() => addNewAdditionSetting(addition.code)}
                    className="text-left p-3 border border-gray-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900 text-sm">{addition.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{addition.units}単位/日</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAlertsTab = () => {
    const urgentAlerts = deadlineAlerts.filter(a => {
      const days = getDaysUntilDeadline(a.deadline_date);
      return days <= 7;
    });
    const upcomingAlerts = deadlineAlerts.filter(a => {
      const days = getDaysUntilDeadline(a.deadline_date);
      return days > 7;
    });

    return (
      <div className="space-y-6">
        {/* Urgent Alerts */}
        {urgentAlerts.length > 0 && (
          <div className="bg-red-50 rounded-lg border border-red-200">
            <div className="px-4 py-3 border-b border-red-200">
              <h3 className="font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                緊急（7日以内）
              </h3>
            </div>
            <div className="divide-y divide-red-100">
              {urgentAlerts.map(alert => {
                const days = getDaysUntilDeadline(alert.deadline_date);
                return (
                  <div key={alert.id} className="px-4 py-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium text-red-900">{alert.title}</div>
                      <div className="text-sm text-red-700 mt-1">{alert.message}</div>
                      <div className="text-sm text-red-600 mt-2 font-medium">
                        締切: {formatDateJP(alert.deadline_date)} （残り{days}日）
                      </div>
                    </div>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      非表示
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Alerts */}
        {upcomingAlerts.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                今後の締切
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {upcomingAlerts.map(alert => {
                const days = getDaysUntilDeadline(alert.deadline_date);
                return (
                  <div key={alert.id} className="px-4 py-3 flex items-start justify-between hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-gray-900">{alert.title}</div>
                      <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                      <div className="text-sm text-gray-500 mt-2">
                        締切: {formatDateJP(alert.deadline_date)} （残り{days}日）
                      </div>
                    </div>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      非表示
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {deadlineAlerts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>現在、締切アラートはありません</p>
          </div>
        )}
      </div>
    );
  };

  const renderDocumentsTab = () => {
    const excelTemplates = documentTemplates.filter(t => t.file_type === 'excel');
    const wordTemplates = documentTemplates.filter(t => t.file_type === 'word');

    return (
      <div className="space-y-6">
        {/* Excel Documents */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
            <h3 className="font-medium text-green-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              指定申請・届出書類（Excel）
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {excelTemplates.map(template => (
              <div key={template.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-500">
                      {template.is_required && <span className="text-red-500 mr-2">必須</span>}
                      {template.output_strategy === 'master_injection' && 'マスタ注入'}
                      {template.output_strategy === 'direct_write' && '直接書き込み'}
                    </div>
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  生成
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Word Documents */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
            <h3 className="font-medium text-blue-800 flex items-center gap-2">
              <FileIcon className="w-4 h-4" />
              運営記録書類（Word）
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {wordTemplates.map(template => (
              <div key={template.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileIcon className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-500">テンプレート置換</div>
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  生成
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Submissions */}
        {documentSubmissions.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <History className="w-4 h-4" />
                最近の書類出力履歴
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {documentSubmissions.slice(0, 5).map(submission => (
                <div key={submission.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900">{submission.document_name}</div>
                    <div className="text-xs text-gray-500">
                      生成: {formatDate(submission.generated_at)}
                      {submission.submitted_at && ` | 提出: ${formatDate(submission.submitted_at)}`}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    submission.status === 'approved' ? 'bg-green-100 text-green-700' :
                    submission.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {submission.status === 'approved' ? '受理済' :
                     submission.status === 'submitted' ? '提出済' :
                     submission.status === 'ready' ? '出力済' : '下書き'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHistoryTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 flex items-center gap-2 mb-4">
            <History className="w-4 h-4" />
            過去の状態を確認（Time Travel）
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            行政監査に対応するため、過去の特定日における事業所の体制、職員配置、加算取得状況を確認できます。
          </p>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-600">基準日:</label>
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded"
            />
            <button className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2">
              <History className="w-4 h-4" />
              この日の状態を表示
            </button>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800">履歴機能について</p>
              <p className="text-sm text-purple-700 mt-1">
                加算設定や施設情報を変更すると、自動的に履歴が記録されます。
                これにより、「2年前の4月1日時点での加算取得状況」といった情報を
                いつでも正確に再現し、書類を出力することができます。
              </p>
            </div>
          </div>
        </div>

        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>上記の日付を選択して、その時点の状態を確認してください</p>
        </div>
      </div>
    );
  };

  // Render deduction risk tab
  const renderDeductionTab = () => {
    if (deductionLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      );
    }

    const totalRisks = (deductionResult?.risks.length || 0) +
      (qualificationResult?.summary.expired || 0) + (qualificationResult?.summary.urgentCount || 0) +
      (committeeResult?.summary.overdueCount || 0);

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border ${deductionResult && deductionResult.risks.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${deductionResult && deductionResult.risks.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
              <span className="font-bold text-gray-800">減算リスク</span>
            </div>
            <p className="text-2xl font-bold mt-1">{deductionResult?.risks.length || 0}件</p>
            {deductionResult && deductionResult.summary.criticalCount > 0 && (
              <p className="text-xs text-red-600 mt-1">{deductionResult.summary.estimatedImpact}</p>
            )}
          </div>
          <div className={`p-4 rounded-lg border ${qualificationResult && (qualificationResult.summary.expired > 0 || qualificationResult.summary.urgentCount > 0) ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${qualificationResult && qualificationResult.summary.expired > 0 ? 'text-red-600' : 'text-amber-600'}`} />
              <span className="font-bold text-gray-800">資格期限</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {(qualificationResult?.summary.expired || 0) + (qualificationResult?.summary.urgentCount || 0) + (qualificationResult?.summary.warningCount || 0)}件
            </p>
            {qualificationResult && qualificationResult.summary.expired > 0 && (
              <p className="text-xs text-red-600 mt-1">{qualificationResult.summary.expired}件期限切れ</p>
            )}
          </div>
          <div className={`p-4 rounded-lg border ${committeeResult && committeeResult.summary.overdueCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2">
              <Calendar className={`w-5 h-5 ${committeeResult && committeeResult.summary.overdueCount > 0 ? 'text-orange-600' : 'text-green-600'}`} />
              <span className="font-bold text-gray-800">委員会開催</span>
            </div>
            <p className="text-2xl font-bold mt-1">{committeeResult?.alerts.length || 0}件追跡中</p>
            {committeeResult && committeeResult.summary.overdueCount > 0 && (
              <p className="text-xs text-orange-600 mt-1">{committeeResult.summary.overdueCount}件開催遅延</p>
            )}
          </div>
        </div>

        {/* Deduction Risks */}
        {deductionResult && deductionResult.risks.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-red-50">
              <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />減算リスク検出</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {deductionResult.risks.map(risk => (
                <div key={risk.code} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${risk.level === 'critical' ? 'bg-red-100 text-red-700' : risk.level === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {risk.level === 'critical' ? '重大' : risk.level === 'warning' ? '注意' : '情報'}
                        </span>
                        <span className="font-bold text-gray-800">{risk.name}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{risk.details}</p>
                      <p className="text-xs text-gray-400 mt-1">推奨: {risk.recommendation}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600 whitespace-nowrap">{Math.round(risk.impactRate * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qualification Alerts */}
        {qualificationResult && qualificationResult.alerts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-amber-50">
              <h3 className="font-bold text-amber-800 flex items-center gap-2"><Clock className="w-4 h-4" />資格期限アラート</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {qualificationResult.alerts.map((alert, i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{alert.staffName} - {alert.qualificationName}</p>
                    <p className="text-sm text-gray-500">期限: {alert.expiryDate}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${alert.level === 'expired' ? 'bg-red-100 text-red-700' : alert.level === 'urgent' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {alert.level === 'expired' ? '期限切れ' : `残${alert.daysUntilExpiry}日`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Committee Status */}
        {committeeResult && committeeResult.alerts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-blue-50">
              <h3 className="font-bold text-blue-800 flex items-center gap-2"><Calendar className="w-4 h-4" />委員会開催状況</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {committeeResult.alerts.map(alert => (
                <div key={alert.committeeType} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{alert.committeeName}</p>
                    <p className="text-sm text-gray-500">
                      今期: {alert.meetingsInPeriod}/{alert.requiredInPeriod}回開催
                      {alert.lastMeetingDate && ` (最終: ${alert.lastMeetingDate})`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${alert.level === 'overdue' ? 'bg-red-100 text-red-700' : alert.level === 'upcoming' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {alert.level === 'overdue' ? '開催遅延' : alert.level === 'upcoming' ? `残${alert.daysUntilDue}日` : '充足'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalRisks === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-bold text-green-600">リスクは検出されませんでした</p>
            <p className="text-sm mt-1">全てのコンプライアンスチェックに合格しています</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" />
          コンプライアンス・書類管理
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'lifecycle', label: '加算ライフサイクル', icon: TrendingUp },
          { id: 'alerts', label: '締切アラート', icon: Bell, badge: deadlineAlerts.length },
          { id: 'documents', label: '書類生成', icon: FileText },
          { id: 'history', label: '履歴確認', icon: History },
          { id: 'deduction', label: '減算リスク', icon: AlertTriangle, badge: deductionResult?.summary.criticalCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'lifecycle' && renderLifecycleTab()}
        {activeTab === 'alerts' && renderAlertsTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'deduction' && renderDeductionTab()}
      </div>
    </div>
  );
}
