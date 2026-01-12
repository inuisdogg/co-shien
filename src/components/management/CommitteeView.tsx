/**
 * 委員会議事録管理コンポーネント
 * 運営指導で必須の各種委員会（運営推進会議、虐待防止、身体拘束等）の記録
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UsersRound,
  Plus,
  Edit,
  Save,
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle,
  Download,
  Filter,
  Search,
  ListChecks,
  Target,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PdfDocument, formatDate, toJapaneseEra } from '@/utils/pdfExport';

// 議事録の型定義
type CommitteeMeeting = {
  id: string;
  facilityId: string;
  committeeType: 'operation_promotion' | 'abuse_prevention' | 'restraint_review' | 'safety' | 'infection_control' | 'quality_improvement' | 'other';
  committeeName?: string;
  meetingDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  meetingType?: 'regular' | 'extraordinary';
  attendees?: Array<{ name: string; role?: string; organization?: string; attended: boolean }>;
  externalAttendees?: string;
  facilitatorName?: string;
  recorderName?: string;
  agenda?: Array<{ title: string; content?: string; decision?: string }>;
  discussionPoints?: string;
  decisions?: string;
  actionItems?: Array<{ task: string; assignee?: string; deadline?: string }>;
  reports?: string;
  previousActionReview?: string;
  nextMeetingDate?: string;
  nextAgendaPreview?: string;
  attachments?: Array<{ name: string; url: string; type: string }>;
  status: 'draft' | 'finalized' | 'approved';
  approvedBy?: string;
  approvedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

// DBのsnake_caseからcamelCaseに変換
const mapDbToMeeting = (row: any): CommitteeMeeting => ({
  id: row.id,
  facilityId: row.facility_id,
  committeeType: row.committee_type,
  committeeName: row.committee_name,
  meetingDate: row.meeting_date,
  startTime: row.start_time,
  endTime: row.end_time,
  location: row.location,
  meetingType: row.meeting_type,
  attendees: row.attendees,
  externalAttendees: row.external_attendees,
  facilitatorName: row.facilitator_name,
  recorderName: row.recorder_name,
  agenda: row.agenda,
  discussionPoints: row.discussion_points,
  decisions: row.decisions,
  actionItems: row.action_items,
  reports: row.reports,
  previousActionReview: row.previous_action_review,
  nextMeetingDate: row.next_meeting_date,
  nextAgendaPreview: row.next_agenda_preview,
  attachments: row.attachments,
  status: row.status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// camelCaseからsnake_caseに変換
const mapMeetingToDb = (meeting: Partial<CommitteeMeeting>) => ({
  facility_id: meeting.facilityId,
  committee_type: meeting.committeeType,
  committee_name: meeting.committeeName,
  meeting_date: meeting.meetingDate,
  start_time: meeting.startTime,
  end_time: meeting.endTime,
  location: meeting.location,
  meeting_type: meeting.meetingType,
  attendees: meeting.attendees,
  external_attendees: meeting.externalAttendees,
  facilitator_name: meeting.facilitatorName,
  recorder_name: meeting.recorderName,
  agenda: meeting.agenda,
  discussion_points: meeting.discussionPoints,
  decisions: meeting.decisions,
  action_items: meeting.actionItems,
  reports: meeting.reports,
  previous_action_review: meeting.previousActionReview,
  next_meeting_date: meeting.nextMeetingDate,
  next_agenda_preview: meeting.nextAgendaPreview,
  attachments: meeting.attachments,
  status: meeting.status,
  approved_by: meeting.approvedBy,
  approved_at: meeting.approvedAt,
  created_by: meeting.createdBy,
});

// 委員会種別
const committeeTypes = {
  operation_promotion: { label: '運営推進会議', color: 'bg-blue-100 text-blue-700', shortLabel: '運営推進' },
  abuse_prevention: { label: '虐待防止委員会', color: 'bg-red-100 text-red-700', shortLabel: '虐待防止' },
  restraint_review: { label: '身体拘束適正化委員会', color: 'bg-orange-100 text-orange-700', shortLabel: '身体拘束' },
  safety: { label: '安全委員会', color: 'bg-yellow-100 text-yellow-700', shortLabel: '安全' },
  infection_control: { label: '感染症対策委員会', color: 'bg-green-100 text-green-700', shortLabel: '感染症' },
  quality_improvement: { label: 'サービス向上委員会', color: 'bg-purple-100 text-purple-700', shortLabel: 'サービス向上' },
  other: { label: 'その他', color: 'bg-gray-100 text-gray-700', shortLabel: 'その他' },
};

// ステータス
const statusLabels = {
  draft: { label: '下書き', color: 'bg-gray-100 text-gray-700' },
  finalized: { label: '確定', color: 'bg-blue-100 text-blue-700' },
  approved: { label: '承認済み', color: 'bg-green-100 text-green-700' },
};

export default function CommitteeView() {
  const { user, facility } = useAuth();
  const [meetings, setMeetings] = useState<CommitteeMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<CommitteeMeeting | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // フィルター
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // フォーム状態
  const [formData, setFormData] = useState<Partial<CommitteeMeeting>>({
    committeeType: 'operation_promotion',
    meetingDate: new Date().toISOString().split('T')[0],
    meetingType: 'regular',
    status: 'draft',
    attendees: [],
    agenda: [],
    actionItems: [],
  });

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('committee_meetings')
        .select('*')
        .eq('facility_id', facility.id)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setMeetings((data || []).map(mapDbToMeeting));
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 保存処理
  const handleSave = async () => {
    if (!facility?.id || !formData.meetingDate) {
      alert('開催日は必須です');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...mapMeetingToDb(formData),
        facility_id: facility.id,
        created_by: user?.id,
      };

      if (selectedMeeting && isEditing) {
        const { error } = await supabase
          .from('committee_meetings')
          .update(dataToSave)
          .eq('id', selectedMeeting.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('committee_meetings')
          .insert(dataToSave);

        if (error) throw error;
      }

      await fetchData();
      setIsCreating(false);
      setIsEditing(false);
      setSelectedMeeting(null);
      resetForm();
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      committeeType: 'operation_promotion',
      meetingDate: new Date().toISOString().split('T')[0],
      meetingType: 'regular',
      status: 'draft',
      attendees: [],
      agenda: [],
      actionItems: [],
    });
  };

  // 議題の追加
  const addAgendaItem = () => {
    setFormData({
      ...formData,
      agenda: [...(formData.agenda || []), { title: '', content: '', decision: '' }],
    });
  };

  // 議題の削除
  const removeAgendaItem = (index: number) => {
    setFormData({
      ...formData,
      agenda: formData.agenda?.filter((_, i) => i !== index),
    });
  };

  // アクションアイテムの追加
  const addActionItem = () => {
    setFormData({
      ...formData,
      actionItems: [...(formData.actionItems || []), { task: '', assignee: '', deadline: '' }],
    });
  };

  // PDF出力
  const exportPdf = (meeting: CommitteeMeeting) => {
    const typeLabel = committeeTypes[meeting.committeeType].label;
    const pdf = new PdfDocument({
      title: `${meeting.committeeName || typeLabel} 議事録`,
      facilityName: facility?.name || '施設名',
      facilityCode: facility?.code,
      createdAt: formatDate(new Date(), 'short'),
    });

    pdf.drawHeader();
    pdf.addSpace(5);

    // 基本情報
    pdf.addLabelValue('委員会', meeting.committeeName || typeLabel);
    pdf.addLabelValue('開催日', toJapaneseEra(meeting.meetingDate));
    if (meeting.startTime && meeting.endTime) {
      pdf.addLabelValue('時間', `${meeting.startTime} 〜 ${meeting.endTime}`);
    }
    pdf.addLabelValue('開催場所', meeting.location || '-');
    pdf.addLabelValue('司会', meeting.facilitatorName || '-');
    pdf.addLabelValue('記録', meeting.recorderName || '-');

    pdf.addSpace(5);
    pdf.addLine();
    pdf.addSpace(5);

    // 出席者
    if (meeting.attendees && meeting.attendees.length > 0) {
      pdf.addText('出席者', { fontSize: 12 });
      pdf.addSpace(3);
      const attendeeNames = meeting.attendees
        .filter((a) => a.attended)
        .map((a) => `${a.name}${a.role ? `(${a.role})` : ''}`)
        .join('、');
      pdf.addMultilineText(attendeeNames || '出席者なし');
    }

    if (meeting.externalAttendees) {
      pdf.addText('外部参加者: ' + meeting.externalAttendees);
    }

    pdf.addSpace(5);
    pdf.addLine();
    pdf.addSpace(5);

    // 議事
    if (meeting.agenda && meeting.agenda.length > 0) {
      pdf.addText('議事', { fontSize: 12 });
      pdf.addSpace(3);
      meeting.agenda.forEach((item, i) => {
        pdf.addText(`${i + 1}. ${item.title}`, { fontSize: 10 });
        if (item.content) {
          pdf.addMultilineText(item.content);
        }
        if (item.decision) {
          pdf.addText(`  [決定] ${item.decision}`, { fontSize: 9 });
        }
        pdf.addSpace(3);
      });
    }

    // 決定事項
    if (meeting.decisions) {
      pdf.addSpace(5);
      pdf.addText('決定事項', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(meeting.decisions);
    }

    // アクションアイテム
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      pdf.addSpace(5);
      pdf.addText('アクションアイテム', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addTable(
        [
          { header: 'タスク', key: 'task', width: 50 },
          { header: '担当', key: 'assignee', width: 25 },
          { header: '期限', key: 'deadline', width: 25 },
        ],
        meeting.actionItems
      );
    }

    // 次回予定
    if (meeting.nextMeetingDate) {
      pdf.addSpace(5);
      pdf.addText('次回予定', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addLabelValue('日程', toJapaneseEra(meeting.nextMeetingDate));
      if (meeting.nextAgendaPreview) {
        pdf.addMultilineText(meeting.nextAgendaPreview);
      }
    }

    // 署名欄
    pdf.addSignatureBlock([
      { role: '記録者', name: meeting.recorderName, signed: !!meeting.recorderName },
      { role: '司会者', name: meeting.facilitatorName, signed: !!meeting.facilitatorName },
      { role: '承認者', signed: meeting.status === 'approved' },
    ]);

    pdf.save(`議事録_${meeting.committeeName || typeLabel}_${meeting.meetingDate}.pdf`);
  };

  // フィルター適用
  const filteredMeetings = meetings.filter((meeting) => {
    if (filterType !== 'all' && meeting.committeeType !== filterType) return false;
    if (filterStatus !== 'all' && meeting.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        meeting.committeeName?.toLowerCase().includes(query) ||
        meeting.decisions?.toLowerCase().includes(query) ||
        committeeTypes[meeting.committeeType].label.toLowerCase().includes(query)
      );
    }
    return true;
  });

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
            <UsersRound className="w-7 h-7 text-[#00c4cc]" />
            委員会管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            各種委員会の議事録を管理します
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
            setSelectedMeeting(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg text-sm font-medium hover:bg-[#00b0b8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規議事録
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全委員会</option>
              {Object.entries(committeeTypes).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全ステータス</option>
              <option value="draft">下書き</option>
              <option value="finalized">確定</option>
              <option value="approved">承認済み</option>
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 議事録一覧 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">議事録一覧</h2>
              <p className="text-xs text-gray-500 mt-1">{filteredMeetings.length}件</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredMeetings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <UsersRound className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  議事録がありません
                </div>
              ) : (
                filteredMeetings.map((meeting) => (
                  <button
                    key={meeting.id}
                    onClick={() => {
                      setSelectedMeeting(meeting);
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedMeeting?.id === meeting.id ? 'bg-[#00c4cc]/5 border-l-4 border-[#00c4cc]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${committeeTypes[meeting.committeeType].color}`}>
                        <UsersRound className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[meeting.status].color}`}>
                            {statusLabels[meeting.status].label}
                          </span>
                        </div>
                        <p className="font-medium text-gray-800 truncate">
                          {meeting.committeeName || committeeTypes[meeting.committeeType].label}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(meeting.meetingDate).toLocaleDateString('ja-JP')}
                          {meeting.meetingType === 'extraordinary' && ' (臨時)'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 詳細・フォーム */}
        <div className="lg:col-span-2">
          {isCreating || (selectedMeeting && isEditing) ? (
            // 編集フォーム
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedMeeting ? '議事録を編集' : '新規議事録'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* 委員会種別 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">委員会種別</label>
                  <select
                    value={formData.committeeType || 'operation_promotion'}
                    onChange={(e) => setFormData({ ...formData, committeeType: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    {Object.entries(committeeTypes).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {formData.committeeType === 'other' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">委員会名</label>
                    <input
                      type="text"
                      value={formData.committeeName || ''}
                      onChange={(e) => setFormData({ ...formData, committeeName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="委員会の名称を入力"
                    />
                  </div>
                )}

                {/* 日時 */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">開催日 *</label>
                    <input
                      type="date"
                      value={formData.meetingDate || ''}
                      onChange={(e) => setFormData({ ...formData, meetingDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">開始時間</label>
                    <input
                      type="time"
                      value={formData.startTime || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">終了時間</label>
                    <input
                      type="time"
                      value={formData.endTime || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                {/* 場所・種別 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">開催場所</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="会議室など"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">開催種別</label>
                    <select
                      value={formData.meetingType || 'regular'}
                      onChange={(e) => setFormData({ ...formData, meetingType: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    >
                      <option value="regular">定例</option>
                      <option value="extraordinary">臨時</option>
                    </select>
                  </div>
                </div>

                {/* 司会・記録 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">司会者</label>
                    <input
                      type="text"
                      value={formData.facilitatorName || ''}
                      onChange={(e) => setFormData({ ...formData, facilitatorName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">記録者</label>
                    <input
                      type="text"
                      value={formData.recorderName || ''}
                      onChange={(e) => setFormData({ ...formData, recorderName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                {/* 議事 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-700">議事</label>
                    <button
                      onClick={addAgendaItem}
                      className="text-sm text-[#00c4cc] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      議題を追加
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(formData.agenda || []).map((item, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">議題 {index + 1}</span>
                          <button
                            onClick={() => removeAgendaItem(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const newAgenda = [...(formData.agenda || [])];
                            newAgenda[index] = { ...item, title: e.target.value };
                            setFormData({ ...formData, agenda: newAgenda });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                          placeholder="議題タイトル"
                        />
                        <textarea
                          value={item.content || ''}
                          onChange={(e) => {
                            const newAgenda = [...(formData.agenda || [])];
                            newAgenda[index] = { ...item, content: e.target.value };
                            setFormData({ ...formData, agenda: newAgenda });
                          }}
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                          placeholder="議論内容"
                        />
                        <input
                          type="text"
                          value={item.decision || ''}
                          onChange={(e) => {
                            const newAgenda = [...(formData.agenda || [])];
                            newAgenda[index] = { ...item, decision: e.target.value };
                            setFormData({ ...formData, agenda: newAgenda });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="決定事項"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 決定事項 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">決定事項（まとめ）</label>
                  <textarea
                    value={formData.decisions || ''}
                    onChange={(e) => setFormData({ ...formData, decisions: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="会議での決定事項をまとめて記載"
                  />
                </div>

                {/* アクションアイテム */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-700">アクションアイテム</label>
                    <button
                      onClick={addActionItem}
                      className="text-sm text-[#00c4cc] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(formData.actionItems || []).map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={item.task}
                          onChange={(e) => {
                            const newItems = [...(formData.actionItems || [])];
                            newItems[index] = { ...item, task: e.target.value };
                            setFormData({ ...formData, actionItems: newItems });
                          }}
                          className="col-span-6 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="タスク"
                        />
                        <input
                          type="text"
                          value={item.assignee || ''}
                          onChange={(e) => {
                            const newItems = [...(formData.actionItems || [])];
                            newItems[index] = { ...item, assignee: e.target.value };
                            setFormData({ ...formData, actionItems: newItems });
                          }}
                          className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="担当者"
                        />
                        <input
                          type="date"
                          value={item.deadline || ''}
                          onChange={(e) => {
                            const newItems = [...(formData.actionItems || [])];
                            newItems[index] = { ...item, deadline: e.target.value };
                            setFormData({ ...formData, actionItems: newItems });
                          }}
                          className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 次回予定 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">次回開催予定</label>
                    <input
                      type="date"
                      value={formData.nextMeetingDate || ''}
                      onChange={(e) => setFormData({ ...formData, nextMeetingDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ステータス</label>
                    <select
                      value={formData.status || 'draft'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    >
                      <option value="draft">下書き</option>
                      <option value="finalized">確定</option>
                      <option value="approved">承認済み</option>
                    </select>
                  </div>
                </div>

                {/* 保存ボタン */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedMeeting ? (
            // 詳細表示
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${committeeTypes[selectedMeeting.committeeType].color}`}>
                      {committeeTypes[selectedMeeting.committeeType].shortLabel}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[selectedMeeting.status].color}`}>
                      {statusLabels[selectedMeeting.status].label}
                    </span>
                    {selectedMeeting.meetingType === 'extraordinary' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">臨時</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {selectedMeeting.committeeName || committeeTypes[selectedMeeting.committeeType].label}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedMeeting.meetingDate).toLocaleDateString('ja-JP')}
                    {selectedMeeting.startTime && selectedMeeting.endTime && (
                      <>
                        <Clock className="w-4 h-4 ml-2" />
                        {selectedMeeting.startTime} 〜 {selectedMeeting.endTime}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportPdf(selectedMeeting)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    PDF出力
                  </button>
                  <button
                    onClick={() => {
                      setFormData({ ...selectedMeeting });
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                    編集
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* 基本情報 */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedMeeting.location && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {selectedMeeting.location}
                    </div>
                  )}
                  {selectedMeeting.facilitatorName && (
                    <div className="text-gray-600">司会: {selectedMeeting.facilitatorName}</div>
                  )}
                  {selectedMeeting.recorderName && (
                    <div className="text-gray-600">記録: {selectedMeeting.recorderName}</div>
                  )}
                </div>

                {/* 議事 */}
                {selectedMeeting.agenda && selectedMeeting.agenda.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <ListChecks className="w-4 h-4" />
                      議事
                    </h3>
                    <div className="space-y-3">
                      {selectedMeeting.agenda.map((item, i) => (
                        <div key={i} className="bg-gray-50 p-3 rounded-lg">
                          <p className="font-medium text-gray-800">{i + 1}. {item.title}</p>
                          {item.content && (
                            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{item.content}</p>
                          )}
                          {item.decision && (
                            <p className="text-sm text-[#00c4cc] mt-2 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              {item.decision}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 決定事項 */}
                {selectedMeeting.decisions && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">決定事項</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-green-50 p-3 rounded-lg">
                      {selectedMeeting.decisions}
                    </p>
                  </div>
                )}

                {/* アクションアイテム */}
                {selectedMeeting.actionItems && selectedMeeting.actionItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      アクションアイテム
                    </h3>
                    <div className="space-y-2">
                      {selectedMeeting.actionItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-800">{item.task}</span>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {item.assignee && <span>担当: {item.assignee}</span>}
                            {item.deadline && <span>期限: {new Date(item.deadline).toLocaleDateString('ja-JP')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 次回予定 */}
                {selectedMeeting.nextMeetingDate && (
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-bold text-gray-700 mb-2">次回予定</h3>
                    <p className="text-gray-600">
                      {new Date(selectedMeeting.nextMeetingDate).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 未選択時
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>議事録を選択するか、新規議事録を作成してください</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
