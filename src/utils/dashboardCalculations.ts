/**
 * ダッシュボード用の計算ロジック
 */

import { ScheduleItem, UsageRecord, Child, Staff, BookingRequest, Lead, FacilitySettings } from '@/types';
import { getJapaneseHolidays, isJapaneseHoliday } from './japaneseHolidays';

// 目標値（デフォルト値、実際の値はmanagementTargetsから取得）
const TARGET_PROFIT = 1000000; // 100万円
const TARGET_OCCUPANCY_RATE = 90; // 90%
const TARGET_ARPU = 15000; // 15,000円
const TARGET_LABOR_RATIO = 47; // 47%

/**
 * 施設設定に基づいて営業日数を計算
 */
export const calculateBusinessDays = (
  facilitySettings: FacilitySettings,
  year: number,
  month: number
): number => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let businessDays = 0;

  // その月の祝日を取得
  const holidays = facilitySettings.includeHolidays ? getJapaneseHolidays(year) : [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 期間ごとの定休日を確認
    let isHoliday = false;
    if (facilitySettings.holidayPeriods) {
      for (const period of facilitySettings.holidayPeriods) {
        const periodStart = new Date(period.startDate);
        const periodEnd = period.endDate ? new Date(period.endDate) : new Date(9999, 11, 31);
        const currentDate = new Date(year, month, day);

        if (currentDate >= periodStart && currentDate <= periodEnd) {
          if (period.regularHolidays.includes(dayOfWeek)) {
            isHoliday = true;
            break;
          }
        }
      }
    }

    // 期間に該当しない場合はデフォルトの定休日を確認
    if (!isHoliday && facilitySettings.regularHolidays.includes(dayOfWeek)) {
      isHoliday = true;
    }

    // カスタム休業日を確認
    if (facilitySettings.customHolidays.includes(dateStr)) {
      isHoliday = true;
    }

    // 祝日を確認
    if (facilitySettings.includeHolidays && isJapaneseHoliday(dateStr)) {
      isHoliday = true;
    }

    // 営業日の場合のみカウント
    if (!isHoliday) {
      businessDays++;
    }
  }

  return businessDays;
};

// 月次想定利益（見込み）を計算
export const calculateMonthlyProfit = (
  usageRecords: UsageRecord[],
  currentMonth: Date = new Date()
): { profit: number; target: number; achievementRate: number } => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlyRecords = usageRecords.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month;
  });

  // 簡易計算：1利用あたり15,000円と仮定
  const profit = monthlyRecords
    .filter((r) => r.serviceStatus === '利用' && r.billingTarget === '請求する')
    .length * TARGET_ARPU;

  return {
    profit,
    target: TARGET_PROFIT,
    achievementRate: (profit / TARGET_PROFIT) * 100,
  };
};

// 稼働率（月間累計）を計算
export const calculateOccupancyRate = (
  schedules: ScheduleItem[],
  capacity: { AM: number; PM: number },
  facilitySettings: FacilitySettings,
  currentMonth: Date = new Date()
): { rate: number; target: number } => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  // 施設設定に基づいて営業日数を計算
  const businessDays = calculateBusinessDays(facilitySettings, year, month);

  const totalCapacity = businessDays * (capacity.AM + capacity.PM);
  const actualUsage = monthlySchedules.length;
  const rate = totalCapacity > 0 ? (actualUsage / totalCapacity) * 100 : 0;

  return {
    rate,
    target: TARGET_OCCUPANCY_RATE,
  };
};

// 平均単価（ARPU）を計算
export const calculateARPU = (
  usageRecords: UsageRecord[],
  children: Child[],
  currentMonth: Date = new Date()
): { arpu: number; target: number } => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlyRecords = usageRecords.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month;
  });

  const activeChildren = children.filter((c) => c.contractStatus === 'active').length;
  
  if (activeChildren === 0) {
    return { arpu: 0, target: TARGET_ARPU };
  }

  // 簡易計算：月間総収益 / アクティブ児童数
  const totalRevenue = monthlyRecords
    .filter((r) => r.serviceStatus === '利用' && r.billingTarget === '請求する')
    .length * TARGET_ARPU;
  
  const arpu = totalRevenue / activeChildren;

  return {
    arpu,
    target: TARGET_ARPU,
  };
};

