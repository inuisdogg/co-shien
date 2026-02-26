/**
 * usePersonalData フック
 * 個人ダッシュボード用のデータ取得・管理
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { validateGeofence, getCurrentPosition } from '@/lib/geoFence';
import {
  EmploymentRecord,
  FacilityWorkToolSettings,
  AttendanceRecord,
  AttendanceDailySummary,
  AttendanceType,
  WorkToolId,
  WorkStatus,
} from '@/types';

// 施設ごとの業務データ
export type FacilityWorkData = {
  facilityId: string;
  facilityName: string;
  facilityCode: string;
  employmentRecord: EmploymentRecord;
  workToolSettings: FacilityWorkToolSettings | null;
  todayAttendance: AttendanceDailySummary | null;
};

// フックの戻り値型
export type UsePersonalDataReturn = {
  // データ
  facilities: FacilityWorkData[];
  isLoading: boolean;
  error: string | null;

  // 打刻操作
  clockIn: (facilityId: string) => Promise<void>;
  clockOut: (facilityId: string) => Promise<void>;
  startBreak: (facilityId: string) => Promise<void>;
  endBreak: (facilityId: string) => Promise<void>;

  // 勤怠データ取得
  getAttendanceHistory: (facilityId: string, startDate: string, endDate: string) => Promise<AttendanceRecord[]>;

  // リフレッシュ
  refresh: () => Promise<void>;
};

// 勤務ステータスを計算
const calculateWorkStatus = (records: AttendanceRecord[]): WorkStatus => {
  const hasStart = records.some(r => r.type === 'start');
  const hasEnd = records.some(r => r.type === 'end');
  const hasBreakStart = records.some(r => r.type === 'break_start');
  const hasBreakEnd = records.some(r => r.type === 'break_end');

  if (hasEnd) return 'completed';
  if (hasBreakStart && !hasBreakEnd) return 'on_break';
  if (hasStart) return 'working';
  return 'not_started';
};

// 日次サマリーを作成
const createDailySummary = (
  userId: string,
  facilityId: string,
  date: string,
  records: AttendanceRecord[]
): AttendanceDailySummary => {
  const getTime = (type: AttendanceType) => {
    const record = records.find(r => r.type === type);
    return record?.time;
  };

  return {
    userId,
    facilityId,
    date,
    startTime: getTime('start'),
    endTime: getTime('end'),
    breakStartTime: getTime('break_start'),
    breakEndTime: getTime('break_end'),
    status: calculateWorkStatus(records),
  };
};

export function usePersonalData(): UsePersonalDataReturn {
  const { user, isLoading: authLoading } = useAuth();
  const [facilities, setFacilities] = useState<FacilityWorkData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // データ取得
  const fetchData = useCallback(async () => {
    // 認証状態の読み込み中は待機
    if (authLoading) {
      return;
    }

    if (!user?.id) {
      setFacilities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. ユーザーの所属施設を取得（end_dateがnullのもの）
      const { data: employmentData, error: employmentError } = await supabase
        .from('employment_records')
        .select(`
          *,
          facilities:facility_id (
            id,
            name,
            code
          )
        `)
        .eq('user_id', user.id)
        .is('end_date', null);

      if (employmentError) throw employmentError;

      if (!employmentData || employmentData.length === 0) {
        // 所属施設がない場合はstaffテーブルから取得（後方互換性）
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('user_id', user.id);

        if (staffError) throw staffError;

        if (!staffData || staffData.length === 0) {
          setFacilities([]);
          setIsLoading(false);
          return;
        }

        // 施設IDを集めて施設データを取得
        const facilityIds = staffData.map((s: any) => s.facility_id).filter(Boolean);
        const { data: facilitiesData } = await supabase
          .from('facilities')
          .select('id, name, code')
          .in('id', facilityIds);

        const facilitiesMap = new Map((facilitiesData || []).map((f: any) => [f.id, f]));

        // staffデータからFacilityWorkDataを作成
        const facilityWorkData: FacilityWorkData[] = await Promise.all(
          staffData.filter((staff: any) => facilitiesMap.has(staff.facility_id)).map(async (staff: any) => {
            const facility = facilitiesMap.get(staff.facility_id);

            // 業務ツール設定を取得
            const { data: toolSettings } = await supabase
              .from('facility_work_tool_settings')
              .select('*')
              .eq('facility_id', facility.id)
              .single();

            // 今日の打刻記録を取得
            const { data: todayRecords } = await supabase
              .from('attendance_records')
              .select('*')
              .eq('user_id', user.id)
              .eq('facility_id', facility.id)
              .eq('date', today);

            const employmentRecord: EmploymentRecord = {
              id: staff.id,
              userId: user.id,
              facilityId: facility.id,
              startDate: staff.createdAt?.split('T')[0] || today,
              role: staff.role || '一般スタッフ',
              employmentType: staff.type || '常勤',
              experienceVerificationStatus: 'not_requested',
              createdAt: staff.createdAt,
              updatedAt: staff.updatedAt,
              facilityName: facility.name,
              facilityCode: facility.code,
            };

            return {
              facilityId: facility.id,
              facilityName: facility.name,
              facilityCode: facility.code,
              employmentRecord,
              workToolSettings: toolSettings ? {
                id: toolSettings.id,
                facilityId: toolSettings.facility_id,
                enabledTools: toolSettings.enabled_tools,
                toolOrder: toolSettings.tool_order,
                customSettings: toolSettings.custom_settings,
                createdAt: toolSettings.created_at,
                updatedAt: toolSettings.updated_at,
              } : null,
              todayAttendance: todayRecords && todayRecords.length > 0
                ? createDailySummary(user.id, facility.id, today, todayRecords.map((r: any) => ({
                    id: r.id,
                    userId: r.user_id,
                    facilityId: r.facility_id,
                    date: r.date,
                    type: r.type,
                    time: r.time,
                    recordedAt: r.recorded_at,
                    isManualCorrection: r.is_manual_correction,
                    correctionReason: r.correction_reason,
                    correctedBy: r.corrected_by,
                    locationLat: r.location_lat,
                    locationLng: r.location_lng,
                    memo: r.memo,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                  })))
                : createDailySummary(user.id, facility.id, today, []),
            };
          })
        );

        setFacilities(facilityWorkData);
        setIsLoading(false);
        return;
      }

      // employment_recordsからFacilityWorkDataを作成
      const facilityWorkData: FacilityWorkData[] = await Promise.all(
        employmentData.map(async (record: any) => {
          const facility = record.facilities;

          // 業務ツール設定を取得
          const { data: toolSettings } = await supabase
            .from('facility_work_tool_settings')
            .select('*')
            .eq('facility_id', facility.id)
            .single();

          // 今日の打刻記録を取得
          const { data: todayRecords } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', user.id)
            .eq('facility_id', facility.id)
            .eq('date', today);

          const employmentRecord: EmploymentRecord = {
            id: record.id,
            userId: record.user_id,
            facilityId: record.facility_id,
            startDate: record.start_date,
            endDate: record.end_date,
            role: record.role,
            employmentType: record.employment_type,
            permissions: record.permissions,
            experienceVerificationStatus: record.experience_verification_status,
            experienceVerificationRequestedAt: record.experience_verification_requested_at,
            experienceVerificationApprovedAt: record.experience_verification_approved_at,
            experienceVerificationApprovedBy: record.experience_verification_approved_by,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            facilityName: facility.name,
            facilityCode: facility.code,
          };

          return {
            facilityId: facility.id,
            facilityName: facility.name,
            facilityCode: facility.code,
            employmentRecord,
            workToolSettings: toolSettings ? {
              id: toolSettings.id,
              facilityId: toolSettings.facility_id,
              enabledTools: toolSettings.enabled_tools,
              toolOrder: toolSettings.tool_order,
              customSettings: toolSettings.custom_settings,
              createdAt: toolSettings.created_at,
              updatedAt: toolSettings.updated_at,
            } : null,
            todayAttendance: todayRecords && todayRecords.length > 0
              ? createDailySummary(user.id, facility.id, today, todayRecords.map((r: any) => ({
                  id: r.id,
                  userId: r.user_id,
                  facilityId: r.facility_id,
                  date: r.date,
                  type: r.type,
                  time: r.time,
                  recordedAt: r.recorded_at,
                  isManualCorrection: r.is_manual_correction,
                  correctionReason: r.correction_reason,
                  correctedBy: r.corrected_by,
                  locationLat: r.location_lat,
                  locationLng: r.location_lng,
                  memo: r.memo,
                  createdAt: r.created_at,
                  updatedAt: r.updated_at,
                })))
              : createDailySummary(user.id, facility.id, today, []),
          };
        })
      );

      setFacilities(facilityWorkData);
    } catch (err) {
      console.error('Error fetching personal data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, authLoading]);

  // GPS座標情報の型
  type GpsData = {
    latitude: number;
    longitude: number;
    geoValidated: boolean;
    geoDistanceMeters: number;
  };

  // 打刻処理の共通関数（ローカルステートを即座に更新、リロードなし）
  const recordAttendance = async (facilityId: string, type: AttendanceType, gpsData?: GpsData) => {
    if (!user?.id) {
      console.error('ユーザーIDがありません');
      throw new Error('ログインが必要です');
    }

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5); // HH:mm

    // まず既存のレコードを確認
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('user_id', user.id)
      .eq('facility_id', facilityId)
      .eq('date', date)
      .eq('type', type)
      .single();

    let error;
    if (existing) {
      // 既存レコードがあれば更新
      const updateData: Record<string, unknown> = {
        time,
        updated_at: now.toISOString(),
      };
      if (gpsData) {
        updateData.location_lat = gpsData.latitude;
        updateData.location_lng = gpsData.longitude;
        updateData.geo_validated = gpsData.geoValidated;
        updateData.geo_distance_meters = gpsData.geoDistanceMeters;
      }
      const result = await supabase
        .from('attendance_records')
        .update(updateData)
        .eq('id', existing.id);
      error = result.error;
    } else {
      // 新規レコードを挿入
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        facility_id: facilityId,
        date,
        type,
        time,
      };
      if (gpsData) {
        insertData.location_lat = gpsData.latitude;
        insertData.location_lng = gpsData.longitude;
        insertData.geo_validated = gpsData.geoValidated;
        insertData.geo_distance_meters = gpsData.geoDistanceMeters;
      }
      const result = await supabase
        .from('attendance_records')
        .insert(insertData);
      error = result.error;
    }

    if (error) {
      console.error('Supabase insert/update error:', error);
      throw error;
    }

    // ローカルステートを即座に更新（リロードなし）
    setFacilities(prev => prev.map(facility => {
      if (facility.facilityId !== facilityId) return facility;

      // 現在の打刻データを更新
      const currentAttendance = facility.todayAttendance || {
        userId: user.id,
        facilityId,
        date,
        status: 'not_started' as WorkStatus,
      };

      // タイプに応じて時刻を更新
      const updatedAttendance: AttendanceDailySummary = {
        ...currentAttendance,
        startTime: type === 'start' ? time : currentAttendance.startTime,
        endTime: type === 'end' ? time : currentAttendance.endTime,
        breakStartTime: type === 'break_start' ? time : currentAttendance.breakStartTime,
        breakEndTime: type === 'break_end' ? time : currentAttendance.breakEndTime,
        status: calculateNewStatus(currentAttendance.status, type),
      };

      return {
        ...facility,
        todayAttendance: updatedAttendance,
      };
    }));
  };

  // 新しいステータスを計算
  const calculateNewStatus = (currentStatus: WorkStatus, type: AttendanceType): WorkStatus => {
    switch (type) {
      case 'start':
        return 'working';
      case 'end':
        return 'completed';
      case 'break_start':
        return 'on_break';
      case 'break_end':
        return 'working';
      default:
        return currentStatus;
    }
  };

  // 始業打刻（ジオフェンス検証付き）
  const clockIn = async (facilityId: string) => {
    try {
      // ジオフェンス検証を実行
      const geoResult = await validateGeofence(facilityId);

      if (!geoResult.isValid) {
        // 位置情報エラーの場合はユーザーに通知して中止
        const errorMessage = geoResult.error || '施設の範囲外です。';
        alert(`出勤打刻できません:\n${errorMessage}`);
        console.warn('ジオフェンス検証失敗:', geoResult);
        return;
      }

      // GPS座標データを作成（位置情報が取得できた場合）
      const gpsData: GpsData | undefined =
        geoResult.userLocation.lat !== 0 || geoResult.userLocation.lng !== 0
          ? {
              latitude: geoResult.userLocation.lat,
              longitude: geoResult.userLocation.lng,
              geoValidated: geoResult.isValid,
              geoDistanceMeters: geoResult.distance >= 0 ? geoResult.distance : 0,
            }
          : undefined;

      await recordAttendance(facilityId, 'start', gpsData);
    } catch (error) {
      console.error('出勤打刻エラー:', error);
      alert('出勤の記録に失敗しました。ページを再読み込みしてください。');
    }
  };

  // 退勤打刻（ジオフェンスはブロックしない、GPS座標のみ記録）
  const clockOut = async (facilityId: string) => {
    try {
      // GPS座標の記録を試みるが、失敗しても打刻は続行
      let gpsData: GpsData | undefined;
      try {
        const position = await getCurrentPosition();
        gpsData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          geoValidated: false, // 退勤時はジオフェンス検証しない
          geoDistanceMeters: 0,
        };
      } catch (gpsError) {
        console.warn('退勤時のGPS取得失敗（打刻は続行）:', gpsError);
      }

      await recordAttendance(facilityId, 'end', gpsData);
    } catch (error) {
      console.error('退勤打刻エラー:', error);
      alert('退勤の記録に失敗しました。ページを再読み込みしてください。');
    }
  };

  // 休憩開始
  const startBreak = async (facilityId: string) => {
    try {
      await recordAttendance(facilityId, 'break_start');
    } catch (error) {
      console.error('休憩開始打刻エラー:', error);
      alert('休憩開始の記録に失敗しました。ページを再読み込みしてください。');
    }
  };

  // 休憩終了
  const endBreak = async (facilityId: string) => {
    try {
      await recordAttendance(facilityId, 'break_end');
    } catch (error) {
      console.error('休憩終了打刻エラー:', error);
      alert('休憩終了の記録に失敗しました。ページを再読み込みしてください。');
    }
  };

  // 勤怠履歴取得
  const getAttendanceHistory = async (
    facilityId: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceRecord[]> => {
    if (!user?.id) return [];

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('facility_id', facilityId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('time', { ascending: true });

    if (error) {
      console.error('Error fetching attendance history:', error);
      return [];
    }

    return data.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      facilityId: r.facility_id,
      date: r.date,
      type: r.type,
      time: r.time,
      recordedAt: r.recorded_at,
      isManualCorrection: r.is_manual_correction,
      correctionReason: r.correction_reason,
      correctedBy: r.corrected_by,
      locationLat: r.location_lat,
      locationLng: r.location_lng,
      memo: r.memo,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  };

  // 初回ロード
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    facilities,
    isLoading,
    error,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    getAttendanceHistory,
    refresh: fetchData,
  };
}
