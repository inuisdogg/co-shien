/**
 * 加算コンプライアンスバナー
 * Addition Compliance Banner
 *
 * シフト管理画面の上部に表示し、加算体制要件の充足状況を表示
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Target,
  Award,
  Briefcase,
  Info,
} from 'lucide-react';
import {
  AdditionComplianceResult,
  AdditionCategoryGroup,
  AdditionComplianceStatus,
} from '@/hooks/useAdditionComplianceCheck';

interface AdditionComplianceBannerProps {
  complianceResults: AdditionComplianceResult[];
  categoryGroups: AdditionCategoryGroup[];
  summary: {
    total: number;
    met: number;
    unmet: number;
    partial: number;
  };
  loading?: boolean;
  onSettingsClick?: () => void;
}

// ステータスアイコンとスタイル
const STATUS_CONFIG: Record<AdditionComplianceStatus, {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  met: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: '取得可能',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  unmet: {
    icon: <XCircle className="w-4 h-4" />,
    label: '要件不足',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  partial: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: '一部充足',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
};

// カテゴリアイコン
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  staffing: <Award className="w-4 h-4" />,
  specialist: <Target className="w-4 h-4" />,
  treatment: <Briefcase className="w-4 h-4" />,
  other: <Settings className="w-4 h-4" />,
};

const AdditionComplianceBanner: React.FC<AdditionComplianceBannerProps> = ({
  complianceResults,
  categoryGroups,
  summary,
  loading = false,
  onSettingsClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 結果が更新されたら時刻を記録
  useEffect(() => {
    if (complianceResults.length > 0) {
      setLastUpdated(new Date());
    }
  }, [complianceResults]);

  // 対象加算がない場合
  if (summary.total === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3 text-gray-500">
          <Info className="w-5 h-5" />
          <span className="text-sm">
            適用中の加算体制設定がありません。
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="ml-2 text-teal-600 hover:text-teal-700 underline"
              >
                設定画面へ
              </button>
            )}
          </span>
        </div>
      </div>
    );
  }

  // 充足率の計算
  const complianceRate = summary.total > 0
    ? Math.round((summary.met / summary.total) * 100)
    : 0;

  // バナーの状態に応じた色
  const bannerStatus = summary.unmet > 0 ? 'warning' : 'success';
  const bannerColors = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      highlight: 'text-green-600',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      highlight: 'text-amber-600',
    },
  }[bannerStatus];

  return (
    <div className={`${bannerColors.bg} border ${bannerColors.border} rounded-lg mb-4 overflow-hidden`}>
      {/* ヘッダー（常に表示） */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* ステータスインジケーター */}
          <div className="flex items-center gap-2">
            {bannerStatus === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            <span className={`font-bold ${bannerColors.text}`}>
              加算体制
            </span>
          </div>

          {/* サマリー */}
          <div className="flex items-center gap-3 text-sm">
            <span className={`font-bold ${bannerColors.highlight}`}>
              {summary.met}/{summary.total} 取得可能
            </span>
            {summary.unmet > 0 && (
              <span className="text-red-600">
                ({summary.unmet}件 要件不足)
              </span>
            )}
          </div>

          {/* ミニインジケーター */}
          <div className="hidden md:flex items-center gap-1">
            {complianceResults.map((result, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  result.status === 'met'
                    ? 'bg-green-500'
                    : result.status === 'unmet'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
                title={`${result.name}: ${result.status === 'met' ? '○' : '×'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 更新時刻 */}
          {lastUpdated && (
            <span className="hidden sm:block text-xs text-gray-400">
              {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新
            </span>
          )}

          {/* 設定ボタン */}
          {onSettingsClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSettingsClick();
              }}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded transition-colors"
              title="加算設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* 展開/折りたたみ */}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* 詳細（展開時） */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200/50 bg-white/50">
          {loading ? (
            <div className="py-6 text-center text-gray-500">
              <div className="inline-block w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mr-2" />
              チェック中...
            </div>
          ) : (
            <div className="pt-4 space-y-4">
              {/* カテゴリごとに表示 */}
              {categoryGroups.map((group) => (
                <div key={group.category}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-400">
                      {CATEGORY_ICONS[group.category]}
                    </span>
                    <h4 className="text-sm font-bold text-gray-700">
                      {group.label}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.additions.map((addition) => {
                      const config = STATUS_CONFIG[addition.status];
                      return (
                        <div
                          key={`${addition.code}-${addition.tier || ''}`}
                          className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={config.color}>
                                  {config.icon}
                                </span>
                                <span className="font-medium text-gray-900 text-sm truncate">
                                  {addition.name}
                                  {addition.tierLabel && (
                                    <span className="ml-1 text-gray-500 text-xs">
                                      ({addition.tierLabel})
                                    </span>
                                  )}
                                </span>
                              </div>
                              {addition.status !== 'met' && (
                                <p className="mt-1 text-xs text-gray-600 pl-6">
                                  {addition.reason}
                                </p>
                              )}
                            </div>
                            {addition.units && (
                              <span className="shrink-0 text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded">
                                {addition.units}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* 全体サマリー */}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 font-medium">{summary.met}件 取得可能</span>
                    </div>
                    {summary.unmet > 0 && (
                      <div className="flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-red-700 font-medium">{summary.unmet}件 要件不足</span>
                      </div>
                    )}
                  </div>

                  {/* 充足率バー */}
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-xs text-gray-500">充足率</span>
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          complianceRate >= 80 ? 'bg-green-500' : complianceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${complianceRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700">{complianceRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdditionComplianceBanner;
