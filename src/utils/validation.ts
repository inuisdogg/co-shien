/**
 * 共通バリデーションユーティリティ
 */

// RFC 5322準拠に近いメールバリデーション
// ドメイン部分に2文字以上のTLDを必須にする
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// 日本の電話番号（固定・携帯）
const PHONE_REGEX = /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.replace(/[\s　]/g, ''));
}

// 正の整数チェック（給与、定員など）
export function isPositiveInteger(value: unknown): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

// 非負整数チェック
export function isNonNegativeInteger(value: unknown): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0;
}

// 給与の妥当性チェック（月給: 50,000～2,000,000、時給: 500～10,000）
export function isValidMonthlySalary(value: number): boolean {
  return Number.isFinite(value) && value >= 50000 && value <= 2000000;
}

export function isValidHourlyWage(value: number): boolean {
  return Number.isFinite(value) && value >= 500 && value <= 10000;
}
