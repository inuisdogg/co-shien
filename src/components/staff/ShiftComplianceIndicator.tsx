/**
 * シフトコンプライアンスインジケーター
 * Shift Compliance Indicator
 *
 * 日次の人員配置コンプライアンス状態を表示
 */

'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Users, Clock, Award, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DailyStaffingCompliance,
  ComplianceStatus,
  COMPLIANCE_STATUS_CONFIG,
  WORK_STYLE_LABELS,
  PERSONNEL_TYPE_LABELS,
} from '@/types';
import { getComplianceIcon, getComplianceColor } from '@/utils/staffingComplianceCalculator';

interface ShiftComplianceIndicatorProps {
  compliance: DailyStaffingCompliance | null;
  compact?: boolean; // コンパクト表示（カレンダーセル内用）
  showDetails?: boolean; // 詳細を最初から表示するか
}

/**
 * コンパクトインジケーター（カレンダーセル用）
 */
export const CompactComplianceIndicator: React.FC<{
  status: ComplianceStatus;
  onClick?: () => void;
}> = ({ status, onClick }) => {
  const config = COMPLIANCE_STATUS_CONFIG[status];

  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${config.bgColor} ${config.color} hover:opacity-80 transition-opacity`}
      title={config.label}
    >
      {config.icon}
    </button>
  );
};

/**
 * 詳細コンプライアンスインジケーター
 */
const ShiftComplianceIndicator: React.FC<ShiftComplianceIndicatorProps> = ({
  compliance,
  compact = false,
  showDetails: initialShowDetails = false,
}) => {
  const [showDetails, setShowDetails] = useState(initialShowDetails);

  if (!compliance) {
    return (
      <div className="text-sm text-gray-400 flex items-center gap-1">
        <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">-</span>
        <span>データなし</span>
      </div>
    );
  }

  const config = COMPLIANCE_STATUS_CONFIG[compliance.overallStatus];

  // コンパクトモード
  if (compact) {
    return <CompactComplianceIndicator status={compliance.overallStatus} />;
  }

  return (
    <div className={`rounded-lg border ${config.bgColor.replace('bg-', 'border-').replace('-50', '-200')}`}>
      {/* ステータスヘッダー */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`w-full px-4 py-3 flex items-center justify-between ${config.bgColor} rounded-t-lg`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${config.color} bg-white`}>
            {config.icon}
          </div>
          <div className="text-left">
            <div className={`font-bold ${config.color}`}>
              人員配置: {config.label}
            </div>
            <div className="text-xs text-gray-600">
              基準人員 {compliance.standardStaffCount}名 / FTE {compliance.fteTotal.toFixed(2)}
            </div>
          </div>
        </div>
        {showDetails ? (
          <ChevronUp size={20} className="text-gray-400" />
        ) : (
          <ChevronDown size={20} className="text-gray-400" />
        )}
      </button>

      {/* 詳細表示 */}
      {showDetails && (
        <div className="p-4 bg-white rounded-b-lg space-y-4">
          {/* 基準人員チェック */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Users size={14} />
              基準人員チェック
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <CheckItem
                label="2名配置"
                checked={compliance.hasTwoStaff}
              />
              <CheckItem
                label="常勤専従配置"
                checked={compliance.hasFulltimeDedicated}
              />
              <CheckItem
                label="2人目充足"
                checked={compliance.hasSecondStaff}
              />
              <CheckItem
                label={`FTE合計: ${compliance.fteTotal.toFixed(2)}`}
                checked={compliance.fteTotal >= 2.0}
              />
            </div>
          </div>

          {/* 管理者・児発管チェック */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Award size={14} />
              管理者・児発管
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <CheckItem
                label="管理者"
                checked={compliance.hasManager}
              />
              <CheckItem
                label="児発管"
                checked={compliance.hasServiceManager}
              />
            </div>
          </div>

          {/* スタッフ内訳 */}
          {compliance.staffBreakdown.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Clock size={14} />
                スタッフ内訳
              </h4>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600">
                      <th className="px-2 py-1.5 text-left">名前</th>
                      <th className="px-2 py-1.5 text-center">区分</th>
                      <th className="px-2 py-1.5 text-center">勤務形態</th>
                      <th className="px-2 py-1.5 text-right">FTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.staffBreakdown.map((staff) => (
                      <tr key={staff.staffId} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-medium">
                          {staff.name}
                          {staff.isServiceManager && (
                            <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">
                              児発管
                            </span>
                          )}
                          {staff.isManager && !staff.isServiceManager && (
                            <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                              管理者
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              staff.personnelType === 'standard'
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {PERSONNEL_TYPE_LABELS[staff.personnelType]}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-gray-600">
                          {WORK_STYLE_LABELS[staff.workStyle]}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {staff.fte.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 警告一覧 */}
          {compliance.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <AlertTriangle size={14} />
                警告
              </h4>
              <div className="space-y-1">
                {compliance.warnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded text-sm flex items-start gap-2 ${
                      warning.severity === 'error'
                        ? 'bg-red-50 text-red-700'
                        : warning.severity === 'warning'
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {warning.severity === 'error' ? (
                      <XCircle size={14} className="mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    )}
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 加算コンプライアンス */}
          {Object.keys(compliance.additionCompliance).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-gray-700">加算要件</h4>
              <div className="space-y-1">
                {Object.entries(compliance.additionCompliance).map(([code, result]) => (
                  <div
                    key={code}
                    className={`px-3 py-2 rounded text-sm flex items-center justify-between ${
                      result.met ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <span className={result.met ? 'text-green-700' : 'text-red-700'}>
                      {code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        result.met
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {result.met ? '充足' : '不足'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * チェック項目表示
 */
const CheckItem: React.FC<{ label: string; checked: boolean }> = ({ label, checked }) => (
  <div
    className={`px-2 py-1.5 rounded flex items-center gap-2 ${
      checked ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}
  >
    {checked ? (
      <CheckCircle size={14} className="shrink-0" />
    ) : (
      <XCircle size={14} className="shrink-0" />
    )}
    <span className="truncate">{label}</span>
  </div>
);

/**
 * 月次サマリー表示
 */
export const MonthlyComplianceSummary: React.FC<{
  summary: {
    totalDays: number;
    compliantDays: number;
    warningDays: number;
    nonCompliantDays: number;
    commonWarnings: { type: string; count: number }[];
  };
}> = ({ summary }) => {
  const compliantRate = summary.totalDays > 0
    ? Math.round((summary.compliantDays / summary.totalDays) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 className="font-bold text-gray-800">月次コンプライアンスサマリー</h3>

      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800">{summary.totalDays}</div>
          <div className="text-xs text-gray-500">対象日数</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{summary.compliantDays}</div>
          <div className="text-xs text-gray-500">充足</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{summary.warningDays}</div>
          <div className="text-xs text-gray-500">注意</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{summary.nonCompliantDays}</div>
          <div className="text-xs text-gray-500">不足</div>
        </div>
      </div>

      {/* 充足率バー */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">充足率</span>
          <span className="font-bold text-gray-800">{compliantRate}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${compliantRate}%` }}
          />
        </div>
      </div>

      {/* よくある警告 */}
      {summary.commonWarnings.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-2">頻出警告</h4>
          <div className="space-y-1">
            {summary.commonWarnings.slice(0, 3).map((warning) => (
              <div
                key={warning.type}
                className="flex items-center justify-between text-sm bg-yellow-50 px-3 py-1.5 rounded"
              >
                <span className="text-yellow-700">{warning.type}</span>
                <span className="text-yellow-600 font-bold">{warning.count}日</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftComplianceIndicator;