// 人件費率（L/R比）を計算
export const calculateLaborRatio = (
  staff: Staff[],
  usageRecords: UsageRecord[],
  currentMonth: Date = new Date()
): { ratio: number; target: number } => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlyRecords = usageRecords.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month;
  });

  // 簡易計算：スタッフ数 × 平均給与（仮定：30万円/月） / 総収益
  const totalRevenue = monthlyRecords
    .filter((r) => r.serviceStatus === '利用' && r.billingTarget === '請求する')
    .length * TARGET_ARPU;
  
  const estimatedLaborCost = staff.length * 300000; // 仮定：1人30万円/月
  const ratio = totalRevenue > 0 ? (estimatedLaborCost / totalRevenue) * 100 : 0;

  return {
    ratio,
    target: TARGET_LABOR_RATIO,
  };
};

// 異常値アラートを取得
export const getAlerts = (
  usageRecords: UsageRecord[],
  children: Child[],
  currentMonth: Date = new Date()
): string[] => {
  const alerts: string[] = [];
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlyRecords = usageRecords.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month;
  });

  // 欠勤による加算消滅リスク
  const absentRecords = monthlyRecords.filter((r) => r.serviceStatus === '欠席(加算なし)').length;
  if (absentRecords > 5) {
    alerts.push(`欠勤による加算消滅リスク: ${absentRecords}件`);
  }

  // 書類未作成数（簡易版：個別支援計画が未作成の児童）
  const childrenWithoutPlan = children.filter((c) => {
    // 簡易判定：契約開始から3ヶ月以上経過しているが、まだ計画がない
    if (!c.contractStartDate) return false;
    const startDate = new Date(c.contractStartDate);
    const monthsDiff = (currentMonth.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return monthsDiff >= 3;
  }).length;
  
  if (childrenWithoutPlan > 0) {
    alerts.push(`書類未作成数: ${childrenWithoutPlan}件`);
  }

  return alerts;
};

// 曜日別・時間枠別稼働ヒートマップデータ
export const getOccupancyHeatmapData = (
  schedules: ScheduleItem[],
  currentMonth: Date = new Date()
): { dayOfWeek: string; slot: string; occupancy: number; capacity: number }[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
  const slots = ['AM', 'PM'];
  
  const heatmapData: { dayOfWeek: string; slot: string; occupancy: number; capacity: number }[] = [];

  daysOfWeek.forEach((day, dayIndex) => {
    slots.forEach((slot) => {
      const count = monthlySchedules.filter((s) => {
        const scheduleDate = new Date(s.date);
        return scheduleDate.getDay() === dayIndex && s.slot === slot;
      }).length;
      
      heatmapData.push({
        dayOfWeek: day,
        slot,
        occupancy: count,
        capacity: 10, // 仮定の定員
      });
    });
  });

  return heatmapData;
};

// 加算取得マトリクスデータ
export const getAddonMatrixData = (
  usageRecords: UsageRecord[],
  currentMonth: Date = new Date()
): { addon: string; percentage: number; count: number }[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlyRecords = usageRecords.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month;
  });

  const addonCounts: Record<string, number> = {};
  let totalRecords = 0;

  monthlyRecords.forEach((record) => {
    if (record.serviceStatus === '利用') {
      totalRecords++;
      record.addonItems.forEach((addon) => {
        addonCounts[addon] = (addonCounts[addon] || 0) + 1;
      });
    }
  });

  const addonTypes = ['専門的支援加算', '個別支援加算', '送迎加算', 'その他'];
  
  return addonTypes.map((addon) => ({
    addon,
    count: addonCounts[addon] || 0,
    percentage: totalRecords > 0 ? ((addonCounts[addon] || 0) / totalRecords) * 100 : 0,
  }));
};

