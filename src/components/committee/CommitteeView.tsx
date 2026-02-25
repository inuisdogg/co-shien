'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  CheckCircle,
  Clock,
  FileText,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type CommitteeType = 'operation_promotion' | 'abuse_prevention' | 'restraint_review' | 'safety' | 'infection_control' | 'quality_improvement' | 'other';
type MeetingType = 'regular' | 'extraordinary';
type MeetingStatus = 'draft' | 'finalized' | 'approved';

interface CommitteeMeeting {
  id: string;
  facilityId: string;
  committeeType: CommitteeType;
  committeeName: string;
  meetingDate: string;
  location: string | null;
  meetingType: MeetingType;
  attendees: any[];
  agenda: any[];
  decisions: string | null;
  actionItems: any[];
  reports: string | null;
  status: MeetingStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const COMMITTEE_TYPE_LABELS: Record<CommitteeType, string> = {
  operation_promotion: '運営推進会議',
  abuse_prevention: '虐待防止委員会',
  restraint_review: '身体拘束適正化委員会',
  safety: '安全委員会',
  infection_control: '感染症対策委員会',
  quality_improvement: '質の改善委員会',
  other: 'その他',
};

// Committee requirements based on committeeTracker.ts logic
const COMMITTEE_REQUIREMENTS: {
  type: CommitteeType;
  name: string;
  frequency: 'quarterly' | 'biannual' | 'annual';
  frequencyLabel: string;
}[] = [
  { type: 'abuse_prevention', name: '虐待防止委員会', frequency: 'quarterly', frequencyLabel: '四半期' },
  { type: 'restraint_review', name: '身体拘束適正化委員会', frequency: 'quarterly', frequencyLabel: '四半期' },
  { type: 'operation_promotion', name: '運営推進会議', frequency: 'biannual', frequencyLabel: '半年' },
  { type: 'safety', name: '安全委員会', frequency: 'annual', frequencyLabel: '年次' },
  { type: 'infection_control', name: '感染症対策委員会', frequency: 'annual', frequencyLabel: '年次' },
  { type: 'quality_improvement', name: '質の改善委員会', frequency: 'annual', frequencyLabel: '年次' },
];

const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
  finalized: { label: '確定', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText },
  approved: { label: '承認済', color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle },
};

interface NewMeetingForm {
  committeeType: CommitteeType;
  meetingDate: string;
  location: string;
  attendeesText: string;
  agendaText: string;
  decisions: string;
}

const INITIAL_FORM: NewMeetingForm = {
  committeeType: 'abuse_prevention',
  meetingDate: new Date().toISOString().split('T')[0],
  location: '',
  attendeesText: '',
  agendaText: '',
  decisions: '',
};

