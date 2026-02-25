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
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
      <div className="flex items-center md:hidden">
        <button onClick={onMenuClick} className="text-gray-500 mr-4">
          <Menu size={24} />
        </button>
        <button
          onClick={onLogoClick}
          className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          <Image src="/logo.svg" alt="Roots" width={150} height={40} className="h-10 w-auto object-contain" priority />
          <span
            className={`text-xs font-bold px-2 py-1 rounded ${
              isCareer
                ? 'bg-[#818CF8] text-white'
                : 'bg-[#00c4cc] text-white'
            }`}
          >
            {isCareer ? 'キャリア' : 'ビジネス'}
          </span>
        </button>
      </div>
      <div className="hidden md:flex items-center gap-4">
        <div
          className={`flex items-center text-gray-400 bg-gray-100 rounded-md px-3 py-2 w-72 transition-colors focus-within:bg-white focus-within:ring-2 ${
            isCareer
              ? 'focus-within:ring-[#818CF8]/20 focus-within:border-[#818CF8]'
              : 'focus-within:ring-[#00c4cc]/20 focus-within:border-[#00c4cc]'
          }`}
        >
          <Search size={16} className="mr-2" />
          <input
            type="text"
            placeholder="児童名、メモを検索..."
            className="bg-transparent border-none outline-none text-sm w-full text-gray-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Roots" width={120} height={32} className="h-8 w-auto object-contain" priority />
          <span
            className={`text-xs font-bold px-2 py-1 rounded ${
              isCareer
                ? 'bg-[#818CF8] text-white'
                : 'bg-[#00c4cc] text-white'
            }`}
          >
            {isCareer ? 'キャリア' : 'ビジネス'}
          </span>
        </div>
      </div>
      <div className="flex items-center space-x-5">
        {user && (
          <div className="text-sm font-medium text-gray-700 hidden md:block">
            {isCareer ? (
              // キャリアモード：個人名を表示
              <span>
                {user.lastName && user.firstName
                  ? `${user.lastName} ${user.firstName}`
                  : user.name || user.email}
              </span>
            ) : (
              // ビジネスモード：施設のスタッフ名を表示
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
              // キャリア画面に遷移（localStorageの情報は保持される）
              const personalUrl = getPersonalBaseUrl();
              // キャリア画面のパスを追加
              const targetUrl = personalUrl.endsWith('/')
                ? `${personalUrl}career`
                : `${personalUrl}/career`;
              window.location.href = targetUrl;
            }}
            className="text-sm text-gray-600 hover:text-[#818CF8] transition-colors flex items-center space-x-1 px-2 py-1 rounded hover:bg-[#818CF8]/10"
            title="キャリアダッシュボードへ"
          >
            <User size={18} />
            <span className="hidden md:inline">キャリア</span>
          </button>
        )}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative cursor-pointer group p-1"
          >
            <Bell size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
            {(unreadCount > 0 || pendingCount > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                {unreadCount + pendingCount}
              </span>
            )}
          </button>

          {/* 通知ポップアップ */}
          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-sm text-gray-800">通知</h3>
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
                  <div className="p-6 text-center text-gray-500 text-sm">
                    通知はありません
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        !notification.isRead ? 'bg-blue-50' : ''
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
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-gray-600 transition-colors flex items-center space-x-1"
          title="ログアウト"
        >
          <LogOut size={18} />
          <span className="hidden md:inline text-sm">ログアウト</span>
        </button>
      </div>
    </header>
  );
};

export default Header;