// キャンセル分析トレンドデータ
export const getCancellationTrendData = (
  requests: BookingRequest[],
  currentMonth: Date = new Date()
): { week: string; cancellationRate: number }[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlyRequests = requests.filter((request) => {
    const requestDate = new Date(request.date);
    return requestDate.getFullYear() === year && requestDate.getMonth() === month;
  });

  // 週ごとに集計
  const weeks: { week: string; total: number; cancellations: number }[] = [];
  
  for (let week = 1; week <= 4; week++) {
    const weekStart = new Date(year, month, (week - 1) * 7 + 1);
    const weekEnd = new Date(year, month, week * 7);
    
    const weekRequests = monthlyRequests.filter((r) => {
      const requestDate = new Date(r.date);
      return requestDate >= weekStart && requestDate <= weekEnd;
    });
    
    const cancellations = weekRequests.filter((r) => r.type === '欠席連絡').length;
    
    weeks.push({
      week: `${week}週目`,
      total: weekRequests.length,
      cancellations,
    });
  }

  return weeks.map((w) => ({
    week: w.week,
    cancellationRate: w.total > 0 ? (w.cancellations / w.total) * 100 : 0,
  }));
};

// スタッフ配置最適化グラフデータ
export const getStaffOptimizationData = (
  schedules: ScheduleItem[],
  staff: Staff[],
  currentMonth: Date = new Date()
): { date: string; childrenCount: number; staffCount: number }[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  // 日別に集計
  const dailyData: Record<string, { children: Set<string>; staff: Set<string> }> = {};

  monthlySchedules.forEach((schedule) => {
    const date = schedule.date;
    if (!dailyData[date]) {
      dailyData[date] = { children: new Set(), staff: new Set() };
    }
    dailyData[date].children.add(schedule.childId);
    if (schedule.staffId) {
      dailyData[date].staff.add(schedule.staffId);
    }
  });

  return Object.entries(dailyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date: date.slice(5), // MM-DD形式
      childrenCount: data.children.size,
      staffCount: data.staff.size || Math.ceil(data.children.size / 3), // 仮定：児童3人にスタッフ1人
    }));
};

// スタッフ別生産性指標
export const getStaffProductivityData = (
  schedules: ScheduleItem[],
  usageRecords: UsageRecord[],
  staff: Staff[]
): { staffName: string; childrenCount: number; plansCount: number }[] => {
  return staff.map((s) => {
    const staffSchedules = schedules.filter((schedule) => schedule.staffId === s.id);
    const childrenCount = new Set(staffSchedules.map((schedule) => schedule.childId)).size;
    
    // 簡易版：個別支援計画の数は仮定値
    const plansCount = Math.floor(childrenCount * 0.8); // 80%の児童に計画があると仮定
    
    return {
      staffName: s.name,
      childrenCount,
      plansCount,
    };
  });
};

// 固定費・変動費推移データ
export const getCostTrendData = (
  currentMonth: Date = new Date()
): { month: string; fixedCost: number; variableCost: number; budget: number }[] => {
  const months: { month: string; fixedCost: number; variableCost: number; budget: number }[] = [];
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentMonth);
    date.setMonth(date.getMonth() - i);
    const monthStr = `${date.getMonth() + 1}月`;
    
    // 仮定のデータ
    months.push({
      month: monthStr,
      fixedCost: 500000 + Math.random() * 50000, // 固定費：50万円±5万円
      variableCost: 200000 + Math.random() * 30000, // 変動費：20万円±3万円
      budget: 700000, // 予算：70万円
    });
  }
  
  return months;
};

