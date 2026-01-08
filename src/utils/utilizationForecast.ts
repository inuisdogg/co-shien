/**
 * 利用見込み計算ロジック
 */

import { Child, FacilitySettings } from '@/types';
import { getJapaneseHolidays, isJapaneseHoliday } from './japaneseHolidays';

export type MonthlyUtilizationForecast = {
  year: number;
  month: number;
  totalSlots: number; // 理論上の総枠数
  forecastedSlots: number; // 予測される埋まり枠数
  utilizationRate: number; // 稼働率（%）
  dayOfWeekBreakdown: {
    dayIndex: number; // 0=日, 1=月, ..., 6=土
    dayOfWeek: string; // 曜日名
    amSlots: number; // 午前の予測枠数
    pmSlots: number; // 午後の予測枠数
    totalSlots: number; // 合計予測枠数
  }[];
  weeklyBreakdown: {
    week: number; // 週番号（1-5）
    startDate: string; // 週の開始日
    endDate: string; // 週の終了日
    amSlots: number;
    pmSlots: number;
    totalSlots: number;
    children: {
      childId: string;
      childName: string;
      days: number; // その週の利用日数
    }[];
  }[];
  dailyBreakdown: {
    date: string; // YYYY-MM-DD
    dayOfWeek: string;
    amSlots: number;
    pmSlots: number;
    totalSlots: number;
    children: {
      childId: string;
      childName: string;
      timeSlot: 'AM' | 'PM' | 'AMPM';
    }[];
  }[];
};

/**
 * 月別の利用見込みを計算
 */
