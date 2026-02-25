/**
 * ヘッダーコンポーネント
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Bell, Menu, LogOut, User, X, Check } from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { getPersonalBaseUrl } from '@/utils/domain';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';

interface HeaderProps {
  onMenuClick?: () => void;
  onLogoClick?: () => void;
  mode?: 'business' | 'career';
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogoClick, mode = 'business' }) => {
  const { requests } = useFacilityData();
  const { user, logout, facility } = useAuth();
  const router = useRouter();
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  // 通知機能
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // 通知を取得
  useEffect(() => {
    if (!facility?.id) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            related_user:related_user_id (name)
          `)
          .eq('facility_id', facility.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          const formattedNotifications: Notification[] = data.map((n: any) => ({
            id: n.id,
            facilityId: n.facility_id,
            userId: n.user_id,
            type: n.type,
            title: n.title,
            message: n.message,
            relatedUserId: n.related_user_id,
            isRead: n.is_read,
            readAt: n.read_at,
            createdAt: n.created_at,
            updatedAt: n.updated_at,
            relatedUserName: n.related_user?.name,
          }));
          setNotifications(formattedNotifications);
          setUnreadCount(formattedNotifications.filter(n => !n.isRead).length);
        }
      } catch (err) {
        console.error('通知取得エラー:', err);
      }
    };

    fetchNotifications();
    // 30秒ごとに更新
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [facility?.id]);

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 通知を既読にする
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('既読更新エラー:', err);
    }
  };

  // 全て既読にする
  const markAllAsRead = async () => {
    if (!facility?.id) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('facility_id', facility.id)
        .eq('is_read', false);

      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('全既読更新エラー:', err);
    }
  };
  
  const isCareer = mode === 'career';
  const primaryColor = isCareer ? '#818CF8' : '#00c4cc';
  const primaryColorDark = isCareer ? '#6366F1' : '#00b0b8';

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
      {/* Mobile: hamburger + logo */}
      <div className="flex items-center md:hidden">
        <button onClick={onMenuClick} className="text-gray-500 hover:text-gray-700 mr-3 p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <Menu size={22} />
        </button>
        <button
          onClick={onLogoClick}
          className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          <Image src="/logo.svg" alt="Roots" width={120} height={36} className="h-8 w-auto object-contain" priority />
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              isCareer
                ? 'bg-[#818CF8]/10 text-[#818CF8]'
                : 'bg-[#00c4cc]/10 text-[#00c4cc]'
            }`}
          >
            {isCareer ? 'Career' : 'Business'}
          </span>
        </button>
      </div>

      {/* Desktop: search + mode badge */}
      <div className="hidden md:flex items-center gap-4">
        <div
          className={`flex items-center text-gray-400 bg-gray-50 rounded-lg px-3 py-2 w-64 border border-gray-100 transition-all focus-within:bg-white focus-within:ring-2 focus-within:border-transparent ${
            isCareer
              ? 'focus-within:ring-[#818CF8]/30'
              : 'focus-within:ring-[#00c4cc]/30'
          }`}
        >
          <Search size={15} className="mr-2 shrink-0" />
          <input
            type="text"
            placeholder="児童名、メモを検索..."
            className="bg-transparent border-none outline-none text-sm w-full text-gray-700 placeholder:text-gray-400"
          />
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
            isCareer
              ? 'bg-[#818CF8]/10 text-[#818CF8]'
              : 'bg-[#00c4cc]/10 text-[#00c4cc]'
          }`}
        >
          {isCareer ? 'Career' : 'Business'}
        </span>
      </div>

      {/* Right side: user info, notifications, logout */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="text-sm font-medium text-gray-700 hidden md:block">
            {isCareer ? (
              <span>
                {user.lastName && user.firstName
                  ? `${user.lastName} ${user.firstName}`
                  : user.name || user.email}
              </span>
            ) : (
              <span>
                {user.lastName && user.firstName
                  ? `${user.lastName} ${user.firstName}`
                  : user.name || user.email}さん
              </span>
            )}
          </div>
        )}
        {!isCareer && user && (
          <button
            onClick={() => {
              const personalUrl = getPersonalBaseUrl();
              const targetUrl = personalUrl.endsWith('/')
                ? `${personalUrl}career`
                : `${personalUrl}/career`;
              window.location.href = targetUrl;
            }}
            className="text-sm text-gray-500 hover:text-[#818CF8] transition-colors flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[#818CF8]/5"
            title="キャリアダッシュボードへ"
          >
            <User size={16} />
            <span className="hidden md:inline text-xs">キャリア</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell size={18} className="text-gray-500" />
            {(unreadCount > 0 || pendingCount > 0) && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold px-1">
                {unreadCount + pendingCount}
              </span>
            )}
          </button>

          {/* 通知ポップアップ */}
          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50">
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-sm text-gray-900">通知</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-[#00c4cc] hover:underline flex items-center gap-1"
                  >
                    <Check size={12} />
                    すべて既読
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    通知はありません
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-[#00c4cc]/5' : ''
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                          !notification.isRead ? 'bg-[#00c4cc]' : 'bg-gray-300'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(notification.createdAt).toLocaleString('ja-JP', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 p-1.5 rounded-lg hover:bg-gray-100"
          title="ログアウト"
        >
          <LogOut size={16} />
          <span className="hidden md:inline text-xs">ログアウト</span>
        </button>
      </div>
    </header>
  );
};

export default Header;

