/**
 * 経営ダッシュボードビュー
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Target,
  BarChart3,
  MapPin,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Car,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import {
  calculateWeeklyRevenue,
  calculateSlotStatistics,
  calculateLeadProgress,
  calculateContractTrend,
  calculateAgeDistribution,
  calculateAreaDistribution,
  calculateMonthlyProfit,
  calculateOccupancyRate,
  calculateARPU,
  calculateLaborRatio,
  calculatePickupDropoffRate,
  calculateInquiriesBySource,
  calculateDayOfWeekUtilization,
  calculateAMPMOccupancyRate,
} from '@/utils/dashboardCalculations';
import { calculateMonthlyUtilizationForecast, MonthlyUtilizationForecast } from '@/utils/utilizationForecast';
import { calculateBusinessDays } from '@/utils/dashboardCalculations';
import { getJapaneseHolidays, isJapaneseHoliday } from '@/utils/japaneseHolidays';

const DashboardView: React.FC = () => {
  const {
    schedules,
    usageRecords,
    children,
    leads,
    facilitySettings,
    staff,
    managementTargets,
    getManagementTarget,
  } = useFacilityData();

  const [viewPeriod, setViewPeriod] = useState<'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isContractTrendExpanded, setIsContractTrendExpanded] = useState(false);
  const [selectedForecastMonth, setSelectedForecastMonth] = useState<{ year: number; month: number } | null>(null);
  const [forecastDetailView, setForecastDetailView] = useState<'week' | 'day'>('week');

  // 前月の日付を計算
  const previousMonth = useMemo(() => {
    const prev = new Date(currentDate);
    prev.setMonth(prev.getMonth() - 1);
    return prev;
  }, [currentDate]);

  // 当月の経営目標を取得
  const currentManagementTarget = useMemo(() => {
    return getManagementTarget(currentDate.getFullYear(), currentDate.getMonth() + 1);
  }, [getManagementTarget, currentDate]);

  // 経営目標を使用した計算（未設定の場合はnull）
  const targetRevenue = currentManagementTarget?.targetRevenue || null;
  const targetOccupancyRate = currentManagementTarget?.targetOccupancyRate || null;
  const dailyPricePerChild = currentManagementTarget?.dailyPricePerChild || 15000; // デフォルト値（単価は必須）

  // 週別見込み売り上げ（経営設定の単価を使用）
  const weeklyRevenue = useMemo(
    () => calculateWeeklyRevenue(schedules, usageRecords, currentDate, dailyPricePerChild),
    [schedules, usageRecords, currentDate, dailyPricePerChild]
  );

  // 利用枠統計
  const slotStats = useMemo(
    () => calculateSlotStatistics(schedules, usageRecords, facilitySettings.capacity, currentDate),
    [schedules, usageRecords, facilitySettings.capacity, currentDate]
  );

  // リード進捗
  const leadProgress = useMemo(
    () => calculateLeadProgress(leads, currentDate, previousMonth),
    [leads, currentDate, previousMonth]
  );

  // 契約数推移
  const contractTrend = useMemo(
    () => calculateContractTrend(children, leads, 6),
    [children, leads]
  );

  // 問い合わせ経路別の新規問い合わせ数
  const inquiriesBySource = useMemo(
    () => calculateInquiriesBySource(children, leads, 6),
    [children, leads]
  );

  // 送迎利用率
  const pickupDropoffRate = useMemo(
    () => calculatePickupDropoffRate(schedules, currentDate),
    [schedules, currentDate]
  );

  // 曜日別利用率
  const dayOfWeekUtilization = useMemo(
    () => calculateDayOfWeekUtilization(schedules, facilitySettings.capacity, currentDate),
    [schedules, facilitySettings.capacity, currentDate]
  );

  // 午前・午後の稼働率
  const ampmOccupancyRate = useMemo(
    () => calculateAMPMOccupancyRate(schedules, facilitySettings.capacity, facilitySettings, currentDate),
    [schedules, facilitySettings, currentDate]
  );

  // 年齢別利用児童
  const ageDistribution = useMemo(
    () => calculateAgeDistribution(children, schedules, currentDate),
    [children, schedules, currentDate]
  );

  // 居住地区別利用児童
  const areaDistribution = useMemo(
    () => calculateAreaDistribution(children, schedules, currentDate),
    [children, schedules, currentDate]
  );

  // 稼働率
  const occupancyRate = useMemo(
    () => calculateOccupancyRate(schedules, facilitySettings.capacity, facilitySettings, currentDate),
    [schedules, facilitySettings, currentDate]
  );

  // 月次利益（経営設定の単価を使用）
  const monthlyProfit = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthlyRecords = usageRecords.filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate.getFullYear() === year && recordDate.getMonth() === month;
    });

    const actualProfit = monthlyRecords
      .filter((r) => r.serviceStatus === '利用' && r.billingTarget === '請求する')
      .length * dailyPricePerChild;

    return {
      profit: actualProfit,
      target: targetRevenue || 0,
      achievementRate: targetRevenue !== null && targetRevenue > 0 ? (actualProfit / targetRevenue) * 100 : 0,
    };
  }, [usageRecords, currentDate, dailyPricePerChild, targetRevenue]);

  // ARPU
  const arpu = useMemo(
    () => calculateARPU(usageRecords, children, currentDate),
    [usageRecords, children, currentDate]
  );

  // 人件費率
  const laborRatio = useMemo(
    () => calculateLaborRatio(staff, usageRecords, currentDate),
    [staff, usageRecords, currentDate]
  );

  // 利用見込み計算（現在の月）
  const utilizationForecast = useMemo(
    () => calculateMonthlyUtilizationForecast(children, facilitySettings, currentDate.getFullYear(), currentDate.getMonth()),
    [children, facilitySettings, currentDate]
  );

  // 選択された月の利用見込み詳細
  const selectedForecast = useMemo(() => {
    if (!selectedForecastMonth) return null;
    return calculateMonthlyUtilizationForecast(
      children,
      facilitySettings,
      selectedForecastMonth.year,
      selectedForecastMonth.month
    );
  }, [children, facilitySettings, selectedForecastMonth]);

  // 当月の総見込み売り上げ
  const totalMonthlyRevenue = useMemo(() => {
    return weeklyRevenue.reduce((sum, week) => sum + week.revenue, 0);
  }, [weeklyRevenue]);

  // 月を変更
  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">経営ダッシュボード</h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            経営指標を週単位・月単位で確認できます。
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 sm:gap-4">
          <div className="flex bg-gray-100 p-1 rounded">
            <button
              onClick={() => setViewPeriod('week')}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded transition-all ${
                viewPeriod === 'week'
                  ? 'bg-white text-[#00c4cc] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              週単位
            </button>
            <button
              onClick={() => setViewPeriod('month')}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded transition-all ${
                viewPeriod === 'month'
                  ? 'bg-white text-[#00c4cc] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              月単位
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => changeMonth(-1)}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm sm:text-base"
            >
              ←
            </button>
            <span className="text-xs sm:text-sm font-bold text-gray-800 min-w-[100px] sm:min-w-[120px] text-center">
              {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm sm:text-base"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* 主要指標カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* 当月見込み売り上げ */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs sm:text-sm font-bold text-gray-500">当月見込み売り上げ</div>
            <DollarSign size={16} className="text-[#00c4cc] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-800">
            ¥{totalMonthlyRevenue.toLocaleString()}
          </div>
          <div className="text-xs sm:text-sm text-gray-500 mt-1 leading-tight">
            目標: {targetRevenue !== null ? `¥${targetRevenue.toLocaleString()}` : '未設定'}
            {targetRevenue !== null && (
              <> / 達成率: {((totalMonthlyRevenue / targetRevenue) * 100).toFixed(1)}%</>
            )}
          </div>
          {targetRevenue !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-[#00c4cc] h-2 rounded-full transition-all"
                style={{ width: `${Math.min((totalMonthlyRevenue / targetRevenue) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* 稼働率 */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs sm:text-sm font-bold text-gray-500">稼働率</div>
            <BarChart3 size={16} className="text-[#00c4cc] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-800">
            {occupancyRate.rate.toFixed(1)}%
          </div>
          <div className="text-xs sm:text-sm text-gray-500 mt-1 leading-tight">
            目標: {targetOccupancyRate !== null ? `${targetOccupancyRate}%` : '未設定'}
          </div>
          {targetOccupancyRate !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  occupancyRate.rate >= targetOccupancyRate
                    ? 'bg-green-500'
                    : occupancyRate.rate >= targetOccupancyRate * 0.8
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(occupancyRate.rate, 100)}%` }}
              />
            </div>
          )}
          <div className="mt-2 text-xs sm:text-sm text-gray-600 leading-tight">
            <div>午前: {ampmOccupancyRate.amRate.toFixed(1)}% ({ampmOccupancyRate.amCount}/{ampmOccupancyRate.amCapacity})</div>
            <div>午後: {ampmOccupancyRate.pmRate.toFixed(1)}% ({ampmOccupancyRate.pmCount}/{ampmOccupancyRate.pmCapacity})</div>
          </div>
        </div>

        {/* キャンセル率 */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs sm:text-sm font-bold text-gray-500">キャンセル率</div>
            <AlertCircle size={16} className="text-[#00c4cc] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-800">
            {slotStats.cancellationRate.toFixed(1)}%
          </div>
          <div className="text-xs sm:text-sm text-gray-500 mt-1 leading-tight">
            キャンセル数: {slotStats.cancelledSlots}件
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full transition-all ${
                slotStats.cancellationRate > 20
                  ? 'bg-red-500'
                  : slotStats.cancellationRate > 10
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(slotStats.cancellationRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 利用見込み */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
          <Target size={18} className="sm:w-5 sm:h-5 mr-2 text-[#00c4cc] shrink-0" />
          利用見込み（月別）
        </h3>
        <div className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-xs font-bold text-blue-700 mb-1">予測埋まり枠数</div>
              <div className="text-2xl font-bold text-blue-800">
                {utilizationForecast.forecastedSlots}枠
              </div>
              <div className="text-xs text-gray-600 mt-1">
                総枠数: {utilizationForecast.totalSlots}枠
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-xs font-bold text-green-700 mb-1">稼働率</div>
              <div className="text-2xl font-bold text-green-800">
                {utilizationForecast.utilizationRate.toFixed(1)}%
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-xs font-bold text-purple-700 mb-1">対象児童数</div>
              <div className="text-2xl font-bold text-purple-800">
                {children.filter(c => {
                  const startDate = c.contractStatus === 'pre-contract' 
                    ? c.plannedUsageStartDate 
                    : c.contractStartDate;
                  if (!startDate) return false;
                  const start = new Date(startDate + 'T00:00:00');
                  const current = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                  return start <= current;
                }).length}名
              </div>
            </div>
          </div>
          
          {/* 予測埋まり枠数の内訳 */}
          <div className="mb-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">予測埋まり枠数の内訳</h4>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-3">
              <div className="text-xs font-bold text-gray-500 mb-1">予測埋まり枠数</div>
              <div className="text-2xl font-bold text-gray-800 mb-3">
                {utilizationForecast.forecastedSlots}枠
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <div className="text-xs font-bold text-orange-700 mb-1">実際の予約枠</div>
                  <div className="text-xl font-bold text-orange-800">
                    {schedules.filter(s => {
                      const scheduleDate = new Date(s.date);
                      return scheduleDate.getFullYear() === currentDate.getFullYear() &&
                             scheduleDate.getMonth() === currentDate.getMonth();
                    }).length}枠
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    既に予約されている枠数
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs font-bold text-blue-700 mb-1">利用予定枠（見込み）</div>
                  <div className="text-xl font-bold text-blue-800">
                    {Math.max(0, utilizationForecast.forecastedSlots - schedules.filter(s => {
                      const scheduleDate = new Date(s.date);
                      return scheduleDate.getFullYear() === currentDate.getFullYear() &&
                             scheduleDate.getMonth() === currentDate.getMonth();
                    }).length)}枠
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    児童登録情報から算出（予約未確定分）
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 曜日別稼働率 */}
          <div className="mb-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">曜日別稼働率</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-600">曜日</th>
                    <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">午前</th>
                    <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">午後</th>
                    <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {utilizationForecast.dayOfWeekBreakdown.map((day) => {
                    // その月の実際の営業日数を計算（曜日別）
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    
                    // その曜日が定休日かどうかを判定（祝日は考慮しない）
                    let isRegularHoliday = false;
                    
                    // 期間ごとの定休日を確認
                    if (facilitySettings.holidayPeriods) {
                      for (const period of facilitySettings.holidayPeriods) {
                        const periodStart = new Date(period.startDate);
                        const periodEnd = period.endDate ? new Date(period.endDate) : new Date(9999, 11, 31);
                        const monthStart = new Date(year, month, 1);
                        const monthEnd = new Date(year, month + 1, 0);
                        
                        // 期間がその月と重なっているか確認
                        if (periodStart <= monthEnd && periodEnd >= monthStart) {
                          if (period.regularHolidays.includes(day.dayIndex)) {
                            isRegularHoliday = true;
                            break;
                          }
                        }
                      }
                    }
                    
                    // 期間に該当しない場合はデフォルトの定休日を確認
                    if (!isRegularHoliday && facilitySettings.regularHolidays.includes(day.dayIndex)) {
                      isRegularHoliday = true;
                    }
                    
                    let dayOccurrences = 0;
                    for (let d = 1; d <= daysInMonth; d++) {
                      const date = new Date(year, month, d);
                      const dayOfWeek = date.getDay();
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      
                      if (dayOfWeek !== day.dayIndex) continue;
                      
                      // 定休日の場合はスキップ
                      if (isRegularHoliday) continue;
                      
                      // 祝日チェック（定休日でない場合のみ）
                      if (facilitySettings.includeHolidays) {
                        const holidays = getJapaneseHolidays(year);
                        if (holidays.includes(dateStr) || isJapaneseHoliday(dateStr)) {
                          continue; // 祝日は営業日数から除外するが、曜日自体は休業日ではない
                        }
                      }
                      
                      // カスタム休業日を確認
                      if (facilitySettings.customHolidays.includes(dateStr)) {
                        continue; // カスタム休業日も営業日数から除外するが、曜日自体は休業日ではない
                      }
                      
                      dayOccurrences++;
                    }
                    
                    const amCapacity = dayOccurrences * facilitySettings.capacity.AM;
                    const pmCapacity = dayOccurrences * facilitySettings.capacity.PM;
                    const amRate = amCapacity > 0 ? (day.amSlots / amCapacity) * 100 : 0;
                    const pmRate = pmCapacity > 0 ? (day.pmSlots / pmCapacity) * 100 : 0;
                    const totalRate = (amCapacity + pmCapacity) > 0 
                      ? (day.totalSlots / (amCapacity + pmCapacity)) * 100 
                      : 0;
                    
                    return (
                      <tr 
                        key={day.dayIndex} 
                        className={`border-b border-gray-100 ${isRegularHoliday ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-2 px-3 font-bold text-gray-800">
                          {day.dayOfWeek}
                          {isRegularHoliday && (
                            <span className="ml-2 text-xs text-red-600 font-normal">（休業日）</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isRegularHoliday ? (
                            <div className="text-sm text-red-600 italic">休業日</div>
                          ) : (
                            <div className="text-sm font-bold text-gray-800">
                              {day.amSlots}枠 / {amCapacity}枠 ({amRate.toFixed(1)}%)
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isRegularHoliday ? (
                            <div className="text-sm text-red-600 italic">休業日</div>
                          ) : (
                            <div className="text-sm font-bold text-gray-800">
                              {day.pmSlots}枠 / {pmCapacity}枠 ({pmRate.toFixed(1)}%)
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isRegularHoliday ? (
                            <div className="text-sm text-red-600 italic">休業日</div>
                          ) : (
                            <div className="text-sm font-bold text-[#00c4cc]">
                              {day.totalSlots}枠 / {amCapacity + pmCapacity}枠 ({totalRate.toFixed(1)}%)
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* 月をクリックして詳細を見る */}
          <button
            onClick={() => setSelectedForecastMonth({
              year: currentDate.getFullYear(),
              month: currentDate.getMonth(),
            })}
            className="w-full px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Calendar size={16} />
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月の詳細を見る
          </button>
        </div>
      </div>

      {/* 週別見込み売り上げ */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
          <TrendingUp size={18} className="sm:w-5 sm:h-5 mr-2 text-[#00c4cc] shrink-0" />
          週別見込み売り上げ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {weeklyRevenue.map((week) => (
            <div
              key={week.week}
              className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200"
            >
              <div className="text-xs sm:text-sm font-bold text-gray-500 mb-2 leading-tight">
                {week.week}週目
              </div>
              <div className="text-lg sm:text-xl font-bold text-gray-800 mb-1 leading-tight">
                ¥{week.revenue.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 leading-tight">
                予定: {week.scheduledCount} / 実績: {week.actualCount}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* リード管理進捗 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
          <Target size={18} className="sm:w-5 sm:h-5 mr-2 text-[#00c4cc] shrink-0" />
          リード管理進捗（当月新規）
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 sm:gap-4">
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
            <div className="text-xs sm:text-sm font-bold text-blue-700 mb-1 leading-tight">新規問い合わせ</div>
            <div className="text-xl sm:text-2xl font-bold text-blue-800 leading-tight">{leadProgress.current.newInquiries}</div>
            {leadProgress.previous && (
              <div className="flex items-center text-xs mt-1">
                {leadProgress.trends.newInquiries >= 0 ? (
                  <ArrowUp size={12} className="text-green-600 mr-1" />
                ) : (
                  <ArrowDown size={12} className="text-red-600 mr-1" />
                )}
                <span className={leadProgress.trends.newInquiries >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {leadProgress.trends.newInquiries >= 0 ? '+' : ''}{leadProgress.trends.newInquiries.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 sm:p-4 border border-yellow-200">
            <div className="text-xs sm:text-sm font-bold text-yellow-700 mb-1 leading-tight">見学/面談予定</div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-800 leading-tight">{leadProgress.current.visits}</div>
            {leadProgress.previous && (
              <div className="flex items-center text-xs mt-1">
                {leadProgress.trends.visits >= 0 ? (
                  <ArrowUp size={12} className="text-green-600 mr-1" />
                ) : (
                  <ArrowDown size={12} className="text-red-600 mr-1" />
                )}
                <span className={leadProgress.trends.visits >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {leadProgress.trends.visits >= 0 ? '+' : ''}{leadProgress.trends.visits.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="bg-orange-50 rounded-lg p-3 sm:p-4 border border-orange-200">
            <div className="text-xs sm:text-sm font-bold text-orange-700 mb-1 leading-tight">検討中</div>
            <div className="text-xl sm:text-2xl font-bold text-orange-800 leading-tight">{leadProgress.current.considering}</div>
            {leadProgress.previous && (
              <div className="flex items-center text-xs mt-1">
                {leadProgress.trends.considering >= 0 ? (
                  <ArrowUp size={12} className="text-green-600 mr-1" />
                ) : (
                  <ArrowDown size={12} className="text-red-600 mr-1" />
                )}
                <span className={leadProgress.trends.considering >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {leadProgress.trends.considering >= 0 ? '+' : ''}{leadProgress.trends.considering.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="bg-purple-50 rounded-lg p-3 sm:p-4 border border-purple-200">
            <div className="text-xs sm:text-sm font-bold text-purple-700 mb-1 leading-tight">受給者証待ち</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-800 leading-tight">{leadProgress.current.waitingBenefit}</div>
            {leadProgress.previous && (
              <div className="flex items-center text-xs mt-1">
                {leadProgress.trends.waitingBenefit >= 0 ? (
                  <ArrowUp size={12} className="text-green-600 mr-1" />
                ) : (
                  <ArrowDown size={12} className="text-red-600 mr-1" />
                )}
                <span className={leadProgress.trends.waitingBenefit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {leadProgress.trends.waitingBenefit >= 0 ? '+' : ''}{leadProgress.trends.waitingBenefit.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 sm:p-4 border border-indigo-200">
            <div className="text-xs sm:text-sm font-bold text-indigo-700 mb-1 leading-tight">契約進行中</div>
            <div className="text-xl sm:text-2xl font-bold text-indigo-800 leading-tight">{leadProgress.current.contractProgress}</div>
            {leadProgress.previous && (
              <div className="flex items-center text-xs mt-1">
                {leadProgress.trends.contractProgress >= 0 ? (
                  <ArrowUp size={12} className="text-green-600 mr-1" />
                ) : (
                  <ArrowDown size={12} className="text-red-600 mr-1" />
                )}
                <span className={leadProgress.trends.contractProgress >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {leadProgress.trends.contractProgress >= 0 ? '+' : ''}{leadProgress.trends.contractProgress.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200">
            <div className="text-xs sm:text-sm font-bold text-green-700 mb-1 leading-tight">契約済み</div>
            <div className="text-xl sm:text-2xl font-bold text-green-800 leading-tight">{leadProgress.current.contracts}</div>
            {leadProgress.previous && (
              <div className="flex items-center text-xs mt-1">
                {leadProgress.trends.contracts >= 0 ? (
                  <ArrowUp size={12} className="text-green-600 mr-1" />
                ) : (
                  <ArrowDown size={12} className="text-red-600 mr-1" />
                )}
                <span className={leadProgress.trends.contracts >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {leadProgress.trends.contracts >= 0 ? '+' : ''}{leadProgress.trends.contracts.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="bg-red-50 rounded-lg p-3 sm:p-4 border border-red-200">
            <div className="text-xs sm:text-sm font-bold text-red-700 mb-1 leading-tight">失注</div>
            <div className="text-xl sm:text-2xl font-bold text-red-800 leading-tight">{leadProgress.current.lost}</div>
            {leadProgress.previous && (
              <div className="flex items-center text-xs mt-1">
                {leadProgress.trends.lost >= 0 ? (
                  <ArrowUp size={12} className="text-green-600 mr-1" />
                ) : (
                  <ArrowDown size={12} className="text-red-600 mr-1" />
                )}
                <span className={leadProgress.trends.lost >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {leadProgress.trends.lost >= 0 ? '+' : ''}{leadProgress.trends.lost.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 契約数・問い合わせ数推移 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Users size={20} className="mr-2 text-[#00c4cc]" />
            契約数・問い合わせ数推移（過去6ヶ月）
          </h3>
          <button
            onClick={() => setIsContractTrendExpanded(!isContractTrendExpanded)}
            className="text-xs text-[#00c4cc] hover:text-[#00b0b8] font-bold flex items-center"
          >
            {isContractTrendExpanded ? (
              <>
                <ChevronUp size={14} className="mr-1" />
                折りたたむ
              </>
            ) : (
              <>
                <ChevronDown size={14} className="mr-1" />
                展開する
              </>
            )}
          </button>
        </div>
        <div className={`grid gap-4 transition-all ${isContractTrendExpanded ? 'grid-cols-1 md:grid-cols-6' : 'grid-cols-1 md:grid-cols-3'}`}>
          {(isContractTrendExpanded ? inquiriesBySource : inquiriesBySource.slice(-3)).map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-xs font-bold text-gray-500 mb-2">{item.month}</div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-2">
                <div className="text-xs text-blue-700 mb-1">契約数</div>
                <div className="text-xl font-bold text-blue-800">{item.contracts}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200 mb-2">
                <div className="text-xs text-green-700 mb-1">新規問い合わせ</div>
                <div className="text-xl font-bold text-green-800">{item.inquiries.total}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-200 text-xs">
                <div className="text-gray-600 mb-1">問い合わせ経路別</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>発達ナビ:</span>
                    <span className="font-bold">{item.inquiries.devnavi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HP:</span>
                    <span className="font-bold">{item.inquiries.homepage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>相談支援:</span>
                    <span className="font-bold">{item.inquiries['support-office']}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>その他:</span>
                    <span className="font-bold">{item.inquiries.other}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 送迎利用率 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <Car size={20} className="mr-2 text-[#00c4cc]" />
          送迎利用率
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-xs font-bold text-blue-700 mb-1">お迎え利用率</div>
            <div className="text-2xl font-bold text-blue-800">
              {pickupDropoffRate.pickupRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {pickupDropoffRate.pickupCount}件 / {pickupDropoffRate.totalSchedules}件
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-xs font-bold text-green-700 mb-1">お送り利用率</div>
            <div className="text-2xl font-bold text-green-800">
              {pickupDropoffRate.dropoffRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {pickupDropoffRate.dropoffCount}件 / {pickupDropoffRate.totalSchedules}件
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-xs font-bold text-purple-700 mb-1">両方利用</div>
            <div className="text-2xl font-bold text-purple-800">
              {pickupDropoffRate.bothRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {pickupDropoffRate.bothCount}件 / {pickupDropoffRate.totalSchedules}件
            </div>
          </div>
        </div>
      </div>

      {/* 曜日別利用率 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <Calendar size={20} className="mr-2 text-[#00c4cc]" />
          曜日別利用率
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-bold text-gray-600">曜日</th>
                <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">午前</th>
                <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">午後</th>
                <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">合計利用率</th>
              </tr>
            </thead>
            <tbody>
              {dayOfWeekUtilization.map((day) => (
                <tr key={day.dayIndex} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-bold text-gray-800">{day.dayOfWeek}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="text-sm font-bold text-gray-800">
                      {day.amUtilization.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {day.amCount}件
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="text-sm font-bold text-gray-800">
                      {day.pmUtilization.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {day.pmCount}件
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="text-sm font-bold text-[#00c4cc]">
                      {day.totalUtilization.toFixed(1)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 年齢別・地区別利用児童 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 年齢別利用児童 */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Users size={20} className="mr-2 text-[#00c4cc]" />
            年齢別利用児童
          </h3>
          <div className="space-y-3">
            {ageDistribution.map((item) => (
              <div key={item.age}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-gray-700">{item.age}</span>
                  <span className="text-sm font-bold text-gray-800">
                    {item.count}名 ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#00c4cc] h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 居住地区別利用児童 */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <MapPin size={20} className="mr-2 text-[#00c4cc]" />
            利用児童の居住地区
          </h3>
          <div className="space-y-3">
            {areaDistribution.slice(0, 10).map((item) => (
              <div key={item.area}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-gray-700">{item.area}</span>
                  <span className="text-sm font-bold text-gray-800">
                    {item.count}名 ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#00c4cc] h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* その他の経営指標 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs font-bold text-gray-500 mb-2">平均単価（ARPU）</div>
          <div className="text-2xl font-bold text-gray-800">
            ¥{arpu.arpu.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">目標: ¥{arpu.target.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs font-bold text-gray-500 mb-2">人件費率（L/R比）</div>
          <div className="text-2xl font-bold text-gray-800">
            {laborRatio.ratio.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">目標: {laborRatio.target}%</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs font-bold text-gray-500 mb-2">アクティブ児童数</div>
          <div className="text-2xl font-bold text-gray-800">
            {children.filter((c) => c.contractStatus === 'active').length}名
          </div>
          <div className="text-xs text-gray-500 mt-1">
            総児童数: {children.length}名
          </div>
        </div>
      </div>

      {/* 利用見込み詳細モーダル */}
      {selectedForecastMonth && selectedForecast && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                {selectedForecastMonth.year}年{selectedForecastMonth.month + 1}月 利用見込み詳細
              </h3>
              <button
                onClick={() => setSelectedForecastMonth(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setForecastDetailView('week')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                    forecastDetailView === 'week'
                      ? 'bg-[#00c4cc] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  週別
                </button>
                <button
                  onClick={() => setForecastDetailView('day')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                    forecastDetailView === 'day'
                      ? 'bg-[#00c4cc] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  日別
                </button>
              </div>
              
              {forecastDetailView === 'week' ? (
                <div className="space-y-4">
                  {selectedForecast.weeklyBreakdown.map((week) => (
                    <div key={week.week} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-800">
                          第{week.week}週 ({week.startDate} ～ {week.endDate})
                        </h4>
                        <div className="text-sm text-gray-600">
                          午前: {week.amSlots}枠 / 午後: {week.pmSlots}枠 / 合計: {week.totalSlots}枠
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-xs font-bold text-gray-500 mb-2">対象児童</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {week.children.map((child) => (
                            <div key={child.childId} className="bg-gray-50 rounded p-2 text-sm">
                              <div className="font-bold text-gray-800">{child.childName}</div>
                              <div className="text-xs text-gray-600">{child.days}日</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedForecast.dailyBreakdown.map((day) => (
                    <div key={day.date} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-gray-800">
                          {day.date} ({day.dayOfWeek})
                        </div>
                        <div className="text-sm text-gray-600">
                          午前: {day.amSlots}枠 / 午後: {day.pmSlots}枠 / 合計: {day.totalSlots}枠
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-bold text-gray-500 mb-1">対象児童</div>
                        <div className="flex flex-wrap gap-2">
                          {day.children.map((child, idx) => (
                            <div key={`${child.childId}-${idx}`} className="bg-gray-50 rounded px-2 py-1 text-xs">
                              <span className="font-bold text-gray-800">{child.childName}</span>
                              <span className="text-gray-600 ml-1">({child.timeSlot})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;

