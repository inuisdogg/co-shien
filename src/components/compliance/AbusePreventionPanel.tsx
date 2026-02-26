'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Users,
  FileText,
  ChevronDown,
  ClipboardCheck,
  Target,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ---- Local types ----
type RecordType = 'committee_meeting' | 'restraint_committee' | 'self_check' | 'annual_plan';

interface AbuseRecord {
  id: string;
  recordType: RecordType;
  title: string;
  content: Record<string, unknown>;
  date: string | null;
  participants: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface RecordForm {
  recordType: RecordType;
  title: string;
  date: string;
  participants: string;
  agenda: string;
  minutes: string;
  actionItems: string;
  status: string;
  // for self_check
  checkItems: string;
  // for annual_plan
  goals: string;
  schedule: string;
  responsiblePersons: string;
}

const ACCENT = '#00c4cc';

type SectionId = 'committee' | 'restraint' | 'self_check' | 'annual_plan';

const SECTIONS: { id: SectionId; label: string; recordType: RecordType; icon: React.ElementType; description: string }[] = [
  {
    id: 'committee',
    label: '虐待防止委員会',
    recordType: 'committee_meeting',
    icon: Users,
    description: '四半期ごとの開催が必要です',
  },
  {
    id: 'restraint',
    label: '身体拘束適正化委員会',
    recordType: 'restraint_committee',
    icon: ClipboardCheck,
    description: '四半期ごとの開催が必要です',
  },
  {
    id: 'self_check',
    label: 'スタッフ自己点検',
    recordType: 'self_check',
    icon: CheckCircle,
    description: '年1回の自己評価実施',
  },
  {
    id: 'annual_plan',
    label: '年間計画',
    recordType: 'annual_plan',
    icon: Target,
    description: '虐待防止に関する年間計画の策定',
  },
];

const AbusePreventionPanel: React.FC = () => {
  const { facility, user } = useAuth();

  const [records, setRecords] = useState<AbuseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>('committee');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecordForm>({
    recordType: 'committee_meeting',
    title: '',
    date: new Date().toISOString().slice(0, 10),
    participants: '',
    agenda: '',
    minutes: '',
    actionItems: '',
    status: 'draft',
    checkItems: '',
    goals: '',
    schedule: '',
    responsiblePersons: '',
  });
  const [saving, setSaving] = useState(false);

  // ---- Fetch ----
  const fetchRecords = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('abuse_prevention_records')
        .select('*')
        .eq('facility_id', facility.id)
        .order('date', { ascending: false });

      setRecords(
        (data || []).map((d) => ({
          id: d.id,
          recordType: d.record_type as RecordType,
          title: d.title,
          content: (typeof d.content === 'object' && d.content !== null ? d.content : {}) as Record<string, unknown>,
          date: d.date,
          participants: Array.isArray(d.participants) ? d.participants as string[] : [],
          status: d.status || 'draft',
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }))
      );
    } catch (err) {
      console.error('Error fetching abuse prevention records:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ---- Filtered records for active section ----
  const currentSection = SECTIONS.find((s) => s.id === activeSection)!;
  const sectionRecords = records.filter((r) => r.recordType === currentSection.recordType);

  // ---- Committee schedule compliance check ----
  const getQuarterlyStatus = (recordType: RecordType) => {
    const typeRecords = records
      .filter((r) => r.recordType === recordType && r.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    if (typeRecords.length === 0) return { status: 'overdue' as const, message: '未実施' };

    const latestDate = new Date(typeRecords[0].date!);
    const now = new Date();
    const monthsSince = (now.getFullYear() - latestDate.getFullYear()) * 12 + (now.getMonth() - latestDate.getMonth());

    if (monthsSince > 3) return { status: 'overdue' as const, message: `${monthsSince}ヶ月経過` };
    if (monthsSince >= 2) return { status: 'warning' as const, message: `次回開催まであと${3 - monthsSince}ヶ月以内` };
    return { status: 'ok' as const, message: '期限内' };
  };

  // ---- CRUD ----
  const openCreate = () => {
    setEditingId(null);
    setForm({
      recordType: currentSection.recordType,
      title: '',
      date: new Date().toISOString().slice(0, 10),
      participants: '',
      agenda: '',
      minutes: '',
      actionItems: '',
      status: 'draft',
      checkItems: '',
      goals: '',
      schedule: '',
      responsiblePersons: '',
    });
    setShowModal(true);
  };

  const openEdit = (rec: AbuseRecord) => {
    setEditingId(rec.id);
    const c = rec.content;
    setForm({
      recordType: rec.recordType,
      title: rec.title,
      date: rec.date || '',
      participants: rec.participants.join(', '),
      agenda: (c.agenda as string) || '',
      minutes: (c.minutes as string) || '',
      actionItems: (c.action_items as string) || '',
      status: rec.status,
      checkItems: (c.check_items as string) || '',
      goals: (c.goals as string) || '',
      schedule: (c.schedule as string) || '',
      responsiblePersons: (c.responsible_persons as string) || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!facility?.id || !form.title.trim()) return;
    setSaving(true);
    try {
      const content: Record<string, unknown> = {};

      if (form.recordType === 'committee_meeting' || form.recordType === 'restraint_committee') {
        content.agenda = form.agenda;
        content.minutes = form.minutes;
        content.action_items = form.actionItems;
      } else if (form.recordType === 'self_check') {
        content.check_items = form.checkItems;
      } else if (form.recordType === 'annual_plan') {
        content.goals = form.goals;
        content.schedule = form.schedule;
        content.responsible_persons = form.responsiblePersons;
      }

      const participants = form.participants
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const payload = {
        facility_id: facility.id,
        record_type: form.recordType,
        title: form.title,
        content,
        date: form.date || null,
        participants,
        status: form.status,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        await supabase.from('abuse_prevention_records').update(payload).eq('id', editingId);
      } else {
        await supabase.from('abuse_prevention_records').insert({
          ...payload,
          created_by: user?.id || null,
        });
      }
      setShowModal(false);
      fetchRecords();
    } catch (err) {
      console.error('Error saving record:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この記録を削除してもよろしいですか？')) return;
    await supabase.from('abuse_prevention_records').delete().eq('id', id);
    fetchRecords();
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ja-JP');
  };

  // ---- Form fields by record type ----
  const renderFormFields = () => {
    if (form.recordType === 'committee_meeting' || form.recordType === 'restraint_committee') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">議題</label>
            <textarea
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              placeholder="検討議題..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">議事録</label>
            <textarea
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              placeholder="議事内容..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">アクションアイテム</label>
            <textarea
              value={form.actionItems}
              onChange={(e) => setForm({ ...form, actionItems: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              placeholder="次回までの対応事項..."
            />
          </div>
        </>
      );
    }

    if (form.recordType === 'self_check') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">チェック項目・結果</label>
          <textarea
            value={form.checkItems}
            onChange={(e) => setForm({ ...form, checkItems: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
            placeholder="自己点検の項目と結果を記録..."
          />
        </div>
      );
    }

    if (form.recordType === 'annual_plan') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目標</label>
            <textarea
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              placeholder="年間の目標..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">スケジュール</label>
            <textarea
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              placeholder="年間スケジュール..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
            <input
              type="text"
              value={form.responsiblePersons}
              onChange={(e) => setForm({ ...form, responsiblePersons: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
              placeholder="担当者名（カンマ区切り）"
            />
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const isQuarterly = section.recordType === 'committee_meeting' || section.recordType === 'restraint_committee';
          const qStatus = isQuarterly ? getQuarterlyStatus(section.recordType) : null;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                isActive
                  ? 'border-[#00c4cc] bg-[#00c4cc]/5'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={isActive ? 'text-[#00c4cc]' : 'text-gray-400'} />
                <span className={`text-sm font-bold ${isActive ? 'text-[#00c4cc]' : 'text-gray-700'}`}>
                  {section.label}
                </span>
              </div>
              <p className="text-[10px] text-gray-400">{section.description}</p>
              {qStatus && (
                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-medium ${
                  qStatus.status === 'overdue' ? 'text-red-600' :
                  qStatus.status === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {qStatus.status === 'ok' ? <CheckCircle size={10} /> :
                   qStatus.status === 'warning' ? <Clock size={10} /> :
                   <AlertCircle size={10} />}
                  {qStatus.message}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Records for current section */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">{currentSection.label}</h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={14} />
          記録を追加
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
        </div>
      ) : sectionRecords.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <FileText size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">記録がありません</p>
          <button onClick={openCreate} className="mt-2 text-xs font-medium" style={{ color: ACCENT }}>
            最初の記録を追加する
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sectionRecords.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-gray-800 text-sm">{rec.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      rec.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      rec.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {rec.status === 'completed' ? '完了' : rec.status === 'draft' ? '下書き' : rec.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {rec.date && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {formatDate(rec.date)}
                      </span>
                    )}
                    {rec.participants.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {rec.participants.length}名
                      </span>
                    )}
                  </div>

                  {/* Content preview */}
                  {(rec.content.agenda || rec.content.goals || rec.content.check_items) ? (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {String(rec.content.agenda ?? rec.content.goals ?? rec.content.check_items ?? '')}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(rec)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(rec.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {editingId ? '記録を編集' : '記録を追加'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  placeholder={
                    form.recordType === 'committee_meeting' ? '第X回 虐待防止委員会' :
                    form.recordType === 'restraint_committee' ? '第X回 身体拘束適正化委員会' :
                    form.recordType === 'self_check' ? '20XX年度 スタッフ自己点検' :
                    '20XX年度 虐待防止年間計画'
                  }
                />
              </div>

              {/* Date + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc] appearance-none"
                    >
                      <option value="draft">下書き</option>
                      <option value="completed">完了</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Participants (for committee types) */}
              {(form.recordType === 'committee_meeting' || form.recordType === 'restraint_committee') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">参加者</label>
                  <input
                    type="text"
                    value={form.participants}
                    onChange={(e) => setForm({ ...form, participants: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                    placeholder="氏名（カンマ区切り）"
                  />
                </div>
              )}

              {/* Dynamic fields based on record type */}
              {renderFormFields()}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                {saving ? '保存中...' : editingId ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbusePreventionPanel;
