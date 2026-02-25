/**
 * 施設設定・時間枠管理フック
 * facility_settings と facility_time_slots の取得・更新
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FacilitySettings, FacilityTimeSlot } from '@/types';

const DEFAULT_SETTINGS: Omit<FacilitySettings, 'id' | 'facilityId'> = {
  facilityName: '',
  regularHolidays: [0],
  customHolidays: [],
  includeHolidays: false,
  businessHours: {
    AM: { start: '09:00', end: '12:00' },
    PM: { start: '13:00', end: '18:00' },
  },
  businessHoursPeriods: [],
  flexibleBusinessHours: {
    default: { start: '09:00', end: '18:00' },
    dayOverrides: {},
  },
  serviceHours: {
    AM: { start: '09:00', end: '12:00' },
    PM: { start: '13:00', end: '18:00' },
  },
  flexibleServiceHours: {
    default: { start: '09:00', end: '18:00' },
    dayOverrides: {},
  },
  serviceCategories: {
    childDevelopmentSupport: false,
    afterSchoolDayService: true,
    nurseryVisitSupport: false,
    homeBasedChildSupport: false,
  },
  capacity: { AM: 0, PM: 0 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useFacilitySettings = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings>({
    id: `settings-${Date.now()}`,
    facilityId,
    ...DEFAULT_SETTINGS,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [timeSlots, setTimeSlots] = useState<FacilityTimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(true);

  // 施設設定の取得
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
          console.error('Error fetching facility settings:', error);
          setLoadingSettings(false);
          return;
        }

        if (data) {
          setFacilitySettings({
            id: data.id,
            facilityId: data.facility_id,
            facilityName: data.facility_name || '',
            address: data.address || undefined,
            postalCode: data.postal_code || undefined,
            latitude: data.latitude || undefined,
            longitude: data.longitude || undefined,
            regularHolidays: data.regular_holidays || [0],
            holidayPeriods: data.holiday_periods || [],
            customHolidays: data.custom_holidays || [],
            includeHolidays: data.include_holidays || false,
            businessHours: data.business_hours || DEFAULT_SETTINGS.businessHours,
            businessHoursPeriods: data.business_hours_periods || [],
            flexibleBusinessHours: data.flexible_business_hours || DEFAULT_SETTINGS.flexibleBusinessHours,
            serviceHours: data.service_hours || DEFAULT_SETTINGS.serviceHours,
            flexibleServiceHours: data.flexible_service_hours || DEFAULT_SETTINGS.flexibleServiceHours,
            serviceCategories: data.service_categories || DEFAULT_SETTINGS.serviceCategories,
            capacity: data.capacity || DEFAULT_SETTINGS.capacity,
            transportCapacity: data.transport_capacity || { pickup: 4, dropoff: 4 },
            prescribedWorkingHours: data.prescribed_working_hours || undefined,
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

  // 時間枠の取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingTimeSlots(false);
      return;
    }

    const fetchTimeSlots = async () => {
      try {
        const { data, error } = await supabase
          .from('facility_time_slots')
          .select('*')
          .eq('facility_id', facilityId)
          .order('display_order', { ascending: true });

        if (error) {
          console.error('Error fetching time slots:', error);
          setLoadingTimeSlots(false);
          return;
        }

        if (data) {
          setTimeSlots(data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            name: row.name,
            startTime: row.start_time,
            endTime: row.end_time,
            capacity: row.capacity ?? 0,
            displayOrder: row.display_order || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })));
        }
      } catch (error) {
        console.error('Error in fetchTimeSlots:', error);
      } finally {
        setLoadingTimeSlots(false);
      }
    };

    fetchTimeSlots();
  }, [facilityId]);

  // 施設設定の更新
  const updateFacilitySettings = async (settings: Partial<FacilitySettings>, changeDescription?: string) => {
    const updatedSettings = {
      ...facilitySettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    const { data: { user } } = await supabase.auth.getUser();
    const changedBy = user?.id || null;

    // 変更タイプの判定
    const hasBusinessHoursChange = settings.businessHours !== undefined;
    const hasHolidaysChange = settings.regularHolidays !== undefined || settings.holidayPeriods !== undefined || settings.customHolidays !== undefined || settings.includeHolidays !== undefined;
    const hasCapacityChange = settings.capacity !== undefined;

    let changeType: 'business_hours' | 'holidays' | 'capacity' | 'all' = 'all';
    if (hasBusinessHoursChange && !hasHolidaysChange && !hasCapacityChange) changeType = 'business_hours';
    else if (hasHolidaysChange && !hasBusinessHoursChange && !hasCapacityChange) changeType = 'holidays';
    else if (hasCapacityChange && !hasBusinessHoursChange && !hasHolidaysChange) changeType = 'capacity';

    const oldValue = {
      businessHours: facilitySettings.businessHours,
      regularHolidays: facilitySettings.regularHolidays,
      customHolidays: facilitySettings.customHolidays,
      capacity: facilitySettings.capacity,
    };

    const newValue = {
      businessHours: updatedSettings.businessHours,
      regularHolidays: updatedSettings.regularHolidays,
      customHolidays: updatedSettings.customHolidays,
      capacity: updatedSettings.capacity,
    };

    try {
      const { data: existingData } = await supabase
        .from('facility_settings')
        .select('id')
        .eq('facility_id', facilityId)
        .single();

      const upsertData: any = {
        facility_id: facilityId,
        facility_name: updatedSettings.facilityName,
        address: updatedSettings.address || null,
        postal_code: updatedSettings.postalCode || null,
        latitude: updatedSettings.latitude || null,
        longitude: updatedSettings.longitude || null,
        regular_holidays: updatedSettings.regularHolidays,
        holiday_periods: updatedSettings.holidayPeriods || [],
        custom_holidays: updatedSettings.customHolidays,
        include_holidays: updatedSettings.includeHolidays || false,
        business_hours: updatedSettings.businessHours,
        business_hours_periods: updatedSettings.businessHoursPeriods || [],
        flexible_business_hours: updatedSettings.flexibleBusinessHours,
        service_hours: updatedSettings.serviceHours,
        flexible_service_hours: updatedSettings.flexibleServiceHours,
        service_categories: updatedSettings.serviceCategories,
        capacity: updatedSettings.capacity,
        transport_capacity: updatedSettings.transportCapacity,
        prescribed_working_hours: updatedSettings.prescribedWorkingHours,
        updated_at: new Date().toISOString(),
      };

      if (existingData) {
        upsertData.id = existingData.id;
      }

      const { data, error } = await supabase
        .from('facility_settings')
        .upsert(upsertData)
        .select()
        .single();

      if (error) {
        console.error('Error saving facility settings:', error);
        throw error;
      }

      // 変更履歴を保存
      try {
        await supabase
          .from('facility_settings_history')
          .insert({
            facility_id: facilityId,
            change_type: changeType,
            old_value: oldValue,
            new_value: newValue,
            changed_by: changedBy,
            description: changeDescription || null,
          });
      } catch {
        // 履歴保存の失敗は無視
      }

      if (data) {
        setFacilitySettings({
          id: data.id,
          facilityId: data.facility_id,
          facilityName: data.facility_name || '',
          address: data.address || undefined,
          postalCode: data.postal_code || undefined,
          latitude: data.latitude || undefined,
          longitude: data.longitude || undefined,
          regularHolidays: data.regular_holidays || [0],
          holidayPeriods: data.holiday_periods || [],
          customHolidays: data.custom_holidays || [],
          includeHolidays: data.include_holidays || false,
          businessHours: data.business_hours || DEFAULT_SETTINGS.businessHours,
          businessHoursPeriods: data.business_hours_periods || [],
          flexibleBusinessHours: data.flexible_business_hours || DEFAULT_SETTINGS.flexibleBusinessHours,
          serviceHours: data.service_hours || DEFAULT_SETTINGS.serviceHours,
          flexibleServiceHours: data.flexible_service_hours || DEFAULT_SETTINGS.flexibleServiceHours,
          serviceCategories: data.service_categories || DEFAULT_SETTINGS.serviceCategories,
          capacity: data.capacity || DEFAULT_SETTINGS.capacity,
          transportCapacity: data.transport_capacity || { pickup: 4, dropoff: 4 },
          prescribedWorkingHours: data.prescribed_working_hours || undefined,
          createdAt: data.created_at || new Date().toISOString(),
          updatedAt: data.updated_at || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error in updateFacilitySettings:', error);
      throw error;
    }
  };

  // 時間枠の追加
  const addTimeSlot = async (slotData: Omit<FacilityTimeSlot, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('facility_time_slots')
        .insert({
          facility_id: facilityId,
          name: slotData.name,
          start_time: slotData.startTime,
          end_time: slotData.endTime,
          capacity: slotData.capacity,
          display_order: slotData.displayOrder || 0,
        })
        .select()
        .single();

      if (error) throw error;

      const newSlot: FacilityTimeSlot = {
        id: data.id,
        facilityId: data.facility_id,
        name: data.name,
        startTime: data.start_time,
        endTime: data.end_time,
        capacity: data.capacity ?? 0,
        displayOrder: data.display_order || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      setTimeSlots(prev => [...prev, newSlot]);
      return newSlot;
    } catch (error) {
      console.error('Error adding time slot:', error);
      throw error;
    }
  };

  // 時間枠の更新
  const updateTimeSlot = async (slotId: string, slotData: Partial<Omit<FacilityTimeSlot, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (slotData.name !== undefined) updateData.name = slotData.name;
      if (slotData.startTime !== undefined) updateData.start_time = slotData.startTime;
      if (slotData.endTime !== undefined) updateData.end_time = slotData.endTime;
      if (slotData.capacity !== undefined) updateData.capacity = slotData.capacity;
      if (slotData.displayOrder !== undefined) updateData.display_order = slotData.displayOrder;

      const { error } = await supabase
        .from('facility_time_slots')
        .update(updateData)
        .eq('id', slotId);

      if (error) throw error;

      setTimeSlots(prev => prev.map(slot =>
        slot.id === slotId ? { ...slot, ...slotData, updatedAt: updateData.updated_at } : slot
      ));
    } catch (error) {
      console.error('Error updating time slot:', error);
      throw error;
    }
  };

  // 時間枠の削除
  const deleteTimeSlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('facility_time_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;
      setTimeSlots(prev => prev.filter(slot => slot.id !== slotId));
    } catch (error) {
      console.error('Error deleting time slot:', error);
      throw error;
    }
  };

  return {
    facilitySettings,
    loadingSettings,
    timeSlots,
    loadingTimeSlots,
    updateFacilitySettings,
    addTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,
  };
};
