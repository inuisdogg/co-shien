'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  ArrowLeft,
  ChevronRight,
  Send,
  Bell,
  CheckCircle,
  Clock,
  Users,
  Calendar,
  MapPin,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ConnectMeeting,
  ConnectMeetingStatus,
  ConnectMeetingDateOption,
  ConnectMeetingParticipant,
  ConnectMeetingResponse,
  ConnectMeetingFormData,
  ConnectMeetingAgendaItem,
  ConnectMeetingDecision,
  ConnectMeetingActionItem,
  ConnectResponseType,
} from '@/types';

// ステータスラベル
const STATUS_LABELS: Record<ConnectMeetingStatus, string> = {
  scheduling: '調整中',
  confirmed: '確定済',
  completed: '完了',
  cancelled: 'キャンセル',
};

// ステータスカラー
const STATUS_COLORS: Record<ConnectMeetingStatus, string> = {
  scheduling: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

// 所要時間オプション
const DURATION_OPTIONS = [
  { value: 30, label: '30分' },
  { value: 60, label: '60分' },
  { value: 90, label: '90分' },
  { value: 120, label: '120分' },
];

// 児童簡易型
type ChildOption = { id: string; name: string };

// DB行→型マッピング
function mapMeetingRow(row: Record<string, unknown>): ConnectMeeting {
  const children = row.children as Record<string, unknown> | null;
  const dateOpts = (row.connect_meeting_date_options || []) as Record<string, unknown>[];
  const parts = (row.connect_meeting_participants || []) as Record<string, unknown>[];

  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    childId: row.child_id as string,
    title: row.title as string,
    purpose: row.purpose as string | undefined,
    location: row.location as string | undefined,
    estimatedDuration: row.estimated_duration as number | undefined,
    description: row.description as string | undefined,
    status: row.status as ConnectMeetingStatus,
    confirmedDateOptionId: row.confirmed_date_option_id as string | undefined,
    confirmedAt: row.confirmed_at as string | undefined,
    confirmedBy: row.confirmed_by as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    childName: children ? (children.name as string) : undefined,
    dateOptions: dateOpts.map((o) => ({
      id: o.id as string,
      meetingId: o.meeting_id as string,
      date: o.date as string,
      startTime: o.start_time as string,
      endTime: o.end_time as string | undefined,
      availableCount: (o.available_count as number) || 0,
      maybeCount: (o.maybe_count as number) || 0,
      unavailableCount: (o.unavailable_count as number) || 0,
      createdAt: o.created_at as string,
      updatedAt: o.updated_at as string,
      responses: ((o.connect_meeting_responses || []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        participantId: r.participant_id as string,
        dateOptionId: r.date_option_id as string,
        response: r.response as ConnectResponseType,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      })),
    })),
    participants: parts.map((p) => ({
      id: p.id as string,
      meetingId: p.meeting_id as string,
      organizationName: p.organization_name as string,
      representativeEmail: p.representative_email as string,
      representativeName: p.representative_name as string | undefined,
      accessToken: p.access_token as string,
      tokenExpiresAt: p.token_expires_at as string,
      status: p.status as ConnectMeetingParticipant['status'],
      respondedAt: p.responded_at as string | undefined,
      responderName: p.responder_name as string | undefined,
      invitationSentAt: p.invitation_sent_at as string | undefined,
      reminderSentAt: p.reminder_sent_at as string | undefined,
      confirmationSentAt: p.confirmation_sent_at as string | undefined,
      attendeeCount: (p.attendee_count as number) || 1,
      attendeeNames: p.attendee_names as string | undefined,
      comment: p.comment as string | undefined,
      createdAt: p.created_at as string,
      updatedAt: p.updated_at as string,
      responses: ((p.connect_meeting_responses || []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        participantId: r.participant_id as string,
        dateOptionId: r.date_option_id as string,
        response: r.response as ConnectResponseType,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      })),
    })),
  };
}

