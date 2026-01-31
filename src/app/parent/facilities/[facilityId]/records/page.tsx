/**
 * 施設の実績記録表ページ（利用者側）
 * 月別の実績記録とサイン機能
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Building2, Calendar, FileText, CheckCircle,
  ChevronLeft, ChevronRight, User, AlertCircle, PenTool, Download, Printer
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
  recordSheetRemarks?: string;
  parentSignature?: string;
  parentSignedAt?: string;
};

export default function FacilityRecordsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const facilityId = params.facilityId as string;
  const childIdParam = searchParams.get('child');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // サイン用のstate
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
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
            const schedule = daySchedules[0]; // 最初のスケジュールを使用
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
              recordSheetRemarks: schedule.record_sheet_remarks,
              parentSignature: schedule.parent_signature,
              parentSignedAt: schedule.parent_signed_at,
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
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signature = canvas.toDataURL('image/png');

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

  const handlePrint = () => {
    window.print();
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const isSigned = schedules.some(s => s.parent_signature);
  const selectedChild = children.find(c => c.id === selectedChildId);

  // 利用日数の集計
  const usageDays = monthlyRecords.filter(r => r.serviceStatus === '利用' || r.slot).length;
  const pickupDays = monthlyRecords.filter(r => r.pickup).length;
  const dropoffDays = monthlyRecords.filter(r => r.dropoff).length;

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

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* ヘッダー（印刷時は非表示） */}
      <header className="bg-white shadow-sm border-b border-gray-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push(`/client/facilities/${facilityId}?child=${selectedChildId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FDEBD0] rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#ED8936]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">実績記録表</h1>
                <p className="text-sm text-gray-500">{facility?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-md"
              >
                <Printer className="w-4 h-4" />
                印刷
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 print:p-0">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2 print:hidden">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* 操作パネル（印刷時は非表示） */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* 児童選択 */}
            {children.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">お子様:</label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 月選択 */}
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
              <span className="text-sm font-medium min-w-[120px] text-center">
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

            {/* サインボタン */}
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
        </div>

        {/* 実績記録表 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 print:shadow-none print:border-0 print:p-0">
          {/* ヘッダー情報（印刷用） */}
          <div className="mb-6 print:mb-4">
            <h2 className="text-xl font-bold text-center mb-4 print:text-lg">
              サービス提供実績記録票
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm print:text-xs">
              <div className="space-y-1">
                <p><span className="font-bold">事業所名:</span> {facility?.name}</p>
                <p><span className="font-bold">対象年月:</span> {selectedMonth.getFullYear()}年{selectedMonth.getMonth() + 1}月</p>
              </div>
              <div className="space-y-1">
                <p><span className="font-bold">利用者名:</span> {selectedChild?.name}</p>
                <p><span className="font-bold">受給者証番号:</span> {selectedChild?.beneficiary_number || '未登録'}</p>
              </div>
            </div>
          </div>

          {/* 実績テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-400 text-sm print:text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-2 text-center w-12">日</th>
                  <th className="border border-gray-400 px-2 py-2 text-center w-8">曜</th>
                  <th className="border border-gray-400 px-2 py-2 text-center">サービス内容</th>
                  <th className="border border-gray-400 px-2 py-2 text-center w-16">開始</th>
                  <th className="border border-gray-400 px-2 py-2 text-center w-16">終了</th>
                  <th className="border border-gray-400 px-2 py-2 text-center w-12">算定</th>
                  <th className="border border-gray-400 px-2 py-2 text-center w-16">送迎</th>
                  <th className="border border-gray-400 px-2 py-2 text-left">備考</th>
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
                      className={`${isWeekend && !hasActivity ? 'bg-gray-50' : ''} ${hasActivity ? 'bg-green-50' : ''}`}
                    >
                      <td className="border border-gray-400 px-2 py-1 text-center">{dayNum}</td>
                      <td className={`border border-gray-400 px-2 py-1 text-center ${
                        record.dayOfWeek === 0 ? 'text-red-600' :
                        record.dayOfWeek === 6 ? 'text-blue-600' : ''
                      }`}>
                        {weekDays[record.dayOfWeek]}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center">
                        {record.serviceStatus === '欠席(加算なし)' ? '欠席' :
                         record.slot === 'AM' ? '午前' :
                         record.slot === 'PM' ? '午後' : '-'}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center">
                        {record.startTime || '-'}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center">
                        {record.endTime || '-'}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center">
                        {record.calculatedTime ? `${record.calculatedTime}h` : '-'}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-center">
                        {record.pickup && record.dropoff ? '往復' :
                         record.pickup ? '迎' :
                         record.dropoff ? '送' : '-'}
                      </td>
                      <td className="border border-gray-400 px-2 py-1 text-xs">
                        {record.recordSheetRemarks || record.memo || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 集計 */}
          <div className="mt-6 grid grid-cols-4 gap-4 print:mt-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center print:bg-white print:border print:border-gray-400">
              <p className="text-2xl font-bold text-blue-600 print:text-lg">{usageDays}</p>
              <p className="text-xs text-gray-600">利用日数</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center print:bg-white print:border print:border-gray-400">
              <p className="text-2xl font-bold text-green-600 print:text-lg">{pickupDays}</p>
              <p className="text-xs text-gray-600">送迎（迎え）</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center print:bg-white print:border print:border-gray-400">
              <p className="text-2xl font-bold text-purple-600 print:text-lg">{dropoffDays}</p>
              <p className="text-xs text-gray-600">送迎（送り）</p>
            </div>
            <div className="bg-[#FEF3E2] rounded-lg p-3 text-center print:bg-white print:border print:border-gray-400">
              <p className="text-2xl font-bold text-[#ED8936] print:text-lg">
                {selectedChild?.grant_days || '-'}
              </p>
              <p className="text-xs text-gray-600">支給日数</p>
            </div>
          </div>

          {/* サイン欄 */}
          <div className="mt-6 pt-6 border-t border-gray-200 print:mt-4 print:pt-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">事業所確認印</p>
                <div className="border border-gray-300 rounded h-20 print:h-16"></div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">保護者確認印</p>
                {isSigned && schedules[0]?.parent_signature ? (
                  <div className="border border-gray-300 rounded p-2 h-20 print:h-16 flex items-center justify-center">
                    <img
                      src={schedules[0].parent_signature}
                      alt="保護者サイン"
                      className="max-h-full"
                    />
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded h-20 print:h-16 flex items-center justify-center text-gray-400 text-sm">
                    未署名
                  </div>
                )}
              </div>
            </div>
            {isSigned && schedules[0]?.parent_signed_at && (
              <p className="text-xs text-gray-500 mt-2 text-right print:text-xs">
                署名日時: {new Date(schedules[0].parent_signed_at).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* サインモーダル */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:hidden">
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

      {/* 印刷用スタイル */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
