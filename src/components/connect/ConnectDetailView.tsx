/**
 * 連絡会詳細ビュー
 * 回答状況マトリクス表示、推奨日程ハイライト、日程確定機能
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  MapPin,
  FileText,
  Mail,
  RefreshCw,
  AlertCircle,
  Check,
  HelpCircle,
  X,
  Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ConnectMeeting,
  ConnectMeetingDateOption,
  ConnectMeetingParticipant,
  ConnectMeetingResponse,
  ConnectMeetingStatus,
  ConnectResponseType,
} from '@/types';

interface ConnectDetailViewProps {
  meetingId: string;
  onBack: () => void;
  onUpdate: () => void;
}

type MeetingWithDetails = ConnectMeeting & {
  childName?: string;
  dateOptions: (ConnectMeetingDateOption & { responses: ConnectMeetingResponse[] })[];
  participants: (ConnectMeetingParticipant & { responses: ConnectMeetingResponse[] })[];
};

export default function ConnectDetailView({ meetingId, onBack, onUpdate }: ConnectDetailViewProps) {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<MeetingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useEffect(() => {
    fetchMeetingDetails();
  }, [meetingId]);

  const fetchMeetingDetails = async () => {
    setLoading(true);
    try {
      // 連絡会の基本情報を取得
      const { data: meetingData, error: meetingError } = await supabase
        .from('connect_meetings')
        .select(`
          *,
          children:child_id (id, name)
        `)
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;

      // 日程候補を取得
      const { data: dateOptions, error: dateError } = await supabase
        .from('connect_meeting_date_options')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('date', { ascending: true });

      if (dateError) throw dateError;

      // 参加者を取得
      const { data: participants, error: participantError } = await supabase
        .from('connect_meeting_participants')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (participantError) throw participantError;

      // 回答を取得
      const { data: responses, error: responseError } = await supabase
        .from('connect_meeting_responses')
        .select('*')
        .in('participant_id', participants?.map((p: any) => p.id) || []);

      if (responseError) throw responseError;

      // データを組み立て
      const dateOptionsWithResponses = (dateOptions || []).map((opt: any) => ({
        id: opt.id,
        meetingId: opt.meeting_id,
        date: opt.date,
        startTime: opt.start_time,
        endTime: opt.end_time,
        availableCount: opt.available_count || 0,
        maybeCount: opt.maybe_count || 0,
        unavailableCount: opt.unavailable_count || 0,
        createdAt: opt.created_at,
        updatedAt: opt.updated_at,
        responses: (responses || []).filter((r: any) => r.date_option_id === opt.id),
      }));

      const participantsWithResponses = (participants || []).map((p: any) => ({
        id: p.id,
        meetingId: p.meeting_id,
        organizationName: p.organization_name,
        representativeEmail: p.representative_email,
        representativeName: p.representative_name,
        accessToken: p.access_token,
        tokenExpiresAt: p.token_expires_at,
        status: p.status,
        respondedAt: p.responded_at,
        responderName: p.responder_name,
        invitationSentAt: p.invitation_sent_at,
        reminderSentAt: p.reminder_sent_at,
        confirmationSentAt: p.confirmation_sent_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        responses: (responses || []).filter((r: any) => r.participant_id === p.id).map((r: any) => ({
          id: r.id,
          participantId: r.participant_id,
          dateOptionId: r.date_option_id,
          response: r.response,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      }));

      setMeeting({
        id: meetingData.id,
        facilityId: meetingData.facility_id,
        childId: meetingData.child_id,
        title: meetingData.title,
        purpose: meetingData.purpose,
        location: meetingData.location,
        estimatedDuration: meetingData.estimated_duration,
        description: meetingData.description,
        status: meetingData.status,
        confirmedDateOptionId: meetingData.confirmed_date_option_id,
        confirmedAt: meetingData.confirmed_at,
        confirmedBy: meetingData.confirmed_by,
        createdBy: meetingData.created_by,
        createdAt: meetingData.created_at,
        updatedAt: meetingData.updated_at,
        childName: meetingData.children?.name,
        dateOptions: dateOptionsWithResponses,
        participants: participantsWithResponses,
      });
    } catch (err) {
      console.error('連絡会詳細取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // 回答を取得するヘルパー
  const getResponse = (participantId: string, dateOptionId: string): ConnectResponseType | null => {
    const participant = meeting?.participants.find((p) => p.id === participantId);
    const response = participant?.responses?.find((r) => r.dateOptionId === dateOptionId);
    return response?.response || null;
  };

  // 回答アイコン
  const ResponseIcon = ({ response }: { response: ConnectResponseType | null }) => {
    switch (response) {
      case 'available':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'maybe':
        return <HelpCircle className="w-5 h-5 text-yellow-600" />;
      case 'unavailable':
        return <X className="w-5 h-5 text-red-600" />;
      default:
        return <span className="w-5 h-5 text-gray-300">-</span>;
    }
  };

  // 推奨日程を判定（available が最も多い日程）
  const getRecommendedDateOptionId = (): string | null => {
    if (!meeting?.dateOptions.length) return null;

    let maxAvailable = -1;
    let recommendedId: string | null = null;

    meeting.dateOptions.forEach((opt) => {
      if (opt.availableCount > maxAvailable) {
        maxAvailable = opt.availableCount;
        recommendedId = opt.id;
      }
    });

    return recommendedId;
  };

  // 日程確定
  const handleConfirmDate = async (dateOptionId: string) => {
    if (!user?.id) return;

    if (!confirm('この日程で確定しますか？参加者に確定通知メールが送信されます。')) {
      return;
    }

    setConfirming(true);
    try {
      // 連絡会のステータスを更新
      const { error: updateError } = await supabase
        .from('connect_meetings')
        .update({
          status: 'confirmed',
          confirmed_date_option_id: dateOptionId,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
        })
        .eq('id', meetingId);

      if (updateError) throw updateError;

      // 確定通知メールを送信
      const confirmedOption = meeting?.dateOptions.find((o) => o.id === dateOptionId);
      if (meeting?.participants) {
        for (const participant of meeting.participants) {
          try {
            await fetch('/api/connect/send-confirmation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                location: meeting.location,
                participantEmail: participant.representativeEmail,
                participantName: participant.representativeName,
                organizationName: participant.organizationName,
                confirmedDate: confirmedOption?.date,
                confirmedStartTime: confirmedOption?.startTime,
                confirmedEndTime: confirmedOption?.endTime,
              }),
            });

            // 確定通知送信日時を更新
            await supabase
              .from('connect_meeting_participants')
              .update({ confirmation_sent_at: new Date().toISOString() })
              .eq('id', participant.id);
          } catch (emailError) {
            console.error('確定通知メール送信エラー:', emailError);
          }
        }
      }

      await fetchMeetingDetails();
      onUpdate();
      alert('日程を確定しました。参加者に通知メールを送信しました。');
    } catch (err: any) {
      console.error('日程確定エラー:', err);
      alert('日程の確定に失敗しました: ' + err.message);
    } finally {
      setConfirming(false);
    }
  };

  // リマインダー送信
  const handleSendReminder = async (participantId: string) => {
    const participant = meeting?.participants.find((p) => p.id === participantId);
    if (!participant || !meeting) return;

    setSendingReminder(participantId);
    try {
      await fetch('/api/connect/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          purpose: meeting.purpose,
          location: meeting.location,
          childName: meeting.childName || '',
          participantEmail: participant.representativeEmail,
          participantName: participant.representativeName,
          organizationName: participant.organizationName,
          accessToken: participant.accessToken,
          dateOptions: meeting.dateOptions.map((o) => ({
            date: o.date,
            startTime: o.startTime,
            endTime: o.endTime,
          })),
          isReminder: true,
        }),
      });

      // リマインダー送信日時を更新
      await supabase
        .from('connect_meeting_participants')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', participantId);

      await fetchMeetingDetails();
      alert('リマインダーを送信しました');
    } catch (err: any) {
      console.error('リマインダー送信エラー:', err);
      alert('リマインダーの送信に失敗しました');
    } finally {
      setSendingReminder(null);
    }
  };

  // ステータスバッジ
  const getStatusBadge = (status: ConnectMeetingStatus) => {
    switch (status) {
      case 'scheduling':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4" />
            日程調整中
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <Calendar className="w-4 h-4" />
            日程確定
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4" />
            開催完了
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            <XCircle className="w-4 h-4" />
            キャンセル
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>連絡会が見つかりません</p>
        <button onClick={onBack} className="mt-4 text-cyan-500 hover:underline">
          一覧に戻る
        </button>
      </div>
    );
  }

  const recommendedDateOptionId = getRecommendedDateOptionId();
  const confirmedOption = meeting.dateOptions.find((o) => o.id === meeting.confirmedDateOptionId);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">一覧に戻る</span>
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {getStatusBadge(meeting.status)}
            </div>
            <h2 className="text-xl font-bold text-gray-800">{meeting.title}</h2>
            <p className="text-sm text-gray-500 mt-1">対象児童: {meeting.childName || '-'}</p>
          </div>
        </div>

        {/* 確定日程の表示 */}
        {meeting.status === 'confirmed' && confirmedOption && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              確定日程
            </h4>
            <p className="text-blue-900 font-medium">
              {new Date(confirmedOption.date).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })}{' '}
              {confirmedOption.startTime}
              {confirmedOption.endTime && ` - ${confirmedOption.endTime}`}
            </p>
          </div>
        )}

        {/* 基本情報 */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          {meeting.purpose && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <span className="text-gray-500">目的:</span>
                <span className="ml-2 text-gray-800">{meeting.purpose}</span>
              </div>
            </div>
          )}
          {meeting.location && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <span className="text-gray-500">場所:</span>
                <span className="ml-2 text-gray-800">{meeting.location}</span>
              </div>
            </div>
          )}
          {meeting.estimatedDuration && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <span className="text-gray-500">所要時間:</span>
                <span className="ml-2 text-gray-800">{meeting.estimatedDuration}分</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 回答状況マトリクス */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-500" />
          回答状況
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-200 bg-gray-50 p-3 text-left text-sm font-medium text-gray-600">
                  参加者
                </th>
                {meeting.dateOptions.map((opt) => {
                  const isRecommended = opt.id === recommendedDateOptionId;
                  const isConfirmed = opt.id === meeting.confirmedDateOptionId;
                  return (
                    <th
                      key={opt.id}
                      className={`border border-gray-200 p-3 text-center text-sm font-medium min-w-[120px] ${
                        isConfirmed
                          ? 'bg-blue-100'
                          : isRecommended
                          ? 'bg-green-50'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        {isConfirmed && (
                          <span className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            確定
                          </span>
                        )}
                        {!isConfirmed && isRecommended && (
                          <span className="text-xs text-green-600 mb-1 flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            推奨
                          </span>
                        )}
                        <span className="text-gray-700">
                          {new Date(opt.date).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                        </span>
                        <span className="text-xs text-gray-500">{opt.startTime}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {meeting.participants.map((participant) => (
                <tr key={participant.id}>
                  <td className="border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800 text-sm">
                          {participant.organizationName}
                        </div>
                        {participant.representativeName && (
                          <div className="text-xs text-gray-500">
                            {participant.representativeName}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {participant.status === 'responded' ? (
                            <span className="text-green-600">回答済み</span>
                          ) : (
                            <span className="text-yellow-600">未回答</span>
                          )}
                        </div>
                      </div>
                      {participant.status === 'pending' && meeting.status === 'scheduling' && (
                        <button
                          onClick={() => handleSendReminder(participant.id)}
                          disabled={sendingReminder === participant.id}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${sendingReminder === participant.id ? 'animate-spin' : ''}`}
                          />
                          リマインド
                        </button>
                      )}
                    </div>
                  </td>
                  {meeting.dateOptions.map((opt) => {
                    const response = getResponse(participant.id, opt.id);
                    const isConfirmed = opt.id === meeting.confirmedDateOptionId;
                    return (
                      <td
                        key={opt.id}
                        className={`border border-gray-200 p-3 text-center ${
                          isConfirmed ? 'bg-blue-50' : ''
                        }`}
                      >
                        <ResponseIcon response={response} />
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* 集計行 */}
              <tr className="bg-gray-50 font-medium">
                <td className="border border-gray-200 p-3 text-sm text-gray-600">集計</td>
                {meeting.dateOptions.map((opt) => {
                  const isConfirmed = opt.id === meeting.confirmedDateOptionId;
                  return (
                    <td
                      key={opt.id}
                      className={`border border-gray-200 p-3 text-center ${
                        isConfirmed ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="text-green-600 flex items-center gap-0.5">
                          <Check className="w-3 h-3" />
                          {opt.availableCount}
                        </span>
                        <span className="text-yellow-600 flex items-center gap-0.5">
                          <HelpCircle className="w-3 h-3" />
                          {opt.maybeCount}
                        </span>
                        <span className="text-red-600 flex items-center gap-0.5">
                          <X className="w-3 h-3" />
                          {opt.unavailableCount}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* 確定ボタン行 */}
              {meeting.status === 'scheduling' && (
                <tr>
                  <td className="border border-gray-200 p-3 text-sm text-gray-600">日程確定</td>
                  {meeting.dateOptions.map((opt) => (
                    <td key={opt.id} className="border border-gray-200 p-3 text-center">
                      <button
                        onClick={() => handleConfirmDate(opt.id)}
                        disabled={confirming}
                        className="text-xs px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors disabled:opacity-50"
                      >
                        確定
                      </button>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 凡例 */}
        <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Check className="w-4 h-4 text-green-600" />
            参加可能
          </div>
          <div className="flex items-center gap-1">
            <HelpCircle className="w-4 h-4 text-yellow-600" />
            調整可能
          </div>
          <div className="flex items-center gap-1">
            <X className="w-4 h-4 text-red-600" />
            参加不可
          </div>
        </div>
      </div>

      {/* 参加者一覧 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-500" />
          参加者 ({meeting.participants.length}名)
        </h3>

        <div className="space-y-3">
          {meeting.participants.map((participant) => (
            <div
              key={participant.id}
              className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-800">{participant.organizationName}</p>
                {participant.representativeName && (
                  <p className="text-sm text-gray-600">{participant.representativeName}</p>
                )}
                <p className="text-xs text-gray-400">{participant.representativeEmail}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    participant.status === 'responded'
                      ? 'bg-green-100 text-green-700'
                      : participant.status === 'declined'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {participant.status === 'responded'
                    ? '回答済み'
                    : participant.status === 'declined'
                    ? '辞退'
                    : '未回答'}
                </span>
                {participant.respondedAt && (
                  <span className="text-xs text-gray-400">
                    {new Date(participant.respondedAt).toLocaleDateString('ja-JP')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