// 入会ファネルデータ
export const getFunnelData = (children: Child[]): {
  stage: string;
  count: number;
  percentage: number;
}[] => {
  // 簡易版：実際のデータから推測
  const inquiries = children.length * 3; // 問い合わせ数（仮定）
  const visits = Math.floor(inquiries * 0.7); // 見学数（70%）
  const contracts = children.filter((c) => c.contractStatus !== 'pre-contract').length;
  const waiting = children.filter((c) => c.contractStatus === 'pre-contract').length;
  
  return [
    { stage: '問い合わせ', count: inquiries, percentage: 100 },
    { stage: '見学', count: visits, percentage: (visits / inquiries) * 100 },
    { stage: '契約', count: contracts, percentage: (contracts / inquiries) * 100 },
    { stage: '待機', count: waiting, percentage: (waiting / inquiries) * 100 },
  ];
};

// チャーン（退会）予兆スコア
export const getChurnRiskData = (
  children: Child[],
  schedules: ScheduleItem[],
  usageRecords: UsageRecord[]
): { childName: string; riskScore: number; reason: string }[] => {
  const riskChildren: { childName: string; riskScore: number; reason: string }[] = [];
  
  children.forEach((child) => {
    if (child.contractStatus !== 'active') return;
    
    // 直近30日間の欠席率を計算
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRecords = usageRecords.filter(
      (r) => r.childId === child.id && new Date(r.date) >= thirtyDaysAgo
    );
    
    const absentCount = recentRecords.filter((r) => r.serviceStatus === '欠席(加算なし)').length;
    const absenceRate = recentRecords.length > 0 ? (absentCount / recentRecords.length) * 100 : 0;
    
    if (absenceRate > 30) {
      riskChildren.push({
        childName: child.name,
        riskScore: Math.min(absenceRate, 100),
        reason: `欠席率${absenceRate.toFixed(1)}%`,
      });
    }
  });
  
  return riskChildren.sort((a, b) => b.riskScore - a.riskScore);
};

// LTV（ライフタイムバリュー）予測
export const calculateLTV = (
  children: Child[],
  usageRecords: UsageRecord[]
): { averageLTV: number; totalLTV: number } => {
  const activeChildren = children.filter((c) => c.contractStatus === 'active');
  
  if (activeChildren.length === 0) {
    return { averageLTV: 0, totalLTV: 0 };
  }
  
  // 平均通所期間を計算（簡易版：契約開始日から現在まで）
  const totalMonths = activeChildren.reduce((sum, child) => {
    if (!child.contractStartDate) return sum;
    const startDate = new Date(child.contractStartDate);
    const months = (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return sum + months;
  }, 0);
  
  const averageMonths = totalMonths / activeChildren.length;
  
  // 将来の期待収益を計算（平均月額 × 予想残存期間）
  const averageMonthlyRevenue = TARGET_ARPU * 8; // 月8回利用と仮定
  const expectedRemainingMonths = 24; // 平均2年間と仮定
  const averageLTV = averageMonthlyRevenue * (averageMonths + expectedRemainingMonths);
  
  return {
    averageLTV,
    totalLTV: averageLTV * activeChildren.length,
  };
};

// 週別見込み売り上げを計算
export const calculateWeeklyRevenue = (
  schedules: ScheduleItem[],
  usageRecords: UsageRecord[],
  currentMonth: Date = new Date(),
  dailyPricePerChild: number = 15000
): { week: number; revenue: number; scheduledCount: number; actualCount: number }[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  const monthlyRecords = usageRecords.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month;
  });

  const weeks: { week: number; revenue: number; scheduledCount: number; actualCount: number }[] = [];
  
  // 月の最初の日を取得
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // 週ごとに集計（1週目、2週目、3週目、4週目、5週目）
  for (let week = 1; week <= 5; week++) {
    const weekStart = (week - 1) * 7 + 1;
    const weekEnd = Math.min(week * 7, daysInMonth);
    
    if (weekStart > daysInMonth) break;
    
    const weekSchedules = monthlySchedules.filter((s) => {
      const scheduleDate = new Date(s.date);
      const day = scheduleDate.getDate();
      return day >= weekStart && day <= weekEnd;
    });
    
    const weekRecords = monthlyRecords.filter((r) => {
      const recordDate = new Date(r.date);
      const day = recordDate.getDate();
      return day >= weekStart && day <= weekEnd;
    });
    
    const actualCount = weekRecords.filter(
      (r) => r.serviceStatus === '利用' && r.billingTarget === '請求する'
    ).length;
    
    // 利用枠数×単価で計算（見込み売り上げ）
    const revenue = weekSchedules.length * dailyPricePerChild;
    
    weeks.push({
      week,
      revenue,
      scheduledCount: weekSchedules.length,
      actualCount,
    });
  }
  
  return weeks;
};

