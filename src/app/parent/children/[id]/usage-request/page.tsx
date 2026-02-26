/**
 * 利用希望申請ページ (月次カレンダー式)
 * 保護者が希望日を選択し、施設へ利用申請を送信する
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Calendar, CheckCircle, ChevronLeft, ChevronRight,
  Clock, AlertCircle, Send, X, Building2, User, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type RequestedDate = {
  date: string;
  slot: 'am' | 'pm' | 'full';
  notes: string;
};

type ExistingRequest = {
  id: string;
  request_month: string;
  status: string;
  requested_dates: RequestedDate[];
  facility_response?: Array<{ date: string; approved: boolean }>;
  facility_notes?: string;
  submitted_at: string;
  responded_at?: string;
};

export default function UsageRequestPage() {
  const router = useRouter();
  const params = useParams();
  const initialChildId = params.id as string;

  // 複数児童対応: 選択中の児童ID
  const [activeChildId, setActiveChildId] = useState<string>(initialChildId);
  const [siblings, setSiblings] = useState<any[]>([]); // 保護者の全児童
  const [child, setChild] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState('');

  // カレンダー月
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1); // 翌月がデフォルト
  });

  // 選択された日付
  const [selectedDates, setSelectedDates] = useState<Map<string, RequestedDate>>(new Map());

  // 日付ごとのノート入力モーダル
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  // 既存申請
  const [existingRequests, setExistingRequests] = useState<ExistingRequest[]>([]);

  // 児童カラー設定
  const CHILD_COLORS = ['#93C5FD', '#86EFAC', '#FCA5A5', '#C4B5FD', '#FDBA74'];
  const getChildColor = (idx: number): string => CHILD_COLORS[idx % CHILD_COLORS.length];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/parent/login');
          return;
        }

        const user = JSON.parse(userStr);
        setUserId(user.id);

        // 保護者の全児童を取得（兄弟姉妹セレクター用）
        const { data: allChildrenData } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', user.id)
          .order('created_at', { ascending: false });

        if (allChildrenData && allChildrenData.length > 0) {
          setSiblings(allChildrenData);
        }

        // 対象児童の情報を取得
        const targetChildId = activeChildId;
        const childData = allChildrenData?.find((c: any) => c.id === targetChildId) || null;

        if (childData) {
          setChild(childData);
        }

        // 契約情報を取得
        const { data: contractsData } = await supabase
          .from('contracts')
          .select(`
            *,
            facilities:facility_id (
              id,
              name,
              code
            )
          `)
          .eq('child_id', targetChildId)
          .eq('status', 'active');

        if (contractsData && contractsData.length > 0) {
          setContracts(contractsData);
          setSelectedFacility(contractsData[0].facility_id);
        } else {
          // 契約がない場合、children.facility_idから取得を試みる
          if (childData?.facility_id) {
            const { data: facilityData } = await supabase
              .from('facilities')
              .select('id, name, code')
              .eq('id', childData.facility_id)
              .single();

            if (facilityData) {
              setContracts([{
                id: `virtual-${targetChildId}-${facilityData.id}`,
                facility_id: facilityData.id,
                child_id: targetChildId,
                status: 'active',
                facilities: facilityData,
              }]);
              setSelectedFacility(facilityData.id);
            }
          }
        }

        // 既存の申請を取得
        const { data: requestsData } = await supabase
          .from('usage_requests')
          .select('*')
          .eq('child_id', targetChildId)
          .eq('parent_user_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(10);

        if (requestsData) {
          setExistingRequests(requestsData);
        }
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    if (activeChildId) {
      fetchData();
    }
  }, [activeChildId, router]);

  // カレンダー日付の生成
  const calendarDates = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const dates: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    const formatDate = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      dates.push({ date: formatDate(d), day: d.getDate(), isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      dates.push({ date: formatDate(d), day, isCurrentMonth: true });
    }

    const remaining = 42 - dates.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      dates.push({ date: formatDate(d), day, isCurrentMonth: false });
    }

    return dates;
  }, [calendarMonth]);

  const requestMonth = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;

  // 日付をタップしてトグル
  const toggleDate = (dateStr: string) => {
    const newMap = new Map(selectedDates);
    if (newMap.has(dateStr)) {
      newMap.delete(dateStr);
    } else {
      newMap.set(dateStr, { date: dateStr, slot: 'full', notes: '' });
    }
    setSelectedDates(newMap);
  };

  // スロットを変更
  const changeSlot = (dateStr: string, slot: 'am' | 'pm' | 'full') => {
    const newMap = new Map(selectedDates);
    const existing = newMap.get(dateStr);
    if (existing) {
      newMap.set(dateStr, { ...existing, slot });
    }
    setSelectedDates(newMap);
  };

  // ノートを保存
  const saveNotes = () => {
    if (!editingDate) return;
    const newMap = new Map(selectedDates);
    const existing = newMap.get(editingDate);
    if (existing) {
      newMap.set(editingDate, { ...existing, notes: editingNotes });
    }
    setSelectedDates(newMap);
    setEditingDate(null);
    setEditingNotes('');
  };

  // 児童切り替え
  const handleChildSwitch = (newChildId: string) => {
    if (newChildId === activeChildId) return;
    setActiveChildId(newChildId);
    setSelectedDates(new Map());
    setSelectedFacility('');
    setContracts([]);
    setExistingRequests([]);
    setLoading(true);
  };

  // 選択中の施設名を取得
  const selectedFacilityName = useMemo(() => {
    const contract = contracts.find(c => c.facility_id === selectedFacility);
    return contract?.facilities?.name || '';
  }, [contracts, selectedFacility]);

  const handleSubmit = async () => {
    setError('');

    if (!selectedFacility) {
      setError('施設を選択してください');
      return;
    }

    if (selectedDates.size === 0) {
      setError('利用希望日を選択してください');
      return;
    }

    setSubmitting(true);

    try {
      const requestedDates = Array.from(selectedDates.values()).sort((a, b) => a.date.localeCompare(b.date));

      const { error: insertError } = await supabase
        .from('usage_requests')
        .insert({
          facility_id: selectedFacility,
          child_id: activeChildId,
          parent_user_id: userId,
          request_month: requestMonth,
          requested_dates: requestedDates,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        router.push(`/parent/children/${activeChildId}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || '申請の送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0] p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">申請を送信しました</h2>
          <p className="text-gray-600 mb-2">
            {requestMonth}の利用希望申請を施設に送信しました。
          </p>
          <p className="text-sm text-gray-400">施設からの回答をお待ちください。</p>
        </div>
      </div>
    );
  }

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // 既存申請でこの月のものがあるか
  const existingForMonth = existingRequests.find(r => r.request_month === requestMonth);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push(`/parent/children/${activeChildId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">利用希望申請</h1>
          <p className="text-sm text-gray-500 mt-1">{child?.name}さんの利用希望日を選択して送信</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 児童セレクター（複数児童がいる場合） */}
        {siblings.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#F6AD55]" />
              お子様を選択
            </label>
            <div className="flex flex-wrap gap-2">
              {siblings.map((sib, idx) => {
                const isActive = sib.id === activeChildId;
                const color = getChildColor(idx);
                return (
                  <button
                    key={sib.id}
                    onClick={() => handleChildSwitch(sib.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${
                      isActive
                        ? 'border-[#F6AD55] bg-[#FEF3E2] text-gray-800 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {sib.name.charAt(0)}
                    </div>
                    {sib.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {contracts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">契約中の施設がありません</p>
            <p className="text-sm text-gray-500">施設と契約すると、利用希望を申請できます</p>
          </div>
        ) : (
          <>
            {/* 施設表示・選択 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                申請先施設
              </label>
              {contracts.length > 1 ? (
                <select
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F6AD55] focus:border-[#F6AD55] text-base"
                >
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.facility_id}>
                      {contract.facilities?.name || '施設名不明'}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{selectedFacilityName || contracts[0]?.facilities?.name || '施設'}</p>
                    <p className="text-xs text-gray-500">{child?.name}さんの利用希望を申請</p>
                  </div>
                </div>
              )}
            </div>

            {/* 既存申請がある場合の通知 */}
            {existingForMonth && (
              <div className={`rounded-xl p-4 border ${
                existingForMonth.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                existingForMonth.status === 'approved' ? 'bg-green-50 border-green-200' :
                existingForMonth.status === 'rejected' ? 'bg-red-50 border-red-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-bold">
                    {requestMonth}の申請: {
                      existingForMonth.status === 'pending' ? '申請中' :
                      existingForMonth.status === 'approved' ? '承認済み' :
                      existingForMonth.status === 'rejected' ? '却下' :
                      existingForMonth.status === 'partially_approved' ? '一部承認' :
                      existingForMonth.status
                    }
                  </span>
                </div>
                {existingForMonth.facility_notes && (
                  <p className="text-xs text-gray-600 mt-1">施設コメント: {existingForMonth.facility_notes}</p>
                )}
                {existingForMonth.facility_response && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {existingForMonth.facility_response.map((res, idx) => (
                      <span key={idx} className={`text-[10px] px-2 py-0.5 rounded-full ${
                        res.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {res.date.split('-')[2]}日: {res.approved ? '承認' : '却下'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* カレンダー */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-[#F6AD55] flex items-center justify-between">
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  className="p-1.5 hover:bg-white/20 rounded-md text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-white font-bold">
                  {calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月
                </h2>
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  className="p-1.5 hover:bg-white/20 rounded-md text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                <p className="text-xs text-gray-500 mb-3">
                  利用したい日をタップして選択してください。もう一度タップで解除できます。
                </p>

                <div className="grid grid-cols-7 mb-1">
                  {weekDays.map((day, i) => (
                    <div
                      key={i}
                      className={`p-2 text-center text-xs font-bold ${
                        i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDates.map((dateInfo, idx) => {
                    const isSelected = selectedDates.has(dateInfo.date);
                    const selectedData = selectedDates.get(dateInfo.date);
                    const isToday = dateInfo.date === todayStr;
                    const isPast = dateInfo.date < todayStr;
                    const dayOfWeek = new Date(dateInfo.date).getDay();

                    return (
                      <div
                        key={idx}
                        className={`min-h-[60px] p-1 rounded-lg border transition-all ${
                          !dateInfo.isCurrentMonth
                            ? 'bg-gray-50 opacity-30 border-transparent'
                            : isPast
                            ? 'bg-gray-50 opacity-50 border-transparent cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#F6AD55]/10 border-[#F6AD55] cursor-pointer shadow-sm'
                            : 'bg-white border-gray-100 cursor-pointer hover:border-[#F6AD55]/40 hover:bg-amber-50/30'
                        }`}
                        onClick={() => {
                          if (dateInfo.isCurrentMonth && !isPast) {
                            toggleDate(dateInfo.date);
                          }
                        }}
                      >
                        <div className={`text-xs text-center font-medium mb-1 ${
                          isToday
                            ? 'w-6 h-6 rounded-full bg-[#F6AD55] text-white flex items-center justify-center mx-auto'
                            : isSelected
                            ? 'text-[#ED8936] font-bold'
                            : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
                        }`}>
                          {dateInfo.day}
                        </div>
                        {isSelected && selectedData && dateInfo.isCurrentMonth && (
                          <div className="text-center">
                            <div className="flex justify-center gap-0.5">
                              {(['am', 'pm', 'full'] as const).map(slot => (
                                <button
                                  key={slot}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    changeSlot(dateInfo.date, slot);
                                  }}
                                  className={`text-[8px] px-1 py-0.5 rounded transition-colors ${
                                    selectedData.slot === slot
                                      ? 'bg-[#F6AD55] text-white'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                >
                                  {slot === 'am' ? '午前' : slot === 'pm' ? '午後' : '終日'}
                                </button>
                              ))}
                            </div>
                            {selectedData.notes && (
                              <div className="text-[8px] text-gray-400 mt-0.5 truncate">
                                {selectedData.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 選択サマリー */}
            {selectedDates.size > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#F6AD55]" />
                  選択した日程 ({selectedDates.size}日)
                </h3>
                <div className="space-y-2">
                  {Array.from(selectedDates.values())
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((item) => {
                      const d = new Date(item.date);
                      const dayName = weekDays[d.getDay()];
                      return (
                        <div key={item.date} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-800">
                              {item.date.split('-')[1]}/{item.date.split('-')[2]} ({dayName})
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              item.slot === 'am' ? 'bg-blue-100 text-blue-700' :
                              item.slot === 'pm' ? 'bg-orange-100 text-orange-700' :
                              'bg-[#F6AD55]/20 text-[#ED8936]'
                            }`}>
                              {item.slot === 'am' ? '午前' : item.slot === 'pm' ? '午後' : '終日'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingDate(item.date);
                                setEditingNotes(item.notes);
                              }}
                              className="text-xs text-gray-500 hover:text-[#F6AD55] transition-colors"
                            >
                              {item.notes ? 'メモ編集' : 'メモ追加'}
                            </button>
                            <button
                              onClick={() => {
                                const newMap = new Map(selectedDates);
                                newMap.delete(item.date);
                                setSelectedDates(newMap);
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 送信ボタン */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-t-xl shadow-lg -mx-4">
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedDates.size === 0}
                className="w-full h-14 bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base shadow-md active:shadow-sm"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    送信中...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {selectedDates.size}日分の利用希望を申請
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* 過去の申請一覧 */}
        {existingRequests.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">過去の申請</h3>
            <div className="space-y-2">
              {existingRequests.map((req) => {
                const statusConfig: Record<string, { label: string; color: string }> = {
                  pending: { label: '申請中', color: 'bg-yellow-100 text-yellow-800' },
                  approved: { label: '承認済み', color: 'bg-green-100 text-green-800' },
                  partially_approved: { label: '一部承認', color: 'bg-blue-100 text-blue-800' },
                  rejected: { label: '却下', color: 'bg-red-100 text-red-800' },
                };
                const st = statusConfig[req.status] || { label: req.status, color: 'bg-gray-100 text-gray-800' };
                const dates = req.requested_dates || [];
                return (
                  <div key={req.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-800">{req.request_month}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {dates.length}日分 - 申請日: {new Date(req.submitted_at).toLocaleDateString('ja-JP')}
                    </p>
                    {req.facility_notes && (
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2">
                        施設コメント: {req.facility_notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ノート編集モーダル */}
      {editingDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">メモを追加</h3>
              <button
                onClick={() => { setEditingDate(null); setEditingNotes(''); }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500 mb-3">{editingDate} のメモ</p>
              <textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F6AD55]/30 focus:border-[#F6AD55] text-base"
                rows={3}
                placeholder="追加の要望やメモを入力..."
              />
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => { setEditingDate(null); setEditingNotes(''); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={saveNotes}
                className="flex-1 py-2.5 bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold rounded-xl text-sm"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
