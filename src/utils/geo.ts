/**
 * 地理計算ユーティリティ（送迎トラッキング用）
 */

/** Haversine公式で2点間の距離を計算（メートル） */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371e3; // 地球の半径（メートル）
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 距離と速度からETA（秒）を推定 */
export function estimateEtaSeconds(distanceMeters: number, speedMs: number): number {
  if (speedMs <= 0) return 0;
  return Math.round(distanceMeters / speedMs);
}

/** 秒数を「X分」表記に変換 */
export function formatEtaMinutes(seconds: number): string {
  if (seconds <= 0) return 'まもなく';
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return '約1分';
  return `約${minutes}分`;
}

/** 2点間の方位角（度）を計算 */
export function bearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