// 利用枠の統計を計算
export const calculateSlotStatistics = (
  schedules: ScheduleItem[],
  usageRecords: UsageRecord[],
  capacity: { AM: number; PM: number },
  currentMonth: Date = new Date()
): {
  scheduledSlots: number;
  usedSlots: number;
  cancelledSlots: number;
  cancellationRate: number;
  occupancyRate: number;
} => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  const monthlyRecords = usageRecords.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month;
  });

  const scheduledSlots = monthlySchedules.length;
  const usedSlots = monthlyRecords.filter(
    (r) => r.serviceStatus === '利用' && r.billingTarget === '請求する'
  ).length;
  const cancelledSlots = monthlyRecords.filter(
    (r) => r.serviceStatus === '欠席(加算なし)'
  ).length;
  
  const cancellationRate = scheduledSlots > 0 ? (cancelledSlots / scheduledSlots) * 100 : 0;
  
  // 営業日数を計算
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const businessDays = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return date.getDay() !== 0; // 日曜日を除外
  }).filter(Boolean).length;
  
  const totalCapacity = businessDays * (capacity.AM + capacity.PM);
  const occupancyRate = totalCapacity > 0 ? (usedSlots / totalCapacity) * 100 : 0;
  
  return {
    scheduledSlots,
    usedSlots,
    cancelledSlots,
    cancellationRate,
    occupancyRate,
  };
};

