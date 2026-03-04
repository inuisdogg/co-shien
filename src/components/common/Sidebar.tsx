/**
 * サイドバーコンポーネント
 * アコーディオン形式のメニューでUXを改善
 * フェーズ管理対応: NEXT_PUBLIC_FEATURE_PHASE 環境変数で表示メニューを制御
 *
 * 改善点:
 * - デフォルトでカテゴリを折りたたみ（アクティブカテゴリのみ展開）
 * - クイック検索/フィルターボックス
 * - ホバー時のツールチップ説明文
 * - カテゴリの通知バッジ集計
 */

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Send,
  FileOutput,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserPermissions } from '@/types';
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
  'contract-report': 1,    // 契約内容報告書
  'staff-documents': 1,     // 書類配布
  'announcements': 1,       // お知らせ

  // Phase 2: 請求・監査・経営
  'audit-preparation': 2, // 運営指導準備
  'management': 2,        // 経営設定
  'government': 2,        // 行政連携

  // Phase 3: 外部連携・SaaS化
  'chat': 1,              // チャット
  'lead': 3,              // リード管理
};

// メニュー項目のホバー説明文（日本語）
const MENU_DESCRIPTIONS: Record<string, string> = {
  'schedule': '利用児童の予約カレンダー管理',
  'children': '児童の基本情報・受給者証管理',
  'daily-log': '日々の実績記録と連絡帳',
  'support-plan': '個別支援計画の作成・管理',
  'connect': '関係者との連絡会議',
  'transport': '送迎ルートと運行管理',
  'upper-limit': '利用者負担上限額の管理',
  'chat': 'スタッフ・保護者間メッセージ',
  'staff-master': 'スタッフ情報・権限管理',
  'shift': 'シフトスケジュール管理',
  'staffing': '人員配置基準と勤務一覧',
  'leave-approval': '有給・特別休暇の申請管理',
  'talent-management': 'スキル・研修計画管理',
  'staff-documents': '給与明細・契約書の配布',
  'announcements': '全体お知らせの配信',
  'recruitment': '求人掲載と応募者管理',
  'dashboard': '経営KPIとリアルタイム概況',
  'addition-settings': '加算体制の設定とシミュレーション',
  'finance': '月次収支・予実管理',
  'cashflow': '入出金・キャッシュフロー管理',
  'billing': '国保連への請求データ作成',
  'training': '研修記録と委員会管理',
  'incident': '事故報告・苦情対応記録',
  'documents': '帳票管理と監査準備',
  'contract-report': '契約内容報告書の作成',
  'regulations': '就業規則・運営規程の管理',
  'compliance': 'コンプライアンスチェック',
  'self-evaluation': '自己評価・第三者評価管理',
  'facility': '施設の基本情報と設定',
};

// 現在のフェーズを取得
const getCurrentPhase = (): FeaturePhase => {
  const phase = parseInt(process.env.NEXT_PUBLIC_FEATURE_PHASE || '1', 10);
  if (phase >= 1 && phase <= 3) return phase as FeaturePhase;
  return 1;
};

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: string | number; strokeWidth?: string | number; className?: string }>;
  permission: keyof UserPermissions;
  description?: string;
  category?: string;
}

