/**
 * スタッフ・シフト管理ビュー
 */

'use client';

import React, { useState } from 'react';
import { CalendarCheck, Users, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Staff, ScheduleItem } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';

const StaffView: React.FC = () => {
  const { staff, setStaff, schedules } = useFacilityData();
  const [subTab, setSubTab] = useState<'shift' | 'list'>('shift');

  const weekDates = [
    { date: '2024-05-13', label: '13(月)' },
    { date: '2024-05-14', label: '14(火)' },
    { date: '2024-05-15', label: '15(水)' },
    { date: '2024-05-16', label: '16(木)' },
    { date: '2024-05-17', label: '17(金)' },
    { date: '2024-05-18', label: '18(土)' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">勤怠・シフト管理</h2>
          <p className="text-gray-500 text-xs mt-1">
            スタッフのマスタ管理と、配置基準を満たすためのシフト作成を行います。
          </p>
        </div>
        <div className="bg-gray-100 p-1 rounded-md flex">
          <button
            onClick={() => setSubTab('shift')}
            className={`px-4 py-2 text-sm font-bold rounded transition-all flex items-center ${
              subTab === 'shift'
                ? 'bg-white text-[#00c4cc] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarCheck size={16} className="mr-2" />
            シフト管理
          </button>
          <button
            onClick={() => setSubTab('list')}
            className={`px-4 py-2 text-sm font-bold rounded transition-all flex items-center ${
              subTab === 'list'
                ? 'bg-white text-[#00c4cc] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} className="mr-2" />
            スタッフ登録
          </button>
        </div>
      </div>

      {subTab === 'shift' ? (
        /* Shift Management Tab */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Info Bar: Child Count Check */}
          <div className="bg-[#e0f7fa] p-4 border-b border-[#b2ebf2] flex items-center space-x-2 text-sm text-[#006064]">
            <AlertCircle size={18} />
            <span>
              各日の「利用児童数」を確認しながらシフトを配置してください。児童10名につき2名の配置が必要です。
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-3 border-b border-r border-gray-100 bg-gray-50 min-w-[150px] text-gray-500 font-bold">
                    スタッフ / 日付
                  </th>
                  {weekDates.map((d) => {
                    const countAM = schedules.filter(
                      (s) => s.date === d.date && s.slot === 'AM'
                    ).length;
                    const countPM = schedules.filter(
                      (s) => s.date === d.date && s.slot === 'PM'
                    ).length;
                    const maxCount = Math.max(countAM, countPM);
                    const isBusy = maxCount >= 8;

                    return (
                      <th
                        key={d.date}
                        className={`p-2 border-b border-r border-gray-100 text-center min-w-[100px] ${
                          isBusy ? 'bg-orange-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="font-bold text-gray-700">{d.label}</div>
                        <div className="text-[10px] mt-1 font-normal text-gray-500">
                          児童:{' '}
                          <span className={`font-bold ${isBusy ? 'text-orange-600' : ''}`}>
                            {maxCount}名
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staff.map((s: Staff) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3 border-b border-r border-gray-100 bg-white">
                      <div className="font-bold text-gray-800">{s.name}</div>
                      <div className="text-[10px] text-gray-500">
                        {s.role} ({s.type})
                      </div>
                    </td>
                    {weekDates.map((d) => (
                      <td
                        key={`${s.id}-${d.date}`}
                        className="p-1 border-b border-r border-gray-100 text-center bg-white"
                      >
                        <select className="w-full bg-transparent text-center text-xs py-2 outline-none cursor-pointer hover:bg-gray-50 rounded focus:bg-[#e0f7fa] font-medium text-gray-700">
                          <option value="">-</option>
                          <option value="早">早番</option>
                          <option value="遅">遅番</option>
                          <option value="日">日勤</option>
                          <option value="休" className="text-red-400">
                            休
                          </option>
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Total Staff Count Row */}
                <tr className="bg-gray-50 font-bold text-gray-600">
                  <td className="p-3 border-r border-gray-100 text-xs uppercase tracking-wider">
                    配置人数合計
                  </td>
                  {weekDates.map((d) => (
                    <td
                      key={`total-${d.date}`}
                      className="p-2 border-r border-gray-100 text-center text-xs text-gray-400"
                    >
                      - 名
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Staff Master List Tab */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between mb-4">
            <h3 className="font-bold text-lg text-gray-800">登録スタッフ一覧</h3>
            <button className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm transition-colors flex items-center">
              <Plus size={16} className="mr-2" /> 追加
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((s: Staff) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 border border-gray-200">
                    {s.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-0.5">
                      {s.role} / {s.type}
                    </div>
                  </div>
                </div>
                <button className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffView;

