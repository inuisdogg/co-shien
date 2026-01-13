/**
 * サイドバーコンポーネント
 * アコーディオン形式のメニューでUXを改善
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  CalendarDays,
  Users,
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
  ChevronDown,
  ChevronRight,
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { isAdmin, isMaster, hasPermission } = useAuth();
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

  // メニューを用途ごとに定義（整理・統合済み）
  const menuCategories = [
    {
      category: '利用者',
      icon: Users,
      items: [
        { id: 'schedule', label: '利用予約', icon: CalendarDays, permission: 'schedule' as const },
        { id: 'children', label: '児童管理', icon: Users, permission: 'children' as const },
        { id: 'transport', label: '送迎ルート', icon: Truck, permission: 'transport' as const },
        { id: 'chat', label: 'チャット', icon: MessageSquare, permission: 'chat' as const },
        { id: 'connect', label: 'コネクト', icon: Link2, permission: 'connect' as const },
        { id: 'client-invitation', label: '利用者招待', icon: UserPlus, permission: 'clientInvitation' as const },
        { id: 'lead', label: 'リード管理', icon: Target, permission: 'lead' as const },
      ],
    },
    {
      category: '記録',
      icon: BookOpen,
      items: [
        { id: 'daily-log', label: '業務日誌', icon: BookOpen, permission: 'dailyLog' as const },
        { id: 'support-plan', label: '個別支援計画', icon: ClipboardList, permission: 'supportPlan' as const },
        { id: 'incident', label: '苦情・事故報告', icon: AlertTriangle, permission: 'incident' as const },
      ],
    },
    {
      category: 'スタッフ',
      icon: CalendarCheck,
      items: [
        { id: 'staff', label: 'スタッフ管理', icon: Users, permission: 'staff' as const },
        { id: 'shift', label: 'シフト管理', icon: CalendarCheck, permission: 'shift' as const },
        { id: 'training', label: '研修記録', icon: GraduationCap, permission: 'training' as const },
      ],
    },
    {
      category: '運営',
      icon: ClipboardCheck,
      items: [
        { id: 'audit-preparation', label: '運営指導準備', icon: ClipboardCheck, permission: 'auditPreparation' as const },
        { id: 'committee', label: '委員会管理', icon: UsersRound, permission: 'committee' as const },
        { id: 'documents', label: '書類管理', icon: FileText, permission: 'documents' as const },
      ],
    },
    {
      category: '経営',
      icon: BarChart3,
      items: [
        { id: 'dashboard', label: 'ダッシュボード', icon: BarChart3, permission: 'dashboard' as const },
        { id: 'profit-loss', label: '損益計算書', icon: TrendingUp, permission: 'profitLoss' as const },
        { id: 'cash-flow', label: 'キャッシュフロー', icon: Wallet, permission: 'cashFlow' as const },
        { id: 'expense-management', label: '経費管理', icon: Receipt, permission: 'expenseManagement' as const },
        { id: 'management', label: '経営設定', icon: DollarSign, permission: 'management' as const },
      ],
    },
    {
      category: '設定',
      icon: Settings,
      items: [
        { id: 'facility', label: '施設情報', icon: Settings, permission: 'facility' as const },
      ],
    },
  ];

  // 権限に基づいてメニューをフィルタリング
  const filteredCategories = useMemo(() => menuCategories.map((category) => ({
    ...category,
    items: category.items.filter((item) => {
      if (isAdmin) return true; // 管理者は全メニューにアクセス可能
      return hasPermission(item.permission);
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })).filter((category) => category.items.length > 0), [isAdmin]);

  // アクティブなタブが含まれるカテゴリを自動展開
  useEffect(() => {
    const activeCategory = filteredCategories.find(cat =>
      cat.items.some(item => item.id === activeTab)
    );
    if (activeCategory) {
      setExpandedCategories(prev => new Set(prev).add(activeCategory.category));
    }
  }, [activeTab, filteredCategories]);

  // カテゴリの展開/折りたたみ切り替え
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

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

      <div className="px-2 py-3 flex-1 overflow-y-auto">
        {filteredCategories.map((category, categoryIndex) => {
          const isExpanded = expandedCategories.has(category.category);
          const hasActiveItem = category.items.some(item => item.id === activeTab);
          const CategoryIcon = category.icon;

          return (
            <div key={category.category} className={categoryIndex > 0 ? 'mt-1' : ''}>
              {/* カテゴリヘッダー（クリックで展開/折りたたみ） */}
              <button
                onClick={() => toggleCategory(category.category)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  hasActiveItem
                    ? `${isPersonal ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'}`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon size={16} strokeWidth={2} />
                  <span className="text-[13px] font-bold">{category.category}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={14} className="text-gray-400" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400" />
                )}
              </button>

              {/* サブメニュー（展開時のみ表示） */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <nav className="pl-3 pt-1 space-y-0.5">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        onClose?.();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-[13px] ${
                        activeTab === item.id
                          ? `${isPersonal ? 'bg-[#8b5cf6]' : 'bg-[#00c4cc]'} text-white font-bold shadow-sm`
                          : 'text-gray-600 hover:bg-gray-100 font-medium'
                      }`}
                    >
                      <item.icon size={15} strokeWidth={2} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          );
        })}
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

