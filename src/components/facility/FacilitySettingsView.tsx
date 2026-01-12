/**
 * 施設情報設定ビュー
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Calendar, Clock, Users, Building2, Plus, Trash2, History, X, MapPin, Truck } from 'lucide-react';
import { FacilitySettings, HolidayPeriod, BusinessHoursPeriod, FacilitySettingsHistory } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getJapaneseHolidays } from '@/utils/japaneseHolidays';
import DocumentConfigView from './DocumentConfigView';

const FacilitySettingsView: React.FC = () => {
  const { facilitySettings, updateFacilitySettings, timeSlots, addTimeSlot, updateTimeSlot, deleteTimeSlot } = useFacilityData();
  const { facility } = useAuth();
  const [currentFacilityCode, setCurrentFacilityCode] = useState<string>('');

  // 最新の施設コードを取得
  useEffect(() => {
    const fetchFacilityCode = async () => {
      if (facility?.id) {
        const { data, error } = await supabase
          .from('facilities')
          .select('code')
          .eq('id', facility.id)
          .single();
        
        if (!error && data) {
          setCurrentFacilityCode(data.code || '');
        }
      }
    };
    
    fetchFacilityCode();
  }, [facility?.id]);

  const [settings, setSettings] = useState<FacilitySettings>(facilitySettings);
  const [newHoliday, setNewHoliday] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState<'business_hours' | 'holidays' | 'all'>('all');
  const [historyData, setHistoryData] = useState<FacilitySettingsHistory[]>([]);
  const [isAddingTimeSlot, setIsAddingTimeSlot] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
  const [editingTimeSlotId, setEditingTimeSlotId] = useState<string | null>(null);
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  // 郵便番号から住所を検索
  const lookupAddress = async () => {
    const postalCode = settings.postalCode?.replace(/-/g, '');
    if (!postalCode || postalCode.length !== 7) {
      alert('7桁の郵便番号を入力してください');
      return;
    }

    setIsAddressLoading(true);
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const fullAddress = `${result.address1}${result.address2}${result.address3}`;
        setSettings({
          ...settings,
          address: fullAddress,
        });
      } else {
        alert('住所が見つかりませんでした');
      }
    } catch (error) {
      console.error('Error looking up address:', error);
      alert('住所検索に失敗しました');
    } finally {
      setIsAddressLoading(false);
    }
  };

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

  const handleSave = async () => {
    try {
      console.log('💾 施設情報を保存中...', {
        facilityName: settings.facilityName,
        capacity: settings.capacity,
        regularHolidays: settings.regularHolidays,
        customHolidays: settings.customHolidays,
        includeHolidays: settings.includeHolidays,
        businessHours: settings.businessHours,
        holidayPeriods: settings.holidayPeriods,
        businessHoursPeriods: settings.businessHoursPeriods,
      });
      await updateFacilitySettings(settings, '施設情報を更新しました');
      alert('施設情報を保存しました');
    } catch (error: any) {
      console.error('❌ Error saving facility settings:', error);
      alert(`施設情報の保存に失敗しました: ${error.message || '不明なエラー'}`);
    }
  };

  // 履歴を取得
  const fetchHistory = async (type: 'business_hours' | 'holidays' | 'all' = 'all') => {
    if (!facility?.id) return;
    
    try {
      let query = supabase
        .from('facility_settings_history')
        .select('*')
        .eq('facility_id', facility.id)
        .order('changed_at', { ascending: false })
        .limit(50);
      
      if (type !== 'all') {
        query = query.eq('change_type', type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching history:', error);
        return;
      }
      
      if (data) {
        setHistoryData(data.map((row: any) => ({
          id: row.id,
          facilityId: row.facility_id,
          changeType: row.change_type,
          oldValue: row.old_value,
          newValue: row.new_value,
          changedBy: row.changed_by,
          changedAt: row.changed_at,
          description: row.description,
        })));
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // 履歴モーダルを開く
  const openHistoryModal = async (type: 'business_hours' | 'holidays' | 'all' = 'all') => {
    setHistoryType(type);
    setIsHistoryModalOpen(true);
    await fetchHistory(type);
  };

  // 期間ごとの営業時間設定を追加
  const addBusinessHoursPeriod = () => {
    const newPeriod: BusinessHoursPeriod = {
      id: `period-${Date.now()}`,
      startDate: '',
      endDate: '',
      businessHours: {
        AM: { start: '09:00', end: '12:00' },
        PM: { start: '13:00', end: '18:00' },
      },
    };
    setSettings({
      ...settings,
      businessHoursPeriods: [...(settings.businessHoursPeriods || []), newPeriod],
    });
  };

  // 期間ごとの営業時間設定を更新
  const updateBusinessHoursPeriod = (periodId: string, updates: Partial<BusinessHoursPeriod>) => {
    setSettings({
      ...settings,
      businessHoursPeriods: (settings.businessHoursPeriods || []).map((period) =>
        period.id === periodId ? { ...period, ...updates } : period
      ),
    });
  };

  // 期間ごとの営業時間設定を削除
  const removeBusinessHoursPeriod = (periodId: string) => {
    setSettings({
      ...settings,
      businessHoursPeriods: (settings.businessHoursPeriods || []).filter(
        (period) => period.id !== periodId
      ),
    });
  };

  const toggleRegularHoliday = (day: number) => {
    const newHolidays = settings.regularHolidays.includes(day)
      ? settings.regularHolidays.filter((d) => d !== day)
      : [...settings.regularHolidays, day];
    setSettings({ ...settings, regularHolidays: newHolidays });
  };

  const toggleIncludeHolidays = () => {
    const newIncludeHolidays = !settings.includeHolidays;
    
    // includeHolidaysフラグを切り替えるだけ
    // isHoliday関数でincludeHolidaysがtrueの場合、isJapaneseHolidayで判定されるため、
    // customHolidaysに追加する必要はない
    setSettings({ 
      ...settings, 
      includeHolidays: newIncludeHolidays,
    });
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

  // 期間ごとの定休日設定を追加
  const addHolidayPeriod = () => {
    const newPeriod: HolidayPeriod = {
      id: `period-${Date.now()}`,
      startDate: '',
      endDate: '',
      regularHolidays: [],
    };
    setSettings({
      ...settings,
      holidayPeriods: [...(settings.holidayPeriods || []), newPeriod],
    });
  };

  // 期間ごとの定休日設定を更新
  const updateHolidayPeriod = (periodId: string, updates: Partial<HolidayPeriod>) => {
    setSettings({
      ...settings,
      holidayPeriods: (settings.holidayPeriods || []).map((period) =>
        period.id === periodId ? { ...period, ...updates } : period
      ),
    });
  };

  // 期間ごとの定休日設定を削除
  const removeHolidayPeriod = (periodId: string) => {
    setSettings({
      ...settings,
      holidayPeriods: (settings.holidayPeriods || []).filter((period) => period.id !== periodId),
    });
  };

  // 期間内の定休日を切り替え
  const togglePeriodHoliday = (periodId: string, day: number) => {
    const period = (settings.holidayPeriods || []).find((p) => p.id === periodId);
    if (!period) return;

    const newHolidays = period.regularHolidays.includes(day)
      ? period.regularHolidays.filter((d) => d !== day)
      : [...period.regularHolidays, day];
    
    updateHolidayPeriod(periodId, { regularHolidays: newHolidays });
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Settings size={24} className="mr-2 text-[#00c4cc]" />
            施設情報設定
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            定休日、営業時間、受け入れ人数などの施設情報を設定します。
          </p>
        </div>
      </div>

      {/* 施設名設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Building2 size={20} className="mr-2 text-[#00c4cc]" />
          施設名設定
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              施設ID
            </label>
            <div className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 font-mono">
              {currentFacilityCode || facility?.code || '未設定'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              この施設IDはログイン時に使用します
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              施設名
            </label>
            <input
              type="text"
              value={settings.facilityName || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  facilityName: e.target.value,
                })
              }
              placeholder="施設名を入力してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
            <p className="text-xs text-gray-500 mt-1">
              この施設名はサイドバーの下部に表示されます
            </p>
          </div>
        </div>
      </div>

      {/* 施設住所設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <MapPin size={20} className="mr-2 text-[#00c4cc]" />
          施設住所設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          送迎ルート計算時の起点・終点として使用されます。
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              郵便番号
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.postalCode || ''}
                onChange={(e) => {
                  // ハイフンを自動的に除去して保存
                  const value = e.target.value.replace(/-/g, '');
                  setSettings({
                    ...settings,
                    postalCode: value,
                  });
                }}
                placeholder="1234567"
                maxLength={7}
                className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <button
                onClick={lookupAddress}
                disabled={isAddressLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isAddressLoading ? '検索中...' : '住所検索'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              郵便番号を入力して「住所検索」をクリックすると、住所が自動入力されます
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              住所
            </label>
            <input
              type="text"
              value={settings.address || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  address: e.target.value,
                })
              }
              placeholder="東京都○○区1-2-3 ビル名"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
          </div>
        </div>
      </div>

      {/* 送迎設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Truck size={20} className="mr-2 text-[#00c4cc]" />
          送迎設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          1回の送迎で乗車できる最大人数を設定します。送迎ルート計算時に使用されます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              お迎え可能人数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.transportCapacity?.pickup ?? 4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    transportCapacity: {
                      ...(settings.transportCapacity || { pickup: 4, dropoff: 4 }),
                      pickup: parseInt(e.target.value) || 4,
                    },
                  })
                }
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <span className="text-sm text-gray-600">名</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              朝のお迎え時に1回で乗車できる最大人数
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              お送り可能人数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.transportCapacity?.dropoff ?? 4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    transportCapacity: {
                      ...(settings.transportCapacity || { pickup: 4, dropoff: 4 }),
                      dropoff: parseInt(e.target.value) || 4,
                    },
                  })
                }
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <span className="text-sm text-gray-600">名</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              帰りのお送り時に1回で乗車できる最大人数
            </p>
          </div>
        </div>
      </div>

      {/* 定休日設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-800 flex items-center">
            <Calendar size={20} className="mr-2 text-[#00c4cc]" />
            定休日設定
          </h3>
          <button
            onClick={() => openHistoryModal('holidays')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
          >
            <History size={14} />
            変更履歴を見る
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              デフォルトの週次定休日（期間指定がない場合）
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
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-gray-700 block">
                期間ごとの定休日設定
              </label>
              <button
                onClick={addHolidayPeriod}
                className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-colors"
              >
                <Plus size={14} className="mr-1" />
                期間を追加
              </button>
            </div>
            <div className="space-y-4">
              {(settings.holidayPeriods || []).map((period) => (
                <div
                  key={period.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-600">期間設定</span>
                    <button
                      onClick={() => removeHolidayPeriod(period.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">
                        開始日
                      </label>
                      <input
                        type="date"
                        value={period.startDate}
                        onChange={(e) =>
                          updateHolidayPeriod(period.id, { startDate: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">
                        終了日（空欄の場合は無期限）
                      </label>
                      <input
                        type="date"
                        value={period.endDate}
                        onChange={(e) =>
                          updateHolidayPeriod(period.id, { endDate: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-2">
                      この期間の定休日
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => togglePeriodHoliday(period.id, day.value)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                            period.regularHolidays.includes(day.value)
                              ? 'bg-red-100 text-red-700 border-2 border-red-300'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(settings.holidayPeriods || []).length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  期間ごとの定休日設定がありません。期間を追加して設定してください。
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              祝日設定
            </label>
            <div className="mb-4">
              <button
                onClick={toggleIncludeHolidays}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                  settings.includeHolidays
                    ? 'bg-red-100 text-red-700 border-2 border-red-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                }`}
              >
                祝日を休業日に含める
              </button>
              <p className="text-xs text-gray-500 mt-2">
                選択すると、一般的な祝日が自動的に休業日として追加されます
              </p>
            </div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              カスタム休業日（追加の休業日など）
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-800 flex items-center">
            <Clock size={20} className="mr-2 text-[#00c4cc]" />
            営業時間設定
          </h3>
          <button
            onClick={() => openHistoryModal('business_hours')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
          >
            <History size={14} />
            変更履歴を見る
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">午前（デフォルト）</label>
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
            <label className="text-sm font-bold text-gray-700 block mb-2">午後（デフォルト）</label>
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
        
        {/* 期間ごとの営業時間設定 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-gray-700">期間ごとの営業時間設定</label>
            <button
              onClick={addBusinessHoursPeriod}
              className="text-xs bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
            >
              <Plus size={14} />
              期間を追加
            </button>
          </div>
          {settings.businessHoursPeriods && settings.businessHoursPeriods.length > 0 && (
            <div className="space-y-3">
              {settings.businessHoursPeriods.map((period) => (
                <div key={period.id} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">開始日</label>
                        <input
                          type="date"
                          value={period.startDate}
                          onChange={(e) =>
                            updateBusinessHoursPeriod(period.id, { startDate: e.target.value })
                          }
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">終了日（空欄=無期限）</label>
                        <input
                          type="date"
                          value={period.endDate}
                          onChange={(e) =>
                            updateBusinessHoursPeriod(period.id, { endDate: e.target.value })
                          }
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeBusinessHoursPeriod(period.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">午前</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          value={period.businessHours.AM.start}
                          onChange={(e) =>
                            updateBusinessHoursPeriod(period.id, {
                              businessHours: {
                                ...period.businessHours,
                                AM: { ...period.businessHours.AM, start: e.target.value },
                              },
                            })
                          }
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs w-full"
                        />
                        <span className="text-gray-600 text-xs">～</span>
                        <input
                          type="time"
                          value={period.businessHours.AM.end}
                          onChange={(e) =>
                            updateBusinessHoursPeriod(period.id, {
                              businessHours: {
                                ...period.businessHours,
                                AM: { ...period.businessHours.AM, end: e.target.value },
                              },
                            })
                          }
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs w-full"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">午後</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          value={period.businessHours.PM.start}
                          onChange={(e) =>
                            updateBusinessHoursPeriod(period.id, {
                              businessHours: {
                                ...period.businessHours,
                                PM: { ...period.businessHours.PM, start: e.target.value },
                              },
                            })
                          }
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs w-full"
                        />
                        <span className="text-gray-600 text-xs">～</span>
                        <input
                          type="time"
                          value={period.businessHours.PM.end}
                          onChange={(e) =>
                            updateBusinessHoursPeriod(period.id, {
                              businessHours: {
                                ...period.businessHours,
                                PM: { ...period.businessHours.PM, end: e.target.value },
                              },
                            })
                          }
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 時間枠設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Clock size={20} className="mr-2 text-[#00c4cc]" />
          利用時間枠設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          午前・午後以外の時間枠も設定できます。放課後デイなど複数の時間区分がある施設向けの設定です。
        </p>

        {/* 既存の時間枠一覧 */}
        <div className="space-y-3 mb-4">
          {timeSlots.map((slot) => (
            <div
              key={slot.id}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              {editingTimeSlotId === slot.id ? (
                // 編集モード
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">枠名</label>
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => updateTimeSlot(slot.id, { name: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">開始時間</label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(slot.id, { startTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">終了時間</label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(slot.id, { endTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">定員</label>
                      <input
                        type="number"
                        min="1"
                        value={slot.capacity}
                        onChange={(e) => updateTimeSlot(slot.id, { capacity: parseInt(e.target.value) || 10 })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingTimeSlotId(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      完了
                    </button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-800">{slot.name}</span>
                    <span className="text-sm text-gray-500">
                      {slot.startTime} - {slot.endTime}
                    </span>
                    <span className="text-sm text-gray-500">
                      定員: {slot.capacity}名
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingTimeSlotId(slot.id)}
                      className="text-sm text-[#00c4cc] hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`「${slot.name}」を削除しますか？`)) {
                          await deleteTimeSlot(slot.id);
                        }
                      }}
                      className="text-sm text-red-500 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 新規追加フォーム */}
        {isAddingTimeSlot ? (
          <div className="border border-[#00c4cc] rounded-lg p-4 bg-cyan-50">
            <h4 className="font-bold text-sm text-gray-700 mb-3">新しい時間枠を追加</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">枠名</label>
                <input
                  type="text"
                  value={newTimeSlot.name}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, name: e.target.value })}
                  placeholder="例: 放課後"
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">開始時間</label>
                <input
                  type="time"
                  value={newTimeSlot.startTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">終了時間</label>
                <input
                  type="time"
                  value={newTimeSlot.endTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">定員</label>
                <input
                  type="number"
                  min="1"
                  value={newTimeSlot.capacity}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, capacity: parseInt(e.target.value) || 10 })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setIsAddingTimeSlot(false);
                  setNewTimeSlot({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (!newTimeSlot.name.trim()) {
                    alert('枠名を入力してください');
                    return;
                  }
                  try {
                    await addTimeSlot({
                      name: newTimeSlot.name,
                      startTime: newTimeSlot.startTime,
                      endTime: newTimeSlot.endTime,
                      capacity: newTimeSlot.capacity,
                      displayOrder: timeSlots.length + 1,
                    });
                    setIsAddingTimeSlot(false);
                    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
                  } catch (error) {
                    alert('時間枠の追加に失敗しました');
                  }
                }}
                className="px-4 py-2 text-sm bg-[#00c4cc] text-white rounded font-bold hover:bg-[#00b0b8] transition-colors"
              >
                追加
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTimeSlot(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-[#00c4cc] hover:text-[#00c4cc] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            時間枠を追加
          </button>
        )}
      </div>

      {/* 保存ボタン */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-6 py-2 rounded-md text-sm font-bold flex items-center shadow-sm transition-all"
          >
            <Save size={16} className="mr-2" />
            保存
          </button>
        </div>
      </div>

      {/* 書類管理設定 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <DocumentConfigView />
      </div>

      {/* 履歴モーダル */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl border border-gray-100">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">変更履歴</h3>
              <div className="flex items-center gap-2">
                <select
                  value={historyType}
                  onChange={(e) => {
                    const type = e.target.value as 'business_hours' | 'holidays' | 'all';
                    setHistoryType(type);
                    fetchHistory(type);
                  }}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="all">全て</option>
                  <option value="business_hours">営業時間</option>
                  <option value="holidays">定休日</option>
                </select>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
              {historyData.length === 0 ? (
                <div className="text-center text-gray-500 py-8">履歴がありません</div>
              ) : (
                <div className="space-y-4">
                  {historyData.map((history) => (
                    <div
                      key={history.id}
                      className="border border-gray-200 rounded-md p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-600">
                            {history.changeType === 'business_hours'
                              ? '営業時間'
                              : history.changeType === 'holidays'
                              ? '定休日'
                              : '全て'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(history.changedAt).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      {history.description && (
                        <p className="text-xs text-gray-600 mb-2">{history.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-bold text-gray-700 mb-1">変更前</div>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                            {JSON.stringify(history.oldValue, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="font-bold text-gray-700 mb-1">変更後</div>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                            {JSON.stringify(history.newValue, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilitySettingsView;

