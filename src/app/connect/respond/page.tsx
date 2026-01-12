/**
 * 外部参加者向け日程回答ページ
 * トークンベースのアクセス（アカウント不要）
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Calendar,
  MapPin,
  Clock,
  FileText,
  Check,
  HelpCircle,
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConnectResponseType } from '@/types';

type DateOptionWithResponse = {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  response: ConnectResponseType | null;
};

type MeetingInfo = {
  id: string;
  title: string;
  purpose: string | null;
  location: string | null;
  estimatedDuration: number | null;
  description: string | null;
  status: string;
  childName: string | null;
};

type ParticipantInfo = {
  id: string;
  organizationName: string;
  representativeName: string | null;
  status: string;
  respondedAt: string | null;
};

function ConnectResponseContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [dateOptions, setDateOptions] = useState<DateOptionWithResponse[]>([]);
  const [responses, setResponses] = useState<Record<string, ConnectResponseType>>({});
  const [responderName, setResponderName] = useState('');

  useEffect(() => {
    if (token) {
      fetchMeetingData();
    } else {
      setError('無効なアクセスです。招待リンクをご確認ください。');
      setLoading(false);
    }
  }, [token]);

  const fetchMeetingData = async () => {
    setLoading(true);
    try {
      // トークンで参加者を検索
      const { data: participantData, error: participantError } = await supabase
        .from('connect_meeting_participants')
        .select('*')
        .eq('access_token', token)
        .single();

      if (participantError || !participantData) {
        setError('招待が見つかりません。リンクが無効か、期限切れの可能性があります。');
        setLoading(false);
        return;
      }

      // トークンの有効期限をチェック
      if (new Date(participantData.token_expires_at) < new Date()) {
        setError('この招待リンクは期限切れです。施設にお問い合わせください。');
        setLoading(false);
        return;
      }

      setParticipant({
        id: participantData.id,
        organizationName: participantData.organization_name,
        representativeName: participantData.representative_name,
        status: participantData.status,
        respondedAt: participantData.responded_at,
      });
      setResponderName(participantData.responder_name || participantData.representative_name || '');

      // 連絡会情報を取得
      const { data: meetingData, error: meetingError } = await supabase
        .from('connect_meetings')
        .select(`
          *,
          children:child_id (name)
        `)
        .eq('id', participantData.meeting_id)
        .single();

      if (meetingError || !meetingData) {
        setError('連絡会が見つかりません。');
        setLoading(false);
        return;
      }

      // 確定済みまたはキャンセルの場合
      if (meetingData.status === 'confirmed') {
        setError('この連絡会は既に日程が確定しています。');
        setLoading(false);
        return;
      }
      if (meetingData.status === 'cancelled') {
        setError('この連絡会はキャンセルされました。');
        setLoading(false);
        return;
      }

      setMeeting({
        id: meetingData.id,
        title: meetingData.title,
        purpose: meetingData.purpose,
        location: meetingData.location,
        estimatedDuration: meetingData.estimated_duration,
        description: meetingData.description,
        status: meetingData.status,
        childName: meetingData.children?.name || null,
      });

      // 日程候補を取得
      const { data: dateOptionsData, error: dateOptionsError } = await supabase
        .from('connect_meeting_date_options')
        .select('*')
        .eq('meeting_id', participantData.meeting_id)
        .order('date', { ascending: true });

      if (dateOptionsError) {
        console.error('日程候補取得エラー:', dateOptionsError);
      }

      // 既存の回答を取得
      const { data: existingResponses, error: responsesError } = await supabase
        .from('connect_meeting_responses')
        .select('*')
        .eq('participant_id', participantData.id);

      if (responsesError) {
        console.error('回答取得エラー:', responsesError);
      }

      // 回答をマッピング
      const responseMap: Record<string, ConnectResponseType> = {};
      (existingResponses || []).forEach((r: any) => {
        responseMap[r.date_option_id] = r.response;
      });
      setResponses(responseMap);

      setDateOptions(
        (dateOptionsData || []).map((opt: any) => ({
          id: opt.id,
          date: opt.date,
          startTime: opt.start_time,
          endTime: opt.end_time,
          response: responseMap[opt.id] || null,
        }))
      );
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (dateOptionId: string, response: ConnectResponseType) => {
    setResponses((prev) => ({
      ...prev,
      [dateOptionId]: response,
    }));
  };

  const handleSubmit = async () => {
    if (!participant || !meeting) return;

    // 全ての日程に回答しているか確認
    const allAnswered = dateOptions.every((opt) => responses[opt.id]);
    if (!allAnswered) {
      alert('すべての日程候補に回答してください。');
      return;
    }

    if (!responderName.trim()) {
      alert('回答者名を入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      // 既存の回答を削除
      await supabase
        .from('connect_meeting_responses')
        .delete()
        .eq('participant_id', participant.id);

      // 新しい回答を挿入
      const responsesToInsert = Object.entries(responses).map(([dateOptionId, response]) => ({
        participant_id: participant.id,
        date_option_id: dateOptionId,
        response,
      }));

      const { error: insertError } = await supabase
        .from('connect_meeting_responses')
        .insert(responsesToInsert);

      if (insertError) throw insertError;

      // 参加者のステータスを更新
      const { error: updateError } = await supabase
        .from('connect_meeting_participants')
        .update({
          status: 'responded',
          responded_at: new Date().toISOString(),
          responder_name: responderName.trim(),
        })
        .eq('id', participant.id);

      if (updateError) throw updateError;

      setSuccess(true);
    } catch (err: any) {
      console.error('回答送信エラー:', err);
      alert('回答の送信に失敗しました: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 成功画面
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">回答を送信しました</h2>
          <p className="text-gray-600 mb-6">
            ご回答いただきありがとうございます。<br />
            日程が確定次第、メールでご連絡いたします。
          </p>
          <p className="text-sm text-gray-400">このページを閉じても問題ありません。</p>
        </div>
      </div>
    );
  }

  // エラー画面
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">アクセスエラー</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // ローディング画面
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <Image
            src="/logo-cropped-center.png"
            alt="co-shien"
            width={150}
            height={48}
            className="h-10 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">日程調整のご協力</h1>
        </div>

        {/* 連絡会情報 */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{meeting?.title}</h2>

          <div className="space-y-3 text-sm">
            {meeting?.purpose && (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">目的:</span>
                  <span className="ml-2 text-gray-800">{meeting.purpose}</span>
                </div>
              </div>
            )}
            {meeting?.location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">場所:</span>
                  <span className="ml-2 text-gray-800">{meeting.location}</span>
                </div>
              </div>
            )}
            {meeting?.estimatedDuration && (
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">所要時間:</span>
                  <span className="ml-2 text-gray-800">{meeting.estimatedDuration}分</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 回答フォーム */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-500" />
            日程候補
          </h3>

          <p className="text-sm text-gray-600 mb-4">
            各日程について、参加可否を選択してください。
          </p>

          <div className="space-y-4">
            {dateOptions.map((opt) => {
              const dateStr = new Date(opt.date).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              });
              const timeStr = opt.endTime
                ? `${opt.startTime} - ${opt.endTime}`
                : opt.startTime;
              const selected = responses[opt.id];

              return (
                <div key={opt.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-3">
                    <div className="font-medium text-gray-800">{dateStr}</div>
                    <div className="text-sm text-gray-500">{timeStr}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResponseChange(opt.id, 'available')}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        selected === 'available'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      参加可能
                    </button>
                    <button
                      onClick={() => handleResponseChange(opt.id, 'maybe')}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        selected === 'maybe'
                          ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-yellow-300'
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                      調整可能
                    </button>
                    <button
                      onClick={() => handleResponseChange(opt.id, 'unavailable')}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        selected === 'unavailable'
                          ? 'bg-red-50 border-red-500 text-red-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      参加不可
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 回答者情報 */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-md font-bold text-gray-800 mb-4">回答者情報</h3>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">所属</label>
            <div className="text-gray-800 font-medium">{participant?.organizationName}</div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              回答者名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="お名前を入力してください"
              value={responderName}
              onChange={(e) => setResponderName(e.target.value)}
            />
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !responderName.trim() || !dateOptions.every((opt) => responses[opt.id])}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '送信中...' : '回答を送信'}
        </button>

        {/* 注意事項 */}
        <p className="text-xs text-gray-500 text-center mt-4">
          送信後も、このリンクから回答を修正できます。
        </p>
      </div>
    </div>
  );
}

export default function ConnectResponsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    }>
      <ConnectResponseContent />
    </Suspense>
  );
}
