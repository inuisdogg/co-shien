/**
 * 年間スケジュール表コンポーネント
 * 38種の書類の更新タイミングを年間カレンダー形式で表示
 * 施設ごとのカスタム設定に対応
 */

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Circle,
  Info,
  Loader2,
  Settings,
} from 'lucide-react';
import {
  DOCUMENT_TYPE_CONFIGS,
  DOCUMENT_CATEGORIES,
  UPDATE_CYCLE_LABELS,
  DocumentTypeConfig,
  UpdateCycleType,
} from '@/constants/documentTypeConfigs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// 施設別設定の型
type FacilityDocConfig = {
  documentType: string;
  isCustom: boolean;
  isEnabled: boolean;
  customName?: string;
  customCategory?: string;
  updateCycleType?: UpdateCycleType;
  updateMonths?: number[];
  triggerDescription?: string;
};

// 表示用の書類情報（システム定義 + カスタム統合）
type DisplayDocConfig = DocumentTypeConfig & {
  isCustom?: boolean;
  facilityOverride?: FacilityDocConfig;
};

// 日本の年度月（4月始まり）
const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_LABELS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];

// 月に更新が必要かどうかを判定（施設設定を考慮）
const isUpdateMonthWithOverride = (
  config: DocumentTypeConfig,
  month: number,
  cycleTypeOverride?: UpdateCycleType,
  updateMonthsOverride?: number[]
): boolean => {
  const cycleType = cycleTypeOverride || config.updateCycleType;
  const updateMonths = updateMonthsOverride || config.updateMonths;

  switch (cycleType) {
    case 'daily':
    case 'monthly':
      return true;
    case 'quarterly':
    case 'biannual':
    case 'yearly':
    case 'biennial':
      return updateMonths?.includes(month) || false;
    default:
      return false;
  }
};

// 更新サイクルタイプに応じた表示を取得（施設設定を考慮）
const getCycleDisplayWithOverride = (
  config: DocumentTypeConfig,
  cycleTypeOverride?: UpdateCycleType,
  triggerDescOverride?: string
): {
  type: 'circle' | 'line' | 'text';
  text?: string;
} => {
  const cycleType = cycleTypeOverride || config.updateCycleType;
  const triggerDesc = triggerDescOverride || config.triggerDescription;

  switch (cycleType) {
    case 'static':
      return { type: 'line', text: triggerDesc || '変更時更新' };
    case 'event':
      return { type: 'text', text: triggerDesc || '随時' };
    default:
      return { type: 'circle' };
  }
};

// セルの色を取得
const getCycleBgColor = (cycleType: UpdateCycleType): string => {
  switch (cycleType) {
    case 'daily':
      return 'bg-blue-100';
    case 'monthly':
      return 'bg-green-100';
    case 'quarterly':
      return 'bg-purple-100';
    case 'biannual':
      return 'bg-pink-100';
    case 'yearly':
    case 'biennial':
      return 'bg-orange-100';
    case 'static':
      return 'bg-gray-50';
    case 'event':
      return 'bg-yellow-50';
    case 'custom':
      return 'bg-indigo-100';
    default:
      return '';
  }
};

