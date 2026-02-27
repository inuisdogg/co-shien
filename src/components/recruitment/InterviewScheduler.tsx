'use client';

/**
 * 面接日程調整コンポーネント
 * 施設側のRecruitmentViewで使用。面接スロットの提案・管理を行う。
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  X,
  Plus,
  Check,
  XCircle,
  Loader2,
  Send,
  User,
} from 'lucide-react';
import { useInterviewScheduling } from '@/hooks/useInterviewScheduling';
import { InterviewSlot } from '@/types';

// ------------------------------------------------------------------ Props

interface InterviewSchedulerProps {
  applicationId: string;
  applicantName: string;
  onClose: () => void;
  facilityUserId: string;
}

// ------------------------------------------------------------------ Constants

type FormatKey = InterviewSlot['format'];

const FORMAT_CONFIG: Record<FormatKey, { label: string; icon: React.ElementType; color: string }> = {
  in_person: { label: '対面', icon: MapPin, color: 'text-blue-600 bg-blue-100' },
  online: { label: 'オンライン', icon: Video, color: 'text-purple-600 bg-purple-100' },
  phone: { label: '電話', icon: Phone, color: 'text-green-600 bg-green-100' },
};

const STATUS_CONFIG: Record<InterviewSlot['status'], { label: string; bg: string; text: string }> = {
  proposed: { label: '提案中', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  accepted: { label: '承認', bg: 'bg-green-100', text: 'text-green-700' },
  declined: { label: '辞退', bg: 'bg-red-100', text: 'text-red-600' },
  cancelled: { label: 'キャンセル', bg: 'bg-gray-100', text: 'text-gray-500' },
};

const DURATION_OPTIONS = [
  { value: 15, label: '15分' },
  { value: 30, label: '30分' },
  { value: 45, label: '45分' },
  { value: 60, label: '60分' },
];

// ------------------------------------------------------------------ Helpers

function formatDatetime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ------------------------------------------------------------------ Component

export default function InterviewScheduler({
  applicationId,
  applicantName,
  onClose,
  facilityUserId,
}: InterviewSchedulerProps) {
  const {
    slots,
    loading,
    error,
    fetchSlots,
    proposeSlot,
    cancelSlot,
  } = useInterviewScheduling();

  // ---- フォーム状態 ----
  const [showForm, setShowForm] = useState(false);
  const [formDatetime, setFormDatetime] = useState('');
  const [formDuration, setFormDuration] = useState(30);
  const [formFormat, setFormFormat] = useState<FormatKey>('in_person');
  const [formLocation, setFormLocation] = useState('');
  const [formMeetingUrl, setFormMeetingUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // 初回データ取得
  useEffect(() => {
    fetchSlots(applicationId);
  }, [applicationId, fetchSlots]);

  // フォームリセット
  const resetForm = useCallback(() => {
    setFormDatetime('');
    setFormDuration(30);
    setFormFormat('in_person');
    setFormLocation('');
    setFormMeetingUrl('');
    setFormNotes('');
    setShowForm(false);
  }, []);

  // 提案送信
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDatetime) return;

    setSubmitting(true);
    const result = await proposeSlot(
      applicationId,
      'facility',
      new Date(formDatetime).toISOString(),
      formFormat,
      formDuration,
      formFormat === 'in_person' ? formLocation || undefined : undefined,
      formFormat === 'online' ? formMeetingUrl || undefined : undefined,
      formNotes || undefined,
    );
    setSubmitting(false);

    if (result) {
      resetForm();
    }
  }, [applicationId, formDatetime, formDuration, formFormat, formLocation, formMeetingUrl, formNotes, proposeSlot, resetForm]);

  // キャンセル
  const handleCancel = useCallback(async (slotId: string) => {
    if (!confirm('この日程提案をキャンセルしますか？')) return;
    setCancelling(slotId);
    await cancelSlot(slotId);
    setCancelling(null);
  }, [cancelSlot]);

  // 承認済みスロット
  const acceptedSlot = slots.find(s => s.status === 'accepted');
  // 提案中スロット
  const proposedSlots = slots.filter(s => s.status === 'proposed');
  // その他のスロット（辞退・キャンセル）
  const otherSlots = slots.filter(s => s.status === 'declined' || s.status === 'cancelled');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00c4cc]" />
              面接日程調整
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <User className="w-3 h-3" />
              {applicantName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* スクロール可能なコンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* ===== 承認済みスロット ===== */}
          {acceptedSlot && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-green-700">面接日程が確定しました</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm text-gray-800 font-medium">
                  {formatDatetime(acceptedSlot.proposedDatetime)}
                </p>
                <div className="flex items-center gap-2">
                  {(() => {
                    const fmt = FORMAT_CONFIG[acceptedSlot.format];
                    const FmtIcon = fmt.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${fmt.color}`}>
                        <FmtIcon className="w-3 h-3" />
                        {fmt.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-gray-500">{acceptedSlot.durationMinutes}分</span>
                </div>
                {acceptedSlot.location && (
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {acceptedSlot.location}
                  </p>
                )}
                {acceptedSlot.meetingUrl && (
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    <a href={acceptedSlot.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      ミーティングリンク
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ===== タイムライン ===== */}
          {slots.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">日程調整タイムライン</h3>
              <div className="relative">
                {/* 縦線 */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

                <div className="space-y-3">
                  {slots.map((slot) => {
                    const statusConf = STATUS_CONFIG[slot.status];
                    const fmtConf = FORMAT_CONFIG[slot.format];
                    const FmtIcon = fmtConf.icon;

                    return (
                      <div key={slot.id} className="relative flex items-start gap-3 pl-0">
                        {/* タイムラインドット */}
                        <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          slot.status === 'accepted' ? 'bg-green-500' :
                          slot.status === 'proposed' ? 'bg-yellow-400' :
                          slot.status === 'declined' ? 'bg-red-400' :
                          'bg-gray-300'
                        }`}>
                          {slot.status === 'accepted' ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : slot.status === 'proposed' ? (
                            <Clock className="w-3 h-3 text-white" />
                          ) : slot.status === 'declined' ? (
                            <XCircle className="w-3 h-3 text-white" />
                          ) : (
                            <X className="w-3 h-3 text-white" />
                          )}
                        </div>

                        {/* カード */}
                        <div className={`flex-1 bg-white border rounded-lg p-3 ${
                          slot.status === 'accepted' ? 'border-green-200' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-800">
                              {formatDatetime(slot.proposedDatetime)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConf.bg} ${statusConf.text}`}>
                              {statusConf.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${fmtConf.color}`}>
                              <FmtIcon className="w-3 h-3" />
                              {fmtConf.label}
                            </span>
                            <span>{slot.durationMinutes}分</span>
                            {slot.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {slot.location}
                              </span>
                            )}
                          </div>
                          {slot.notes && (
                            <p className="text-xs text-gray-400 mt-1">{slot.notes}</p>
                          )}

                          {/* キャンセルボタン（提案中のみ） */}
                          {slot.status === 'proposed' && (
                            <button
                              onClick={() => handleCancel(slot.id)}
                              disabled={cancelling === slot.id}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              {cancelling === slot.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              キャンセル
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===== 新しい日程提案フォーム ===== */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#00c4cc] hover:text-[#00c4cc] transition-colors"
            >
              <Plus className="w-4 h-4" />
              新しい日程を提案
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#00c4cc]" />
                新しい日程を提案
              </h3>

              {/* 日時 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  日時 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formDatetime}
                  onChange={(e) => setFormDatetime(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>

              {/* 時間 & 形式 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">所要時間</label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  >
                    {DURATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">形式</label>
                  <select
                    value={formFormat}
                    onChange={(e) => setFormFormat(e.target.value as FormatKey)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  >
                    <option value="in_person">対面</option>
                    <option value="online">オンライン</option>
                    <option value="phone">電話</option>
                  </select>
                </div>
              </div>

              {/* 場所（対面の場合） */}
              {formFormat === 'in_person' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">場所</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="例: 本社3F会議室"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
              )}

              {/* ミーティングURL（オンラインの場合） */}
              {formFormat === 'online' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ミーティングURL</label>
                  <input
                    type="url"
                    value={formMeetingUrl}
                    onChange={(e) => setFormMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
              )}

              {/* メモ */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="面接に関する補足事項があればご記入ください"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                />
              </div>

              {/* ボタン */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formDatetime}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00c4cc] text-white text-xs font-medium rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  提案を送信
                </button>
              </div>
            </form>
          )}

          {/* ローディング */}
          {loading && slots.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#00c4cc]" />
            </div>
          )}

          {/* 空状態 */}
          {!loading && slots.length === 0 && !showForm && (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">まだ面接日程の提案がありません</p>
              <p className="text-xs text-gray-400 mt-1">上のボタンから日程を提案してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