export interface SidebarMenuCategory {
  category: string;
  icon: React.ComponentType<{ size?: string | number; strokeWidth?: string | number; className?: string }>;
  items: SidebarMenuItem[];
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const menuCategories: SidebarMenuCategory[] = [
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
        { id: 'staff-documents', label: '書類配布', icon: FileOutput, permission: 'staff' as const },
        { id: 'announcements', label: 'お知らせ', icon: Send, permission: 'staff' as const },
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
        { id: 'contract-report', label: '契約内容報告書', icon: FileText, permission: 'dashboard' as const },
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

  // 検索フィルタリング — 検索中はカテゴリ横断でフラットリストを表示
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const results: (SidebarMenuItem & { category: string })[] = [];
    for (const cat of filteredCategories) {
      for (const item of cat.items) {
        const desc = MENU_DESCRIPTIONS[item.id] || '';
        if (
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          desc.toLowerCase().includes(q) ||
          cat.category.toLowerCase().includes(q)
        ) {
          results.push({ ...item, category: cat.category, description: desc });
        }
      }
    }
    return results;
  }, [searchQuery, filteredCategories]);

  // アクティブなタブが含まれるカテゴリのみ初期展開（他はデフォルト折りたたみ）
  useEffect(() => {
    const activeCategory = filteredCategories.find(cat =>
      cat.items.some(item => item.id === activeTab)
    );
    if (activeCategory) {
      // アクティブカテゴリのみ展開、他は折りたたみ
      setExpandedCategories(new Set([activeCategory.category]));
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

  // カテゴリごとの通知バッジ集計
  const getCategoryBadgeCount = useCallback((category: SidebarMenuCategory): number => {
    let count = 0;
    for (const item of category.items) {
      if (item.id === 'facility' && changeNotificationCount > 0) {
        count += changeNotificationCount;
      }
    }
    return count;
  }, [changeNotificationCount]);

  // 検索クリア
  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      {/* サイドバー */}
      <div
        className={`fixed md:relative top-0 left-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-30 shrink-0 transform transition-transform duration-300 ease-in-out ${
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

      {/* クイック検索ボックス */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="メニューを検索..."
            className="w-full pl-8 pr-8 py-2 text-[13px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder-gray-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="mt-1.5 text-[10px] text-gray-400 px-1 hidden md:block">
          <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">⌘K</kbd>
          {' '}でどこからでも検索
        </div>
      </div>

      <div className="px-3 py-2 flex-1 overflow-y-auto">
        {/* 検索結果のフラットリスト表示 */}
        {searchResults !== null ? (
          <div>
            {searchResults.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-gray-400">
                「{searchQuery}」に一致するメニューがありません
              </div>
            ) : (
              <nav className="space-y-0.5" role="navigation" aria-label="検索結果">
                {searchResults.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setSearchQuery('');
                        onClose?.();
                      }}
                      title={MENU_DESCRIPTIONS[item.id] || ''}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-[13px] ${
                        isActive
                          ? `${isCareer ? 'bg-personal/10 text-personal' : 'bg-primary/10 text-primary'} font-bold`
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                      }`}
                    >
                      <item.icon size={16} strokeWidth={2} className="w-5 h-5 shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <span className="truncate block">{item.label}</span>
                        <span className="text-[10px] text-gray-400 truncate block">{item.category}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        ) : (
          /* 通常のカテゴリ表示 */
          filteredCategories.map((category, categoryIndex) => {
            const isExpanded = expandedCategories.has(category.category);
            const hasActiveItem = category.items.some(item => item.id === activeTab);
            const CategoryIcon = category.icon;
            const badgeCount = getCategoryBadgeCount(category);

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
                      ? `${isCareer ? 'bg-purple-50 text-purple-700' : 'bg-primary/5 text-primary'}`
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CategoryIcon size={16} strokeWidth={2} className="w-5 h-5" />
                    <span className="text-[13px] font-bold">{category.category}</span>
                    {badgeCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full shrink-0">
                        {badgeCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!isExpanded && (
                      <span className="text-[10px] text-gray-400 font-normal">{category.items.length}</span>
                    )}
                    <ChevronDown
                      size={14}
                      className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                    />
                  </div>
                </button>

                {/* サブメニュー（展開時のみ表示） */}
                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
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
                            title={MENU_DESCRIPTIONS[item.id] || ''}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-[13px] ${
                              isActive
                                ? `${isCareer ? 'bg-personal/10 text-personal border-l-[3px] border-personal' : 'bg-primary/10 text-primary border-l-[3px] border-primary'} font-bold`
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
          })
        )}
      </div>

      <div className="mt-auto border-t border-gray-100" style={{ padding: `1rem 1rem calc(1rem + var(--safe-area-bottom, 0px)) 1rem` }}>
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-800 truncate">{facilitySettings?.facilityName || facility?.name || '施設名'}</div>
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

// Re-export types and descriptions for use by CommandPalette
export { MENU_DESCRIPTIONS };

