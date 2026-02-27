/**
 * 日本語住所の正規化ユーティリティ
 * 全角数字の半角変換、ダッシュの統一、郵便番号のバリデーションなど
 */

// 全角数字 → 半角数字
const FULLWIDTH_DIGITS: Record<string, string> = {
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
};

// 全角ダッシュ類 → 半角ハイフン
const FULLWIDTH_DASHES = ['ー', '−', '―', '‐', '–', '—', '～'];

// 都道府県リスト
const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
  '沖縄県',
];

/**
 * 全角数字を半角数字に変換
 */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (ch) => FULLWIDTH_DIGITS[ch] || ch);
}

/**
 * 日本語住所を正規化
 * - 全角数字 → 半角数字
 * - 全角ダッシュ類 → 半角ハイフン (-)
 * - 全角スペース → 半角スペース
 *
 * 例:
 *   "東京都渋谷区渋谷１ー２ー３" → "東京都渋谷区渋谷1-2-3"
 *   "東京都渋谷区渋谷１丁目２番３号" → "東京都渋谷区渋谷1丁目2番3号"
 */
export function normalizeAddress(address: string): string {
  if (!address) return address;

  let result = address;

  // 全角数字 → 半角数字
  result = normalizeNumbers(result);

  // 全角ダッシュ類 → 半角ハイフン
  for (const dash of FULLWIDTH_DASHES) {
    result = result.split(dash).join('-');
  }

  // 全角スペース → 半角スペース
  result = result.replace(/\u3000/g, ' ');

  // 連続するハイフンを1つに
  result = result.replace(/-{2,}/g, '-');

  // 前後の空白をトリム
  result = result.trim();

  return result;
}

/**
 * 住所から都道府県を抽出
 * 住所の先頭に都道府県名がある場合にそれを返す
 */
export function extractPrefecture(address: string): string | null {
  if (!address) return null;

  for (const pref of PREFECTURES) {
    if (address.startsWith(pref)) {
      return pref;
    }
  }

  return null;
}

/**
 * 日本の郵便番号が有効かどうかを検証
 * "123-4567" または "1234567" の形式を受け付ける
 */
export function isValidPostalCode(code: string): boolean {
  if (!code) return false;
  const cleaned = code.replace(/-/g, '');
  return /^\d{7}$/.test(cleaned);
}

/**
 * 郵便番号をフォーマット
 * "1234567" → "123-4567"
 * すでにハイフン付きの場合はそのまま返す
 */
export function formatPostalCode(code: string): string {
  if (!code) return code;
  const cleaned = code.replace(/-/g, '');
  if (cleaned.length !== 7) return code;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}
