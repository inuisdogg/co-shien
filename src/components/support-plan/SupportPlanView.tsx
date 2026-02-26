'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Archive,
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
  ArrowLeft,
  Upload,
  Trash2,
  Save,
  ChevronRight,
  History,
  Heart,
  Brain,
  Hand,
  MessageCircle,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFacilityData } from '@/hooks/useFacilityData';
import {
  SupportPlanFile,
  SupportPlanFileStatus,
  SupportPlanType,
  SupportPlanContent,
  DevelopmentalDomain,
  ShortTermGoal,
  DomainAssessment,
  Child,
} from '@/types';

// ============================================
// Constants & Configuration
// ============================================

const ACCENT = '#00c4cc';
const ACCENT_HOVER = '#00b0b8';

const DOMAIN_CONFIG: Record<DevelopmentalDomain, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  health_daily_life: { label: '健康・生活', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Heart },
  movement_sensory: { label: '運動・感覚', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Hand },
  cognition_behavior: { label: '認知・行動', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Brain },
  language_communication: { label: '言語・コミュニケーション', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: MessageCircle },
  human_relations_social: { label: '人間関係・社会性', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', icon: Users },
};

const ALL_DOMAINS: DevelopmentalDomain[] = [
  'health_daily_life',
  'movement_sensory',
  'cognition_behavior',
  'language_communication',
  'human_relations_social',
];

const DOMAIN_DOT_COLORS: Record<DevelopmentalDomain, string> = {
  health_daily_life: 'bg-emerald-500',
  movement_sensory: 'bg-blue-500',
  cognition_behavior: 'bg-amber-500',
  language_communication: 'bg-purple-500',
  human_relations_social: 'bg-pink-500',
};

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

const EVAL_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  achieved: { label: '達成', color: 'text-emerald-700 bg-emerald-50' },
  progressing: { label: '進行中', color: 'text-blue-700 bg-blue-50' },
  unchanged: { label: '変化なし', color: 'text-amber-700 bg-amber-50' },
  regressed: { label: '後退', color: 'text-red-700 bg-red-50' },
};

type ChildPlanStatus = 'all' | 'active' | 'expiring' | 'expired' | 'none';

const CHILD_FILTER_TABS: { key: ChildPlanStatus; label: string }[] = [
  { key: 'all', label: '全員' },
  { key: 'active', label: '有効' },
  { key: 'expiring', label: '期限間近' },
  { key: 'expired', label: '期限切れ' },
  { key: 'none', label: '未作成' },
];

// Editor sections
type EditorSection = 'header' | 'assessment' | 'goals' | 'support' | 'family' | 'evaluation';

const EDITOR_SECTIONS: { key: EditorSection; label: string; icon: React.ElementType }[] = [
  { key: 'header', label: '基本情報', icon: User },
  { key: 'assessment', label: 'アセスメント', icon: ClipboardList },
  { key: 'goals', label: '支援目標', icon: Target },
  { key: 'support', label: '支援内容', icon: FileText },
  { key: 'family', label: '家族支援', icon: Heart },
  { key: 'evaluation', label: '評価', icon: CheckCircle },
];

// ============================================
// Utility functions
// ============================================

