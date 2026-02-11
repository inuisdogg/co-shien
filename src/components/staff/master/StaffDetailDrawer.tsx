/**
 * スタッフ詳細ドロワー
 * スタッフの詳細情報をスライドパネルで表示
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  Edit2,
  Trash2,
  User,
  Phone,
  Mail,
  Award,
  Clock,
  Shield,
  Calendar,
  Briefcase,
  FileText,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  DollarSign,
} from 'lucide-react';
import { Staff, StaffPersonnelSettings, StaffLeaveSettings, QUALIFICATION_CODES } from '@/types';

interface StaffWithRelations extends Staff {
  personnelSettings?: StaffPersonnelSettings;
  leaveSettings?: StaffLeaveSettings;
}

interface StaffDetailDrawerProps {
  staff: StaffWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (staff: StaffWithRelations) => void;
  onDelete: (staff: StaffWithRelations) => void;
  onEditLeave?: (staff: StaffWithRelations) => void;
  onEditPersonnel?: (staff: StaffWithRelations) => void;
}

const StaffDetailDrawer: React.FC<StaffDetailDrawerProps> = ({
  staff,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onEditLeave,
  onEditPersonnel,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'personnel' | 'leave'>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !staff) return null;

  // 資格ラベル取得（personnelSettingsから）
  const getQualificationLabels = (): string[] => {
    return (staff.personnelSettings?.qualifications || []).map(
      (q: string) => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q
    );
  };

  // 勤務形態ラベル
  const getWorkStyleLabel = () => {
    if (!staff.personnelSettings?.workStyle) return '未設定';
    const labels: Record<string, string> = {
      fulltime_dedicated: '常勤専従',
      fulltime_concurrent: '常勤兼務',
      parttime: '非常勤',
    };
    return labels[staff.personnelSettings.workStyle] || staff.personnelSettings.workStyle;
  };

  // 人員区分ラベル
  const getPersonnelTypeLabel = () => {
    if (!staff.personnelSettings?.personnelType) return '未設定';
    return staff.personnelSettings.personnelType === 'standard' ? '基準人員' : '加算人員';
  };

  // FTE計算
  const getFte = () => {
    if (!staff.personnelSettings?.contractedWeeklyHours) return null;
    return (staff.personnelSettings.contractedWeeklyHours / 40).toFixed(2);
  };

  // タブコンテンツ
  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return renderInfoTab();
      case 'personnel':
        return renderPersonnelTab();
      case 'leave':
        return renderLeaveTab();
      default:
        return null;
    }
  };

  // 基本情報タブ
  const renderInfoTab = () => (
    <div className="space-y-6">
      {/* 連絡先 */}
      <section>
        <h4 className="text-sm font-medium text-gray-500 mb-3">連絡先</h4>
        <div className="space-y-3">
          {staff.phone && (
            <div className="flex items-center gap-3 text-gray-700">
              <Phone size={18} className="text-gray-400" />
              <span>{staff.phone}</span>
            </div>
          )}
          {staff.email && (
            <div className="flex items-center gap-3 text-gray-700">
              <Mail size={18} className="text-gray-400" />
              <span className="text-sm">{staff.email}</span>
            </div>
          )}
          {!staff.phone && !staff.email && (
            <p className="text-sm text-gray-400">連絡先が登録されていません</p>
          )}
        </div>
      </section>

      {/* 資格 */}
      <section>
        <h4 className="text-sm font-medium text-gray-500 mb-3">資格・経験</h4>
        <div className="space-y-3">
          {getQualificationLabels().length > 0 && (
            <div className="flex flex-wrap gap-2">
              {getQualificationLabels().map((label, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm"
                >
                  <Award size={14} />
                  {label}
                </span>
              ))}
            </div>
          )}
          {staff.personnelSettings?.yearsOfExperience !== undefined && staff.personnelSettings.yearsOfExperience > 0 && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} className="text-gray-400" />
              <span>実務経験 {staff.personnelSettings.yearsOfExperience}年</span>
            </div>
          )}
          {getQualificationLabels().length === 0 && !staff.personnelSettings?.yearsOfExperience && (
            <p className="text-sm text-gray-400">資格・経験が登録されていません</p>
          )}
        </div>
      </section>

      {/* メモ */}
      {staff.personnelSettings?.notes && (
        <section>
          <h4 className="text-sm font-medium text-gray-500 mb-3">メモ</h4>
          <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm whitespace-pre-wrap">
            {staff.personnelSettings.notes}
          </div>
        </section>
      )}
    </div>
  );

  // 人員配置タブ
  const renderPersonnelTab = () => (
    <div className="space-y-6">
      {/* 現在の設定 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-500">人員配置設定</h4>
          {onEditPersonnel && (
            <button
              onClick={() => onEditPersonnel(staff)}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              編集
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* 人員区分 */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-gray-400" />
              <span className="text-gray-600">人員区分</span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                staff.personnelSettings?.personnelType === 'standard'
                  ? 'bg-teal-100 text-teal-700'
                  : staff.personnelSettings?.personnelType === 'addition'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {getPersonnelTypeLabel()}
            </span>
          </div>

          {/* 勤務形態 */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Briefcase size={18} className="text-gray-400" />
              <span className="text-gray-600">勤務形態</span>
            </div>
            <span className="text-gray-800 font-medium">{getWorkStyleLabel()}</span>
          </div>

          {/* FTE */}
          {getFte() && (
            <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-gray-400" />
                <span className="text-gray-600">常勤換算</span>
              </div>
              <span className="text-gray-800 font-medium">
                {staff.personnelSettings?.contractedWeeklyHours}h/週 (FTE {getFte()})
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 役割 */}
      <section>
        <h4 className="text-sm font-medium text-gray-500 mb-3">役割</h4>
        <div className="flex flex-wrap gap-2">
          {staff.personnelSettings?.isServiceManager && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
              <CheckCircle size={14} />
              児童発達支援管理責任者
            </span>
          )}
          {staff.personnelSettings?.isManager && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
              <CheckCircle size={14} />
              管理者
            </span>
          )}
          {!staff.personnelSettings?.isServiceManager && !staff.personnelSettings?.isManager && (
            <p className="text-sm text-gray-400">役割が設定されていません</p>
          )}
        </div>
      </section>

      {/* 加算コード */}
      {staff.personnelSettings?.assignedAdditionCodes &&
        staff.personnelSettings.assignedAdditionCodes.length > 0 && (
          <section>
            <h4 className="text-sm font-medium text-gray-500 mb-3">担当加算</h4>
            <div className="flex flex-wrap gap-2">
              {staff.personnelSettings.assignedAdditionCodes.map((code, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {code}
                </span>
              ))}
            </div>
          </section>
        )}
    </div>
  );

  // 有給タブ
  const renderLeaveTab = () => {
    const leave = staff.leaveSettings;

    return (
      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-500">有給休暇</h4>
            {onEditLeave && (
              <button
                onClick={() => onEditLeave(staff)}
                className="text-sm text-teal-600 hover:text-teal-700"
              >
                編集
              </button>
            )}
          </div>

          {leave?.paidLeaveEnabled ? (
            <div className="space-y-3">
              <div className="p-4 bg-teal-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-teal-700 font-medium">有給残日数</span>
                  <span className="text-2xl font-bold text-teal-700">
                    {leave.paidLeaveDays}日
                  </span>
                </div>
                <div className="text-sm text-teal-600">
                  有給休暇管理が有効です
                </div>
              </div>

              {leave.substituteLeaveEnabled && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">振替休日残</span>
                    <span className="text-xl font-bold text-gray-700">
                      {leave.substituteLeaveDays}日
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm">有給休暇管理が無効です</p>
              {onEditLeave && (
                <button
                  onClick={() => onEditLeave(staff)}
                  className="mt-2 text-sm text-teal-600 hover:text-teal-700"
                >
                  有効にする
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* ドロワー */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(staff)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Edit2 size={16} />
                編集
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                削除
              </button>
            </div>
          </div>
        </div>

        {/* プロフィールヘッダー */}
        <div className="flex-shrink-0 px-6 py-6 bg-gradient-to-br from-teal-50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-3xl">
                {staff.name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-800 truncate">
                {staff.name}
              </h2>
              {staff.nameKana && (
                <p className="text-gray-500 text-sm">{staff.nameKana}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {staff.personnelSettings?.isServiceManager && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    児発管
                  </span>
                )}
                {staff.personnelSettings?.isManager && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    管理者
                  </span>
                )}
                {staff.personnelSettings?.personnelType === 'standard' && (
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                    基準
                  </span>
                )}
                {staff.personnelSettings?.personnelType === 'addition' && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    加算
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* タブ */}
        <div className="flex-shrink-0 px-6 border-b border-gray-200">
          <div className="flex gap-6">
            {[
              { id: 'info', label: '基本情報' },
              { id: 'personnel', label: '人員配置' },
              { id: 'leave', label: '有給管理' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-6">{renderTabContent()}</div>

        {/* フッター */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>
              登録: {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('ja-JP') : '-'}
            </span>
            <span>ID: {staff.id}</span>
          </div>
        </div>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 z-50 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">スタッフを削除</h3>
                <p className="text-sm text-gray-500">{staff.name}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              このスタッフを削除してもよろしいですか？この操作は取り消せません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  onDelete(staff);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default StaffDetailDrawer;