// リード管理の進捗を計算（リード管理のデータから、created_atを基準に集計）
export const calculateLeadProgress = (
  leads: Lead[],
  currentMonth: Date = new Date(),
  previousMonth?: Date
): {
  current: {
    newInquiries: number;
    visits: number;
    considering: number;
    waitingBenefit: number;
    contractProgress: number;
    contracts: number;
    lost: number;
  };
  previous?: {
    newInquiries: number;
    visits: number;
    considering: number;
    waitingBenefit: number;
    contractProgress: number;
    contracts: number;
    lost: number;
  };
  trends: {
    newInquiries: number; // 前月比（%）
    visits: number;
    considering: number;
    waitingBenefit: number;
    contractProgress: number;
    contracts: number;
    lost: number;
  };
} => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // 当月に作成されたリード（created_atを基準）
  const currentLeads = leads.filter((lead) => {
    const leadDate = new Date(lead.createdAt);
    return leadDate.getFullYear() === year && leadDate.getMonth() === month;
  });
  
  const current = {
    newInquiries: currentLeads.filter((l) => l.status === 'new-inquiry').length,
    visits: currentLeads.filter((l) => l.status === 'visit-scheduled').length,
    considering: currentLeads.filter((l) => l.status === 'considering').length,
    waitingBenefit: currentLeads.filter((l) => l.status === 'waiting-benefit').length,
    contractProgress: currentLeads.filter((l) => l.status === 'contract-progress').length,
    contracts: currentLeads.filter((l) => l.status === 'contracted').length,
    lost: currentLeads.filter((l) => l.status === 'lost').length,
  };
  
  let previous: typeof current | undefined;
  let trends = {
    newInquiries: 0,
    visits: 0,
    considering: 0,
    waitingBenefit: 0,
    contractProgress: 0,
    contracts: 0,
    lost: 0,
  };
  
  if (previousMonth) {
    const prevYear = previousMonth.getFullYear();
    const prevMonth = previousMonth.getMonth();
    
    // 前月に作成されたリード（created_atを基準）
    const prevLeads = leads.filter((lead) => {
      const leadDate = new Date(lead.createdAt);
      return leadDate.getFullYear() === prevYear && leadDate.getMonth() === prevMonth;
    });
    
    previous = {
      newInquiries: prevLeads.filter((l) => l.status === 'new-inquiry').length,
      visits: prevLeads.filter((l) => l.status === 'visit-scheduled').length,
      considering: prevLeads.filter((l) => l.status === 'considering').length,
      waitingBenefit: prevLeads.filter((l) => l.status === 'waiting-benefit').length,
      contractProgress: prevLeads.filter((l) => l.status === 'contract-progress').length,
      contracts: prevLeads.filter((l) => l.status === 'contracted').length,
      lost: prevLeads.filter((l) => l.status === 'lost').length,
    };
    
    // 前月比を計算（前月が0の場合は増分を表示）
    const calculateTrend = (current: number, prev: number): number => {
      if (prev > 0) {
        return ((current - prev) / prev) * 100;
      }
      return current > 0 ? 100 : 0;
    };
    
    trends = {
      newInquiries: calculateTrend(current.newInquiries, previous.newInquiries),
      visits: calculateTrend(current.visits, previous.visits),
      considering: calculateTrend(current.considering, previous.considering),
      waitingBenefit: calculateTrend(current.waitingBenefit, previous.waitingBenefit),
      contractProgress: calculateTrend(current.contractProgress, previous.contractProgress),
      contracts: calculateTrend(current.contracts, previous.contracts),
      lost: calculateTrend(current.lost, previous.lost),
    };
  }
  
  return {
    current,
    previous,
    trends,
  };
};

// 契約数推移を計算
export const calculateContractTrend = (
  children: Child[],
  leads: Lead[],
  months: number = 6
): {
  month: string;
  contracts: number;
  expectedContracts: number; // 見込み契約数（リードから）
}[] => {
  const now = new Date();
  const trend: { month: string; contracts: number; expectedContracts: number }[] = [];
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 実際の契約数（契約開始日がその月の児童）
    const contracts = children.filter((c) => {
      if (!c.contractStartDate) return false;
      const startDate = new Date(c.contractStartDate);
      return startDate.getFullYear() === year && startDate.getMonth() === month;
    }).length;
    
    // 見込み契約数（リードの見込み開始日がその月）
    const expectedContracts = leads.filter((l) => {
      if (!l.expectedStartDate) return false;
      const expectedDate = new Date(l.expectedStartDate);
      return (
        expectedDate.getFullYear() === year &&
        expectedDate.getMonth() === month &&
        (l.status === 'contract-progress' || l.status === 'waiting-benefit' || l.status === 'considering')
      );
    }).length;
    
    trend.push({
      month: `${year}年${month + 1}月`,
      contracts,
      expectedContracts,
    });
  }
  
  return trend;
};

