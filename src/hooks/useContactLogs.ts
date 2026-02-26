/**
 * 連絡帳データ管理フック
 * contact_logs テーブルの取得・CRUD操作
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ContactLog, ContactLogFormData } from '@/types';

export const useContactLogs = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);

  // Supabaseから連絡帳データを取得
  useEffect(() => {
    if (!facilityId) {
      return;
    }

    const fetchContactLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('contact_logs')
          .select('*')
          .eq('facility_id', facilityId)
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching contact logs:', error);
          return;
        }

        if (data) {
          const contactLogsData: ContactLog[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            childId: row.child_id,
            scheduleId: row.schedule_id || undefined,
            date: row.date,
            slot: row.slot || undefined,
            activities: row.activities || undefined,
            healthStatus: row.health_status || undefined,
            mood: row.mood || undefined,
            appetite: row.appetite || undefined,
            mealMain: row.meal_main || false,
            mealSide: row.meal_side || false,
            mealNotes: row.meal_notes || undefined,
            toiletCount: row.toilet_count || 0,
            toiletNotes: row.toilet_notes || undefined,
            napStartTime: row.nap_start_time || undefined,
            napEndTime: row.nap_end_time || undefined,
            napNotes: row.nap_notes || undefined,
            staffComment: row.staff_comment || undefined,
            staffUserId: row.staff_user_id || undefined,
            parentMessage: row.parent_message || undefined,
            parentReply: row.parent_reply || undefined,
            parentReplyAt: row.parent_reply_at || undefined,
            isSigned: row.is_signed || false,
            signedAt: row.signed_at || undefined,
            signedByUserId: row.signed_by_user_id || undefined,
            signatureData: row.signature_data || undefined,
            parentSignerName: row.parent_signer_name || undefined,
            status: row.status || 'draft',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: row.created_by || undefined,
          }));
          setContactLogs(contactLogsData);
        }
      } catch (error) {
        console.error('Error in fetchContactLogs:', error);
      }
    };

    fetchContactLogs();
  }, [facilityId]);

  const filteredContactLogs = useMemo(
    () => contactLogs.filter((c) => c.facilityId === facilityId),
    [contactLogs, facilityId]
  );

  const getContactLogByScheduleId = (scheduleId: string): ContactLog | undefined => {
    return contactLogs.find((c) => c.scheduleId === scheduleId);
  };

  const getContactLogByChildAndDate = (childId: string, date: string, slot?: string): ContactLog | undefined => {
    return contactLogs.find((c) =>
      c.childId === childId &&
      c.date === date &&
      (slot ? c.slot === slot : true)
    );
  };

  const addContactLog = async (data: ContactLogFormData) => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    const contactLogId = `contact-${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('contact_logs')
        .insert({
          id: contactLogId,
          facility_id: facilityId,
          child_id: data.childId,
          schedule_id: data.scheduleId || null,
          date: data.date,
          slot: data.slot || null,
          activities: data.activities || null,
          health_status: data.healthStatus || null,
          mood: data.mood || null,
          appetite: data.appetite || null,
          meal_main: data.mealMain || false,
          meal_side: data.mealSide || false,
          meal_notes: data.mealNotes || null,
          toilet_count: data.toiletCount || 0,
          toilet_notes: data.toiletNotes || null,
          nap_start_time: data.napStartTime || null,
          nap_end_time: data.napEndTime || null,
          nap_notes: data.napNotes || null,
          staff_comment: data.staffComment || null,
          staff_user_id: data.staffUserId || null,
          parent_message: data.parentMessage || null,
          status: data.status || 'draft',
          parent_signer_name: data.parentSignerName || null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      const newContactLog: ContactLog = {
        ...data,
        id: contactLogId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setContactLogs(prev => [...prev, newContactLog]);
      return newContactLog;
    } catch (error) {
      console.error('Error in addContactLog:', error);
      throw error;
    }
  };

  const updateContactLog = async (contactLogId: string, data: Partial<ContactLogFormData>) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (data.activities !== undefined) updateData.activities = data.activities;
      if (data.healthStatus !== undefined) updateData.health_status = data.healthStatus;
      if (data.mood !== undefined) updateData.mood = data.mood;
      if (data.appetite !== undefined) updateData.appetite = data.appetite;
      if (data.mealMain !== undefined) updateData.meal_main = data.mealMain;
      if (data.mealSide !== undefined) updateData.meal_side = data.mealSide;
      if (data.mealNotes !== undefined) updateData.meal_notes = data.mealNotes;
      if (data.toiletCount !== undefined) updateData.toilet_count = data.toiletCount;
      if (data.toiletNotes !== undefined) updateData.toilet_notes = data.toiletNotes;
      if (data.napStartTime !== undefined) updateData.nap_start_time = data.napStartTime;
      if (data.napEndTime !== undefined) updateData.nap_end_time = data.napEndTime;
      if (data.napNotes !== undefined) updateData.nap_notes = data.napNotes;
      if (data.staffComment !== undefined) updateData.staff_comment = data.staffComment;
      if (data.parentMessage !== undefined) updateData.parent_message = data.parentMessage;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.parentSignerName !== undefined) updateData.parent_signer_name = data.parentSignerName;
      if (data.isSigned !== undefined) updateData.is_signed = data.isSigned;
      if (data.signedAt !== undefined) updateData.signed_at = data.signedAt;
      if (data.signedByUserId !== undefined) updateData.signed_by_user_id = data.signedByUserId;
      if (data.signatureData !== undefined) updateData.signature_data = data.signatureData;

      const { error } = await supabase
        .from('contact_logs')
        .update(updateData)
        .eq('id', contactLogId);

      if (error) throw error;

      setContactLogs(prev =>
        prev.map((c) =>
          c.id === contactLogId
            ? { ...c, ...data, updatedAt: updateData.updated_at }
            : c
        )
      );
    } catch (error) {
      console.error('Error in updateContactLog:', error);
      throw error;
    }
  };

  const deleteContactLog = async (contactLogId: string) => {
    try {
      const { error } = await supabase
        .from('contact_logs')
        .delete()
        .eq('id', contactLogId);

      if (error) throw error;

      setContactLogs(prev => prev.filter((c) => c.id !== contactLogId));
    } catch (error) {
      console.error('Error in deleteContactLog:', error);
      throw error;
    }
  };

  return {
    contactLogs: filteredContactLogs,
    addContactLog,
    updateContactLog,
    deleteContactLog,
    getContactLogByScheduleId,
    getContactLogByChildAndDate,
  };
};
