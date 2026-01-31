/**
 * 人員配置基準設定コンポーネント
 * Staffing Compliance Settings Component
 *
 * 週所定労働時間、管理者、児発管の設定
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Clock, Users, Award, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Staff, FacilityStaffingSettings } from '@/types';
import { useStaffingCompliance } from '@/hooks/useStaffingCompliance';
import { useFacilityData } from '@/hooks/useFacilityData';

interface StaffingComplianceSettingsProps {
  facilityId: string;
}

const StaffingComplianceSettings: React.FC<StaffingComplianceSettingsProps> = ({ facilityId }) => {
  const { staff } = useFacilityData();
  const {
    facilityStaffingSettings,
    fetchFacilityStaffingSettings,
    saveFacilityStaffingSettings,
    loading,
    error,
  } = useStaffingCompliance();

  // ローカル状態
  const [standardWeeklyHours, setStandardWeeklyHours] = useState<number>(40);
  const [managerStaffId, setManagerStaffId] = useState<string>('');
  const [serviceManagerStaffId, setServiceManagerStaffId] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 初期データ読み込み
  useEffect(() => {
    fetchFacilityStaffingSettings();
  }, [fetchFacilityStaffingSettings]);

  // データが読み込まれたらローカル状態に反映
  useEffect(() => {
    if (facilityStaffingSettings) {
      setStandardWeeklyHours(facilityStaffingSettings.standardWeeklyHours || 40);
      setManagerStaffId(facilityStaffingSettings.managerStaffId || '');
      setServiceManagerStaffId(facilityStaffingSettings.serviceManagerStaffId || '');
      setHasChanges(false);
    }
  }, [facilityStaffingSettings]);

  // 変更検知
  const handleChange = useCallback(() => {
    setHasChanges(true);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  // 保存処理
  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    // バリデーション
    if (standardWeeklyHours <= 0 || standardWeeklyHours > 60) {
      setSaveError('週所定労働時間は1〜60時間の範囲で設定してください');
      return;
    }

    // 同一人物チェック
    if (managerStaffId && serviceManagerStaffId && managerStaffId === serviceManagerStaffId) {
      setSaveError('管理者と児発管は異なるスタッフを選択してください（児発管は兼務不可）');
      return;
    }

    try {
      await saveFacilityStaffingSettings({
        standardWeeklyHours,
        managerStaffId: managerStaffId || undefined,
        serviceManagerStaffId: serviceManagerStaffId || undefined,
      });

      setSaveSuccess(true);
      setHasChanges(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('保存に失敗しました');
    }
  };

  // スタッフリストをフィルタ（常勤のみ管理者・児発管候補として表示）
  const fulltimeStaff = staff.filter((s) => s.type === '常勤');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-gray-800 flex items-center">
          <Users size={20} className="mr-2 text-[#00c4cc]" />
          人員配置基準設定
        </h3>
        {hasChanges && (
          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
            未保存の変更があります
          </span>
        )}
      </div>

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">人員配置基準とは</p>
          <p>
            放課後等デイサービス等の障害児通所支援事業では、サービス提供時間中に
            <strong>基準人員2名以上</strong>（うち1名は常勤専従）の配置が必要です。
            ここで設定した週所定労働時間を基準に、常勤換算を計算します。
          </p>
        </div>
      </div>

      {/* 週所定労働時間 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
          <Clock size={16} />
          週所定労働時間（常勤の基準）
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={standardWeeklyHours}
            onChange={(e) => {
              setStandardWeeklyHours(Number(e.target.value));
              handleChange();
            }}
            min={1}
            max={60}
            step={0.5}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-bold"
          />
          <span className="text-gray-600">時間/週</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          一般的には40時間が基準となります。この時間を満たすスタッフを常勤とみなし、
          常勤換算（FTE）の計算に使用します。
        </p>
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600">
            <strong>常勤換算の計算例:</strong>
          </p>
          <ul className="text-xs text-gray-600 mt-1 space-y-1">
            <li>・週40時間勤務のスタッフ → FTE 1.0</li>
            <li>・週20時間勤務のスタッフ → FTE 0.5</li>
            <li>・週32時間勤務のスタッフ → FTE 0.8</li>
          </ul>
        </div>
      </div>

      {/* 管理者設定 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
          <Award size={16} />
          管理者
        </label>
        <select
          value={managerStaffId}
          onChange={(e) => {
            setManagerStaffId(e.target.value);
            handleChange();
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">-- 選択してください --</option>
          {fulltimeStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role || '一般スタッフ'})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">
          管理者は常勤である必要があります。他の業務との兼務が可能です。
        </p>
      </div>

      {/* 児発管設定 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
          <Award size={16} className="text-purple-600" />
          児童発達支援管理責任者（児発管）
        </label>
        <select
          value={serviceManagerStaffId}
          onChange={(e) => {
            setServiceManagerStaffId(e.target.value);
            handleChange();
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">-- 選択してください --</option>
          {fulltimeStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role || '一般スタッフ'})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">
          児発管は<strong>常勤専従</strong>である必要があり、他の業務との兼務は認められません。
        </p>
        {managerStaffId && serviceManagerStaffId && managerStaffId === serviceManagerStaffId && (
          <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={14} />
            管理者と児発管は異なるスタッフを選択してください
          </div>
        )}
      </div>

      {/* エラー・成功メッセージ */}
      {(saveError || error) && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} />
          {saveError || error}
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle size={16} />
          設定を保存しました
        </div>
      )}

      {/* 保存ボタン */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading || !hasChanges}
          className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
            hasChanges
              ? 'bg-teal-600 hover:bg-teal-700 text-white'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Save size={16} />
          {loading ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
};

export default StaffingComplianceSettings;
