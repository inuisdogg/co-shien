'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { createNotification } from '@/hooks/useNotifications';
import { haversineDistance, estimateEtaSeconds } from '@/utils/geo';
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

interface UseTransportSessionReturn {
  activeSession: TransportSession | null;
  gpsStatus: 'idle' | 'tracking' | 'error';
  gpsError: string | null;
  loading: boolean;
  startSession: (params: StartSessionParams) => Promise<TransportSession | null>;
  completeSession: () => Promise<void>;
  cancelSession: () => Promise<void>;
  markStopArrived: (stopIndex: number) => Promise<void>;
  skipStop: (stopIndex: number) => Promise<void>;
  loadActiveSession: (facilityId: string, mode: 'pickup' | 'dropoff') => Promise<void>;
}

interface StartSessionParams {
  facilityId: string;
  mode: 'pickup' | 'dropoff';
  routeStops: TransportRouteStop[];
  driverStaffId?: string;
  attendantStaffId?: string;
  vehicleInfo?: string;
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
}

export function useTransportSession(): UseTransportSessionReturn {
  const [activeSession, setActiveSession] = useState<TransportSession | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'tracking' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastPosUpdateRef = useRef<number>(0);
  const lastHistoryRef = useRef<number>(0);
  const sessionRef = useRef<TransportSession | null>(null);
  const approachNotifiedRef = useRef<Set<number>>(new Set());
  const arrivedNotifiedRef = useRef<Set<number>>(new Set());

  // Keep sessionRef in sync
  useEffect(() => {
    sessionRef.current = activeSession;
  }, [activeSession]);

  // Cleanup on unmount + beforeunload safety
  useEffect(() => {
    const handleBeforeUnload = () => {
      // ブラウザ閉じる前にGPS停止（セッションはDB上activeのまま残る → 再開可能）
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // 既存アクティブセッション読み込み（ページリロード時の復帰用）
  const loadActiveSession = useCallback(async (facilityId: string, mode: 'pickup' | 'dropoff') => {
    try {
      const { data } = await supabase
        .from('transport_sessions')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('date', today)
        .eq('mode', mode)
        .in('status', ['active', 'preparing'])
        .maybeSingle();

      if (data) {
        const session = mapSession(data);
        setActiveSession(session);
        if (session.status === 'active') {
          startGpsTracking(session.id);
        }
      }
    } catch (err) {
      console.error('loadActiveSession error:', err);
    }
  }, [today]);

  // --- GPS Tracking ---

  const startGpsTracking = useCallback((sessionId: string) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('GPSが利用できません。ブラウザの設定を確認してください。');
      return;
    }

    setGpsStatus('tracking');
    setGpsError(null);
    approachNotifiedRef.current = new Set();
    arrivedNotifiedRef.current = new Set();

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const now = Date.now();

        // 5秒スロットル
        if (now - lastPosUpdateRef.current < 5000) return;
        lastPosUpdateRef.current = now;

        const session = sessionRef.current;
        if (!session || session.status !== 'active') return;

        // 次のストップまでのETA計算（範囲チェック付き）
        const nextStop = session.currentStopIndex < session.routeStops.length
          ? session.routeStops[session.currentStopIndex]
          : null;
        let etaSeconds: number | undefined;

        if (nextStop?.lat && nextStop?.lng) {
          const dist = haversineDistance(latitude, longitude, nextStop.lat, nextStop.lng);
          const avgSpeed = (speed && speed > 0) ? speed : 8.3; // デフォルト30km/h
          etaSeconds = estimateEtaSeconds(dist, avgSpeed);

          // 近接検知 → 通知（try-catch + await）
          try {
            await checkProximityNotifications(session, dist, nextStop, session.currentStopIndex);
          } catch (err) {
            console.error('Proximity notification error:', err);
          }
        }

        // transport_sessions 更新（エラーハンドリング付き）
        const { error: updateError } = await supabase
          .from('transport_sessions')
          .update({
            current_latitude: latitude,
            current_longitude: longitude,
            current_heading: heading,
            current_speed: speed,
            location_updated_at: new Date().toISOString(),
            next_stop_eta_seconds: etaSeconds ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (updateError) {
          console.error('GPS update failed:', updateError);
          // 一時的なエラーの場合は次回リトライ（ステータスは変えない）
        }

        // ローカルstate更新
        setActiveSession(prev => prev ? {
          ...prev,
          currentLatitude: latitude,
          currentLongitude: longitude,
          currentHeading: heading ?? undefined,
          currentSpeed: speed ?? undefined,
          nextStopEtaSeconds: etaSeconds,
          locationUpdatedAt: new Date().toISOString(),
        } : null);

        // 15秒ごとに経路履歴ログ
        if (now - lastHistoryRef.current >= 15000) {
          lastHistoryRef.current = now;
          supabase.from('transport_location_history').insert({
            session_id: sessionId,
            latitude,
            longitude,
            heading,
            speed,
          }).then(({ error }) => {
            if (error) console.error('Location history insert failed:', error);
          });
        }
      },
      (error) => {
        setGpsStatus('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('GPS権限が拒否されました。ブラウザの設定でGPSを許可してください。');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('位置情報を取得できません。');
            break;
          case error.TIMEOUT:
            setGpsError('位置情報の取得がタイムアウトしました。');
            break;
          default:
            setGpsError('GPS取得エラーが発生しました。');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  }, []);

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsStatus('idle');
  }, []);

  // --- 近接検知＆通知 ---

  const checkProximityNotifications = useCallback(async (
    session: TransportSession,
    distanceToNextStop: number,
    nextStop: TransportRouteStop,
    stopIndex: number
  ) => {
    // 500m以内 → approaching通知（DB重複チェック + Ref制御）
    if (distanceToNextStop <= 500 && !approachNotifiedRef.current.has(stopIndex)) {
      // DB dedup: ON CONFLICT チェック前にRefをロック
      const { data: existing } = await supabase
        .from('transport_stop_events')
        .select('id')
        .eq('session_id', session.id)
        .eq('stop_index', stopIndex)
        .eq('event_type', 'approaching')
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from('transport_stop_events').insert({
          session_id: session.id,
          stop_index: stopIndex,
          child_id: nextStop.childId,
          event_type: 'approaching',
          latitude: session.currentLatitude,
          longitude: session.currentLongitude,
        });

        if (!error) {
          // DB挿入成功後にRefマーク（競合防止）
          approachNotifiedRef.current.add(stopIndex);
          await notifyParentForChild(nextStop.childId, session, 'transport_approaching',
            'まもなく到着します',
            `送迎車があと約${Math.ceil(distanceToNextStop / 100) * 100}m地点にいます。`
          );
        }
      } else {
        approachNotifiedRef.current.add(stopIndex);
      }
    }

    // 100m以内 → arrived通知
    if (distanceToNextStop <= 100 && !arrivedNotifiedRef.current.has(stopIndex)) {
      const { data: existing } = await supabase
        .from('transport_stop_events')
        .select('id')
        .eq('session_id', session.id)
        .eq('stop_index', stopIndex)
        .eq('event_type', 'arrived')
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from('transport_stop_events').insert({
          session_id: session.id,
          stop_index: stopIndex,
          child_id: nextStop.childId,
          event_type: 'arrived',
          latitude: session.currentLatitude,
          longitude: session.currentLongitude,
        });

        if (!error) {
          arrivedNotifiedRef.current.add(stopIndex);
          await notifyParentForChild(nextStop.childId, session, 'transport_arrived',
            '送迎車が到着しました',
            `${nextStop.childName}さんの送迎地点に到着しました。`
          );
        }
      } else {
        arrivedNotifiedRef.current.add(stopIndex);
      }
    }
  }, []);

  // --- 通知ヘルパー ---

  const notifyParentForChild = useCallback(async (
    childId: string,
    session: TransportSession,
    type: 'transport_started' | 'transport_approaching' | 'transport_arrived' | 'transport_completed',
    title: string,
    body: string
  ) => {
    try {
      const { data: child } = await supabase
        .from('children')
        .select('owner_profile_id')
        .eq('id', childId)
        .maybeSingle();

      if (!child?.owner_profile_id) return;

      await createNotification(child.owner_profile_id, type, title, body, {
        url: `/parent/facilities/${session.facilityId}/transport?session=${session.id}`,
        sessionId: session.id,
      });
    } catch (err) {
      console.error('Parent notification failed:', err);
    }
  }, []);

  const notifyAllParents = useCallback(async (
    session: TransportSession,
    type: 'transport_started' | 'transport_completed',
    title: string,
    body: string
  ) => {
    const childIds = session.routeStops.map(s => s.childId);
    if (childIds.length === 0) return;

    try {
      const { data: children } = await supabase
        .from('children')
        .select('id, name, owner_profile_id')
        .in('id', childIds);

      if (!children) return;

      // 保護者ごとにグループ化（1人の保護者に複数の子がいる場合は1回の通知）
      const parentMap = new Map<string, string[]>();
      children.forEach(child => {
        if (!child.owner_profile_id) return;
        const names = parentMap.get(child.owner_profile_id) || [];
        names.push(child.name);
        parentMap.set(child.owner_profile_id, names);
      });

      for (const [parentUserId, names] of parentMap) {
        const personalBody = body.replace('{children}', names.join('、'));
        await createNotification(parentUserId, type, title, personalBody, {
          url: `/parent/facilities/${session.facilityId}/transport?session=${session.id}`,
          sessionId: session.id,
        });
      }
    } catch (err) {
      console.error('Parent notifications failed:', err);
    }
  }, []);

  // 施設スタッフ全員へ通知
  const notifyAllStaff = useCallback(async (
    session: TransportSession,
    type: 'transport_started' | 'transport_completed',
    title: string,
    body: string
  ) => {
    try {
      // employment_records経由でアクティブなスタッフを取得
      const { data: records } = await supabase
        .from('employment_records')
        .select('user_id')
        .eq('facility_id', session.facilityId)
        .is('end_date', null);

      if (!records || records.length === 0) return;

      const staffUserIds = [...new Set(
        records.map(r => r.user_id).filter((id): id is string => !!id)
      )];

      // ドライバー本人は除外（自分に送っても冗長）
      const recipients = staffUserIds.filter(id => id !== session.driverStaffId);

      for (const userId of recipients) {
        await createNotification(userId, type, title, body, {
          url: '/career',
          sessionId: session.id,
        });
      }
    } catch (err) {
      console.error('Staff notifications failed:', err);
    }
  }, []);

  // --- セッション操作 ---

  const startSession = useCallback(async (params: StartSessionParams): Promise<TransportSession | null> => {
    setLoading(true);
    try {
      // 既存のアクティブセッションをチェック
      const { data: existing } = await supabase
        .from('transport_sessions')
        .select('id, status, driver_staff_id, started_at')
        .eq('facility_id', params.facilityId)
        .eq('date', today)
        .eq('mode', params.mode)
        .in('status', ['active', 'preparing'])
        .maybeSingle();

      if (existing) {
        const startedAt = existing.started_at
          ? new Date(existing.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
          : '';
        const modeLabel = params.mode === 'pickup' ? 'お迎え' : 'お送り';

        if (existing.driver_staff_id === params.driverStaffId) {
          const resume = confirm(`${modeLabel}セッションが既に進行中です（${startedAt}開始）。\n再開しますか？`);
          if (!resume) {
            setLoading(false);
            return null;
          }
        } else {
          const takeover = confirm(
            `別のスタッフが${startedAt}に${modeLabel}を開始しています。\n引き継ぎますか？（現在のGPS追跡は停止されます）`
          );
          if (!takeover) {
            setLoading(false);
            return null;
          }
        }
      }

      const { data, error } = await supabase
        .from('transport_sessions')
        .upsert({
          facility_id: params.facilityId,
          date: today,
          mode: params.mode,
          status: 'active',
          driver_staff_id: params.driverStaffId || null,
          attendant_staff_id: params.attendantStaffId || null,
          vehicle_info: params.vehicleInfo || null,
          route_stops: params.routeStops,
          total_distance_meters: params.totalDistanceMeters || null,
          total_duration_seconds: params.totalDurationSeconds || null,
          current_stop_index: 0,
          started_at: new Date().toISOString(),
          completed_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'facility_id,date,mode' })
        .select()
        .single();

      if (error) {
        console.error('Session start error:', error);
        return null;
      }

      const session = mapSession(data);
      setActiveSession(session);

      // GPS開始
      startGpsTracking(session.id);

      // 保護者全員に通知
      const modeLabel = session.mode === 'pickup' ? 'お迎え' : 'お送り';
      notifyAllParents(session, 'transport_started',
        `${modeLabel}が開始されました`,
        `{children}さんの${modeLabel}が開始されました。リアルタイムで追跡できます。`
      );

      // 施設スタッフ全員に通知
      notifyAllStaff(session, 'transport_started',
        `${modeLabel}が開始されました`,
        `${modeLabel}が開始されました。送迎管理画面で進捗を確認できます。`
      );

      return session;
    } catch (err) {
      console.error('Session start error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [today, startGpsTracking, notifyAllParents, notifyAllStaff]);

  const completeSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    stopGpsTracking();

    await supabase
      .from('transport_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    const modeLabel = session.mode === 'pickup' ? 'お迎え' : 'お送り';

    // 保護者に通知
    notifyAllParents(
      { ...session, status: 'completed' },
      'transport_completed',
      `${modeLabel}が完了しました`,
      `{children}さんの${modeLabel}が完了しました。`
    );

    // スタッフに通知
    notifyAllStaff(
      { ...session, status: 'completed' },
      'transport_completed',
      `${modeLabel}が完了しました`,
      `${modeLabel}が完了しました。全${session.routeStops.length}箇所の送迎が終了しました。`
    );

    setActiveSession(null);
  }, [stopGpsTracking, notifyAllParents, notifyAllStaff]);

  const cancelSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    stopGpsTracking();

    await supabase
      .from('transport_sessions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    setActiveSession(null);
  }, [stopGpsTracking]);

  const markStopArrived = useCallback(async (stopIndex: number) => {
    const session = sessionRef.current;
    if (!session) return;

    const stop = session.routeStops[stopIndex];
    if (!stop) return;

    // イベント記録
    await supabase.from('transport_stop_events').insert({
      session_id: session.id,
      stop_index: stopIndex,
      child_id: stop.childId,
      event_type: 'departed',
    });

    // 次のストップへ進める
    const nextIndex = stopIndex + 1;
    await supabase
      .from('transport_sessions')
      .update({
        current_stop_index: nextIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    setActiveSession(prev => prev ? { ...prev, currentStopIndex: nextIndex } : null);
  }, []);

  const skipStop = useCallback(async (stopIndex: number) => {
    const session = sessionRef.current;
    if (!session) return;

    const stop = session.routeStops[stopIndex];
    if (!stop) return;

    await supabase.from('transport_stop_events').insert({
      session_id: session.id,
      stop_index: stopIndex,
      child_id: stop.childId,
      event_type: 'skipped',
    });

    const nextIndex = stopIndex + 1;
    await supabase
      .from('transport_sessions')
      .update({
        current_stop_index: nextIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    setActiveSession(prev => prev ? { ...prev, currentStopIndex: nextIndex } : null);
  }, []);

  return {
    activeSession,
    gpsStatus,
    gpsError,
    loading,
    startSession,
    completeSession,
    cancelSession,
    markStopArrived,
    skipStop,
    loadActiveSession,
  };
}
