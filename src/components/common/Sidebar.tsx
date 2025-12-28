/**
 * サイドバーコンポーネント
 */

'use client';

import React from 'react';
import {
  CalendarDays,
  Users,
  Briefcase,
  Settings,
  Target,
  Building2,
  BarChart3,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = false, onClose }) => {
  const { facility } = useAuth();
  const { facilitySettings } = useFacilityData();

  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: BarChart3 },
    { id: 'management', label: '経営設定', icon: DollarSign },
    { id: 'lead', label: 'リード管理', icon: Target },
    { id: 'schedule', label: '利用調整・予約', icon: CalendarDays },
    { id: 'children', label: '児童管理', icon: Users },
    { id: 'staff', label: '勤怠・シフト', icon: Briefcase },
    { id: 'facility', label: '施設情報', icon: Settings },
  ];

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      {/* サイドバー */}
      <div
        className={`fixed md:relative top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-50 shrink-0 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:flex`}
      >
      <div className="p-6 flex items-center space-x-3">
        <img src="/logo-cropped-center.png" alt="co-shien" className="h-12 w-auto object-contain" />
      </div>

      <div className="px-3 py-4">
        <div className="text-[11px] text-gray-500 font-bold mb-3 px-3">MAIN MENU</div>
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose?.();
              }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium ${
                activeTab === item.id
                  ? 'bg-[#00c4cc] text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2 px-2">
          <Building2 size={16} className="text-gray-400" />
          <div className="flex-1">
            <div className="text-[10px] text-gray-400 font-semibold mb-0.5 uppercase tracking-wider">施設</div>
            <div className="text-sm font-bold text-gray-800">{facilitySettings?.facilityName || '施設名'}</div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;

