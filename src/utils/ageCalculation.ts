/**
 * 年齢計算ユーティリティ
 */

export type AgeWithMonths = {
  years: number;
  months: number;
  display: string;
};

/**
 * 生年月日から「○歳○ヶ月」形式の年齢を計算
 * @param birthDate - 生年月日（YYYY-MM-DD形式）
 * @returns 年、月、表示用文字列
 */
export function calculateAgeWithMonths(birthDate: string): AgeWithMonths {
  const birth = new Date(birthDate);
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  // 日付がまだ来ていない場合は1ヶ月引く
  if (today.getDate() < birth.getDate()) {
    months--;
  }

  // 月がマイナスの場合は年を1減らして12を足す
  if (months < 0) {
    years--;
    months += 12;
  }

  return {
    years,
    months,
    display: `${years}歳${months}ヶ月`,
  };
}

/**
 * 年齢のみを計算（既存互換用）
 * @param birthDate - 生年月日（YYYY-MM-DD形式）
 * @returns 年齢（歳）
 */
export function calculateAge(birthDate: string): number {
  const result = calculateAgeWithMonths(birthDate);
  return result.years;
}
