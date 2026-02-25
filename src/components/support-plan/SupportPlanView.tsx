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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFacilityData } from '@/hooks/useFacilityData';
import { SupportPlanFile, SupportPlanFileStatus, SupportPlanType } from '@/types';

const STATUS_CONFIG: Record<SupportPlanFileStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'text-gray-500', bg: 'bg-gray-100', icon: Edit3 },
  active: { label: '有効', color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle },
  completed: { label: '完了', color: 'text-gray-600', bg: 'bg-gray-100', icon: CheckCircle },
  archived: { label: 'アーカイブ', color: 'text-gray-400', bg: 'bg-gray-50', icon: Archive },
};

const PLAN_TYPE_LABELS: Record<SupportPlanType, string> = {
  initial: '初回作成',
  renewal: '更新',
  modification: '変更',
};

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

export default function SupportPlanView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const { children } = useFacilityData();

  const [plans, setPlans] = useState<SupportPlanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupportPlanFileStatus | 'all'>('all');
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SupportPlanFile | null>(null);

  // Form state
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
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const activePlans = plans.filter(p => p.status === 'active');
    const childrenWithActivePlan = new Set(activePlans.map(p => p.childId));
    const childrenWithoutPlan = children.filter(c => !childrenWithActivePlan.has(c.id));
    const expiringPlans = activePlans.filter(p => p.periodEnd && p.periodEnd <= in30Days && p.periodEnd >= today);
    return { activePlans: activePlans.length, childrenWithoutPlan: childrenWithoutPlan.length, expiringPlans: expiringPlans.length };
  }, [plans, children]);

  // Group plans by child
  const plansByChild = useMemo(() => {
    const map = new Map<string, SupportPlanFile[]>();
    const filtered = plans.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchTerm) {
        const child = children.find(c => c.id === p.childId);
        if (!child?.name.includes(searchTerm)) return false;
      }
      return true;
    });
    filtered.forEach(p => {
      const existing = map.get(p.childId) || [];
      existing.push(p);
      map.set(p.childId, existing);
    });
    return map;
  }, [plans, children, statusFilter, searchTerm]);

  const getExpiryBadge = (plan: SupportPlanFile) => {
    if (plan.status !== 'active' || !plan.periodEnd) return null;
    const today = new Date();
    const end = new Date(plan.periodEnd);
    const daysUntil = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-medium">期限切れ</span>;
    if (daysUntil <= 7) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-medium">残り{daysUntil}日</span>;
    if (daysUntil <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">残り{daysUntil}日</span>;
    return null;
  };

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
    const updates: any = { updated_at: new Date().toISOString() };
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
    } catch (error) {
      console.error('Error saving evaluation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-cyan-500" />
          <h1 className="text-xl font-bold text-gray-800">個別支援計画</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg"><CheckCircle className="w-5 h-5 text-gray-500" /></div>
            <div>
              <p className="text-sm text-gray-500">有効な計画</p>
              <p className="text-2xl font-bold text-gray-800">{stats.activePlans}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg"><Clock className="w-5 h-5 text-gray-500" /></div>
            <div>
              <p className="text-sm text-gray-500">更新が必要</p>
              <p className="text-2xl font-bold text-gray-800">{stats.expiringPlans}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-gray-500" /></div>
            <div>
              <p className="text-sm text-gray-500">計画未作成の児童</p>
              <p className="text-2xl font-bold text-gray-800">{stats.childrenWithoutPlan}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="児童名で検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'draft', 'active', 'completed', 'archived'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  statusFilter === status ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? '全て' : STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plans by Child */}
      <div className="space-y-3">
        {plansByChild.size === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
            {searchTerm || statusFilter !== 'all' ? '条件に一致する計画がありません' : '個別支援計画がまだ登録されていません'}
          </div>
        ) : (
          Array.from(plansByChild.entries()).map(([childId, childPlans]) => {
            const child = children.find(c => c.id === childId);
            const isExpanded = expandedChildId === childId;
            return (
              <div key={childId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedChildId(isExpanded ? null : childId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="font-medium text-gray-800">{child?.name || '不明な児童'}</span>
                    <span className="text-sm text-gray-500">{childPlans.length}件</span>
                    {childPlans.some(p => p.status === 'active' && p.periodEnd && new Date(p.periodEnd) <= new Date(Date.now() + 30 * 86400000)) && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {childPlans.map(plan => {
                      const statusConf = STATUS_CONFIG[plan.status];
                      const StatusIcon = statusConf.icon;
                      return (
                        <div key={plan.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConf.bg} ${statusConf.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConf.label}
                              </span>
                              <span className="text-sm font-medium text-gray-700">{PLAN_TYPE_LABELS[plan.planType]}</span>
                              {getExpiryBadge(plan)}
                            </div>
                            <div className="flex gap-2">
                              {plan.status === 'draft' && (
                                <button onClick={() => handleStatusChange(plan.id, 'active')} className="text-xs px-3 py-1 bg-teal-500 text-white rounded-lg hover:bg-teal-600">有効にする</button>
                              )}
                              {plan.status === 'active' && (
                                <button onClick={() => handleStatusChange(plan.id, 'completed')} className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">完了にする</button>
                              )}
                              {(plan.status === 'completed') && (
                                <button onClick={() => handleStatusChange(plan.id, 'archived')} className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">アーカイブ</button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">計画期間</span>
                              <p className="font-medium">{plan.periodStart} 〜 {plan.periodEnd}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">作成日</span>
                              <p className="font-medium">{plan.planCreatedDate || '未設定'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">作成者</span>
                              <p className="font-medium">{plan.planCreatorName || '未設定'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">保護者同意</span>
                              <p className="font-medium">{plan.parentAgreed ? `✓ ${plan.parentSignerName || ''}` : '未同意'}</p>
                            </div>
                          </div>
                          {/* Evaluation section */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">中間評価</p>
                              {plan.midEvaluationDate ? (
                                <p className="text-sm">{plan.midEvaluationDate}: {plan.midEvaluationNote || ''}</p>
                              ) : (
                                <button
                                  onClick={() => {
                                    const date = prompt('中間評価日 (YYYY-MM-DD)');
                                    const note = prompt('中間評価メモ');
                                    if (date) handleSaveEvaluation(plan.id, 'mid', date, note || '');
                                  }}
                                  className="text-xs text-cyan-600 hover:underline"
                                >
                                  + 中間評価を記録
                                </button>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">最終評価</p>
                              {plan.finalEvaluationDate ? (
                                <p className="text-sm">{plan.finalEvaluationDate}: {plan.finalEvaluationNote || ''}</p>
                              ) : (
                                <button
                                  onClick={() => {
                                    const date = prompt('最終評価日 (YYYY-MM-DD)');
                                    const note = prompt('最終評価メモ');
                                    if (date) handleSaveEvaluation(plan.id, 'final', date, note || '');
                                  }}
                                  className="text-xs text-cyan-600 hover:underline"
                                >
                                  + 最終評価を記録
                                </button>
                              )}
                            </div>
                          </div>
                          {plan.notes && <p className="text-sm text-gray-500">{plan.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">新規支援計画作成</h2>
              <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">児童 *</label>
                <select value={formData.childId} onChange={e => setFormData(prev => ({ ...prev, childId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">選択してください</option>
                  {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">計画種別</label>
                <select value={formData.planType} onChange={e => setFormData(prev => ({ ...prev, planType: e.target.value as SupportPlanType }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">期間開始 *</label>
                  <input type="date" value={formData.periodStart} onChange={e => setFormData(prev => ({ ...prev, periodStart: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">期間終了 *</label>
                  <input type="date" value={formData.periodEnd} onChange={e => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">作成者名</label>
                <input type="text" value={formData.planCreatorName} onChange={e => setFormData(prev => ({ ...prev, planCreatorName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="児童発達支援管理責任者名" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
              <button onClick={handleCreatePlan} disabled={!formData.childId || !formData.periodStart || !formData.periodEnd} className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed">作成</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
