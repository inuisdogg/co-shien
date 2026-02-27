/**
 * スカウトメッセージ管理フック
 * 施設側のスカウト送信と、候補者側のスカウト受信を管理する。
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ScoutMessage } from '@/types';

// ------------------------------------------------------------------ mapper

function mapScoutMessage(row: Record<string, unknown>): ScoutMessage {
  // Handle joined data
  const facility = row.facilities as Record<string, unknown> | null;
  const jobPosting = row.job_postings as Record<string, unknown> | null;
  const sender = row.users as Record<string, unknown> | null;

  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    senderUserId: row.sender_user_id as string,
    targetUserId: row.target_user_id as string,
    jobPostingId: (row.job_posting_id as string) || undefined,
    subject: row.subject as string,
    message: row.message as string,
    status: row.status as ScoutMessage['status'],
    readAt: (row.read_at as string) || undefined,
    repliedAt: (row.replied_at as string) || undefined,
    createdAt: row.created_at as string,
    // joined fields
    facilityName: facility?.name as string | undefined,
    jobTitle: jobPosting?.title as string | undefined,
    senderName: sender?.name as string | undefined,
  };
}

// ------------------------------------------------------------------ hook

export function useScout() {
  const [scouts, setScouts] = useState<ScoutMessage[]>([]);
  const [sentScouts, setSentScouts] = useState<ScoutMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- 施設側: 候補者を取得（スカウト対象） ----
  const fetchCandidates = useCallback(async (filters?: {
    qualifications?: string[];
    keyword?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('users')
        .select('id, name, qualifications, experience_years, created_at')
        .eq('user_type', 'staff')
        .order('created_at', { ascending: false });

      if (filters?.qualifications && filters.qualifications.length > 0) {
        query = query.overlaps('qualifications', filters.qualifications);
      }

      if (filters?.keyword) {
        query = query.ilike('name', `%${filters.keyword}%`);
      }

      const { data, error: fetchErr } = await query.limit(50);
      if (fetchErr) throw fetchErr;
      return data || [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '候補者の取得に失敗しました';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- 施設側: スカウト送信 ----
  const sendScout = useCallback(async (
    facilityId: string,
    senderUserId: string,
    targetUserId: string,
    jobPostingId: string | undefined,
    subject: string,
    message: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertErr } = await supabase
        .from('scout_messages')
        .insert({
          facility_id: facilityId,
          sender_user_id: senderUserId,
          target_user_id: targetUserId,
          job_posting_id: jobPostingId || null,
          subject,
          message,
          status: 'sent',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'スカウト送信に失敗しました';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- 施設側: 送信済みスカウト一覧 ----
  const fetchSentScouts = useCallback(async (facilityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('scout_messages')
        .select(`
          *,
          users!scout_messages_target_user_id_fkey(name),
          job_postings(title)
        `)
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      const mapped = (data || []).map((row: Record<string, unknown>) => {
        const targetUser = row.users as Record<string, unknown> | null;
        return {
          ...mapScoutMessage(row),
          senderName: targetUser?.name as string | undefined,
        };
      });
      setSentScouts(mapped);
      return mapped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '送信済みスカウトの取得に失敗しました';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- 候補者側: 受信スカウト一覧 ----
  const fetchMyScouts = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('scout_messages')
        .select(`
          *,
          facilities(name),
          job_postings(title),
          users!scout_messages_sender_user_id_fkey(name)
        `)
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      const mapped = (data || []).map((row: Record<string, unknown>) => mapScoutMessage(row));
      setScouts(mapped);
      return mapped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'スカウトの取得に失敗しました';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- 候補者側: 既読にする ----
  const markScoutRead = useCallback(async (scoutId: string) => {
    try {
      const { error: updateErr } = await supabase
        .from('scout_messages')
        .update({
          status: 'read',
          read_at: new Date().toISOString(),
        })
        .eq('id', scoutId)
        .eq('status', 'sent');

      if (updateErr) throw updateErr;

      setScouts(prev => prev.map(s =>
        s.id === scoutId && s.status === 'sent'
          ? { ...s, status: 'read' as const, readAt: new Date().toISOString() }
          : s
      ));
    } catch (err: unknown) {
      console.error('既読更新エラー:', err);
    }
  }, []);

  // ---- 候補者側: 返信（応募に繋げる） ----
  const replyToScout = useCallback(async (scoutId: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('scout_messages')
        .update({
          status: 'replied',
          replied_at: new Date().toISOString(),
        })
        .eq('id', scoutId);

      if (updateErr) throw updateErr;

      setScouts(prev => prev.map(s =>
        s.id === scoutId
          ? { ...s, status: 'replied' as const, repliedAt: new Date().toISOString() }
          : s
      ));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '返信に失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- 候補者側: 辞退 ----
  const declineScout = useCallback(async (scoutId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('scout_messages')
        .update({ status: 'declined' })
        .eq('id', scoutId);

      if (updateErr) throw updateErr;

      setScouts(prev => prev.map(s =>
        s.id === scoutId ? { ...s, status: 'declined' as const } : s
      ));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '辞退に失敗しました';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    scouts,
    sentScouts,
    loading,
    error,
    fetchCandidates,
    sendScout,
    fetchSentScouts,
    fetchMyScouts,
    markScoutRead,
    replyToScout,
    declineScout,
  };
}
