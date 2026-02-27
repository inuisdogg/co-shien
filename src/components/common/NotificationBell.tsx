/**
 * 通知ベルコンポーネント
 * ヘッダーに配置する通知ベルアイコンとドロップダウンパネル
 * userIdを渡すだけで単体動作する
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Briefcase,
  MessageCircle,
  Search,
  Calendar,
  Star,
  Check,
  ArrowRight,
  Mail,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/types';

interface NotificationBellProps {
  userId?: string;
  color?: string;
}

/**
 * 通知タイプに対応するアイコンを返す
 */
function getNotificationIcon(type: AppNotification['type']) {
  switch (type) {
    case 'new_application':
      return <Briefcase size={16} className="text-[#00c4cc]" />;
    case 'new_message':
      return <MessageCircle size={16} className="text-blue-500" />;
    case 'scout':
      return <Search size={16} className="text-purple-500" />;
    case 'interview_proposed':
    case 'interview_confirmed':
      return <Calendar size={16} className="text-orange-500" />;
    case 'new_review':
      return <Star size={16} className="text-yellow-500" />;
    case 'application_status':
      return <Mail size={16} className="text-[#818CF8]" />;
    case 'job_match':
      return <Briefcase size={16} className="text-[#818CF8]" />;
    default:
      return <Bell size={16} className="text-gray-400" />;
  }
}

/**
 * 相対時間を日本語で表示する
 */
function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) {
    return 'たった今';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  }
  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }
  if (diffDays === 1) {
    return '昨日';
  }
  if (diffDays < 7) {
    return `${diffDays}日前`;
  }
  if (diffWeeks < 4) {
    return `${diffWeeks}週間前`;
  }

  // 4週間以上は日付表示
  return date.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  });
}

/**
 * 通知クリック時のナビゲーション先を決定する
 * 現時点では基本的なルーティングのみ実装
 */
function getNotificationAction(notification: AppNotification): string | null {
  const data = notification.data || {};

  switch (notification.type) {
    case 'new_application':
      // 採用管理タブへ
      return '/recruitment';
    case 'application_status':
      // キャリアダッシュボードへ
      return '/career';
    case 'new_message':
      // メッセージ/応募詳細へ
      if (data.applicationId) {
        return `/recruitment?application=${data.applicationId}`;
      }
      return null;
    case 'scout':
      // スカウト受信箱へ
      return '/career/scouts';
    case 'interview_proposed':
    case 'interview_confirmed':
      // 面接スケジュールへ
      return '/career';
    case 'new_review':
      // レビュー一覧へ
      return null;
    case 'job_match':
      // おすすめ求人へ
      return '/jobs';
    default:
      return null;
  }
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  color = '#00c4cc',
}) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications(userId);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 通知をクリック
  const handleNotificationClick = useCallback(
    (notification: AppNotification) => {
      // 未読なら既読にする
      if (!notification.read) {
        markAsRead(notification.id);
      }

      // ナビゲーション先があればページ遷移
      const url = getNotificationAction(notification);
      if (url) {
        window.location.href = url;
        setIsOpen(false);
      }
    },
    [markAsRead]
  );

  // 「すべて既読にする」をクリック
  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // 表示する通知は最大20件
  const visibleNotifications = notifications.slice(0, 20);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ベルアイコンボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="通知"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell
          size={18}
          className="transition-colors"
          style={{ color: isOpen ? color : '#6b7280' }}
        />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold px-1"
            aria-live="polite"
            aria-label={`未読通知 ${unreadCount > 99 ? '99件以上' : `${unreadCount}件`}`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ドロップダウンパネル */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50" role="menu" aria-label="通知一覧">
          {/* ヘッダー */}
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900">通知</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs hover:underline flex items-center gap-1 transition-colors"
                style={{ color }}
              >
                <Check size={12} />
                すべて既読にする
              </button>
            )}
          </div>

          {/* 通知リスト */}
          <div className="max-h-[400px] overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                通知はありません
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  role="menuitem"
                  tabIndex={0}
                  className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50/40' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotificationClick(notification); } }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* 通知タイプアイコン */}
                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* 通知内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1.5">
                        <p className="text-sm font-medium text-gray-800 truncate flex-1">
                          {notification.title}
                        </p>
                        {/* 未読インジケーター */}
                        {!notification.read && (
                          <span
                            className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                        )}
                      </div>
                      {notification.body && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {getRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* フッター */}
          {visibleNotifications.length > 0 && (
            <div className="p-2 border-t border-gray-100">
              <button
                className="w-full text-center text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                style={{ color }}
                onClick={() => {
                  // TODO: 通知一覧ページへのナビゲーション
                  setIsOpen(false);
                }}
              >
                すべての通知を見る
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
