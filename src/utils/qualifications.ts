/**
 * 資格データのパースユーティリティ
 * DB上 TEXT / TEXT[] の両方に対応
 */
export function parseQualifications(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map(q => q.trim()).filter(Boolean);
  return [];
}
