/**
 * 経営設定ビュー（独立したメニュー）
 * 月ごとの経営目標、コスト設定を詳細に管理
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Target,
  TrendingUp,
  Users,
  Plus,
  Trash2,
  X,
  Save,
  Copy,
  Calendar,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import {
  ManagementTarget,
  ManagementTargetFormData,
  StaffSalary,
  FixedCostItem,
  VariableCostItem,
} from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';

const ManagementSettingsView: React.FC = () => {
  const {
    managementTargets,
    staff,
    addManagementTarget,
    updateManagementTarget,
    deleteManagementTarget,
    getManagementTarget,
  } = useFacilityData();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [comparisonMonths, setComparisonMonths] = useState<{ year: number; month: number }[]>([]);

  // 選択された月の設定を取得
  const currentTarget = useMemo(
    () => getManagementTarget(selectedYear, selectedMonth),
    [getManagementTarget, selectedYear, selectedMonth]
  );

  // 前月の設定を取得
  const previousMonthTarget = useMemo(() => {
    let prevYear = selectedYear;
    let prevMonth = selectedMonth - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    return getManagementTarget(prevYear, prevMonth);
  }, [getManagementTarget, selectedYear, selectedMonth]);

  // フォームの初期値（前月の設定を引き継ぐ）
  const getInitialForm = React.useCallback((): ManagementTargetFormData => {
    if (currentTarget) {
      return {
        year: selectedYear,
        month: selectedMonth,
        staffSalaries: currentTarget.staffSalaries || [],
        fixedCostItems: currentTarget.fixedCostItems || [],
        variableCostItems: currentTarget.variableCostItems || [],
        totalFixedCost: currentTarget.totalFixedCost || 0,
        totalVariableCost: currentTarget.totalVariableCost || 0,
        targetRevenue: currentTarget.targetRevenue || 0,
        targetOccupancyRate: currentTarget.targetOccupancyRate || 0,
        dailyPricePerChild: currentTarget.dailyPricePerChild || 0,
      };
    }
    
    // 前月の設定を引き継ぐ
    if (previousMonthTarget) {
      return {
        year: selectedYear,
        month: selectedMonth,
        staffSalaries: previousMonthTarget.staffSalaries.map((s) => ({ ...s })),
        fixedCostItems: previousMonthTarget.fixedCostItems.map((f) => ({ ...f, id: `item-${Date.now()}-${Math.random()}` })),
        variableCostItems: previousMonthTarget.variableCostItems.map((v) => ({ ...v, id: `item-${Date.now()}-${Math.random()}` })),
        totalFixedCost: previousMonthTarget.totalFixedCost || 0,
        totalVariableCost: previousMonthTarget.totalVariableCost || 0,
        targetRevenue: previousMonthTarget.targetRevenue || 0,
        targetOccupancyRate: previousMonthTarget.targetOccupancyRate || 0,
        dailyPricePerChild: previousMonthTarget.dailyPricePerChild || 0,
      };
    }

    // デフォルト値
    return {
      year: selectedYear,
      month: selectedMonth,
      staffSalaries: [],
      fixedCostItems: [],
      variableCostItems: [],
      totalFixedCost: 0,
      totalVariableCost: 0,
      targetRevenue: 0,
      targetOccupancyRate: 0,
      dailyPricePerChild: 0,
    };
  }, [selectedYear, selectedMonth, currentTarget, previousMonthTarget]);

  const [formData, setFormData] = useState<ManagementTargetFormData>(getInitialForm());

  // 選択された月が変更されたらフォームを更新
  useEffect(() => {
    setFormData(getInitialForm());
  }, [selectedYear, selectedMonth, currentTarget, previousMonthTarget, getInitialForm]);

  // コスト合計を自動計算
  useEffect(() => {
    // 人件費合計
    const staffSalaryTotal = formData.staffSalaries.reduce((sum, s) => sum + s.totalAmount, 0);
    
    // 固定費合計
    const fixedCostTotal = formData.fixedCostItems.reduce((sum, f) => sum + f.amount, 0);
    
    // 変動費合計
    const variableCostTotal = formData.variableCostItems.reduce((sum, v) => sum + v.amount, 0);

    setFormData((prev) => ({
      ...prev,
      totalFixedCost: staffSalaryTotal + fixedCostTotal,
      totalVariableCost: variableCostTotal,
    }));
  }, [formData.staffSalaries, formData.fixedCostItems, formData.variableCostItems]);

  // スタッフの給与を更新
  const updateStaffSalary = (staffId: string, updates: Partial<StaffSalary>) => {
    setFormData((prev) => {
      const salaries = prev.staffSalaries.map((s) =>
        s.staffId === staffId ? { ...s, ...updates } : s
      );
      
      // 合計金額を再計算
      const updatedSalaries = salaries.map((s) => {
        if (s.staffId === staffId) {
          const total = s.monthlySalary || (s.hourlyWage && s.workingHours ? s.hourlyWage * s.workingHours : 0);
          return { ...s, totalAmount: total || 0 };
        }
        return s;
      });
      
      return { ...prev, staffSalaries: updatedSalaries };
    });
  };

  // スタッフを追加
  const addStaffToSalaries = (staffId: string) => {
    const staffMember = staff.find((s) => s.id === staffId);
    if (!staffMember) return;

    const existing = formData.staffSalaries.find((s) => s.staffId === staffId);
    if (existing) return;

    const newSalary: StaffSalary = {
      staffId: staffMember.id,
      staffName: staffMember.name,
      monthlySalary: staffMember.monthlySalary || 0,
      hourlyWage: staffMember.hourlyWage || 0,
      workingHours: 0,
      totalAmount: staffMember.monthlySalary || 0,
    };

    setFormData((prev) => ({
      ...prev,
      staffSalaries: [...prev.staffSalaries, newSalary],
    }));
  };

  // 固定費項目を追加
  const addFixedCostItem = () => {
    const newItem: FixedCostItem = {
      id: `fixed-${Date.now()}`,
      category: '',
      name: '',
      amount: 0,
      memo: '',
    };
    setFormData((prev) => ({
      ...prev,
      fixedCostItems: [...prev.fixedCostItems, newItem],
    }));
  };

  // 固定費項目を更新
  const updateFixedCostItem = (id: string, updates: Partial<FixedCostItem>) => {
    setFormData((prev) => ({
      ...prev,
      fixedCostItems: prev.fixedCostItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  };

  // 固定費項目を削除
  const removeFixedCostItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      fixedCostItems: prev.fixedCostItems.filter((item) => item.id !== id),
    }));
  };

  // 変動費項目を追加
  const addVariableCostItem = () => {
    const newItem: VariableCostItem = {
      id: `variable-${Date.now()}`,
      category: '',
      name: '',
      amount: 0,
      memo: '',
    };
    setFormData((prev) => ({
      ...prev,
      variableCostItems: [...prev.variableCostItems, newItem],
    }));
  };

  // 変動費項目を更新
  const updateVariableCostItem = (id: string, updates: Partial<VariableCostItem>) => {
    setFormData((prev) => ({
      ...prev,
      variableCostItems: prev.variableCostItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  };

  // 変動費項目を削除
  const removeVariableCostItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      variableCostItems: prev.variableCostItems.filter((item) => item.id !== id),
    }));
  };

  // 前月の設定を引き継ぐ
  const copyFromPreviousMonth = () => {
    if (previousMonthTarget) {
      setFormData({
        year: selectedYear,
        month: selectedMonth,
        staffSalaries: previousMonthTarget.staffSalaries.map((s) => ({ ...s })),
        fixedCostItems: previousMonthTarget.fixedCostItems.map((f) => ({
          ...f,
          id: `item-${Date.now()}-${Math.random()}`,
        })),
        variableCostItems: previousMonthTarget.variableCostItems.map((v) => ({
          ...v,
          id: `item-${Date.now()}-${Math.random()}`,
        })),
        totalFixedCost: previousMonthTarget.totalFixedCost || 0,
        totalVariableCost: previousMonthTarget.totalVariableCost || 0,
        targetRevenue: previousMonthTarget.targetRevenue || 0,
        targetOccupancyRate: previousMonthTarget.targetOccupancyRate || 0,
        dailyPricePerChild: previousMonthTarget.dailyPricePerChild || 0,
      });
      alert('前月の設定を引き継ぎました');
    }
  };

  // 保存
  const handleSave = async () => {
    try {
      console.log('💾 経営設定を保存中...', formData);
      if (currentTarget) {
        await updateManagementTarget(currentTarget.id, formData);
      } else {
        await addManagementTarget(formData);
      }
      alert('経営設定を保存しました');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('❌ 経営設定の保存エラー:', error);
      alert('経営設定の保存に失敗しました。もう一度お試しください。');
    }
  };

  // 削除
  const handleDelete = async () => {
    if (currentTarget && confirm('この月の経営設定を削除しますか？')) {
      await deleteManagementTarget(currentTarget.id);
      alert('経営設定を削除しました');
      setIsEditModalOpen(false);
    }
  };

  // 損益分岐点を計算
  const calculateBreakEvenPoint = () => {
    const { totalFixedCost, totalVariableCost, dailyPricePerChild } = formData;
    if (dailyPricePerChild === 0) return 0;
    // 損益分岐点 = 固定費 / (単価 - 変動費率)
    const contributionMargin = dailyPricePerChild - (totalVariableCost / 30); // 月30日と仮定
    if (contributionMargin <= 0) return 0;
    return Math.ceil(totalFixedCost / contributionMargin);
  };

  // 比較用の月を追加
  const addComparisonMonth = () => {
    if (comparisonMonths.length >= 3) {
      alert('比較できるのは最大3ヶ月までです');
      return;
    }
    setComparisonMonths([...comparisonMonths, { year: selectedYear, month: selectedMonth }]);
  };

  // 比較用の月を削除
  const removeComparisonMonth = (index: number) => {
    setComparisonMonths(comparisonMonths.filter((_, i) => i !== index));
  };

  // 過去の設定一覧
  const pastTargets = useMemo(() => {
    return managementTargets
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      })
      .slice(0, 24); // 直近24ヶ月
  }, [managementTargets]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <DollarSign size={24} className="mr-2 text-[#00c4cc]" />
              経営設定
            </h2>
            <p className="text-gray-500 text-xs mt-1">
              月ごとの経営目標、コスト設定を詳細に管理します。
            </p>
          </div>
        </div>
      </div>

      {/* 月選択とアクション */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-bold text-gray-700">設定する月を選択</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}月
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            {previousMonthTarget && !currentTarget && (
              <button
                onClick={copyFromPreviousMonth}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold flex items-center transition-colors"
              >
                <Copy size={16} className="mr-2" />
                前月を引き継ぐ
              </button>
            )}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-md text-sm font-bold flex items-center transition-colors"
            >
              {currentTarget ? '編集' : '新規設定'}
            </button>
          </div>
        </div>

        {/* 現在の設定表示 */}
        {currentTarget && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-bold text-blue-700 mb-3">
              {currentTarget.year}年{currentTarget.month}月の設定
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-gray-500 mb-1">固定費合計</div>
                <div className="font-bold text-gray-800 text-sm">¥{currentTarget.totalFixedCost.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">変動費合計</div>
                <div className="font-bold text-gray-800 text-sm">¥{currentTarget.totalVariableCost.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">売上目標</div>
                <div className="font-bold text-gray-800 text-sm">¥{currentTarget.targetRevenue.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">単価/日</div>
                <div className="font-bold text-gray-800 text-sm">¥{currentTarget.dailyPricePerChild.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 比較表示 */}
      {comparisonMonths.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <BarChart3 size={20} className="mr-2 text-[#00c4cc]" />
              月別比較
            </h3>
            <button
              onClick={addComparisonMonth}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-colors"
            >
              <Plus size={14} className="mr-1" />
              比較月を追加
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {comparisonMonths.map((month, index) => {
              const target = getManagementTarget(month.year, month.month);
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-gray-700">
                      {month.year}年{month.month}月
                    </div>
                    <button
                      onClick={() => removeComparisonMonth(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {target ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="text-gray-500">固定費</div>
                        <div className="font-bold text-gray-800">¥{target.totalFixedCost.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">変動費</div>
                        <div className="font-bold text-gray-800">¥{target.totalVariableCost.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">売上目標</div>
                        <div className="font-bold text-gray-800">¥{target.targetRevenue.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">単価/日</div>
                        <div className="font-bold text-gray-800">¥{target.dailyPricePerChild.toLocaleString()}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">設定なし</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 過去の設定一覧 */}
      {pastTargets.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">過去の設定一覧（直近24ヶ月）</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {pastTargets.map((target) => (
              <div
                key={target.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => {
                  setSelectedYear(target.year);
                  setSelectedMonth(target.month);
                  setIsEditModalOpen(true);
                }}
              >
                <div className="text-xs font-bold text-gray-700 mb-1">
                  {target.year}年{target.month}月
                </div>
                <div className="text-xs text-gray-600">
                  固定費: ¥{target.totalFixedCost.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">
                  売上目標: ¥{target.targetRevenue.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] shadow-2xl border border-gray-100 my-8">
            {/* ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">
                  {selectedYear}年{selectedMonth}月の経営設定
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* フォーム本体 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* 人件費設定 */}
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm text-gray-700 flex items-center">
                      <Users size={16} className="mr-2 text-[#00c4cc]" />
                      人件費設定
                    </h4>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addStaffToSalaries(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-[#00c4cc]"
                    >
                      <option value="">スタッフを追加</option>
                      {staff
                        .filter((s) => !formData.staffSalaries.find((sal) => sal.staffId === s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {formData.staffSalaries.map((salary) => {
                      const staffMember = staff.find((s) => s.id === salary.staffId);
                      return (
                        <div key={salary.staffId} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-bold text-sm text-gray-800">{salary.staffName}</div>
                            <button
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  staffSalaries: prev.staffSalaries.filter((s) => s.staffId !== salary.staffId),
                                }));
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {staffMember?.type === '常勤' ? (
                              <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">月給（円）</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={salary.monthlySalary || ''}
                                  onChange={(e) => {
                                    const monthlySalary = parseInt(e.target.value) || 0;
                                    updateStaffSalary(salary.staffId, {
                                      monthlySalary,
                                      totalAmount: monthlySalary,
                                    });
                                  }}
                                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                                />
                              </div>
                            ) : (
                              <>
                                <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">時給（円）</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={salary.hourlyWage || ''}
                                    onChange={(e) => {
                                      const hourlyWage = parseInt(e.target.value) || 0;
                                      const total = hourlyWage * (salary.workingHours || 0);
                                      updateStaffSalary(salary.staffId, { hourlyWage, totalAmount: total });
                                    }}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">月間労働時間</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={salary.workingHours || ''}
                                    onChange={(e) => {
                                      const workingHours = parseInt(e.target.value) || 0;
                                      const total = (salary.hourlyWage || 0) * workingHours;
                                      updateStaffSalary(salary.staffId, { workingHours, totalAmount: total });
                                    }}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                                  />
                                </div>
                              </>
                            )}
                            <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">合計（円）</label>
                              <div className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-gray-100 font-bold text-gray-800">
                                ¥{salary.totalAmount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {formData.staffSalaries.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">
                        スタッフを追加してください
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs font-bold text-gray-700">
                    人件費合計: ¥{formData.staffSalaries.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}
                  </div>
                </div>

                {/* 固定費項目 */}
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm text-gray-700 flex items-center">
                      <DollarSign size={16} className="mr-2 text-[#00c4cc]" />
                      固定費項目（家賃、光熱費など）
                    </h4>
                    <button
                      onClick={addFixedCostItem}
                      className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-colors"
                    >
                      <Plus size={14} className="mr-1" />
                      項目を追加
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.fixedCostItems.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">カテゴリ</label>
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) => updateFixedCostItem(item.id, { category: e.target.value })}
                              placeholder="例: 家賃"
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">項目名</label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateFixedCostItem(item.id, { name: e.target.value })}
                              placeholder="例: 事務所家賃"
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">金額（円）</label>
                            <input
                              type="number"
                              min="0"
                              value={item.amount || ''}
                              onChange={(e) => updateFixedCostItem(item.id, { amount: parseInt(e.target.value) || 0 })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={() => removeFixedCostItem(item.id)}
                              className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1">メモ</label>
                          <input
                            type="text"
                            value={item.memo || ''}
                            onChange={(e) => updateFixedCostItem(item.id, { memo: e.target.value })}
                            placeholder="メモを入力"
                            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                          />
                        </div>
                      </div>
                    ))}
                    {formData.fixedCostItems.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">
                        固定費項目を追加してください
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs font-bold text-gray-700">
                    固定費項目合計: ¥{formData.fixedCostItems.reduce((sum, f) => sum + f.amount, 0).toLocaleString()}
                  </div>
                </div>

                {/* 変動費項目 */}
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm text-gray-700 flex items-center">
                      <TrendingUp size={16} className="mr-2 text-[#00c4cc]" />
                      変動費項目（材料費、消耗品費など）
                    </h4>
                    <button
                      onClick={addVariableCostItem}
                      className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-colors"
                    >
                      <Plus size={14} className="mr-1" />
                      項目を追加
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.variableCostItems.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">カテゴリ</label>
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) => updateVariableCostItem(item.id, { category: e.target.value })}
                              placeholder="例: 材料費"
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">項目名</label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateVariableCostItem(item.id, { name: e.target.value })}
                              placeholder="例: 教材費"
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">金額（円）</label>
                            <input
                              type="number"
                              min="0"
                              value={item.amount || ''}
                              onChange={(e) => updateVariableCostItem(item.id, { amount: parseInt(e.target.value) || 0 })}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={() => removeVariableCostItem(item.id)}
                              className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs font-bold text-gray-500 mb-1">メモ</label>
                          <input
                            type="text"
                            value={item.memo || ''}
                            onChange={(e) => updateVariableCostItem(item.id, { memo: e.target.value })}
                            placeholder="メモを入力"
                            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                          />
                        </div>
                      </div>
                    ))}
                    {formData.variableCostItems.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">
                        変動費項目を追加してください
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs font-bold text-gray-700">
                    変動費項目合計: ¥{formData.variableCostItems.reduce((sum, v) => sum + v.amount, 0).toLocaleString()}
                  </div>
                </div>

                {/* コスト合計 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs font-bold text-blue-700 mb-1">固定費合計</div>
                      <div className="text-lg font-bold text-blue-800">
                        ¥{formData.totalFixedCost.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-700 mb-1">変動費合計</div>
                      <div className="text-lg font-bold text-blue-800">
                        ¥{formData.totalVariableCost.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {formData.dailyPricePerChild > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <div className="text-xs font-bold text-blue-700 mb-1">損益分岐点（概算）</div>
                      <div className="text-sm font-bold text-blue-800">
                        約 {calculateBreakEvenPoint()} 人日/月
                      </div>
                    </div>
                  )}
                </div>

                {/* 目標設定 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4 flex items-center">
                    <Target size={16} className="mr-2 text-[#00c4cc]" />
                    目標設定
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        売上目標（円/月）
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.targetRevenue || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, targetRevenue: parseInt(e.target.value) || 0 })
                        }
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                        placeholder="例: 1000000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        稼働率目標（%）
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.targetOccupancyRate || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, targetOccupancyRate: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                        placeholder="例: 90"
                      />
                    </div>
                  </div>
                </div>

                {/* 単価設定 */}
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-4 flex items-center">
                    <TrendingUp size={16} className="mr-2 text-[#00c4cc]" />
                    単価設定
                  </h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                      児童一人当たりの1日あたりの単価（円/日）
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.dailyPricePerChild || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, dailyPricePerChild: parseInt(e.target.value) || 0 })
                      }
                      className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                      placeholder="例: 15000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      運営体制によって変動するため、月ごとに設定してください。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center">
              {currentTarget && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-bold transition-colors"
                >
                  削除
                </button>
              )}
              <div className="flex space-x-3 ml-auto">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-bold transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold shadow-md transition-colors flex items-center"
                >
                  <Save size={16} className="mr-2" />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementSettingsView;



