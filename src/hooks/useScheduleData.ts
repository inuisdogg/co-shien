/**
 * スケジュールデータ管理フック
 * schedules テーブルの取得・CRUD操作・一括登録・リセット
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Child,
  ScheduleItem,
  BookingRequest,
  FacilitySettings,
  UsageRecord,
  TimeSlot,
} from '@/types';

export const useScheduleData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);

  // Supabaseからスケジュールデータを取得
  useEffect(() => {
    if (!facilityId) {
      return;
    }

    const fetchSchedules = async () => {
      try {
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .eq('facility_id', facilityId)
          .order('date', { ascending: true })
          .order('slot', { ascending: true });

        if (error) {
          console.error('Error fetching schedules:', error);
          return;
        }

        if (data) {
          const schedulesData: ScheduleItem[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            date: row.date,
            childId: row.child_id,
            childName: row.child_name,
            slot: row.slot as TimeSlot,
            hasPickup: row.has_pickup || false,
            hasDropoff: row.has_dropoff || false,
            staffId: row.staff_id || undefined,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          }));
          setSchedules(schedulesData);
        }
      } catch (error) {
        console.error('Error in fetchSchedules:', error);
      }
    };

    fetchSchedules();
  }, [facilityId]);

  const filteredSchedules = useMemo(
    () => schedules.filter((s) => s.facilityId === facilityId),
    [schedules, facilityId]
  );

  const filteredRequests = useMemo(
    () => requests.filter((r) => r.facilityId === facilityId),
    [requests, facilityId]
  );

  const addSchedule = async (schedule: Omit<ScheduleItem, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません。ログインしてください。');
    }

    const scheduleId = `schedule-${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          id: scheduleId,
          facility_id: facilityId,
          child_id: schedule.childId,
          child_name: schedule.childName,
          date: schedule.date,
          slot: schedule.slot,
          has_pickup: schedule.hasPickup || false,
          has_dropoff: schedule.hasDropoff || false,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      const newSchedule: ScheduleItem = {
        ...schedule,
        id: scheduleId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setSchedules(prev => [...prev, newSchedule]);
      return newSchedule;
    } catch (error) {
      console.error('Error in addSchedule:', error);
      throw error;
    }
  };

  const addRequest = (request: Omit<BookingRequest, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newRequest: BookingRequest = {
      ...request,
      id: `request-${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRequests(prev => [...prev, newRequest]);
    return newRequest;
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      setSchedules(prev => prev.filter((s) => s.id !== scheduleId));
    } catch (error) {
      console.error('Error in deleteSchedule:', error);
      throw error;
    }
  };

  // スケジュールを別の時間枠に移動
  const moveSchedule = async (scheduleId: string, newSlot: TimeSlot) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      throw new Error('スケジュールが見つかりません');
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('schedules')
        .update({
          slot: newSlot,
          updated_at: now,
        })
        .eq('id', scheduleId);

      if (error) throw error;

      setSchedules(prev =>
        prev.map(s =>
          s.id === scheduleId
            ? { ...s, slot: newSlot, updatedAt: now }
            : s
        )
      );
    } catch (error) {
      console.error('Error in moveSchedule:', error);
      throw error;
    }
  };

  // スケジュールの送迎設定を更新
  const updateScheduleTransport = async (scheduleId: string, hasPickup: boolean, hasDropoff: boolean) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      throw new Error('スケジュールが見つかりません');
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('schedules')
        .update({
          has_pickup: hasPickup,
          has_dropoff: hasDropoff,
          updated_at: now,
        })
        .eq('id', scheduleId);

      if (error) throw error;

      setSchedules(prev =>
        prev.map(s =>
          s.id === scheduleId
            ? { ...s, hasPickup, hasDropoff, updatedAt: now }
            : s
        )
      );
    } catch (error) {
      console.error('Error in updateScheduleTransport:', error);
      throw error;
    }
  };

  // パターンに基づいて月間一括登録
  const bulkRegisterFromPatterns = async (
    year: number,
    month: number,
    children: Child[],
    facilitySettings: FacilitySettings,
    getUsageRecordByScheduleId: (scheduleId: string) => UsageRecord | undefined
  ): Promise<{ added: number; skipped: number }> => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    let added = 0;
    let skipped = 0;

    // 月の日数を取得
    const daysInMonth = new Date(year, month, 0).getDate();

    // 既存のスケジュールを取得（重複チェック用）
    const existingSchedules = new Set(
      schedules
        .filter(s => {
          const [y, m] = s.date.split('-').map(Number);
          return y === year && m === month;
        })
        .map(s => `${s.date}-${s.childId}-${s.slot}`)
    );

    // 施設設定から休日情報を取得
    const regularHolidays = facilitySettings.regularHolidays || [0];
    const customHolidays = facilitySettings.customHolidays || [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();

      // 定休日チェック
      if (regularHolidays.includes(dayOfWeek)) {
        continue;
      }

      // カスタム休日チェック
      if (customHolidays.includes(date)) {
        continue;
      }

      for (const child of children) {
        // パターンに含まれる曜日かチェック
        if (!child.patternDays?.includes(dayOfWeek)) {
          continue;
        }

        // 時間枠を取得
        const timeSlot = child.patternTimeSlots?.[dayOfWeek];
        if (!timeSlot) {
          continue;
        }

        // AMPM の場合は両方に登録
        const slotsToRegister: TimeSlot[] = timeSlot === 'AMPM' ? ['AM', 'PM'] : [timeSlot as TimeSlot];

        for (const slot of slotsToRegister) {
          // 重複チェック
          const key = `${date}-${child.id}-${slot}`;
          if (existingSchedules.has(key)) {
            skipped++;
            continue;
          }

          // 登録
          try {
            await addSchedule({
              date,
              childId: child.id,
              childName: child.name,
              slot,
              hasPickup: child.needsPickup || false,
              hasDropoff: child.needsDropoff || false,
            });
            existingSchedules.add(key);
            added++;
          } catch (error) {
            console.error(`Error adding schedule for ${child.name} on ${date}:`, error);
            skipped++;
          }
        }
      }
    }

    return { added, skipped };
  };

  // 日次リセット（実績登録済みは除外）
  const resetDaySchedules = async (
    date: string,
    getUsageRecordByScheduleId: (scheduleId: string) => UsageRecord | undefined
  ): Promise<number> => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    // この日のスケジュールを取得
    const daySchedules = schedules.filter(s => s.date === date);

    // 実績登録済みでないもののみ削除
    const schedulesToDelete = daySchedules.filter(s => !getUsageRecordByScheduleId(s.id));

    let deleted = 0;
    for (const schedule of schedulesToDelete) {
      try {
        await deleteSchedule(schedule.id);
        deleted++;
      } catch (error) {
        console.error(`Error deleting schedule ${schedule.id}:`, error);
      }
    }

    return deleted;
  };

  // 月次リセット（実績登録済みは除外）
  const resetMonthSchedules = async (
    year: number,
    month: number,
    getUsageRecordByScheduleId: (scheduleId: string) => UsageRecord | undefined
  ): Promise<number> => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    // 指定月のスケジュールを取得
    const monthSchedules = schedules.filter(s => {
      const [y, m] = s.date.split('-').map(Number);
      return y === year && m === month;
    });

    // 実績登録済みでないもののみ削除
    const schedulesToDelete = monthSchedules.filter(s => !getUsageRecordByScheduleId(s.id));

    let deleted = 0;
    for (const schedule of schedulesToDelete) {
      try {
        await deleteSchedule(schedule.id);
        deleted++;
      } catch (error) {
        console.error(`Error deleting schedule ${schedule.id}:`, error);
      }
    }

    return deleted;
  };

  return {
    schedules: filteredSchedules,
    requests: filteredRequests,
    setSchedules,
    setRequests,
    addSchedule,
    addRequest,
    deleteSchedule,
    moveSchedule,
    updateScheduleTransport,
    bulkRegisterFromPatterns,
    resetDaySchedules,
    resetMonthSchedules,
  };
};
