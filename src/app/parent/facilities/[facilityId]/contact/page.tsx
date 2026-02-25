/**
 * 施設への連絡ページ（利用者側）
 * 欠席連絡、利用希望、メッセージ送信
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Building2, Calendar, XCircle, Send, CheckCircle,
  AlertCircle, Clock, User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type ContactType = 'absence' | 'schedule' | 'message';

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

      // 連絡データを作成
      const contactData = {
        id: `contact-${Date.now()}`,
        facility_id: facilityId,
        child_id: selectedChildId,
        child_name: selectedChild?.name || '',
        contact_type: contactType,
        status: 'pending',
        created_by: currentUser?.id,
        created_at: new Date().toISOString(),
        ...(contactType === 'absence' && {
          absence_date: absenceDate,
          absence_reason: absenceReason,
        }),
        ...(contactType === 'schedule' && {
          schedule_date: scheduleDate,
          schedule_slot: scheduleSlot,
          schedule_reason: scheduleReason,
        }),
        ...(contactType === 'message' && {
          message: message,
        }),
      };

      // client_contacts テーブルに保存（テーブルがない場合は作成が必要）
      // 現在はschedulesテーブルを使って欠席や追加利用を処理

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
          // 既存のスケジュールがある場合は更新
          await supabase
            .from('schedules')
            .update({
              service_status: '欠席(加算なし)',
              absence_reason: absenceReason,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSchedule.id);
        } else {
          // スケジュールがない場合は新規作成
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
        // 利用希望の場合、スケジュールを追加（status: pending）
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

      // メッセージの場合は別途処理（今後の拡張）
      // TODO: messagesテーブルへの保存

      setSuccess(true);
      setTimeout(() => {
        router.push(`/parent/facilities/${facilityId}?child=${selectedChildId}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const getContactTypeInfo = () => {
    switch (contactType) {
      case 'absence':
        return {
          title: '欠席連絡',
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
        };
      case 'schedule':
        return {
          title: '利用希望',
          icon: Calendar,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        };
      case 'message':
        return {
          title: 'メッセージ',
          icon: Send,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
        };
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);
  const typeInfo = getContactTypeInfo();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F6AD55] mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">送信完了</h2>
          <p className="text-gray-600 mb-4">
            {typeInfo.title}を送信しました。
          </p>
          <p className="text-sm text-gray-500">施設詳細ページに戻ります...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push(`/parent/facilities/${facilityId}?child=${selectedChildId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${typeInfo.bgColor} rounded-full flex items-center justify-center`}>
              <typeInfo.icon className={`w-5 h-5 ${typeInfo.color}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{typeInfo.title}</h1>
              <p className="text-sm text-gray-500">{facility?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* 連絡タイプ選択 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-3">連絡種別</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setContactType('absence')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                contactType === 'absence'
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <XCircle className={`w-6 h-6 mx-auto mb-1 ${contactType === 'absence' ? 'text-red-600' : 'text-gray-400'}`} />
              <p className={`text-sm font-medium ${contactType === 'absence' ? 'text-red-800' : 'text-gray-600'}`}>欠席</p>
            </button>
            <button
              type="button"
              onClick={() => setContactType('schedule')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                contactType === 'schedule'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Calendar className={`w-6 h-6 mx-auto mb-1 ${contactType === 'schedule' ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className={`text-sm font-medium ${contactType === 'schedule' ? 'text-blue-800' : 'text-gray-600'}`}>利用希望</p>
            </button>
            <button
              type="button"
              onClick={() => setContactType('message')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                contactType === 'message'
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Send className={`w-6 h-6 mx-auto mb-1 ${contactType === 'message' ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={`text-sm font-medium ${contactType === 'message' ? 'text-gray-800' : 'text-gray-600'}`}>メッセージ</p>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {/* 児童選択 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">お子様</label>
            {children.length > 1 ? (
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                required
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <User className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-800">{selectedChild?.name}</span>
              </div>
            )}
          </div>

          {/* 欠席連絡フォーム */}
          {contactType === 'absence' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">欠席日</label>
                <input
                  type="date"
                  value={absenceDate}
                  onChange={(e) => setAbsenceDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">欠席理由</label>
                <select
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                  required
                >
                  <option value="">選択してください</option>
                  <option value="体調不良">体調不良</option>
                  <option value="家庭の事情">家庭の事情</option>
                  <option value="学校行事">学校行事</option>
                  <option value="通院">通院</option>
                  <option value="その他">その他</option>
                </select>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">希望時間帯</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'AM', label: '午前' },
                    { value: 'PM', label: '午後' },
                    { value: 'AMPM', label: '終日' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setScheduleSlot(option.value as any)}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        scheduleSlot === option.value
                          ? 'border-[#F6AD55] bg-[#FEF3E2]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-medium ${scheduleSlot === option.value ? 'text-orange-800' : 'text-gray-600'}`}>
                        {option.label}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                  rows={3}
                  placeholder="追加利用や振替の理由があれば入力してください"
                />
              </div>
            </>
          )}

          {/* メッセージフォーム */}
          {contactType === 'message' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">メッセージ</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                rows={6}
                placeholder="施設へのメッセージを入力してください"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                送信中...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                送信する
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
