/**
 * 施設への連絡ページ（利用者側）
 * 欠席連絡、利用希望、メッセージ送信
 * チャット/メッセージ風の親しみやすいUI
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Building2, Calendar, XCircle, Send, CheckCircle,
  AlertCircle, Clock, User, MessageSquare, Heart, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type ContactType = 'absence' | 'schedule' | 'message';

// クイックテンプレート
const MESSAGE_TEMPLATES = [
  { label: '体調不良', text: '本日、体調不良のためお休みさせていただきます。' },
  { label: '食事の変更', text: '食事について相談があります。アレルギーの件でお知らせしたいことがございます。' },
  { label: '送迎変更', text: '本日の送迎時間を変更させていただきたいです。' },
  { label: '活動の様子', text: '最近の活動の様子について教えていただけますでしょうか。' },
  { label: '連絡事項', text: '以下の件についてご連絡いたします。' },
];

export default function FacilityContactPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const facilityId = params.facilityId as string;
  const childIdParam = searchParams.get('child');
  const typeParam = searchParams.get('type') as ContactType || 'message';

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [contactType, setContactType] = useState<ContactType>(typeParam);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // フォームデータ
  const [absenceDate, setAbsenceDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleSlot, setScheduleSlot] = useState<'AM' | 'PM' | 'AMPM'>('PM');
  const [scheduleReason, setScheduleReason] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/parent/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (user.userType !== 'client') {
          router.push('/career');
          return;
        }

        setCurrentUser(user);

        // 施設情報を取得
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single();

        if (facilityData) {
          setFacility(facilityData);
        }

        // 自分の児童を取得
        const { data: childrenData } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', user.id);

        if (childrenData && childrenData.length > 0) {
          setChildren(childrenData);

          // この施設との契約を持つ児童を取得
          const childIds = childrenData.map((c: any) => c.id);
          const { data: contractsData } = await supabase
            .from('contracts')
            .select('child_id')
            .in('child_id', childIds)
            .eq('facility_id', facilityId)
            .eq('status', 'active');

          if (contractsData && contractsData.length > 0) {
            const contractedChildIds = contractsData.map((c: any) => c.child_id);
            const contractedChildren = childrenData.filter((c: any) => contractedChildIds.includes(c.id));
            setChildren(contractedChildren);

            // 選択する児童を決定
            if (childIdParam && contractedChildIds.includes(childIdParam)) {
              setSelectedChildId(childIdParam);
            } else if (contractedChildren.length > 0) {
              setSelectedChildId(contractedChildren[0].id);
            }
          }
        }

        // デフォルトの日付を設定
        const today = new Date().toISOString().split('T')[0];
        setAbsenceDate(today);
        setScheduleDate(today);
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId, childIdParam, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const selectedChild = children.find(c => c.id === selectedChildId);

      if (contactType === 'absence') {
        // 欠席連絡の場合、該当日のスケジュールを更新
        const { data: existingSchedule } = await supabase
          .from('schedules')
          .select('*')
          .eq('child_id', selectedChildId)
          .eq('facility_id', facilityId)
          .eq('date', absenceDate)
          .single();

        if (existingSchedule) {
          await supabase
            .from('schedules')
            .update({
              service_status: '欠席(加算なし)',
              absence_reason: absenceReason,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSchedule.id);
        } else {
          await supabase
            .from('schedules')
            .insert({
              id: `${selectedChildId}-${absenceDate}-absence`,
              facility_id: facilityId,
              child_id: selectedChildId,
              child_name: selectedChild?.name || '',
              date: absenceDate,
              slot: 'PM',
              service_status: '欠席(加算なし)',
              absence_reason: absenceReason,
              created_at: new Date().toISOString(),
            });
        }
      } else if (contactType === 'schedule') {
        // 利用希望の場合、スケジュールを追加
        const slots = scheduleSlot === 'AMPM' ? ['AM', 'PM'] : [scheduleSlot];

        for (const slot of slots) {
          await supabase
            .from('schedules')
            .upsert({
              id: `${selectedChildId}-${scheduleDate}-${slot}-request`,
              facility_id: facilityId,
              child_id: selectedChildId,
              child_name: selectedChild?.name || '',
              date: scheduleDate,
              slot: slot,
              request_status: 'pending',
              request_reason: scheduleReason,
              created_at: new Date().toISOString(),
            }, { onConflict: 'id' });
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/parent/facilities/${facilityId}?child=${selectedChildId}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || '送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);
  const today = new Date();
  const dateStr = today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-white rounded-xl" />
            <div className="h-40 bg-white rounded-xl" />
            <div className="h-12 bg-gray-200 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">送信しました</h2>
          <p className="text-gray-600 mb-2">
            {contactType === 'absence' ? '欠席連絡' : contactType === 'schedule' ? '利用希望' : 'メッセージ'}を{facility?.name}に送信しました。
          </p>
          <p className="text-sm text-gray-400">施設の詳細ページに戻ります...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー: チャットアプリ風 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/parent/facilities/${facilityId}?child=${selectedChildId}`)}
              className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 bg-[#F6AD55]/10 rounded-full flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-[#F6AD55]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-800 text-sm truncate">{facility?.name || '施設'}</h1>
              <p className="text-xs text-gray-500">{dateStr}</p>
            </div>
            {selectedChild && (
              <div className="flex items-center gap-2 bg-[#F6AD55]/10 rounded-full px-3 py-1">
                <User size={14} className="text-[#F6AD55]" />
                <span className="text-xs font-medium text-gray-700">{selectedChild.name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">送信できませんでした</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* 児童選択（複数の場合） */}
        {children.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 mb-2">お子様を選択</label>
            <div className="flex gap-2 flex-wrap">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                    selectedChildId === child.id
                      ? 'border-[#F6AD55] bg-[#F6AD55]/10 text-[#D97706]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <User size={16} />
                  {child.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 連絡タイプ選択: カード型 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <label className="block text-xs font-bold text-gray-500 mb-3">連絡の種類</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setContactType('absence')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                contactType === 'absence'
                  ? 'border-red-400 bg-red-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                contactType === 'absence' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                <XCircle size={20} className={contactType === 'absence' ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <span className={`text-sm font-bold ${contactType === 'absence' ? 'text-red-800' : 'text-gray-600'}`}>
                欠席連絡
              </span>
            </button>
            <button
              type="button"
              onClick={() => setContactType('schedule')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                contactType === 'schedule'
                  ? 'border-blue-400 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                contactType === 'schedule' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Calendar size={20} className={contactType === 'schedule' ? 'text-blue-600' : 'text-gray-400'} />
              </div>
              <span className={`text-sm font-bold ${contactType === 'schedule' ? 'text-blue-800' : 'text-gray-600'}`}>
                利用希望
              </span>
            </button>
            <button
              type="button"
              onClick={() => setContactType('message')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                contactType === 'message'
                  ? 'border-[#F6AD55] bg-orange-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                contactType === 'message' ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                <MessageSquare size={20} className={contactType === 'message' ? 'text-[#F6AD55]' : 'text-gray-400'} />
              </div>
              <span className={`text-sm font-bold ${contactType === 'message' ? 'text-orange-800' : 'text-gray-600'}`}>
                メッセージ
              </span>
            </button>
          </div>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* 欠席連絡フォーム */}
          {contactType === 'absence' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">欠席日</label>
                <input
                  type="date"
                  value={absenceDate}
                  onChange={(e) => setAbsenceDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">欠席理由</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {['体調不良', '家庭の事情', '学校行事', '通院', 'その他'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAbsenceReason(reason)}
                      className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        absenceReason === reason
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 利用希望フォーム */}
          {contactType === 'schedule' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">希望日</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">希望時間帯</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'AM', label: '午前', sub: '9:00-12:00' },
                    { value: 'PM', label: '午後', sub: '13:00-17:00' },
                    { value: 'AMPM', label: '終日', sub: '9:00-17:00' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setScheduleSlot(option.value as 'AM' | 'PM' | 'AMPM')}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        scheduleSlot === option.value
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-bold ${scheduleSlot === option.value ? 'text-blue-800' : 'text-gray-600'}`}>
                        {option.label}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${scheduleSlot === option.value ? 'text-blue-500' : 'text-gray-400'}`}>
                        {option.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">希望理由（任意）</label>
                <textarea
                  value={scheduleReason}
                  onChange={(e) => setScheduleReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 text-base"
                  rows={3}
                  placeholder="追加利用や振替の理由があれば入力してください"
                />
              </div>
            </>
          )}

          {/* メッセージフォーム */}
          {contactType === 'message' && (
            <div className="space-y-4">
              {/* クイックテンプレート */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">よく使うテンプレート</label>
                <div className="flex flex-wrap gap-2">
                  {MESSAGE_TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => setMessage(template.text)}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-[#F6AD55]/10 border border-gray-200 hover:border-[#F6AD55]/30 rounded-full text-xs font-medium text-gray-600 hover:text-[#D97706] transition-all"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">メッセージ</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F6AD55]/30 focus:border-[#F6AD55] text-base"
                  rows={6}
                  placeholder="施設へのメッセージを入力してください..."
                  required
                />
                <p className="text-xs text-gray-400 mt-1.5 text-right">
                  {message.length} 文字
                </p>
              </div>
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={submitting || (contactType === 'absence' && !absenceReason)}
            className={`w-full font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-base ${
              contactType === 'absence'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : contactType === 'schedule'
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-[#F6AD55] hover:bg-[#ED8936] text-white'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {contactType === 'absence' ? '欠席連絡を送信' : contactType === 'schedule' ? '利用希望を送信' : 'メッセージを送信'}
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
