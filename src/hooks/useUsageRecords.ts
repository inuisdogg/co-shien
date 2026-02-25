/**
 * 利用実績データ管理フック
 * usage_records テーブルの取得・CRUD操作
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { UsageRecord, UsageRecordFormData } from '@/types';

export const useUsageRecords = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);

  // Supabaseから利用実績データを取得
  useEffect(() => {
    if (!facilityId) {
      return;
    }

    const fetchUsageRecords = async () => {
      try {
        const { data, error } = await supabase
          .from('usage_records')
          .select('*')
          .eq('facility_id', facilityId)
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching usage records:', error);
          return;
        }

        if (data) {
          const usageRecordsData: UsageRecord[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            scheduleId: row.schedule_id,
            childId: row.child_id,
            childName: row.child_name,
            date: row.date,
            serviceStatus: row.service_status,
            provisionForm: row.provision_form || undefined,
            plannedStartTime: row.planned_start_time || undefined,
            plannedEndTime: row.planned_end_time || undefined,
            plannedTimeOneMinuteInterval: row.planned_time_one_minute_interval || false,
            actualStartTime: row.actual_start_time || undefined,
            actualEndTime: row.actual_end_time || undefined,
            actualTimeOneMinuteInterval: row.actual_time_one_minute_interval || false,
            calculatedTime: row.calculated_time || 0,
            calculatedTimeMethod: row.calculated_time_method,
            timeCategory: row.time_category || undefined,
            pickup: row.pickup,
            pickupSamePremises: row.pickup_same_premises || false,
            dropoff: row.dropoff,
            dropoffSamePremises: row.dropoff_same_premises || false,
            room: row.room || undefined,
            instructionForm: row.instruction_form || undefined,
            billingTarget: row.billing_target,
            selfPayItem: row.self_pay_item || undefined,
            memo: row.memo || undefined,
            recordSheetRemarks: row.record_sheet_remarks || undefined,
            addonItems: row.addon_items || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          setUsageRecords(usageRecordsData);
        }
      } catch (error) {
        console.error('Error in fetchUsageRecords:', error);
      }
    };

    fetchUsageRecords();
  }, [facilityId]);

  const filteredUsageRecords = useMemo(
    () => usageRecords.filter((r) => r.facilityId === facilityId),
    [usageRecords, facilityId]
  );

  const addUsageRecord = async (recordData: UsageRecordFormData) => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    const recordId = `record-${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('usage_records')
        .insert({
          id: recordId,
          facility_id: facilityId,
          schedule_id: recordData.scheduleId,
          child_id: recordData.childId,
          child_name: recordData.childName,
          date: recordData.date,
          service_status: recordData.serviceStatus,
          provision_form: recordData.provisionForm || null,
          planned_start_time: recordData.plannedStartTime || null,
          planned_end_time: recordData.plannedEndTime || null,
          planned_time_one_minute_interval: recordData.plannedTimeOneMinuteInterval || false,
          actual_start_time: recordData.actualStartTime || null,
          actual_end_time: recordData.actualEndTime || null,
          actual_time_one_minute_interval: recordData.actualTimeOneMinuteInterval || false,
          calculated_time: recordData.calculatedTime || 0,
          calculated_time_method: recordData.calculatedTimeMethod,
          time_category: recordData.timeCategory || null,
          pickup: recordData.pickup,
          pickup_same_premises: recordData.pickupSamePremises || false,
          dropoff: recordData.dropoff,
          dropoff_same_premises: recordData.dropoffSamePremises || false,
          room: recordData.room || null,
          instruction_form: recordData.instructionForm || '個別',
          billing_target: recordData.billingTarget,
          self_pay_item: recordData.selfPayItem || null,
          memo: recordData.memo || null,
          record_sheet_remarks: recordData.recordSheetRemarks || null,
          addon_items: recordData.addonItems || [],
          created_at: now,
          updated_at: now,
        });

      if (error) throw error;

      const newRecord: UsageRecord = {
        ...recordData,
        id: recordId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setUsageRecords(prev => [...prev, newRecord]);
      return newRecord;
    } catch (err) {
      console.error('Failed to add usage record:', err);
      throw err;
    }
  };

  const updateUsageRecord = async (recordId: string, recordData: Partial<UsageRecordFormData>) => {
    const now = new Date().toISOString();

    try {
      const updateData: Record<string, unknown> = {
        updated_at: now,
      };

      // Map camelCase to snake_case for DB
      if (recordData.serviceStatus !== undefined) updateData.service_status = recordData.serviceStatus;
      if (recordData.provisionForm !== undefined) updateData.provision_form = recordData.provisionForm;
      if (recordData.plannedStartTime !== undefined) updateData.planned_start_time = recordData.plannedStartTime;
      if (recordData.plannedEndTime !== undefined) updateData.planned_end_time = recordData.plannedEndTime;
      if (recordData.plannedTimeOneMinuteInterval !== undefined) updateData.planned_time_one_minute_interval = recordData.plannedTimeOneMinuteInterval;
      if (recordData.actualStartTime !== undefined) updateData.actual_start_time = recordData.actualStartTime;
      if (recordData.actualEndTime !== undefined) updateData.actual_end_time = recordData.actualEndTime;
      if (recordData.actualTimeOneMinuteInterval !== undefined) updateData.actual_time_one_minute_interval = recordData.actualTimeOneMinuteInterval;
      if (recordData.calculatedTime !== undefined) updateData.calculated_time = recordData.calculatedTime;
      if (recordData.calculatedTimeMethod !== undefined) updateData.calculated_time_method = recordData.calculatedTimeMethod;
      if (recordData.timeCategory !== undefined) updateData.time_category = recordData.timeCategory;
      if (recordData.pickup !== undefined) updateData.pickup = recordData.pickup;
      if (recordData.pickupSamePremises !== undefined) updateData.pickup_same_premises = recordData.pickupSamePremises;
      if (recordData.dropoff !== undefined) updateData.dropoff = recordData.dropoff;
      if (recordData.dropoffSamePremises !== undefined) updateData.dropoff_same_premises = recordData.dropoffSamePremises;
      if (recordData.room !== undefined) updateData.room = recordData.room;
      if (recordData.instructionForm !== undefined) updateData.instruction_form = recordData.instructionForm;
      if (recordData.billingTarget !== undefined) updateData.billing_target = recordData.billingTarget;
      if (recordData.selfPayItem !== undefined) updateData.self_pay_item = recordData.selfPayItem;
      if (recordData.memo !== undefined) updateData.memo = recordData.memo;
      if (recordData.recordSheetRemarks !== undefined) updateData.record_sheet_remarks = recordData.recordSheetRemarks;
      if (recordData.addonItems !== undefined) updateData.addon_items = recordData.addonItems;

      const { error } = await supabase
        .from('usage_records')
        .update(updateData)
        .eq('id', recordId);

      if (error) throw error;

      setUsageRecords(prev =>
        prev.map((r) =>
          r.id === recordId
            ? { ...r, ...recordData, updatedAt: now }
            : r
        )
      );
    } catch (err) {
      console.error('Failed to update usage record:', err);
      throw err;
    }
  };

  const deleteUsageRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('usage_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      setUsageRecords(prev => prev.filter((r) => r.id !== recordId));
    } catch (err) {
      console.error('Failed to delete usage record:', err);
      throw err;
    }
  };

  const getUsageRecordByScheduleId = (scheduleId: string): UsageRecord | undefined => {
    return usageRecords.find((r) => r.scheduleId === scheduleId);
  };

  return {
    usageRecords: filteredUsageRecords,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    getUsageRecordByScheduleId,
  };
};
