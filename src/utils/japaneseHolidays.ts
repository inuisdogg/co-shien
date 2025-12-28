/**
 * 日本の祝日を計算するユーティリティ
 */

/**
 * 指定された年の日本の祝日を計算して返す
 * @param year 年（例: 2024）
 * @returns 祝日の日付文字列の配列（YYYY-MM-DD形式）
 */
export function getJapaneseHolidays(year: number): string[] {
  const holidays: string[] = [];

  // 固定祝日
  holidays.push(`${year}-01-01`); // 元日
  holidays.push(`${year}-02-11`); // 建国記念の日
  holidays.push(`${year}-04-29`); // 昭和の日
  holidays.push(`${year}-05-03`); // 憲法記念日
  holidays.push(`${year}-05-04`); // みどりの日
  holidays.push(`${year}-05-05`); // こどもの日
  holidays.push(`${year}-08-11`); // 山の日
  holidays.push(`${year}-11-03`); // 文化の日
  holidays.push(`${year}-11-23`); // 勤労感謝の日
  holidays.push(`${year}-12-23`); // 天皇誕生日（2019年まで）

  // 2020年以降は天皇誕生日が2月23日に変更
  if (year >= 2020) {
    holidays.push(`${year}-02-23`); // 天皇誕生日
    // 12月23日を削除
    const index = holidays.indexOf(`${year}-12-23`);
    if (index > -1) {
      holidays.splice(index, 1);
    }
  }

  // 春分の日（3月20日または21日）
  const springEquinox = getSpringEquinox(year);
  holidays.push(springEquinox);

  // 秋分の日（9月22日または23日）
  const autumnEquinox = getAutumnEquinox(year);
  holidays.push(autumnEquinox);

  // 海の日（7月の第3月曜日、2020年以降は7月23日固定）
  if (year >= 2020) {
    holidays.push(`${year}-07-23`); // 海の日（2020年以降は固定）
  } else {
    const marineDay = getMarineDay(year);
    holidays.push(marineDay);
  }

  // 敬老の日（9月の第3月曜日）
  const respectForTheAgedDay = getRespectForTheAgedDay(year);
  holidays.push(respectForTheAgedDay);

  // 体育の日/スポーツの日（10月の第2月曜日、2020年以降は7月24日固定）
  if (year >= 2020) {
    holidays.push(`${year}-07-24`); // スポーツの日（2020年以降は固定）
  } else {
    const sportsDay = getSportsDay(year);
    holidays.push(sportsDay);
  }

  // 振替休日を計算
  const substituteHolidays = getSubstituteHolidays(year, holidays);
  holidays.push(...substituteHolidays);

  // 日付順にソート
  holidays.sort();

  return holidays;
}

/**
 * 春分の日を計算
 */
function getSpringEquinox(year: number): string {
  // 簡易計算式（1900-2099年で有効）
  if (year <= 2099) {
    const day = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    return `${year}-03-${String(day).padStart(2, '0')}`;
  }
  // デフォルトは3月20日
  return `${year}-03-20`;
}

/**
 * 秋分の日を計算
 */
function getAutumnEquinox(year: number): string {
  // 簡易計算式（1900-2099年で有効）
  if (year <= 2099) {
    const day = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    return `${year}-09-${String(day).padStart(2, '0')}`;
  }
  // デフォルトは9月23日
  return `${year}-09-23`;
}

/**
 * 海の日を計算（7月の第3月曜日、2020年以前のみ）
 */
function getMarineDay(year: number): string {
  // 7月1日の曜日を取得
  const july1 = new Date(year, 6, 1);
  const dayOfWeek = july1.getDay(); // 0=日曜日, 1=月曜日, ...
  
  // 第3月曜日までの日数を計算
  // 月曜日(1)なら14日後、日曜日(0)なら15日後、火曜日(2)なら13日後、...
  const daysToAdd = (1 - dayOfWeek + 7) % 7 + 14;
  
  const marineDay = new Date(year, 6, 1 + daysToAdd);
  const month = String(marineDay.getMonth() + 1).padStart(2, '0');
  const day = String(marineDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 敬老の日を計算（9月の第3月曜日）
 */
function getRespectForTheAgedDay(year: number): string {
  // 9月1日の曜日を取得
  const september1 = new Date(year, 8, 1);
  const dayOfWeek = september1.getDay(); // 0=日曜日, 1=月曜日, ...
  
  // 第3月曜日までの日数を計算
  // 月曜日(1)なら14日後、日曜日(0)なら15日後、火曜日(2)なら13日後、...
  const daysToAdd = (1 - dayOfWeek + 7) % 7 + 14;
  
  const respectDay = new Date(year, 8, 1 + daysToAdd);
  const month = String(respectDay.getMonth() + 1).padStart(2, '0');
  const day = String(respectDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 体育の日/スポーツの日を計算（10月の第2月曜日、2020年以前のみ）
 */
function getSportsDay(year: number): string {
  // 10月1日の曜日を取得
  const october1 = new Date(year, 9, 1);
  const dayOfWeek = october1.getDay(); // 0=日曜日, 1=月曜日, ...
  
  // 第2月曜日までの日数を計算
  // 月曜日(1)なら7日後、日曜日(0)なら8日後、火曜日(2)なら6日後、...
  const daysToAdd = (1 - dayOfWeek + 7) % 7 + 7;
  
  const sportsDay = new Date(year, 9, 1 + daysToAdd);
  const month = String(sportsDay.getMonth() + 1).padStart(2, '0');
  const day = String(sportsDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 振替休日を計算
 * 祝日が日曜日の場合、その翌日（月曜日）を振替休日とする
 */
function getSubstituteHolidays(year: number, holidays: string[]): string[] {
  const substituteHolidays: string[] = [];
  
  holidays.forEach((holiday) => {
    const date = new Date(holiday + 'T00:00:00');
    const dayOfWeek = date.getDay();
    
    // 日曜日の場合、翌日（月曜日）を振替休日とする
    if (dayOfWeek === 0) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const month = String(nextDay.getMonth() + 1).padStart(2, '0');
      const day = String(nextDay.getDate()).padStart(2, '0');
      const substituteDate = `${nextDay.getFullYear()}-${month}-${day}`;
      
      // 既に祝日リストに含まれていない場合のみ追加
      if (!holidays.includes(substituteDate)) {
        substituteHolidays.push(substituteDate);
      }
    }
  });
  
  return substituteHolidays;
}

/**
 * 指定された日付が日本の祝日かどうかを判定
 * @param dateStr 日付文字列（YYYY-MM-DD形式）
 * @returns 祝日の場合true
 */
export function isJapaneseHoliday(dateStr: string): boolean {
  // 日付文字列を直接パースして年を取得（タイムゾーン問題を回避）
  const [yearStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const holidays = getJapaneseHolidays(year);
  return holidays.includes(dateStr);
}

