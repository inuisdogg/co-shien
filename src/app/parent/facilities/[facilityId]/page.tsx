/**
 * 施設詳細ページ（利用者側）
 * 実績記録表、サイン機能、連絡機能、予約カレンダー
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Building2, Calendar, FileText, CheckCircle,
  MessageSquare, PenTool, ChevronLeft, ChevronRight,
  User, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 月ごとの実績記録
type MonthlyRecord = {
  date: string;
  dayOfWeek: number;
  slot?: string;
  serviceStatus?: string;
  startTime?: string;
  endTime?: string;
  calculatedTime?: number;
  pickup?: boolean;
  dropoff?: boolean;
  memo?: string;
  parentSignature?: string;
  parentSignedAt?: string;
};

export default function FacilityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const facilityId = params.facilityId as string;
  const childIdParam = searchParams.get('child');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'calendar'>('records');

  // サイン用のstate
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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
        const { data: facilityData, error: facilityError } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single();

        if (facilityError || !facilityData) {
          setError('施設情報が見つかりません');
          setLoading(false);
          return;
        }

        setFacility(facilityData);

        // 自分の児童を取得
        const { data: childrenData } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', user.id);

        if (childrenData && childrenData.length > 0) {
          setChildren(childrenData);

          // この施設との契約を取得
          const childIds = childrenData.map((c: any) => c.id);
          const { data: contractsData } = await supabase
            .from('contracts')
            .select('*')
            .in('child_id', childIds)
            .eq('facility_id', facilityId)
            .eq('status', 'active');

          if (contractsData) {
            setContracts(contractsData);

            // 選択する児童を決定
            let targetChildId = childIdParam;
            if (!targetChildId && contractsData.length > 0) {
              targetChildId = contractsData[0].child_id;
            }
            if (targetChildId) {
              setSelectedChildId(targetChildId);
            }
          }
        }
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId, childIdParam, router]);

  // 月の実績記録を取得
  useEffect(() => {
    const fetchMonthlyRecords = async () => {
      if (!selectedChildId || !facilityId) return;

      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      // スケジュールデータを取得
      const { data: schedulesData } = await supabase
        .from('schedules')
        .select('*')
        .eq('child_id', selectedChildId)
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (schedulesData) {
        setSchedules(schedulesData);

        // 月の全日のデータを生成
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const records: MonthlyRecord[] = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayOfWeek = new Date(year, month, day).getDay();

          // この日のスケジュールを探す
          const daySchedules = schedulesData.filter((s: any) => s.date === date);

          if (daySchedules.length > 0) {
            // スケジュールがある場合
            daySchedules.forEach((schedule: any) => {
              records.push({
                date,
                dayOfWeek,
                slot: schedule.slot,
                serviceStatus: schedule.service_status || '利用',
                startTime: schedule.start_time,
                endTime: schedule.end_time,
                calculatedTime: schedule.calculated_time,
                pickup: schedule.has_pickup,
                dropoff: schedule.has_dropoff,
                memo: schedule.memo,
                parentSignature: schedule.parent_signature,
                parentSignedAt: schedule.parent_signed_at,
              });
            });
          } else {
            // スケジュールがない場合は空の行
            records.push({
              date,
              dayOfWeek,
            });
          }
        }

        setMonthlyRecords(records);
      }
    };

    fetchMonthlyRecords();
  }, [selectedChildId, facilityId, selectedMonth]);

  // サイン描画機能
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signature = canvas.toDataURL('image/png');
    setSignatureData(signature);

    // 月のすべてのスケジュールにサインを保存
    if (schedules.length > 0) {
      const scheduleIds = schedules.map(s => s.id);

      const { error } = await supabase
        .from('schedules')
        .update({
          parent_signature: signature,
          parent_signed_at: new Date().toISOString(),
        })
        .in('id', scheduleIds);

      if (error) {
        setError('サインの保存に失敗しました');
      } else {
        setIsSignatureModalOpen(false);
        // 再取得
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data: updatedSchedules } = await supabase
          .from('schedules')
          .select('*')
          .eq('child_id', selectedChildId)
          .eq('facility_id', facilityId)
          .gte('date', startDate)
          .lte('date', endDate);

        if (updatedSchedules) {
          setSchedules(updatedSchedules);
        }
      }
    }
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // 署名済みかどうか
  const isSigned = schedules.some(s => s.parent_signature);

  const selectedChild = children.find(c => c.id === selectedChildId);

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

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">施設が見つかりません</p>
          <button
            onClick={() => router.push('/parent')}
            className="bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-2 px-4 rounded-md"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/parent')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ダッシュボードに戻る</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FDEBD0] rounded-full flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#ED8936]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{facility.name}</h1>
              {facility.code && (
                <p className="text-sm text-gray-500">施設コード: {facility.code}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* 児童選択 */}
        {contracts.length > 1 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">お子様を選択</label>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
            >
              {contracts.map((contract) => {
                const child = children.find(c => c.id === contract.child_id);
                return (
                  <option key={contract.id} value={contract.child_id}>
                    {child?.name || '不明'}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* タブ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'records', label: '実績記録表', icon: FileText },
              { id: 'calendar', label: '予約カレンダー', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#F6AD55] text-[#ED8936] bg-[#FEF3E2]'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {/* 実績記録表タブ */}
            {activeTab === 'records' && (
              <div className="space-y-4">
                {/* 月選択 */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">
                    {selectedMonth.getFullYear()}年{selectedMonth.getMonth() + 1}月 実績記録表
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const prev = new Date(selectedMonth);
                        prev.setMonth(prev.getMonth() - 1);
                        setSelectedMonth(prev);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium min-w-[100px] text-center">
                      {selectedMonth.getFullYear()}年{selectedMonth.getMonth() + 1}月
                    </span>
                    <button
                      onClick={() => {
                        const next = new Date(selectedMonth);
                        next.setMonth(next.getMonth() + 1);
                        setSelectedMonth(next);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 児童情報 */}
                {selectedChild && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-800">{selectedChild.name}</p>
                        <p className="text-sm text-gray-500">
                          受給者証番号: {selectedChild.beneficiary_number || '未登録'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 実績テーブル */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-2 text-left">日付</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">曜日</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">区分</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">開始</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">終了</th>
                        <th className="border border-gray-300 px-2 py-2 text-center">送迎</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRecords.map((record, index) => {
                        const dayNum = parseInt(record.date.split('-')[2]);
                        const isWeekend = record.dayOfWeek === 0 || record.dayOfWeek === 6;
                        const hasActivity = record.slot || record.serviceStatus;

                        return (
                          <tr
                            key={index}
                            className={`${isWeekend ? 'bg-gray-50' : ''} ${hasActivity ? 'bg-green-50' : ''}`}
                          >
                            <td className="border border-gray-300 px-2 py-2">{dayNum}</td>
                            <td className={`border border-gray-300 px-2 py-2 ${
                              record.dayOfWeek === 0 ? 'text-red-600' :
                              record.dayOfWeek === 6 ? 'text-blue-600' : ''
                            }`}>
                              {weekDays[record.dayOfWeek]}
                            </td>
                            <td className="border border-gray-300 px-2 py-2">
                              {record.slot === 'AM' ? '午前' : record.slot === 'PM' ? '午後' : record.serviceStatus || '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2">
                              {record.startTime || '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2">
                              {record.endTime || '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center">
                              {record.pickup && <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded mr-1">迎</span>}
                              {record.dropoff && <span className="text-xs bg-green-100 text-green-800 px-1 rounded">送</span>}
                              {!record.pickup && !record.dropoff && '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-xs">
                              {record.memo || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* サイン欄 */}
                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800">保護者サイン</h3>
                    {isSigned ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        署名済み
                      </span>
                    ) : (
                      <button
                        onClick={() => setIsSignatureModalOpen(true)}
                        className="flex items-center gap-2 bg-[#F6AD55] hover:bg-[#ED8936] text-white text-sm font-bold py-2 px-4 rounded-md"
                      >
                        <PenTool className="w-4 h-4" />
                        サインする
                      </button>
                    )}
                  </div>
                  {isSigned && schedules[0]?.parent_signature && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 inline-block">
                      <img
                        src={schedules[0].parent_signature}
                        alt="保護者サイン"
                        className="max-h-20"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        署名日時: {new Date(schedules[0].parent_signed_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  )}
                </div>

                {/* 利用回数サマリー */}
                <div className="bg-blue-50 rounded-lg p-4 mt-4">
                  <h3 className="font-bold text-gray-800 mb-2">今月の利用サマリー</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {monthlyRecords.filter(r => r.serviceStatus === '利用' || r.slot).length}
                      </p>
                      <p className="text-xs text-gray-600">利用日数</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {monthlyRecords.filter(r => r.pickup).length}
                      </p>
                      <p className="text-xs text-gray-600">送迎（迎え）</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">
                        {monthlyRecords.filter(r => r.dropoff).length}
                      </p>
                      <p className="text-xs text-gray-600">送迎（送り）</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 予約カレンダータブ */}
            {activeTab === 'calendar' && (() => {
              // 児童カラー設定
              const CHILD_COLORS_CAL = ['#93C5FD', '#86EFAC', '#FCA5A5', '#C4B5FD', '#FDBA74'];
              const CHILD_COLORS_DARK_CAL = ['#3B82F6', '#22C55E', '#EF4444', '#8B5CF6', '#F97316'];
              const childIndexMapCal = new Map<string, number>();
              contracts.forEach((c: any, idx: number) => {
                if (!childIndexMapCal.has(c.child_id)) {
                  childIndexMapCal.set(c.child_id, childIndexMapCal.size);
                }
              });
              const hasMultipleChildren = childIndexMapCal.size > 1;

              return (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">予約カレンダー</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const prev = new Date(selectedMonth);
                        prev.setMonth(prev.getMonth() - 1);
                        setSelectedMonth(prev);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium min-w-[100px] text-center">
                      {selectedMonth.getFullYear()}年{selectedMonth.getMonth() + 1}月
                    </span>
                    <button
                      onClick={() => {
                        const next = new Date(selectedMonth);
                        next.setMonth(next.getMonth() + 1);
                        setSelectedMonth(next);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 児童凡例（複数児童がこの施設に契約している場合） */}
                {hasMultipleChildren && (
                  <div className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-lg px-4 py-2">
                    {Array.from(childIndexMapCal.entries()).map(([cId, cIdx]) => {
                      const c = children.find((ch: any) => ch.id === cId);
                      return (
                        <div key={cId} className="flex items-center gap-1.5">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CHILD_COLORS_CAL[cIdx % CHILD_COLORS_CAL.length] }}
                          />
                          <span className="text-xs font-medium text-gray-700">{c?.name || '不明'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* カレンダー */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {weekDays.map((day, index) => (
                      <div
                        key={day}
                        className={`p-3 text-center text-sm font-bold ${
                          index === 0 ? 'text-red-600 bg-red-50' :
                          index === 6 ? 'text-blue-600 bg-blue-50' :
                          'text-gray-700 bg-gray-50'
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {(() => {
                      const year = selectedMonth.getFullYear();
                      const month = selectedMonth.getMonth();
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0);
                      const daysInMonth = lastDay.getDate();
                      const startingDayOfWeek = firstDay.getDay();
                      const today = new Date();

                      const cells = [];

                      // 空のセル
                      for (let i = 0; i < startingDayOfWeek; i++) {
                        cells.push(
                          <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-200 bg-gray-50"></div>
                        );
                      }

                      // 日付セル
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayOfWeek = new Date(year, month, day).getDay();
                        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                        const daySchedules = schedules.filter((s: any) => s.date === date);

                        cells.push(
                          <div
                            key={day}
                            className={`min-h-[80px] border-r border-b border-gray-200 p-1 ${
                              isToday ? 'bg-[#FEF3E2]' : ''
                            } ${dayOfWeek === 0 ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : ''}`}
                          >
                            <div className={`text-xs font-bold mb-1 ${isToday ? 'text-[#ED8936]' : ''}`}>
                              {day}
                            </div>
                            <div className="space-y-0.5">
                              {daySchedules.map((schedule: any) => {
                                const cIdx = childIndexMapCal.get(schedule.child_id) ?? 0;
                                const bgColor = hasMultipleChildren
                                  ? CHILD_COLORS_CAL[cIdx % CHILD_COLORS_CAL.length] + '40'
                                  : undefined;
                                const textColor = hasMultipleChildren
                                  ? CHILD_COLORS_DARK_CAL[cIdx % CHILD_COLORS_DARK_CAL.length]
                                  : undefined;
                                const childForSchedule = hasMultipleChildren
                                  ? children.find((ch: any) => ch.id === schedule.child_id)
                                  : null;

                                return (
                                  <div
                                    key={schedule.id}
                                    className={`text-xs px-1 py-0.5 rounded truncate ${
                                      hasMultipleChildren ? '' : 'bg-green-100 text-green-800'
                                    }`}
                                    style={hasMultipleChildren ? { backgroundColor: bgColor, color: textColor } : undefined}
                                  >
                                    {hasMultipleChildren && (
                                      <span className="font-bold">{childForSchedule?.name?.charAt(0)}</span>
                                    )}
                                    {schedule.slot === 'AM' ? '午前' : schedule.slot === 'PM' ? '午後' : ''}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      return cells;
                    })()}
                  </div>
                </div>

                {/* 凡例 */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  {hasMultipleChildren ? (
                    Array.from(childIndexMapCal.entries()).map(([cId, cIdx]) => {
                      const c = children.find((ch: any) => ch.id === cId);
                      return (
                        <div key={cId} className="flex items-center gap-1">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: CHILD_COLORS_CAL[cIdx % CHILD_COLORS_CAL.length] + '40' }}
                          />
                          <span>{c?.name || '不明'}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 bg-green-100 rounded"></div>
                      <span>利用予定</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-[#FEF3E2] border border-[#F6AD55]/30 rounded"></div>
                    <span>今日</span>
                  </div>
                </div>

                {/* 利用希望申請ボタン */}
                <div className="mt-6">
                  <button
                    onClick={() => router.push(`/parent/children/${selectedChildId}/usage-request`)}
                    className="w-full bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-5 h-5" />
                    利用希望日を申請する
                  </button>
                </div>
              </div>
              );
            })()}

          </div>
        </div>
      </main>

      {/* フローティングチャットボタン */}
      <button
        onClick={() => router.push(`/parent/facilities/${facilityId}/chat`)}
        className="fixed bottom-6 right-6 bg-[#ED8936] hover:bg-[#D97706] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all active:scale-95 z-50 flex items-center gap-2"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="font-bold pr-1">施設に連絡</span>
      </button>

      {/* サインモーダル */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">保護者サイン</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedMonth.getFullYear()}年{selectedMonth.getMonth() + 1}月分の実績記録を確認し、サインしてください。
            </p>

            <div className="border border-gray-300 rounded-lg mb-4 bg-white">
              <canvas
                ref={canvasRef}
                width={350}
                height={150}
                className="w-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={clearSignature}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-md"
              >
                クリア
              </button>
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-md"
              >
                キャンセル
              </button>
              <button
                onClick={saveSignature}
                className="flex-1 bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-2 px-4 rounded-md"
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