// 年齢別利用児童を計算
export const calculateAgeDistribution = (
  children: Child[],
  schedules: ScheduleItem[],
  currentMonth: Date = new Date()
): { age: string; count: number; percentage: number }[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });
  
  const activeChildIds = new Set(monthlySchedules.map((s) => s.childId));
  const activeChildren = children.filter((c) => activeChildIds.has(c.id));
  
  const ageGroups: Record<string, number> = {};
  
  activeChildren.forEach((child) => {
    if (child.age !== undefined) {
      const ageGroup = child.age < 3 ? '0-2歳' :
                      child.age < 6 ? '3-5歳' :
                      child.age < 9 ? '6-8歳' :
                      child.age < 12 ? '9-11歳' :
                      child.age < 15 ? '12-14歳' :
                      '15歳以上';
      ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1;
    } else {
      ageGroups['未設定'] = (ageGroups['未設定'] || 0) + 1;
    }
  });
  
  const total = activeChildren.length;
  
  return Object.entries(ageGroups)
    .map(([age, count]) => ({
      age,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => {
      const order = ['0-2歳', '3-5歳', '6-8歳', '9-11歳', '12-14歳', '15歳以上', '未設定'];
      return order.indexOf(a.age) - order.indexOf(b.age);
    });
};

// 利用児童の居住地区を計算
export const calculateAreaDistribution = (
  children: Child[],
  schedules: ScheduleItem[],
  currentMonth: Date = new Date()
): { area: string; count: number; percentage: number }[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });
  
  const activeChildIds = new Set(monthlySchedules.map((s) => s.childId));
  const activeChildren = children.filter((c) => activeChildIds.has(c.id));
  
  const areaGroups: Record<string, number> = {};
  
  activeChildren.forEach((child) => {
    if (child.address) {
      // 住所から市区町村を抽出（簡易版）
      // 例: "東京都渋谷区..." -> "渋谷区"
      const match = child.address.match(/(都|道|府|県)([^市区町村]+[市区町村])/);
      if (match && match[2]) {
        const area = match[2];
        areaGroups[area] = (areaGroups[area] || 0) + 1;
      } else {
        // マッチしない場合は最初の部分を使用
        const parts = child.address.split(/[都道府県市区町村]/);
        if (parts.length > 0 && parts[0]) {
          areaGroups[parts[0] + '（不明）'] = (areaGroups[parts[0] + '（不明）'] || 0) + 1;
        } else {
          areaGroups['未設定'] = (areaGroups['未設定'] || 0) + 1;
        }
      }
    } else {
      areaGroups['未設定'] = (areaGroups['未設定'] || 0) + 1;
    }
  });
  
  const total = activeChildren.length;
  
  return Object.entries(areaGroups)
    .map(([area, count]) => ({
      area,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
};

// 送迎利用率を計算
export const calculatePickupDropoffRate = (
  schedules: ScheduleItem[],
  currentMonth: Date = new Date()
): {
  pickupRate: number;
  dropoffRate: number;
  bothRate: number;
  totalSchedules: number;
  pickupCount: number;
  dropoffCount: number;
  bothCount: number;
} => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  const totalSchedules = monthlySchedules.length;
  const pickupCount = monthlySchedules.filter((s) => s.hasPickup).length;
  const dropoffCount = monthlySchedules.filter((s) => s.hasDropoff).length;
  const bothCount = monthlySchedules.filter((s) => s.hasPickup && s.hasDropoff).length;

  return {
    pickupRate: totalSchedules > 0 ? (pickupCount / totalSchedules) * 100 : 0,
    dropoffRate: totalSchedules > 0 ? (dropoffCount / totalSchedules) * 100 : 0,
    bothRate: totalSchedules > 0 ? (bothCount / totalSchedules) * 100 : 0,
    totalSchedules,
    pickupCount,
    dropoffCount,
    bothCount,
  };
};

// 問い合わせ経路別の新規問い合わせ数を計算
export const calculateInquiriesBySource = (
  children: Child[],
  leads: Lead[],
  months: number = 6
): {
  month: string;
  year: number;
  monthNum: number;
  contracts: number;
  inquiries: {
    devnavi: number;
    homepage: number;
    'support-office': number;
    other: number;
    total: number;
  };
}[] => {
  const now = new Date();
  const trend: {
    month: string;
    year: number;
    monthNum: number;
    contracts: number;
    inquiries: {
      devnavi: number;
      homepage: number;
      'support-office': number;
      other: number;
      total: number;
    };
  }[] = [];
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 実際の契約数（契約開始日がその月の児童）
    const contracts = children.filter((c) => {
      if (!c.contractStartDate) return false;
      const startDate = new Date(c.contractStartDate);
      return startDate.getFullYear() === year && startDate.getMonth() === month;
    }).length;
    
    // 新規問い合わせ数（問い合わせ経路別）
    const monthLeads = leads.filter((l) => {
      const leadDate = new Date(l.createdAt);
      return leadDate.getFullYear() === year && leadDate.getMonth() === month && l.status === 'new-inquiry';
    });
    
    const inquiries = {
      devnavi: monthLeads.filter((l) => l.inquirySource === 'devnavi').length,
      homepage: monthLeads.filter((l) => l.inquirySource === 'homepage').length,
      'support-office': monthLeads.filter((l) => l.inquirySource === 'support-office').length,
      other: monthLeads.filter((l) => l.inquirySource === 'other' || !l.inquirySource).length,
      total: monthLeads.length,
    };
    
    trend.push({
      month: `${year}年${month + 1}月`,
      year,
      monthNum: month + 1,
      contracts,
      inquiries,
    });
  }
  
  return trend;
};

