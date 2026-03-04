'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { TransportSession, TransportRouteStop } from '@/types';

function mapSession(row: Record<string, unknown>): TransportSession {
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    date: row.date as string,
    mode: row.mode as 'pickup' | 'dropoff',
    status: row.status as TransportSession['status'],
    driverStaffId: row.driver_staff_id as string | undefined,
    attendantStaffId: row.attendant_staff_id as string | undefined,
    vehicleInfo: row.vehicle_info as string | undefined,
    routeStops: (row.route_stops as TransportRouteStop[]) || [],
    totalDistanceMeters: row.total_distance_meters as number | undefined,
    totalDurationSeconds: row.total_duration_seconds as number | undefined,
    currentLatitude: row.current_latitude as number | undefined,
    currentLongitude: row.current_longitude as number | undefined,
    currentHeading: row.current_heading as number | undefined,
    currentSpeed: row.current_speed as number | undefined,
    locationUpdatedAt: row.location_updated_at as string | undefined,
    currentStopIndex: (row.current_stop_index as number) || 0,
    nextStopEtaSeconds: row.next_stop_eta_seconds as number | undefined,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
    createdAt: row.created_at as string | undefined,
  };
}

interface UseTransportTrackerReturn {
  session: TransportSession | null;
  myChildIds: string[];
  myChildStopIndex: number | null;
  etaToMyStop: number | null;
  connectionStatus: string;
  isLocationStale: boolean;
  loading: boolean;
  error: string | null;
}

export function useTransportTracker(
  facilityId: string | undefined,
  userId: string | undefined,
  sessionIdParam?: string | null
): UseTransportTrackerReturn {
  const [session, setSession] = useState<TransportSession | null>(null);
  const [myChildIds, setMyChildIds] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayEta, setDisplayEta] = useState<number | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const serverEtaRef = useRef<number | null>(null);

  // 1. 自分の子どもを取得
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('children')
        .select('id')
        .eq('owner_profile_id', userId);
      setMyChildIds((data || []).map(c => c.id));
    })();
  }, [userId]);

  // 2. アクティブセッション発見
  useEffect(() => {
    if (!facilityId || myChildIds.length === 0) {
      setLoading(false);
      return;
    }

    const discover = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];

        // 特定のsessionIdが指定されている場合はそれを使用
        let query = supabase
          .from('transport_sessions')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('date', today);

        if (sessionIdParam) {
          query = query.eq('id', sessionIdParam);
        } else {
          query = query.in('status', ['active', 'preparing']);
        }

        const { data: sessions } = await query;

        if (!sessions || sessions.length === 0) {
          setSession(null);
          setLoading(false);
          return;
        }

        // 自分の子がルートに含まれるセッションを探す
        const matched = sessions.find(s => {
          const stops = (s.route_stops as TransportRouteStop[]) || [];
          return stops.some(stop => myChildIds.includes(stop.childId));
        });

        if (matched) {
          setSession(mapSession(matched));
        } else if (sessionIdParam && sessions.length > 0) {
          // パラメータで指定された場合はとりあえず表示
          setSession(mapSession(sessions[0]));
        }
      } catch (err) {
        setError('送迎情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    discover();
  }, [facilityId, myChildIds, sessionIdParam]);

  // 3. Supabase Realtime購読
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`transport_tracking:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transport_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          setSession(mapSession(updated));

          // サーバーETA更新
          const eta = updated.next_stop_eta_seconds as number | null;
          serverEtaRef.current = eta;
          if (eta !== null && eta !== undefined) {
            setDisplayEta(eta);
          }
        }
      )
      .subscribe((status) => {
        setConnectionStatus(status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session?.id]);

  // 4. ローカルETAカウントダウン（1秒ごとに減算）
  useEffect(() => {
    if (displayEta === null || displayEta <= 0) return;

    const interval = setInterval(() => {
      setDisplayEta(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自分の子のストップインデックス
  const myChildStopIndex = session?.routeStops.findIndex(
    stop => myChildIds.includes(stop.childId)
  ) ?? null;

  // 自分の子までのETA計算（次のストップからの積算）
  const etaToMyStop = (() => {
    if (!session || myChildStopIndex === null || myChildStopIndex < 0) return null;
    if (session.currentStopIndex > myChildStopIndex) return 0; // 通過済み
    if (session.currentStopIndex === myChildStopIndex) return displayEta;

    // 中間ストップのETA積算
    let totalEta = displayEta || 0;
    for (let i = session.currentStopIndex + 1; i <= myChildStopIndex; i++) {
      totalEta += session.routeStops[i]?.etaSeconds || 120; // デフォルト2分
    }
    return totalEta;
  })();

  // 位置情報が古い（2分以上更新なし）
  const isLocationStale = (() => {
    if (!session?.locationUpdatedAt) return false;
    const elapsed = Date.now() - new Date(session.locationUpdatedAt).getTime();
    return elapsed > 2 * 60 * 1000;
  })();

  return {
    session,
    myChildIds,
    myChildStopIndex: myChildStopIndex !== undefined ? myChildStopIndex : null,
    etaToMyStop,
    connectionStatus,
    isLocationStale,
    loading,
    error,
  };
}
