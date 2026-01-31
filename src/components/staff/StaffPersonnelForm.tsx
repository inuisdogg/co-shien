/**
 * スタッフ人員設定フォーム
 * Staff Personnel Settings Form
 *
 * 基準人員/加算人員、勤務形態、管理者/児発管の設定
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, AlertTriangle, CheckCircle, User, Clock, Award, Briefcase } from 'lucide-react';
import {
  Staff,
  StaffPersonnelSettings,
  PersonnelType,
  WorkStyle,
  PERSONNEL_TYPE_LABELS,
  WORK_STYLE_LABELS,
  QUALIFICATION_CODES,
} from '@/types';
import { useStaffingCompliance } from '@/hooks/useStaffingCompliance';

interface StaffPersonnelFormProps {
  staff: Staff;
  existingSettings?: StaffPersonnelSettings;
  onSave: () => void;
  onCancel: () => void;
}

const StaffPersonnelForm: React.FC<StaffPersonnelFormProps> = ({
  staff,
  existingSettings,
  onSave,
  onCancel,
}) => {
  const {
    savePersonnelSettings,
    updatePersonnelSettings,
    additionRequirements,
    loading,
    error,
  } = useStaffingCompliance();

  // フォーム状態
  const [personnelType, setPersonnelType] = useState<PersonnelType>(
    existingSettings?.personnelType || 'standard'
  );
  const [workStyle, setWorkStyle] = useState<WorkStyle>(
    existingSettings?.workStyle || 'parttime'
  );
  const [isManager, setIsManager] = useState(existingSettings?.isManager || false);
  const [isServiceManager, setIsServiceManager] = useState(existingSettings?.isServiceManager || false);
  const [managerConcurrentRole, setManagerConcurrentRole] = useState(
    existingSettings?.managerConcurrentRole || ''
  );
  const [contractedWeeklyHours, setContractedWeeklyHours] = useState<number | ''>(
    existingSettings?.contractedWeeklyHours || ''
  );
  const [assignedAdditionCodes, setAssignedAdditionCodes] = useState<string[]>(
    existingSettings?.assignedAdditionCodes || []
  );
  const [notes, setNotes] = useState(existingSettings?.notes || '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 勤務形態に基づいて週労働時間を自動設定
  useEffect(() => {
    if (workStyle === 'fulltime_dedicated' || workStyle === 'fulltime_concurrent') {
      if (contractedWeeklyHours === '' || contractedWeeklyHours < 32) {
        setContractedWeeklyHours(40);
      }
    }
  }, [workStyle, contractedWeeklyHours]);

  // 保存処理
  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(false);

    // バリデーション
    if (isServiceManager && workStyle !== 'fulltime_dedicated') {
      setSaveError('児童発達支援管理責任者は常勤専従である必要があります');
      return;
    }

    if ((workStyle === 'fulltime_dedicated' || workStyle === 'fulltime_concurrent') && !contractedWeeklyHours) {
      setSaveError('常勤の場合は週労働時間を入力してください');
      return;
    }

    try {
      const settings: Partial<StaffPersonnelSettings> = {
        staffId: staff.id,
        personnelType,
        workStyle,
        isManager,
        isServiceManager,
        managerConcurrentRole: isManager ? managerConcurrentRole : undefined,
        contractedWeeklyHours: contractedWeeklyHours || undefined,
        assignedAdditionCodes: personnelType === 'addition' ? assignedAdditionCodes : undefined,
        notes: notes || undefined,
      };

      if (existingSettings?.id) {
        await updatePersonnelSettings(existingSettings.id, settings);
      } else {
        await savePersonnelSettings(settings);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        onSave();
      }, 500);
    } catch (err) {
      setSaveError('保存に失敗しました');
    }
  }, [
    staff.id,
    personnelType,
    workStyle,
    isManager,
    isServiceManager,
    managerConcurrentRole,
    contractedWeeklyHours,
    assignedAdditionCodes,
    notes,
    existingSettings?.id,
    savePersonnelSettings,
    updatePersonnelSettings,
    onSave,
  ]);

  // 加算コードの切り替え
  const toggleAdditionCode = (code: string) => {
    setAssignedAdditionCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // スタッフの資格を表示用に整形
  const qualificationList = staff.qualifications?.split(',').map((q) => q.trim()) || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">人員配置設定</h2>
            <p className="text-sm text-gray-500 mt-1">{staff.name}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* スタッフ情報表示 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <User size={24} className="text-teal-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800">{staff.name}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{staff.type}</span>
                  {staff.role && <span>・{staff.role}</span>}
                </div>
              </div>
            </div>
            {qualificationList.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {qualificationList.map((qual, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                  >
                    {QUALIFICATION_CODES[qual as keyof typeof QUALIFICATION_CODES] || qual}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 人員区分 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <Briefcase size={16} />
              人員区分
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['standard', 'addition'] as PersonnelType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPersonnelType(type)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    personnelType === type
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold">{PERSONNEL_TYPE_LABELS[type]}</div>
                  <div className="text-xs mt-1 text-gray-500">
                    {type === 'standard'
                      ? '基準配置のスタッフ'
                      : '加算算定用のスタッフ'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 勤務形態 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <Clock size={16} />
              勤務形態
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['fulltime_dedicated', 'fulltime_concurrent', 'parttime'] as WorkStyle[]).map(
                (style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setWorkStyle(style)}
                    className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                      workStyle === style
                        ? 'border-teal-500 bg-teal-50 text-teal-700 font-bold'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {WORK_STYLE_LABELS[style]}
                  </button>
                )
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {workStyle === 'fulltime_dedicated' && '専従: 他の業務と兼務しない常勤職員'}
              {workStyle === 'fulltime_concurrent' && '兼務: 他の業務と兼務する常勤職員'}
              {workStyle === 'parttime' && '非常勤: パートタイム、アルバイト等'}
            </p>
          </div>

          {/* 週労働時間（常勤の場合） */}
          {(workStyle === 'fulltime_dedicated' || workStyle === 'fulltime_concurrent') && (
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                週所定労働時間
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={contractedWeeklyHours}
                  onChange={(e) =>
                    setContractedWeeklyHours(e.target.value ? Number(e.target.value) : '')
                  }
                  min={0}
                  max={60}
                  step={0.5}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                <span className="text-sm text-gray-600">時間/週</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                施設の週所定労働時間（通常40時間）を基準に常勤換算を計算します
              </p>
            </div>
          )}

          {/* 非常勤の週労働時間 */}
          {workStyle === 'parttime' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                週労働時間（任意）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={contractedWeeklyHours}
                  onChange={(e) =>
                    setContractedWeeklyHours(e.target.value ? Number(e.target.value) : '')
                  }
                  min={0}
                  max={40}
                  step={0.5}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                <span className="text-sm text-gray-600">時間/週</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                常勤換算（FTE）の計算に使用します
              </p>
            </div>
          )}

          {/* 特別な役割 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <Award size={16} />
              特別な役割
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isManager}
                  onChange={(e) => setIsManager(e.target.checked)}
                  className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                />
                <div>
                  <span className="font-medium text-gray-700">管理者</span>
                  <p className="text-xs text-gray-500">施設の管理者として配置（兼務可能）</p>
                </div>
              </label>

              {isManager && (
                <div className="ml-8">
                  <label className="text-sm text-gray-600 mb-1 block">兼務する役割</label>
                  <input
                    type="text"
                    value={managerConcurrentRole}
                    onChange={(e) => setManagerConcurrentRole(e.target.value)}
                    placeholder="例: 児童指導員"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isServiceManager}
                  onChange={(e) => {
                    setIsServiceManager(e.target.checked);
                    // 児発管は常勤専従必須
                    if (e.target.checked) {
                      setWorkStyle('fulltime_dedicated');
                    }
                  }}
                  className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                />
                <div>
                  <span className="font-medium text-gray-700">児童発達支援管理責任者</span>
                  <p className="text-xs text-gray-500">児発管として配置（常勤専従必須、兼務不可）</p>
                </div>
              </label>
            </div>
          </div>

          {/* 加算配置（加算人員の場合） */}
          {personnelType === 'addition' && additionRequirements.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                配置先加算
              </label>
              <div className="space-y-2">
                {additionRequirements.map((req) => (
                  <label
                    key={req.additionCode}
                    className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={assignedAdditionCodes.includes(req.additionCode)}
                      onChange={() => toggleAdditionCode(req.additionCode)}
                      className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-gray-700 text-sm">
                        {req.additionCode}
                      </span>
                      {req.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{req.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* メモ */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">メモ（任意）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="人員配置に関するメモ..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>

          {/* エラー・成功メッセージ */}
          {(saveError || error) && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle size={16} />
              {saveError || error}
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle size={16} />
              保存しました
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffPersonnelForm;