function mapRowToPlan(row: Record<string, unknown>): SupportPlanFile {
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    childId: row.child_id as string,
    planType: row.plan_type as SupportPlanType,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    planCreatedDate: row.plan_created_date as string,
    planCreatorName: row.plan_creator_name as string | undefined,
    filePath: row.file_path as string | undefined,
    fileName: row.file_name as string | undefined,
    fileSize: row.file_size as number | undefined,
    parentAgreed: (row.parent_agreed as boolean) || false,
    parentAgreedAt: row.parent_agreed_at as string | undefined,
    parentSignerName: row.parent_signer_name as string | undefined,
    midEvaluationDate: row.mid_evaluation_date as string | undefined,
    midEvaluationNote: row.mid_evaluation_note as string | undefined,
    finalEvaluationDate: row.final_evaluation_date as string | undefined,
    finalEvaluationNote: row.final_evaluation_note as string | undefined,
    status: row.status as SupportPlanFileStatus,
    nextRenewalDate: row.next_renewal_date as string | undefined,
    renewalReminderSent: (row.renewal_reminder_sent as boolean) || false,
    notes: row.notes as string | undefined,
    planContent: (row.plan_content as SupportPlanContent) || undefined,
    uploadedBy: row.uploaded_by as string | undefined,
    uploadedAt: row.uploaded_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function formatDateJP(dateStr: string | undefined | null): string {
  if (!dateStr) return '未設定';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatPeriodJP(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getFullYear()}年${s.getMonth() + 1}月〜${e.getFullYear()}年${e.getMonth() + 1}月`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getInitials(name: string): string {
  return name.slice(0, 1);
}

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

function createEmptyGoal(): ShortTermGoal {
  return {
    id: crypto.randomUUID(),
    goalText: '',
    domains: [],
    supportContent: '',
    achievementCriteria: '',
    responsibleStaff: '',
  };
}

function createEmptyPlanContent(): SupportPlanContent {
  return {
    domainAssessments: ALL_DOMAINS.map(domain => ({ domain, currentLevel: '' })),
    shortTermGoals: [createEmptyGoal(), createEmptyGoal(), createEmptyGoal()],
  };
}

function getPlanCompleteness(plan: SupportPlanFile): { completed: number; total: number; percentage: number } {
  const total = 8;
  let completed = 0;
  const c = plan.planContent;
  if (plan.childId && plan.periodStart && plan.periodEnd) completed++; // Basic info
  if (plan.planCreatorName) completed++; // Staff
  if (c?.disabilityStatus || c?.childWishes || c?.familyWishes) completed++; // Assessment
  if (c?.domainAssessments?.some(a => a.currentLevel)) completed++; // Domain assessment
  if (c?.longTermGoal) completed++; // Long-term goal
  if (c?.shortTermGoals?.some(g => g.goalText)) completed++; // Short-term goals
  if (c?.familySupportContent || c?.interAgencyCoordination) completed++; // Family support
  if (plan.parentAgreed) completed++; // Parent agreement
  return { completed, total, percentage: Math.round((completed / total) * 100) };
}

function hasPdfUpload(plan: SupportPlanFile): boolean {
  return !!(plan.filePath && plan.fileName);
}

function hasRootsContent(plan: SupportPlanFile): boolean {
  const c = plan.planContent;
  if (!c) return false;
  return !!(c.longTermGoal || c.overallPolicy || c.shortTermGoals?.some(g => g.goalText) || c.disabilityStatus);
}

// ============================================
// Sub-components
// ============================================

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

function DomainTag({ domain, size = 'sm' }: { domain: DevelopmentalDomain; size?: 'sm' | 'xs' }) {
  const config = DOMAIN_CONFIG[domain];
  const DomainIcon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'} rounded-full font-medium ${config.bg} ${config.color} border ${config.border}`}>
      <DomainIcon className={size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
      {config.label}
    </span>
  );
}

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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
      <div className="w-1 h-4 bg-[#00c4cc] rounded-full" />
      {children}
    </h3>
  );
}

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function FormInput({ value, onChange, placeholder, type = 'text', ...props }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] disabled:bg-gray-50 disabled:text-gray-400"
      {...props}
    />
  );
}

function FormTextarea({ value, onChange, placeholder, rows = 3, disabled }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}

// ============================================
// Plan Editor Component (Full-page form)
// ============================================

