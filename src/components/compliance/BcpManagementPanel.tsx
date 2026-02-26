'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  Users,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ---- Local types ----
type PlanType = 'earthquake' | 'flood' | 'pandemic' | 'fire';
type PlanStatus = 'draft' | 'active' | 'archived';

interface BcpPlan {
  id: string;
  planType: PlanType;
  title: string;
  content: Record<string, unknown>;
  version: string | null;
  status: PlanStatus;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EmergencyContact {
  id: string;
  bcpPlanId: string | null;
  contactName: string;
  role: string;
  phone: string;
  email: string;
  priority: number;
}

interface DrillRecord {
  id: string;
  title: string;
  content: {
    date?: string;
    description?: string;
    participantsCount?: number;
    notes?: string;
  };
  date: string | null;
  createdAt: string;
}

interface PlanForm {
  planType: PlanType;
  title: string;
  content: string;
  nextReviewDate: string;
  status: PlanStatus;
}

interface ContactForm {
  contactName: string;
  role: string;
  phone: string;
  email: string;
  priority: number;
}

interface DrillForm {
  date: string;
  description: string;
  participantsCount: string;
  notes: string;
}

const ACCENT = '#00c4cc';

const PLAN_TYPE_CONFIG: Record<PlanType, { label: string; icon: string; color: string; bg: string }> = {
  earthquake: { label: '地震', icon: '\uD83C\uDFDA\uFE0F', color: 'text-orange-700', bg: 'bg-orange-50' },
  flood: { label: '風水害', icon: '\uD83C\uDF0A', color: 'text-blue-700', bg: 'bg-blue-50' },
  pandemic: { label: '感染症', icon: '\uD83E\uDDA0', color: 'text-purple-700', bg: 'bg-purple-50' },
  fire: { label: '火災', icon: '\uD83D\uDD25', color: 'text-red-700', bg: 'bg-red-50' },
};

const STATUS_CONFIG: Record<PlanStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'text-gray-600', bg: 'bg-gray-100' },
  active: { label: '有効', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  archived: { label: 'アーカイブ', color: 'text-amber-700', bg: 'bg-amber-50' },
};