export default function ConnectMeetingView() {
  const { user, facility } = useAuth();

  // State
  const [meetings, setMeetings] = useState<ConnectMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedMeeting, setSelectedMeeting] = useState<ConnectMeeting | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConnectMeetingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [saving, setSaving] = useState(false);

  // フォームデータ
  const [formData, setFormData] = useState<ConnectMeetingFormData>({
    childId: '',
    title: '',
    purpose: '',
    location: '',
    estimatedDuration: 60,
    description: '',
    dateOptions: [],
    participants: [],
  });

  // 議題・議事録
  const [agendaItems, setAgendaItems] = useState<ConnectMeetingAgendaItem[]>([]);
  const [minutes, setMinutes] = useState('');
  const [decisions, setDecisions] = useState<ConnectMeetingDecision[]>([]);
  const [actionItems, setActionItems] = useState<ConnectMeetingActionItem[]>([]);

  // データ取得
  const fetchMeetings = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('connect_meetings')
        .select(`
          *,
          children:child_id (id, name),
          connect_meeting_date_options (
            *,
            connect_meeting_responses (*)
          ),
          connect_meeting_participants (
            *,
            connect_meeting_responses (*)
          )
        `)
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch meetings error:', error);
        return;
      }
      setMeetings((data || []).map((row: Record<string, unknown>) => mapMeetingRow(row)));
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  const fetchChildren = useCallback(async () => {
    if (!facility?.id) return;
    const { data } = await supabase
      .from('children')
      .select('id, name')
      .eq('facility_id', facility.id)
      .order('name');
    setChildren((data || []).map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string })));
  }, [facility?.id]);

  useEffect(() => {
    fetchMeetings();
    fetchChildren();
  }, [fetchMeetings, fetchChildren]);

  // 詳細ビューで選択した会議のデータを最新にする
  const refreshSelectedMeeting = useCallback(async (meetingId: string) => {
    if (!facility?.id) return;
    const { data } = await supabase
      .from('connect_meetings')
      .select(`
        *,
        children:child_id (id, name),
        connect_meeting_date_options (
          *,
          connect_meeting_responses (*)
        ),
        connect_meeting_participants (
          *,
          connect_meeting_responses (*)
        )
      `)
      .eq('id', meetingId)
      .single();

    if (data) {
      const mapped = mapMeetingRow(data as Record<string, unknown>);
      setSelectedMeeting(mapped);
      // 議題等を読み込み
      const raw = data as Record<string, unknown>;
      setAgendaItems((raw.agenda_items as ConnectMeetingAgendaItem[]) || []);
      setMinutes((raw.minutes as string) || '');
      setDecisions((raw.decisions as ConnectMeetingDecision[]) || []);
      setActionItems((raw.action_items as ConnectMeetingActionItem[]) || []);
    }
  }, [facility?.id]);

  // フィルタリング
  const filteredMeetings = meetings.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        (m.childName || '').toLowerCase().includes(q) ||
        (m.purpose || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 統計
  const stats = {
    total: meetings.length,
    scheduling: meetings.filter((m) => m.status === 'scheduling').length,
    confirmed: meetings.filter((m) => m.status === 'confirmed').length,
    completed: meetings.filter((m) => m.status === 'completed').length,
  };

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // ===== 会議作成 =====
  const handleCreateMeeting = async () => {
    if (!facility?.id || !user?.id) return;
    if (!formData.childId || !formData.title) {
      alert('対象児童とタイトルは必須です。');
      return;
    }
    if (formData.dateOptions.length === 0) {
      alert('日程候補を1つ以上追加してください。');
      return;
    }
    if (formData.participants.length === 0) {
      alert('参加者を1人以上追加してください。');
      return;
    }

    setSaving(true);
    try {
      // 1. 会議を作成
      const { data: meetingData, error: meetingError } = await supabase
        .from('connect_meetings')
        .insert({
          facility_id: facility.id,
          child_id: formData.childId,
          title: formData.title,
          purpose: formData.purpose || null,
          location: formData.location || null,
          estimated_duration: formData.estimatedDuration || null,
          description: formData.description || null,
          status: 'scheduling',
          created_by: user.id,
        })
        .select()
        .single();

      if (meetingError || !meetingData) {
        alert('会議の作成に失敗しました。');
        return;
      }

      // 2. 日程候補を作成
      const dateOptionsInsert = formData.dateOptions.map((o) => ({
        meeting_id: meetingData.id,
        date: o.date,
        start_time: o.startTime,
        end_time: o.endTime || null,
      }));

      const { error: dateError } = await supabase
        .from('connect_meeting_date_options')
        .insert(dateOptionsInsert);

      if (dateError) {
        console.error('Date options insert error:', dateError);
      }

      // 3. 参加者を作成
      const participantsInsert = formData.participants.map((p) => ({
        meeting_id: meetingData.id,
        organization_name: p.organizationName,
        representative_email: p.representativeEmail,
        representative_name: p.representativeName || null,
        access_token: crypto.randomUUID(),
        token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      }));

      const { error: partError } = await supabase
        .from('connect_meeting_participants')
        .insert(participantsInsert);

      if (partError) {
        console.error('Participants insert error:', partError);
      }

      // リセット
      setFormData({
        childId: '',
        title: '',
        purpose: '',
        location: '',
        estimatedDuration: 60,
        description: '',
        dateOptions: [],
        participants: [],
      });
      setCreateStep(1);
      setView('list');
      fetchMeetings();
    } finally {
      setSaving(false);
    }
  };

  // ===== 招待送信 =====
  const handleSendInvitation = async (participant: ConnectMeetingParticipant) => {
    if (!selectedMeeting || !facility) return;

    const respondUrl = `${window.location.origin}/connect/respond/${participant.accessToken}`;
    const dateOptions = (selectedMeeting.dateOptions || []).map((o) => ({
      date: formatDate(o.date),
      startTime: formatTime(o.startTime),
      endTime: o.endTime ? formatTime(o.endTime) : undefined,
    }));

    try {
      const res = await fetch('/api/connect/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantEmail: participant.representativeEmail,
          participantName: participant.representativeName,
          organizationName: participant.organizationName,
          meetingTitle: selectedMeeting.title,
          facilityName: facility.name,
          dateOptions,
          respondUrl,
        }),
      });

      if (res.ok) {
        // 送信日時を記録
        await supabase
          .from('connect_meeting_participants')
          .update({ invitation_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', participant.id);

        refreshSelectedMeeting(selectedMeeting.id);
        alert('招待メールを送信しました。');
      } else {
        alert('招待メールの送信に失敗しました。');
      }
    } catch {
      alert('招待メールの送信に失敗しました。');
    }
  };

  // ===== リマインダー送信 =====
  const handleSendReminder = async (participant: ConnectMeetingParticipant) => {
    if (!selectedMeeting || !facility) return;

    const respondUrl = `${window.location.origin}/connect/respond/${participant.accessToken}`;
    const dateOptions = (selectedMeeting.dateOptions || []).map((o) => ({
      date: formatDate(o.date),
      startTime: formatTime(o.startTime),
      endTime: o.endTime ? formatTime(o.endTime) : undefined,
    }));

    try {
      const res = await fetch('/api/connect/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantEmail: participant.representativeEmail,
          participantName: participant.representativeName,
          organizationName: participant.organizationName,
          meetingTitle: selectedMeeting.title,
          facilityName: facility.name,
          dateOptions,
          respondUrl,
        }),
      });

      if (res.ok) {
        await supabase
          .from('connect_meeting_participants')
          .update({ reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', participant.id);

        refreshSelectedMeeting(selectedMeeting.id);
        alert('リマインダーを送信しました。');
      } else {
        alert('リマインダーの送信に失敗しました。');
      }
    } catch {
      alert('リマインダーの送信に失敗しました。');
    }
  };

  // ===== 日程確定 =====
  const handleConfirmDate = async (dateOptionId: string) => {
    if (!selectedMeeting || !user?.id || !facility) return;
    if (!confirm('この日程で確定しますか？確定通知メールが全参加者に送信されます。')) return;

    await supabase
      .from('connect_meetings')
      .update({
        status: 'confirmed',
        confirmed_date_option_id: dateOptionId,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedMeeting.id);

    // 確定した日程情報を取得
    const confirmedOpt = (selectedMeeting.dateOptions || []).find((o) => o.id === dateOptionId);
    if (confirmedOpt) {
      const confirmedDate = formatDate(confirmedOpt.date);
      const confirmedTime = formatTime(confirmedOpt.startTime) +
        (confirmedOpt.endTime ? `〜${formatTime(confirmedOpt.endTime)}` : '');

      // 全参加者に確定通知メールを送信
      const parts = selectedMeeting.participants || [];
      for (const p of parts) {
        try {
          await fetch('/api/connect/send-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              participantEmail: p.representativeEmail,
              participantName: p.responderName || p.representativeName,
              organizationName: p.organizationName,
              meetingTitle: selectedMeeting.title,
              facilityName: facility.name,
              confirmedDate,
              confirmedTime,
              location: selectedMeeting.location,
            }),
          });

          // 確定通知送信日時を記録
          await supabase
            .from('connect_meeting_participants')
            .update({ confirmation_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', p.id);
        } catch (err) {
          console.error('Confirmation email error:', err);
        }
      }
    }

    refreshSelectedMeeting(selectedMeeting.id);
    fetchMeetings();
  };

  // ===== ステータス変更 =====
  const handleStatusChange = async (newStatus: ConnectMeetingStatus) => {
    if (!selectedMeeting) return;
    const labels: Record<string, string> = { completed: '完了', cancelled: 'キャンセル' };
    if (!confirm(`この会議を「${labels[newStatus] || newStatus}」にしますか？`)) return;

    await supabase
      .from('connect_meetings')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', selectedMeeting.id);

    refreshSelectedMeeting(selectedMeeting.id);
    fetchMeetings();
  };

  // ===== 議題保存 =====
  const saveAgendaItems = async () => {
    if (!selectedMeeting) return;
    await supabase
      .from('connect_meetings')
      .update({ agenda_items: agendaItems, updated_at: new Date().toISOString() })
      .eq('id', selectedMeeting.id);
  };

  // ===== 議事録保存 =====
  const saveMinutes = async () => {
    if (!selectedMeeting) return;
    await supabase
      .from('connect_meetings')
      .update({ minutes, updated_at: new Date().toISOString() })
      .eq('id', selectedMeeting.id);
  };

  // ===== 決定事項保存 =====
  const saveDecisions = async () => {
    if (!selectedMeeting) return;
    await supabase
      .from('connect_meetings')
      .update({ decisions, updated_at: new Date().toISOString() })
      .eq('id', selectedMeeting.id);
  };

  // ===== アクションアイテム保存 =====
  const saveActionItems = async () => {
    if (!selectedMeeting) return;
    await supabase
      .from('connect_meetings')
      .update({ action_items: actionItems, updated_at: new Date().toISOString() })
      .eq('id', selectedMeeting.id);
  };

  // ===== 回答取得ヘルパー =====
  const getResponseForCell = (
    participant: ConnectMeetingParticipant,
    dateOption: ConnectMeetingDateOption
  ): ConnectMeetingResponse | undefined => {
    // participant.responses から検索
    if (participant.responses) {
      return participant.responses.find((r) => r.dateOptionId === dateOption.id);
    }
    // dateOption.responses から検索
    if (dateOption.responses) {
      return dateOption.responses.find((r) => r.participantId === participant.id);
    }
    return undefined;
  };

  const renderResponseCell = (response: ConnectMeetingResponse | undefined) => {
    if (!response) {
      return <span className="text-gray-400 text-xs">未回答</span>;
    }
    switch (response.response) {
      case 'available':
        return <span className="text-green-600 font-bold text-lg">&#9675;</span>;
      case 'maybe':
        return <span className="text-yellow-600 font-bold text-lg">&#9651;</span>;
      case 'unavailable':
        return <span className="text-red-600 font-bold text-lg">&#10005;</span>;
      default:
        return <span className="text-gray-400 text-xs">未回答</span>;
    }
  };

  // ===========================
  // LIST VIEW
  // ===========================
  const renderListView = () => (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">連絡会議</h1>
          <p className="text-sm text-gray-500 mt-1">外部関係機関との連絡会議を管理します</p>
        </div>
        <button
          onClick={() => { setView('create'); setCreateStep(1); }}
          className="flex items-center gap-2 bg-[#00c4cc] text-white px-4 py-2.5 rounded-lg hover:bg-[#00b0b8] transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          新規作成
        </button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: '合計', value: stats.total, color: 'text-gray-800', bg: 'bg-white' },
          { label: '調整中', value: stats.scheduling, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: '確定済', value: stats.confirmed, color: 'text-green-700', bg: 'bg-green-50' },
          { label: '完了', value: stats.completed, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'all' as const, label: 'すべて' },
            { key: 'scheduling' as const, label: '調整中' },
            { key: 'confirmed' as const, label: '確定済' },
            { key: 'completed' as const, label: '完了' },
            { key: 'cancelled' as const, label: 'キャンセル' },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-[#00c4cc] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
          />
        </div>
      </div>

      {/* 会議リスト */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#00c4cc]" />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-50" />
          <p>連絡会議がありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => {
            const confirmedOption = meeting.dateOptions?.find(
              (o) => o.id === meeting.confirmedDateOptionId
            );
            return (
              <button
                key={meeting.id}
                onClick={() => {
                  setSelectedMeeting(meeting);
                  setView('detail');
                  refreshSelectedMeeting(meeting.id);
                }}
                className="w-full bg-white rounded-xl border border-gray-100 p-4 hover:border-[#00c4cc]/30 hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-800 truncate">{meeting.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[meeting.status]}`}>
                        {STATUS_LABELS[meeting.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {meeting.childName && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {meeting.childName}
                        </span>
                      )}
                      {confirmedOption ? (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(confirmedOption.date)} {formatTime(confirmedOption.startTime)}
                        </span>
                      ) : meeting.dateOptions && meeting.dateOptions.length > 0 ? (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          候補 {meeting.dateOptions.length}件
                        </span>
                      ) : null}
                      {meeting.participants && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          参加者 {meeting.participants.length}名
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ===========================
  // CREATE VIEW
  // ===========================
  const renderCreateView = () => (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { setView('list'); setCreateStep(1); }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">新規連絡会議</h1>
          <p className="text-sm text-gray-500">ステップ {createStep} / 3</p>
        </div>
      </div>

      {/* ステッパー */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { step: 1 as const, label: '基本情報' },
          { step: 2 as const, label: '日程候補' },
          { step: 3 as const, label: '参加者' },
        ].map((s, i) => (
          <React.Fragment key={s.step}>
            {i > 0 && <div className={`flex-1 h-0.5 ${createStep >= s.step ? 'bg-[#00c4cc]' : 'bg-gray-200'}`} />}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                createStep >= s.step ? 'bg-[#00c4cc] text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s.step}
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        {/* Step 1: 基本情報 */}
        {createStep === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">対象児童 <span className="text-red-500">*</span></label>
              <select
                value={formData.childId}
                onChange={(e) => setFormData((p) => ({ ...p, childId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
              >
                <option value="">選択してください</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="例: 学校訪問打ち合わせ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目的</label>
              <textarea
                value={formData.purpose || ''}
                onChange={(e) => setFormData((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="会議の目的を記入してください"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                placeholder="例: 施設内会議室"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所要時間</label>
              <select
                value={formData.estimatedDuration || 60}
                onChange={(e) => setFormData((p) => ({ ...p, estimatedDuration: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="補足情報があれば記入してください"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!formData.childId || !formData.title) {
                    alert('対象児童とタイトルは必須です。');
                    return;
                  }
                  setCreateStep(2);
                }}
                className="bg-[#00c4cc] text-white px-6 py-2.5 rounded-lg hover:bg-[#00b0b8] transition-colors font-medium text-sm"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 日程候補 */}
        {createStep === 2 && (
          <div className="space-y-5">
            <h3 className="font-bold text-gray-800">日程候補</h3>
            <p className="text-sm text-gray-500">候補日時を追加してください。複数の候補を設定できます。</p>

            {/* 追加フォーム */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">日付</label>
                  <input
                    type="date"
                    id="new-date-option-date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">開始時間</label>
                  <input
                    type="time"
                    id="new-date-option-start"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">終了時間</label>
                  <input
                    type="time"
                    id="new-date-option-end"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const dateEl = document.getElementById('new-date-option-date') as HTMLInputElement;
                  const startEl = document.getElementById('new-date-option-start') as HTMLInputElement;
                  const endEl = document.getElementById('new-date-option-end') as HTMLInputElement;
                  if (!dateEl.value || !startEl.value) {
                    alert('日付と開始時間は必須です。');
                    return;
                  }
                  setFormData((p) => ({
                    ...p,
                    dateOptions: [
                      ...p.dateOptions,
                      { date: dateEl.value, startTime: startEl.value, endTime: endEl.value || undefined },
                    ],
                  }));
                  dateEl.value = '';
                  startEl.value = '';
                  endEl.value = '';
                }}
                className="flex items-center gap-1 text-[#00c4cc] text-sm font-medium hover:underline"
              >
                <Plus size={14} />
                候補を追加
              </button>
            </div>

            {/* 追加済みリスト */}
            {formData.dateOptions.length > 0 && (
              <div className="space-y-2">
                {formData.dateOptions.map((o, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {o.date} {o.startTime}{o.endTime ? ` 〜 ${o.endTime}` : ''}
                    </span>
                    <button
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          dateOptions: p.dateOptions.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setCreateStep(1)}
                className="text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              >
                戻る
              </button>
              <button
                onClick={() => {
                  if (formData.dateOptions.length === 0) {
                    alert('日程候補を1つ以上追加してください。');
                    return;
                  }
                  setCreateStep(3);
                }}
                className="bg-[#00c4cc] text-white px-6 py-2.5 rounded-lg hover:bg-[#00b0b8] transition-colors font-medium text-sm"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 参加者 */}
        {createStep === 3 && (
          <div className="space-y-5">
            <h3 className="font-bold text-gray-800">参加者</h3>
            <p className="text-sm text-gray-500">外部参加者を追加してください。招待メールは会議作成後に送信できます。</p>

            {/* 追加フォーム */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">組織名</label>
                  <input
                    type="text"
                    id="new-participant-org"
                    placeholder="例: 〇〇市役所"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">担当者名</label>
                  <input
                    type="text"
                    id="new-participant-name"
                    placeholder="例: 田中太郎"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    id="new-participant-email"
                    placeholder="例: tanaka@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const orgEl = document.getElementById('new-participant-org') as HTMLInputElement;
                  const nameEl = document.getElementById('new-participant-name') as HTMLInputElement;
                  const emailEl = document.getElementById('new-participant-email') as HTMLInputElement;
                  if (!orgEl.value || !emailEl.value) {
                    alert('組織名とメールアドレスは必須です。');
                    return;
                  }
                  setFormData((p) => ({
                    ...p,
                    participants: [
                      ...p.participants,
                      {
                        organizationName: orgEl.value,
                        representativeName: nameEl.value || undefined,
                        representativeEmail: emailEl.value,
                      },
                    ],
                  }));
                  orgEl.value = '';
                  nameEl.value = '';
                  emailEl.value = '';
                }}
                className="flex items-center gap-1 text-[#00c4cc] text-sm font-medium hover:underline"
              >
                <Plus size={14} />
                参加者を追加
              </button>
            </div>

            {/* 追加済みリスト */}
            {formData.participants.length > 0 && (
              <div className="space-y-2">
                {formData.participants.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">{p.organizationName}</span>
                      {p.representativeName && (
                        <span className="text-gray-500 ml-2">{p.representativeName}</span>
                      )}
                      <span className="text-gray-400 ml-2">{p.representativeEmail}</span>
                    </div>
                    <button
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          participants: prev.participants.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setCreateStep(2)}
                className="text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              >
                戻る
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={saving}
                className="bg-[#00c4cc] text-white px-6 py-2.5 rounded-lg hover:bg-[#00b0b8] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                作成する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ===========================
  // DETAIL VIEW
  // ===========================
  const renderDetailView = () => {
    if (!selectedMeeting) return null;
    const m = selectedMeeting;
    const dateOpts = m.dateOptions || [];
    const parts = m.participants || [];
    const isConfirmedOrCompleted = m.status === 'confirmed' || m.status === 'completed';

    return (
      <div>
        {/* ヘッダー */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => { setView('list'); setSelectedMeeting(null); fetchMeetings(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-0.5"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-800 truncate">{m.title}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[m.status]}`}>
                {STATUS_LABELS[m.status]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {m.childName && (
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {m.childName}
                </span>
              )}
              {m.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {m.location}
                </span>
              )}
              {m.estimatedDuration && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {m.estimatedDuration}分
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section A: 日程調整 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar size={18} />
            日程調整
          </h2>

          {dateOpts.length === 0 ? (
            <p className="text-sm text-gray-400">日程候補がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">参加者</th>
                    {dateOpts.map((o) => (
                      <th key={o.id} className="text-center py-2 px-3 text-gray-500 font-medium text-xs whitespace-nowrap">
                        {formatDate(o.date)}
                        <br />
                        {formatTime(o.startTime)}
                        {o.endTime ? `〜${formatTime(o.endTime)}` : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <div className="font-medium text-gray-700 text-xs">{p.organizationName}</div>
                        {p.representativeName && (
                          <div className="text-gray-400 text-[10px]">{p.representativeName}</div>
                        )}
                      </td>
                      {dateOpts.map((o) => (
                        <td key={o.id} className="text-center py-2 px-3">
                          {renderResponseCell(getResponseForCell(p, o))}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* 集計行 */}
                  <tr className="bg-gray-50">
                    <td className="py-2 px-3 text-xs font-bold text-gray-600">集計</td>
                    {dateOpts.map((o) => (
                      <td key={o.id} className="text-center py-2 px-3">
                        <div className="text-[10px] space-y-0.5">
                          <div className="text-green-600">&#9675; {o.availableCount}</div>
                          <div className="text-yellow-600">&#9651; {o.maybeCount}</div>
                          <div className="text-red-600">&#10005; {o.unavailableCount}</div>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 日程確定ボタン */}
          {m.status === 'scheduling' && dateOpts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3">日程を確定するには、候補日の横の「確定」ボタンを押してください。</p>
              <div className="flex flex-wrap gap-2">
                {dateOpts
                  .sort((a, b) => b.availableCount - a.availableCount)
                  .map((o) => (
                    <button
                      key={o.id}
                      onClick={() => handleConfirmDate(o.id)}
                      className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle size={12} />
                      {formatDate(o.date)} {formatTime(o.startTime)} で確定
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* 確定済みの場合 */}
          {m.confirmedDateOptionId && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {(() => {
                const confirmedOpt = dateOpts.find((o) => o.id === m.confirmedDateOptionId);
                if (!confirmedOpt) return null;
                return (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-4 py-3">
                    <CheckCircle size={16} />
                    <span className="font-medium text-sm">
                      確定日程: {formatDate(confirmedOpt.date)} {formatTime(confirmedOpt.startTime)}
                      {confirmedOpt.endTime ? `〜${formatTime(confirmedOpt.endTime)}` : ''}
                    </span>
                    {m.confirmedAt && (
                      <span className="text-xs text-green-500 ml-2">({formatDateTime(m.confirmedAt)}に確定)</span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Section B: 参加者管理 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={18} />
            参加者管理
          </h2>

          {parts.length === 0 ? (
            <p className="text-sm text-gray-400">参加者がいません</p>
          ) : (
            <div className="space-y-3">
              {parts.map((p) => {
                const statusLabels: Record<string, string> = {
                  pending: '未回答',
                  responded: '回答済',
                  declined: '辞退',
                };
                const statusBadgeColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  responded: 'bg-green-100 text-green-700',
                  declined: 'bg-red-100 text-red-700',
                };

                return (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-700 text-sm">{p.organizationName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadgeColors[p.status] || statusBadgeColors.pending}`}>
                          {statusLabels[p.status] || p.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {p.responderName && <span className="font-medium text-gray-600">{p.responderName}</span>}
                        {p.representativeName && !p.responderName && <span>{p.representativeName}</span>}
                        <span className="ml-2">{p.representativeEmail}</span>
                        {p.attendeeCount && p.attendeeCount > 1 && (
                          <span className="ml-2 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {p.attendeeCount}名参加
                          </span>
                        )}
                        {p.respondedAt && (
                          <span className="ml-2 text-gray-400">回答: {formatDateTime(p.respondedAt)}</span>
                        )}
                      </div>
                      {p.attendeeNames && (
                        <div className="text-[10px] text-gray-400 mt-0.5">出席者: {p.attendeeNames}</div>
                      )}
                      {p.comment && (
                        <div className="text-[10px] text-gray-400 mt-0.5">コメント: {p.comment}</div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => handleSendInvitation(p)}
                        className="flex items-center gap-1 bg-[#00c4cc] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#00b0b8] transition-colors"
                      >
                        <Send size={12} />
                        招待送信
                      </button>
                      {p.status === 'pending' && (
                        <button
                          onClick={() => handleSendReminder(p)}
                          className="flex items-center gap-1 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-100 transition-colors"
                        >
                          <Bell size={12} />
                          リマインダー
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section C: 議題 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="font-bold text-gray-800 mb-4">議題</h2>
          <div className="space-y-3">
            {agendaItems.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs text-gray-400 mt-2.5 w-6 text-center">{i + 1}</span>
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const updated = [...agendaItems];
                      updated[i] = { ...updated[i], title: e.target.value };
                      setAgendaItems(updated);
                    }}
                    onBlur={saveAgendaItems}
                    placeholder="議題タイトル"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  />
                  <textarea
                    value={item.description || ''}
                    onChange={(e) => {
                      const updated = [...agendaItems];
                      updated[i] = { ...updated[i], description: e.target.value };
                      setAgendaItems(updated);
                    }}
                    onBlur={saveAgendaItems}
                    placeholder="説明（任意）"
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
                  />
                </div>
                <button
                  onClick={() => {
                    const updated = agendaItems.filter((_, idx) => idx !== i).map((a, idx) => ({ ...a, order: idx + 1 }));
                    setAgendaItems(updated);
                    // auto-save on next tick
                    setTimeout(saveAgendaItems, 0);
                  }}
                  className="text-gray-400 hover:text-red-500 mt-2"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setAgendaItems((prev) => [...prev, { title: '', description: '', order: prev.length + 1 }]);
            }}
            className="flex items-center gap-1 text-[#00c4cc] text-sm font-medium hover:underline mt-3"
          >
            <Plus size={14} />
            議題を追加
          </button>
        </div>

        {/* Section D: 議事録 (confirmed/completed) */}
        {isConfirmedOrCompleted && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="font-bold text-gray-800 mb-4">議事録</h2>
            <textarea
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="議事録を記入してください..."
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={saveMinutes}
                className="bg-[#00c4cc] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#00b0b8] transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        )}

        {/* Section E: 決定事項 (confirmed/completed) */}
        {isConfirmedOrCompleted && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="font-bold text-gray-800 mb-4">決定事項</h2>
            <div className="space-y-3">
              {decisions.map((d, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={d.title}
                      onChange={(e) => {
                        const updated = [...decisions];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setDecisions(updated);
                      }}
                      onBlur={saveDecisions}
                      placeholder="決定事項"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <textarea
                        value={d.description || ''}
                        onChange={(e) => {
                          const updated = [...decisions];
                          updated[i] = { ...updated[i], description: e.target.value };
                          setDecisions(updated);
                        }}
                        onBlur={saveDecisions}
                        placeholder="説明"
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
                      />
                      <input
                        type="text"
                        value={d.assignee || ''}
                        onChange={(e) => {
                          const updated = [...decisions];
                          updated[i] = { ...updated[i], assignee: e.target.value };
                          setDecisions(updated);
                        }}
                        onBlur={saveDecisions}
                        placeholder="担当者"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent h-fit"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDecisions((prev) => prev.filter((_, idx) => idx !== i));
                      setTimeout(saveDecisions, 0);
                    }}
                    className="text-gray-400 hover:text-red-500 mt-2"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setDecisions((prev) => [...prev, { title: '', description: '', assignee: '' }])}
              className="flex items-center gap-1 text-[#00c4cc] text-sm font-medium hover:underline mt-3"
            >
              <Plus size={14} />
              決定事項を追加
            </button>
          </div>
        )}

        {/* Section F: アクションアイテム (confirmed/completed) */}
        {isConfirmedOrCompleted && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="font-bold text-gray-800 mb-4">アクションアイテム</h2>
            <div className="space-y-3">
              {actionItems.map((a, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <button
                    onClick={() => {
                      const updated = [...actionItems];
                      updated[i] = { ...updated[i], status: a.status === 'done' ? 'pending' : 'done' };
                      setActionItems(updated);
                      setTimeout(saveActionItems, 0);
                    }}
                    className={`mt-2 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      a.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}
                  >
                    {a.status === 'done' && <span className="text-white text-xs">&#10003;</span>}
                  </button>
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={a.task}
                      onChange={(e) => {
                        const updated = [...actionItems];
                        updated[i] = { ...updated[i], task: e.target.value };
                        setActionItems(updated);
                      }}
                      onBlur={saveActionItems}
                      placeholder="タスク内容"
                      className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent ${
                        a.status === 'done' ? 'line-through text-gray-400' : ''
                      }`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={a.assignee || ''}
                        onChange={(e) => {
                          const updated = [...actionItems];
                          updated[i] = { ...updated[i], assignee: e.target.value };
                          setActionItems(updated);
                        }}
                        onBlur={saveActionItems}
                        placeholder="担当者"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      />
                      <input
                        type="date"
                        value={a.dueDate || ''}
                        onChange={(e) => {
                          const updated = [...actionItems];
                          updated[i] = { ...updated[i], dueDate: e.target.value };
                          setActionItems(updated);
                        }}
                        onBlur={saveActionItems}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActionItems((prev) => prev.filter((_, idx) => idx !== i));
                      setTimeout(saveActionItems, 0);
                    }}
                    className="text-gray-400 hover:text-red-500 mt-2"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActionItems((prev) => [...prev, { task: '', assignee: '', dueDate: '', status: 'pending' }])}
              className="flex items-center gap-1 text-[#00c4cc] text-sm font-medium hover:underline mt-3"
            >
              <Plus size={14} />
              アクションアイテムを追加
            </button>
          </div>
        )}

        {/* フッターアクション */}
        {m.status !== 'completed' && m.status !== 'cancelled' && (
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => handleStatusChange('cancelled')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              キャンセル
            </button>
            {m.status === 'confirmed' && (
              <button
                onClick={() => handleStatusChange('completed')}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#00c4cc] hover:bg-[#00b0b8] transition-colors"
              >
                完了にする
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ===========================
  // RENDER
  // ===========================
  return (
    <div className="h-full">
      {view === 'list' && renderListView()}
      {view === 'create' && renderCreateView()}
      {view === 'detail' && renderDetailView()}
    </div>
  );
}
