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
  ChevronRight,
  Zap,
  FileText,
  Clock,
  UserCheck,
  ExternalLink,
  Shield,
  Sun,
  Sunset,
  BookOpen,
  ClipboardList,
  MessageSquare,
  UserCog,
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
import { useChangeNotifications, daysUntilDeadline, getDeadlineColor } from '@/hooks/useChangeNotifications';
import { CHANGE_NOTIFICATION_TYPE_LABELS } from '@/types';
import OperationsReviewWizard from '@/components/facility/OperationsReviewWizard';

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

  // 変更届通知
  const { pendingNotifications, pendingCount: changeNotificationPendingCount, refetch: refetchChangeNotifications } = useChangeNotifications();

  // 月次運営確認ウィザード
  const [showOperationsWizard, setShowOperationsWizard] = useState(false);
  const [showReviewBanner, setShowReviewBanner] = useState(false);

  // Auto-prompt: show banner in the first 7 days of each month
  useEffect(() => {
    const today = new Date();
    if (today.getDate() <= 7) {
      // Check localStorage to see if user already dismissed this month
      const dismissKey = `operations_review_dismissed_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const dismissed = localStorage.getItem(dismissKey);
      if (!dismissed) {
        setShowReviewBanner(true);
      }
    }
  }, []);

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
    // 変更届アラート
    if (changeNotificationPendingCount > 0) {
      const urgentNotifications = pendingNotifications.filter(n => daysUntilDeadline(n.deadline) <= 3);
      if (urgentNotifications.length > 0) {
        items.push({
          text: `変更届の提出期限が迫っています（${urgentNotifications.length}件）`,
          level: 'critical',
        });
      } else {
        items.push({
          text: `未提出の変更届が${changeNotificationPendingCount}件あります`,
          level: 'warning',
        });
      }
    }
    return items;
  }, [deductionResult, qualificationResult, changeNotificationPendingCount, pendingNotifications]);

  // 対応が必要な項目
  const actionItems = useMemo(() => {
    const items: { label: string; detail: string; level: 'critical' | 'warning' | 'info'; href?: string }[] = [];
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
    // 変更届
    pendingNotifications.slice(0, 3).forEach((notification) => {
      const daysLeft = daysUntilDeadline(notification.deadline);
      items.push({
        label: `変更届: ${CHANGE_NOTIFICATION_TYPE_LABELS[notification.changeType]}`,
        detail: daysLeft < 0
          ? `期限超過（${Math.abs(daysLeft)}日）`
          : `提出期限まで${daysLeft}日`,
        level: daysLeft <= 3 ? 'critical' : daysLeft <= 5 ? 'warning' : 'info',
        href: '/business?tab=facility',
      });
    });
    return items;
  }, [deductionResult, qualificationResult, pendingNotifications]);

  // 本日のフォーマット
  const todayFormatted = useMemo(() => {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return `${today.getMonth() + 1}月${today.getDate()}日（${dayNames[today.getDay()]}）`;
  }, [today]);

  const todayFullFormatted = useMemo(() => {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${dayNames[today.getDay()]}）`;
  }, [today]);

  // 稼働率のトレンド（前月比）
  const occupancyTrend = useMemo(() => {
    const prevDate = new Date(today);
    prevDate.setMonth(prevDate.getMonth() - 1);
    // Simplified trend indicator
    return occupancyRate.rate > 0 ? 'up' : 'neutral';
  }, [occupancyRate, today]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* メインタブ切り替え */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5">
        <div className="flex gap-1">
          {[
            { id: 'today' as const, label: '本日', icon: Clock },
            { id: 'operations' as const, label: '月次分析', icon: BarChart3 },
            { id: 'compliance' as const, label: 'コンプライアンス', icon: Shield },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDashboardMode(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all ${
                dashboardMode === tab.id
                  ? 'bg-[#00c4cc] text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>


      {/* ========== 本日タブ ========== */}
      {dashboardMode === 'today' && (
        <>
          {/* Hero: Large Date Display */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{todayFormatted}</h1>
                <p className="text-sm text-gray-500 mt-1">{today.getFullYear()}年</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} />
                <span>リアルタイム</span>
              </div>
            </div>
          </div>

          {/* 月次運営確認バナー */}
          {showReviewBanner && (
            <div className="bg-[#00c4cc]/5 border border-[#00c4cc]/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00c4cc]/10 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-[#00c4cc]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">来月の運営確認を行いましょう</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    スタッフ体制・加算・営業時間など、来月の変更点を確認して変更届の必要性をチェックできます
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => {
                    const today = new Date();
                    const dismissKey = `operations_review_dismissed_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                    localStorage.setItem(dismissKey, 'true');
                    setShowReviewBanner(false);
                  }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  後で
                </button>
                <button
                  onClick={() => {
                    setShowOperationsWizard(true);
                    setShowReviewBanner(false);
                  }}
                  className="px-4 py-2 text-xs bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors font-bold flex items-center gap-1"
                >
                  確認を開始
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Alert Section */}
          {alertItems.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              {alertItems.some(i => i.level === 'critical') ? (
                <div className="bg-red-50 border-red-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <AlertTriangle size={16} className="text-red-600" />
                    </div>
                    <div className="space-y-1.5">
                      {alertItems.filter(i => i.level === 'critical').map((item, i) => (
                        <p key={i} className="text-sm font-medium text-red-800">{item.text}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {alertItems.some(i => i.level === 'warning') ? (
                <div className="bg-amber-50 border-amber-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertCircle size={16} className="text-amber-600" />
                    </div>
                    <div className="space-y-1.5">
                      {alertItems.filter(i => i.level === 'warning').map((item, i) => (
                        <p key={i} className="text-sm font-medium text-amber-800">{item.text}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {alertItems.some(i => i.level === 'info') ? (
                <div className="bg-blue-50 border-blue-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <AlertCircle size={16} className="text-blue-600" />
                    </div>
                    <div className="space-y-1.5">
                      {alertItems.filter(i => i.level === 'info').map((item, i) => (
                        <p key={i} className="text-sm font-medium text-blue-800">{item.text}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: 本日の利用予定 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">本日の利用</span>
                <div className="w-8 h-8 rounded-lg bg-[#00c4cc]/10 flex items-center justify-center">
                  <Users size={16} className="text-[#00c4cc]" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">{todayTotalCount}</span>
                <span className="text-sm text-gray-500">/ {totalCapacity}名</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                <div
                  className="bg-[#00c4cc] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((todayTotalCount / (totalCapacity || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Sun size={12} /> {slotInfo.AM.name}: {todayAMCount}</span>
                {slotInfo.PM && <span className="flex items-center gap-1"><Sunset size={12} /> {slotInfo.PM.name}: {todayPMCount}</span>}
              </div>
            </div>

            {/* Card 2: 出勤スタッフ */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">出勤スタッフ</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <UserCheck size={16} className="text-indigo-500" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">{activeStaffCount}</span>
                <span className="text-sm text-gray-500">名</span>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                登録スタッフ総数
              </div>
            </div>

            {/* Card 3: 月間稼働率 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">月間稼働率</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <BarChart3 size={16} className="text-emerald-500" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">{occupancyRate.rate.toFixed(1)}</span>
                <span className="text-sm text-gray-500">%</span>
                {occupancyTrend === 'up' && (
                  <span className="ml-2 flex items-center text-xs text-emerald-600 font-medium">
                    <ArrowUp size={12} />
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(occupancyRate.rate, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                目標: {targetOccupancyRate !== null ? `${targetOccupancyRate}%` : '未設定'}
              </div>
            </div>

            {/* Card 4: 当月売上見込み */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">当月売上</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <DollarSign size={16} className="text-amber-500" />
                </div>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-sm text-gray-500">¥</span>
                <span className="text-3xl font-bold text-gray-900">{(totalMonthlyRevenue / 10000).toFixed(0)}</span>
                <span className="text-sm text-gray-500">万</span>
              </div>
              {targetRevenue !== null && (
                <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((totalMonthlyRevenue / targetRevenue) * 100, 100)}%` }}
                  />
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                目標: {targetRevenue !== null ? `¥${(targetRevenue / 10000).toFixed(0)}万` : '未設定'}
              </div>
            </div>
          </div>

          {/* Today's Schedule: Visual Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: 今週の利用予定 (spanning 2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-[#00c4cc]" />
                今週の利用予定
              </h3>
              <div className="space-y-2">
                {weeklyScheduleData.map((day) => {
                  const amPct = slotInfo.AM.capacity > 0 ? (day.am / slotInfo.AM.capacity) * 100 : 0;
                  const pmPct = slotInfo.PM && slotInfo.PM.capacity > 0 ? (day.pm / slotInfo.PM.capacity) * 100 : 0;
                  return (
                    <div
                      key={day.dateStr}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        day.isToday ? 'bg-[#00c4cc]/5 ring-1 ring-[#00c4cc]/20' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-16 flex items-center gap-2">
                        {day.isToday && <span className="w-2 h-2 rounded-full bg-[#00c4cc] animate-pulse" />}
                        <span className={`text-sm font-bold ${day.isToday ? 'text-[#00c4cc]' : 'text-gray-700'}`}>
                          {day.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {day.date.getMonth() + 1}/{day.date.getDate()}
                        </span>
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        {/* AM Bar */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-400">{slotInfo.AM.name}</span>
                            <span className="text-[10px] font-medium text-gray-600">{day.am}名</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-[#00c4cc] h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(amPct, 100)}%` }}
                            />
                          </div>
                        </div>
                        {/* PM Bar */}
                        {slotInfo.PM && (
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-400">{slotInfo.PM.name}</span>
                              <span className="text-[10px] font-medium text-gray-600">{day.pm}名</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-indigo-400 h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min(pmPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="w-12 text-right">
                        <span className="text-sm font-bold text-gray-900">{day.total}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: 対応が必要な項目 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                対応が必要
              </h3>
              {actionItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield size={20} className="text-emerald-500" />
                  </div>
                  <p className="text-sm text-gray-500">対応が必要な項目はありません</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {actionItems.map((item, i) => {
                    const inner = (
                      <>
                        <p className={`text-sm font-semibold ${
                          item.level === 'critical' ? 'text-red-800' : item.level === 'warning' ? 'text-amber-800' : 'text-blue-800'
                        }`}>{item.label}</p>
                        <p className={`text-xs mt-0.5 ${
                          item.level === 'critical' ? 'text-red-600' : item.level === 'warning' ? 'text-amber-600' : 'text-blue-600'
                        }`}>{item.detail}</p>
                      </>
                    );
                    const cls = `p-3 rounded-lg border ${
                      item.level === 'critical' ? 'bg-red-50 border-red-200' : item.level === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                    }`;
                    return item.href ? (
                      <a key={i} href={item.href} className={`${cls} block hover:opacity-90 transition-opacity`}>{inner}</a>
                    ) : (
                      <div key={i} className={cls}>{inner}</div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-[#00c4cc]" />
              <h3 className="text-sm font-bold text-gray-900">クイックアクション</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <a
                href="/business?tab=daily-log"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#00c4cc] hover:bg-[#00c4cc]/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-[#00c4cc]/10 flex items-center justify-center transition-colors">
                  <BookOpen size={18} className="text-gray-600 group-hover:text-[#00c4cc]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">日誌を書く</p>
                  <p className="text-[10px] text-gray-400">業務日誌の作成</p>
                </div>
              </a>
              <a
                href="/business?tab=daily-log"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#00c4cc] hover:bg-[#00c4cc]/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-[#00c4cc]/10 flex items-center justify-center transition-colors">
                  <ClipboardList size={18} className="text-gray-600 group-hover:text-[#00c4cc]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">実績登録</p>
                  <p className="text-[10px] text-gray-400">利用実績の入力</p>
                </div>
              </a>
              <a
                href="/business?tab=daily-log"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#00c4cc] hover:bg-[#00c4cc]/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-[#00c4cc]/10 flex items-center justify-center transition-colors">
                  <MessageSquare size={18} className="text-gray-600 group-hover:text-[#00c4cc]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">連絡帳確認</p>
                  <p className="text-[10px] text-gray-400">保護者からの連絡</p>
                </div>
              </a>
              <a
                href="/business?tab=staffing"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#00c4cc] hover:bg-[#00c4cc]/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-[#00c4cc]/10 flex items-center justify-center transition-colors">
                  <UserCog size={18} className="text-gray-600 group-hover:text-[#00c4cc]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">出勤管理</p>
                  <p className="text-[10px] text-gray-400">勤務状況の確認</p>
                </div>
              </a>
              <button
                onClick={() => setShowOperationsWizard(true)}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#00c4cc] hover:bg-[#00c4cc]/5 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-[#00c4cc]/10 flex items-center justify-center transition-colors">
                  <FileText size={18} className="text-gray-600 group-hover:text-[#00c4cc]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">来月の運営確認</p>
                  <p className="text-[10px] text-gray-400">変更届チェック</p>
                </div>
              </button>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">月次分析</h2>
          <p className="text-gray-500 text-sm mt-1">
            月次の経営指標を確認できます
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 sm:gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewPeriod('week')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
                viewPeriod === 'week'
                  ? 'bg-white text-[#00c4cc] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              週単位
            </button>
            <button
              onClick={() => setViewPeriod('month')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
                viewPeriod === 'month'
                  ? 'bg-white text-[#00c4cc] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              月単位
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronDown size={16} className="rotate-90" />
            </button>
            <span className="text-sm font-bold text-gray-800 min-w-[120px] text-center">
              {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronDown size={16} className="-rotate-90" />
            </button>
          </div>
        </div>
      </div>

      {/* 主要指標カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 当月見込み売り上げ */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">当月売上見込</span>
            <div className="w-8 h-8 rounded-lg bg-[#00c4cc]/10 flex items-center justify-center">
              <DollarSign size={16} className="text-[#00c4cc]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{totalMonthlyRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            目標: {targetRevenue !== null ? `¥${targetRevenue.toLocaleString()}` : '未設定'}
            {targetRevenue !== null && (
              <span className="ml-2 font-medium text-[#00c4cc]">
                {((totalMonthlyRevenue / targetRevenue) * 100).toFixed(1)}%
              </span>
            )}
          </div>
          {targetRevenue !== null && (
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
              <div
                className="bg-[#00c4cc] h-2 rounded-full transition-all"
                style={{ width: `${Math.min((totalMonthlyRevenue / targetRevenue) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* 稼働率 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">稼働率</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <BarChart3 size={16} className="text-emerald-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {occupancyRate.rate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            目標: {targetOccupancyRate !== null ? `${targetOccupancyRate}%` : '未設定'}
          </div>
          {targetOccupancyRate !== null && (
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
              <div
                className={`h-2 rounded-full transition-all ${
                  occupancyRate.rate >= targetOccupancyRate
                    ? 'bg-emerald-500'
                    : occupancyRate.rate >= targetOccupancyRate * 0.8
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(occupancyRate.rate, 100)}%` }}
              />
            </div>
          )}
          {slotInfo.isConfigured ? (
            <div className="mt-2 flex gap-4 text-xs text-gray-600">
              <span>{slotInfo.AM.name}: {ampmOccupancyRate.amRate.toFixed(1)}%</span>
              {slotInfo.PM && (
                <span>{slotInfo.PM.name}: {ampmOccupancyRate.pmRate.toFixed(1)}%</span>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-amber-600">
              時間枠を設定すると詳細が表示されます
            </div>
          )}
        </div>

        {/* キャンセル率 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">キャンセル率</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle size={16} className="text-red-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {slotStats.cancellationRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            キャンセル数: {slotStats.cancelledSlots}件
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full transition-all ${
                slotStats.cancellationRate > 20
                  ? 'bg-red-500'
                  : slotStats.cancellationRate > 10
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(slotStats.cancellationRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 週別見込み売り上げ */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-[#00c4cc]" />
          週別見込み売り上げ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {weeklyRevenue.map((week) => (
            <div
              key={week.week}
              className="bg-gray-50 rounded-xl p-4 border border-gray-100"
            >
              <div className="text-xs font-semibold text-gray-500 mb-2">
                {week.week}週目
              </div>
              <div className="text-lg font-bold text-gray-900 mb-1">
                ¥{week.revenue.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">
                予定: {week.scheduledCount} / 実績: {week.actualCount}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 送迎利用率 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Car size={18} className="text-[#00c4cc]" />
          送迎利用率
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="text-xs font-semibold text-blue-600 mb-1">お迎え利用率</div>
            <div className="text-2xl font-bold text-blue-800">
              {pickupDropoffRate.pickupRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {pickupDropoffRate.pickupCount}件 / {pickupDropoffRate.totalSchedules}件
            </div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-600 mb-1">お送り利用率</div>
            <div className="text-2xl font-bold text-emerald-800">
              {pickupDropoffRate.dropoffRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {pickupDropoffRate.dropoffCount}件 / {pickupDropoffRate.totalSchedules}件
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="text-xs font-semibold text-purple-600 mb-1">両方利用</div>
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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-[#00c4cc]" />
          曜日別利用率
        </h3>
        {!slotInfo.isConfigured ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-2">時間枠が設定されていません</p>
            <p className="text-xs text-gray-500 mb-3">
              施設情報で時間枠を設定すると、曜日別の稼働率が表示されます
            </p>
            <a
              href="/business?tab=facility"
              className="inline-flex items-center gap-1 px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-xs font-bold rounded-lg transition-colors"
            >
              施設情報を設定
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">曜日</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">
                    {slotInfo.AM.name}
                    <span className="text-gray-400 font-normal ml-1">(定員{slotInfo.AM.capacity})</span>
                  </th>
                  {slotInfo.PM && (
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">
                      {slotInfo.PM.name}
                      <span className="text-gray-400 font-normal ml-1">(定員{slotInfo.PM.capacity})</span>
                    </th>
                  )}
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">合計利用率</th>
                </tr>
              </thead>
              <tbody>
                {dayOfWeekUtilization.map((day) => (
                  <tr key={day.dayIndex} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-gray-800">{day.dayOfWeek}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="text-sm font-bold text-gray-800">
                        {day.amUtilization.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {day.amCount}件
                      </div>
                    </td>
                    {slotInfo.PM && (
                      <td className="py-2.5 px-3 text-right">
                        <div className="text-sm font-bold text-gray-800">
                          {day.pmUtilization.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {day.pmCount}件
                        </div>
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-sm font-bold text-[#00c4cc]">
                        {day.totalUtilization.toFixed(1)}%
                      </span>
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={18} className="text-[#00c4cc]" />
            年齢別利用児童
          </h3>
          <div className="space-y-3">
            {ageDistribution.map((item) => (
              <div key={item.age}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.age}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {item.count}名 ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-[#00c4cc]" />
            利用児童の居住地区
          </h3>
          <div className="space-y-3">
            {areaDistribution.slice(0, 10).map((item) => (
              <div key={item.area}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.area}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {item.count}名 ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">平均単価（ARPU）</div>
          <div className="text-2xl font-bold text-gray-900">
            ¥{arpu.arpu.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">目標: ¥{arpu.target.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">人件費率（L/R比）</div>
          <div className="text-2xl font-bold text-gray-900">
            {laborRatio.ratio.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">目標: {laborRatio.target}%</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">アクティブ児童数</div>
          <div className="text-2xl font-bold text-gray-900">
            {children.filter((c) => c.contractStatus === 'active').length}名
          </div>
          <div className="text-xs text-gray-500 mt-1">
            総児童数: {children.length}名
          </div>
        </div>
      </div>

      {/* 営業データ（折りたたみ） */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <button
          onClick={() => setIsSalesDataExpanded(!isSalesDataExpanded)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 rounded-xl transition-colors"
        >
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Target size={18} className="text-gray-500" />
            営業データ
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{isSalesDataExpanded ? '折りたたむ' : '展開する'}</span>
            {isSalesDataExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {isSalesDataExpanded && (
          <div className="px-5 pb-5 space-y-6 border-t border-gray-100 pt-4">
            {/* リード管理進捗 */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                <Target size={14} className="text-gray-400" />
                リード管理進捗（当月新規）
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <div className="text-xs font-semibold text-blue-600 mb-1">新規問い合わせ</div>
                  <div className="text-xl font-bold text-blue-800">{leadProgress.current.newInquiries}</div>
                  {leadProgress.previous && (
                    <div className="flex items-center text-xs mt-1">
                      {leadProgress.trends.newInquiries >= 0 ? (
                        <ArrowUp size={12} className="text-emerald-600 mr-1" />
                      ) : (
                        <ArrowDown size={12} className="text-red-600 mr-1" />
                      )}
                      <span className={leadProgress.trends.newInquiries >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {leadProgress.trends.newInquiries >= 0 ? '+' : ''}{leadProgress.trends.newInquiries.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
                  <div className="text-xs font-semibold text-yellow-600 mb-1">見学/面談予定</div>
                  <div className="text-xl font-bold text-yellow-800">{leadProgress.current.visits}</div>
                  {leadProgress.previous && (
                    <div className="flex items-center text-xs mt-1">
                      {leadProgress.trends.visits >= 0 ? (
                        <ArrowUp size={12} className="text-emerald-600 mr-1" />
                      ) : (
                        <ArrowDown size={12} className="text-red-600 mr-1" />
                      )}
                      <span className={leadProgress.trends.visits >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {leadProgress.trends.visits >= 0 ? '+' : ''}{leadProgress.trends.visits.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                  <div className="text-xs font-semibold text-orange-600 mb-1">検討中</div>
                  <div className="text-xl font-bold text-orange-800">{leadProgress.current.considering}</div>
                  {leadProgress.previous && (
                    <div className="flex items-center text-xs mt-1">
                      {leadProgress.trends.considering >= 0 ? (
                        <ArrowUp size={12} className="text-emerald-600 mr-1" />
                      ) : (
                        <ArrowDown size={12} className="text-red-600 mr-1" />
                      )}
                      <span className={leadProgress.trends.considering >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {leadProgress.trends.considering >= 0 ? '+' : ''}{leadProgress.trends.considering.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                  <div className="text-xs font-semibold text-purple-600 mb-1">受給者証待ち</div>
                  <div className="text-xl font-bold text-purple-800">{leadProgress.current.waitingBenefit}</div>
                  {leadProgress.previous && (
                    <div className="flex items-center text-xs mt-1">
                      {leadProgress.trends.waitingBenefit >= 0 ? (
                        <ArrowUp size={12} className="text-emerald-600 mr-1" />
                      ) : (
                        <ArrowDown size={12} className="text-red-600 mr-1" />
                      )}
                      <span className={leadProgress.trends.waitingBenefit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {leadProgress.trends.waitingBenefit >= 0 ? '+' : ''}{leadProgress.trends.waitingBenefit.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  <div className="text-xs font-semibold text-indigo-600 mb-1">契約進行中</div>
                  <div className="text-xl font-bold text-indigo-800">{leadProgress.current.contractProgress}</div>
                  {leadProgress.previous && (
                    <div className="flex items-center text-xs mt-1">
                      {leadProgress.trends.contractProgress >= 0 ? (
                        <ArrowUp size={12} className="text-emerald-600 mr-1" />
                      ) : (
                        <ArrowDown size={12} className="text-red-600 mr-1" />
                      )}
                      <span className={leadProgress.trends.contractProgress >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {leadProgress.trends.contractProgress >= 0 ? '+' : ''}{leadProgress.trends.contractProgress.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <div className="text-xs font-semibold text-emerald-600 mb-1">契約済み</div>
                  <div className="text-xl font-bold text-emerald-800">{leadProgress.current.contracts}</div>
                  {leadProgress.previous && (
                    <div className="flex items-center text-xs mt-1">
                      {leadProgress.trends.contracts >= 0 ? (
                        <ArrowUp size={12} className="text-emerald-600 mr-1" />
                      ) : (
                        <ArrowDown size={12} className="text-red-600 mr-1" />
                      )}
                      <span className={leadProgress.trends.contracts >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {leadProgress.trends.contracts >= 0 ? '+' : ''}{leadProgress.trends.contracts.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <div className="text-xs font-semibold text-red-600 mb-1">失注</div>
                  <div className="text-xl font-bold text-red-800">{leadProgress.current.lost}</div>
                  {leadProgress.previous && (
                    <div className="flex items-center text-xs mt-1">
                      {leadProgress.trends.lost >= 0 ? (
                        <ArrowUp size={12} className="text-emerald-600 mr-1" />
                      ) : (
                        <ArrowDown size={12} className="text-red-600 mr-1" />
                      )}
                      <span className={leadProgress.trends.lost >= 0 ? 'text-emerald-600' : 'text-red-600'}>
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
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <Users size={14} className="text-gray-400" />
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
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 mb-2">
                      <div className="text-xs text-blue-600 mb-1">契約数</div>
                      <div className="text-xl font-bold text-blue-800">{item.contracts}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-2">
                      <div className="text-xs text-emerald-600 mb-1">新規問い合わせ</div>
                      <div className="text-xl font-bold text-emerald-800">{item.inquiries.total}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 border border-gray-100 text-xs">
                      <div className="text-gray-600 mb-1">経路別</div>
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

      {/* 月次運営確認ウィザード */}
      <OperationsReviewWizard
        isOpen={showOperationsWizard}
        onClose={() => setShowOperationsWizard(false)}
        onComplete={() => {
          refetchChangeNotifications();
        }}
      />
    </div>
  );
};

export default DashboardView;
