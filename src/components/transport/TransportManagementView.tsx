/**
 * 送迎管理ビュー (TransportManagementView)
 *
 * 本日の送迎ルート最適化・ナビ連携・完了チェック + 送迎体制管理（週間）
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Car,
  Navigation,
  MapPin,
  CheckCircle2,
  Circle,
  Clock,
  Users,
  ChevronRight,
  Play,
  Square,
  Route,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  Phone,
  Home,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Child, TransportCompletionRecord } from '@/types';
import {
  calculateOptimizedRoute,
  calculateArrivalTimes,
  formatDistance,
  formatDuration,
  geocodeAddress,
  RouteResult,
  LatLng,
} from '@/utils/googleMaps';
import TransportAssignmentPanel from '@/components/schedule/TransportAssignmentPanel';

// ============================================================
// Types
// ============================================================

type TransportMode = 'pickup' | 'dropoff';

type TransportChild = {
  childId: string;
  childName: string;
  address: string;
  location: LatLng | null;
  scheduleId: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  parentPhone?: string;
  pickupLocation?: string;
};

type OptimizedStop = TransportChild & {
  order: number;
  estimatedArrival?: string;
  distanceFromPrev?: string;
  durationFromPrev?: string;
};

// ============================================================
// Helpers
// ============================================================

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ============================================================
// Main Component
// ============================================================

const TransportManagementView: React.FC = () => {
  const { facility, user } = useAuth();
  const facilityId = facility?.id || '';

  // Tab state
  const [activeTab, setActiveTab] = useState<'today' | 'assignment'>('today');
  const [mode, setMode] = useState<TransportMode>('pickup');

  // Data
  const [children, setChildren] = useState<Child[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<
    Array<{
      id: string;
      childId: string;
      hasPickup: boolean;
      hasDropoff: boolean;
    }>
  >([]);
  const [completionRecords, setCompletionRecords] = useState<TransportCompletionRecord[]>([]);
  const [facilityLocation, setFacilityLocation] = useState<LatLng | null>(null);
  const [facilityAddress, setFacilityAddress] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>(formatTime(new Date()));
  const [driverAssignment, setDriverAssignment] = useState<{
    pickupDriver?: string;
    pickupAttendant?: string;
    dropoffDriver?: string;
    dropoffAttendant?: string;
    vehicleInfo?: string;
    pickupTime?: string;
    dropoffTime?: string;
  }>({});

  // Route state
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [optimizedStops, setOptimizedStops] = useState<OptimizedStop[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Navigation mode
  const [isNavigating, setIsNavigating] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);

  const today = formatDateLocal(new Date());

  // ============================================================
  // Data Fetching
  // ============================================================

  // Fetch children
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { data } = await supabase
        .from('children')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('status', 'active');
      if (data) {
        const mapped: Child[] = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          facilityId: row.facility_id as string,
          name: row.name as string,
          nameKana: (row.name_kana as string) || '',
          birthDate: (row.birth_date as string) || '',
          address: (row.address as string) || '',
          postalCode: (row.postal_code as string) || '',
          guardianName: (row.guardian_name as string) || '',
          phone: (row.phone as string) || '',
          email: (row.email as string) || '',
          needsPickup: (row.needs_pickup as boolean) || false,
          needsDropoff: (row.needs_dropoff as boolean) || false,
          contractStatus: (row.contract_status as string || 'active') as Child['contractStatus'],
          pickupAddress: (row.pickup_address as string) || '',
          pickupLatitude: row.pickup_latitude ? Number(row.pickup_latitude) : undefined,
          pickupLongitude: row.pickup_longitude ? Number(row.pickup_longitude) : undefined,
          dropoffAddress: (row.dropoff_address as string) || '',
          dropoffLatitude: row.dropoff_latitude ? Number(row.dropoff_latitude) : undefined,
          dropoffLongitude: row.dropoff_longitude ? Number(row.dropoff_longitude) : undefined,
          pickupLocation: (row.pickup_location as string) || '',
          dropoffLocation: (row.dropoff_location as string) || '',
          characteristics: (row.characteristics as string) || '',
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        }));
        setChildren(mapped);
      }
    })();
  }, [facilityId]);

  // Fetch today's schedules with pickup/dropoff
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { data } = await supabase
        .from('schedules')
        .select('id, child_id, has_pickup, has_dropoff')
        .eq('facility_id', facilityId)
        .eq('date', today);
      if (data) {
        setTodaySchedules(
          data.map((row: Record<string, unknown>) => ({
            id: row.id as string,
            childId: row.child_id as string,
            hasPickup: row.has_pickup as boolean,
            hasDropoff: row.has_dropoff as boolean,
          })),
        );
      }
    })();
  }, [facilityId, today]);

  // Fetch completion records
  const fetchCompletionRecords = useCallback(async () => {
    if (!facilityId) return;
    const { data } = await supabase
      .from('transport_completion_records')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('date', today);
    if (data) {
      setCompletionRecords(
        data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          facilityId: row.facility_id as string,
          date: row.date as string,
          scheduleId: row.schedule_id as string,
          childId: row.child_id as string,
          pickupCompleted: (row.pickup_completed as boolean) || false,
          pickupCompletedAt: (row.pickup_completed_at as string) || undefined,
          pickupCompletedBy: (row.pickup_completed_by as string) || undefined,
          pickupNotes: (row.pickup_notes as string) || undefined,
          dropoffCompleted: (row.dropoff_completed as boolean) || false,
          dropoffCompletedAt: (row.dropoff_completed_at as string) || undefined,
          dropoffCompletedBy: (row.dropoff_completed_by as string) || undefined,
          dropoffNotes: (row.dropoff_notes as string) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        })),
      );
    }
  }, [facilityId, today]);

  useEffect(() => {
    fetchCompletionRecords();
  }, [fetchCompletionRecords]);

  // Fetch facility location
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { data } = await supabase
        .from('facility_settings')
        .select('settings')
        .eq('facility_id', facilityId)
        .single();
      if (data?.settings) {
        const s = data.settings as Record<string, unknown>;
        const addr = (s.address as string) || '';
        setFacilityAddress(addr);
        if (s.latitude && s.longitude) {
          setFacilityLocation({
            lat: Number(s.latitude),
            lng: Number(s.longitude),
          });
        } else if (addr) {
          const loc = await geocodeAddress(addr);
          if (loc) setFacilityLocation(loc);
        }
      }
      setLoading(false);
    })();
  }, [facilityId]);

  // Fetch today's transport assignment
  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { data } = await supabase
        .from('daily_transport_assignments')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('date', today)
        .single();
      if (data) {
        setDriverAssignment({
          pickupDriver: (data.pickup_driver_staff_id as string) || (data.driver_staff_id as string) || undefined,
          pickupAttendant: (data.pickup_attendant_staff_id as string) || (data.attendant_staff_id as string) || undefined,
          dropoffDriver: (data.dropoff_driver_staff_id as string) || (data.driver_staff_id as string) || undefined,
          dropoffAttendant: (data.dropoff_attendant_staff_id as string) || (data.attendant_staff_id as string) || undefined,
          vehicleInfo: (data.vehicle_info as string) || undefined,
          pickupTime: (data.pickup_time as string) || undefined,
          dropoffTime: (data.dropoff_time as string) || undefined,
        });
        // Set departure time from assignment
        const timeStr = mode === 'pickup'
          ? (data.pickup_time as string)
          : (data.dropoff_time as string);
        if (timeStr) {
          setDepartureTime(timeStr.substring(0, 5));
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, today]);

  // ============================================================
  // Derived Data
  // ============================================================

  const transportChildren = useMemo((): TransportChild[] => {
    const filtered = todaySchedules.filter((s) =>
      mode === 'pickup' ? s.hasPickup : s.hasDropoff,
    );

    return filtered
      .map((schedule) => {
        const child = children.find((c) => c.id === schedule.childId);
        if (!child) return null;

        const address =
          mode === 'pickup'
            ? child.pickupAddress || child.address || ''
            : child.dropoffAddress || child.address || '';

        const lat = mode === 'pickup' ? child.pickupLatitude : child.dropoffLatitude;
        const lng = mode === 'pickup' ? child.pickupLongitude : child.dropoffLongitude;

        const record = completionRecords.find(
          (r) => r.childId === child.id && r.scheduleId === schedule.id,
        );
        const completed =
          mode === 'pickup'
            ? record?.pickupCompleted || false
            : record?.dropoffCompleted || false;

        return {
          childId: child.id,
          childName: child.name,
          address,
          location: lat && lng ? { lat, lng } : null,
          scheduleId: schedule.id,
          completed,
          completedAt:
            mode === 'pickup' ? record?.pickupCompletedAt : record?.dropoffCompletedAt,
          completedBy:
            mode === 'pickup' ? record?.pickupCompletedBy : record?.dropoffCompletedBy,
          notes: mode === 'pickup' ? record?.pickupNotes : record?.dropoffNotes,
          parentPhone: child.phone,
          pickupLocation:
            mode === 'pickup' ? child.pickupLocation : child.dropoffLocation,
        } as TransportChild;
      })
      .filter(Boolean) as TransportChild[];
  }, [todaySchedules, children, completionRecords, mode]);

  const pickupCount = todaySchedules.filter((s) => s.hasPickup).length;
  const dropoffCount = todaySchedules.filter((s) => s.hasDropoff).length;
  const completedPickup = completionRecords.filter((r) => r.pickupCompleted).length;
  const completedDropoff = completionRecords.filter((r) => r.dropoffCompleted).length;

  // ============================================================
  // Route Optimization
  // ============================================================

  const calculateRoute = useCallback(async () => {
    if (!facilityLocation) {
      setRouteError('施設の位置情報が設定されていません。施設情報で住所を登録してください。');
      return;
    }

    const childrenWithLocation = transportChildren.filter((c) => c.location);
    const childrenWithoutLocation = transportChildren.filter((c) => !c.location && c.address);

    // Geocode missing locations
    setCalculating(true);
    setRouteError(null);

    try {
      // Geocode any children without coordinates
      const geocoded = new Map<string, LatLng>();
      for (const child of childrenWithoutLocation) {
        const loc = await geocodeAddress(child.address);
        if (loc) {
          geocoded.set(child.childId, loc);
        }
      }

      const allChildren = transportChildren.map((c) => ({
        ...c,
        location: c.location || geocoded.get(c.childId) || null,
      }));

      const routableChildren = allChildren.filter((c) => c.location);

      if (routableChildren.length === 0) {
        setRouteError('送迎先の住所・座標が登録されていません。児童管理で住所を設定してください。');
        setCalculating(false);
        return;
      }

      const waypoints = routableChildren.map((c) => ({
        location: c.location!,
        childId: c.childId,
        childName: c.childName,
      }));

      // For pickup: facility is destination (picking up kids → bring to facility)
      // For dropoff: facility is origin (leaving facility → drop off kids)
      const origin = mode === 'pickup' ? facilityLocation : facilityLocation;
      const destination = facilityLocation;

      const result = await calculateOptimizedRoute(origin, waypoints, destination);

      if (!result) {
        setRouteError('ルート計算に失敗しました。Google Maps APIキーを確認してください。');
        setCalculating(false);
        return;
      }

      setRouteResult(result);

      // Build optimized stops
      const arrivalTimes = calculateArrivalTimes(departureTime, result.legs);
      const orderedStops: OptimizedStop[] = result.waypointOrder.map((wpIdx, orderIdx) => {
        const child = routableChildren[wpIdx];
        const leg = result.legs[orderIdx];
        return {
          ...child,
          order: orderIdx + 1,
          estimatedArrival: arrivalTimes[orderIdx],
          distanceFromPrev: leg ? formatDistance(leg.distance) : undefined,
          durationFromPrev: leg ? formatDuration(leg.duration) : undefined,
        };
      });

      // Add children without location at the end
      const noLocationChildren = allChildren.filter((c) => !c.location);
      noLocationChildren.forEach((c, idx) => {
        orderedStops.push({
          ...c,
          order: orderedStops.length + idx + 1,
        });
      });

      setOptimizedStops(orderedStops);
    } catch (err) {
      console.error('Route calculation error:', err);
      setRouteError('ルート計算中にエラーが発生しました');
    } finally {
      setCalculating(false);
    }
  }, [facilityLocation, transportChildren, mode, departureTime]);

  // ============================================================
  // Google Maps Navigation URL
  // ============================================================

  const googleMapsUrl = useMemo(() => {
    if (!facilityLocation || optimizedStops.length === 0) return null;

    const stopsWithLocation = optimizedStops.filter((s) => s.location);
    if (stopsWithLocation.length === 0) return null;

    // Build Google Maps Directions URL
    const origin = `${facilityLocation.lat},${facilityLocation.lng}`;
    const destination = `${facilityLocation.lat},${facilityLocation.lng}`;
    const waypoints = stopsWithLocation
      .map((s) => `${s.location!.lat},${s.location!.lng}`)
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  }, [facilityLocation, optimizedStops]);

  // ============================================================
  // Completion Handlers
  // ============================================================

  const toggleCompletion = useCallback(
    async (child: TransportChild) => {
      if (!facilityId || !user?.id) return;

      const newCompleted = !child.completed;
      const now = new Date().toISOString();

      const existing = completionRecords.find(
        (r) => r.childId === child.childId && r.scheduleId === child.scheduleId,
      );

      const updateData =
        mode === 'pickup'
          ? {
              pickup_completed: newCompleted,
              pickup_completed_at: newCompleted ? now : null,
              pickup_completed_by: newCompleted ? user.id : null,
            }
          : {
              dropoff_completed: newCompleted,
              dropoff_completed_at: newCompleted ? now : null,
              dropoff_completed_by: newCompleted ? user.id : null,
            };

      if (existing) {
        await supabase
          .from('transport_completion_records')
          .update({ ...updateData, updated_at: now })
          .eq('id', existing.id);
      } else {
        await supabase.from('transport_completion_records').insert({
          facility_id: facilityId,
          date: today,
          schedule_id: child.scheduleId,
          child_id: child.childId,
          ...updateData,
          created_at: now,
          updated_at: now,
        });
      }

      await fetchCompletionRecords();
    },
    [facilityId, user?.id, completionRecords, mode, today, fetchCompletionRecords],
  );

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#00c4cc]/10 rounded-lg flex items-center justify-center">
            <Car className="w-5 h-5 text-[#00c4cc]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">送迎管理</h2>
            <p className="text-xs text-gray-500">ルート最適化・ナビ連携・完了チェック</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'today'
              ? 'bg-white text-[#00c4cc] shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Navigation className="w-4 h-4" />
            本日の送迎
          </span>
        </button>
        <button
          onClick={() => setActiveTab('assignment')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'assignment'
              ? 'bg-white text-[#00c4cc] shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            送迎体制（週間）
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'assignment' ? (
        <TransportAssignmentPanel />
      ) : (
        <div className="flex-1 space-y-4 overflow-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1">迎え</div>
              <div className="text-2xl font-bold text-[#006064]">{pickupCount}<span className="text-sm font-normal text-gray-400 ml-0.5">名</span></div>
              <div className="text-xs text-[#00c4cc] mt-1">{completedPickup}名 完了</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1">送り</div>
              <div className="text-2xl font-bold text-orange-600">{dropoffCount}<span className="text-sm font-normal text-gray-400 ml-0.5">名</span></div>
              <div className="text-xs text-orange-500 mt-1">{completedDropoff}名 完了</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1">担当</div>
              <div className="text-sm font-bold text-gray-800 truncate">
                {mode === 'pickup'
                  ? driverAssignment.pickupDriver ? '配置済' : '未定'
                  : driverAssignment.dropoffDriver ? '配置済' : '未定'}
              </div>
              {driverAssignment.vehicleInfo && (
                <div className="text-xs text-gray-400 mt-1 truncate">{driverAssignment.vehicleInfo}</div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1">出発予定</div>
              <div className="text-xl font-bold text-gray-800">
                {mode === 'pickup'
                  ? driverAssignment.pickupTime?.substring(0, 5) || '--:--'
                  : driverAssignment.dropoffTime?.substring(0, 5) || '--:--'}
              </div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => { setMode('pickup'); setRouteResult(null); setOptimizedStops([]); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'pickup'
                    ? 'bg-[#00c4cc] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                迎え ({pickupCount})
              </button>
              <button
                onClick={() => { setMode('dropoff'); setRouteResult(null); setOptimizedStops([]); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'dropoff'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                送り ({dropoffCount})
              </button>
            </div>

            {/* Departure Time */}
            <div className="flex items-center gap-2 ml-auto">
              <Clock className="w-4 h-4 text-gray-400" />
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
            </div>
          </div>

          {/* Route Optimization */}
          {transportChildren.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={calculateRoute}
                disabled={calculating}
                className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] disabled:bg-gray-300 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                {calculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ルート計算中...
                  </>
                ) : (
                  <>
                    <Route className="w-4 h-4" />
                    ルートを最適化
                  </>
                )}
              </button>

              {googleMapsUrl && (
                <>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                  >
                    <Navigation className="w-4 h-4" />
                    Google Mapsで開く
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {!isNavigating ? (
                    <button
                      onClick={() => setIsNavigating(true)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                    >
                      <Play className="w-4 h-4" />
                      送迎スタート
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsNavigating(false)}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                    >
                      <Square className="w-4 h-4" />
                      送迎終了
                    </button>
                  )}
                </>
              )}

              {routeResult && (
                <button
                  onClick={() => { setRouteResult(null); setOptimizedStops([]); }}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-2.5 text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  リセット
                </button>
              )}
            </div>
          )}

          {/* Route Error */}
          {routeError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{routeError}</p>
              </div>
            </div>
          )}

          {/* Route Summary */}
          {routeResult && routeResult.legs.length > 0 && (
            <div className={`rounded-xl border shadow-sm p-4 ${
              mode === 'pickup' ? 'bg-[#e0f7fa]/30 border-[#b2ebf2]/50' : 'bg-orange-50/50 border-orange-100/50'
            }`}>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-gray-500">総距離:</span>
                  <span className="font-bold text-gray-800 ml-1">
                    {formatDistance(routeResult.totalDistance)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">所要時間:</span>
                  <span className="font-bold text-gray-800 ml-1">
                    {formatDuration(routeResult.totalDuration)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">停車数:</span>
                  <span className="font-bold text-gray-800 ml-1">
                    {optimizedStops.length}箇所
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Children List / Optimized Route */}
          <div className="space-y-2">
            {/* Starting point */}
            {(optimizedStops.length > 0 || isNavigating) && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="w-8 h-8 bg-gray-800 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  S
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800">施設（出発地）</div>
                  <div className="text-xs text-gray-500 truncate">{facilityAddress || '住所未設定'}</div>
                </div>
                <div className="text-xs text-gray-400">{departureTime} 出発</div>
              </div>
            )}

            {/* Optimized stops or plain list */}
            {(optimizedStops.length > 0 ? optimizedStops : transportChildren.map((c, i) => ({ ...c, order: i + 1 } as OptimizedStop))).map(
              (stop) => {
                const isCompleted = stop.completed;
                const accentColor = mode === 'pickup' ? '#00c4cc' : '#f97316';

                return (
                  <div
                    key={`${stop.childId}-${stop.scheduleId}`}
                    className={`rounded-xl border shadow-sm transition-all ${
                      isCompleted
                        ? 'bg-gray-50 border-gray-200 opacity-70'
                        : 'bg-white border-gray-200 hover:shadow-md'
                    } ${isNavigating && !isCompleted ? (mode === 'pickup' ? 'ring-2 ring-[#00c4cc] ring-offset-1' : 'ring-2 ring-orange-500 ring-offset-1') : ''}`}
                  >
                    <div className="flex items-center gap-3 p-4">
                      {/* Order number */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                        style={{ backgroundColor: isCompleted ? '#9ca3af' : accentColor }}
                      >
                        {stop.order}
                      </div>

                      {/* Child info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {stop.childName}
                          </span>
                          {stop.pickupLocation && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                              {stop.pickupLocation === '自宅' ? (
                                <Home className="w-3 h-3" />
                              ) : stop.pickupLocation === '事業所' ? (
                                <Building2 className="w-3 h-3" />
                              ) : (
                                <MapPin className="w-3 h-3" />
                              )}
                              {stop.pickupLocation}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {stop.address || '住所未登録'}
                        </div>
                        {/* Route info */}
                        {stop.estimatedArrival && (
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className="text-gray-500">
                              <Clock className="w-3 h-3 inline mr-0.5" />
                              到着予定 {stop.estimatedArrival}
                            </span>
                            {stop.distanceFromPrev && (
                              <span className="text-gray-400">
                                {stop.distanceFromPrev} / {stop.durationFromPrev}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Completed info */}
                        {isCompleted && stop.completedAt && (
                          <div className="text-xs text-green-600 mt-1">
                            <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                            {new Date(stop.completedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 完了
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {stop.parentPhone && (
                          <a
                            href={`tel:${stop.parentPhone}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="保護者に電話"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {stop.location && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${stop.location.lat},${stop.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="地図で見る"
                          >
                            <MapPin className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => toggleCompletion(stop)}
                          className={`p-2 rounded-lg transition-colors ${
                            isCompleted
                              ? 'text-green-600 bg-green-50 hover:bg-green-100'
                              : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
                          }`}
                          title={isCompleted ? '完了取消' : '完了にする'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Arrow between stops */}
                    {!isCompleted && optimizedStops.length > 0 && stop.order < optimizedStops.length && (
                      <div className="flex justify-center -mb-1">
                        <ArrowRight className="w-4 h-4 text-gray-300 rotate-90" />
                      </div>
                    )}
                  </div>
                );
              },
            )}

            {/* Return to facility */}
            {(optimizedStops.length > 0 || isNavigating) && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="w-8 h-8 bg-gray-800 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  G
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800">施設（到着地）</div>
                  <div className="text-xs text-gray-500 truncate">{facilityAddress || '住所未設定'}</div>
                </div>
                {routeResult && routeResult.legs.length > 0 && (
                  <div className="text-xs text-gray-400">
                    {calculateArrivalTimes(departureTime, routeResult.legs).slice(-1)[0]} 着予定
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {transportChildren.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Car className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">
                  本日の{mode === 'pickup' ? '迎え' : '送り'}対象はありません
                </p>
                <p className="text-xs mt-1">
                  利用予約で送迎の有無を設定してください
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportManagementView;