function PlanEditor({
  plan,
  child,
  staff,
  onSave,
  onBack,
  onDelete,
  onStatusChange,
}: {
  plan: SupportPlanFile;
  child: Child;
  staff: { id: string; name: string; facilityRole?: string }[];
  onSave: (updated: SupportPlanFile) => Promise<void>;
  onBack: () => void;
  onDelete: (planId: string) => Promise<void>;
  onStatusChange: (planId: string, status: SupportPlanFileStatus) => Promise<void>;
}) {
  const [activeSection, setActiveSection] = useState<EditorSection>('header');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local form state
  const [planType, setPlanType] = useState<SupportPlanType>(plan.planType);
  const [periodStart, setPeriodStart] = useState(plan.periodStart || '');
  const [periodEnd, setPeriodEnd] = useState(plan.periodEnd || '');
  const [planCreatedDate, setPlanCreatedDate] = useState(plan.planCreatedDate || new Date().toISOString().split('T')[0]);
  const [planCreatorName, setPlanCreatorName] = useState(plan.planCreatorName || '');
  const [notes, setNotes] = useState(plan.notes || '');
  const [parentAgreed, setParentAgreed] = useState(plan.parentAgreed);
  const [parentSignerName, setParentSignerName] = useState(plan.parentSignerName || '');
  const [content, setContent] = useState<SupportPlanContent>(() => {
    const existing = plan.planContent;
    if (existing && (existing.shortTermGoals?.length || existing.domainAssessments?.length)) {
      // Ensure at least 3 short-term goals and 5 domain assessments
      const goals = existing.shortTermGoals || [];
      while (goals.length < 3) goals.push(createEmptyGoal());
      const assessments = existing.domainAssessments || [];
      for (const domain of ALL_DOMAINS) {
        if (!assessments.find(a => a.domain === domain)) {
          assessments.push({ domain, currentLevel: '' });
        }
      }
      return { ...existing, shortTermGoals: goals, domainAssessments: assessments };
    }
    return createEmptyPlanContent();
  });

  // PDF upload state
  const [uploadedFile, setUploadedFile] = useState<{ name: string; path: string } | null>(
    plan.filePath ? { name: plan.fileName || 'uploaded.pdf', path: plan.filePath } : null
  );
  const [uploading, setUploading] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  const updateContent = useCallback((partial: Partial<SupportPlanContent>) => {
    setContent(prev => ({ ...prev, ...partial }));
    markDirty();
  }, [markDirty]);

  const updateGoal = useCallback((goalId: string, updates: Partial<ShortTermGoal>) => {
    setContent(prev => ({
      ...prev,
      shortTermGoals: (prev.shortTermGoals || []).map(g =>
        g.id === goalId ? { ...g, ...updates } : g
      ),
    }));
    markDirty();
  }, [markDirty]);

  const addGoal = useCallback(() => {
    setContent(prev => ({
      ...prev,
      shortTermGoals: [...(prev.shortTermGoals || []), createEmptyGoal()],
    }));
    markDirty();
  }, [markDirty]);

  const removeGoal = useCallback((goalId: string) => {
    setContent(prev => ({
      ...prev,
      shortTermGoals: (prev.shortTermGoals || []).filter(g => g.id !== goalId),
    }));
    markDirty();
  }, [markDirty]);

  const updateAssessment = useCallback((domain: DevelopmentalDomain, currentLevel: string) => {
    setContent(prev => ({
      ...prev,
      domainAssessments: (prev.domainAssessments || []).map(a =>
        a.domain === domain ? { ...a, currentLevel } : a
      ),
    }));
    markDirty();
  }, [markDirty]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: SupportPlanFile = {
        ...plan,
        planType,
        periodStart,
        periodEnd,
        planCreatedDate,
        planCreatorName,
        notes,
        parentAgreed,
        parentSignerName,
        planContent: content,
        filePath: uploadedFile?.path,
        fileName: uploadedFile?.name,
      };
      await onSave(updated);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('PDFファイルのみアップロードできます');
      return;
    }
    setUploading(true);
    try {
      const path = `support-plans/${plan.facilityId}/${plan.childId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('documents').upload(path, file);
      if (error) throw error;
      setUploadedFile({ name: file.name, path });
      markDirty();
    } catch (err) {
      console.error('Upload error:', err);
      alert('ファイルのアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const completeness = getPlanCompleteness({ ...plan, planContent: content, planCreatorName, parentAgreed });

  return (
    <div className="space-y-0">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (dirty && !confirm('未保存の変更があります。破棄しますか？')) return;
                onBack();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              一覧に戻る
            </button>
            <div className="w-10 h-10 rounded-full bg-[#00c4cc] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {getInitials(child.name)}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">{child.name}の個別支援計画</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${STATUS_CONFIG[plan.status].bg} ${STATUS_CONFIG[plan.status].color} border ${STATUS_CONFIG[plan.status].border}`}>
                  {STATUS_CONFIG[plan.status].label}
                </span>
                <span className="text-xs text-gray-400">{PLAN_TYPE_LABELS[planType]}</span>
                {hasPdfUpload({ ...plan, filePath: uploadedFile?.path, fileName: uploadedFile?.name }) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                    <Upload className="w-2.5 h-2.5" />PDFアップロード済み
                  </span>
                )}
                {hasRootsContent({ ...plan, planContent: content }) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-2.5 h-2.5" />Roots入力済み
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Progress indicator */}
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <span className="text-xs text-gray-400">完成度</span>
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${completeness.percentage === 100 ? 'bg-emerald-500' : completeness.percentage >= 50 ? 'bg-[#00c4cc]' : 'bg-amber-400'}`}
                  style={{ width: `${completeness.percentage}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">{completeness.percentage}%</span>
            </div>

            {/* Status actions */}
            {plan.status === 'draft' && (
              <button
                onClick={() => onStatusChange(plan.id, 'active')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                有効にする
              </button>
            )}
            {plan.status === 'active' && (
              <button
                onClick={() => onStatusChange(plan.id, 'completed')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                完了にする
              </button>
            )}

            <button
              onClick={() => { /* PDF export - placeholder */ alert('PDF出力機能は準備中です'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              title="PDF出力"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF出力</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-[#00c4cc] rounded-lg hover:bg-[#00b0b8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {/* Editor body with sidebar navigation */}
      <div className="flex gap-6 mt-6">
        {/* Left sidebar - section navigation */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            {EDITOR_SECTIONS.map(section => {
              const SectionIcon = section.icon;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${
                    activeSection === section.key
                      ? 'bg-[#00c4cc]/10 text-[#00c4cc] font-medium'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <SectionIcon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
            <div className="border-t border-gray-100 mt-4 pt-4">
              <button
                onClick={() => {
                  if (confirm('この計画を削除しますか？この操作は取り消せません。')) {
                    onDelete(plan.id);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                計画を削除
              </button>
            </div>
          </div>
        </div>

        {/* Mobile section nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex overflow-x-auto px-2 py-2 gap-1">
          {EDITOR_SECTIONS.map(section => {
            const SectionIcon = section.icon;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] rounded-lg transition-colors ${
                  activeSection === section.key
                    ? 'bg-[#00c4cc]/10 text-[#00c4cc] font-medium'
                    : 'text-gray-400'
                }`}
              >
                <SectionIcon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0 pb-20 lg:pb-0">
          {/* Section: Header / Basic Info */}
          {activeSection === 'header' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>基本情報</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormLabel>児童氏名</FormLabel>
                    <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 border border-gray-200">{child.name}</div>
                  </div>
                  <div>
                    <FormLabel>保護者氏名</FormLabel>
                    <FormInput
                      value={content.guardianName || child.guardianName || ''}
                      onChange={v => updateContent({ guardianName: v })}
                      placeholder="保護者氏名"
                    />
                  </div>
                  <div>
                    <FormLabel>受給者証番号</FormLabel>
                    <FormInput
                      value={content.beneficiaryNumber || child.beneficiaryNumber || ''}
                      onChange={v => updateContent({ beneficiaryNumber: v })}
                      placeholder="受給者証番号"
                    />
                  </div>
                  <div>
                    <FormLabel>計画種別</FormLabel>
                    <select
                      value={planType}
                      onChange={e => { setPlanType(e.target.value as SupportPlanType); markDirty(); }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                    >
                      {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>計画期間・作成情報</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <FormLabel required>計画作成日</FormLabel>
                    <FormInput type="date" value={planCreatedDate} onChange={v => { setPlanCreatedDate(v); markDirty(); }} />
                  </div>
                  <div>
                    <FormLabel required>計画開始日</FormLabel>
                    <FormInput type="date" value={periodStart} onChange={v => { setPeriodStart(v); markDirty(); }} />
                  </div>
                  <div>
                    <FormLabel required>計画終了日</FormLabel>
                    <FormInput type="date" value={periodEnd} onChange={v => { setPeriodEnd(v); markDirty(); }} />
                  </div>
                  <div>
                    <FormLabel>児童発達支援管理責任者名</FormLabel>
                    <FormInput value={planCreatorName} onChange={v => { setPlanCreatorName(v); markDirty(); }} placeholder="児発管氏名" />
                  </div>
                  <div>
                    <FormLabel>モニタリング予定日</FormLabel>
                    <FormInput type="date" value={content.monitoringDate || ''} onChange={v => updateContent({ monitoringDate: v })} />
                  </div>
                </div>
              </div>

              {/* PDF Upload Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>PDFアップロード</SectionHeading>
                <p className="text-xs text-gray-400 mb-4">既存の支援計画PDFがある場合はアップロードできます。Roots入力と併用可能です。</p>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-800 truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-blue-600">アップロード済み</p>
                    </div>
                    <button
                      onClick={() => { setUploadedFile(null); markDirty(); }}
                      className="p-1 text-blue-400 hover:text-blue-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg hover:border-[#00c4cc] hover:text-[#00c4cc] hover:bg-[#00c4cc]/5 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {uploading ? 'アップロード中...' : 'PDFを選択'}
                    </button>
                  </div>
                )}
              </div>

              {/* Parent agreement & notes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>保護者同意・備考</SectionHeading>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={parentAgreed}
                        onChange={e => { setParentAgreed(e.target.checked); markDirty(); }}
                        className="rounded border-gray-300 text-[#00c4cc] focus:ring-[#00c4cc]"
                      />
                      <span className="text-sm text-gray-700">保護者同意済み</span>
                    </label>
                  </div>
                  {parentAgreed && (
                    <div className="max-w-sm">
                      <FormLabel>同意者名</FormLabel>
                      <FormInput value={parentSignerName} onChange={v => { setParentSignerName(v); markDirty(); }} placeholder="同意した保護者名" />
                    </div>
                  )}
                  <div>
                    <FormLabel>備考</FormLabel>
                    <FormTextarea value={notes} onChange={v => { setNotes(v); markDirty(); }} placeholder="メモや補足事項..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Assessment */}
          {activeSection === 'assessment' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>アセスメント（現状把握）</SectionHeading>
                <div className="space-y-4">
                  <div>
                    <FormLabel>障害の状況</FormLabel>
                    <FormTextarea
                      value={content.disabilityStatus || ''}
                      onChange={v => updateContent({ disabilityStatus: v })}
                      placeholder="障害の種類、程度、診断名、手帳の有無など..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <FormLabel>本人の希望・興味</FormLabel>
                    <FormTextarea
                      value={content.childWishes || ''}
                      onChange={v => updateContent({ childWishes: v })}
                      placeholder="本人が好きなこと、興味のあること、やりたいこと..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <FormLabel>家族の希望</FormLabel>
                    <FormTextarea
                      value={content.familyWishes || ''}
                      onChange={v => updateContent({ familyWishes: v })}
                      placeholder="保護者の希望、家庭での課題、期待すること..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>現在の発達状況（5領域）</SectionHeading>
                <p className="text-xs text-gray-400 mb-4">5つの発達領域それぞれについて、現在の状況を記入してください。</p>
                <div className="space-y-4">
                  {(content.domainAssessments || []).map(assessment => {
                    const config = DOMAIN_CONFIG[assessment.domain];
                    const DomainIcon = config.icon;
                    return (
                      <div key={assessment.domain} className={`rounded-lg border ${config.border} p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${DOMAIN_DOT_COLORS[assessment.domain]}`} />
                          <DomainIcon className={`w-4 h-4 ${config.color}`} />
                          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                        </div>
                        <FormTextarea
                          value={assessment.currentLevel}
                          onChange={v => updateAssessment(assessment.domain, v)}
                          placeholder={`${config.label}に関する現在の発達状況...`}
                          rows={2}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section: Goals */}
          {activeSection === 'goals' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>総合的な援助の方針</SectionHeading>
                <FormTextarea
                  value={content.overallPolicy || ''}
                  onChange={v => updateContent({ overallPolicy: v })}
                  placeholder="全体を通した支援の方向性、大切にしたいこと..."
                  rows={3}
                />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>長期目標（1年）</SectionHeading>
                <FormTextarea
                  value={content.longTermGoal || ''}
                  onChange={v => updateContent({ longTermGoal: v })}
                  placeholder="例：集団活動の中で友達と関わり、コミュニケーション能力を高める..."
                  rows={3}
                />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeading>短期目標（3〜6ヶ月）</SectionHeading>
                  <button
                    onClick={addGoal}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    目標を追加
                  </button>
                </div>
                <div className="space-y-4">
                  {(content.shortTermGoals || []).map((goal, index) => (
                    <div key={goal.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#00c4cc] bg-[#00c4cc]/10 px-2.5 py-1 rounded-full">
                          目標 {index + 1}
                        </span>
                        {(content.shortTermGoals || []).length > 1 && (
                          <button
                            onClick={() => removeGoal(goal.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div>
                        <FormLabel required>目標内容</FormLabel>
                        <FormTextarea
                          value={goal.goalText}
                          onChange={v => updateGoal(goal.id, { goalText: v })}
                          placeholder="具体的な達成目標を記入..."
                          rows={2}
                        />
                      </div>
                      <div>
                        <FormLabel>関連する5領域</FormLabel>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {ALL_DOMAINS.map(domain => {
                            const config = DOMAIN_CONFIG[domain];
                            const isSelected = goal.domains.includes(domain);
                            return (
                              <button
                                key={domain}
                                onClick={() => {
                                  const newDomains = isSelected
                                    ? goal.domains.filter(d => d !== domain)
                                    : [...goal.domains, domain];
                                  updateGoal(goal.id, { domains: newDomains });
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                  isSelected
                                    ? `${config.bg} ${config.color} ${config.border} font-medium`
                                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full ${isSelected ? DOMAIN_DOT_COLORS[domain] : 'bg-gray-300'}`} />
                                {config.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section: Support Content */}
          {activeSection === 'support' && (
            <div className="space-y-6">
              {(content.shortTermGoals || []).map((goal, index) => {
                if (!goal.goalText) return null;
                return (
                  <div key={goal.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="text-xs font-bold text-[#00c4cc] bg-[#00c4cc]/10 px-2.5 py-1 rounded-full flex-shrink-0">
                        目標 {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{goal.goalText}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {goal.domains.map(domain => (
                            <DomainTag key={domain} domain={domain} size="xs" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <FormLabel>支援内容の詳細</FormLabel>
                        <FormTextarea
                          value={goal.supportContent}
                          onChange={v => updateGoal(goal.id, { supportContent: v })}
                          placeholder="この目標を達成するための具体的な支援方法や配慮事項..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <FormLabel>達成基準</FormLabel>
                          <FormTextarea
                            value={goal.achievementCriteria}
                            onChange={v => updateGoal(goal.id, { achievementCriteria: v })}
                            placeholder="どうなれば目標達成とするか..."
                            rows={2}
                          />
                        </div>
                        <div>
                          <FormLabel>担当者</FormLabel>
                          <FormInput
                            value={goal.responsibleStaff}
                            onChange={v => updateGoal(goal.id, { responsibleStaff: v })}
                            placeholder="担当スタッフ名"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!(content.shortTermGoals || []).some(g => g.goalText) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <Target className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">短期目標が設定されていません</p>
                  <p className="text-gray-300 text-xs mt-1">「支援目標」セクションで短期目標を入力してください</p>
                </div>
              )}
            </div>
          )}

          {/* Section: Family Support */}
          {activeSection === 'family' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>家族支援の内容</SectionHeading>
                <FormTextarea
                  value={content.familySupportContent || ''}
                  onChange={v => updateContent({ familySupportContent: v })}
                  placeholder="保護者への助言、相談支援、情報提供、ペアレントトレーニングなど..."
                  rows={4}
                />
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>関係機関連携の内容</SectionHeading>
                <FormTextarea
                  value={content.interAgencyCoordination || ''}
                  onChange={v => updateContent({ interAgencyCoordination: v })}
                  placeholder="保育園・幼稚園・学校、医療機関、相談支援事業所等との連携内容..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Section: Evaluation */}
          {activeSection === 'evaluation' && (
            <div className="space-y-6">
              {/* Mid-term evaluation */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>中間評価</SectionHeading>
                <div className="space-y-4">
                  <div className="max-w-xs">
                    <FormLabel>中間評価日</FormLabel>
                    <FormInput
                      type="date"
                      value={content.midEvaluationDate || ''}
                      onChange={v => updateContent({ midEvaluationDate: v })}
                    />
                  </div>
                  {(content.shortTermGoals || []).filter(g => g.goalText).map((goal, index) => (
                    <div key={goal.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#00c4cc] bg-[#00c4cc]/10 px-2 py-0.5 rounded-full">目標 {index + 1}</span>
                        <span className="text-sm text-gray-600">{goal.goalText}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <FormLabel>達成度</FormLabel>
                          <select
                            value={goal.midEvaluationLevel || ''}
                            onChange={e => updateGoal(goal.id, { midEvaluationLevel: (e.target.value || undefined) as ShortTermGoal['midEvaluationLevel'] })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                          >
                            <option value="">選択してください</option>
                            <option value="achieved">達成</option>
                            <option value="progressing">進行中</option>
                            <option value="unchanged">変化なし</option>
                            <option value="regressed">後退</option>
                          </select>
                        </div>
                        <div>
                          <FormLabel>評価コメント</FormLabel>
                          <FormInput
                            value={goal.midEvaluation || ''}
                            onChange={v => updateGoal(goal.id, { midEvaluation: v })}
                            placeholder="中間評価コメント..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <FormLabel>全体メモ</FormLabel>
                    <FormTextarea
                      value={content.midEvaluationOverallNotes || ''}
                      onChange={v => updateContent({ midEvaluationOverallNotes: v })}
                      placeholder="中間評価の全体的な所感..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Final evaluation */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeading>期末評価</SectionHeading>
                <div className="space-y-4">
                  <div className="max-w-xs">
                    <FormLabel>期末評価日</FormLabel>
                    <FormInput
                      type="date"
                      value={content.finalEvaluationDate || ''}
                      onChange={v => updateContent({ finalEvaluationDate: v })}
                    />
                  </div>
                  {(content.shortTermGoals || []).filter(g => g.goalText).map((goal, index) => (
                    <div key={goal.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#00c4cc] bg-[#00c4cc]/10 px-2 py-0.5 rounded-full">目標 {index + 1}</span>
                        <span className="text-sm text-gray-600">{goal.goalText}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <FormLabel>達成度</FormLabel>
                          <select
                            value={goal.finalEvaluationLevel || ''}
                            onChange={e => updateGoal(goal.id, { finalEvaluationLevel: (e.target.value || undefined) as ShortTermGoal['finalEvaluationLevel'] })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                          >
                            <option value="">選択してください</option>
                            <option value="achieved">達成</option>
                            <option value="progressing">進行中</option>
                            <option value="unchanged">変化なし</option>
                            <option value="regressed">後退</option>
                          </select>
                        </div>
                        <div>
                          <FormLabel>評価コメント</FormLabel>
                          <FormInput
                            value={goal.finalEvaluation || ''}
                            onChange={v => updateGoal(goal.id, { finalEvaluation: v })}
                            placeholder="期末評価コメント..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <FormLabel>全体メモ</FormLabel>
                    <FormTextarea
                      value={content.finalEvaluationOverallNotes || ''}
                      onChange={v => updateContent({ finalEvaluationOverallNotes: v })}
                      placeholder="期末評価の全体的な所感..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <FormLabel>次期計画への提言</FormLabel>
                    <FormTextarea
                      value={content.nextPlanRecommendations || ''}
                      onChange={v => updateContent({ nextPlanRecommendations: v })}
                      placeholder="次の計画期間に向けた課題や提案..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Timeline View Component
// ============================================

function TimelineView({ plans, childList }: { plans: SupportPlanFile[]; childList: Child[] }) {
  const childrenList = childList;
  const child = childrenList.length > 0 ? childrenList[0] : null;
  if (!child) return null;

  const childPlans = plans
    .filter(p => p.childId === child.id)
    .sort((a, b) => (b.periodStart || '').localeCompare(a.periodStart || ''));

  if (childPlans.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        この児童の計画履歴はありません
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {childPlans.map((plan, index) => (
        <div key={plan.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
              plan.status === 'active' ? 'bg-[#00c4cc]' : plan.status === 'completed' ? 'bg-emerald-500' : 'bg-gray-300'
            }`} />
            {index < childPlans.length - 1 && (
              <div className="w-px flex-1 bg-gray-200 mt-1" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${STATUS_CONFIG[plan.status].bg} ${STATUS_CONFIG[plan.status].color} border ${STATUS_CONFIG[plan.status].border}`}>
                {STATUS_CONFIG[plan.status].label}
              </span>
              <span className="text-xs text-gray-400">{PLAN_TYPE_LABELS[plan.planType]}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {formatPeriodJP(plan.periodStart, plan.periodEnd)}
            </p>
            {plan.planCreatorName && (
              <p className="text-xs text-gray-400 mt-0.5">作成者: {plan.planCreatorName}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function SupportPlanView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const { children, staff } = useFacilityData();

  const [plans, setPlans] = useState<SupportPlanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [childFilter, setChildFilter] = useState<ChildPlanStatus>('all');

  // Editor state
  const [editingPlan, setEditingPlan] = useState<SupportPlanFile | null>(null);
  const [editingChild, setEditingChild] = useState<Child | null>(null);

  // Timeline child (for timeline sidebar)
  const [timelineChildId, setTimelineChildId] = useState<string | null>(null);

  // Fetch plans
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
        if (data) setPlans(data.map((row: Record<string, unknown>) => mapRowToPlan(row)));
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

    if (searchTerm) {
      list = list.filter(item =>
        item.child.name.includes(searchTerm) ||
        item.child.nameKana?.includes(searchTerm)
      );
    }

    if (childFilter !== 'all') {
      list = list.filter(item => item.status === childFilter);
    }

    return list;
  }, [children, plans, searchTerm, childFilter]);

  // Handlers
  const handleCreatePlan = async (childId: string, planType: SupportPlanType = 'initial') => {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    const endDate = sixMonthsLater.toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('support_plan_files')
        .insert({
          facility_id: facilityId,
          child_id: childId,
          plan_type: planType,
          period_start: today,
          period_end: endDate,
          plan_created_date: today,
          status: 'draft',
          file_name: '',
          plan_content: createEmptyPlanContent(),
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        const newPlan = mapRowToPlan(data as Record<string, unknown>);
        setPlans(prev => [newPlan, ...prev]);
        const child = children.find(c => c.id === childId);
        if (child) {
          setEditingPlan(newPlan);
          setEditingChild(child);
        }
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      alert('計画の作成に失敗しました');
    }
  };

  const handleSavePlan = async (updated: SupportPlanFile) => {
    try {
      const { error } = await supabase
        .from('support_plan_files')
        .update({
          plan_type: updated.planType,
          period_start: updated.periodStart,
          period_end: updated.periodEnd,
          plan_created_date: updated.planCreatedDate,
          plan_creator_name: updated.planCreatorName,
          file_path: updated.filePath || null,
          file_name: updated.fileName || null,
          parent_agreed: updated.parentAgreed,
          parent_signer_name: updated.parentSignerName || null,
          notes: updated.notes || null,
          plan_content: updated.planContent || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', updated.id);
      if (error) throw error;
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingPlan(updated);
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('保存に失敗しました');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('support_plan_files')
        .delete()
        .eq('id', planId);
      if (error) throw error;
      setPlans(prev => prev.filter(p => p.id !== planId));
      setEditingPlan(null);
      setEditingChild(null);
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('削除に失敗しました');
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
      if (editingPlan?.id === planId) {
        setEditingPlan(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Loading state
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

  // Editor mode (full-page)
  if (editingPlan && editingChild) {
    return (
      <PlanEditor
        plan={editingPlan}
        child={editingChild}
        staff={staff.map(s => ({ id: s.id, name: s.name, facilityRole: s.facilityRole }))}
        onSave={handleSavePlan}
        onBack={() => { setEditingPlan(null); setEditingChild(null); }}
        onDelete={handleDeletePlan}
        onStatusChange={handleStatusChange}
      />
    );
  }

  // ============================================
  // List view (Children grid)
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">個別支援計画</h1>
          <span className="text-sm text-gray-400 ml-1">5領域対応</span>
        </div>
      </div>

      {/* 5 Domain Legend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">発達支援の5領域</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_DOMAINS.map(domain => (
            <DomainTag key={domain} domain={domain} size="sm" />
          ))}
        </div>
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

      {/* Children Grid + Timeline Sidebar */}
      <div className="flex gap-6">
        {/* Children Grid */}
        <div className="flex-1 min-w-0">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredChildren.map(item => {
                const { child, status, label, plan, allPlans } = item;
                const latestPlan = plan;
                const daysRemaining = latestPlan?.periodEnd ? daysUntil(latestPlan.periodEnd) : null;
                const progress = latestPlan ? getPlanCompleteness(latestPlan) : null;

                // Domain coverage from latest plan
                const coveredDomains: DevelopmentalDomain[] = [];
                if (latestPlan?.planContent?.shortTermGoals) {
                  for (const goal of latestPlan.planContent.shortTermGoals) {
                    for (const d of goal.domains) {
                      if (!coveredDomains.includes(d)) coveredDomains.push(d);
                    }
                  }
                }

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
                        {daysRemaining !== null && (
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

                        {/* Domain Coverage */}
                        {coveredDomains.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ALL_DOMAINS.map(domain => (
                              <div
                                key={domain}
                                className={`w-2 h-2 rounded-full ${coveredDomains.includes(domain) ? DOMAIN_DOT_COLORS[domain] : 'bg-gray-200'}`}
                                title={DOMAIN_CONFIG[domain].label}
                              />
                            ))}
                            <span className="text-[10px] text-gray-400 ml-1">
                              {coveredDomains.length}/5領域
                            </span>
                          </div>
                        )}

                        {/* Status badges */}
                        <div className="flex flex-wrap gap-1">
                          {hasPdfUpload(latestPlan) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-600 border border-blue-100">
                              <Upload className="w-2.5 h-2.5" />PDF
                            </span>
                          )}
                          {hasRootsContent(latestPlan) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <CheckCircle className="w-2.5 h-2.5" />Roots
                            </span>
                          )}
                        </div>

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
                              setEditingPlan(latestPlan);
                              setEditingChild(child);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#00c4cc] bg-[#00c4cc]/5 rounded-lg hover:bg-[#00c4cc]/10 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            編集
                          </button>
                          <button
                            onClick={() => setTimelineChildId(timelineChildId === child.id ? null : child.id)}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                              timelineChildId === child.id
                                ? 'text-[#00c4cc] bg-[#00c4cc]/10'
                                : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                            }`}
                            title="計画履歴"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCreatePlan(child.id, 'renewal')}
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
                          onClick={() => handleCreatePlan(child.id, 'initial')}
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
        </div>

        {/* Timeline Sidebar */}
        {timelineChildId && (
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#00c4cc]" />
                  <h3 className="text-sm font-bold text-gray-700">
                    {children.find(c => c.id === timelineChildId)?.name}の計画履歴
                  </h3>
                </div>
                <button onClick={() => setTimelineChildId(null)} className="text-gray-300 hover:text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <TimelineView
                plans={plans}
                childList={children.filter(c => c.id === timelineChildId)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