export const calculateMonthlyUtilizationForecast = (
  children: Child[],
  facilitySettings: FacilitySettings,
  year: number,
  month: number
): MonthlyUtilizationForecast => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidays = facilitySettings.includeHolidays ? getJapaneseHolidays(year) : [];
  
  // 曜日別の集計
  const dayOfWeekSlots: Record<number, { AM: number; PM: number }> = {
    0: { AM: 0, PM: 0 },
    1: { AM: 0, PM: 0 },
    2: { AM: 0, PM: 0 },
    3: { AM: 0, PM: 0 },
    4: { AM: 0, PM: 0 },
    5: { AM: 0, PM: 0 },
    6: { AM: 0, PM: 0 },
  };
  
  // 日別の集計
  const dailySlots: Record<string, {
    AM: { children: { childId: string; childName: string }[] };
    PM: { children: { childId: string; childName: string }[] };
  }> = {};
  
  // 週別の集計
  const weeklySlots: Record<number, {
    AM: number;
    PM: number;
    children: Record<string, { childId: string; childName: string; days: number }>;
  }> = {};
  
  // 各児童の情報を処理
  children.forEach((child) => {
    // 契約開始日を決定（予定日または実績日）
    const startDate = child.contractStatus === 'pre-contract' 
      ? child.plannedUsageStartDate 
      : child.contractStartDate;
    
    if (!startDate) return;
    
    const start = new Date(startDate + 'T00:00:00');
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    
    // 対象月の範囲外の場合はスキップ
    if (startYear > year || (startYear === year && startMonth > month)) return;
    
    // 契約終了日を確認
    const endDate = child.contractEndDate ? new Date(child.contractEndDate + 'T00:00:00') : null;
    if (endDate) {
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();
      if (endYear < year || (endYear === year && endMonth < month)) return;
    }
    
    // 契約日数を決定（契約前は予定日数、契約中は実績日数）
    const contractDays = child.contractStatus === 'pre-contract'
      ? (child.plannedContractDays || 0)
      : (child.contractDays || 0);
    
    if (!contractDays || !child.patternDays || child.patternDays.length === 0) return;
    
    // 利用パターンから曜日と時間帯を取得
    const patternDays = child.patternDays;
    const patternTimeSlots = child.patternTimeSlots || {};
    
    // その月の営業日数を計算
    let businessDaysInMonth = 0;
    const dayOfWeekCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // 祝日チェック
      if (facilitySettings.includeHolidays && (holidays.includes(dateStr) || isJapaneseHoliday(dateStr))) {
        continue;
      }
      
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
      
      if (isHoliday) continue;
      
      // 契約開始日以降か確認
      if (date < start) continue;
      
      // 契約終了日以前か確認
      if (endDate && date > endDate) continue;
      
      // 利用パターンに該当する曜日か確認
      if (!patternDays.includes(dayOfWeek)) continue;
      
      businessDaysInMonth++;
      dayOfWeekCounts[dayOfWeek]++;
    }
    
    // 契約日数に基づいて、実際の利用日数を計算
    // 利用パターンの曜日がその月に何回出現するか
    const patternOccurrences = patternDays.reduce((sum, dayIndex) => {
      return sum + dayOfWeekCounts[dayIndex];
    }, 0);
    
    if (patternOccurrences > 0 && contractDays > 0) {
      // 実際の利用日数（契約日数に基づく按分、ただしその月の出現回数を超えない）
      const actualUsageDays = Math.min(contractDays, patternOccurrences);
      
      // 按分率を計算
      const ratio = actualUsageDays / patternOccurrences;
      
      // 各曜日について、実際に利用する日数を計算して集計
      patternDays.forEach((dayIndex) => {
        const occurrences = dayOfWeekCounts[dayIndex];
        const actualDays = Math.floor(occurrences * ratio);
        const timeSlot = patternTimeSlots[dayIndex] || 'PM';
        
        // その月の該当曜日の日付を取得して、実際の利用日数分だけ集計
        let usedDays = 0;
        for (let day = 1; day <= daysInMonth && usedDays < actualDays; day++) {
          const date = new Date(year, month, day);
          const dayOfWeek = date.getDay();
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          // 曜日が一致しない場合はスキップ
          if (dayOfWeek !== dayIndex) continue;
          
          // 祝日チェック
          if (facilitySettings.includeHolidays && (holidays.includes(dateStr) || isJapaneseHoliday(dateStr))) {
            continue;
          }
          
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
          
          if (!isHoliday && facilitySettings.regularHolidays.includes(dayOfWeek)) {
            isHoliday = true;
          }
          
          if (facilitySettings.customHolidays.includes(dateStr)) {
            isHoliday = true;
          }
          
          if (isHoliday) continue;
          
          // 契約開始日以降か確認
          if (date < start) continue;
          
          // 契約終了日以前か確認
          if (endDate && date > endDate) continue;
          
          // 日別の集計に追加
          if (!dailySlots[dateStr]) {
            dailySlots[dateStr] = {
              AM: { children: [] },
              PM: { children: [] },
            };
          }
          
          if (timeSlot === 'AM' || timeSlot === 'AMPM') {
            dailySlots[dateStr].AM.children.push({
              childId: child.id,
              childName: child.name,
            });
            dayOfWeekSlots[dayIndex].AM++;
          }
          
          if (timeSlot === 'PM' || timeSlot === 'AMPM') {
            dailySlots[dateStr].PM.children.push({
              childId: child.id,
              childName: child.name,
            });
            dayOfWeekSlots[dayIndex].PM++;
          }
          
          // 週別の集計に追加
          const weekNumber = Math.ceil(day / 7);
          if (!weeklySlots[weekNumber]) {
            weeklySlots[weekNumber] = {
              AM: 0,
              PM: 0,
              children: {},
            };
          }
          
          const childKey = child.id;
          if (!weeklySlots[weekNumber].children[childKey]) {
            weeklySlots[weekNumber].children[childKey] = {
              childId: child.id,
              childName: child.name,
              days: 0,
            };
          }
          weeklySlots[weekNumber].children[childKey].days++;
          
          if (timeSlot === 'AM' || timeSlot === 'AMPM') {
            weeklySlots[weekNumber].AM++;
          }
          if (timeSlot === 'PM' || timeSlot === 'AMPM') {
            weeklySlots[weekNumber].PM++;
          }
          
          usedDays++;
        }
      });
    }
  });
  
  // 曜日別の内訳を作成
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeekBreakdown = dayNames.map((dayName, index) => ({
    dayIndex: index,
    dayOfWeek: dayName,
    amSlots: dayOfWeekSlots[index].AM,
    pmSlots: dayOfWeekSlots[index].PM,
    totalSlots: dayOfWeekSlots[index].AM + dayOfWeekSlots[index].PM,
  }));
  
  // 週別の内訳を作成
  const weeklyBreakdown: MonthlyUtilizationForecast['weeklyBreakdown'] = [];
  for (let week = 1; week <= 5; week++) {
    const weekStartDay = (week - 1) * 7 + 1;
    const weekEndDay = Math.min(week * 7, daysInMonth);
    
    if (weekStartDay > daysInMonth) break;
    
    const startDate = new Date(year, month, weekStartDay);
    const endDate = new Date(year, month, weekEndDay);
    
    const weekData = weeklySlots[week] || { AM: 0, PM: 0, children: {} };
    
    weeklyBreakdown.push({
      week,
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(weekStartDay).padStart(2, '0')}`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(weekEndDay).padStart(2, '0')}`,
      amSlots: weekData.AM,
      pmSlots: weekData.PM,
      totalSlots: weekData.AM + weekData.PM,
      children: Object.values(weekData.children),
    });
  }
  
  // 日別の内訳を作成
  const dailyBreakdown: MonthlyUtilizationForecast['dailyBreakdown'] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayData = dailySlots[dateStr];
    if (!dayData) continue;
    
    dailyBreakdown.push({
      date: dateStr,
      dayOfWeek: dayNames[dayOfWeek],
      amSlots: dayData.AM.children.length,
      pmSlots: dayData.PM.children.length,
      totalSlots: dayData.AM.children.length + dayData.PM.children.length,
      children: [
        ...dayData.AM.children.map(c => ({ ...c, timeSlot: 'AM' as const })),
        ...dayData.PM.children.map(c => ({ ...c, timeSlot: 'PM' as const })),
        // AMPMの場合は両方に含まれているので重複を避ける
      ].filter((child, index, self) => 
        index === self.findIndex(c => c.childId === child.childId && c.timeSlot === child.timeSlot)
      ),
    });
  }
  
  // 実際の営業日数を計算
  let actualBusinessDays = 0;
  const dayOfWeekOccurrences: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // 祝日チェック
    if (facilitySettings.includeHolidays && (holidays.includes(dateStr) || isJapaneseHoliday(dateStr))) {
      continue;
    }
    
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
    
    if (!isHoliday) {
      actualBusinessDays++;
      dayOfWeekOccurrences[dayOfWeek]++;
    }
  }
  
  // 総枠数を計算（実際の営業日数 × 定員）
  const totalCapacity = actualBusinessDays * (facilitySettings.capacity.AM + facilitySettings.capacity.PM);
  
  // 予測される埋まり枠数
  const forecastedSlots = dayOfWeekBreakdown.reduce((sum, day) => sum + day.totalSlots, 0);
  
  // 稼働率
  const utilizationRate = totalCapacity > 0 ? (forecastedSlots / totalCapacity) * 100 : 0;
  
  return {
    year,
    month,
    totalSlots: totalCapacity,
    forecastedSlots,
    utilizationRate,
    dayOfWeekBreakdown,
    weeklyBreakdown,
    dailyBreakdown,
  };
};

