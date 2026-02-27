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
  Building2,
  BarChart3,
  CalendarCheck,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Shield,
  ListChecks,
  AlertTriangle,
  DollarSign,
  GraduationCap,
  CalendarMinus,
  Award,
  Users2,
  Car,
  Calculator,
  Briefcase,
  Wallet,
  MessageCircle,
  ClipboardCheck,
  Receipt,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useSetupGuide } from '@/contexts/SetupGuideContext';
import { useChangeNotifications } from '@/hooks/useChangeNotifications';
import { supabase } from '@/lib/supabase';

// フェーズ定義
// Phase 1 (P0-P1): 実務必須機能 - 施設情報、スタッフ管理、シフト管理、児童管理、利用予約、業務日誌、ダッシュボード、個別支援計画、書類管理
// Phase 2 (P2): 請求・監査・経営 - 運営指導準備、経営設定、研修記録、委員会管理、損益計算書、キャッシュフロー、経費管理、苦情・事故報告
// Phase 3 (P3): 外部連携・SaaS化 - 送迎ルート、チャット、コネクト、利用者招待、リード管理
type FeaturePhase = 1 | 2 | 3;

// 各メニュー項目のフェーズ設定
const MENU_PHASE_CONFIG: Record<string, FeaturePhase> = {
  // Phase 1: 実務必須
  'schedule': 1,        // 利用予約
  'children': 1,        // 児童管理
  'daily-log': 1,       // 業務日誌
  'support-plan': 1,    // 個別支援計画
  'staff-master': 1,    // スタッフ管理
  'shift': 1,           // シフト管理
  'staffing': 1,        // 勤務・配置（人員配置＋勤務体制一覧を統合）
  'leave-approval': 1,  // 休暇管理
  'talent-management': 1, // タレントマネジメント
  'dashboard': 1,       // ダッシュボード
  'addition-settings': 1, // 加算・収益（加算体制設定＋シミュレーターを統合）
  'finance': 1,         // 財務管理
  'training': 1,        // 研修・委員会（研修記録＋委員会を統合）
  'incident': 1,        // 事故・苦情報告
  'documents': 1,       // 書類・監査（書類管理＋監査エクスポート＋サービス提供記録を統合）
  'regulations': 1,     // 規定管理
  'compliance': 1,      // コンプライアンス
  'facility': 1,        // 施設情報
  'connect': 1,          // 連絡会議
  'transport': 1,         // 送迎管理
  'upper-limit': 1,      // 上限管理
  'recruitment': 1,       // 採用・求人
  'cashflow': 1,           // 収支管理
  'self-evaluation': 1,    // 自己評価
  'billing': 1,             // 国保連請求

  // Phase 2: 請求・監査・経営
  'audit-preparation': 2, // 運営指導準備
  'management': 2,        // 経営設定
  'government': 2,        // 行政連携

  // Phase 3: 外部連携・SaaS化
  'chat': 1,              // チャット
  'lead': 3,              // リード管理
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
  useSetupGuide(); // keep provider active for setup guide banner on dashboard
  const { pendingCount: changeNotificationCount } = useChangeNotifications();
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

  // メニュー定義
  const menuCategories = [
    {
      category: '利用管理',
      icon: Users,
      items: [
        { id: 'schedule', label: '利用予約', icon: CalendarDays, permission: 'schedule' as const },
        { id: 'children', label: '児童管理', icon: Users, permission: 'children' as const },
        { id: 'daily-log', label: '実績と連絡帳', icon: BookOpen, permission: 'dailyLog' as const },
        { id: 'support-plan', label: '個別支援計画', icon: FileText, permission: 'children' as const },
        { id: 'connect', label: '連絡会議', icon: Users2, permission: 'children' as const },
        { id: 'transport', label: '送迎管理', icon: Car, permission: 'schedule' as const },
        { id: 'upper-limit', label: '上限管理', icon: Calculator, permission: 'dashboard' as const },
        { id: 'chat', label: 'チャット', icon: MessageCircle, permission: 'dashboard' as const },
      ],
    },
    {
      category: 'スタッフ',
      icon: CalendarCheck,
      items: [
        { id: 'staff-master', label: 'スタッフ管理', icon: Users, permission: 'staff' as const },
        { id: 'shift', label: 'シフト管理', icon: CalendarCheck, permission: 'shift' as const },
        { id: 'staffing', label: '勤務・配置', icon: Shield, permission: 'staff' as const },
        { id: 'leave-approval', label: '休暇管理', icon: CalendarMinus, permission: 'staff' as const },
        { id: 'talent-management', label: 'タレントマネジメント', icon: Award, permission: 'staff' as const },
      ],
    },
    {
      category: '採用',
      icon: Briefcase,
      items: [
        { id: 'recruitment', label: '採用・求人', icon: Briefcase, permission: 'recruitment' as const },
      ],
    },
    {
      category: '経営',
      icon: BarChart3,
      items: [
        { id: 'dashboard', label: 'ダッシュボード', icon: BarChart3, permission: 'dashboard' as const },
        { id: 'addition-settings', label: '加算・収益', icon: ListChecks, permission: 'dashboard' as const },
        { id: 'finance', label: '財務管理', icon: DollarSign, permission: 'dashboard' as const },
        { id: 'cashflow', label: '収支管理', icon: Wallet, permission: 'cashFlow' as const },
        { id: 'billing', label: '国保連請求', icon: Receipt, permission: 'dashboard' as const },
      ],
    },
    {
      category: '記録・コンプライアンス',
      icon: Shield,
      items: [
        { id: 'training', label: '研修・委員会', icon: GraduationCap, permission: 'staff' as const },
        { id: 'incident', label: '事故・苦情報告', icon: AlertTriangle, permission: 'dashboard' as const },
        { id: 'documents', label: '書類・監査', icon: FolderOpen, permission: 'children' as const },
        { id: 'regulations', label: '規定管理', icon: BookOpen, permission: 'staff' as const },
        { id: 'compliance', label: 'コンプライアンス', icon: Shield, permission: 'dashboard' as const },
        { id: 'self-evaluation', label: '自己評価', icon: ClipboardCheck, permission: 'dashboard' as const },
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      {/* サイドバー */}
      <div
        className={`fixed md:relative top-0 left-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-50 shrink-0 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:flex`}
      >
      <div className="p-5 flex items-center">
        <button
          onClick={() => {
            // 管理者・施設管理者はdashboard、それ以外はscheduleをホームに
            const homeTab = hasFullAccess ? 'dashboard' : 'schedule';
            setActiveTab(homeTab);
            onClose?.();
          }}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Image src="/logo.svg" alt="Roots" width={150} height={48} className="h-10 w-auto object-contain" priority />
        </button>
      </div>

      <div className="px-3 py-2 flex-1 overflow-y-auto">
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  hasActiveItem
                    ? `${isCareer ? 'bg-purple-50 text-purple-700' : 'bg-[#00c4cc]/5 text-[#00c4cc]'}`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon size={16} strokeWidth={2} className="w-5 h-5" />
                  <span className="text-[13px] font-bold">{category.category}</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>

              {/* サブメニュー（展開時のみ表示） */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <nav className="pl-2 pt-1 space-y-0.5" role="navigation" aria-label="メインメニュー">
                  {category.items.map((item) => {
                    const isActive = activeTab === item.id;

                    return (
                      <div key={item.id} className="relative" data-tour={`menu-${item.id}`}>
                        <button
                          onClick={() => {
                            setActiveTab(item.id);
                            onClose?.();
                          }}
                          role="menuitem"
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-[13px] ${
                            isActive
                              ? `${isCareer ? 'bg-[#818CF8]/10 text-[#818CF8] border-l-[3px] border-[#818CF8]' : 'bg-[#00c4cc]/10 text-[#00c4cc] border-l-[3px] border-[#00c4cc]'} font-bold`
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                          }`}
                        >
                          <item.icon size={16} strokeWidth={2} className="w-5 h-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {item.id === 'facility' && changeNotificationCount > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-[9px] font-bold text-white bg-red-500 rounded-full shrink-0">
                              {changeNotificationCount}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </nav>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-800 truncate">{facilitySettings?.facilityName || '施設名'}</div>
            {(currentFacilityCode || facility?.code) && (
              <div className="text-[10px] text-gray-500 font-mono">ID: {currentFacilityCode || facility?.code}</div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;

