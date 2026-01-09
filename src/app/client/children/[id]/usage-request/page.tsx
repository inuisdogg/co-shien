/**
 * 利用曜日申請ページ
 * 保護者から施設への利用曜日申請
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Calendar, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default function UsageRequestPage() {
  const router = useRouter();
  const params = useParams();
  const childId = params.id as string;
  
  const [child, setChild] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [timeSlots, setTimeSlots] = useState<Record<number, 'AM' | 'PM' | 'AMPM'>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/client/login');
          return;
        }

        const user = JSON.parse(userStr);

        // 児童情報を取得
        const { data: childData } = await supabase
          .from('children')
          .select('*')
          .eq('id', childId)
          .eq('owner_profile_id', user.id)
          .single();

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
          .eq('child_id', childId)
          .eq('status', 'active');

        if (contractsData && contractsData.length > 0) {
          setContracts(contractsData);
          setSelectedFacility(contractsData[0].facility_id);
        }
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    if (childId) {
      fetchData();
    }
  }, [childId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedFacility) {
      setError('施設を選択してください');
      return;
    }

    if (selectedDays.length === 0) {
      setError('利用曜日を選択してください');
      return;
    }

    if (!startDate) {
      setError('利用開始日を入力してください');
      return;
    }

    setSubmitting(true);

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/client/login');
        return;
      }

      // スケジュールを一括作成
      const schedules = [];
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(start.getFullYear(), start.getMonth() + 3, 0); // デフォルト3ヶ月

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (selectedDays.includes(dayOfWeek)) {
          const timeSlot = timeSlots[dayOfWeek] || 'PM';
          
          if (timeSlot === 'AM' || timeSlot === 'AMPM') {
            schedules.push({
              id: `${childId}-${d.toISOString().split('T')[0]}-AM`,
              facility_id: selectedFacility,
              child_id: childId,
              child_name: child?.name || '',
              date: d.toISOString().split('T')[0],
              slot: 'AM',
              has_pickup: false,
              has_dropoff: false,
            });
          }
          
          if (timeSlot === 'PM' || timeSlot === 'AMPM') {
            schedules.push({
              id: `${childId}-${d.toISOString().split('T')[0]}-PM`,
              facility_id: selectedFacility,
              child_id: childId,
              child_name: child?.name || '',
              date: d.toISOString().split('T')[0],
              slot: 'PM',
              has_pickup: false,
              has_dropoff: false,
            });
          }
        }
      }

      // スケジュールを一括挿入
      const { error: scheduleError } = await supabase
        .from('schedules')
        .upsert(schedules, { onConflict: 'id' });

      if (scheduleError) {
        throw scheduleError;
      }

      alert('利用曜日の申請を送信しました');
      router.push(`/client/children/${childId}`);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push(`/client/children/${childId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">利用曜日申請</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
            {error}
          </div>
        )}

        {contracts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">契約中の施設がありません</p>
            <p className="text-sm text-gray-500">施設と契約すると、利用曜日を申請できます</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                施設
              </label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              >
                <option value="">施設を選択</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.facility_id}>
                    {contract.facilities?.name || '施設名不明'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                利用曜日
              </label>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, index) => {
                  const isSelected = selectedDays.includes(index);
                  const timeSlot = timeSlots[index] || 'PM';
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDays([...selectedDays, index]);
                            } else {
                              setSelectedDays(selectedDays.filter(d => d !== index));
                              const newTimeSlots = { ...timeSlots };
                              delete newTimeSlots[index];
                              setTimeSlots(newTimeSlots);
                            }
                          }}
                          className="accent-orange-400"
                        />
                        <span className="ml-2 text-sm font-medium">{day}</span>
                      </label>
                      {isSelected && (
                        <div className="mt-2 space-y-1">
                          <label className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`slot-${index}`}
                              checked={timeSlot === 'AM'}
                              onChange={() => setTimeSlots({ ...timeSlots, [index]: 'AM' })}
                              className="accent-orange-400"
                            />
                            <span className="ml-1">午前</span>
                          </label>
                          <label className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`slot-${index}`}
                              checked={timeSlot === 'PM'}
                              onChange={() => setTimeSlots({ ...timeSlots, [index]: 'PM' })}
                              className="accent-orange-400"
                            />
                            <span className="ml-1">午後</span>
                          </label>
                          <label className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`slot-${index}`}
                              checked={timeSlot === 'AMPM'}
                              onChange={() => setTimeSlots({ ...timeSlots, [index]: 'AMPM' })}
                              className="accent-orange-400"
                            />
                            <span className="ml-1">終日</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  利用開始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  利用終了日（任意）
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  送信中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  申請を送信
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

