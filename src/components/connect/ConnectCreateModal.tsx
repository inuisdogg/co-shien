/**
 * 連絡会作成モーダル（ウィザード形式）
 * Step 1: 基本情報入力
 * Step 2: 日程候補追加
 * Step 3: 参加者追加
 * Step 4: 確認・送信
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Users,
  Building2,
  Mail,
  Plus,
  Trash2,
  Clock,
  MapPin,
  FileText,
  Check,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Child, ConnectMeetingFormData } from '@/types';
import DateSlotPicker, { DateSlot } from './DateSlotPicker';

interface ConnectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilityId: string;
  userId: string;
  childList: Child[];
  onCreated: () => void;
}

type Step = 1 | 2 | 3 | 4;

export default function ConnectCreateModal({
  isOpen,
  onClose,
  facilityId,
  userId,
  childList,
  onCreated,
}: ConnectCreateModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // フォームデータ
  const [formData, setFormData] = useState<ConnectMeetingFormData>({
    childId: '',
    title: '',
    purpose: '',
    location: '',
    estimatedDuration: 60,
    description: '',
    dateOptions: [],
    participants: [{ organizationName: '', representativeEmail: '', representativeName: '' }],
  });

  // バリデーション
  const isStep1Valid = formData.childId && formData.title;
  const isStep2Valid = formData.dateOptions.length > 0 && formData.dateOptions.every((d) => d.date && d.startTime);
  const isStep3Valid = formData.participants.length > 0 && formData.participants.every((p) => p.organizationName && p.representativeEmail);

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      childId: '',
      title: '',
      purpose: '',
      location: '',
      estimatedDuration: 60,
      description: '',
      dateOptions: [],
      participants: [{ organizationName: '', representativeEmail: '', representativeName: '' }],
    });
    onClose();
  };

  // 参加者の追加・削除
  const addParticipant = () => {
    setFormData({
      ...formData,
      participants: [...formData.participants, { organizationName: '', representativeEmail: '', representativeName: '' }],
    });
  };

  const removeParticipant = (index: number) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter((_, i) => i !== index),
    });
  };

  const updateParticipant = (
    index: number,
    field: 'organizationName' | 'representativeEmail' | 'representativeName',
    value: string
  ) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setFormData({ ...formData, participants: newParticipants });
  };

  // 送信処理
  const handleSubmit = async () => {
    if (!isStep1Valid || !isStep2Valid || !isStep3Valid) return;

    setSubmitting(true);
    try {
      // 1. 連絡会を作成
      const { data: meeting, error: meetingError } = await supabase
        .from('connect_meetings')
        .insert({
          facility_id: facilityId,
          child_id: formData.childId,
          title: formData.title,
          purpose: formData.purpose || null,
          location: formData.location || null,
          estimated_duration: formData.estimatedDuration || null,
          description: formData.description || null,
          status: 'scheduling',
          created_by: userId,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // 2. 日程候補を作成
      const dateOptionsToInsert = formData.dateOptions.map((opt) => ({
        meeting_id: meeting.id,
        date: opt.date,
        start_time: opt.startTime,
        end_time: opt.endTime || null,
      }));

      const { error: dateError } = await supabase
        .from('connect_meeting_date_options')
        .insert(dateOptionsToInsert);

      if (dateError) throw dateError;

      // 3. 参加者を作成（トークン付き）
      const participantsToInsert = formData.participants.map((p) => ({
        meeting_id: meeting.id,
        organization_name: p.organizationName,
        representative_email: p.representativeEmail,
        representative_name: p.representativeName || null,
        access_token: crypto.randomUUID(),
        token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日後
        status: 'pending',
      }));

      const { error: participantError } = await supabase
        .from('connect_meeting_participants')
        .insert(participantsToInsert);

      if (participantError) throw participantError;

      // 4. 招待メールを送信（API呼び出し）
      const selectedChildForEmail = childList.find((c) => c.id === formData.childId);

      // メール用にグループ化された日程オプション
      const groupedForEmail = formData.dateOptions
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.startTime.localeCompare(b.startTime);
        })
        .reduce<Array<{ date: string; startTime: string; endTime?: string }>>((groups, slot) => {
          const lastGroup = groups[groups.length - 1];
          if (lastGroup && lastGroup.date === slot.date && lastGroup.endTime === slot.startTime) {
            lastGroup.endTime = slot.endTime;
          } else {
            groups.push({ ...slot });
          }
          return groups;
        }, []);

      for (const participant of participantsToInsert) {
        try {
          await fetch('/api/connect/send-invitation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meetingId: meeting.id,
              meetingTitle: formData.title,
              purpose: formData.purpose,
              location: formData.location,
              childName: selectedChildForEmail?.name || '',
              participantEmail: participant.representative_email,
              participantName: participant.representative_name,
              organizationName: participant.organization_name,
              accessToken: participant.access_token,
              dateOptions: groupedForEmail,
            }),
          });
        } catch (emailError) {
          console.error('招待メール送信エラー:', emailError);
          // メール送信に失敗しても処理は続行
        }
      }

      onCreated();
      handleClose();
    } catch (error: any) {
      console.error('連絡会作成エラー:', error);
      alert('連絡会の作成に失敗しました: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedChild = childList.find((c) => c.id === formData.childId);

  // 連続するスロットをグループ化（確認画面用）
  const groupedDateOptions = formData.dateOptions
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    })
    .reduce<Array<{ date: string; startTime: string; endTime?: string }>>((groups, slot) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === slot.date && lastGroup.endTime === slot.startTime) {
        lastGroup.endTime = slot.endTime;
      } else {
        groups.push({ ...slot });
      }
      return groups;
    }, []);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800">連絡会を作成</h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-between mt-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep >= step
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step ? <Check size={16} /> : step}
                </div>
                <span
                  className={`ml-2 text-xs ${
                    currentStep >= step ? 'text-cyan-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {step === 1 && '基本情報'}
                  {step === 2 && '日程候補'}
                  {step === 3 && '参加者'}
                  {step === 4 && '確認'}
                </span>
                {step < 4 && (
                  <div
                    className={`w-12 h-0.5 ml-2 ${
                      currentStep > step ? 'bg-cyan-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Step 1: 基本情報 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  対象児童 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  value={formData.childId}
                  onChange={(e) => setFormData({ ...formData, childId: e.target.value })}
                >
                  <option value="">-- 児童を選択 --</option>
                  {childList.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  会議名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="例: 支援連絡会議"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">目的</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="例: 支援計画の共有・見直し"
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">場所</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="例: 当施設 相談室"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">所要時間（分）</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="60"
                    value={formData.estimatedDuration || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, estimatedDuration: parseInt(e.target.value) || undefined })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">備考</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  rows={3}
                  placeholder="その他の情報や注意事項があれば入力してください"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Step 2: 日程候補 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="bg-cyan-50 border border-cyan-200 rounded-md p-3 mb-4">
                <p className="text-sm text-cyan-800">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  カレンダーをクリック・ドラッグして日程候補を選択してください。
                </p>
              </div>

              <DateSlotPicker
                selectedSlots={formData.dateOptions}
                onChange={(slots: DateSlot[]) => setFormData({ ...formData, dateOptions: slots })}
              />
            </div>
          )}

          {/* Step 3: 参加者 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-cyan-50 border border-cyan-200 rounded-md p-3 mb-4">
                <p className="text-sm text-cyan-800">
                  <Users className="w-4 h-4 inline mr-1" />
                  招待する外部関係者の情報を入力してください。メールで日程調整の依頼が送信されます。
                </p>
              </div>

              {formData.participants.map((participant, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-700">参加者 {index + 1}</span>
                    {formData.participants.length > 1 && (
                      <button
                        onClick={() => removeParticipant(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        組織名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-cyan-500"
                        placeholder="例: 〇〇市 福祉課"
                        value={participant.organizationName}
                        onChange={(e) => updateParticipant(index, 'organizationName', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          メールアドレス <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-cyan-500"
                          placeholder="example@city.jp"
                          value={participant.representativeEmail}
                          onChange={(e) => updateParticipant(index, 'representativeEmail', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">担当者名</label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-cyan-500"
                          placeholder="山田 太郎"
                          value={participant.representativeName || ''}
                          onChange={(e) => updateParticipant(index, 'representativeName', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addParticipant}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-cyan-400 hover:text-cyan-500 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                参加者を追加
              </button>
            </div>
          )}

          {/* Step 4: 確認 */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  基本情報
                </h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex">
                    <dt className="w-24 text-gray-500">対象児童</dt>
                    <dd className="text-gray-800 font-medium">{selectedChild?.name || '-'}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-24 text-gray-500">会議名</dt>
                    <dd className="text-gray-800 font-medium">{formData.title}</dd>
                  </div>
                  {formData.purpose && (
                    <div className="flex">
                      <dt className="w-24 text-gray-500">目的</dt>
                      <dd className="text-gray-800">{formData.purpose}</dd>
                    </div>
                  )}
                  {formData.location && (
                    <div className="flex">
                      <dt className="w-24 text-gray-500">場所</dt>
                      <dd className="text-gray-800">{formData.location}</dd>
                    </div>
                  )}
                  {formData.estimatedDuration && (
                    <div className="flex">
                      <dt className="w-24 text-gray-500">所要時間</dt>
                      <dd className="text-gray-800">{formData.estimatedDuration}分</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  日程候補（{groupedDateOptions.length}件）
                </h4>
                <ul className="space-y-2">
                  {groupedDateOptions.map((opt, i) => (
                    <li key={i} className="text-sm text-gray-800">
                      {new Date(opt.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}{' '}
                      {opt.startTime}
                      {opt.endTime && ` - ${opt.endTime}`}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  参加者（{formData.participants.length}名）
                </h4>
                <ul className="space-y-2">
                  {formData.participants.map((p, i) => (
                    <li key={i} className="text-sm">
                      <span className="text-gray-800 font-medium">{p.organizationName}</span>
                      {p.representativeName && (
                        <span className="text-gray-600 ml-2">{p.representativeName}</span>
                      )}
                      <span className="text-gray-400 ml-2">({p.representativeEmail})</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    作成後、各参加者に日程調整の依頼メールが自動送信されます。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between flex-shrink-0">
          <button
            onClick={currentStep === 1 ? handleClose : () => setCurrentStep((currentStep - 1) as Step)}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-bold transition-colors flex items-center gap-2"
          >
            {currentStep === 1 ? (
              'キャンセル'
            ) : (
              <>
                <ChevronLeft size={16} />
                戻る
              </>
            )}
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep((currentStep + 1) as Step)}
              disabled={
                (currentStep === 1 && !isStep1Valid) ||
                (currentStep === 2 && !isStep2Valid) ||
                (currentStep === 3 && !isStep3Valid)
              }
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              次へ
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  作成中...
                </>
              ) : (
                <>
                  <Mail size={16} />
                  作成して招待を送信
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
