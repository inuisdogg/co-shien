/**
 * 人員配置設定パネル
 * スタッフの人員区分・勤務形態・役割設定
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  Save,
  Shield,
  Clock,
  Award,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Staff, StaffPersonnelSettings } from '@/types';

interface StaffWithSettings extends Staff {
  personnelSettings?: StaffPersonnelSettings;
}

interface PersonnelSettingsPanelProps {
  staff: StaffWithSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Partial<StaffPersonnelSettings>) => Promise<boolean>;
  loading?: boolean;
}

const PersonnelSettingsPanel: React.FC<PersonnelSettingsPanelProps> = ({
  staff,
  isOpen,
  onClose,
  onSave,
  loading = false,
}) => {
  const ps = staff.personnelSettings;

  // 設定状態
  const [settings, setSettings] = useState({
    personnelType: ps?.personnelType || ('standard' as 'standard' | 'addition'),
    workStyle: ps?.workStyle || ('fulltime_dedicated' as 'fulltime_dedicated' | 'fulltime_concurrent' | 'parttime'),
    isManager: ps?.isManager ?? false,
    isServiceManager: ps?.isServiceManager ?? false,
    managerConcurrentRole: ps?.managerConcurrentRole || '',
    contractedWeeklyHours: ps?.contractedWeeklyHours?.toString() || '40',
    notes: ps?.notes || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 設定変更
  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ) => {
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  // FTE計算
  const fteValue = settings.contractedWeeklyHours
    ? (Number(settings.contractedWeeklyHours) / 40).toFixed(2)
    : '0.00';

  // 保存
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await onSave({
        personnelType: settings.personnelType,
        workStyle: settings.workStyle,
        isManager: settings.isManager,
        isServiceManager: settings.isServiceManager,
        managerConcurrentRole: settings.managerConcurrentRole || undefined,
        contractedWeeklyHours: settings.contractedWeeklyHours
          ? Number(settings.contractedWeeklyHours)
          : undefined,
        notes: settings.notes || undefined,
      });
      if (success) {
        setHasChanges(false);
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* パネル */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {staff.name?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">人員配置設定</h2>
              <p className="text-sm text-gray-500">{staff.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 人員区分 */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Shield size={16} />
              人員区分
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateSetting('personnelType', 'standard')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  settings.personnelType === 'standard'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {settings.personnelType === 'standard' && (
                    <CheckCircle size={16} className="text-teal-600" />
                  )}
                  <span className="font-medium text-gray-800">基準人員</span>
                </div>
                <p className="text-xs text-gray-500">
                  配置基準を満たすための必須人員
                </p>
              </button>

              <button
                onClick={() => updateSetting('personnelType', 'addition')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  settings.personnelType === 'addition'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {settings.personnelType === 'addition' && (
                    <CheckCircle size={16} className="text-orange-600" />
                  )}
                  <span className="font-medium text-gray-800">加算人員</span>
                </div>
                <p className="text-xs text-gray-500">
                  加算取得のための追加配置人員
                </p>
              </button>
            </div>
          </section>

          {/* 勤務形態 */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Clock size={16} />
              勤務形態
            </h3>
            <div className="space-y-2">
              {[
                { value: 'fulltime_dedicated', label: '常勤専従', desc: '週40時間以上・他業務との兼務なし' },
                { value: 'fulltime_concurrent', label: '常勤兼務', desc: '週40時間以上・他業務との兼務あり' },
                { value: 'parttime', label: '非常勤', desc: '週40時間未満' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    updateSetting('workStyle', option.value as typeof settings.workStyle)
                  }
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    settings.workStyle === option.value
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-800">{option.label}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                    </div>
                    {settings.workStyle === option.value && (
                      <CheckCircle size={20} className="text-teal-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 週間契約時間 */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3">契約時間（週）</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.contractedWeeklyHours}
                    onChange={(e) => updateSetting('contractedWeeklyHours', e.target.value)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
                    min="0"
                    max="60"
                  />
                  <span className="text-gray-600">時間/週</span>
                </div>
              </div>
              <div className="px-4 py-2 bg-teal-50 rounded-lg">
                <span className="text-sm text-gray-500">FTE: </span>
                <span className="text-lg font-bold text-teal-700">{fteValue}</span>
              </div>
            </div>
          </section>

          {/* 役割 */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Award size={16} />
              役割設定
            </h3>
            <div className="space-y-4">
              {/* 管理者 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-800">管理者</div>
                  <p className="text-xs text-gray-500">事業所の管理者として配置</p>
                </div>
                <button
                  onClick={() => updateSetting('isManager', !settings.isManager)}
                  className="flex items-center gap-2"
                >
                  {settings.isManager ? (
                    <ToggleRight size={32} className="text-teal-600" />
                  ) : (
                    <ToggleLeft size={32} className="text-gray-400" />
                  )}
                </button>
              </div>

              {/* 児発管 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-800">
                    児童発達支援管理責任者
                  </div>
                  <p className="text-xs text-gray-500">常勤専従が原則</p>
                </div>
                <button
                  onClick={() => updateSetting('isServiceManager', !settings.isServiceManager)}
                  className="flex items-center gap-2"
                >
                  {settings.isServiceManager ? (
                    <ToggleRight size={32} className="text-purple-600" />
                  ) : (
                    <ToggleLeft size={32} className="text-gray-400" />
                  )}
                </button>
              </div>

              {/* 管理者兼務の場合 */}
              {settings.isManager && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    管理者兼務時の直接支援業務
                  </label>
                  <select
                    value={settings.managerConcurrentRole}
                    onChange={(e) => updateSetting('managerConcurrentRole', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">兼務なし</option>
                    <option value="jidou_hattatsu_shien">児童発達支援員</option>
                    <option value="hoiku_shi">保育士</option>
                    <option value="jido_shido_in">児童指導員</option>
                  </select>
                  <p className="mt-2 text-xs text-blue-600">
                    管理者が直接支援業務を兼務する場合に選択してください
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* メモ */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-3">備考</h3>
            <textarea
              value={settings.notes}
              onChange={(e) => updateSetting('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="メモを入力..."
            />
          </section>
        </div>

        {/* フッター */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {hasChanges && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <AlertCircle size={14} />
                未保存の変更があります
              </span>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || loading}
                className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PersonnelSettingsPanel;
