/**
 * スタッフ人員設定一覧
 * Staff Personnel List
 *
 * 全スタッフの人員配置設定を一覧表示・編集
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  User,
  Clock,
  Briefcase,
  Award,
  AlertTriangle,
  CheckCircle,
  Edit,
  Plus,
  Search,
  Filter,
} from 'lucide-react';
import {
  Staff,
  StaffPersonnelSettings,
  AdditionStaffRequirement,
  PERSONNEL_TYPE_LABELS,
  WORK_STYLE_LABELS,
  QUALIFICATION_CODES,
} from '@/types';
import StaffPersonnelForm from '@/components/staff/StaffPersonnelForm';

interface StaffPersonnelListProps {
  staff: Staff[];
  personnelSettings: StaffPersonnelSettings[];
  additionRequirements: AdditionStaffRequirement[];
  onRefresh: () => void;
}

const StaffPersonnelList: React.FC<StaffPersonnelListProps> = ({
  staff,
  personnelSettings,
  additionRequirements,
  onRefresh,
}) => {
  // 検索・フィルタ状態
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'standard' | 'addition' | 'unset'>('all');

  // 編集状態
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showForm, setShowForm] = useState(false);

  // スタッフに紐づく人員設定を取得
  const getPersonnelSetting = (staffId: string) => {
    return personnelSettings.find((p) => p.staffId === staffId);
  };

  // フィルタ済みスタッフリスト
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      // 検索フィルタ
      if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // タイプフィルタ
      const setting = getPersonnelSetting(s.id);
      if (filterType === 'unset' && setting) return false;
      if (filterType === 'standard' && setting?.personnelType !== 'standard') return false;
      if (filterType === 'addition' && setting?.personnelType !== 'addition') return false;

      return true;
    });
  }, [staff, personnelSettings, searchTerm, filterType]);

  // 常勤換算計算
  const calculateFTE = (setting: StaffPersonnelSettings | undefined) => {
    if (!setting?.contractedWeeklyHours) return '-';
    const fte = setting.contractedWeeklyHours / 40; // TODO: 施設設定から取得
    return fte.toFixed(2);
  };

  // 編集フォームを開く
  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setShowForm(true);
  };

  // フォームを閉じる
  const handleCloseForm = () => {
    setEditingStaff(null);
    setShowForm(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* 検索・フィルタバー */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="スタッフ名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'all', label: '全て' },
            { id: 'standard', label: '基準人員' },
            { id: 'addition', label: '加算人員' },
            { id: 'unset', label: '未設定' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterType(filter.id as typeof filterType)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterType === filter.id
                  ? 'bg-teal-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* スタッフ一覧テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="px-4 py-3 text-left font-medium">スタッフ</th>
                <th className="px-4 py-3 text-center font-medium">人員区分</th>
                <th className="px-4 py-3 text-center font-medium">勤務形態</th>
                <th className="px-4 py-3 text-center font-medium">週時間</th>
                <th className="px-4 py-3 text-center font-medium">FTE</th>
                <th className="px-4 py-3 text-center font-medium">役割</th>
                <th className="px-4 py-3 text-center font-medium">資格</th>
                <th className="px-4 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staffMember, idx) => {
                const setting = getPersonnelSetting(staffMember.id);
                const qualifications = staffMember.qualifications?.split(',').map((q) => q.trim()) || [];

                return (
                  <tr
                    key={staffMember.id}
                    className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    {/* スタッフ名 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center">
                          <User size={18} className="text-teal-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{staffMember.name}</div>
                          <div className="text-xs text-gray-500">{staffMember.type}</div>
                        </div>
                      </div>
                    </td>

                    {/* 人員区分 */}
                    <td className="px-4 py-3 text-center">
                      {setting ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            setting.personnelType === 'standard'
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {PERSONNEL_TYPE_LABELS[setting.personnelType]}
                        </span>
                      ) : (
                        <span className="text-gray-400">未設定</span>
                      )}
                    </td>

                    {/* 勤務形態 */}
                    <td className="px-4 py-3 text-center text-gray-600">
                      {setting ? (
                        <span className="text-sm">{WORK_STYLE_LABELS[setting.workStyle]}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* 週時間 */}
                    <td className="px-4 py-3 text-center font-mono text-gray-700">
                      {setting?.contractedWeeklyHours ? `${setting.contractedWeeklyHours}h` : '-'}
                    </td>

                    {/* FTE */}
                    <td className="px-4 py-3 text-center font-mono font-medium text-gray-800">
                      {calculateFTE(setting)}
                    </td>

                    {/* 役割 */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {setting?.isServiceManager && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            児発管
                          </span>
                        )}
                        {setting?.isManager && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            管理者
                          </span>
                        )}
                        {!setting?.isServiceManager && !setting?.isManager && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* 資格 */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-1 max-w-[150px]">
                        {qualifications.slice(0, 2).map((qual, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {QUALIFICATION_CODES[qual as keyof typeof QUALIFICATION_CODES] || qual}
                          </span>
                        ))}
                        {qualifications.length > 2 && (
                          <span className="text-xs text-gray-400">+{qualifications.length - 2}</span>
                        )}
                        {qualifications.length === 0 && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEdit(staffMember)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        {setting ? <Edit size={14} /> : <Plus size={14} />}
                        {setting ? '編集' : '設定'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    {searchTerm || filterType !== 'all'
                      ? '該当するスタッフが見つかりません'
                      : 'スタッフが登録されていません'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 凡例 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-4">
            <span className="font-medium">人員区分:</span>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded">基準人員</span>
            <span className="text-gray-500">= 基準配置の職員</span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">加算人員</span>
            <span className="text-gray-500">= 加算算定用の職員</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-medium">FTE (常勤換算):</span>
            <span className="text-gray-500">週労働時間 ÷ 所定労働時間（40時間）</span>
          </div>
        </div>
      </div>

      {/* 編集フォームモーダル */}
      {showForm && editingStaff && (
        <StaffPersonnelForm
          staff={editingStaff}
          existingSettings={getPersonnelSetting(editingStaff.id)}
          onSave={handleCloseForm}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
};

export default StaffPersonnelList;
