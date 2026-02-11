/**
 * 施設別設定エディタ
 * 施設固有の児童情報（利用パターン、送迎、担当職員等）を編集
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Truck, Users, FileText } from 'lucide-react';
import { FacilityChildrenSettings, Staff } from '@/types';
import { supabase } from '@/lib/supabase';

type SlotInfo = {
  AM: string;
  PM: string | null;
};

type Props = {
  childId: string;
  childName: string;
  facilityId: string;
  slotInfo?: SlotInfo;
  onSave: () => void;
  onClose: () => void;
};

const DAYS_OF_WEEK = [
  { id: 0, label: '日', shortLabel: '日' },
  { id: 1, label: '月', shortLabel: '月' },
  { id: 2, label: '火', shortLabel: '火' },
  { id: 3, label: '水', shortLabel: '水' },
  { id: 4, label: '木', shortLabel: '木' },
  { id: 5, label: '金', shortLabel: '金' },
  { id: 6, label: '土', shortLabel: '土' },
];

type TimeSlot = 'AM' | 'PM' | 'AMPM';

export const FacilitySettingsEditor: React.FC<Props> = ({
  childId,
  childName,
  facilityId,
  slotInfo = { AM: '午前', PM: '午後' },
  onSave,
  onClose,
}) => {
  const [settings, setSettings] = useState<Partial<FacilityChildrenSettings>>({
    patternDays: [],
    patternTimeSlots: {},
    needsPickup: false,
    needsDropoff: false,
    pickupLocation: '',
    dropoffLocation: '',
    contractDays: undefined,
    contractStartDate: '',
    contractEndDate: '',
    assignedStaffIds: [],
    defaultAddonItems: [],
  });
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 既存の設定と職員一覧を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 既存の設定を取得
        const { data: existingSettings } = await supabase
          .from('facility_children_settings')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('child_id', childId)
          .single();

        if (existingSettings) {
          setSettings({
            id: existingSettings.id,
            facilityId: existingSettings.facility_id,
            childId: existingSettings.child_id,
            patternDays: existingSettings.pattern_days || [],
            patternTimeSlots: existingSettings.pattern_time_slots || {},
            needsPickup: existingSettings.needs_pickup || false,
            needsDropoff: existingSettings.needs_dropoff || false,
            pickupLocation: existingSettings.pickup_location || '',
            dropoffLocation: existingSettings.dropoff_location || '',
            contractDays: existingSettings.contract_days,
            contractStartDate: existingSettings.contract_start_date || '',
            contractEndDate: existingSettings.contract_end_date || '',
            assignedStaffIds: existingSettings.assigned_staff_ids || [],
            defaultAddonItems: existingSettings.default_addon_items || [],
          });
        }

        // 職員一覧を取得
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, name')
          .eq('facility_id', facilityId)
          .order('name');

        if (staffData) {
          setStaffList(staffData as unknown as Staff[]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId, childId]);

  // 曜日選択のトグル
  const toggleDay = (dayId: number) => {
    const currentDays = settings.patternDays || [];
    if (currentDays.includes(dayId)) {
      // 曜日を削除する場合、patternTimeSlotsからも削除
      const newTimeSlots = { ...settings.patternTimeSlots };
      delete newTimeSlots[dayId];
      setSettings({
        ...settings,
        patternDays: currentDays.filter((d) => d !== dayId),
        patternTimeSlots: newTimeSlots,
      });
    } else {
      setSettings({
        ...settings,
        patternDays: [...currentDays, dayId].sort(),
        patternTimeSlots: {
          ...settings.patternTimeSlots,
          [dayId]: 'AMPM',
        },
      });
    }
  };

  // 時間帯の変更
  const setTimeSlot = (dayId: number, slot: TimeSlot) => {
    setSettings({
      ...settings,
      patternTimeSlots: {
        ...settings.patternTimeSlots,
        [dayId]: slot,
      },
    });
  };

  // 担当職員のトグル
  const toggleStaff = (staffId: string) => {
    const currentStaff = settings.assignedStaffIds || [];
    if (currentStaff.includes(staffId)) {
      setSettings({
        ...settings,
        assignedStaffIds: currentStaff.filter((s) => s !== staffId),
      });
    } else {
      setSettings({
        ...settings,
        assignedStaffIds: [...currentStaff, staffId],
      });
    }
  };

  // 保存
  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data = {
        facility_id: facilityId,
        child_id: childId,
        pattern_days: settings.patternDays || [],
        pattern_time_slots: settings.patternTimeSlots || {},
        needs_pickup: settings.needsPickup || false,
        needs_dropoff: settings.needsDropoff || false,
        pickup_location: settings.pickupLocation || null,
        dropoff_location: settings.dropoffLocation || null,
        contract_days: settings.contractDays || null,
        contract_start_date: settings.contractStartDate || null,
        contract_end_date: settings.contractEndDate || null,
        assigned_staff_ids: settings.assignedStaffIds || [],
        default_addon_items: settings.defaultAddonItems || [],
        updated_at: now,
      };

      if (settings.id) {
        // 更新
        await supabase
          .from('facility_children_settings')
          .update(data)
          .eq('id', settings.id);
      } else {
        // 新規作成
        await supabase.from('facility_children_settings').insert({
          ...data,
          id: `fcs-${Date.now()}`,
          created_at: now,
        });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc] mx-auto"></div>
          <p className="text-gray-600 mt-4">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">施設別設定</h2>
            <p className="text-sm text-gray-500">{childName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 利用パターン */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Calendar size={18} className="text-[#00c4cc]" />
              <h3 className="font-bold text-sm text-gray-700">利用パターン</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = settings.patternDays?.includes(day.id);
                const timeSlot = settings.patternTimeSlots?.[day.id];
                return (
                  <div key={day.id} className="flex flex-col items-center">
                    <button
                      onClick={() => toggleDay(day.id)}
                      className={`w-12 h-12 rounded-lg border-2 font-bold transition-colors ${
                        isSelected
                          ? 'border-[#00c4cc] bg-[#00c4cc] text-white'
                          : 'border-gray-300 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {day.shortLabel}
                    </button>
                    {isSelected && (
                      <select
                        value={timeSlot || 'AMPM'}
                        onChange={(e) => setTimeSlot(day.id, e.target.value as TimeSlot)}
                        className="mt-1 text-xs border border-gray-300 rounded px-1 py-0.5"
                      >
                        <option value="AMPM">終日</option>
                        <option value="AM">{slotInfo.AM}</option>
                        {slotInfo.PM && <option value="PM">{slotInfo.PM}</option>}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 送迎設定 */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Truck size={18} className="text-[#00c4cc]" />
              <h3 className="font-bold text-sm text-gray-700">送迎設定</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    checked={settings.needsPickup || false}
                    onChange={(e) => setSettings({ ...settings, needsPickup: e.target.checked })}
                    className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                  />
                  <span className="text-sm text-gray-700">お迎えあり</span>
                </label>
                {settings.needsPickup && (
                  <input
                    type="text"
                    value={settings.pickupLocation || ''}
                    onChange={(e) => setSettings({ ...settings, pickupLocation: e.target.value })}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
                    placeholder="お迎え場所"
                  />
                )}
              </div>
              <div>
                <label className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    checked={settings.needsDropoff || false}
                    onChange={(e) => setSettings({ ...settings, needsDropoff: e.target.checked })}
                    className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                  />
                  <span className="text-sm text-gray-700">お送りあり</span>
                </label>
                {settings.needsDropoff && (
                  <input
                    type="text"
                    value={settings.dropoffLocation || ''}
                    onChange={(e) => setSettings({ ...settings, dropoffLocation: e.target.value })}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
                    placeholder="お送り場所"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 契約情報 */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <FileText size={18} className="text-[#00c4cc]" />
              <h3 className="font-bold text-sm text-gray-700">契約情報</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">契約日数（月）</label>
                <input
                  type="number"
                  value={settings.contractDays || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      contractDays: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
                  placeholder="10"
                  min="0"
                  max="31"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">契約開始日</label>
                <input
                  type="date"
                  value={settings.contractStartDate || ''}
                  onChange={(e) => setSettings({ ...settings, contractStartDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">契約終了日</label>
                <input
                  type="date"
                  value={settings.contractEndDate || ''}
                  onChange={(e) => setSettings({ ...settings, contractEndDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
            </div>
          </div>

          {/* 担当職員 */}
          {staffList.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Users size={18} className="text-[#00c4cc]" />
                <h3 className="font-bold text-sm text-gray-700">担当職員</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {staffList.map((staff) => {
                  const isSelected = settings.assignedStaffIds?.includes(staff.id);
                  return (
                    <button
                      key={staff.id}
                      onClick={() => toggleStaff(staff.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-[#00c4cc] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {staff.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            <span>{saving ? '保存中...' : '保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacilitySettingsEditor;