export default function DocumentScheduleView() {
  const { facility } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 現在の年度を計算（4月始まり）
  const getCurrentFiscalYear = () => {
    return currentMonth >= 4 ? currentYear : currentYear - 1;
  };

  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(DOCUMENT_CATEGORIES.map(c => c.name))
  );
  const [facilityConfigs, setFacilityConfigs] = useState<FacilityDocConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // 施設設定を取得
  const fetchFacilityConfigs = useCallback(async () => {
    if (!facility?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('facility_document_configs')
        .select('document_type, is_custom, is_enabled, custom_name, custom_category, update_cycle_type, update_months, trigger_description')
        .eq('facility_id', facility.id);

      if (error) throw error;
      setFacilityConfigs(
        (data || []).map(row => ({
          documentType: row.document_type,
          isCustom: row.is_custom,
          isEnabled: row.is_enabled,
          customName: row.custom_name,
          customCategory: row.custom_category,
          updateCycleType: row.update_cycle_type,
          updateMonths: row.update_months,
          triggerDescription: row.trigger_description,
        }))
      );
    } catch (err) {
      console.error('施設設定取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchFacilityConfigs();
  }, [fetchFacilityConfigs]);

  // 書類が有効かどうか
  const isDocEnabled = (docType: string): boolean => {
    const config = facilityConfigs.find(c => c.documentType === docType);
    return config ? config.isEnabled : true;
  };

  // 書類の更新サイクルを取得（施設設定を優先）
  const getDocCycleType = (doc: DocumentTypeConfig): UpdateCycleType => {
    const config = facilityConfigs.find(c => c.documentType === doc.documentType);
    return config?.updateCycleType || doc.updateCycleType;
  };

  // 書類の更新月を取得（施設設定を優先）
  const getDocUpdateMonths = (doc: DocumentTypeConfig): number[] | undefined => {
    const config = facilityConfigs.find(c => c.documentType === doc.documentType);
    return config?.updateMonths || doc.updateMonths;
  };

  // カテゴリの展開/折りたたみ
  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  // 施設設定を取得するヘルパー
  const getFacilityConfig = useCallback((docType: string) => {
    return facilityConfigs.find(c => c.documentType === docType);
  }, [facilityConfigs]);

  // カテゴリごとにグループ化（有効な書類のみ + カスタム書類を含む）
  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, DisplayDocConfig[]> = {};

    for (const category of DOCUMENT_CATEGORIES) {
      // システム定義書類（有効なもののみ）
      const systemDocs: DisplayDocConfig[] = DOCUMENT_TYPE_CONFIGS
        .filter(config => config.category === category.name)
        .filter(config => isDocEnabled(config.documentType))
        .map(config => ({
          ...config,
          isCustom: false,
          facilityOverride: getFacilityConfig(config.documentType),
        }));

      // カスタム書類（このカテゴリに属するもの）
      const customDocs: DisplayDocConfig[] = facilityConfigs
        .filter(c => c.isCustom && c.isEnabled && c.customCategory === category.name)
        .map(c => ({
          id: `custom-${c.documentType}`,
          documentType: c.documentType,
          displayName: c.customName || c.documentType,
          category: c.customCategory || category.name,
          updateCycleType: c.updateCycleType || 'event',
          updateMonths: c.updateMonths,
          triggerDescription: c.triggerDescription,
          entityType: 'facility' as const,
          alertDaysWarning: 30,
          alertDaysUrgent: 7,
          isCustom: true,
          facilityOverride: c,
        }));

      grouped[category.name] = [...systemDocs, ...customDocs];
    }

    // 「カスタム書類」カテゴリを追加（カテゴリ未設定のカスタム書類用）
    const uncategorizedCustomDocs: DisplayDocConfig[] = facilityConfigs
      .filter(c => c.isCustom && c.isEnabled && !c.customCategory)
      .map(c => ({
        id: `custom-${c.documentType}`,
        documentType: c.documentType,
        displayName: c.customName || c.documentType,
        category: 'カスタム書類',
        updateCycleType: c.updateCycleType || 'event',
        updateMonths: c.updateMonths,
        triggerDescription: c.triggerDescription,
        entityType: 'facility' as const,
        alertDaysWarning: 30,
        alertDaysUrgent: 7,
        isCustom: true,
        facilityOverride: c,
      }));

    if (uncategorizedCustomDocs.length > 0) {
      grouped['カスタム書類'] = uncategorizedCustomDocs;
    }

    return grouped;
  }, [facilityConfigs, isDocEnabled, getFacilityConfig]);

  // 全カテゴリ（システム定義 + カスタムカテゴリ）
  const allCategories = useMemo(() => {
    const categories = [...DOCUMENT_CATEGORIES];
    if (documentsByCategory['カスタム書類']?.length > 0) {
      categories.push({
        id: 'custom',
        name: 'カスタム書類',
        color: 'bg-indigo-500',
      });
    }
    return categories;
  }, [documentsByCategory]);

  // 統計情報（有効な書類のみカウント）
  const stats = useMemo(() => {
    const byType: Record<UpdateCycleType, number> = {
      static: 0,
      event: 0,
      daily: 0,
      monthly: 0,
      quarterly: 0,
      biannual: 0,
      yearly: 0,
      biennial: 0,
      custom: 0,
    };

    // 全カテゴリの書類をカウント
    for (const docs of Object.values(documentsByCategory)) {
      for (const doc of docs) {
        const cycleType = doc.facilityOverride?.updateCycleType || doc.updateCycleType;
        if (cycleType in byType) {
          byType[cycleType]++;
        }
      }
    }

    return byType;
  }, [documentsByCategory]);

  // 有効な書類の総数
  const totalEnabledDocs = useMemo(() => {
    return Object.values(documentsByCategory).reduce((sum, docs) => sum + docs.length, 0);
  }, [documentsByCategory]);

  // ローディング中
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#00c4cc]" />
        <span className="ml-3 text-gray-500">設定を読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#00c4cc]" />
            年間更新スケジュール
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalEnabledDocs}種の書類の更新タイミングを年度単位で確認できます
            {facilityConfigs.length > 0 && (
              <span className="ml-2 text-[#00c4cc]">
                <Settings className="w-3 h-3 inline mr-1" />
                施設設定適用中
              </span>
            )}
          </p>
        </div>

        {/* 年度選択 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiscalYear(fiscalYear - 1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-bold text-gray-800 min-w-[120px] text-center">
            {fiscalYear}年度
          </span>
          <button
            onClick={() => setFiscalYear(fiscalYear + 1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 凡例 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-700">凡例</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#00c4cc] flex items-center justify-center">
              <Circle className="w-3 h-3 text-white fill-white" />
            </div>
            <span className="text-gray-600">更新・提出月</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-0.5 bg-gray-400"></div>
            <span className="text-gray-600">初回登録（変更時更新）</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 italic">～説明文～</span>
            <span className="text-gray-600">イベント発生時に対応</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">毎日: {stats.daily}件</span>
          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">毎月: {stats.monthly}件</span>
          <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">四半期: {stats.quarterly}件</span>
          <span className="text-xs px-2 py-1 rounded bg-pink-100 text-pink-700">半年: {stats.biannual}件</span>
          <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">年1〜2回: {stats.yearly + stats.biennial}件</span>
          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">初回のみ: {stats.static}件</span>
          <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">随時: {stats.event}件</span>
          {stats.custom > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700">カスタム: {stats.custom}件</span>
          )}
        </div>
      </div>

      {/* スケジュール表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-bold text-gray-700 w-[200px] sticky left-0 bg-gray-50 z-10">
                  書類名
                </th>
                <th className="text-center px-2 py-3 text-sm font-bold text-gray-700 w-[60px]">
                  更新
                </th>
                {MONTH_LABELS.map((label, index) => {
                  const month = FISCAL_MONTHS[index];
                  const isCurrentMonth =
                    (month >= 4 && fiscalYear === currentYear && month === currentMonth) ||
                    (month <= 3 && fiscalYear === currentYear - 1 && month === currentMonth);
                  return (
                    <th
                      key={month}
                      className={`text-center px-1 py-3 text-sm font-bold w-[50px] ${
                        isCurrentMonth ? 'bg-[#00c4cc] text-white' : 'text-gray-700'
                      }`}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allCategories.map((category) => {
                const docs = documentsByCategory[category.name] || [];
                const isExpanded = expandedCategories.has(category.name);

                // 書類がない場合はカテゴリ自体を非表示
                if (docs.length === 0) return null;

                return (
                  <React.Fragment key={category.id}>
                    {/* カテゴリヘッダー */}
                    <tr
                      className="bg-gray-100 cursor-pointer hover:bg-gray-150 transition-colors"
                      onClick={() => toggleCategory(category.name)}
                    >
                      <td
                        colSpan={14}
                        className="px-4 py-2 sticky left-0 bg-gray-100 z-10"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-4 rounded-full ${category.color}`} />
                          <span className="font-bold text-gray-800 text-sm">
                            【{category.name}】
                          </span>
                          <span className="text-xs text-gray-500">
                            {docs.length}件
                          </span>
                          <ChevronRight
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </td>
                    </tr>

                    {/* 書類行 */}
                    {isExpanded && docs.map((doc, docIndex) => {
                      // 施設設定を優先して適用
                      const effectiveCycleType = doc.facilityOverride?.updateCycleType || doc.updateCycleType;
                      const effectiveUpdateMonths = doc.facilityOverride?.updateMonths || doc.updateMonths;
                      const effectiveTriggerDesc = doc.facilityOverride?.triggerDescription || doc.triggerDescription;

                      const cycleDisplay = getCycleDisplayWithOverride(doc, effectiveCycleType, effectiveTriggerDesc);
                      const bgColor = getCycleBgColor(effectiveCycleType);

                      return (
                        <tr
                          key={doc.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            docIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          {/* 書類名 */}
                          <td className="px-4 py-2 text-sm text-gray-800 sticky left-0 bg-inherit z-10">
                            <div className="flex items-center gap-2">
                              <span>{doc.displayName}</span>
                              {doc.isCustom && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                  カスタム
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 更新頻度 */}
                          <td className={`text-center px-2 py-2 text-xs font-medium ${bgColor}`}>
                            {UPDATE_CYCLE_LABELS[effectiveCycleType]}
                          </td>

                          {/* 月別セル */}
                          {FISCAL_MONTHS.map((month) => {
                            const isUpdate = isUpdateMonthWithOverride(doc, month, effectiveCycleType, effectiveUpdateMonths);

                            if (cycleDisplay.type === 'line') {
                              // 初回のみ（変更時更新）の場合は横線表示
                              return (
                                <td key={month} className="text-center px-1 py-2 relative">
                                  <div className="absolute inset-y-1/2 left-0 right-0 h-0.5 bg-gray-300" />
                                </td>
                              );
                            }

                            if (cycleDisplay.type === 'text') {
                              // イベント駆動の場合はテキスト表示（最初の月のみ）
                              if (month === 4) {
                                return (
                                  <td
                                    key={month}
                                    colSpan={12}
                                    className="text-center px-2 py-2 text-xs text-gray-500 italic"
                                  >
                                    ～{cycleDisplay.text}～
                                  </td>
                                );
                              }
                              return null; // colSpanで処理されるのでnull
                            }

                            // 通常の○印表示
                            return (
                              <td key={month} className="text-center px-1 py-2">
                                {isUpdate && (
                                  <div className="w-6 h-6 mx-auto rounded-full bg-[#00c4cc] flex items-center justify-center">
                                    <Circle className="w-3 h-3 text-white fill-white" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 注釈 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>※ 年度は4月始まり〜3月終わりで表示しています。</p>
        <p>※ 「随時」の書類は、該当イベント発生時に対応が必要です。</p>
        <p>※ 「初回」の書類は、内容に変更があった場合のみ更新が必要です。</p>
        <p>※ 書類の有効/無効やスケジュールは施設設定から変更できます。</p>
      </div>
    </div>
  );
}
