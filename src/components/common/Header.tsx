/**
 * ヘッダーコンポーネント
 */

'use client';

import React from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { requests } = useFacilityData();
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
      <div className="flex items-center md:hidden">
        <button onClick={onMenuClick} className="text-gray-500 mr-4">
          <Menu size={24} />
        </button>
        <span className="font-bold text-xl text-[#00c4cc]">KidOS</span>
      </div>
      <div className="hidden md:flex items-center text-gray-400 bg-gray-100 rounded-md px-3 py-2 w-72 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-[#00c4cc]/20 focus-within:border-[#00c4cc]">
        <Search size={16} className="mr-2" />
        <input
          type="text"
          placeholder="児童名、メモを検索..."
          className="bg-transparent border-none outline-none text-sm w-full text-gray-700"
        />
      </div>
      <div className="flex items-center space-x-5">
        <div className="relative cursor-pointer group">
          <Bell size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </div>
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#00c4cc] to-[#00b0b8] text-white flex items-center justify-center font-bold text-sm shadow border-2 border-white cursor-pointer hover:shadow-md transition-shadow">
          T
        </div>
      </div>
    </header>
  );
};

export default Header;