const BcpManagementPanel: React.FC = () => {
  const { facility, user } = useAuth();

  const [plans, setPlans] = useState<BcpPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>({
    planType: 'earthquake',
    title: '',
    content: '',
    nextReviewDate: '',
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);

  // Expanded plan (for contacts + drills)
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [drills, setDrills] = useState<DrillRecord[]>([]);

  // Contact modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>({
    contactName: '',
    role: '',
    phone: '',
    email: '',
    priority: 0,
  });

  // Drill modal
  const [showDrillModal, setShowDrillModal] = useState(false);
  const [drillForm, setDrillForm] = useState<DrillForm>({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    participantsCount: '',
    notes: '',
  });

  // ---- Fetch plans ----
  const fetchPlans = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('bcp_plans')
        .select('*')
        .eq('facility_id', facility.id)
        .neq('plan_type', 'drill_record')
        .order('created_at', { ascending: false });

      setPlans(
        (data || []).map((d) => ({
          id: d.id,
          planType: d.plan_type as PlanType,
          title: d.title,
          content: (typeof d.content === 'object' && d.content !== null ? d.content : {}) as Record<string, unknown>,
          version: d.version,
          status: d.status as PlanStatus,
          lastReviewedAt: d.last_reviewed_at,
          nextReviewDate: d.next_review_date,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }))
      );
    } catch (err) {
      console.error('Error fetching BCP plans:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // ---- Fetch contacts + drills for expanded plan ----
  const fetchPlanDetails = useCallback(async (planId: string) => {
    if (!facility?.id) return;
    // Contacts
    const { data: contactData } = await supabase
      .from('bcp_emergency_contacts')
      .select('*')
      .eq('bcp_plan_id', planId)
      .order('priority');

    setContacts(
      (contactData || []).map((c) => ({
        id: c.id,
        bcpPlanId: c.bcp_plan_id,
        contactName: c.contact_name,
        role: c.role || '',
        phone: c.phone || '',
        email: c.email || '',
        priority: c.priority || 0,
      }))
    );

    // Drill records (stored as bcp_plans with plan_type='drill_record' and content.parent_plan_id)
    const { data: drillData } = await supabase
      .from('bcp_plans')
      .select('*')
      .eq('facility_id', facility.id)
      .eq('plan_type', 'drill_record')
      .order('created_at', { ascending: false });

    // Filter drills that belong to this plan (via content.parent_plan_id)
    const planDrills = (drillData || []).filter((d) => {
      const c = d.content as Record<string, unknown> | null;
      return c && c.parent_plan_id === planId;
    });

    setDrills(
      planDrills.map((d) => ({
        id: d.id,
        title: d.title,
        content: (typeof d.content === 'object' && d.content !== null ? d.content : {}) as DrillRecord['content'],
        date: d.next_review_date,
        createdAt: d.created_at,
      }))
    );
  }, [facility?.id]);

  useEffect(() => {
    if (expandedPlanId) {
      fetchPlanDetails(expandedPlanId);
    }
  }, [expandedPlanId, fetchPlanDetails]);

  // ---- Plan CRUD ----
  const openCreatePlan = () => {
    setEditingPlanId(null);
    setPlanForm({
      planType: 'earthquake',
      title: '',
      content: '',
      nextReviewDate: '',
      status: 'draft',
    });
    setShowPlanModal(true);
  };

  const openEditPlan = (plan: BcpPlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      planType: plan.planType,
      title: plan.title,
      content: (plan.content.text as string) || '',
      nextReviewDate: plan.nextReviewDate || '',
      status: plan.status,
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!facility?.id || !planForm.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        facility_id: facility.id,
        plan_type: planForm.planType,
        title: planForm.title,
        content: { text: planForm.content },
        status: planForm.status,
        next_review_date: planForm.nextReviewDate || null,
        updated_at: new Date().toISOString(),
      };

      if (editingPlanId) {
        await supabase.from('bcp_plans').update(payload).eq('id', editingPlanId);
      } else {
        await supabase.from('bcp_plans').insert({
          ...payload,
          created_by: user?.id || null,
        });
      }
      setShowPlanModal(false);
      fetchPlans();
    } catch (err) {
      console.error('Error saving BCP plan:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('このBCP計画を削除してもよろしいですか？')) return;
    await supabase.from('bcp_plans').delete().eq('id', id);
    if (expandedPlanId === id) setExpandedPlanId(null);
    fetchPlans();
  };

  // ---- Contact CRUD ----
  const openCreateContact = () => {
    setEditingContactId(null);
    setContactForm({ contactName: '', role: '', phone: '', email: '', priority: contacts.length });
    setShowContactModal(true);
  };

  const openEditContact = (c: EmergencyContact) => {
    setEditingContactId(c.id);
    setContactForm({
      contactName: c.contactName,
      role: c.role,
      phone: c.phone,
      email: c.email,
      priority: c.priority,
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!facility?.id || !expandedPlanId || !contactForm.contactName.trim()) return;
    try {
      const payload = {
        facility_id: facility.id,
        bcp_plan_id: expandedPlanId,
        contact_name: contactForm.contactName,
        role: contactForm.role || null,
        phone: contactForm.phone || null,
        email: contactForm.email || null,
        priority: contactForm.priority,
      };

      if (editingContactId) {
        await supabase.from('bcp_emergency_contacts').update(payload).eq('id', editingContactId);
      } else {
        await supabase.from('bcp_emergency_contacts').insert(payload);
      }
      setShowContactModal(false);
      fetchPlanDetails(expandedPlanId);
    } catch (err) {
      console.error('Error saving contact:', err);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('この連絡先を削除しますか？')) return;
    await supabase.from('bcp_emergency_contacts').delete().eq('id', id);
    if (expandedPlanId) fetchPlanDetails(expandedPlanId);
  };

  // ---- Drill CRUD ----
  const openCreateDrill = () => {
    setDrillForm({
      date: new Date().toISOString().slice(0, 10),
      description: '',
      participantsCount: '',
      notes: '',
    });
    setShowDrillModal(true);
  };

  const handleSaveDrill = async () => {
    if (!facility?.id || !expandedPlanId) return;
    try {
      await supabase.from('bcp_plans').insert({
        facility_id: facility.id,
        plan_type: 'drill_record',
        title: `避難訓練 ${drillForm.date}`,
        content: {
          parent_plan_id: expandedPlanId,
          date: drillForm.date,
          description: drillForm.description,
          participantsCount: parseInt(drillForm.participantsCount) || 0,
          notes: drillForm.notes,
        },
        status: 'active',
        next_review_date: drillForm.date,
        created_by: user?.id || null,
      });
      setShowDrillModal(false);
      fetchPlanDetails(expandedPlanId);
    } catch (err) {
      console.error('Error saving drill record:', err);
    }
  };

  const handleDeleteDrill = async (id: string) => {
    if (!confirm('この訓練記録を削除しますか？')) return;
    await supabase.from('bcp_plans').delete().eq('id', id);
    if (expandedPlanId) fetchPlanDetails(expandedPlanId);
  };

  // ---- Helpers ----
  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ja-JP');
  };

  const isReviewSoon = (nextReview: string | null) => {
    if (!nextReview) return false;
    const diff = new Date(nextReview).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  const isReviewOverdue = (nextReview: string | null) => {
    if (!nextReview) return false;
    return new Date(nextReview).getTime() < Date.now();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">事業継続計画（BCP）の策定・管理と避難訓練記録</p>
        <button
          onClick={openCreatePlan}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={16} />
          BCP計画を追加
        </button>
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">BCP計画がまだ登録されていません</p>
          <button onClick={openCreatePlan} className="mt-3 text-sm font-medium" style={{ color: ACCENT }}>
            最初の計画を作成する
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const typeConf = PLAN_TYPE_CONFIG[plan.planType] || PLAN_TYPE_CONFIG.earthquake;
            const statusConf = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft;
            const isExpanded = expandedPlanId === plan.id;
            const reviewSoon = isReviewSoon(plan.nextReviewDate);
            const reviewOverdue = isReviewOverdue(plan.nextReviewDate);

            return (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Plan card header */}
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                >
                  <span className="text-2xl">{typeConf.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-800 text-sm">{plan.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeConf.bg} ${typeConf.color}`}>
                        {typeConf.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      {plan.lastReviewedAt && (
                        <span>最終レビュー: {formatDate(plan.lastReviewedAt)}</span>
                      )}
                      {plan.nextReviewDate && (
                        <span className={`flex items-center gap-1 ${reviewOverdue ? 'text-red-500 font-medium' : reviewSoon ? 'text-amber-600 font-medium' : ''}`}>
                          {(reviewOverdue || reviewSoon) && <AlertCircle size={11} />}
                          次回レビュー: {formatDate(plan.nextReviewDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditPlan(plan); }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Plan content preview */}
                    {typeof plan.content.text === 'string' && plan.content.text && (
                      <div className="px-4 py-3 bg-gray-50">
                        <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-4">
                          {plan.content.text}
                        </p>
                      </div>
                    )}

                    {/* Emergency contacts */}
                    <div className="p-4 border-t border-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                          <Phone size={14} />
                          緊急連絡先
                        </h4>
                        <button
                          onClick={openCreateContact}
                          className="text-xs font-medium flex items-center gap-1"
                          style={{ color: ACCENT }}
                        >
                          <Plus size={13} /> 追加
                        </button>
                      </div>
                      {contacts.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">連絡先が登録されていません</p>
                      ) : (
                        <div className="space-y-1">
                          {contacts.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group">
                              <span className="text-xs font-medium text-gray-400 w-5">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700 font-medium">{c.contactName}</span>
                                {c.role && <span className="text-xs text-gray-400 ml-2">{c.role}</span>}
                              </div>
                              {c.phone && (
                                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                  <Phone size={10} /> {c.phone}
                                </span>
                              )}
                              {c.email && (
                                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                  <Mail size={10} /> {c.email}
                                </span>
                              )}
                              <div className="hidden group-hover:flex items-center gap-0.5">
                                <button onClick={() => openEditContact(c)} className="p-1 text-gray-400 hover:text-gray-600">
                                  <Edit3 size={12} />
                                </button>
                                <button onClick={() => handleDeleteContact(c.id)} className="p-1 text-gray-400 hover:text-red-500">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Evacuation drill records */}
                    <div className="p-4 border-t border-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                          <Users size={14} />
                          避難訓練記録
                        </h4>
                        <button
                          onClick={openCreateDrill}
                          className="text-xs font-medium flex items-center gap-1"
                          style={{ color: ACCENT }}
                        >
                          <Plus size={13} /> 追加
                        </button>
                      </div>
                      {drills.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">訓練記録がありません</p>
                      ) : (
                        <div className="space-y-2">
                          {drills.map((d) => (
                            <div key={d.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 group">
                              <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">
                                    {d.content.date || formatDate(d.date)}
                                  </span>
                                  {d.content.participantsCount && (
                                    <span className="text-xs text-gray-400">
                                      参加者: {d.content.participantsCount}名
                                    </span>
                                  )}
                                </div>
                                {d.content.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">{d.content.description}</p>
                                )}
                                {d.content.notes && (
                                  <p className="text-xs text-gray-400 mt-0.5">{d.content.notes}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteDrill(d.id)}
                                className="hidden group-hover:block p-1 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Create/Edit Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {editingPlanId ? 'BCP計画を編集' : 'BCP計画を作成'}
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Plan type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(PLAN_TYPE_CONFIG) as [PlanType, typeof PLAN_TYPE_CONFIG[PlanType]][]).map(([key, conf]) => (
                    <button
                      key={key}
                      onClick={() => setPlanForm({ ...planForm, planType: key })}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                        planForm.planType === key
                          ? 'border-[#00c4cc] bg-[#00c4cc]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{conf.icon}</span>
                      <span className="text-xs font-medium text-gray-600">{conf.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
                <input
                  type="text"
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  placeholder="地震対応BCP計画"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea
                  value={planForm.content}
                  onChange={(e) => setPlanForm({ ...planForm, content: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  placeholder="計画の詳細内容..."
                />
              </div>

              {/* Next review + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">次回レビュー日</label>
                  <input
                    type="date"
                    value={planForm.nextReviewDate}
                    onChange={(e) => setPlanForm({ ...planForm, nextReviewDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                  <div className="relative">
                    <select
                      value={planForm.status}
                      onChange={(e) => setPlanForm({ ...planForm, status: e.target.value as PlanStatus })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc] appearance-none"
                    >
                      <option value="draft">下書き</option>
                      <option value="active">有効</option>
                      <option value="archived">アーカイブ</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                キャンセル
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving || !planForm.title.trim()}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                {saving ? '保存中...' : editingPlanId ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Create/Edit Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm">
                {editingContactId ? '連絡先を編集' : '連絡先を追加'}
              </h3>
              <button onClick={() => setShowContactModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
                <input
                  type="text"
                  value={contactForm.contactName}
                  onChange={(e) => setContactForm({ ...contactForm, contactName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">役割</label>
                <input
                  type="text"
                  value={contactForm.role}
                  onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                  placeholder="施設長、防災担当 等"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">電話番号</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">メール</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">優先順位</label>
                <input
                  type="number"
                  min="0"
                  value={contactForm.priority}
                  onChange={(e) => setContactForm({ ...contactForm, priority: parseInt(e.target.value) || 0 })}
                  className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowContactModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                キャンセル
              </button>
              <button
                onClick={handleSaveContact}
                disabled={!contactForm.contactName.trim()}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                {editingContactId ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill Create Modal */}
      {showDrillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm">避難訓練を記録</h3>
              <button onClick={() => setShowDrillModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">実施日</label>
                  <input
                    type="date"
                    value={drillForm.date}
                    onChange={(e) => setDrillForm({ ...drillForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">参加者数</label>
                  <input
                    type="number"
                    min="0"
                    value={drillForm.participantsCount}
                    onChange={(e) => setDrillForm({ ...drillForm, participantsCount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">内容</label>
                <textarea
                  value={drillForm.description}
                  onChange={(e) => setDrillForm({ ...drillForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                  placeholder="訓練の概要..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={drillForm.notes}
                  onChange={(e) => setDrillForm({ ...drillForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30"
                  placeholder="改善点・気付きなど..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowDrillModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                キャンセル
              </button>
              <button
                onClick={handleSaveDrill}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium"
                style={{ backgroundColor: ACCENT }}
              >
                記録する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BcpManagementPanel;
