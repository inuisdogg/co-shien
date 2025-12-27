/**
 * ダッシュボード用の計算ロジック
 */

import { ScheduleItem, UsageRecord, Child, Staff, BookingRequest } from '@/types';

// 目標値
const TARGET_PROFIT = 1000000; // 100万円
const TARGET_OCCUPANCY_RATE = 90; // 90%
const TARGET_ARPU = 15000; // 15,000円
const TARGET_LABOR_RATIO = 47; // 47%

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
  currentMonth: Date = new Date()
): { rate: number; target: number } => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthlySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
  });

  // 営業日数を計算（簡易版：月の日数から日曜日を除外）
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const businessDays = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return date.getDay() !== 0; // 日曜日を除外
  }).filter(Boolean).length;

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

