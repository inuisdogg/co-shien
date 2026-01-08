/**
 * ヘッダーコンポーネント
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Bell, Menu, LogOut, User } from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { getPersonalBaseUrl } from '@/utils/domain';

interface HeaderProps {
  onMenuClick?: () => void;
  onLogoClick?: () => void;
  mode?: 'biz' | 'personal';
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogoClick, mode = 'biz' }) => {
  const { requests } = useFacilityData();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  
  const isPersonal = mode === 'personal';
  const primaryColor = isPersonal ? '#8b5cf6' : '#00c4cc';
  const primaryColorDark = isPersonal ? '#7c3aed' : '#00b0b8';

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
          <Image src="/logo-cropped-center.png" alt="co-shien" width={150} height={40} className="h-10 w-auto object-contain" priority />
          <span 
            className={`text-xs font-bold px-2 py-1 rounded ${
              isPersonal 
                ? 'bg-[#8b5cf6] text-white' 
                : 'bg-[#00c4cc] text-white'
            }`}
          >
            {isPersonal ? 'Personal' : 'Biz'}
          </span>
        </button>
      </div>
      <div className="hidden md:flex items-center gap-4">
        <div 
          className={`flex items-center text-gray-400 bg-gray-100 rounded-md px-3 py-2 w-72 transition-colors focus-within:bg-white focus-within:ring-2 ${
            isPersonal 
              ? 'focus-within:ring-[#8b5cf6]/20 focus-within:border-[#8b5cf6]' 
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
          <Image src="/logo-cropped-center.png" alt="co-shien" width={120} height={32} className="h-8 w-auto object-contain" priority />
          <span 
            className={`text-xs font-bold px-2 py-1 rounded ${
              isPersonal 
                ? 'bg-[#8b5cf6] text-white' 
                : 'bg-[#00c4cc] text-white'
            }`}
          >
            {isPersonal ? 'Personal' : 'Biz'}
          </span>
        </div>
      </div>
      <div className="flex items-center space-x-5">
        {user && (
          <div className="text-sm font-medium text-gray-700 hidden md:block">
            {isPersonal ? (
              // パーソナルモード：個人名を表示
              <span>
                {user.lastName && user.firstName 
                  ? `${user.lastName} ${user.firstName}` 
                  : user.name || user.email}
              </span>
            ) : (
              // Bizモード：施設のスタッフ名を表示
              <span>
                {user.lastName && user.firstName 
                  ? `${user.lastName} ${user.firstName}` 
                  : user.name || user.email}さん
              </span>
            )}
          </div>
        )}
        {!isPersonal && user && (
          <button
            onClick={() => {
              // パーソナルダッシュボードに遷移（localStorageの情報は保持される）
              const personalUrl = getPersonalBaseUrl();
              // パーソナルダッシュボードのパスを追加
              const targetUrl = personalUrl.endsWith('/') 
                ? `${personalUrl}staff-dashboard` 
                : `${personalUrl}/staff-dashboard`;
              window.location.href = targetUrl;
            }}
            className="text-sm text-gray-600 hover:text-[#8b5cf6] transition-colors flex items-center space-x-1 px-2 py-1 rounded hover:bg-[#8b5cf6]/10"
            title="パーソナルダッシュボードへ"
          >
            <User size={18} />
            <span className="hidden md:inline">パーソナル</span>
          </button>
        )}
        <div className="relative cursor-pointer group">
          <Bell size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
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

