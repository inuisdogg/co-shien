'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
  finalized: { label: '確定', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText },
  approved: { label: '承認済', color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle },
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

export default function CommitteeView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [meetings, setMeetings] = useState<CommitteeMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<CommitteeType | 'all'>('all');
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    const fetch = async () => {
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
    };
    fetch();
  }, [facilityId]);

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
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-cyan-500" />
        <h1 className="text-xl font-bold text-gray-800">委員会管理</h1>
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
