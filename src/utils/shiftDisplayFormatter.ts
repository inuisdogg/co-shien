/**
 * シフト表示フォーマッター
 * シフトを時間表記（例: 9-17, 12-18）に変換するユーティリティ
 */

import { ShiftWithPattern, ShiftPattern } from '@/types';

/**
 * 時間文字列をフォーマット
 * "09:00" -> "9", "12:30" -> "12:30"
 */
export function formatTimeShort(time: string | null | undefined): string {
  if (!time) return '';

  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);

  // 分が00の場合は時間のみ、それ以外は時間:分
  return m === '00' ? String(hour) : `${hour}:${m}`;
}

/**
 * シフトを時間表記に変換
 * @example "9-17", "12-18", "休", "-"
 */
export function formatShiftDisplay(shift: ShiftWithPattern): string {
  // シフトなし
  if (!shift.hasShift) return '-';

  // 休日パターン
  if (shift.shiftPattern?.isDayOff) return '休';

  // 時間を取得（シフト固有の時間 or パターンの時間）
  const startTime = shift.startTime || shift.shiftPattern?.startTime;
  const endTime = shift.endTime || shift.shiftPattern?.endTime;

  if (!startTime || !endTime) return '-';

  return `${formatTimeShort(startTime)}-${formatTimeShort(endTime)}`;
}

/**
 * シフトパターンを時間表記に変換
 * @example "早番 (9-17)", "遅番 (12-18)"
 */
export function formatPatternWithTime(pattern: ShiftPattern): string {
  if (pattern.isDayOff) {
    return pattern.name;
  }

  if (!pattern.startTime || !pattern.endTime) {
    return pattern.name;
  }

  const timeRange = `${formatTimeShort(pattern.startTime)}-${formatTimeShort(pattern.endTime)}`;
  return `${pattern.name} (${timeRange})`;
}

/**
 * シフトパターンの時間範囲のみを取得
 * @example "9-17", "12-18"
 */
export function formatPatternTimeRange(pattern: ShiftPattern): string {
  if (pattern.isDayOff) return '休';

  if (!pattern.startTime || !pattern.endTime) return '-';

  return `${formatTimeShort(pattern.startTime)}-${formatTimeShort(pattern.endTime)}`;
}

/**
 * 勤務時間を計算（時間単位）
 */
export function calculateWorkHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  breakMinutes: number = 0
): number {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const workMinutes = endMinutes - startMinutes - breakMinutes;

  return Math.max(0, workMinutes / 60);
}

/**
 * シフトの勤務時間を計算
 */
export function calculateShiftWorkHours(shift: ShiftWithPattern): number {
  if (!shift.hasShift || shift.shiftPattern?.isDayOff) return 0;

  const startTime = shift.startTime || shift.shiftPattern?.startTime;
  const endTime = shift.endTime || shift.shiftPattern?.endTime;
  const breakMinutes = shift.breakMinutes ?? shift.shiftPattern?.breakMinutes ?? 0;

  return calculateWorkHours(startTime, endTime, breakMinutes);
}

/**
 * 時間文字列をHH:mm形式に正規化
 * @example "9:00" -> "09:00", "12:30" -> "12:30"
 */
export function normalizeTimeString(time: string): string {
  const [h, m] = time.split(':');
  const hour = h.padStart(2, '0');
  const minute = (m || '00').padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * シフト表示用のカラークラスを取得
 */
export function getShiftDisplayColor(shift: ShiftWithPattern): string {
  if (!shift.hasShift) return 'text-gray-400';
  if (shift.shiftPattern?.isDayOff) return 'text-gray-500';
  if (shift.shiftPattern?.color) return ''; // カスタムカラーを使用
  return 'text-gray-700';
}

/**
 * シフト表示用の背景色を取得（薄い色）
 */
export function getShiftDisplayBgColor(shift: ShiftWithPattern): string {
  if (!shift.hasShift) return 'bg-gray-50';
  if (shift.shiftPattern?.isDayOff) return 'bg-gray-100';
  if (shift.shiftPattern?.color) {
    // カスタムカラーの場合は透明度を追加
    return ''; // インラインスタイルで対応
  }
  return 'bg-[#00c4cc]/5';
}

/**
 * パターンカラーをRGBA形式に変換（背景用）
 */
export function patternColorToRgba(hexColor: string | undefined, alpha: number = 0.15): string {
  if (!hexColor) return 'rgba(0, 196, 204, 0.15)'; // デフォルト: #00c4cc

  // #RRGGBB -> rgba
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