function mapRow(row: any): CommitteeMeeting {
  return {
    id: row.id,
    facilityId: row.facility_id,
    committeeType: row.committee_type,
    committeeName: row.committee_name || COMMITTEE_TYPE_LABELS[row.committee_type as CommitteeType] || row.committee_type,
    meetingDate: row.meeting_date,
    location: row.location,
    meetingType: row.meeting_type || 'regular',
    attendees: row.attendees || [],
    agenda: row.agenda || [],
    decisions: row.decisions,
    actionItems: row.action_items || [],
    reports: row.reports,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Compute the period range for a given committee frequency */
function getPeriodRange(frequency: 'quarterly' | 'biannual' | 'annual', now: Date): { start: string; end: string } {
  if (frequency === 'quarterly') {
    const quarter = Math.floor(now.getMonth() / 3);
    const startMonth = quarter * 3;
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end = new Date(now.getFullYear(), startMonth + 3, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }
  if (frequency === 'biannual') {
    const half = now.getMonth() < 6 ? 0 : 1;
    const startMonth = half * 6;
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end = new Date(now.getFullYear(), startMonth + 6, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }
  // annual
  return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
}

export default function CommitteeView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [meetings, setMeetings] = useState<CommitteeMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<CommitteeType | 'all'>('all');
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  // Meeting creation form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMeeting, setNewMeeting] = useState<NewMeetingForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchMeetings = useCallback(async () => {
    if (!facilityId) return;
    try {
      const { data, error } = await supabase
        .from('committee_meetings')
        .select('*')
        .eq('facility_id', facilityId)
        .order('meeting_date', { ascending: false });
      if (error) {
        console.error('Error fetching committee meetings:', error);
        return;
      }
      if (data) setMeetings(data.map(mapRow));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Committee overview: compute status for each required committee type
  const committeeOverview = useMemo(() => {
    const now = new Date();
    return COMMITTEE_REQUIREMENTS.map(req => {
      const range = getPeriodRange(req.frequency, now);
      const meetingsInPeriod = meetings.filter(
        m => m.committeeType === req.type && m.meetingDate >= range.start && m.meetingDate <= range.end
      );
      const lastMeeting = meetings
        .filter(m => m.committeeType === req.type)
        .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))[0];

      const nextDueDate = range.end;
      const daysUntilDue = Math.ceil((new Date(nextDueDate).getTime() - now.getTime()) / 86400000);
      const isOk = meetingsInPeriod.length >= 1;
      const isOverdue = !isOk && daysUntilDue <= 14;

      return {
        ...req,
        lastMeetingDate: lastMeeting?.meetingDate || null,
        meetingsInPeriod: meetingsInPeriod.length,
        nextDueDate,
        daysUntilDue,
        status: isOk ? 'ok' as const : isOverdue ? 'overdue' as const : 'upcoming' as const,
      };
    });
  }, [meetings]);

  const stats = useMemo(() => {
    const total = meetings.length;
    const thisYear = meetings.filter(m => m.meetingDate.startsWith(String(new Date().getFullYear()))).length;
    const approved = meetings.filter(m => m.status === 'approved').length;
    const types = new Set(meetings.map(m => m.committeeType)).size;
    return { total, thisYear, approved, types };
  }, [meetings]);

  const filtered = useMemo(() => {
    if (selectedType === 'all') return meetings;
    return meetings.filter(m => m.committeeType === selectedType);
  }, [meetings, selectedType]);

  const handleCreateMeeting = async () => {
    if (!facilityId || !newMeeting.meetingDate || !newMeeting.committeeType) return;

    setSubmitting(true);
    try {
      const attendees = newMeeting.attendeesText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const agenda = newMeeting.agendaText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('committee_meetings')
        .insert({
          facility_id: facilityId,
          committee_type: newMeeting.committeeType,
          committee_name: COMMITTEE_TYPE_LABELS[newMeeting.committeeType],
          meeting_date: newMeeting.meetingDate,
          location: newMeeting.location || null,
          meeting_type: 'regular',
          attendees,
          agenda,
          decisions: newMeeting.decisions || null,
          action_items: [],
          reports: null,
          status: 'draft',
        });

      if (error) {
        console.error('Error creating meeting:', error);
        alert('会議の作成に失敗しました: ' + error.message);
        return;
      }

      // Reset form and refetch
      setNewMeeting(INITIAL_FORM);
      setShowCreateForm(false);
      await fetchMeetings();
    } catch (error) {
      console.error('Error:', error);
      alert('会議の作成に失敗しました');
    } finally {
      setSubmitting(false);
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
          <Users className="w-6 h-6 text-cyan-500" />
          <h1 className="text-xl font-bold text-gray-800">委員会管理</h1>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreateForm ? '閉じる' : '新規会議を作成'}
        </button>
      </div>

      {/* Meeting Creation Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="font-bold text-gray-800 text-base">新規会議を作成</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">委員会種別</label>
              <select
                value={newMeeting.committeeType}
                onChange={e => setNewMeeting(prev => ({ ...prev, committeeType: e.target.value as CommitteeType }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="abuse_prevention">虐待防止委員会</option>
                <option value="restraint_review">身体拘束適正化委員会</option>
                <option value="operation_promotion">運営推進会議</option>
                <option value="safety">安全委員会</option>
                <option value="infection_control">感染対策委員会</option>
                <option value="quality_improvement">質の改善委員会</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">開催日</label>
              <input
                type="date"
                value={newMeeting.meetingDate}
                onChange={e => setNewMeeting(prev => ({ ...prev, meetingDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">開催場所</label>
              <input
                type="text"
                value={newMeeting.location}
                onChange={e => setNewMeeting(prev => ({ ...prev, location: e.target.value }))}
                placeholder="例: 2F会議室"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">出席者（1行に1名）</label>
              <textarea
                value={newMeeting.attendeesText}
                onChange={e => setNewMeeting(prev => ({ ...prev, attendeesText: e.target.value }))}
                placeholder={"山田太郎\n佐藤花子\n田中一郎"}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">議題（1行に1件）</label>
              <textarea
                value={newMeeting.agendaText}
                onChange={e => setNewMeeting(prev => ({ ...prev, agendaText: e.target.value }))}
                placeholder={"前回議事録の確認\n事故報告の検討\n次回の日程調整"}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">決定事項</label>
              <textarea
                value={newMeeting.decisions}
                onChange={e => setNewMeeting(prev => ({ ...prev, decisions: e.target.value }))}
                placeholder="会議で決定した事項を記入"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowCreateForm(false); setNewMeeting(INITIAL_FORM); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleCreateMeeting}
              disabled={submitting || !newMeeting.meetingDate}
              className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              下書きとして保存
            </button>
          </div>
        </div>
      )}

      {/* Committee Overview Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            委員会開催状況
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {committeeOverview.map(item => (
            <div key={item.type} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  item.status === 'ok' ? 'bg-green-500' : item.status === 'overdue' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">
                    頻度: {item.frequencyLabel}
                    {item.lastMeetingDate && ` / 最終開催: ${item.lastMeetingDate}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400">
                  期限: {item.nextDueDate}
                </span>
                {item.status === 'ok' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 font-medium">
                    <CheckCircle className="w-3 h-3" />
                    OK
                  </span>
                ) : item.status === 'overdue' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    要開催
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-50 text-yellow-700 font-medium">
                    <Clock className="w-3 h-3" />
                    要開催
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">総開催数</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">今年度</p>
          <p className="text-2xl font-bold text-gray-800">{stats.thisYear}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">承認済み</p>
          <p className="text-2xl font-bold text-gray-800">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">委員会種別</p>
          <p className="text-2xl font-bold text-gray-800">{stats.types}</p>
        </div>
      </div>

      {/* Type Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedType('all')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${selectedType === 'all' ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>全て</button>
          {Object.entries(COMMITTEE_TYPE_LABELS).map(([k, v]) => (
            <button key={k} onClick={() => setSelectedType(k as CommitteeType)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${selectedType === k ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Meeting List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {meetings.length === 0 ? '委員会記録がまだ登録されていません' : '条件に一致する記録がありません'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(meeting => {
              const sc = STATUS_CONFIG[meeting.status];
              const StatusIcon = sc.icon;
              const isExpanded = expandedMeeting === meeting.id;
              return (
                <div key={meeting.id}>
                  <button
                    onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                    className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 mt-1 text-gray-400" /> : <ChevronRight className="w-4 h-4 mt-1 text-gray-400" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">{meeting.committeeName}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              {meeting.meetingType === 'regular' ? '定例' : '臨時'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{meeting.meetingDate}</span>
                            {meeting.location && <span>{meeting.location}</span>}
                            {meeting.attendees.length > 0 && <span>{meeting.attendees.length}名出席</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${sc.bg} ${sc.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 space-y-3">
                      {meeting.agenda.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">議題</p>
                          <ul className="text-sm text-gray-700 list-disc list-inside">
                            {meeting.agenda.map((item: any, i: number) => (
                              <li key={i}>{typeof item === 'string' ? item : item.title || JSON.stringify(item)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {meeting.decisions && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">決定事項</p>
                          <p className="text-sm text-gray-700">{meeting.decisions}</p>
                        </div>
                      )}
                      {meeting.actionItems.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">アクションアイテム</p>
                          <ul className="text-sm text-gray-700 list-disc list-inside">
                            {meeting.actionItems.map((item: any, i: number) => (
                              <li key={i}>{typeof item === 'string' ? item : item.task || JSON.stringify(item)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
