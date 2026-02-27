/**
 * 面接日程調整フック
 * 面接スロットの提案・承認・辞退・キャンセルを管理する。
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { InterviewSlot } from '@/types';

// ------------------------------------------------------------------ mapper

function mapInterviewSlot(row: Record<string, unknown>): InterviewSlot {
  return {
    id: row.id as string,
    jobApplicationId: row.job_application_id as string,
    proposedBy: row.proposed_by as InterviewSlot['proposedBy'],
    proposedDatetime: row.proposed_datetime as string,
    durationMinutes: Number(row.duration_minutes) || 30,
    format: row.format as InterviewSlot['format'],
    location: (row.location as string) || undefined,
    meetingUrl: (row.meeting_url as string) || undefined,
    status: row.status as InterviewSlot['status'],
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
  };
}

// ------------------------------------------------------------------ hook

export function useInterviewScheduling() {
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- スロット一覧取得 ----
  const fetchSlots = useCallback(async (applicationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('interview_slots')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('proposed_datetime', { ascending: true });

      if (fetchErr) throw fetchErr;

      const mapped = (data || []).map((row: Record<string, unknown>) => mapInterviewSlot(row));
      setSlots(mapped);
      return mapped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '面接スロットの取得に失敗しました';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- スロット提案 ----
  const proposeSlot = useCallback(async (
    applicationId: string,
    proposedBy: 'facility' | 'applicant',
    datetime: string,
    format: 'in_person' | 'online' | 'phone',
    durationMinutes?: number,
    location?: string,
    meetingUrl?: string,
    notes?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertErr } = await supabase
        .from('interview_slots')
        .insert({
          job_application_id: applicationId,
          proposed_by: proposedBy,
          proposed_datetime: datetime,
          duration_minutes: durationMinutes || 30,
          format,
          location: location || null,
          meeting_url: meetingUrl || null,
          status: 'proposed',
          notes: notes || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const mapped = mapInterviewSlot(data as Record<string, unknown>);
      setSlots(prev => [...prev, mapped].sort(
        (a, b) => new Date(a.proposedDatetime).getTime() - new Date(b.proposedDatetime).getTime()
      ));
      return mapped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '日程提案に失敗しました';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- スロット承認（他のproposedスロットは自動辞退） ----
  const acceptSlot = useCallback(async (slotId: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. 対象スロットを取得
      const targetSlot = slots.find(s => s.id === slotId);
      if (!targetSlot) throw new Error('スロットが見つかりません');

      // 2. 対象スロットを承認
      const { error: acceptErr } = await supabase
        .from('interview_slots')
        .update({ status: 'accepted' })
        .eq('id', slotId);

      if (acceptErr) throw acceptErr;

      // 3. 同じapplicationの他のproposedスロットを辞退
      const { error: declineErr } = await supabase
        .from('interview_slots')
        .update({ status: 'declined' })
        .eq('job_application_id', targetSlot.jobApplicationId)
        .eq('status', 'proposed')
        .neq('id', slotId);

      if (declineErr) throw declineErr;

      // 4. job_applicationの面接情報を更新
      const updateData: Record<string, unknown> = {
        interview_date: targetSlot.proposedDatetime,
        interview_format: targetSlot.format,
        updated_at: new Date().toISOString(),
      };
      if (targetSlot.location) {
        updateData.interview_location = targetSlot.location;
      }
      if (targetSlot.meetingUrl) {
        updateData.interview_meeting_url = targetSlot.meetingUrl;
      }

      const { error: appErr } = await supabase
        .from('job_applications')
        .update(updateData)
        .eq('id', targetSlot.jobApplicationId);

      if (appErr) throw appErr;

      // 5. ローカルステート更新
      setSlots(prev => prev.map(s => {
        if (s.id === slotId) return { ...s, status: 'accepted' as const };
        if (s.jobApplicationId === targetSlot.jobApplicationId && s.status === 'proposed') {
          return { ...s, status: 'declined' as const };
        }
        return s;
      }));

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'スロットの承認に失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [slots]);

  // ---- スロット辞退 ----
  const declineSlot = useCallback(async (slotId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('interview_slots')
        .update({ status: 'declined' })
        .eq('id', slotId);

      if (updateErr) throw updateErr;

      setSlots(prev => prev.map(s =>
        s.id === slotId ? { ...s, status: 'declined' as const } : s
      ));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'スロットの辞退に失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- スロットキャンセル ----
  const cancelSlot = useCallback(async (slotId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('interview_slots')
        .update({ status: 'cancelled' })
        .eq('id', slotId);

      if (updateErr) throw updateErr;

      setSlots(prev => prev.map(s =>
        s.id === slotId ? { ...s, status: 'cancelled' as const } : s
      ));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'スロットのキャンセルに失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    slots,
    loading,
    error,
    fetchSlots,
    proposeSlot,
    acceptSlot,
    declineSlot,
    cancelSlot,
  };
}
