/**
 * スタッフカード
 * スタッフ一覧やシフト表示で使用する共通カードコンポーネント
 */

'use client';

import React from 'react';
import {
  User,
  Phone,
  Mail,
  Award,
  Clock,
  Shield,
  Star,
  ChevronRight,
} from 'lucide-react';
import { Staff, StaffPersonnelSettings, QUALIFICATION_CODES } from '@/types';

interface StaffCardProps {
  staff: Staff;
  personnelSettings?: StaffPersonnelSettings;
  variant?: 'default' | 'compact' | 'detail';
  selected?: boolean;
  onClick?: () => void;
  actions?: React.ReactNode;
}

const StaffCard: React.FC<StaffCardProps> = ({
  staff,
  personnelSettings,
  variant = 'default',
  selected = false,
  onClick,
  actions,
}) => {
  // 資格ラベルを取得（personnelSettingsから取得）
  const qualificationLabels = (personnelSettings?.qualifications || [])
    .slice(0, 3)
    .map((q: string) => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q);

  // 役割バッジを取得
  const getRoleBadges = () => {
    const badges: { label: string; color: string }[] = [];

    if (personnelSettings?.isServiceManager) {
      badges.push({ label: '児発管', color: 'bg-purple-100 text-purple-700' });
    }
    if (personnelSettings?.isManager) {
      badges.push({ label: '管理者', color: 'bg-blue-100 text-blue-700' });
    }
    if (personnelSettings?.personnelType === 'standard') {
      badges.push({ label: '基準', color: 'bg-teal-100 text-teal-700' });
    }
    if (personnelSettings?.personnelType === 'addition') {
      badges.push({ label: '加算', color: 'bg-orange-100 text-orange-700' });
    }

    return badges;
  };

  // 勤務形態ラベル
  const getWorkStyleLabel = () => {
    if (!personnelSettings?.workStyle) return null;

    const labels: Record<string, string> = {
      fulltime_dedicated: '常勤専従',
      fulltime_concurrent: '常勤兼務',
      parttime: '非常勤',
    };

    return labels[personnelSettings.workStyle] || personnelSettings.workStyle;
  };

  // コンパクト表示
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
          selected
            ? 'bg-teal-50 border border-teal-200'
            : 'hover:bg-gray-50 border border-transparent'
        }`}
        onClick={onClick}
      >
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <User size={16} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate">
            {staff.name}
          </div>
          {qualificationLabels.length > 0 && (
            <div className="text-xs text-gray-500 truncate">
              {qualificationLabels.join('・')}
            </div>
          )}
        </div>
        {actions}
      </div>
    );
  }

  // デフォルト表示
  if (variant === 'default') {
    return (
      <div
        className={`bg-white rounded-xl border p-4 transition-all ${
          selected
            ? 'border-teal-300 shadow-md'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        } ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          {/* アバター */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {staff.name?.charAt(0) || '?'}
            </span>
          </div>

          {/* 情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-gray-800 truncate">{staff.name}</h3>
              {onClick && (
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              )}
            </div>

            {/* 役割バッジ */}
            <div className="flex flex-wrap gap-1 mb-2">
              {getRoleBadges().map((badge, idx) => (
                <span
                  key={idx}
                  className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}
                >
                  {badge.label}
                </span>
              ))}
              {getWorkStyleLabel() && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {getWorkStyleLabel()}
                </span>
              )}
            </div>

            {/* 資格 */}
            {qualificationLabels.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Award size={12} />
                <span className="truncate">{qualificationLabels.join('・')}</span>
              </div>
            )}

            {/* 経験年数 */}
            {staff.yearsOfExperience !== undefined && staff.yearsOfExperience > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <Clock size={12} />
                <span>経験 {staff.yearsOfExperience}年</span>
              </div>
            )}
          </div>

          {/* アクション */}
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      </div>
    );
  }

  // 詳細表示
  return (
    <div
      className={`bg-white rounded-xl border p-5 ${
        selected ? 'border-teal-300 shadow-md' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* アバター */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-2xl">
            {staff.name?.charAt(0) || '?'}
          </span>
        </div>

        {/* 情報 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-gray-800">{staff.name}</h3>
            {staff.nameKana && (
              <span className="text-sm text-gray-500">({staff.nameKana})</span>
            )}
          </div>

          {/* 役割バッジ */}
          <div className="flex flex-wrap gap-1 mb-3">
            {getRoleBadges().map((badge, idx) => (
              <span
                key={idx}
                className={`text-sm px-3 py-1 rounded-full ${badge.color}`}
              >
                {badge.label}
              </span>
            ))}
            {getWorkStyleLabel() && (
              <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                {getWorkStyleLabel()}
              </span>
            )}
          </div>

          {/* 詳細情報 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* 資格 */}
            {qualificationLabels.length > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <Award size={16} className="text-gray-400" />
                <span>{qualificationLabels.join('・')}</span>
              </div>
            )}

            {/* 経験年数 */}
            {staff.yearsOfExperience !== undefined && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={16} className="text-gray-400" />
                <span>経験 {staff.yearsOfExperience}年</span>
              </div>
            )}

            {/* 電話 */}
            {staff.emergencyContact && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone size={16} className="text-gray-400" />
                <span>{staff.emergencyContact}</span>
              </div>
            )}

            {/* FTE */}
            {personnelSettings?.contractedWeeklyHours && (
              <div className="flex items-center gap-2 text-gray-600">
                <Shield size={16} className="text-gray-400" />
                <span>
                  週{personnelSettings.contractedWeeklyHours}h (FTE{' '}
                  {(personnelSettings.contractedWeeklyHours / 40).toFixed(2)})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* アクション */}
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export default StaffCard;