// 曜日別利用率を計算
export const calculateDayOfWeekUtilization = (
  schedules: ScheduleItem[],
  capacity: { AM: number; PM: number },
  currentMonth: Date = new Date()
): {
  dayOfWeek: string;
  dayIndex: number;
  amCount: number;
  pmCount: number;
  amUtilization: number;
  pmUtilization: number;
  totalUtilization: number;
}[] => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
  const dayStats: {
    dayOfWeek: string;
    dayIndex: number;
    amCount: number;
    pmCount: number;
    amUtilization: number;
    pmUtilization: number;
    totalUtilization: number;
  }[] = [];

  daysOfWeek.forEach((day, dayIndex) => {
    const daySchedules = monthlySchedules.filter((s) => {
      const scheduleDate = new Date(s.date);
      return scheduleDate.getDay() === dayIndex;
    });

    const amCount = daySchedules.filter((s) => s.slot === 'AM').length;
    const pmCount = daySchedules.filter((s) => s.slot === 'PM').length;
    
    // 月のその曜日の日数を計算
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOccurrences = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      return date.getDay() === dayIndex;
    }).filter(Boolean).length;

    const amCapacity = dayOccurrences * capacity.AM;
    const pmCapacity = dayOccurrences * capacity.PM;
    
    const amUtilization = amCapacity > 0 ? (amCount / amCapacity) * 100 : 0;
    const pmUtilization = pmCapacity > 0 ? (pmCount / pmCapacity) * 100 : 0;
    const totalUtilization = (amCapacity + pmCapacity) > 0 
      ? ((amCount + pmCount) / (amCapacity + pmCapacity)) * 100 
      : 0;

    dayStats.push({
      dayOfWeek: day,
      dayIndex,
      amCount,
      pmCount,
      amUtilization,
      pmUtilization,
      totalUtilization,
    });
  });

  return dayStats;
};

// 午前・午後の稼働率を計算
export const calculateAMPMOccupancyRate = (
  schedules: ScheduleItem[],
  capacity: { AM: number; PM: number },
  facilitySettings: FacilitySettings,
  currentMonth: Date = new Date()
): {
  amRate: number;
  pmRate: number;
  amCount: number;
  pmCount: number;
  amCapacity: number;
  pmCapacity: number;
} => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  // 施設設定に基づいて営業日数を計算
  const businessDays = calculateBusinessDays(facilitySettings, year, month);

  const amCapacity = businessDays * capacity.AM;
  const pmCapacity = businessDays * capacity.PM;
  
  const amCount = monthlySchedules.filter((s) => s.slot === 'AM').length;
  const pmCount = monthlySchedules.filter((s) => s.slot === 'PM').length;

  return {
    amRate: amCapacity > 0 ? (amCount / amCapacity) * 100 : 0,
    pmRate: pmCapacity > 0 ? (pmCount / pmCapacity) * 100 : 0,
    amCount,
    pmCount,
    amCapacity,
    pmCapacity,
  };
};


