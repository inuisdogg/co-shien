/**
 * 経営ダッシュボードビュー
 * 売上見込み・加算最適化・詳細分析機能を統合
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Target,
  BarChart3,
  MapPin,
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Car,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  Clock,
  UserCheck,
  ExternalLink,
  Shield,
  Sun,
  Sunset,
} from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
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
import { calculateBusinessDays } from '@/utils/dashboardCalculations';
import { getJapaneseHolidays, isJapaneseHoliday } from '@/utils/japaneseHolidays';
import { runDeductionCheck, type DeductionCheckResult } from '@/lib/deductionEngine';
import { checkQualificationExpiry, type QualificationCheckResult } from '@/lib/qualificationTracker';
import ComplianceManagement from './ComplianceManagement';

const DashboardView: React.FC = () => {
  const { facility } = useAuth();
  const {
    schedules,
    usageRecords,
    children,
    leads,
    facilitySettings,
    staff,
    managementTargets,
    getManagementTarget,
    timeSlots,
    loadingTimeSlots,
  } = useFacilityData();

  // 時間枠が設定されているかチェック
  const hasTimeSlots = timeSlots.length > 0;

  // 時間枠の名前と定員を取得
  const slotInfo = useMemo(() => {
    if (timeSlots.length >= 2) {
      const sorted = [...timeSlots].sort((a, b) => a.displayOrder - b.displayOrder);
      return {
        AM: { name: sorted[0]?.name || '午前', capacity: sorted[0]?.capacity || 0 },
        PM: { name: sorted[1]?.name || '午後', capacity: sorted[1]?.capacity || 0 },
        isConfigured: true,
      };
    } else if (timeSlots.length === 1) {
      return {
        AM: { name: timeSlots[0].name || '終日', capacity: timeSlots[0].capacity || 0 },
        PM: null,
        isConfigured: true,
      };
    }
    // 未設定
    return {
      AM: { name: '午前', capacity: 0 },
      PM: { name: '午後', capacity: 0 },
      isConfigured: false,
    };
  }, [timeSlots]);

  const [dashboardMode, setDashboardMode] = useState<'today' | 'operations' | 'compliance'>('today');
  const [isSalesDataExpanded, setIsSalesDataExpanded] = useState(false);
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

  // 利用見込み計算（MVP版では無効化）
  const utilizationForecast: null = null;

  // 選択された月の利用見込み詳細（MVP版では無効化）
  const selectedForecast: null = null;

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

  // ========== 本日タブ用のデータ ==========
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  // 減算リスク・資格期限チェック（async）
  const [deductionResult, setDeductionResult] = useState<DeductionCheckResult | null>(null);
  const [qualificationResult, setQualificationResult] = useState<QualificationCheckResult | null>(null);

  useEffect(() => {
    if (!facility?.id || dashboardMode !== 'today') return;
    const run = async () => {
      try {
        const [deduction, qualification] = await Promise.all([
          runDeductionCheck(facility.id, todayStr, Math.max(facilitySettings.capacity.AM, facilitySettings.capacity.PM)),
          checkQualificationExpiry(facility.id),
        ]);
        setDeductionResult(deduction);
        setQualificationResult(qualification);
      } catch (e) {
        // Silently ignore errors - alerts will simply not show
      }
    };
    run();
  }, [facility?.id, dashboardMode, todayStr, facilitySettings.capacity]);

  // 定員合計（午前・午後の大きい方を基準）
  const totalCapacity = useMemo(() => Math.max(facilitySettings.capacity.AM, facilitySettings.capacity.PM), [facilitySettings.capacity]);

  // 本日のスケジュール
  const todaySchedules = useMemo(() => {
    return schedules.filter((s) => s.date === todayStr);
  }, [schedules, todayStr]);

  const todayAMCount = useMemo(() => todaySchedules.filter((s) => s.slot === 'AM').length, [todaySchedules]);
  const todayPMCount = useMemo(() => todaySchedules.filter((s) => s.slot === 'PM').length, [todaySchedules]);
  const todayTotalCount = todaySchedules.length;

  // アクティブスタッフ数
  const activeStaffCount = useMemo(() => staff.length, [staff]);

  // 今週（月曜始まり）の日付を計算
  const thisWeekDates = useMemo(() => {
    const dayOfWeek = today.getDay(); // 0=日, 1=月, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const dates: { date: Date; dateStr: string; label: string; isToday: boolean }[] = [];
    const dayLabels = ['月', '火', '水', '木', '金'];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates.push({
        date: d,
        dateStr: ds,
        label: dayLabels[i],
        isToday: ds === todayStr,
      });
    }
    return dates;
  }, [today, todayStr]);

  // 今週の日別スケジュール集計
  const weeklyScheduleData = useMemo(() => {
    return thisWeekDates.map((day) => {
      const daySchedules = schedules.filter((s) => s.date === day.dateStr);
      const am = daySchedules.filter((s) => s.slot === 'AM').length;
      const pm = daySchedules.filter((s) => s.slot === 'PM').length;
      return { ...day, am, pm, total: daySchedules.length };
    });
  }, [thisWeekDates, schedules]);

  // アラートバナー用の集約
  const alertItems = useMemo(() => {
    const items: { text: string; level: 'critical' | 'warning' | 'info' }[] = [];
    if (deductionResult) {
      deductionResult.risks.forEach((risk) => {
        items.push({ text: risk.description, level: risk.level === 'critical' ? 'critical' : risk.level === 'warning' ? 'warning' : 'info' });
      });
    }
    if (qualificationResult) {
      if (qualificationResult.summary.expired > 0) {
        items.push({ text: `スタッフ資格が${qualificationResult.summary.expired}件期限切れです`, level: 'critical' });
      }
      if (qualificationResult.summary.urgentCount > 0) {
        items.push({ text: `スタッフ資格が${qualificationResult.summary.urgentCount}件30日以内に期限切れです`, level: 'warning' });
      }
    }
    return items;
  }, [deductionResult, qualificationResult]);

  // 対応が必要な項目
  const actionItems = useMemo(() => {
    const items: { label: string; detail: string; level: 'critical' | 'warning' | 'info' }[] = [];
    // 減算リスク
    if (deductionResult) {
      deductionResult.risks.forEach((risk) => {
        items.push({
          label: risk.name,
          detail: risk.details,
          level: risk.level === 'critical' ? 'critical' : risk.level === 'warning' ? 'warning' : 'info',
        });
      });
    }
    // 資格期限
    if (qualificationResult) {
      qualificationResult.alerts.slice(0, 3).forEach((alert) => {
        items.push({
          label: `${alert.staffName} - ${alert.qualificationName}`,
          detail: alert.daysUntilExpiry <= 0
            ? '期限切れ'
            : `あと${alert.daysUntilExpiry}日で期限切れ`,
          level: alert.level === 'expired' ? 'critical' : alert.level === 'urgent' ? 'warning' : 'info',
        });
      });
    }
    return items;
  }, [deductionResult, qualificationResult]);

  // 本日のフォーマット
  const todayFormatted = useMemo(() => {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${dayNames[today.getDay()]}）`;
  }, [today]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* メインタブ切り替え */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setDashboardMode('today')}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all ${
              dashboardMode === 'today'
                ? 'bg-gray-800 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock size={18} />
            本日
          </button>
          <button
            onClick={() => setDashboardMode('operations')}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all ${
              dashboardMode === 'operations'
                ? 'bg-gray-800 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 size={18} />
            月次分析
          </button>
          <button
            onClick={() => setDashboardMode('compliance')}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all ${
              dashboardMode === 'compliance'
                ? 'bg-gray-800 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText size={18} />
            コンプライアンス
          </button>
        </div>
      </div>


      {/* ========== 本日タブ ========== */}
      {dashboardMode === 'today' && (
        <>
          {/* Row 1: Alert Banner */}
          {alertItems.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-gray-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  {alertItems.map((item, i) => (
                    <p key={i} className="text-sm text-gray-700">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        item.level === 'critical' ? 'bg-gray-800' : item.level === 'warning' ? 'bg-gray-500' : 'bg-gray-300'
                      }`} />
                      {item.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 日付ヘッダー */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">{todayFormatted}</h2>
          </div>

          {/* Row 2: Four KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: 本日の利用予定 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-gray-500">本日の利用予定</div>
                <Users size={16} className="text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {todayTotalCount}<span className="text-sm font-normal text-gray-500">名</span>
                <span className="text-sm font-normal text-gray-400"> / {totalCapacity}名定員</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                <div
                  className="bg-gray-700 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((todayTotalCount / (totalCapacity || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Sun size={12} /> {slotInfo.AM.name}: {todayAMCount}名</span>
                {slotInfo.PM && <span className="flex items-center gap-1"><Sunset size={12} /> {slotInfo.PM.name}: {todayPMCount}名</span>}
              </div>
            </div>

            {/* Card 2: 本日の出勤スタッフ */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-gray-500">出勤スタッフ</div>
                <UserCheck size={16} className="text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {activeStaffCount}<span className="text-sm font-normal text-gray-500">名配置</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                登録スタッフ総数
              </div>
            </div>

            {/* Card 3: 月間稼働率 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-gray-500">月間稼働率</div>
                <BarChart3 size={16} className="text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {occupancyRate.rate.toFixed(1)}<span className="text-sm font-normal text-gray-500">%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                <div
                  className="bg-gray-700 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(occupancyRate.rate, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                目標: {targetOccupancyRate !== null ? `${targetOccupancyRate}%` : '未設定'}
              </div>
            </div>

            {/* Card 4: 当月売上見込み */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-gray-500">当月売上見込み</div>
                <DollarSign size={16} className="text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                <span className="text-sm font-normal text-gray-500">¥</span>{totalMonthlyRevenue.toLocaleString()}
              </div>
              {targetRevenue !== null && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                  <div
                    className="bg-gray-700 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min((totalMonthlyRevenue / targetRevenue) * 100, 100)}%` }}
                  />
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                目標: {targetRevenue !== null ? `¥${targetRevenue.toLocaleString()}` : '未設定'}
              </div>
            </div>
          </div>

          {/* Row 3: Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: 今週の利用予定 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                <Calendar size={16} className="mr-2 text-gray-500" />
                今週の利用予定
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-500">曜日</th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-gray-500">日付</th>
                      <th className="text-center py-2 px-2 text-xs font-bold text-gray-500">{slotInfo.AM.name}</th>
                      {slotInfo.PM && (
                        <th className="text-center py-2 px-2 text-xs font-bold text-gray-500">{slotInfo.PM.name}</th>
                      )}
                      <th className="text-center py-2 px-2 text-xs font-bold text-gray-500">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyScheduleData.map((day) => (
                      <tr
                        key={day.dateStr}
                        className={`border-b border-gray-50 ${day.isToday ? 'bg-gray-50 font-bold' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-2.5 px-2 text-gray-700">
                          {day.isToday && <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-800 mr-1.5" />}
                          {day.label}
                        </td>
                        <td className="py-2.5 px-2 text-gray-500 text-xs">
                          {day.date.getMonth() + 1}/{day.date.getDate()}
                        </td>
                        <td className="py-2.5 px-2 text-center text-gray-800">{day.am}</td>
                        {slotInfo.PM && (
                          <td className="py-2.5 px-2 text-center text-gray-800">{day.pm}</td>
                        )}
                        <td className="py-2.5 px-2 text-center font-bold text-gray-800">{day.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: 対応が必要な項目 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                <AlertCircle size={16} className="mr-2 text-gray-500" />
                対応が必要な項目
              </h3>
              {actionItems.length === 0 ? (
                <div className="text-center py-8">
                  <Shield size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">現在、対応が必要な項目はありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                        item.level === 'critical' ? 'bg-gray-800' : item.level === 'warning' ? 'bg-gray-500' : 'bg-gray-300'
                      }`} />
                      <div>
                        <p className="text-sm font-bold text-gray-700">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 加算・収益リンクカード */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-700">加算・収益の改善提案</p>
                    <p className="text-xs text-gray-500 mt-0.5">加算取得状況を確認して収益を最大化</p>
                  </div>
                  <a
                    href="/business?tab=addition-settings"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded transition-colors"
                  >
                    確認する
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Quick access card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Zap size={18} className="text-gray-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">加算取得状況</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    取得中: {/* Simple count based on facility settings if available */}
                    {facilitySettings ? '確認可能' : '未設定'}
                  </p>
                </div>
              </div>
              <a
                href="/business?tab=addition-settings"
                className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors"
              >
                詳細を見る
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </>
      )}

      {/* コンプライアンス・書類管理モード */}
      {dashboardMode === 'compliance' && facility?.id && (
        <ComplianceManagement facilityId={facility.id} />
      )}

      {/* 月次分析モード */}
      {dashboardMode === 'operations' && (
        <>
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">月次分析</h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            月次の経営指標を確認できます。
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
          {slotInfo.isConfigured ? (
            <div className="mt-2 text-xs sm:text-sm text-gray-600 leading-tight">
              <div>{slotInfo.AM.name}: {ampmOccupancyRate.amRate.toFixed(1)}% ({ampmOccupancyRate.amCount}/{ampmOccupancyRate.amCapacity})</div>
              {slotInfo.PM && (
                <div>{slotInfo.PM.name}: {ampmOccupancyRate.pmRate.toFixed(1)}% ({ampmOccupancyRate.pmCount}/{ampmOccupancyRate.pmCapacity})</div>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-amber-600">
              時間枠を設定すると詳細が表示されます
            </div>
          )}
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
        {!slotInfo.isConfigured ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-2">時間枠が設定されていません</p>
            <p className="text-xs text-gray-500 mb-3">
              施設情報で時間枠を設定すると、曜日別の稼働率が表示されます
            </p>
            <a
              href="/business?tab=facility"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded transition-colors"
            >
              施設情報を設定
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-bold text-gray-600">曜日</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">
                    {slotInfo.AM.name}
                    <span className="text-gray-400 font-normal ml-1">(定員{slotInfo.AM.capacity})</span>
                  </th>
                  {slotInfo.PM && (
                    <th className="text-right py-2 px-3 text-xs font-bold text-gray-600">
                      {slotInfo.PM.name}
                      <span className="text-gray-400 font-normal ml-1">(定員{slotInfo.PM.capacity})</span>
                    </th>
                  )}
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
                    {slotInfo.PM && (
                      <td className="py-2 px-3 text-right">
                        <div className="text-sm font-bold text-gray-800">
                          {day.pmUtilization.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {day.pmCount}件
                        </div>
                      </td>
                    )}
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
        )}
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

      {/* 営業データ（折りたたみ） */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <button
          onClick={() => setIsSalesDataExpanded(!isSalesDataExpanded)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
        >
          <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center">
            <Target size={18} className="sm:w-5 sm:h-5 mr-2 text-gray-500 shrink-0" />
            営業データ
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{isSalesDataExpanded ? '折りたたむ' : '展開する'}</span>
            {isSalesDataExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {isSalesDataExpanded && (
          <div className="px-4 sm:px-5 pb-5 space-y-6 border-t border-gray-100 pt-4">
            {/* リード管理進捗 */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                <Target size={14} className="mr-1.5 text-gray-400" />
                リード管理進捗（当月新規）
              </h4>
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
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-700 flex items-center">
                  <Users size={14} className="mr-1.5 text-gray-400" />
                  契約数・問い合わせ数推移（過去6ヶ月）
                </h4>
                <button
                  onClick={() => setIsContractTrendExpanded(!isContractTrendExpanded)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-bold flex items-center"
                >
                  {isContractTrendExpanded ? (
                    <>
                      <ChevronUp size={14} className="mr-1" />
                      3ヶ月
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} className="mr-1" />
                      6ヶ月
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
          </div>
        )}
      </div>

        </>
      )}
    </div>
  );
};

export default DashboardView;

