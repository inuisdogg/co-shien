/**
 * 管理者・児発管選択モーダル
 * Manager Picker Modal
 *
 * 管理者または児童発達支援管理責任者を選択するモーダル
 */

'use client';

import React, { useState, useMemo } from 'react';
import { X, User, Search, CheckCircle, AlertTriangle, Award, Clock } from 'lucide-react';
import {
  Staff,
  StaffPersonnelSettings,
  WORK_STYLE_LABELS,
  QUALIFICATION_CODES,
} from '@/types';

interface ManagerPickerModalProps {
  type: 'manager' | 'serviceManager';
  staff: Staff[];
  personnelSettings: StaffPersonnelSettings[];
  onSelect: (staffId: string) => void;
  onClose: () => void;
}

const ManagerPickerModal: React.FC<ManagerPickerModalProps> = ({
  type,
  staff,
  personnelSettings,
  onSelect,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 現在の管理者/児発管を取得
  const currentSetting = personnelSettings.find((p) =>
    type === 'manager' ? p.isManager : p.isServiceManager
  );

  // スタッフの人員設定を取得
  const getPersonnelSetting = (staffId: string) => {
    return personnelSettings.find((p) => p.staffId === staffId);
  };

  // 候補スタッフをフィルタリング
  const eligibleStaff = useMemo(() => {
    return staff.filter((s) => {
      // 検索フィルタ
      if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // 児発管の場合は常勤専従のスタッフのみ
      if (type === 'serviceManager') {
        const setting = getPersonnelSetting(s.id);
        // 人員設定がない場合も候補に含める（後で設定できるようにするため）
        if (setting && setting.workStyle !== 'fulltime_dedicated') {
          return false;
        }
      }

      return true;
    });
  }, [staff, personnelSettings, searchTerm, type]);

  // 選択を確定
  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  // 児発管の場合の適格性チェック
  const isEligibleForServiceManager = (staffMember: Staff) => {
    const setting = getPersonnelSetting(staffMember.id);

    // 人員設定がない場合は警告付きで可
    if (!setting) {
      return { eligible: true, warning: '人員配置設定が必要です' };
    }

    // 常勤専従でない場合は不可
    if (setting.workStyle !== 'fulltime_dedicated') {
      return { eligible: false, warning: '常勤専従である必要があります' };
    }

    // 既に加算人員として配置されている場合は不可
    if (setting.personnelType === 'addition') {
      return { eligible: false, warning: '加算人員と兼務できません' };
    }

    return { eligible: true, warning: null };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {type === 'manager' ? '管理者を選択' : '児童発達支援管理責任者を選択'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {type === 'manager'
                ? '施設の管理者として配置するスタッフを選択してください'
                : '児発管として配置するスタッフを選択してください（常勤専従必須）'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 検索 */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="スタッフ名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* スタッフリスト */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {eligibleStaff.map((staffMember) => {
              const setting = getPersonnelSetting(staffMember.id);
              const isCurrentSelected = currentSetting?.staffId === staffMember.id;
              const isSelected = selectedId === staffMember.id;
              const qualifications =
                staffMember.qualifications?.split(',').map((q) => q.trim()) || [];

              // 児発管の場合の適格性チェック
              const eligibility =
                type === 'serviceManager'
                  ? isEligibleForServiceManager(staffMember)
                  : { eligible: true, warning: null };

              return (
                <button
                  key={staffMember.id}
                  onClick={() => eligibility.eligible && setSelectedId(staffMember.id)}
                  disabled={!eligibility.eligible}
                  className={`
                    w-full p-4 rounded-lg border-2 text-left transition-all
                    ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50'
                        : eligibility.eligible
                        ? 'border-gray-200 hover:border-gray-300 bg-white'
                        : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* アバター */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-teal-100' : 'bg-gray-100'
                      }`}
                    >
                      <User size={20} className={isSelected ? 'text-teal-600' : 'text-gray-500'} />
                    </div>

                    {/* 情報 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{staffMember.name}</span>
                        {isCurrentSelected && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
                            現在選択中
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {setting && (
                          <span className="text-xs text-gray-500">
                            {WORK_STYLE_LABELS[setting.workStyle]}
                          </span>
                        )}
                        {qualifications.length > 0 && (
                          <div className="flex items-center gap-1">
                            {qualifications.slice(0, 2).map((qual, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
                              >
                                {QUALIFICATION_CODES[qual as keyof typeof QUALIFICATION_CODES] ||
                                  qual}
                              </span>
                            ))}
                            {qualifications.length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{qualifications.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 選択状態 */}
                    {isSelected && <CheckCircle size={20} className="text-teal-600" />}
                  </div>

                  {/* 警告 */}
                  {eligibility.warning && (
                    <div
                      className={`flex items-center gap-1 mt-2 text-xs ${
                        eligibility.eligible ? 'text-yellow-600' : 'text-red-600'
                      }`}
                    >
                      <AlertTriangle size={12} />
                      {eligibility.warning}
                    </div>
                  )}
                </button>
              );
            })}

            {eligibleStaff.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm
                  ? '該当するスタッフが見つかりません'
                  : type === 'serviceManager'
                  ? '常勤専従のスタッフがいません'
                  : 'スタッフが登録されていません'}
              </div>
            )}
          </div>
        </div>

        {/* 児発管の注意事項 */}
        {type === 'serviceManager' && (
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
            <div className="flex items-start gap-2 text-xs text-blue-700">
              <Award size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <strong>児発管の要件:</strong>
                <ul className="mt-1 space-y-0.5">
                  <li>・常勤かつ専従で配置する必要があります</li>
                  <li>・管理者との兼務は可能です（管理者業務に支障がない場合）</li>
                  <li>・加算人員との兼務はできません</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            選択を確定
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerPickerModal;
