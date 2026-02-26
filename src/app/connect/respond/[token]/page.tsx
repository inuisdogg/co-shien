'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ConnectResponseType } from '@/types';

type DateOptionForResponse = {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
};

type ParticipantInfo = {
  id: string;
  meetingId: string;
  organizationName: string;
  representativeName: string | null;
  tokenExpiresAt: string;
  status: string;
};

type MeetingInfo = {
  id: string;
  title: string;
  purpose: string | null;
  location: string | null;
  estimatedDuration: number | null;
  description: string | null;
  facilityName: string;
};

type ResponseMap = Record<string, ConnectResponseType>;

export default function ConnectRespondPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [dateOptions, setDateOptions] = useState<DateOptionForResponse[]>([]);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [responderName, setResponderName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) {
      setError('このリンクは無効です');
      setLoading(false);
      return;
    }

    try {
      // トークンで参加者を検索
      const { data: participantData, error: pError } = await supabase
        .from('connect_meeting_participants')
        .select('*')
        .eq('access_token', token)
        .single();

      if (pError || !participantData) {
        setError('このリンクは無効です');
        setLoading(false);
        return;
      }

      // トークン期限チェック
      if (new Date(participantData.token_expires_at) < new Date()) {
        setError('このリンクは期限切れです');
        setLoading(false);
        return;
      }

      const pInfo: ParticipantInfo = {
        id: participantData.id,
        meetingId: participantData.meeting_id,
        organizationName: participantData.organization_name,
        representativeName: participantData.representative_name,
        tokenExpiresAt: participantData.token_expires_at,
        status: participantData.status,
      };
      setParticipant(pInfo);
      setResponderName(participantData.responder_name || participantData.representative_name || '');

      // 会議情報を取得
      const { data: meetingData, error: mError } = await supabase
        .from('connect_meetings')
        .select('id, title, purpose, location, estimated_duration, description, facility_id')
        .eq('id', participantData.meeting_id)
        .single();

      if (mError || !meetingData) {
        setError('会議情報の取得に失敗しました');
        setLoading(false);
        return;
      }

      // 施設名を取得
      const { data: facilityData } = await supabase
        .from('facilities')
        .select('name')
        .eq('id', meetingData.facility_id)
        .single();

      setMeeting({
        id: meetingData.id,
        title: meetingData.title,
        purpose: meetingData.purpose,
        location: meetingData.location,
        estimatedDuration: meetingData.estimated_duration,
        description: meetingData.description,
        facilityName: facilityData?.name || '施設',
      });

      // 日程候補を取得
      const { data: optionsData } = await supabase
        .from('connect_meeting_date_options')
        .select('*')
        .eq('meeting_id', participantData.meeting_id)
        .order('date', { ascending: true });

      const options: DateOptionForResponse[] = (optionsData || []).map((o: Record<string, unknown>) => ({
        id: o.id as string,
        date: o.date as string,
        startTime: o.start_time as string,
        endTime: o.end_time as string | null,
      }));
      setDateOptions(options);

      // 既存の回答を取得
      const { data: existingResponses } = await supabase
        .from('connect_meeting_responses')
        .select('*')
        .eq('participant_id', participantData.id);

      if (existingResponses && existingResponses.length > 0) {
        setAlreadyResponded(true);
        const rMap: ResponseMap = {};
        existingResponses.forEach((r: Record<string, unknown>) => {
          rMap[r.date_option_id as string] = r.response as ConnectResponseType;
        });
        setResponses(rMap);
      }
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResponseChange = (dateOptionId: string, response: ConnectResponseType) => {
    setResponses(prev => ({ ...prev, [dateOptionId]: response }));
  };

  const handleSubmit = async () => {
    if (!participant) return;

    // 全ての日程に回答しているかチェック
    const unanswered = dateOptions.filter(o => !responses[o.id]);
    if (unanswered.length > 0) {
      alert('すべての候補日程に回答してください。');
      return;
    }

    if (!responderName.trim()) {
      alert('回答者名を入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      // 回答をupsert
      for (const option of dateOptions) {
        const response = responses[option.id];
        if (!response) continue;

        // 既存の回答を確認
        const { data: existing } = await supabase
          .from('connect_meeting_responses')
          .select('id')
          .eq('participant_id', participant.id)
          .eq('date_option_id', option.id)
          .single();

        if (existing) {
          await supabase
            .from('connect_meeting_responses')
            .update({ response, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('connect_meeting_responses')
            .insert({
              participant_id: participant.id,
              date_option_id: option.id,
              response,
            });
        }
      }

      // 参加者ステータスを更新
      await supabase
        .from('connect_meeting_participants')
        .update({
          status: 'responded',
          responded_at: new Date().toISOString(),
          responder_name: responderName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', participant.id);

      setSubmitted(true);
    } catch {
      alert('回答の送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  // ローディング
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent border-[#00c4cc] rounded-full animate-spin" />
      </div>
    );
  }

  // エラー
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#00c4cc] py-6 px-4 text-center">
          <h1 className="text-white text-lg font-bold">Roots 連絡会議</h1>
        </div>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-2xl">!</span>
            </div>
            <p className="text-gray-700 text-lg font-medium">{error}</p>
            <p className="text-gray-400 text-sm mt-2">お手数ですが、送信元にお問い合わせください。</p>
          </div>
        </div>
      </div>
    );
  }

  // 送信完了
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#00c4cc] py-6 px-4 text-center">
          <h1 className="text-white text-lg font-bold">Roots 連絡会議</h1>
        </div>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-500 text-3xl">&#10003;</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">回答ありがとうございます</h2>
            <p className="text-gray-500">日程の回答を受け付けました。</p>
            <p className="text-gray-400 text-sm mt-4">日程が確定次第、ご連絡いたします。</p>
          </div>
        </div>
      </div>
    );
  }

  // 回答フォーム
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-[#00c4cc] py-6 px-4 text-center">
        <h1 className="text-white text-lg font-bold">Roots 連絡会議 日程回答</h1>
      </div>

      <div className="max-w-lg mx-auto py-8 px-4">
        {/* 会議情報 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">{meeting?.title}</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-medium text-gray-700">施設:</span> {meeting?.facilityName}</p>
            <p><span className="font-medium text-gray-700">対象:</span> 対象のお子様について</p>
            {meeting?.purpose && (
              <p><span className="font-medium text-gray-700">目的:</span> {meeting.purpose}</p>
            )}
            {meeting?.location && (
              <p><span className="font-medium text-gray-700">場所:</span> {meeting.location}</p>
            )}
            {meeting?.estimatedDuration && (
              <p><span className="font-medium text-gray-700">所要時間:</span> {meeting.estimatedDuration}分</p>
            )}
            {meeting?.description && (
              <p className="mt-2 text-gray-500">{meeting.description}</p>
            )}
          </div>
        </div>

        {/* 既に回答済みの通知 */}
        {alreadyResponded && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-700 text-sm font-medium">既に回答済みです。回答を更新する場合は、下記の内容を変更して再送信してください。</p>
          </div>
        )}

        {/* 日程候補 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">候補日程</h3>
          <p className="text-sm text-gray-500 mb-4">各候補日程に対してご都合をお選びください。</p>

          <div className="space-y-4">
            {dateOptions.map((option) => (
              <div key={option.id} className="border border-gray-200 rounded-lg p-4">
                <div className="font-medium text-gray-800 mb-3">
                  {formatDate(option.date)} {formatTime(option.startTime)}
                  {option.endTime ? `〜${formatTime(option.endTime)}` : ''}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResponseChange(option.id, 'available')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      responses[option.id] === 'available'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                    }`}
                  >
                    &#9675; 参加可能
                  </button>
                  <button
                    onClick={() => handleResponseChange(option.id, 'maybe')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      responses[option.id] === 'maybe'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-yellow-50'
                    }`}
                  >
                    &#9651; 調整可能
                  </button>
                  <button
                    onClick={() => handleResponseChange(option.id, 'unavailable')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      responses[option.id] === 'unavailable'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                    }`}
                  >
                    &#10005; 不可
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 回答者名 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">回答者名</h3>
          <input
            type="text"
            value={responderName}
            onChange={(e) => setResponderName(e.target.value)}
            placeholder="お名前を入力してください"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
          />
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-[#00c4cc] text-white font-bold py-4 rounded-xl hover:bg-[#00b0b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '送信中...' : alreadyResponded ? '回答を更新する' : '回答を送信する'}
        </button>
      </div>
    </div>
  );
}
