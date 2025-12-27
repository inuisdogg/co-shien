/**
 * スケジュールビュー（利用調整・予約）
 */

'use client';

import React, { useState } from 'react';
import { CalendarDays, Bell, Plus } from 'lucide-react';
import { TimeSlot, ScheduleItem, BookingRequest, Child } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';

const ScheduleView: React.FC = () => {
  const {
    schedules,
    setSchedules,
    children,
    requests,
    setRequests,
    addSchedule,
  } = useFacilityData();

  const [viewFormat, setViewFormat] = useState<'month' | 'week'>('week');
  const [selectedDate, setSelectedDate] = useState('2024-05-15');

  const [newBooking, setNewBooking] = useState({
    childId: '',
    date: '2024-05-15',
    slot: 'PM' as TimeSlot,
    pickup: true,
    dropoff: true,
  });

  const capacity = { AM: 5, PM: 10 };
  const weekDates = [
    { date: '2024-05-13', day: '月' },
    { date: '2024-05-14', day: '火' },
    { date: '2024-05-15', day: '水' },
    { date: '2024-05-16', day: '木' },
    { date: '2024-05-17', day: '金' },
    { date: '2024-05-18', day: '土' },
    { date: '2024-05-19', day: '日' },
  ];

  const handleApproveRequest = (reqId: number) => {
    setRequests(requests.filter((r) => r.id !== reqId));
    alert('承認しました（デモ：リストから消去）');
  };

  const handleAddBooking = () => {
    if (!newBooking.childId) return;
    const child = children.find((c) => c.id === newBooking.childId);
    if (!child) return;

    addSchedule({
      date: newBooking.date,
      childId: child.id,
      childName: child.name,
      slot: newBooking.slot,
      hasPickup: newBooking.pickup,
      hasDropoff: newBooking.dropoff,
    });

    alert(`${child.name}さんの予約を追加しました`);
    setNewBooking({
      childId: '',
      date: newBooking.date,
      slot: 'PM',
      pickup: true,
      dropoff: true,
    });
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6 animate-in fade-in duration-500">
      {/* Left Panel: Booking Requests */}
      <div className="w-64 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-gray-100 bg-orange-50">
          <h3 className="font-bold text-orange-800 flex items-center text-sm">
            <Bell size={16} className="mr-2" />
            承認待ち ({requests.length})
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
          {requests.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-4">
              現在リクエストはありません
            </div>
          )}
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white p-3 rounded border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-bold text-gray-800">{req.childName}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    req.type === '欠席連絡'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-blue-100 text-[#00c4cc]'
                  }`}
                >
                  {req.type}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-3 flex items-center">
                <CalendarDays size={12} className="mr-1 text-gray-400" />
                {req.date} {req.time}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleApproveRequest(req.id)}
                  className="flex-1 bg-[#00c4cc] text-white hover:bg-[#00b0b8] py-1.5 rounded text-xs font-bold transition-colors shadow-sm"
                >
                  承認
                </button>
                <button className="px-3 bg-gray-100 text-gray-600 hover:bg-gray-200 py-1.5 rounded text-xs font-bold transition-colors">
                  却下
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Middle Panel: Calendar */}
      <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 p-1 rounded">
              <button
                onClick={() => setViewFormat('month')}
                className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${
                  viewFormat === 'month'
                    ? 'bg-white text-[#00c4cc] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                月間
              </button>
              <button
                onClick={() => setViewFormat('week')}
                className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${
                  viewFormat === 'week'
                    ? 'bg-white text-[#00c4cc] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                週間
              </button>
            </div>
            <h3 className="font-bold text-lg text-gray-800">2024年 5月</h3>
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded border border-gray-100">
            稼働率: <span className="font-bold text-gray-800 text-sm ml-1">82%</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white relative p-0">
          {viewFormat === 'week' && (
            <div className="min-w-[700px]">
              <div className="flex border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
                <div className="w-16 p-2 shrink-0 border-r border-gray-200 text-xs text-center font-bold text-gray-500 flex items-center justify-center">
                  区分
                </div>
                {weekDates.map((d, i) => (
                  <div
                    key={i}
                    className={`flex-1 p-2 text-center border-r border-gray-200 text-sm font-bold ${
                      i >= 5 ? 'text-red-500' : 'text-gray-700'
                    }`}
                  >
                    {d.date.split('-')[2]} ({d.day})
                  </div>
                ))}
              </div>
              {/* AM Row */}
              <div className="flex border-b border-gray-200 min-h-[120px]">
                <div className="w-16 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                  <div className="text-xs font-bold text-gray-600">午前</div>
                  <div className="text-[10px] text-gray-400 mt-1">定員{capacity.AM}</div>
                </div>
                {weekDates.map((d, i) => {
                  const items = schedules.filter((s) => s.date === d.date && s.slot === 'AM');
                  return (
                    <div
                      key={i}
                      className="flex-1 p-1 border-r border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                    >
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="mb-1 bg-[#e0f7fa] border border-[#b2ebf2] rounded px-2 py-1.5 text-xs text-[#006064] font-medium truncate shadow-sm"
                        >
                          {item.childName}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {/* PM Row */}
              <div className="flex min-h-[200px]">
                <div className="w-16 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                  <div className="text-xs font-bold text-gray-600">午後</div>
                  <div className="text-[10px] text-gray-400 mt-1">定員{capacity.PM}</div>
                </div>
                {weekDates.map((d, i) => {
                  const items = schedules.filter((s) => s.date === d.date && s.slot === 'PM');
                  return (
                    <div
                      key={i}
                      className="flex-1 p-1 border-r border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                    >
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="mb-1 bg-orange-50 border border-orange-100 rounded px-2 py-1.5 text-xs text-orange-900 shadow-sm group relative hover:border-orange-300 transition-colors"
                        >
                          <div className="font-bold truncate text-[11px]">{item.childName}</div>
                          <div className="flex gap-1 mt-1">
                            {item.hasPickup && (
                              <span className="bg-white/80 px-1 rounded-[2px] text-[9px] text-orange-600 font-bold border border-orange-100">
                                迎
                              </span>
                            )}
                            {item.hasDropoff && (
                              <span className="bg-white/80 px-1 rounded-[2px] text-[9px] text-orange-600 font-bold border border-orange-100">
                                送
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {viewFormat === 'month' && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <CalendarDays size={48} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm">月間カレンダー表示エリア</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Quick Register */}
      <div className="w-72 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center text-sm">
            <Plus size={16} className="mr-2 text-[#00c4cc]" />
            新規利用登録
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">児童を選択</label>
            <select
              className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] transition-all"
              value={newBooking.childId}
              onChange={(e) => setNewBooking({ ...newBooking, childId: e.target.value })}
            >
              <option value="">選択してください</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-gray-400 mt-1 text-right">
              ※児童管理マスタより参照
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">利用日</label>
            <input
              type="date"
              className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
              value={newBooking.date}
              onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">時間帯</label>
            <select
              className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
              value={newBooking.slot}
              onChange={(e) =>
                setNewBooking({ ...newBooking, slot: e.target.value as TimeSlot })
              }
            >
              <option value="PM">午後 (放課後)</option>
              <option value="AM">午前</option>
            </select>
          </div>

          <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-3">
            <label className="text-xs font-bold text-gray-500 block">送迎オプション</label>
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={newBooking.pickup}
                onChange={(e) => setNewBooking({ ...newBooking, pickup: e.target.checked })}
                className="accent-[#00c4cc] w-4 h-4"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                お迎え (学校→事業所)
              </span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={newBooking.dropoff}
                onChange={(e) => setNewBooking({ ...newBooking, dropoff: e.target.checked })}
                className="accent-[#00c4cc] w-4 h-4"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                お送り (事業所→自宅)
              </span>
            </label>
          </div>

          <button
            onClick={handleAddBooking}
            className="w-full py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md shadow-md text-sm transition-all transform hover:-translate-y-0.5"
          >
            登録する
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleView;

