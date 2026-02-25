/**
 * GPS Geofencing Utility
 * 施設の位置情報を基にした打刻時のジオフェンス検証
 */

import { supabase } from '@/lib/supabase';

// ジオフェンス検証結果の型
export type GeoValidationResult = {
  isValid: boolean;
  distance: number;
  facilityLocation: { lat: number; lng: number } | null;
  userLocation: { lat: number; lng: number };
  error?: string;
};

// 位置情報エラーの型
type GeolocationErrorInfo = {
  code: number;
  message: string;
};

// デフォルトのジオフェンス半径（メートル）
const DEFAULT_GEOFENCE_RADIUS_METERS = 500;

// 位置情報取得のタイムアウト（ミリ秒）
const GEOLOCATION_TIMEOUT_MS = 15000;

// 地球の半径（メートル）
const EARTH_RADIUS_METERS = 6371000;

/**
 * 現在位置を取得する Promise ラッパー
 * navigator.geolocation.getCurrentPosition を Promise 化
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('このブラウザは位置情報をサポートしていません'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position);
      },
      (error: GeolocationPositionError) => {
        const errorInfo: GeolocationErrorInfo = {
          code: error.code,
          message: getGeolocationErrorMessage(error.code),
        };
        reject(new Error(errorInfo.message));
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 60000, // 1分以内のキャッシュを許可
      }
    );
  });
}

/**
 * 位置情報エラーコードに対応するメッセージを取得
 */
function getGeolocationErrorMessage(code: number): string {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return '位置情報の使用が許可されていません。ブラウザの設定で位置情報を許可してください。';
    case 2: // POSITION_UNAVAILABLE
      return '位置情報を取得できませんでした。電波状況を確認してください。';
    case 3: // TIMEOUT
      return '位置情報の取得がタイムアウトしました。再度お試しください。';
    default:
      return '位置情報の取得中にエラーが発生しました。';
  }
}

/**
 * Haversine 公式で2点間の距離（メートル）を計算
 * @param lat1 - 地点1の緯度（度）
 * @param lon1 - 地点1の経度（度）
 * @param lat2 - 地点2の緯度（度）
 * @param lon2 - 地点2の経度（度）
 * @returns 距離（メートル）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * 施設のジオフェンス範囲内にいるかを検証
 * - 施設に緯度経度が設定されていない場合は検証をスキップ（isValid: true）
 * - 位置情報取得に失敗した場合はエラーメッセージ付きで返却
 *
 * @param facilityId - 施設ID
 * @returns GeoValidationResult
 */
export async function validateGeofence(
  facilityId: string
): Promise<GeoValidationResult> {
  // 1. ユーザーの現在位置を取得
  let userPosition: GeolocationPosition;
  try {
    userPosition = await getCurrentPosition();
  } catch (err) {
    const message = err instanceof Error ? err.message : '位置情報の取得に失敗しました';
    return {
      isValid: false,
      distance: -1,
      facilityLocation: null,
      userLocation: { lat: 0, lng: 0 },
      error: message,
    };
  }

  const userLocation = {
    lat: userPosition.coords.latitude,
    lng: userPosition.coords.longitude,
  };

  // 2. 施設の位置情報とジオフェンス半径を取得
  const { data: facilitySettings, error: dbError } = await supabase
    .from('facility_settings')
    .select('latitude, longitude, geofence_radius_meters')
    .eq('facility_id', facilityId)
    .single();

  if (dbError) {
    console.warn('施設設定の取得に失敗:', dbError.message);
    // DB取得失敗時は検証スキップ（運用を妨げない）
    return {
      isValid: true,
      distance: -1,
      facilityLocation: null,
      userLocation,
      error: '施設の位置情報を取得できませんでした。検証をスキップします。',
    };
  }

  // 施設に緯度経度が設定されていない場合は検証スキップ
  if (
    !facilitySettings ||
    facilitySettings.latitude == null ||
    facilitySettings.longitude == null
  ) {
    return {
      isValid: true,
      distance: -1,
      facilityLocation: null,
      userLocation,
    };
  }

  const facilityLocation = {
    lat: Number(facilitySettings.latitude),
    lng: Number(facilitySettings.longitude),
  };

  // 3. 距離を計算
  const distance = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    facilityLocation.lat,
    facilityLocation.lng
  );

  // 4. ジオフェンス半径と比較
  const radiusMeters: number =
    facilitySettings.geofence_radius_meters != null
      ? Number(facilitySettings.geofence_radius_meters)
      : DEFAULT_GEOFENCE_RADIUS_METERS;

  const isValid = distance <= radiusMeters;

  return {
    isValid,
    distance: Math.round(distance * 10) / 10, // 小数点1桁
    facilityLocation,
    userLocation,
    error: isValid
      ? undefined
      : `施設から約${Math.round(distance)}m離れています（許容範囲: ${radiusMeters}m以内）。施設の近くで打刻してください。`,
  };
}
