'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Archive,
  ChevronDown,
  ChevronRight,
  X,
  Calendar,
  User,
  Edit3,
  Eye,
  Download,
  Bell,
  Target,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFacilityData } from '@/hooks/useFacilityData';
import { SupportPlanFile, SupportPlanFileStatus, SupportPlanType, Child } from '@/types';

// --- Status badge configuration with consistent design system colors ---
const STATUS_CONFIG: Record<SupportPlanFileStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: Edit3 },
  active: { label: '有効', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  completed: { label: '完了', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  archived: { label: 'アーカイブ', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: Archive },
};

const PLAN_TYPE_LABELS: Record<SupportPlanType, string> = {
  initial: '初回作成',
  renewal: '更新',
  modification: '変更',
};

// Child-centric status for the filter tabs
type ChildPlanStatus = 'all' | 'active' | 'expiring' | 'expired' | 'none';

const CHILD_FILTER_TABS: { key: ChildPlanStatus; label: string }[] = [
  { key: 'all', label: '全員' },
  { key: 'active', label: '有効' },
  { key: 'expiring', label: '期限間近' },
  { key: 'expired', label: '期限切れ' },
  { key: 'none', label: '未作成' },
];

function mapRowToPlan(row: any): SupportPlanFile {
  return {
    id: row.id,
    facilityId: row.facility_id,
    childId: row.child_id,
    planType: row.plan_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    planCreatedDate: row.plan_created_date,
    planCreatorName: row.plan_creator_name,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    parentAgreed: row.parent_agreed,
    parentAgreedAt: row.parent_agreed_at,
    parentSignerName: row.parent_signer_name,
    midEvaluationDate: row.mid_evaluation_date,
    midEvaluationNote: row.mid_evaluation_note,
    finalEvaluationDate: row.final_evaluation_date,
    finalEvaluationNote: row.final_evaluation_note,
    nextRenewalDate: row.next_renewal_date,
    renewalReminderSent: row.renewal_reminder_sent,
    status: row.status,
    notes: row.notes,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: format date as Japanese-style
function formatDateJP(dateStr: string | undefined | null): string {
  if (!dateStr) return '未設定';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// Helper: format period as Japanese style
function formatPeriodJP(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getFullYear()}年${s.getMonth() + 1}月〜${e.getFullYear()}年${e.getMonth() + 1}月`;
}

// Helper: get days until date
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

// Helper: get child initials
function getInitials(name: string): string {
  return name.slice(0, 1);
}

// Helper: get child plan status
function getChildPlanStatus(child: Child, plans: SupportPlanFile[]): { status: ChildPlanStatus; label: string; plan: SupportPlanFile | null } {
  const childPlans = plans.filter(p => p.childId === child.id && p.status === 'active');
  if (childPlans.length === 0) {
    return { status: 'none', label: '未作成', plan: null };
  }
  const latestPlan = childPlans.sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || ''))[0];
  if (!latestPlan.periodEnd) {
    return { status: 'active', label: '有効', plan: latestPlan };
  }
  const days = daysUntil(latestPlan.periodEnd);
  if (days < 0) {
    return { status: 'expired', label: '期限切れ', plan: latestPlan };
  }
  if (days <= 30) {
    return { status: 'expiring', label: '期限間近', plan: latestPlan };
  }
  return { status: 'active', label: '有効', plan: latestPlan };
}

// Status badge component
function StatusBadge({ status, label }: { status: ChildPlanStatus; label: string }) {
  const styles: Record<ChildPlanStatus, string> = {
    all: '',
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    expiring: 'bg-amber-50 text-amber-700 border border-amber-200',
    expired: 'bg-red-50 text-red-700 border border-red-200',
    none: 'bg-gray-50 text-gray-500 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {status === 'active' && <CheckCircle className="w-3 h-3" />}
      {status === 'expiring' && <Clock className="w-3 h-3" />}
      {status === 'expired' && <AlertTriangle className="w-3 h-3" />}
      {status === 'none' && <X className="w-3 h-3" />}
      {label}
    </span>
  );
}

// Skeleton loading component
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-100 rounded w-40" />
        </div>
        <div className="h-6 bg-gray-100 rounded-full w-16" />
      </div>
    </div>
  );
}

// Plan detail modal tabs
type PlanDetailTab = 'info' | 'assessment' | 'goals' | 'support' | 'evaluation';

const PLAN_DETAIL_TABS: { key: PlanDetailTab; label: string; icon: React.ElementType }[] = [
  { key: 'info', label: '基本情報', icon: User },
  { key: 'assessment', label: 'アセスメント', icon: ClipboardList },
  { key: 'goals', label: '目標', icon: Target },
  { key: 'support', label: '支援内容', icon: FileText },
  { key: 'evaluation', label: '評価', icon: CheckCircle },
];

export default function SupportPlanView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const { children } = useFacilityData();

  const [plans, setPlans] = useState<SupportPlanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [childFilter, setChildFilter] = useState<ChildPlanStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SupportPlanFile | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [detailTab, setDetailTab] = useState<PlanDetailTab>('info');
  const [showEvalModal, setShowEvalModal] = useState<{ planId: string; field: 'mid' | 'final' } | null>(null);
  const [evalDate, setEvalDate] = useState('');
  const [evalNote, setEvalNote] = useState('');

  // Form state for new plan
  const [formData, setFormData] = useState({
    childId: '',
    planType: 'initial' as SupportPlanType,
    periodStart: '',
    periodEnd: '',
    planCreatedDate: new Date().toISOString().split('T')[0],
    planCreatorName: '',
    notes: '',
  });

  useEffect(() => {
    if (!facilityId) return;
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('support_plan_files')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Error fetching support plans:', error);
          return;
        }
        if (data) setPlans(data.map(mapRowToPlan));
      } catch (error) {
        console.error('Error in fetchPlans:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, [facilityId]);

  // Statistics
  const stats = useMemo(() => {
    const childStatuses = children.map(c => getChildPlanStatus(c, plans));
    const active = childStatuses.filter(s => s.status === 'active').length;
    const expiring = childStatuses.filter(s => s.status === 'expiring').length;
    const expired = childStatuses.filter(s => s.status === 'expired').length;
    const none = childStatuses.filter(s => s.status === 'none').length;
    return { active, expiring, expired, none, total: children.length };
  }, [plans, children]);

  // Expiring plans alert
  const expiringPlans = useMemo(() => {
    return plans.filter(p => {
      if (p.status !== 'active' || !p.periodEnd) return false;
      const days = daysUntil(p.periodEnd);
      return days >= 0 && days <= 30;
    });
  }, [plans]);

  // Filtered children list
  const filteredChildren = useMemo(() => {
    let list = children.map(c => ({
      child: c,
      ...getChildPlanStatus(c, plans),
      allPlans: plans.filter(p => p.childId === c.id),
    }));

    // Filter by search term
    if (searchTerm) {
      list = list.filter(item =>
        item.child.name.includes(searchTerm) ||
        item.child.nameKana?.includes(searchTerm)
      );
    }

    // Filter by status tab
    if (childFilter !== 'all') {
      list = list.filter(item => item.status === childFilter);
    }

    return list;
  }, [children, plans, searchTerm, childFilter]);

  const handleCreatePlan = async () => {
    if (!formData.childId || !formData.periodStart || !formData.periodEnd) return;
    const now = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from('support_plan_files')
        .insert({
          facility_id: facilityId,
          child_id: formData.childId,
          plan_type: formData.planType,
          period_start: formData.periodStart,
          period_end: formData.periodEnd,
          plan_created_date: formData.planCreatedDate,
          plan_creator_name: formData.planCreatorName,
          status: 'draft',
          notes: formData.notes,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) setPlans(prev => [mapRowToPlan(data), ...prev]);
      setShowCreateModal(false);
      setFormData({ childId: '', planType: 'initial', periodStart: '', periodEnd: '', planCreatedDate: new Date().toISOString().split('T')[0], planCreatorName: '', notes: '' });
    } catch (error) {
      console.error('Error creating plan:', error);
      alert('計画の作成に失敗しました');
    }
  };

  const handleStatusChange = async (planId: string, newStatus: SupportPlanFileStatus) => {
    try {
      const { error } = await supabase
        .from('support_plan_files')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', planId);
      if (error) throw error;
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleSaveEvaluation = async (planId: string, field: 'mid' | 'final', date: string, note: string) => {
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (field === 'mid') {
      updates.mid_evaluation_date = date;
      updates.mid_evaluation_note = note;
    } else {
      updates.final_evaluation_date = date;
      updates.final_evaluation_note = note;
    }
    try {
      const { error } = await supabase.from('support_plan_files').update(updates).eq('id', planId);
      if (error) throw error;
      setPlans(prev => prev.map(p => {
        if (p.id !== planId) return p;
        if (field === 'mid') return { ...p, midEvaluationDate: date, midEvaluationNote: note };
        return { ...p, finalEvaluationDate: date, finalEvaluationNote: note };
      }));
      setShowEvalModal(null);
      setEvalDate('');
      setEvalNote('');
    } catch (error) {
      console.error('Error saving evaluation:', error);
    }
  };

  // Plan progress calculation (for structured form sections)
  const getPlanProgress = (plan: SupportPlanFile): { completed: number; total: number; percentage: number } => {
    const total = 6;
    let completed = 0;
    if (plan.childId && plan.periodStart && plan.periodEnd) completed++; // Basic info
    if (plan.planCreatorName) completed++; // Staff info
    if (plan.notes) completed++; // Assessment/goals (using notes as proxy)
    if (plan.parentAgreed) completed++; // Parent agreement
    if (plan.midEvaluationDate) completed++; // Mid evaluation
    if (plan.finalEvaluationDate) completed++; // Final evaluation
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
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
          <FileText className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">個別支援計画</h1>
          <span className="text-sm text-gray-400 ml-1">法定必須書類</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {/* Alert Banner for Expiring Plans */}
      {expiringPlans.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Bell className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">
              {expiringPlans.length}件の支援計画が30日以内に期限を迎えます
            </p>
            <div className="mt-2 space-y-1">
              {expiringPlans.slice(0, 3).map(plan => {
                const child = children.find(c => c.id === plan.childId);
                const days = daysUntil(plan.periodEnd);
                return (
                  <div key={plan.id} className="flex items-center gap-2 text-sm text-amber-700">
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-medium">{child?.name || '不明'}</span>
                    <span>- 残り{days}日 ({formatDateJP(plan.periodEnd)}まで)</span>
                  </div>
                );
              })}
              {expiringPlans.length > 3 && (
                <p className="text-sm text-amber-600 mt-1">他{expiringPlans.length - 3}件...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-sm text-gray-500">有効な計画</p>
              <p className="text-2xl font-bold text-gray-800">{stats.active}<span className="text-sm font-normal text-gray-400 ml-1">/{stats.total}</span></p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-sm text-gray-500">期限間近</p>
              <p className="text-2xl font-bold text-gray-800">{stats.expiring}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <div>
              <p className="text-sm text-gray-500">期限切れ</p>
              <p className="text-2xl font-bold text-gray-800">{stats.expired}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg"><X className="w-5 h-5 text-gray-400" /></div>
            <div>
              <p className="text-sm text-gray-500">未作成</p>
              <p className="text-2xl font-bold text-gray-800">{stats.none}</p>
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
              placeholder="児童名で検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {CHILD_FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setChildFilter(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                childFilter === tab.key
                  ? 'bg-[#00c4cc] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {tab.key === 'expiring' && stats.expiring > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-white/20">{stats.expiring}</span>
              )}
              {tab.key === 'expired' && stats.expired > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-white/20">{stats.expired}</span>
              )}
              {tab.key === 'none' && stats.none > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-white/20">{stats.none}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Children Grid */}
      {filteredChildren.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 mb-1">
            {searchTerm || childFilter !== 'all' ? '条件に一致する児童がいません' : '児童が登録されていません'}
          </p>
          <p className="text-sm text-gray-400">
            {searchTerm ? '検索条件を変更してください' : '児童管理画面から児童を追加してください'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChildren.map(item => {
            const { child, status, label, plan, allPlans } = item;
            const latestPlan = plan;
            const daysRemaining = latestPlan?.periodEnd ? daysUntil(latestPlan.periodEnd) : null;
            const progress = latestPlan ? getPlanProgress(latestPlan) : null;

            return (
              <div
                key={child.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
              >
                {/* Child Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#00c4cc] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {getInitials(child.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 truncate">{child.name}</h3>
                    {child.nameKana && (
                      <p className="text-xs text-gray-400 truncate">{child.nameKana}</p>
                    )}
                  </div>
                  <StatusBadge status={status} label={label} />
                </div>

                {/* Plan Info */}
                {latestPlan ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{formatPeriodJP(latestPlan.periodStart, latestPlan.periodEnd)}</span>
                    </div>

                    {/* Countdown */}
                    {daysRemaining !== null && status !== 'none' && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        {daysRemaining < 0 ? (
                          <span className="text-red-600 font-medium">{Math.abs(daysRemaining)}日超過</span>
                        ) : daysRemaining <= 30 ? (
                          <span className="text-amber-600 font-medium">次回更新まで {daysRemaining}日</span>
                        ) : (
                          <span className="text-gray-500">次回更新まで {daysRemaining}日</span>
                        )}
                      </div>
                    )}

                    {/* Progress Bar */}
                    {progress && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>計画の完成度</span>
                          <span>{progress.percentage}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress.percentage === 100 ? 'bg-emerald-500' : progress.percentage >= 50 ? 'bg-[#00c4cc]' : 'bg-amber-400'
                            }`}
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2 border-t border-gray-50">
                      <button
                        onClick={() => {
                          setSelectedPlan(latestPlan);
                          setSelectedChild(child);
                          setDetailTab('info');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        閲覧
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPlan(latestPlan);
                          setSelectedChild(child);
                          setDetailTab('evaluation');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#00c4cc] bg-[#00c4cc]/5 rounded-lg hover:bg-[#00c4cc]/10 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        編集
                      </button>
                      <button
                        onClick={() => {
                          setFormData(prev => ({ ...prev, childId: child.id, planType: 'renewal' }));
                          setShowCreateModal(true);
                        }}
                        className="flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-400 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        title="新規作成"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">支援計画が作成されていません</p>
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, childId: child.id, planType: 'initial' }));
                        setShowCreateModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#00c4cc] border border-dashed border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      新規作成
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Detail / Edit Modal */}
      {selectedPlan && selectedChild && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00c4cc] flex items-center justify-center text-white font-bold text-sm">
                  {getInitials(selectedChild.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedChild.name}の支援計画</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${STATUS_CONFIG[selectedPlan.status].bg} ${STATUS_CONFIG[selectedPlan.status].color} border ${STATUS_CONFIG[selectedPlan.status].border}`}>
                      {STATUS_CONFIG[selectedPlan.status].label}
                    </span>
                    <span className="text-xs text-gray-400">{PLAN_TYPE_LABELS[selectedPlan.planType]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  title="PDF出力"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF出力
                </button>
                <button onClick={() => { setSelectedPlan(null); setSelectedChild(null); }}>
                  <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-100 px-6">
              {PLAN_DETAIL_TABS.map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === tab.key
                        ? 'border-[#00c4cc] text-[#00c4cc]'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailTab === 'info' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      基本情報
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">児童名</p>
                        <p className="font-medium text-gray-800">{selectedChild.name}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">計画種別</p>
                        <p className="font-medium text-gray-800">{PLAN_TYPE_LABELS[selectedPlan.planType]}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">計画期間</p>
                        <p className="font-medium text-gray-800">{formatPeriodJP(selectedPlan.periodStart, selectedPlan.periodEnd)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">作成日</p>
                        <p className="font-medium text-gray-800">{formatDateJP(selectedPlan.planCreatedDate)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">担当者（児童発達支援管理責任者）</p>
                        <p className="font-medium text-gray-800">{selectedPlan.planCreatorName || '未設定'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">保護者同意</p>
                        <p className="font-medium text-gray-800">
                          {selectedPlan.parentAgreed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle className="w-4 h-4" />
                              同意済み {selectedPlan.parentSignerName && `(${selectedPlan.parentSignerName})`}
                            </span>
                          ) : (
                            <span className="text-amber-600">未同意</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      ステータス変更
                    </h3>
                    <div className="flex gap-2">
                      {selectedPlan.status === 'draft' && (
                        <button
                          onClick={() => { handleStatusChange(selectedPlan.id, 'active'); setSelectedPlan({ ...selectedPlan, status: 'active' }); }}
                          className="px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors"
                        >
                          有効にする
                        </button>
                      )}
                      {selectedPlan.status === 'active' && (
                        <button
                          onClick={() => { handleStatusChange(selectedPlan.id, 'completed'); setSelectedPlan({ ...selectedPlan, status: 'completed' }); }}
                          className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          完了にする
                        </button>
                      )}
                      {selectedPlan.status === 'completed' && (
                        <button
                          onClick={() => { handleStatusChange(selectedPlan.id, 'archived'); setSelectedPlan({ ...selectedPlan, status: 'archived' }); }}
                          className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          アーカイブ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'assessment' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      アセスメント（現状把握）
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-2">現在の発達状況・能力</p>
                        <textarea
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                          placeholder="運動面、認知面、コミュニケーション面、社会性、ADLなど..."
                          defaultValue=""
                        />
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-2">課題・支援ニーズ</p>
                        <textarea
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                          placeholder="日常生活における困り感、保護者の希望、本人の意向..."
                          defaultValue=""
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'goals' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      長期目標
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <textarea
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                        placeholder="例：集団活動の中で友達と関わり、コミュニケーション能力を高める..."
                        defaultValue=""
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      短期目標
                    </h3>
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-[#00c4cc] bg-[#00c4cc]/10 px-2 py-0.5 rounded">目標{i}</span>
                          </div>
                          <textarea
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                            placeholder="具体的な達成目標を記入..."
                            defaultValue=""
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'support' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      支援内容
                    </h3>
                    <div className="space-y-3">
                      {['個別支援', '小集団活動', '日常生活指導'].map((area, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs font-medium text-gray-600 mb-2">{area}</p>
                          <textarea
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                            placeholder="具体的な支援方法や配慮事項..."
                            defaultValue=""
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedPlan.notes && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                        備考
                      </h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">{selectedPlan.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'evaluation' && (
                <div className="space-y-6">
                  {/* Mid-term Evaluation */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      中間評価
                    </h3>
                    {selectedPlan.midEvaluationDate ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">評価日: {formatDateJP(selectedPlan.midEvaluationDate)}</span>
                        </div>
                        {selectedPlan.midEvaluationNote && (
                          <p className="text-sm text-emerald-800 mt-2">{selectedPlan.midEvaluationNote}</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-3">中間評価がまだ記録されていません</p>
                        <button
                          onClick={() => setShowEvalModal({ planId: selectedPlan.id, field: 'mid' })}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          中間評価を記録
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Final Evaluation */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                      最終評価
                    </h3>
                    {selectedPlan.finalEvaluationDate ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">評価日: {formatDateJP(selectedPlan.finalEvaluationDate)}</span>
                        </div>
                        {selectedPlan.finalEvaluationNote && (
                          <p className="text-sm text-emerald-800 mt-2">{selectedPlan.finalEvaluationNote}</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-3">最終評価がまだ記録されていません</p>
                        <button
                          onClick={() => setShowEvalModal({ planId: selectedPlan.id, field: 'final' })}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          最終評価を記録
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Modal */}
      {showEvalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                {showEvalModal.field === 'mid' ? '中間評価' : '最終評価'}を記録
              </h2>
              <button onClick={() => { setShowEvalModal(null); setEvalDate(''); setEvalNote(''); }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  評価日 <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={evalDate}
                  onChange={e => setEvalDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">評価内容</label>
                <textarea
                  value={evalNote}
                  onChange={e => setEvalNote(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  placeholder="目標の達成度、今後の課題など..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowEvalModal(null); setEvalDate(''); setEvalNote(''); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                キャンセル
              </button>
              <button
                onClick={() => handleSaveEvaluation(showEvalModal.planId, showEvalModal.field, evalDate, evalNote)}
                disabled={!evalDate}
                className="px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">新規支援計画作成</h2>
              <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Section: Basic Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                基本情報
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  児童 <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.childId}
                  onChange={e => setFormData(prev => ({ ...prev, childId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                >
                  <option value="">選択してください</option>
                  {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">計画種別</label>
                <select
                  value={formData.planType}
                  onChange={e => setFormData(prev => ({ ...prev, planType: e.target.value as SupportPlanType }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                >
                  {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    期間開始 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={e => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    期間終了 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={e => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  />
                </div>
              </div>
            </div>

            {/* Section: Staff */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                担当情報
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">作成者名</label>
                <input
                  type="text"
                  value={formData.planCreatorName}
                  onChange={e => setFormData(prev => ({ ...prev, planCreatorName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                  placeholder="児童発達支援管理責任者名"
                />
              </div>
            </div>

            {/* Section: Notes */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
                備考
              </h3>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                placeholder="メモや補足事項..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                キャンセル
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={!formData.childId || !formData.periodStart || !formData.periodEnd}
                className="px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
