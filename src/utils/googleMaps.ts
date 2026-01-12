/**
 * Google Maps API ユーティリティ
 * 送迎ルート計算・住所→座標変換
 */

// 座標
export interface LatLng {
  lat: number;
  lng: number;
}

// ルート計算結果
export interface RouteResult {
  totalDistance: number; // メートル
  totalDuration: number; // 秒
  waypointOrder: number[]; // 最適化された順序
  legs: RouteLeg[];
}

// ルートの各区間
export interface RouteLeg {
  startAddress: string;
  endAddress: string;
  distance: number; // メートル
  duration: number; // 秒
}

// 送迎ポイント
export interface TransportPoint {
  childId: string;
  childName: string;
  address: string;
  location?: LatLng;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * 住所から座標を取得（Geocoding API）
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!API_KEY) {
    console.error('Google Maps API key is not set');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${API_KEY}&language=ja`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }

    console.warn('Geocoding failed:', data.status, address);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * 複数の住所を一括で座標変換
 */
export async function geocodeAddresses(addresses: string[]): Promise<Map<string, LatLng | null>> {
  const results = new Map<string, LatLng | null>();

  // 並列で処理（APIレート制限に注意）
  const promises = addresses.map(async (address) => {
    const location = await geocodeAddress(address);
    results.set(address, location);
  });

  await Promise.all(promises);
  return results;
}

/**
 * 最短ルートを計算（Directions API + optimizeWaypoints）
 */
export async function calculateOptimizedRoute(
  origin: LatLng,
  waypoints: { location: LatLng; childId: string; childName: string }[],
  destination: LatLng
): Promise<RouteResult | null> {
  if (!API_KEY) {
    console.error('Google Maps API key is not set');
    return null;
  }

  if (waypoints.length === 0) {
    return {
      totalDistance: 0,
      totalDuration: 0,
      waypointOrder: [],
      legs: [],
    };
  }

  try {
    // Waypointsをフォーマット
    const waypointsStr = waypoints
      .map((wp) => `${wp.location.lat},${wp.location.lng}`)
      .join('|');

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.set('waypoints', `optimize:true|${waypointsStr}`);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('language', 'ja');
    url.searchParams.set('mode', 'driving');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Directions API error:', data.status, data.error_message);
      return null;
    }

    const route = data.routes[0];
    const legs: RouteLeg[] = route.legs.map((leg: any) => ({
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      distance: leg.distance.value,
      duration: leg.duration.value,
    }));

    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);

    return {
      totalDistance,
      totalDuration,
      waypointOrder: route.waypoint_order || [],
      legs,
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    return null;
  }
}

/**
 * カスタム順でルートを計算（optimizeWaypoints: false）
 */
export async function calculateCustomRoute(
  origin: LatLng,
  waypoints: { location: LatLng; childId: string; childName: string }[],
  destination: LatLng
): Promise<RouteResult | null> {
  if (!API_KEY) {
    console.error('Google Maps API key is not set');
    return null;
  }

  if (waypoints.length === 0) {
    return {
      totalDistance: 0,
      totalDuration: 0,
      waypointOrder: waypoints.map((_, i) => i),
      legs: [],
    };
  }

  try {
    const waypointsStr = waypoints
      .map((wp) => `${wp.location.lat},${wp.location.lng}`)
      .join('|');

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.set('waypoints', waypointsStr); // optimize:trueを付けない
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('language', 'ja');
    url.searchParams.set('mode', 'driving');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Directions API error:', data.status, data.error_message);
      return null;
    }

    const route = data.routes[0];
    const legs: RouteLeg[] = route.legs.map((leg: any) => ({
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      distance: leg.distance.value,
      duration: leg.duration.value,
    }));

    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);

    return {
      totalDistance,
      totalDuration,
      waypointOrder: waypoints.map((_, i) => i), // 指定順を維持
      legs,
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    return null;
  }
}

/**
 * 距離をフォーマット（km表示）
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 所要時間をフォーマット
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }
  return `${minutes}分`;
}

/**
 * 出発時刻から各地点の到着予定時刻を計算
 */
export function calculateArrivalTimes(
  departureTime: string, // HH:mm形式
  legs: RouteLeg[]
): string[] {
  const [hours, minutes] = departureTime.split(':').map(Number);
  let currentTime = hours * 60 + minutes; // 分に変換

  const arrivalTimes: string[] = [];

  for (const leg of legs) {
    currentTime += Math.ceil(leg.duration / 60); // 秒→分
    const h = Math.floor(currentTime / 60) % 24;
    const m = currentTime % 60;
    arrivalTimes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }

  return arrivalTimes;
}
