/**
 * 日別プログラム計画ビュー
 * Daily Program Planning View
 *
 * 日ごとのスタッフ・児童・加算を表示し、実施加算の計画を立てる
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  CalendarDays,
  Award,
  Target,
  CheckCircle,
  Plus,
  Minus,
  Save,
  AlertTriangle,
  Info,
  Calculator,
  ClipboardList,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Staff, Child } from '@/types';
import { useDailyProgramPlan, AdditionDefinition, DailyAdditionTarget } from '@/hooks/useDailyProgramPlan';

interface DailyProgramPlanningViewProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

// 日付をフォーマット
const formatDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${year}年${month}月${day}日（${weekDays[date.getDay()]}）`;
};

// カテゴリラベル
const CATEGORY_LABELS: Record<string, string> = {
  staffing: '人員配置',
  specialist: '専門職',
  treatment: '処遇改善',
  family: '家族支援',
  transport: '送迎',
  extension: '延長',
  support: '個別支援',
  medical: '医療連携',
  other: 'その他',
};

// 加算タイプラベル
const ADDITION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  facility_preset: { label: '体制', color: 'bg-purple-100 text-purple-700' },
  monthly: { label: '月次', color: 'bg-blue-100 text-blue-700' },
  daily: { label: '実施', color: 'bg-green-100 text-green-700' },
};

const DailyProgramPlanningView: React.FC<DailyProgramPlanningViewProps> = ({
  isOpen,
  onClose,
  initialDate,
}) => {
  const {
    dailyData,
    additionDefinitions,
    unitBreakdown,
    loading,
    error,
    selectedDate,
    loadDailyData,
    savePlan,
    addTarget,
    removeTarget,
    completeTarget,
  } = useDailyProgramPlan();

  const [currentDate, setCurrentDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [localPlannedAdditions, setLocalPlannedAdditions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAdditionModal, setShowAdditionModal] = useState(false);
  const [selectedChildForTarget, setSelectedChildForTarget] = useState<string | null>(null);

  // 初期読み込み
  useEffect(() => {
    if (isOpen && currentDate) {
      loadDailyData(currentDate);
    }
  }, [isOpen, currentDate, loadDailyData]);

  // データが読み込まれたらローカル状態に反映
  useEffect(() => {
    if (dailyData?.plan) {
      setLocalPlannedAdditions(dailyData.plan.plannedAdditions || []);
      setNotes(dailyData.plan.notes || '');
      setHasChanges(false);
    } else if (dailyData) {
      setLocalPlannedAdditions([]);
      setNotes('');
      setHasChanges(false);
    }
  }, [dailyData]);

  // 日付を変更
  const changeDate = (offset: number) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    const newDateStr = date.toISOString().split('T')[0];
    setCurrentDate(newDateStr);
  };

  // 体制加算をトグル
  const toggleFacilityAddition = (code: string) => {
    setLocalPlannedAdditions(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
    setHasChanges(true);
  };

  // 保存
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePlan(localPlannedAdditions, notes);
      setHasChanges(false);
    } catch {
      // エラーはフック内で処理
    } finally {
      setIsSaving(false);
    }
  };

  // 加算をカテゴリ別にグループ化
  const groupedAdditions = useMemo(() => {
    const groups: Record<string, AdditionDefinition[]> = {};
    additionDefinitions.forEach(def => {
      const category = def.categoryCode;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(def);
    });
    return groups;
  }, [additionDefinitions]);

  // 体制加算のみ
  const facilityPresetAdditions = useMemo(() => {
    return additionDefinitions.filter(d => d.additionType === 'facility_preset');
  }, [additionDefinitions]);

  // 実施加算のみ
  const dailyAdditions = useMemo(() => {
    return additionDefinitions.filter(d => d.additionType === 'daily');
  }, [additionDefinitions]);

  // 児童ごとのターゲットをグループ化
  const targetsByChild = useMemo(() => {
    const groups: Record<string, DailyAdditionTarget[]> = {};
    dailyData?.additionTargets.forEach(target => {
      if (!groups[target.childId]) {
        groups[target.childId] = [];
      }
      groups[target.childId].push(target);
    });
    return groups;
  }, [dailyData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-teal-500 to-teal-600">
          <div className="flex items-center gap-4">
            <CalendarDays className="w-6 h-6 text-white" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeDate(-1)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-white">
                {formatDate(currentDate)}
              </h2>
              <button
                onClick={() => changeDate(1)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-white text-teal-600 rounded-lg font-bold text-sm hover:bg-teal-50 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '保存中...' : '保存'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ローディング・エラー */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        {!loading && dailyData && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* サマリーカード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* スタッフ */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-blue-800">配置スタッフ</h3>
                </div>
                <div className="text-3xl font-bold text-blue-700">
                  {dailyData.staffOnShift.length}名
                </div>
                <div className="mt-2 space-y-1">
                  {dailyData.staffOnShift.slice(0, 3).map(staff => (
                    <div key={staff.id} className="text-sm text-blue-600 truncate">
                      {staff.name}
                      {staff.qualifications && (
                        <span className="ml-1 text-xs text-blue-500">
                          ({staff.qualifications.split(',')[0]})
                        </span>
                      )}
                    </div>
                  ))}
                  {dailyData.staffOnShift.length > 3 && (
                    <div className="text-xs text-blue-500">
                      他{dailyData.staffOnShift.length - 3}名
                    </div>
                  )}
                </div>
              </div>

              {/* 児童 */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-5 h-5 text-green-600" />
                  <h3 className="font-bold text-green-800">予約児童</h3>
                </div>
                <div className="text-3xl font-bold text-green-700">
                  {dailyData.scheduledChildren.length}名
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="text-sm text-green-600">
                    <span className="font-medium">AM:</span>{' '}
                    {dailyData.schedules.filter(s => s.slot === 'AM').length}名
                  </div>
                  <div className="text-sm text-green-600">
                    <span className="font-medium">PM:</span>{' '}
                    {dailyData.schedules.filter(s => s.slot === 'PM').length}名
                  </div>
                </div>
              </div>

              {/* 単位数 */}
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-amber-800">予測単位数</h3>
                </div>
                <div className="text-3xl font-bold text-amber-700">
                  {unitBreakdown?.totalUnits.toLocaleString() || 0}
                  <span className="text-base font-normal ml-1">単位</span>
                </div>
                <div className="mt-2 text-xs text-amber-600 space-y-0.5">
                  <div>基本: {unitBreakdown?.baseUnits.toLocaleString() || 0}</div>
                  <div>体制加算: +{unitBreakdown?.facilityPresetUnits.toLocaleString() || 0}</div>
                  <div>実施加算: +{unitBreakdown?.dailyUnits.toLocaleString() || 0}</div>
                </div>
              </div>
            </div>

            {/* 体制加算セクション */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-gray-800">体制加算（自動適用）</h3>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  事前届出により適用される加算です。設定画面で有効にした加算が自動的に適用されます。
                </p>
              </div>
              <div className="p-4">
                {facilityPresetAdditions.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">
                    体制加算が登録されていません
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {facilityPresetAdditions.map(addition => {
                      const isEnabled = localPlannedAdditions.includes(addition.code);
                      return (
                        <button
                          key={addition.code}
                          onClick={() => toggleFacilityAddition(addition.code)}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                            isEnabled
                              ? 'bg-purple-50 border-purple-300 shadow-sm'
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              isEnabled ? 'bg-purple-500' : 'bg-gray-300'
                            }`}>
                              {isEnabled && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                            <div>
                              <div className={`font-medium text-sm ${
                                isEnabled ? 'text-purple-800' : 'text-gray-700'
                              }`}>
                                {addition.shortName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {addition.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${
                              isEnabled ? 'text-purple-600' : 'text-gray-500'
                            }`}>
                              {addition.isPercentage
                                ? `${addition.percentageRate}%`
                                : `${addition.units}単位`}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 実施加算セクション */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-gray-800">実施加算（児童別計画）</h3>
                  </div>
                  <button
                    onClick={() => setShowAdditionModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    加算を追加
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  児童ごとに実施する加算を計画し、実績記録へつなげます。
                </p>
              </div>
              <div className="p-4">
                {dailyData.scheduledChildren.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    予約児童がいません
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dailyData.scheduledChildren.map(child => {
                      const childTargets = targetsByChild[child.id] || [];
                      return (
                        <div key={child.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between p-3 bg-gray-50">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-teal-700">
                                  {child.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-800">{child.name}</div>
                                <div className="text-xs text-gray-500">
                                  {dailyData.schedules.filter(s => s.childId === child.id).map(s => s.slot).join(', ')}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedChildForTarget(child.id)}
                              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="加算を追加"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                          {childTargets.length > 0 && (
                            <div className="p-2 space-y-1">
                              {childTargets.map(target => {
                                const definition = additionDefinitions.find(d => d.code === target.additionCode);
                                return (
                                  <div
                                    key={target.id}
                                    className={`flex items-center justify-between p-2 rounded ${
                                      target.targetStatus === 'completed'
                                        ? 'bg-green-50'
                                        : target.targetStatus === 'cancelled'
                                        ? 'bg-gray-100'
                                        : 'bg-blue-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {target.targetStatus === 'completed' ? (
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-blue-600" />
                                      )}
                                      <span className={`text-sm ${
                                        target.targetStatus === 'cancelled'
                                          ? 'text-gray-400 line-through'
                                          : 'text-gray-700'
                                      }`}>
                                        {definition?.shortName || target.additionCode}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {definition?.units}単位
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {target.targetStatus === 'planned' && (
                                        <button
                                          onClick={() => completeTarget(target.id)}
                                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                          title="完了"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => removeTarget(target.id)}
                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                        title="削除"
                                      >
                                        <Minus className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 単位数内訳 */}
            {unitBreakdown && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-gray-800">単位数内訳</h3>
                  </div>
                </div>
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b">
                        <th className="text-left py-2 font-medium">項目</th>
                        <th className="text-right py-2 font-medium w-20">単位</th>
                        <th className="text-right py-2 font-medium w-16">数量</th>
                        <th className="text-right py-2 font-medium w-24">小計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitBreakdown.details.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs mr-2 ${
                              item.type === 'base'
                                ? 'bg-gray-100 text-gray-600'
                                : item.type === 'facility_preset'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {item.type === 'base' ? '基本' : item.type === 'facility_preset' ? '体制' : '実施'}
                            </span>
                            {item.name}
                          </td>
                          <td className="text-right py-2 font-mono">
                            {item.units.toLocaleString()}
                          </td>
                          <td className="text-right py-2 font-mono">
                            {item.count}
                          </td>
                          <td className="text-right py-2 font-mono font-bold">
                            {item.subtotal.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-50 font-bold">
                        <td className="py-3" colSpan={3}>
                          合計
                        </td>
                        <td className="text-right py-3 text-amber-700">
                          {unitBreakdown.totalUnits.toLocaleString()}単位
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* メモ */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メモ
              </label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="この日の計画に関するメモ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* 加算追加モーダル */}
        {(showAdditionModal || selectedChildForTarget) && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
              <div className="flex items-center justify-between p-4 border-b">
                <h4 className="font-bold text-gray-800">
                  {selectedChildForTarget
                    ? `${dailyData?.scheduledChildren.find(c => c.id === selectedChildForTarget)?.name}さんに加算を追加`
                    : '加算を追加'}
                </h4>
                <button
                  onClick={() => {
                    setShowAdditionModal(false);
                    setSelectedChildForTarget(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                <div className="space-y-2">
                  {dailyAdditions.map(addition => (
                    <button
                      key={addition.code}
                      onClick={async () => {
                        if (selectedChildForTarget) {
                          await addTarget(selectedChildForTarget, addition.code);
                          setSelectedChildForTarget(null);
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left"
                    >
                      <div>
                        <div className="font-medium text-gray-800">
                          {addition.shortName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {addition.name}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-green-600">
                        {addition.units}単位
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyProgramPlanningView;
