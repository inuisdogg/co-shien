/**
 * StaffLeaveSettingsPanel - スタッフ別休暇設定パネル
 * スタッフごとに有給休暇や代休の設定を管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  Users,
  Calendar,
  RefreshCcw,
} from 'lucide-react';
import { StaffLeaveSettings, Staff } from '@/types';
import { supabase } from '@/lib/supabase';

interface StaffLeaveSettingsPanelProps {
  facilityId: string;
}

type StaffWithLeaveSettings = Staff & {
  leaveSettings?: StaffLeaveSettings;
};

export default function StaffLeaveSettingsPanel({ facilityId }: StaffLeaveSettingsPanelProps) {
  const [staffList, setStaffList] = useState<StaffWithLeaveSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState<Map<string, Partial<StaffLeaveSettings>>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // データ取得
  useEffect(() => {
    fetchData();
  }, [facilityId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // スタッフ一覧取得
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('facility_id', facilityId)
        .order('name');

      if (staffError) throw staffError;

      // 休暇設定取得
      const { data: settingsData, error: settingsError } = await supabase
        .from('staff_leave_settings')
        .select('*')
        .eq('facility_id', facilityId);

      if (settingsError) throw settingsError;

      // マージ
      const settingsMap = new Map<string, StaffLeaveSettings>();
      (settingsData || []).forEach((row) => {
        settingsMap.set(row.user_id, {
          id: row.id,
          facilityId: row.facility_id,
          userId: row.user_id,
          paidLeaveEnabled: row.paid_leave_enabled || false,
          paidLeaveDays: parseFloat(row.paid_leave_days) || 0,
          substituteLeaveEnabled: row.substitute_leave_enabled || false,
          substituteLeaveDays: parseFloat(row.substitute_leave_days) || 0,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      });

      const staffWithSettings: StaffWithLeaveSettings[] = (staffData || []).map((staff) => ({
        ...staff,
        leaveSettings: staff.user_id ? settingsMap.get(staff.user_id) : undefined,
      }));

      setStaffList(staffWithSettings);
      setEditedSettings(new Map());
      setHasChanges(false);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 設定変更
  const handleSettingChange = (
    userId: string,
    field: keyof StaffLeaveSettings,
    value: boolean | number | string
  ) => {
    const current = editedSettings.get(userId) || {};
    const newSettings = new Map(editedSettings);
    newSettings.set(userId, { ...current, [field]: value });
    setEditedSettings(newSettings);
    setHasChanges(true);
  };

  // 保存
  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [userId, settings] of editedSettings) {
        const staff = staffList.find((s) => s.user_id === userId);
        if (!staff) continue;

        const existingSettings = staff.leaveSettings;

        if (existingSettings?.id) {
          // 更新
          const { error } = await supabase
            .from('staff_leave_settings')
            .update({
              paid_leave_enabled: settings.paidLeaveEnabled ?? existingSettings.paidLeaveEnabled,
              paid_leave_days: settings.paidLeaveDays ?? existingSettings.paidLeaveDays,
              substitute_leave_enabled: settings.substituteLeaveEnabled ?? existingSettings.substituteLeaveEnabled,
              substitute_leave_days: settings.substituteLeaveDays ?? existingSettings.substituteLeaveDays,
              notes: settings.notes ?? existingSettings.notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSettings.id);

          if (error) throw error;
        } else {
          // 新規作成
          const { error } = await supabase.from('staff_leave_settings').insert({
            facility_id: facilityId,
            user_id: userId,
            paid_leave_enabled: settings.paidLeaveEnabled ?? false,
            paid_leave_days: settings.paidLeaveDays ?? 0,
            substitute_leave_enabled: settings.substituteLeaveEnabled ?? false,
            substitute_leave_days: settings.substituteLeaveDays ?? 0,
            notes: settings.notes,
          });

          if (error) throw error;
        }
      }

      fetchData();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 現在の値を取得（編集中の値があればそれを、なければ既存の値を返す）
  const getValue = (
    staff: StaffWithLeaveSettings,
    field: keyof StaffLeaveSettings
  ) => {
    const edited = staff.user_id ? editedSettings.get(staff.user_id) : undefined;
    if (edited && field in edited) {
      return edited[field];
    }
    return staff.leaveSettings?.[field];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">スタッフ別休暇設定</h3>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-orange-600">未保存の変更があります</span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#00c4cc] text-white text-sm font-bold rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 説明 */}
      <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
        スタッフごとに利用可能な休暇の種類と残日数を設定できます。
        有給休暇が未付与のスタッフは「欠勤」のみ申請可能になります。
      </div>

      {/* スタッフ一覧 */}
      {staffList.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>スタッフがいません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffList.map((staff) => {
            if (!staff.user_id) {
              return (
                <div
                  key={staff.id}
                  className="bg-gray-50 rounded-lg p-4 opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{staff.name}</p>
                      <p className="text-xs text-gray-500">アカウント未連携</p>
                    </div>
                  </div>
                </div>
              );
            }

            const paidLeaveEnabled = getValue(staff, 'paidLeaveEnabled') as boolean ?? false;
            const paidLeaveDays = getValue(staff, 'paidLeaveDays') as number ?? 0;
            const substituteLeaveEnabled = getValue(staff, 'substituteLeaveEnabled') as boolean ?? false;
            const substituteLeaveDays = getValue(staff, 'substituteLeaveDays') as number ?? 0;

            return (
              <div
                key={staff.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                {/* スタッフ情報 */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#00c4cc]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#00c4cc]" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{staff.name}</p>
                    <p className="text-xs text-gray-500">{staff.type} / {staff.role}</p>
                  </div>
                </div>

                {/* 休暇設定 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 有給休暇 */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-gray-700">有給休暇</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paidLeaveEnabled}
                          onChange={(e) =>
                            handleSettingChange(staff.user_id!, 'paidLeaveEnabled', e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#00c4cc] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00c4cc]"></div>
                      </label>
                    </div>
                    {paidLeaveEnabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">残日数:</label>
                        <input
                          type="number"
                          value={paidLeaveDays}
                          onChange={(e) =>
                            handleSettingChange(
                              staff.user_id!,
                              'paidLeaveDays',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          min={0}
                          max={99}
                          step={0.5}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">日</span>
                      </div>
                    )}
                  </div>

                  {/* 代休 */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <RefreshCcw className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-gray-700">代休</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={substituteLeaveEnabled}
                          onChange={(e) =>
                            handleSettingChange(staff.user_id!, 'substituteLeaveEnabled', e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#00c4cc] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00c4cc]"></div>
                      </label>
                    </div>
                    {substituteLeaveEnabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">残日数:</label>
                        <input
                          type="number"
                          value={substituteLeaveDays}
                          onChange={(e) =>
                            handleSettingChange(
                              staff.user_id!,
                              'substituteLeaveDays',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          min={0}
                          max={99}
                          step={0.5}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">日</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 未付与の場合の注記 */}
                {!paidLeaveEnabled && !substituteLeaveEnabled && (
                  <p className="mt-2 text-xs text-gray-500">
                    ※ 休暇が未設定のため、休暇申請時は「欠勤」のみ選択可能です
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
