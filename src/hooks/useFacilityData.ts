/**
 * 施設データ管理フック
 * マルチテナント対応：現在の施設に紐づくデータのみを取得・管理
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Child,
  Staff,
  ScheduleItem,
  BookingRequest,
  FacilitySettings,
  UsageRecord,
  UsageRecordFormData,
  Lead,
  LeadFormData,
} from '@/types';
import {
  initialChildren,
  initialStaff,
  initialSchedules,
  initialRequests,
  initialFacilitySettings,
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
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings>(
    initialFacilitySettings.facilityId === facilityId
      ? initialFacilitySettings
      : {
          id: `settings-${Date.now()}`,
          facilityId,
          facilityName: '',
          regularHolidays: [0],
          customHolidays: [],
          businessHours: {
            AM: { start: '09:00', end: '12:00' },
            PM: { start: '13:00', end: '18:00' },
          },
          capacity: {
            AM: 10,
            PM: 10,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
  );
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Supabaseから施設設定を取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingSettings(false);
      return;
    }

    const fetchFacilitySettings = async () => {
      try {
        const { data, error } = await supabase
          .from('facility_settings')
          .select('*')
          .eq('facility_id', facilityId)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116は「行が見つからない」エラー（正常）
          console.error('Error fetching facility settings:', error);
          setLoadingSettings(false);
          return;
        }

        if (data) {
          // データベースのスネークケースをキャメルケースに変換
          setFacilitySettings({
            id: data.id,
            facilityId: data.facility_id,
            facilityName: data.facility_name || '',
            regularHolidays: data.regular_holidays || [0],
            customHolidays: data.custom_holidays || [],
            businessHours: data.business_hours || {
              AM: { start: '09:00', end: '12:00' },
              PM: { start: '13:00', end: '18:00' },
            },
            capacity: data.capacity || {
              AM: 10,
              PM: 10,
            },
            createdAt: data.created_at || new Date().toISOString(),
            updatedAt: data.updated_at || new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error in fetchFacilitySettings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchFacilitySettings();
  }, [facilityId]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

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

  const updateFacilitySettings = async (settings: Partial<FacilitySettings>) => {
    const updatedSettings = {
      ...facilitySettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    
    setFacilitySettings(updatedSettings);

    // Supabaseに保存
    if (facilityId) {
      try {
        const { data, error } = await supabase
          .from('facility_settings')
          .upsert({
            id: updatedSettings.id,
            facility_id: facilityId,
            facility_name: updatedSettings.facilityName || null,
            regular_holidays: updatedSettings.regularHolidays,
            custom_holidays: updatedSettings.customHolidays,
            business_hours: updatedSettings.businessHours,
            capacity: updatedSettings.capacity,
            updated_at: updatedSettings.updatedAt,
            created_at: updatedSettings.createdAt,
          })
          .eq('facility_id', facilityId)
          .select()
          .single();

        if (error) {
          console.error('Error updating facility settings:', error);
          // エラーが発生した場合はローカル状態を元に戻す
          setFacilitySettings(facilitySettings);
        } else if (data) {
          // データベースから取得したデータで状態を更新
          setFacilitySettings({
            id: data.id,
            facilityId: data.facility_id,
            facilityName: data.facility_name || '',
            regularHolidays: data.regular_holidays,
            customHolidays: data.custom_holidays,
            businessHours: data.business_hours,
            capacity: data.capacity,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          });
        }
      } catch (error) {
        console.error('Error in updateFacilitySettings:', error);
        // エラーが発生した場合はローカル状態を元に戻す
        setFacilitySettings(facilitySettings);
      }
    }
  };

  const deleteSchedule = (scheduleId: number) => {
    setSchedules(schedules.filter((s) => s.id !== scheduleId));
    // 関連する実績も削除
    setUsageRecords(usageRecords.filter((r) => r.scheduleId !== scheduleId));
  };

  const addUsageRecord = (recordData: UsageRecordFormData) => {
    const newRecord: UsageRecord = {
      ...recordData,
      id: `record-${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setUsageRecords([...usageRecords, newRecord]);
    return newRecord;
  };

  const updateUsageRecord = (recordId: string, recordData: Partial<UsageRecordFormData>) => {
    setUsageRecords(
      usageRecords.map((r) =>
        r.id === recordId
          ? { ...r, ...recordData, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const deleteUsageRecord = (recordId: string) => {
    setUsageRecords(usageRecords.filter((r) => r.id !== recordId));
  };

  const getUsageRecordByScheduleId = (scheduleId: number): UsageRecord | undefined => {
    return usageRecords.find((r) => r.scheduleId === scheduleId);
  };

  const filteredUsageRecords = useMemo(
    () => usageRecords.filter((r) => r.facilityId === facilityId),
    [usageRecords, facilityId]
  );

  const filteredLeads = useMemo(
    () => leads.filter((l) => l.facilityId === facilityId),
    [leads, facilityId]
  );

  // リード管理機能
  const addLead = (leadData: LeadFormData) => {
    const newLead: Lead = {
      ...leadData,
      id: `lead-${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLeads([...leads, newLead]);
    return newLead;
  };

  const updateLead = (leadId: string, leadData: Partial<LeadFormData>) => {
    setLeads(
      leads.map((l) =>
        l.id === leadId
          ? { ...l, ...leadData, updatedAt: new Date().toISOString() }
          : l
      )
    );
  };

  const deleteLead = (leadId: string) => {
    setLeads(leads.filter((l) => l.id !== leadId));
  };

  const getLeadsByChildId = (childId: string): Lead[] => {
    return filteredLeads.filter((lead) => lead.childIds.includes(childId));
  };

  // スタッフ管理機能
  const addStaff = (staffData: Omit<Staff, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newStaff: Staff = {
      ...staffData,
      id: `staff-${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStaff([...staff, newStaff]);
    return newStaff;
  };

  const updateStaff = (staffId: string, staffData: Partial<Staff>) => {
    setStaff(
      staff.map((s) =>
        s.id === staffId
          ? { ...s, ...staffData, updatedAt: new Date().toISOString() }
          : s
      )
    );
  };

  const deleteStaff = (staffId: string) => {
    setStaff(staff.filter((s) => s.id !== staffId));
  };

  return {
    children: filteredChildren,
    staff: filteredStaff,
    schedules: filteredSchedules,
    requests: filteredRequests,
    facilitySettings,
    loadingSettings,
    usageRecords: filteredUsageRecords,
    leads: filteredLeads,
    setChildren,
    setStaff,
    setSchedules,
    setRequests,
    addChild,
    addSchedule,
    addRequest,
    updateFacilitySettings,
    deleteSchedule,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    getUsageRecordByScheduleId,
    addLead,
    updateLead,
    deleteLead,
    getLeadsByChildId,
    addStaff,
    updateStaff,
    deleteStaff,
  };
};

