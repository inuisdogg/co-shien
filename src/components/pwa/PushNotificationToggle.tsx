/**
 * Push Notification Toggle Component
 * Allows parents to enable/disable push notifications.
 * Shows permission state and subscribe/unsubscribe buttons.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import {
  isPushSupported,
  getPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

type Props = {
  userId: string;
};

export default function PushNotificationToggle({ userId }: Props) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const sup = isPushSupported();
      setSupported(sup);

      if (sup) {
        const perm = getPermissionState();
        setPermission(perm);

        // Check if already subscribed
        if (perm === 'granted') {
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            setIsSubscribed(!!sub);
          } catch {
            // ignore
          }
        }
      }
    };

    checkStatus();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const sub = await subscribeToPush(userId);
      if (sub) {
        setIsSubscribed(true);
        setPermission('granted');
      } else {
        // Permission was denied or subscription failed
        setPermission(getPermissionState());
      }
    } catch (error) {
      console.error('Push notification enable failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await unsubscribeFromPush(userId);
      setIsSubscribed(false);
    } catch (error) {
      console.error('Push notification disable failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-500">
        <BellOff className="w-5 h-5 text-gray-400" />
        <div>
          <p className="font-medium">プッシュ通知は非対応</p>
          <p className="text-xs text-gray-400">このブラウザでは通知機能がサポートされていません</p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 rounded-xl border border-red-200 text-sm">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <div>
          <p className="font-medium text-red-700">通知がブロックされています</p>
          <p className="text-xs text-red-500">ブラウザの設定から通知の許可を変更してください</p>
        </div>
      </div>
    );
  }

  if (isSubscribed) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-200">
        <CheckCircle className="w-5 h-5 text-emerald-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-800">通知は有効です</p>
          <p className="text-xs text-emerald-600">連絡帳が届いたときに通知を受け取ります</p>
        </div>
        <button
          onClick={handleDisable}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : '無効にする'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={loading}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Bell className="w-5 h-5" />
      )}
      <div className="flex-1 text-left">
        <p className="text-sm font-bold">通知を有効にする</p>
        <p className="text-xs text-white/70">連絡帳が届いたときにお知らせします</p>
      </div>
    </button>
  );
}
