/**
 * 施設情報設定ビュー
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Calendar, Clock, Users } from 'lucide-react';
import { FacilitySettings } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';

const FacilitySettingsView: React.FC = () => {
  const { facilitySettings, updateFacilitySettings } = useFacilityData();

  const [settings, setSettings] = useState<FacilitySettings>(facilitySettings);
  const [newHoliday, setNewHoliday] = useState('');

  // facilitySettingsが更新されたらローカル状態も更新
  useEffect(() => {
    setSettings(facilitySettings);
  }, [facilitySettings]);

  const weekDays = [
    { value: 0, label: '日' },
    { value: 1, label: '月' },
    { value: 2, label: '火' },
    { value: 3, label: '水' },
    { value: 4, label: '木' },
    { value: 5, label: '金' },
    { value: 6, label: '土' },
  ];

  const handleSave = () => {
    updateFacilitySettings(settings);
    alert('施設情報を保存しました');
  };

  const toggleRegularHoliday = (day: number) => {
    const newHolidays = settings.regularHolidays.includes(day)
      ? settings.regularHolidays.filter((d) => d !== day)
      : [...settings.regularHolidays, day];
    setSettings({ ...settings, regularHolidays: newHolidays });
  };

  const addCustomHoliday = () => {
    if (newHoliday && !settings.customHolidays.includes(newHoliday)) {
      setSettings({
        ...settings,
        customHolidays: [...settings.customHolidays, newHoliday],
      });
      setNewHoliday('');
    }
  };

  const removeCustomHoliday = (date: string) => {
    setSettings({
      ...settings,
      customHolidays: settings.customHolidays.filter((d) => d !== date),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Settings size={24} className="mr-2 text-[#00c4cc]" />
            施設情報設定
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            定休日、営業時間、受け入れ人数などの施設情報を設定します。
          </p>
        </div>
        <button
          onClick={handleSave}
          className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-6 py-2 rounded-md text-sm font-bold flex items-center shadow-sm transition-all"
        >
          <Save size={16} className="mr-2" />
          保存
        </button>
      </div>

      {/* 定休日設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Calendar size={20} className="mr-2 text-[#00c4cc]" />
          定休日設定
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              週次定休日
            </label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleRegularHoliday(day.value)}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                    settings.regularHolidays.includes(day.value)
                      ? 'bg-red-100 text-red-700 border-2 border-red-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              カスタム休業日（祝日など）
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <button
                onClick={addCustomHoliday}
                className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-md text-sm font-bold transition-colors"
              >
                追加
              </button>
            </div>
            {settings.customHolidays.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.customHolidays.map((date) => (
                  <div
                    key={date}
                    className="bg-red-50 border border-red-200 rounded-md px-3 py-1.5 flex items-center space-x-2"
                  >
                    <span className="text-sm text-red-700 font-bold">{date}</span>
                    <button
                      onClick={() => removeCustomHoliday(date)}
                      className="text-red-600 hover:text-red-800 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 営業時間設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Clock size={20} className="mr-2 text-[#00c4cc]" />
          営業時間設定
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">午前</label>
            <div className="flex items-center space-x-2">
              <input
                type="time"
                value={settings.businessHours.AM.start}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    businessHours: {
                      ...settings.businessHours,
                      AM: { ...settings.businessHours.AM, start: e.target.value },
                    },
                  })
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <span className="text-gray-600">～</span>
              <input
                type="time"
                value={settings.businessHours.AM.end}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    businessHours: {
                      ...settings.businessHours,
                      AM: { ...settings.businessHours.AM, end: e.target.value },
                    },
                  })
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">午後</label>
            <div className="flex items-center space-x-2">
              <input
                type="time"
                value={settings.businessHours.PM.start}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    businessHours: {
                      ...settings.businessHours,
                      PM: { ...settings.businessHours.PM, start: e.target.value },
                    },
                  })
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <span className="text-gray-600">～</span>
              <input
                type="time"
                value={settings.businessHours.PM.end}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    businessHours: {
                      ...settings.businessHours,
                      PM: { ...settings.businessHours.PM, end: e.target.value },
                    },
                  })
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 受け入れ人数設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Users size={20} className="mr-2 text-[#00c4cc]" />
          受け入れ人数設定
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              午前の定員（1日あたり）
            </label>
            <input
              type="number"
              min="1"
              value={settings.capacity.AM}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  capacity: {
                    ...settings.capacity,
                    AM: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
            <p className="text-xs text-gray-500 mt-1">名</p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              午後の定員（1日あたり）
            </label>
            <input
              type="number"
              min="1"
              value={settings.capacity.PM}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  capacity: {
                    ...settings.capacity,
                    PM: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
            <p className="text-xs text-gray-500 mt-1">名</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacilitySettingsView;

