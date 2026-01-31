'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ConsultationThread,
  ConsultationMessage,
  ConsultationThreadFormData,
  ConsultationStatus,
  mapConsultationThreadFromDB,
  mapConsultationMessageFromDB,
} from '@/types/expert';

export type UseConsultationsReturn = {
  threads: ConsultationThread[];
  isLoading: boolean;
  error: string | null;

  // スレッド操作
  createThread: (data: ConsultationThreadFormData) => Promise<ConsultationThread | null>;
  updateThreadStatus: (threadId: string, status: ConsultationStatus) => Promise<boolean>;
  rateThread: (threadId: string, rating: number, comment?: string) => Promise<boolean>;

  // リフレッシュ
  refresh: () => Promise<void>;
};

// エキスパート側の相談一覧
export function useExpertConsultations(expertId?: string): UseConsultationsReturn {
  const [threads, setThreads] = useState<ConsultationThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    if (!expertId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('consultation_threads')
        .select(`
          *,
          client:users!consultation_threads_client_user_id_fkey(name)
        `)
        .eq('expert_id', expertId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const mappedThreads = (data || []).map(row => {
        const thread = mapConsultationThreadFromDB(row);
        thread.clientName = row.client?.name;
        return thread;
      });

      setThreads(mappedThreads);
    } catch (err) {
      console.error('Error fetching threads:', err);
      setError('相談一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [expertId]);

  const createThread = useCallback(async (): Promise<ConsultationThread | null> => {
    // エキスパート側からはスレッド作成しない
    return null;
  }, []);

  const updateThreadStatus = useCallback(async (threadId: string, status: ConsultationStatus): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('consultation_threads')
        .update({ status })
        .eq('id', threadId);

      if (updateError) {
        throw updateError;
      }

      await fetchThreads();
      return true;
    } catch (err) {
      console.error('Error updating thread status:', err);
      setError('ステータスの更新に失敗しました');
      return false;
    }
  }, [fetchThreads]);

  const rateThread = useCallback(async (): Promise<boolean> => {
    // エキスパート側からは評価しない
    return false;
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  return {
    threads,
    isLoading,
    error,
    createThread,
    updateThreadStatus,
    rateThread,
    refresh: fetchThreads,
  };
}

// クライアント側の相談一覧
export function useClientConsultations(clientUserId?: string): UseConsultationsReturn {
  const [threads, setThreads] = useState<ConsultationThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    if (!clientUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('consultation_threads')
        .select(`
          *,
          expert:expert_profiles!consultation_threads_expert_id_fkey(
            id, display_name, profession, page_theme
          )
        `)
        .eq('client_user_id', clientUserId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const mappedThreads = (data || []).map(row => {
        const thread = mapConsultationThreadFromDB(row);
        if (row.expert) {
          thread.expertProfile = {
            id: row.expert.id,
            displayName: row.expert.display_name,
            profession: row.expert.profession,
            pageTheme: row.expert.page_theme,
          } as any;
        }
        return thread;
      });

      setThreads(mappedThreads);
    } catch (err) {
      console.error('Error fetching threads:', err);
      setError('相談一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [clientUserId]);

  const createThread = useCallback(async (data: ConsultationThreadFormData): Promise<ConsultationThread | null> => {
    if (!clientUserId) {
      setError('ログインが必要です');
      return null;
    }

    try {
      setError(null);

      // スレッド作成
      const { data: thread, error: threadError } = await supabase
        .from('consultation_threads')
        .insert({
          expert_id: data.expertId,
          client_user_id: clientUserId,
          subject: data.subject,
          child_age: data.childAge,
          consultation_type: data.consultationType,
        })
        .select()
        .single();

      if (threadError) {
        throw threadError;
      }

      // 初回メッセージ作成
      const { error: messageError } = await supabase
        .from('consultation_messages')
        .insert({
          thread_id: thread.id,
          sender_id: clientUserId,
          sender_type: 'client',
          message: data.initialMessage,
        });

      if (messageError) {
        throw messageError;
      }

      await fetchThreads();
      return mapConsultationThreadFromDB(thread);
    } catch (err) {
      console.error('Error creating thread:', err);
      setError('相談の開始に失敗しました');
      return null;
    }
  }, [clientUserId, fetchThreads]);

  const updateThreadStatus = useCallback(async (threadId: string, status: ConsultationStatus): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('consultation_threads')
        .update({ status })
        .eq('id', threadId);

      if (updateError) {
        throw updateError;
      }

      await fetchThreads();
      return true;
    } catch (err) {
      console.error('Error updating thread status:', err);
      setError('ステータスの更新に失敗しました');
      return false;
    }
  }, [fetchThreads]);

  const rateThread = useCallback(async (threadId: string, rating: number, comment?: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('consultation_threads')
        .update({
          rating,
          rating_comment: comment,
          rated_at: new Date().toISOString(),
        })
        .eq('id', threadId);

      if (updateError) {
        throw updateError;
      }

      await fetchThreads();
      return true;
    } catch (err) {
      console.error('Error rating thread:', err);
      setError('評価の送信に失敗しました');
      return false;
    }
  }, [fetchThreads]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  return {
    threads,
    isLoading,
    error,
    createThread,
    updateThreadStatus,
    rateThread,
    refresh: fetchThreads,
  };
}

// 相談メッセージ管理フック
export function useConsultationMessages(threadId?: string, currentUserId?: string) {
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!threadId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('consultation_messages')
        .select(`
          *,
          sender:users!consultation_messages_sender_id_fkey(name)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const mappedMessages = (data || []).map(row => {
        const msg = mapConsultationMessageFromDB(row);
        msg.senderName = row.sender?.name;
        return msg;
      });

      setMessages(mappedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('メッセージの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  // メッセージ送信
  const sendMessage = useCallback(async (
    message: string,
    senderType: 'expert' | 'client',
    attachments?: string[]
  ): Promise<boolean> => {
    if (!threadId || !currentUserId) {
      setError('メッセージを送信できません');
      return false;
    }

    try {
      setError(null);

      const { error: insertError } = await supabase
        .from('consultation_messages')
        .insert({
          thread_id: threadId,
          sender_id: currentUserId,
          sender_type: senderType,
          message,
          attachments: attachments || [],
        });

      if (insertError) {
        throw insertError;
      }

      await fetchMessages();
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('メッセージの送信に失敗しました');
      return false;
    }
  }, [threadId, currentUserId, fetchMessages]);

  // メッセージ既読
  const markAsRead = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('consultation_messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (updateError) {
        throw updateError;
      }

      return true;
    } catch (err) {
      console.error('Error marking as read:', err);
      return false;
    }
  }, []);

  // Realtime購読
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`consultation_messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'consultation_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMessage = mapConsultationMessageFromDB(payload.new as Record<string, unknown>);
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    markAsRead,
    refresh: fetchMessages,
  };
}
