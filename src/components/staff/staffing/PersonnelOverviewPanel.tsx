/**
 * 人員配置概要パネル
 * 人員配置状況のサマリーと警告を表示
 */

'use client';

import React from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  TrendingUp,
  Info,
} from 'lucide-react';

interface StaffingRequirement {
  id: string;
  name: string;
  required: number;
  current: number;
  unit: string;
  status: 'ok' | 'warning' | 'critical';
  description?: string;
}

interface StaffingSummary {
  totalStaff: number;
  totalFte: number;
  standardStaff: number;
  additionStaff: number;
  managers: number;
  serviceManagers: number;
  fulltimeDedicated: number;
  fulltimeConcurrent: number;
  parttime: number;
}

interface PersonnelOverviewPanelProps {
  summary: StaffingSummary;
  requirements: StaffingRequirement[];
  serviceType?: 'jidou' | 'houdei'; // 児発 or 放デイ
  capacity?: number; // 定員
}

const PersonnelOverviewPanel: React.FC<PersonnelOverviewPanelProps> = ({
  summary,
  requirements,
  serviceType = 'jidou',
  capacity = 10,
}) => {
  // ステータスに応じた色とアイコン
  const getStatusInfo = (status: StaffingRequirement['status']) => {
    switch (status) {
      case 'ok':
        return {
          color: 'text-green-600 bg-green-100 border-green-200',
          icon: CheckCircle,
          label: '充足',
        };
      case 'warning':
        return {
          color: 'text-yellow-600 bg-yellow-100 border-yellow-200',
          icon: AlertTriangle,
          label: '注意',
        };
      case 'critical':
        return {
          color: 'text-red-600 bg-red-100 border-red-200',
          icon: AlertTriangle,
          label: '不足',
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-100 border-gray-200',
          icon: Info,
          label: '-',
        };
    }
  };

  // 全体の配置基準充足状態
  const overallStatus = requirements.some((r) => r.status === 'critical')
    ? 'critical'
    : requirements.some((r) => r.status === 'warning')
    ? 'warning'
    : 'ok';

  const overallInfo = getStatusInfo(overallStatus);
  const OverallIcon = overallInfo.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Shield size={20} className="text-teal-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">人員配置状況</h3>
              <p className="text-sm text-gray-500">
                {serviceType === 'jidou' ? '児童発達支援' : '放課後等デイサービス'} / 定員
                {capacity}名
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${overallInfo.color}`}
          >
            <OverallIcon size={16} />
            <span className="text-sm font-medium">
              {overallStatus === 'ok'
                ? '配置基準充足'
                : overallStatus === 'warning'
                ? '注意が必要'
                : '配置基準未達'}
            </span>
          </div>
        </div>
      </div>

      {/* サマリーグリッド */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-teal-600" />
              <span className="text-sm text-gray-500">総スタッフ</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {summary.totalStaff}
              <span className="text-sm font-normal text-gray-500 ml-1">名</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-blue-600" />
              <span className="text-sm text-gray-500">常勤換算</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {summary.totalFte.toFixed(2)}
              <span className="text-sm font-normal text-gray-500 ml-1">FTE</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-green-600" />
              <span className="text-sm text-gray-500">基準人員</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {summary.standardStaff}
              <span className="text-sm font-normal text-gray-500 ml-1">名</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-orange-600" />
              <span className="text-sm text-gray-500">加算人員</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {summary.additionStaff}
              <span className="text-sm font-normal text-gray-500 ml-1">名</span>
            </div>
          </div>
        </div>
      </div>

      {/* 配置基準チェック */}
      <div className="px-5 py-4">
        <h4 className="text-sm font-medium text-gray-500 mb-3">配置基準チェック</h4>
        <div className="space-y-3">
          {requirements.map((req) => {
            const statusInfo = getStatusInfo(req.status);
            const StatusIcon = statusInfo.icon;
            const percentage = Math.min(100, (req.current / req.required) * 100);

            return (
              <div
                key={req.id}
                className={`p-4 rounded-xl border ${
                  req.status === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : req.status === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon
                      size={16}
                      className={
                        req.status === 'critical'
                          ? 'text-red-600'
                          : req.status === 'warning'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }
                    />
                    <span className="font-medium text-gray-800">{req.name}</span>
                  </div>
                  <div className="text-sm">
                    <span
                      className={`font-bold ${
                        req.status === 'critical'
                          ? 'text-red-600'
                          : req.status === 'warning'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      {req.current}
                    </span>
                    <span className="text-gray-500"> / {req.required}</span>
                    <span className="text-gray-400 ml-1">{req.unit}</span>
                  </div>
                </div>

                {/* プログレスバー */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      req.status === 'critical'
                        ? 'bg-red-500'
                        : req.status === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {req.description && (
                  <p className="mt-2 text-xs text-gray-500">{req.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 勤務形態内訳 */}
      <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-500 mb-3">勤務形態内訳</h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-teal-500" />
            <span className="text-sm text-gray-600">
              常勤専従: <span className="font-medium">{summary.fulltimeDedicated}名</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-600">
              常勤兼務: <span className="font-medium">{summary.fulltimeConcurrent}名</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-sm text-gray-600">
              非常勤: <span className="font-medium">{summary.parttime}名</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm text-gray-600">
              管理者: <span className="font-medium">{summary.managers}名</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-pink-500" />
            <span className="text-sm text-gray-600">
              児発管: <span className="font-medium">{summary.serviceManagers}名</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonnelOverviewPanel;
