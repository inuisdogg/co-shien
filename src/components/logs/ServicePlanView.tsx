/**
 * 個別支援計画管理コンポーネント
 * 児童ごとの支援計画を作成・管理
 * 運営指導で必須の「個別支援計画書」
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Plus,
  Edit,
  Save,
  X,
  User,
  Calendar,
  Target,
  FileText,
  CheckCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  Trash2,
  Eye,
  Download,
  PenLine,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateServicePlanPdf } from '@/utils/pdfExport';

// 支援計画の型定義
type ServicePlan = {
  id: string;
  facilityId: string;
  childId: string;
  planType: 'initial' | 'renewal' | 'modification';
  periodStart: string;
  periodEnd: string;
  createdBy?: string;
  createdByName?: string;
  createdDate?: string;
  currentSituation?: string;
  issues?: string;
  strengths?: string;
  interests?: string;
  longTermGoals?: Array<{ goal: string; domain: string }>;
  shortTermGoals?: Array<{ goal: string; domain: string; targetDate?: string; evaluationCriteria?: string }>;
  supportContent?: Array<{ category: string; content: string; frequency?: string; staff?: string }>;
  weeklyProgram?: Record<string, string[]>;
  specialNotes?: string;
  medicalNotes?: string;
  familyCooperation?: string;
  midTermEvaluation?: string;
  midTermEvaluationDate?: string;
  finalEvaluation?: string;
  finalEvaluationDate?: string;
  nextPlanNotes?: string;
  parentSignatureUrl?: string;
  parentSignedAt?: string;
  parentSignerName?: string;
  staffSignatureUrl?: string;
  staffSignedAt?: string;
  managerSignatureUrl?: string;
  managerSignedAt?: string;
  status: 'draft' | 'pending_review' | 'pending_sign' | 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
};

// 児童の型定義
type Child = {
  id: string;
  name: string;
  birthDate?: string;
};

// DBのsnake_caseからcamelCaseに変換
const mapDbToPlan = (row: any): ServicePlan => ({
  id: row.id,
  facilityId: row.facility_id,
  childId: row.child_id,
  planType: row.plan_type,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdDate: row.created_date,
  currentSituation: row.current_situation,
  issues: row.issues,
  strengths: row.strengths,
  interests: row.interests,
  longTermGoals: row.long_term_goals,
  shortTermGoals: row.short_term_goals,
  supportContent: row.support_content,
  weeklyProgram: row.weekly_program,
  specialNotes: row.special_notes,
  medicalNotes: row.medical_notes,
  familyCooperation: row.family_cooperation,
  midTermEvaluation: row.mid_term_evaluation,
  midTermEvaluationDate: row.mid_term_evaluation_date,
  finalEvaluation: row.final_evaluation,
  finalEvaluationDate: row.final_evaluation_date,
  nextPlanNotes: row.next_plan_notes,
  parentSignatureUrl: row.parent_signature_url,
  parentSignedAt: row.parent_signed_at,
  parentSignerName: row.parent_signer_name,
  staffSignatureUrl: row.staff_signature_url,
  staffSignedAt: row.staff_signed_at,
  managerSignatureUrl: row.manager_signature_url,
  managerSignedAt: row.manager_signed_at,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// 領域オプション
const domainOptions = [
  '健康・生活',
  '運動・感覚',
  '認知・行動',
  'コミュニケーション',
  '人間関係・社会性',
];

// ステータスラベル
const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'bg-gray-100 text-gray-700' },
  pending_review: { label: 'レビュー待ち', color: 'bg-yellow-100 text-yellow-700' },
  pending_sign: { label: '署名待ち', color: 'bg-orange-100 text-orange-700' },
  active: { label: '有効', color: 'bg-green-100 text-green-700' },
  completed: { label: '期間終了', color: 'bg-blue-100 text-blue-700' },
  archived: { label: 'アーカイブ', color: 'bg-gray-100 text-gray-500' },
};

export default function ServicePlanView() {
  const { user, facility } = useAuth();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState<Partial<ServicePlan>>({
    planType: 'initial',
    periodStart: '',
    periodEnd: '',
    currentSituation: '',
    issues: '',
    strengths: '',
    interests: '',
    longTermGoals: [{ goal: '', domain: '' }],
    shortTermGoals: [{ goal: '', domain: '', targetDate: '', evaluationCriteria: '' }],
    supportContent: [{ category: '', content: '', frequency: '', staff: '' }],
    specialNotes: '',
    familyCooperation: '',
  });

  // 署名用Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      // 児童一覧を取得
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name, birth_date')
        .eq('facility_id', facility.id)
        .order('name');

      if (childrenData) {
        setChildren(childrenData.map(c => ({
          id: c.id,
          name: c.name,
          birthDate: c.birth_date,
        })));
      }

      // 支援計画を取得
      const { data: plansData, error: plansError } = await supabase
        .from('service_plans')
        .select('*')
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;

      if (plansData) {
        setPlans(plansData.map(mapDbToPlan));
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 新規計画作成
  const handleCreatePlan = async () => {
    if (!facility?.id || !selectedChildId || !user?.id) return;

    setSaving(true);
    try {
      const planData = {
        facility_id: facility.id,
        child_id: selectedChildId,
        plan_type: formData.planType,
        period_start: formData.periodStart,
        period_end: formData.periodEnd,
        created_by: user.id,
        created_by_name: user.name || '',
        created_date: new Date().toISOString().split('T')[0],
        current_situation: formData.currentSituation,
        issues: formData.issues,
        strengths: formData.strengths,
        interests: formData.interests,
        long_term_goals: formData.longTermGoals,
        short_term_goals: formData.shortTermGoals,
        support_content: formData.supportContent,
        special_notes: formData.specialNotes,
        family_cooperation: formData.familyCooperation,
        status: 'draft',
      };

      const { error } = await supabase.from('service_plans').insert(planData);

      if (error) throw error;

      await fetchData();
      setShowNewPlanForm(false);
      resetForm();
    } catch (err) {
      console.error('作成エラー:', err);
      alert('作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 計画更新
  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    setSaving(true);
    try {
      const planData = {
        plan_type: formData.planType,
        period_start: formData.periodStart,
        period_end: formData.periodEnd,
        current_situation: formData.currentSituation,
        issues: formData.issues,
        strengths: formData.strengths,
        interests: formData.interests,
        long_term_goals: formData.longTermGoals,
        short_term_goals: formData.shortTermGoals,
        support_content: formData.supportContent,
        special_notes: formData.specialNotes,
        family_cooperation: formData.familyCooperation,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('service_plans')
        .update(planData)
        .eq('id', selectedPlan.id);

      if (error) throw error;

      await fetchData();
      setIsEditing(false);
    } catch (err) {
      console.error('更新エラー:', err);
      alert('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      planType: 'initial',
      periodStart: '',
      periodEnd: '',
      currentSituation: '',
      issues: '',
      strengths: '',
      interests: '',
      longTermGoals: [{ goal: '', domain: '' }],
      shortTermGoals: [{ goal: '', domain: '', targetDate: '', evaluationCriteria: '' }],
      supportContent: [{ category: '', content: '', frequency: '', staff: '' }],
      specialNotes: '',
      familyCooperation: '',
    });
  };

  // 計画選択時
  const handleSelectPlan = (plan: ServicePlan) => {
    setSelectedPlan(plan);
    setFormData({
      planType: plan.planType,
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      currentSituation: plan.currentSituation,
      issues: plan.issues,
      strengths: plan.strengths,
      interests: plan.interests,
      longTermGoals: plan.longTermGoals || [{ goal: '', domain: '' }],
      shortTermGoals: plan.shortTermGoals || [{ goal: '', domain: '', targetDate: '', evaluationCriteria: '' }],
      supportContent: plan.supportContent || [{ category: '', content: '', frequency: '', staff: '' }],
      specialNotes: plan.specialNotes,
      familyCooperation: plan.familyCooperation,
    });
  };

  // 目標追加
  const addLongTermGoal = () => {
    setFormData({
      ...formData,
      longTermGoals: [...(formData.longTermGoals || []), { goal: '', domain: '' }],
    });
  };

  const addShortTermGoal = () => {
    setFormData({
      ...formData,
      shortTermGoals: [...(formData.shortTermGoals || []), { goal: '', domain: '', targetDate: '', evaluationCriteria: '' }],
    });
  };

  const addSupportContent = () => {
    setFormData({
      ...formData,
      supportContent: [...(formData.supportContent || []), { category: '', content: '', frequency: '', staff: '' }],
    });
  };

  // フィルタリング
  const filteredPlans = selectedChildId
    ? plans.filter(p => p.childId === selectedChildId)
    : plans;

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
            <ClipboardList className="w-7 h-7 text-[#00c4cc]" />
            個別支援計画
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            児童ごとの支援計画を作成・管理します
          </p>
        </div>
        <button
          onClick={() => {
            if (!selectedChildId && children.length > 0) {
              setSelectedChildId(children[0].id);
            }
            setShowNewPlanForm(true);
            resetForm();
          }}
          disabled={children.length === 0}
          className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 児童リスト */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="font-bold text-gray-700 text-sm">児童一覧</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              <button
                onClick={() => setSelectedChildId(null)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  !selectedChildId ? 'bg-[#00c4cc]/10 border-l-4 border-[#00c4cc]' : ''
                }`}
              >
                <span className="text-sm font-medium text-gray-700">全員</span>
                <span className="text-xs text-gray-500 ml-2">({plans.length}件)</span>
              </button>
              {children.map((child) => {
                const childPlans = plans.filter(p => p.childId === child.id);
                const activePlan = childPlans.find(p => p.status === 'active');
                return (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedChildId === child.id ? 'bg-[#00c4cc]/10 border-l-4 border-[#00c4cc]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{child.name}</span>
                      {activePlan && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{childPlans.length}件の計画</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 計画リスト・詳細 */}
        <div className="lg:col-span-3">
          {showNewPlanForm ? (
            // 新規作成フォーム
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">新規支援計画作成</h2>
                <button
                  onClick={() => setShowNewPlanForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* 基本情報 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      対象児童 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedChildId || ''}
                      onChange={(e) => setSelectedChildId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                    >
                      <option value="">選択してください</option>
                      {children.map((child) => (
                        <option key={child.id} value={child.id}>{child.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      計画種別 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.planType}
                      onChange={(e) => setFormData({ ...formData, planType: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                    >
                      <option value="initial">初回計画</option>
                      <option value="renewal">更新計画</option>
                      <option value="modification">計画変更</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        開始日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.periodStart}
                        onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        終了日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.periodEnd}
                        onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                      />
                    </div>
                  </div>
                </div>

                {/* 現状・課題 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      現在の状況
                    </label>
                    <textarea
                      value={formData.currentSituation || ''}
                      onChange={(e) => setFormData({ ...formData, currentSituation: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[100px]"
                      placeholder="お子様の現在の発達状況や日常生活の様子..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      強み・得意なこと
                    </label>
                    <textarea
                      value={formData.strengths || ''}
                      onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[100px]"
                      placeholder="お子様の強みや得意なこと..."
                    />
                  </div>
                </div>

                {/* 長期目標 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      長期目標
                    </label>
                    <button
                      type="button"
                      onClick={addLongTermGoal}
                      className="text-sm text-[#00c4cc] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(formData.longTermGoals || []).map((goal, index) => (
                      <div key={index} className="flex gap-2">
                        <select
                          value={goal.domain}
                          onChange={(e) => {
                            const newGoals = [...(formData.longTermGoals || [])];
                            newGoals[index] = { ...goal, domain: e.target.value };
                            setFormData({ ...formData, longTermGoals: newGoals });
                          }}
                          className="w-40 border border-gray-300 rounded-lg px-3 py-2"
                        >
                          <option value="">領域</option>
                          {domainOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={goal.goal}
                          onChange={(e) => {
                            const newGoals = [...(formData.longTermGoals || [])];
                            newGoals[index] = { ...goal, goal: e.target.value };
                            setFormData({ ...formData, longTermGoals: newGoals });
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                          placeholder="目標を入力..."
                        />
                        {(formData.longTermGoals || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newGoals = (formData.longTermGoals || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, longTermGoals: newGoals });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 短期目標 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      短期目標
                    </label>
                    <button
                      type="button"
                      onClick={addShortTermGoal}
                      className="text-sm text-[#00c4cc] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(formData.shortTermGoals || []).map((goal, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex gap-2 mb-2">
                          <select
                            value={goal.domain}
                            onChange={(e) => {
                              const newGoals = [...(formData.shortTermGoals || [])];
                              newGoals[index] = { ...goal, domain: e.target.value };
                              setFormData({ ...formData, shortTermGoals: newGoals });
                            }}
                            className="w-40 border border-gray-300 rounded-lg px-3 py-2 bg-white"
                          >
                            <option value="">領域</option>
                            {domainOptions.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={goal.goal}
                            onChange={(e) => {
                              const newGoals = [...(formData.shortTermGoals || [])];
                              newGoals[index] = { ...goal, goal: e.target.value };
                              setFormData({ ...formData, shortTermGoals: newGoals });
                            }}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 bg-white"
                            placeholder="目標を入力..."
                          />
                          {(formData.shortTermGoals || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newGoals = (formData.shortTermGoals || []).filter((_, i) => i !== index);
                                setFormData({ ...formData, shortTermGoals: newGoals });
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={goal.targetDate || ''}
                            onChange={(e) => {
                              const newGoals = [...(formData.shortTermGoals || [])];
                              newGoals[index] = { ...goal, targetDate: e.target.value };
                              setFormData({ ...formData, shortTermGoals: newGoals });
                            }}
                            className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                            placeholder="達成目標日"
                          />
                          <input
                            type="text"
                            value={goal.evaluationCriteria || ''}
                            onChange={(e) => {
                              const newGoals = [...(formData.shortTermGoals || [])];
                              newGoals[index] = { ...goal, evaluationCriteria: e.target.value };
                              setFormData({ ...formData, shortTermGoals: newGoals });
                            }}
                            className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                            placeholder="評価基準"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 支援内容 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      支援内容
                    </label>
                    <button
                      type="button"
                      onClick={addSupportContent}
                      className="text-sm text-[#00c4cc] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(formData.supportContent || []).map((content, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={content.category}
                          onChange={(e) => {
                            const newContent = [...(formData.supportContent || [])];
                            newContent[index] = { ...content, category: e.target.value };
                            setFormData({ ...formData, supportContent: newContent });
                          }}
                          className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                          placeholder="カテゴリ"
                        />
                        <input
                          type="text"
                          value={content.content}
                          onChange={(e) => {
                            const newContent = [...(formData.supportContent || [])];
                            newContent[index] = { ...content, content: e.target.value };
                            setFormData({ ...formData, supportContent: newContent });
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                          placeholder="支援内容を入力..."
                        />
                        <input
                          type="text"
                          value={content.frequency || ''}
                          onChange={(e) => {
                            const newContent = [...(formData.supportContent || [])];
                            newContent[index] = { ...content, frequency: e.target.value };
                            setFormData({ ...formData, supportContent: newContent });
                          }}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2"
                          placeholder="頻度"
                        />
                        {(formData.supportContent || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newContent = (formData.supportContent || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, supportContent: newContent });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 特記事項 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    特記事項・家庭との連携
                  </label>
                  <textarea
                    value={formData.familyCooperation || ''}
                    onChange={(e) => setFormData({ ...formData, familyCooperation: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[80px]"
                    placeholder="家庭での取り組みや連携事項など..."
                  />
                </div>

                {/* 保存ボタン */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowNewPlanForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleCreatePlan}
                    disabled={saving || !selectedChildId || !formData.periodStart || !formData.periodEnd}
                    className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '作成する'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedPlan ? (
            // 計画詳細
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
                  >
                    ← 一覧に戻る
                  </button>
                  <h2 className="text-lg font-bold text-gray-800">
                    {children.find(c => c.id === selectedPlan.childId)?.name} さんの支援計画
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[selectedPlan.status]?.color}`}>
                      {statusLabels[selectedPlan.status]?.label}
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedPlan.periodStart} 〜 {selectedPlan.periodEnd}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const childName = children.find(c => c.id === selectedPlan.childId)?.name || '児童';
                      const pdf = generateServicePlanPdf(
                        {
                          childName,
                          planType: selectedPlan.planType,
                          periodStart: selectedPlan.periodStart,
                          periodEnd: selectedPlan.periodEnd,
                          createdByName: selectedPlan.createdByName,
                          createdDate: selectedPlan.createdDate,
                          currentSituation: selectedPlan.currentSituation,
                          issues: selectedPlan.issues,
                          strengths: selectedPlan.strengths,
                          interests: selectedPlan.interests,
                          longTermGoals: selectedPlan.longTermGoals,
                          shortTermGoals: selectedPlan.shortTermGoals,
                          supportContent: selectedPlan.supportContent,
                          specialNotes: selectedPlan.specialNotes,
                          familyCooperation: selectedPlan.familyCooperation,
                        },
                        { name: facility?.name || '施設名', code: facility?.code }
                      );
                      pdf.save(`個別支援計画_${childName}_${selectedPlan.periodStart}.pdf`);
                    }}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    PDF出力
                  </button>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                    編集
                  </button>
                </div>
              </div>

              {/* 計画内容表示（簡略版） */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">現在の状況</h3>
                    <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-lg">
                      {selectedPlan.currentSituation || '未記入'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">強み・得意なこと</h3>
                    <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-lg">
                      {selectedPlan.strengths || '未記入'}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-2">長期目標</h3>
                  <div className="space-y-2">
                    {(selectedPlan.longTermGoals || []).map((goal, i) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                        <Target className="w-4 h-4 text-[#00c4cc] mt-0.5" />
                        <div>
                          <span className="text-xs text-gray-500 block">{goal.domain}</span>
                          <span className="text-gray-700">{goal.goal}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-2">短期目標</h3>
                  <div className="space-y-2">
                    {(selectedPlan.shortTermGoals || []).map((goal, i) => (
                      <div key={i} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-xs text-gray-500 block">{goal.domain}</span>
                            <span className="text-gray-700">{goal.goal}</span>
                            {goal.targetDate && (
                              <span className="text-xs text-gray-500 ml-2">
                                （目標: {goal.targetDate}）
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 署名状況 */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">署名状況</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`p-3 rounded-lg ${selectedPlan.parentSignatureUrl ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {selectedPlan.parentSignatureUrl ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium">保護者</span>
                      </div>
                      {selectedPlan.parentSignedAt ? (
                        <span className="text-xs text-gray-500">
                          {new Date(selectedPlan.parentSignedAt).toLocaleDateString('ja-JP')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">未署名</span>
                      )}
                    </div>
                    <div className={`p-3 rounded-lg ${selectedPlan.staffSignatureUrl ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {selectedPlan.staffSignatureUrl ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium">担当者</span>
                      </div>
                      {selectedPlan.staffSignedAt ? (
                        <span className="text-xs text-gray-500">
                          {new Date(selectedPlan.staffSignedAt).toLocaleDateString('ja-JP')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">未署名</span>
                      )}
                    </div>
                    <div className={`p-3 rounded-lg ${selectedPlan.managerSignatureUrl ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {selectedPlan.managerSignatureUrl ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium">管理者</span>
                      </div>
                      {selectedPlan.managerSignedAt ? (
                        <span className="text-xs text-gray-500">
                          {new Date(selectedPlan.managerSignedAt).toLocaleDateString('ja-JP')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">未署名</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // 計画一覧
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h2 className="font-bold text-gray-700">
                  {selectedChildId
                    ? `${children.find(c => c.id === selectedChildId)?.name} さんの支援計画`
                    : '全ての支援計画'}
                </h2>
              </div>
              {filteredPlans.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>支援計画がありません</p>
                  <p className="text-sm mt-1">「新規作成」ボタンから作成してください</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredPlans.map((plan) => {
                    const child = children.find(c => c.id === plan.childId);
                    return (
                      <button
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan)}
                        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-gray-800">{child?.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[plan.status]?.color}`}>
                                {statusLabels[plan.status]?.label}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {plan.periodStart} 〜 {plan.periodEnd}
                              <span className="mx-2">|</span>
                              {plan.planType === 'initial' ? '初回計画' : plan.planType === 'renewal' ? '更新計画' : '計画変更'}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
