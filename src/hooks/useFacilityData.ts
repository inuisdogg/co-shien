/**
 * 施設データ管理フック
 * マルチテナント対応：現在の施設に紐づくデータのみを取得・管理
 */

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Child,
  Staff,
  ScheduleItem,
  BookingRequest,
} from '@/types';
import {
  initialChildren,
  initialStaff,
  initialSchedules,
  initialRequests,
} from '@/types/mockData';

export const useFacilityData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  // 施設に紐づくデータのみをフィルタリング
  const [children, setChildren] = useState<Child[]>(
    initialChildren.filter((c) => c.facilityId === facilityId)
  );
  const [staff, setStaff] = useState<Staff[]>(
    initialStaff.filter((s) => s.facilityId === facilityId)
  );
  const [schedules, setSchedules] = useState<ScheduleItem[]>(
    initialSchedules.filter((s) => s.facilityId === facilityId)
  );
  const [requests, setRequests] = useState<BookingRequest[]>(
    initialRequests.filter((r) => r.facilityId === facilityId)
  );

  // 施設IDでフィルタリングされたデータのみを返す
  const filteredChildren = useMemo(
    () => children.filter((c) => c.facilityId === facilityId),
    [children, facilityId]
  );

  const filteredStaff = useMemo(
    () => staff.filter((s) => s.facilityId === facilityId),
    [staff, facilityId]
  );

  const filteredSchedules = useMemo(
    () => schedules.filter((s) => s.facilityId === facilityId),
    [schedules, facilityId]
  );

  const filteredRequests = useMemo(
    () => requests.filter((r) => r.facilityId === facilityId),
    [requests, facilityId]
  );

  // 新しいデータを追加する際は自動的にfacilityIdを付与
  const addChild = (child: Omit<Child, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newChild: Child = {
      ...child,
      id: `c${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setChildren([...children, newChild]);
    return newChild;
  };

  const addSchedule = (schedule: Omit<ScheduleItem, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newSchedule: ScheduleItem = {
      ...schedule,
      id: Date.now(),
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSchedules([...schedules, newSchedule]);
    return newSchedule;
  };

  const addRequest = (request: Omit<BookingRequest, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newRequest: BookingRequest = {
      ...request,
      id: Date.now(),
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRequests([...requests, newRequest]);
    return newRequest;
  };

  return {
    children: filteredChildren,
    staff: filteredStaff,
    schedules: filteredSchedules,
    requests: filteredRequests,
    setChildren,
    setStaff,
    setSchedules,
    setRequests,
    addChild,
    addSchedule,
    addRequest,
  };
};

