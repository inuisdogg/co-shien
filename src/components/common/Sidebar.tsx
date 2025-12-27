/**
 * サイドバーコンポーネント
 */

'use client';

import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Briefcase,
  PieChart,
  Settings,
  Target,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, facility } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'ホーム', icon: LayoutDashboard },
    { id: 'lead', label: 'リード管理', icon: Target },
    { id: 'schedule', label: '利用調整・予約', icon: CalendarDays },
    { id: 'children', label: '児童管理', icon: Users },
    { id: 'staff', label: '勤怠・シフト', icon: Briefcase },
    { id: 'finance', label: '収支管理', icon: PieChart },
    { id: 'facility', label: '施設情報', icon: Settings },
  ];

  return (
    <div className="w-64 bg-[#232b37] text-white flex flex-col h-full hidden md:flex shrink-0">
      <div className="p-6 flex items-center space-x-3">
        <img src="/logo-white.svg" alt="co-shien" className="h-8" />
      </div>

      <div className="px-3 py-4">
        <div className="text-[11px] text-gray-400 font-bold mb-3 px-3">MAIN MENU</div>
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium ${
                activeTab === item.id
                  ? 'bg-[#00c4cc] text-white shadow-md'
                  : 'text-gray-300 hover:bg-[#2d3748] hover:text-white'
              }`}
            >
              <item.icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-gray-700">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold">
            {user?.name[0] || '管'}
          </div>
          <div className="text-xs text-gray-300">
            <div className="font-bold text-white">{user?.name || '管理者'}</div>
            <div>{facility?.name || '施設名'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

