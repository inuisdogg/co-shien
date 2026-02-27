/**
 * 通知管理フック
 * ユーザーのアプリ内通知の取得・既読管理・リアルタイム購読を行う
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/types';

/**
 * DB行からAppNotification型へのマッピング（snake_case → camelCase）
 */
function mapRowToAppNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as AppNotification['type'],
    title: row.title as string,
    body: (row.body as string) || undefined,
    data: (row.data as Record<string, unknown>) || undefined,
    read: row.read as boolean,
    createdAt: row.created_at as string,
  };
}

/**
 * 通知を作成するユーティリティ関数（フック外から呼び出し可能）
 * API Routeやその他のサーバーサイド処理からも使用可能
 */
export async function createNotification(
  userId: string,
  type: AppNotification['type'],
  title: string,
  body?: string,
  data?: Record<string, unknown>
): Promise<AppNotification | null> {
  try {
    const { data: row, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body: body || null,
        data: data || null,
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Notifications] 通知作成エラー:', error);
      return null;
    }

    return row ? mapRowToAppNotification(row) : null;
  } catch (err) {
    console.error('[Notifications] 通知作成例外:', err);
    return null;
  }
}

/**
 * useNotifications フック
 * ユーザーの通知一覧取得・既読管理・ポーリング・リアルタイム購読を提供
 */
export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /**
   * 通知一覧を取得（最新50件）
   */
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[Notifications] 通知取得エラー:', error);
        return;
      }

      if (data) {
        const mapped = data.map(mapRowToAppNotification);
        setNotifications(mapped);
        setUnreadCount(mapped.filter((n) => !n.read).length);
      }
    } catch (err) {
      console.error('[Notifications] 通知取得例外:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * 未読件数のみを取得（軽量ポーリング用）
   */
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('[Notifications] 未読件数取得エラー:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (err) {
      console.error('[Notifications] 未読件数取得例外:', err);
    }
  }, [userId]);

  /**
   * 単一の通知を既読にする
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);

        if (error) {
          console.error('[Notifications] 既読更新エラー:', error);
          return;
        }

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('[Notifications] 既読更新例外:', err);
      }
    },
    []
  );

  /**
   * すべての通知を既読にする
   */
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('[Notifications] 全既読更新エラー:', error);
        return;
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[Notifications] 全既読更新例外:', err);
    }
  }, [userId]);

  /**
   * 初回取得
   */
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /**
   * 30秒ごとの未読件数ポーリング
   */
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, fetchUnreadCount]);

  /**
   * Supabase Realtimeによるリアルタイム購読
   * notifications テーブルへのINSERTをリッスンし、新着通知を即座に反映
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = mapRowToAppNotification(
            payload.new as Record<string, unknown>
          );
          setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
          if (!newNotification.read) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
  };
}
