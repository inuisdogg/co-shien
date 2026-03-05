/**
 * ヘッダーコンポーネント
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Bell, Menu, LogOut, User, X, Check, Building2, ChevronDown } from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { getPersonalBaseUrl } from '@/utils/domain';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';
import { useToast } from '@/components/ui/Toast';

interface HeaderProps {
  onMenuClick?: () => void;
  onLogoClick?: () => void;
  mode?: 'business' | 'career';
}

const FACILITY_COLORS = ['#00c4cc', '#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'];

interface UserFacility {
  id: string;
  name: string;
  code: string;
  role: string;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogoClick, mode = 'business' }) => {
  const { requests } = useFacilityData();
  const { user, logout, facility, switchFacility } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  // 施設切替
  const [userFacilities, setUserFacilities] = useState<UserFacility[]>([]);
  const [isFacilityOpen, setIsFacilityOpen] = useState(false);
  const facilityMobileRef = useRef<HTMLDivElement>(null);
  const facilityDesktopRef = useRef<HTMLDivElement>(null);

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
        toast.error('通知の取得に失敗しました');
      }
    };

    fetchNotifications();
    // 30秒ごとに更新
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [facility?.id]);

  // 所属施設を取得（管理者・マネージャーのみ）
  useEffect(() => {
    if (!user?.id || mode === 'career') return;
    let cancelled = false;

    const fetchFacilities = async () => {
      try {
        const { data: employments, error } = await supabase
          .from('employment_records')
          .select(`
            role,
            facility_id,
            facilities (id, name, code)
          `)
          .eq('user_id', user.id)
          .is('end_date', null)
          .in('role', ['管理者', 'admin', 'マネージャー']);

        if (!error && employments && !cancelled) {
          const list = employments
            .filter((emp: any) => emp.facilities)
            .map((emp: any) => ({
              id: emp.facilities.id,
              name: emp.facilities.name,
              code: emp.facilities.code,
              role: emp.role,
            }));
          setUserFacilities(list);
        }
      } catch (err) {
        console.error('施設一覧取得エラー:', err);
        toast.error('施設一覧の取得に失敗しました');
      }
    };

    fetchFacilities();
    return () => { cancelled = true; };
  }, [user?.id, mode]);

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
      const inMobile = facilityMobileRef.current?.contains(event.target as Node);
      const inDesktop = facilityDesktopRef.current?.contains(event.target as Node);
      if (!inMobile && !inDesktop) {
        setIsFacilityOpen(false);
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
      toast.error('既読更新に失敗しました');
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
      toast.error('全既読更新に失敗しました');
    }
  };
  
  const isCareer = mode === 'career';
  const primaryColor = isCareer ? '#818CF8' : '#00c4cc';
  const primaryColorDark = isCareer ? '#6366F1' : '#00b0b8';

  const handleSwitchFacility = async (targetFacility: UserFacility) => {
    if (targetFacility.id === facility?.id) {
      setIsFacilityOpen(false);
      return;
    }
    try {
      await switchFacility(targetFacility.id);
    } catch (err) {
      console.error('施設切替エラー:', err);
      toast.error('施設の切り替えに失敗しました');
    }
  };

  const getFacilityColor = (facilityId: string) => {
    const idx = userFacilities.findIndex(f => f.id === facilityId);
    return FACILITY_COLORS[idx >= 0 ? idx % FACILITY_COLORS.length : 0];
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const showFacilitySwitcher = mode === 'business' && facility;

  return (
    <header className="bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4 md:px-6 z-40 shrink-0">
      {/* Mobile: hamburger + logo + facility */}
      <div className="flex items-center md:hidden">
        <button onClick={onMenuClick} className="text-gray-500 hover:text-gray-700 mr-3 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
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
                ? 'bg-personal/10 text-personal'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {isCareer ? 'Career' : 'Business'}
          </span>
        </button>
        {/* Mobile facility name */}
        {showFacilitySwitcher && (
          <div className="relative ml-2" ref={facilityMobileRef}>
            <button
              onClick={() => userFacilities.length > 1 && setIsFacilityOpen(!isFacilityOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-700 transition-colors ${
                userFacilities.length > 1 ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: getFacilityColor(facility.id) }}
              />
              <span className="truncate max-w-[100px]">{facility.name}</span>
              {userFacilities.length > 1 && <ChevronDown size={12} className="shrink-0 text-gray-400" />}
            </button>
            {isFacilityOpen && userFacilities.length > 1 && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">施設を切り替え</div>
                {userFacilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSwitchFacility(f)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 transition-colors ${
                      f.id === facility.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getFacilityColor(f.id) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{f.name}</div>
                      <div className="text-[10px] text-gray-400">{f.role}</div>
                    </div>
                    {f.id === facility.id && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop: search + mode badge + facility switcher */}
      <div className="hidden md:flex items-center gap-4">
        <div
          className={`flex items-center text-gray-400 bg-gray-50 rounded-lg px-3 py-2 w-64 border border-gray-100 transition-all focus-within:bg-white focus-within:ring-2 focus-within:border-transparent ${
            isCareer
              ? 'focus-within:ring-personal/30'
              : 'focus-within:ring-primary/30'
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
              ? 'bg-personal/10 text-personal'
              : 'bg-primary/10 text-primary'
          }`}
        >
          {isCareer ? 'Career' : 'Business'}
        </span>
        {/* Desktop facility switcher */}
        {showFacilitySwitcher && (
          <div className="relative" ref={facilityDesktopRef}>
            <button
              onClick={() => userFacilities.length > 1 && setIsFacilityOpen(!isFacilityOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition-colors ${
                userFacilities.length > 1 ? 'hover:bg-gray-50 hover:border-gray-300 cursor-pointer' : 'cursor-default'
              }`}
            >
              <Building2 size={14} className="text-gray-400 shrink-0" />
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: getFacilityColor(facility.id) }}
              />
              <span className="truncate max-w-[160px]">{facility.name}</span>
              {userFacilities.length > 1 && <ChevronDown size={14} className="shrink-0 text-gray-400" />}
            </button>
            {isFacilityOpen && userFacilities.length > 1 && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">施設を切り替え</div>
                {userFacilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSwitchFacility(f)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 transition-colors ${
                      f.id === facility.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getFacilityColor(f.id) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{f.name}</div>
                      <div className="text-[10px] text-gray-400">{f.role}</div>
                    </div>
                    {f.id === facility.id && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
            className="text-sm text-gray-500 hover:text-personal transition-colors flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-personal/5"
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
            className="relative cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
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
                    className="text-xs text-primary hover:underline flex items-center gap-1"
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
                        !notification.isRead ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                          !notification.isRead ? 'bg-primary' : 'bg-gray-300'
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
          className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-gray-100"
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

