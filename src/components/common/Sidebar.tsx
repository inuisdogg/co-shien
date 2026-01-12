/**
 * サイドバーコンポーネント
 */

'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  CalendarDays,
  Users,
  Briefcase,
  Settings,
  Target,
  Building2,
  BarChart3,
  DollarSign,
  CalendarCheck,
  UserPlus,
  MessageSquare,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  FileText,
  AlertTriangle,
  GraduationCap,
  UsersRound,
  Receipt,
  Wallet,
  TrendingUp,
  Link2,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  mode?: 'biz' | 'personal';
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = false, onClose, mode = 'biz' }) => {
  const { facility } = useAuth();
  const { facilitySettings } = useFacilityData();
  const [currentFacilityCode, setCurrentFacilityCode] = useState<string>('');

  const { isAdmin, hasPermission } = useAuth();
  const isPersonal = mode === 'personal';
  const primaryColor = isPersonal ? '#8b5cf6' : '#00c4cc';

  // 最新の施設コードを取得
  useEffect(() => {
    const fetchFacilityCode = async () => {
      if (facility?.id) {
        const { data, error } = await supabase
          .from('facilities')
          .select('code')
          .eq('id', facility.id)
          .single();
        
        if (!error && data) {
          setCurrentFacilityCode(data.code || '');
        }
      }
    };
    
    fetchFacilityCode();
    // 定期的に更新（30秒ごと）
    const interval = setInterval(fetchFacilityCode, 30000);
    return () => clearInterval(interval);
  }, [facility?.id]);
  
  // メニューを用途ごとに定義
  const menuCategories = [
    {
      category: '利用者管理',
      items: [
        { id: 'schedule', label: '利用調整・予約', icon: CalendarDays, permission: 'schedule' as const },
        { id: 'children', label: '児童管理', icon: Users, permission: 'children' as const },
        { id: 'transport', label: '送迎ルート', icon: Truck, permission: 'schedule' as const },
        { id: 'chat', label: 'チャット', icon: MessageSquare, permission: 'children' as const },
        { id: 'connect', label: 'コネクト', icon: Link2, permission: 'children' as const },
        { id: 'client-invitation', label: '利用者招待', icon: UserPlus, permission: 'children' as const },
        { id: 'lead', label: 'リード管理', icon: Target, permission: 'lead' as const },
      ],
    },
    {
      category: '日誌・記録',
      items: [
        { id: 'daily-log', label: '業務日誌', icon: BookOpen, permission: 'children' as const },
        { id: 'support-plan', label: '個別支援計画', icon: ClipboardList, permission: 'children' as const },
        { id: 'incident', label: '苦情・事故報告', icon: AlertTriangle, permission: 'children' as const },
      ],
    },
    {
      category: 'スタッフ管理',
      items: [
        { id: 'staff', label: 'スタッフ管理', icon: Users, permission: 'staff' as const },
        { id: 'shift', label: 'シフト管理', icon: CalendarCheck, permission: 'staff' as const },
        { id: 'training', label: '研修記録', icon: GraduationCap, permission: 'staff' as const },
      ],
    },
    {
      category: '運営管理',
      items: [
        { id: 'audit-preparation', label: '運営指導準備', icon: ClipboardCheck, permission: 'facility' as const },
        { id: 'committee', label: '委員会管理', icon: UsersRound, permission: 'facility' as const },
        { id: 'documents', label: '書類管理', icon: FileText, permission: 'facility' as const },
      ],
    },
    {
      category: '売上・経営管理',
      items: [
        { id: 'dashboard', label: 'ダッシュボード', icon: BarChart3, permission: 'dashboard' as const },
        { id: 'profit-loss', label: '損益計算書', icon: TrendingUp, permission: 'dashboard' as const },
        { id: 'cash-flow', label: 'キャッシュフロー', icon: Wallet, permission: 'dashboard' as const },
        { id: 'expense-management', label: '経費管理', icon: Receipt, permission: 'dashboard' as const },
        { id: 'management', label: '経営設定', icon: DollarSign, permission: 'management' as const },
      ],
    },
    {
      category: '設定',
      items: [
        { id: 'facility', label: '施設情報', icon: Settings, permission: 'facility' as const },
      ],
    },
  ];

  // 権限に基づいてメニューをフィルタリング
  const filteredCategories = menuCategories.map((category) => ({
    ...category,
    items: category.items.filter((item) => {
      if (isAdmin) return true; // 管理者は全メニューにアクセス可能
      return hasPermission(item.permission);
    }),
  })).filter((category) => category.items.length > 0); // 空のカテゴリを除外

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
        <button
          onClick={() => {
            // 管理者はdashboard、それ以外はscheduleをホームに
            const homeTab = isAdmin ? 'dashboard' : 'schedule';
            setActiveTab(homeTab);
            onClose?.();
          }}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Image src="/logo-cropped-center.png" alt="co-shien" width={150} height={48} className="h-12 w-auto object-contain" priority />
        </button>
      </div>

      <div className="px-3 py-4 flex-1 overflow-y-auto">
        {filteredCategories.map((category, categoryIndex) => (
          <div key={category.category} className={categoryIndex > 0 ? 'mt-6' : ''}>
            <div className="text-[11px] text-gray-500 font-bold mb-3 px-3 uppercase tracking-wider">
              {category.category}
            </div>
            <nav className="space-y-1">
              {category.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose?.();
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium ${
                    activeTab === item.id
                      ? `${isPersonal ? 'bg-[#8b5cf6]' : 'bg-[#00c4cc]'} text-white shadow-md`
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon size={18} strokeWidth={2} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-auto p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2 px-2">
          <Building2 size={16} className="text-gray-400" />
          <div className="flex-1">
            <div className="text-[10px] text-gray-400 font-semibold mb-0.5 uppercase tracking-wider">施設</div>
            <div className="text-sm font-bold text-gray-800">{facilitySettings?.facilityName || '施設名'}</div>
            {(currentFacilityCode || facility?.code) && (
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {currentFacilityCode || facility?.code}</div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;

