/**
 * サイドバーコンポーネント
 * アコーディオン形式のメニューでUXを改善
 * フェーズ管理対応: NEXT_PUBLIC_FEATURE_PHASE 環境変数で表示メニューを制御
 */

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Zap,
  Library,
  Calculator,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import { supabase } from '@/lib/supabase';

// フェーズ定義
// Phase 1 (P0-P1): 実務必須機能 - 施設情報、スタッフ管理、シフト管理、児童管理、利用予約、業務日誌、ダッシュボード、個別支援計画、書類管理
// Phase 2 (P2): 請求・監査・経営 - 運営指導準備、経営設定、研修記録、委員会管理、損益計算書、キャッシュフロー、経費管理、苦情・事故報告
// Phase 3 (P3): 外部連携・SaaS化 - 送迎ルート、チャット、コネクト、利用者招待、リード管理
type FeaturePhase = 1 | 2 | 3;

// 各メニュー項目のフェーズ設定
const MENU_PHASE_CONFIG: Record<string, FeaturePhase> = {
  // Phase 1: 実務必須
  'schedule': 1,      // 利用予約
  'children': 1,      // 児童管理
  'daily-log': 1,     // 業務日誌
  'support-plan': 1,  // 個別支援計画
  'staff': 1,         // スタッフ管理
  'shift': 1,         // シフト管理
  'dashboard': 1,     // ダッシュボード
  'facility': 1,      // 施設情報
  'documents': 1,     // 書類管理
  'addition-settings': 1, // 加算体制設定
  'knowledge': 1,     // ナレッジベース
  'addition-simulation': 1, // 加算シミュレーション

  // Phase 2: 請求・監査・経営
  'audit-preparation': 2, // 運営指導準備
  'management': 2,        // 経営設定
  'addition-catalog': 1,  // 加算一覧（Phase 1で表示）
  'training': 2,          // 研修記録
  'committee': 2,         // 委員会管理
  'profit-loss': 2,       // 損益計算書
  'cash-flow': 2,         // キャッシュフロー
  'expense-management': 2, // 経費管理
  'incident': 2,          // 苦情・事故報告

  // Phase 3: 外部連携・SaaS化
  'transport': 1,         // 送迎ルート（Phase 1で表示）
  'chat': 3,              // チャット
  'connect': 3,           // コネクト
  'client-invitation': 3, // 利用者招待
  'lead': 3,              // リード管理
  'government': 2,        // 行政連携
};

// 現在のフェーズを取得
const getCurrentPhase = (): FeaturePhase => {
  const phase = parseInt(process.env.NEXT_PUBLIC_FEATURE_PHASE || '1', 10);
  if (phase >= 1 && phase <= 3) return phase as FeaturePhase;
  return 1;
};

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  mode?: 'business' | 'career';
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = false, onClose, mode = 'business' }) => {
  const { facility } = useAuth();
  const { facilitySettings } = useFacilityData();
  const [currentFacilityCode, setCurrentFacilityCode] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { isAdmin, isFacilityAdmin, isMaster, hasPermission } = useAuth();
  // 施設管理者としてのフルアクセス権限
  const hasFullAccess = isAdmin || isFacilityAdmin || isMaster;
  const isCareer = mode === 'career';
  const primaryColor = isCareer ? '#818CF8' : '#00c4cc';
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      category: '保護者',
      icon: Users,
      items: [
        { id: 'schedule', label: '利用予約', icon: CalendarDays, permission: 'schedule' as const },
        { id: 'children', label: '児童管理', icon: Users, permission: 'children' as const },
        { id: 'chat', label: 'チャット', icon: MessageSquare, permission: 'chat' as const },
        { id: 'connect', label: 'コネクト', icon: Link2, permission: 'connect' as const },
        { id: 'client-invitation', label: '保護者招待', icon: UserPlus, permission: 'clientInvitation' as const },
        { id: 'lead', label: 'リード管理', icon: Target, permission: 'lead' as const },
      ],
    },
    {
      category: '記録',
      icon: BookOpen,
      items: [
        { id: 'daily-log', label: '実績と連絡帳', icon: BookOpen, permission: 'dailyLog' as const },
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
        { id: 'knowledge', label: 'ナレッジ', icon: Library, permission: 'staff' as const },
      ],
    },
    {
      category: '運営',
      icon: ClipboardCheck,
      items: [
        { id: 'transport', label: '送迎ルート', icon: Truck, permission: 'transport' as const },
        { id: 'audit-preparation', label: '運営指導準備', icon: ClipboardCheck, permission: 'auditPreparation' as const },
        { id: 'committee', label: '委員会管理', icon: UsersRound, permission: 'committee' as const },
        { id: 'documents', label: '書類管理', icon: FileText, permission: 'documents' as const },
        { id: 'government', label: '行政連携', icon: Building2, permission: 'dashboard' as const },
      ],
    },
    {
      category: '経営',
      icon: BarChart3,
      items: [
        { id: 'dashboard', label: 'ダッシュボード', icon: BarChart3, permission: 'dashboard' as const },
        { id: 'addition-simulation', label: '加算シミュレーション', icon: Calculator, permission: 'dashboard' as const },
        { id: 'addition-catalog', label: '加算一覧', icon: Zap, permission: 'dashboard' as const },
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
        { id: 'addition-settings', label: '加算体制設定', icon: Zap, permission: 'facility' as const },
      ],
    },
  ];

  // 現在のフェーズを取得
  const currentPhase = getCurrentPhase();

  // 権限とフェーズに基づいてメニューをフィルタリング
  const filteredCategories = useMemo(() => menuCategories.map((category) => ({
    ...category,
    items: category.items.filter((item) => {
      // フェーズによるフィルタリング
      const menuPhase = MENU_PHASE_CONFIG[item.id] || 1;
      if (menuPhase > currentPhase) return false;

      // 権限によるフィルタリング
      // グローバル管理者、施設管理者、マスターは全メニューにアクセス可能
      if (hasFullAccess) return true;
      return hasPermission(item.permission);
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })).filter((category) => category.items.length > 0), [hasFullAccess, currentPhase]);

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
        // 展開時に少し遅延してスクロール（アニメーション後に実行）
        setTimeout(() => {
          const element = categoryRefs.current[category];
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
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
            // 管理者・施設管理者はdashboard、それ以外はscheduleをホームに
            const homeTab = hasFullAccess ? 'dashboard' : 'schedule';
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
            <div
              key={category.category}
              ref={(el) => { categoryRefs.current[category.category] = el; }}
              className={categoryIndex > 0 ? 'mt-1' : ''}
            >
              {/* カテゴリヘッダー（クリックで展開/折りたたみ） */}
              <button
                onClick={() => toggleCategory(category.category)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  hasActiveItem
                    ? `${isCareer ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'}`
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
                          ? `${isCareer ? 'bg-[#818CF8]' : 'bg-[#00c4cc]'} text-white font-bold shadow-sm`
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

