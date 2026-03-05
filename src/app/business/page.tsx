/**
 * Business Dashboard Page
 * 施設管理者向けダッシュボード
 *
 * アクセス時の動作:
 * - 未ログイン → /business/login へリダイレクト
 * - ログイン済み + 施設未選択 → /career へリダイレクト（施設選択画面）
 * - ログイン済み + 施設選択済み → ダッシュボード表示
 */

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import Sidebar, { MENU_DESCRIPTIONS } from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import CommandPalette from '@/components/ui/CommandPalette';
import type { CommandPaletteItem } from '@/components/ui/CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import { SetupGuideProvider, useSetupGuide, SETUP_STEPS } from '@/contexts/SetupGuideContext';
import { UserPermissions } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  CalendarDays,
  Users,
  Settings,
  BarChart3,
  CalendarCheck,
  BookOpen,
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
} from 'lucide-react';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import OnboardingGuide from '@/components/common/OnboardingGuide';

// All view components loaded dynamically to reduce initial bundle size
const DynamicLoadingSpinner = () => (
  <LoadingSpinner size="sm" label="" />
);

const DashboardView = dynamicImport(() => import('@/components/dashboard/DashboardView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const ScheduleView = dynamicImport(() => import('@/components/schedule/ScheduleView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const ChildrenView = dynamicImport(() => import('@/components/children/ChildrenView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const StaffMasterView = dynamicImport(() => import('@/components/staff/master').then(m => ({ default: m.StaffMasterView })), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const ShiftManagementView = dynamicImport(() => import('@/components/staff/shift').then(m => ({ default: m.ShiftManagementView })), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const FacilitySettingsView = dynamicImport(() => import('@/components/facility/FacilitySettingsView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const DailyLogView = dynamicImport(() => import('@/components/logs/DailyLogView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const SupportPlanView = dynamicImport(() => import('@/components/support-plan/SupportPlanView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const DocumentManagementView = dynamicImport(() => import('@/components/documents/DocumentManagementView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const RevenueManagementView = dynamicImport(() => import('@/components/addition/RevenueManagementView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const StaffingView = dynamicImport(() => import('@/components/staffing/StaffingView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const TrainingRecordView = dynamicImport(() => import('@/components/training/TrainingRecordView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const IncidentReportView = dynamicImport(() => import('@/components/incident/IncidentReportView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const LeaveApprovalView = dynamicImport(() => import('@/components/staff/LeaveApprovalView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const TalentManagementView = dynamicImport(() => import('@/components/talent/TalentManagementView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const RegulationsManagementView = dynamicImport(() => import('@/components/regulations/RegulationsManagementView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const ComplianceView = dynamicImport(() => import('@/components/compliance/ComplianceView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const ConnectMeetingView = dynamicImport(() => import('@/components/connect/ConnectMeetingView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const FinanceView = dynamicImport(() => import('@/components/finance/FinanceView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const TransportManagementView = dynamicImport(() => import('@/components/transport/TransportManagementView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const UpperLimitManagementView = dynamicImport(() => import('@/components/upper-limit/UpperLimitManagementView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const RecruitmentView = dynamicImport(() => import('@/components/recruitment/RecruitmentView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const CashflowWizardView = dynamicImport(() => import('@/components/cashflow/CashflowWizardView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const BusinessChatView = dynamicImport(() => import('@/components/chat/BusinessChatView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const BillingWizardView = dynamicImport(() => import('@/components/billing/BillingWizardView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const SelfEvaluationView = dynamicImport(() => import('@/components/evaluation/SelfEvaluationView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const StaffDocumentView = dynamicImport(() => import('@/components/staff/StaffDocumentView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const AnnouncementView = dynamicImport(() => import('@/components/staff/AnnouncementView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });
const ContractReportView = dynamicImport(() => import('@/components/contract-report/ContractReportView'), { ssr: false, loading: () => <DynamicLoadingSpinner /> });

/**
 * Setup guide banner shown at top of dashboard when setup is incomplete.
 * Non-blocking — users can dismiss or ignore and use all features freely.
 * Dismissible via localStorage per facility.
 */
function SetupGuideBanner({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { facility } = useAuth();
  const { isSetupComplete, completedSteps, isLoading, getStepStatus } = useSetupGuide();
  const [dismissed, setDismissed] = React.useState(() => {
    if (typeof window === 'undefined' || !facility?.id) return false;
    return localStorage.getItem(`onboarding_dismissed_${facility.id}`) === 'true';
  });

  if (isLoading || isSetupComplete || dismissed) return null;

  const totalSteps = SETUP_STEPS.length;
  const doneCount = completedSteps.length;
  const progressPercent = Math.round((doneCount / totalSteps) * 100);

  const handleDismiss = () => {
    if (facility?.id) {
      localStorage.setItem(`onboarding_dismissed_${facility.id}`, 'true');
    }
    setDismissed(true);
  };

  return (
    <div className="mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px]">&#x2713;</span>
            セットアップ {doneCount}/{totalSteps} 完了
          </h3>
          <p className="text-xs text-gray-500 mt-1">3分で初期設定を完了できます。各項目は後からいつでも設定できます。</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
          title="閉じる"
        >
          &times;
        </button>
      </div>
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {/* Step cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {SETUP_STEPS.map((step, i) => {
          const status = getStepStatus(step.id);
          const isCompleted = status === 'completed';
          return (
            <button
              key={step.id}
              onClick={() => !isCompleted && setActiveTab(step.menuId)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                isCompleted
                  ? 'bg-white border-gray-200 opacity-60'
                  : 'bg-white border-primary/30 hover:border-primary hover:shadow-sm cursor-pointer'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isCompleted ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {isCompleted ? '\u2713' : i + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{step.label}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Content wrapper that shows setup guide banner on dashboard.
 * No longer gates access — all features are always available.
 */
function SetupGateContent({
  activeTab,
  setActiveTab,
  renderContent,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  renderContent: () => React.ReactNode;
}) {
  return (
    <>
      {activeTab === 'dashboard' && <SetupGuideBanner setActiveTab={setActiveTab} />}
      {renderContent()}
    </>
  );
}

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

// コマンドパレット用の全メニュー項目定義（権限フィルタは後で適用）
const ALL_COMMAND_PALETTE_ITEMS: (CommandPaletteItem & { permission: keyof import('@/types').UserPermissions })[] = [
  // 利用管理
  { id: 'schedule', label: '利用予約', icon: CalendarDays, category: '利用管理', permission: 'schedule', description: MENU_DESCRIPTIONS['schedule'] },
  { id: 'children', label: '児童管理', icon: Users, category: '利用管理', permission: 'children', description: MENU_DESCRIPTIONS['children'] },
  { id: 'daily-log', label: '実績と連絡帳', icon: BookOpen, category: '利用管理', permission: 'dailyLog', description: MENU_DESCRIPTIONS['daily-log'] },
  { id: 'support-plan', label: '個別支援計画', icon: FileText, category: '利用管理', permission: 'children', description: MENU_DESCRIPTIONS['support-plan'] },
  { id: 'connect', label: '連絡会議', icon: Users2, category: '利用管理', permission: 'children', description: MENU_DESCRIPTIONS['connect'] },
  { id: 'transport', label: '送迎管理', icon: Car, category: '利用管理', permission: 'schedule', description: MENU_DESCRIPTIONS['transport'] },
  { id: 'upper-limit', label: '上限管理', icon: Calculator, category: '利用管理', permission: 'dashboard', description: MENU_DESCRIPTIONS['upper-limit'] },
  { id: 'chat', label: 'チャット', icon: MessageCircle, category: '利用管理', permission: 'dashboard', description: MENU_DESCRIPTIONS['chat'] },
  // スタッフ
  { id: 'staff-master', label: 'スタッフ管理', icon: Users, category: 'スタッフ', permission: 'staff', description: MENU_DESCRIPTIONS['staff-master'] },
  { id: 'shift', label: 'シフト管理', icon: CalendarCheck, category: 'スタッフ', permission: 'shift', description: MENU_DESCRIPTIONS['shift'] },
  { id: 'staffing', label: '勤務・配置', icon: Shield, category: 'スタッフ', permission: 'staff', description: MENU_DESCRIPTIONS['staffing'] },
  { id: 'leave-approval', label: '休暇管理', icon: CalendarMinus, category: 'スタッフ', permission: 'staff', description: MENU_DESCRIPTIONS['leave-approval'] },
  { id: 'talent-management', label: 'タレントマネジメント', icon: Award, category: 'スタッフ', permission: 'staff', description: MENU_DESCRIPTIONS['talent-management'] },
  { id: 'staff-documents', label: '書類配布', icon: FileOutput, category: 'スタッフ', permission: 'staff', description: MENU_DESCRIPTIONS['staff-documents'] },
  { id: 'announcements', label: 'お知らせ', icon: Send, category: 'スタッフ', permission: 'staff', description: MENU_DESCRIPTIONS['announcements'] },
  // 採用
  { id: 'recruitment', label: '採用・求人', icon: Briefcase, category: '採用', permission: 'recruitment', description: MENU_DESCRIPTIONS['recruitment'] },
  // 経営
  { id: 'dashboard', label: 'ダッシュボード', icon: BarChart3, category: '経営', permission: 'dashboard', description: MENU_DESCRIPTIONS['dashboard'] },
  { id: 'addition-settings', label: '加算・収益', icon: ListChecks, category: '経営', permission: 'dashboard', description: MENU_DESCRIPTIONS['addition-settings'] },
  { id: 'finance', label: '財務管理', icon: DollarSign, category: '経営', permission: 'dashboard', description: MENU_DESCRIPTIONS['finance'] },
  { id: 'cashflow', label: '収支管理', icon: Wallet, category: '経営', permission: 'cashFlow', description: MENU_DESCRIPTIONS['cashflow'] },
  { id: 'billing', label: '国保連請求', icon: Receipt, category: '経営', permission: 'dashboard', description: MENU_DESCRIPTIONS['billing'] },
  // 記録・コンプライアンス
  { id: 'training', label: '研修・委員会', icon: GraduationCap, category: '記録・コンプライアンス', permission: 'staff', description: MENU_DESCRIPTIONS['training'] },
  { id: 'incident', label: '事故・苦情報告', icon: AlertTriangle, category: '記録・コンプライアンス', permission: 'dashboard', description: MENU_DESCRIPTIONS['incident'] },
  { id: 'documents', label: '書類・監査', icon: FolderOpen, category: '記録・コンプライアンス', permission: 'children', description: MENU_DESCRIPTIONS['documents'] },
  { id: 'contract-report', label: '契約内容報告書', icon: FileText, category: '記録・コンプライアンス', permission: 'dashboard', description: MENU_DESCRIPTIONS['contract-report'] },
  { id: 'regulations', label: '規定管理', icon: BookOpen, category: '記録・コンプライアンス', permission: 'staff', description: MENU_DESCRIPTIONS['regulations'] },
  { id: 'compliance', label: 'コンプライアンス', icon: Shield, category: '記録・コンプライアンス', permission: 'dashboard', description: MENU_DESCRIPTIONS['compliance'] },
  { id: 'self-evaluation', label: '自己評価', icon: ClipboardCheck, category: '記録・コンプライアンス', permission: 'dashboard', description: MENU_DESCRIPTIONS['self-evaluation'] },
  // 設定
  { id: 'facility', label: '施設情報', icon: Settings, category: '設定', permission: 'facility', description: MENU_DESCRIPTIONS['facility'] },
];

export default function BusinessPage() {
  const { isAuthenticated, isAdmin, isFacilityAdmin, isMaster, hasPermission, facility, user } = useAuth();
  // 施設管理者としてのフルアクセス権限
  const hasFullAccess = isAdmin || isFacilityAdmin || isMaster;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [initialTabSet, setInitialTabSet] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);
  const prevTabRef = useRef<string>('');

  const facilityIdFromQuery = searchParams?.get('facilityId') || null;
  const tabFromQuery = searchParams?.get('tab') || null;

  // Wrap setActiveTab with transition animation
  const handleSetActiveTab = useCallback((tab: string) => {
    if (tab === prevTabRef.current) return;
    setIsTabTransitioning(true);
    // Brief fade-out before switching content
    requestAnimationFrame(() => {
      setTimeout(() => {
        setActiveTab(tab);
        prevTabRef.current = tab;
        // Allow fade-in on next frame
        requestAnimationFrame(() => {
          setIsTabTransitioning(false);
        });
      }, 120);
    });
  }, []);

  // コマンドパレットに渡すメニュー項目（権限でフィルタ）
  const commandPaletteItems: CommandPaletteItem[] = useMemo(() => {
    return ALL_COMMAND_PALETTE_ITEMS.filter((item) => {
      if (hasFullAccess) return true;
      return hasPermission(item.permission as keyof UserPermissions);
    }).map(({ permission, ...rest }) => rest);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFullAccess]);

  // カスタムナビゲーションイベント（ドロワー内リンク等から）
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab) handleSetActiveTab(tab);
    };
    window.addEventListener('navigate-tab', handler);
    return () => window.removeEventListener('navigate-tab', handler);
  }, [handleSetActiveTab]);

  // 認証フローチェック
  useEffect(() => {
    let cancelled = false;

    const checkAuthFlow = async () => {
      const userStr = localStorage.getItem('user');
      const facilityStr = localStorage.getItem('selectedFacility');

      if (!userStr) {
        // 未ログイン → /career/login へ（キャリアアカウントでログイン）
        if (!cancelled) router.push('/career/login');
        return;
      }

      // 利用者（クライアント）の場合は保護者ダッシュボードへリダイレクト
      try {
        const userData = JSON.parse(userStr);
        if (userData?.userType === 'client') {
          if (!cancelled) router.push('/parent');
          return;
        }
        // facilityIdクエリパラメータがない場合のみ、スタッフ権限チェック
        // （facilityIdがある場合はemployment_recordsで権限を確認する）
        if (!facilityIdFromQuery && userData?.userType === 'staff' && userData?.role !== 'admin' && userData?.role !== 'owner') {
          // selectedFacilityがある場合は権限を確認
          if (facilityStr) {
            try {
              const selectedFacility = JSON.parse(facilityStr);
              // 施設での役割が管理者またはマネージャーでなければリダイレクト
              if (selectedFacility.role !== '管理者' && selectedFacility.role !== 'マネージャー') {
                if (!cancelled) router.push('/career');
                return;
              }
            } catch (e) {
              if (!cancelled) router.push('/career');
              return;
            }
          } else {
            if (!cancelled) router.push('/career');
            return;
          }
        }
      } catch (e) {
        if (!cancelled) router.push('/career/login');
        return;
      }

      // facilityIdクエリパラメータがある場合、施設情報を取得
      if (facilityIdFromQuery) {
        try {
          const userData = JSON.parse(userStr);

          // 既存の施設選択がある場合、同じ施設IDならスキップ
          // ただしfacility（AuthContext用）も正しくセットされているか確認
          if (facilityStr) {
            try {
              const existingFacility = JSON.parse(facilityStr);
              if (existingFacility.id === facilityIdFromQuery || existingFacility.facilityId === facilityIdFromQuery) {
                // facility（AuthContext用）が正しい施設を指しているか確認
                const authFacilityStr = localStorage.getItem('facility');
                let authFacilityOk = false;
                if (authFacilityStr) {
                  try {
                    const authFacility = JSON.parse(authFacilityStr);
                    authFacilityOk = authFacility.id === facilityIdFromQuery;
                  } catch {}
                }
                if (!authFacilityOk) {
                  // facilityが未設定か別施設 → 正しい施設情報をセットしてリロード
                  localStorage.setItem('facility', JSON.stringify({
                    id: existingFacility.id || existingFacility.facilityId,
                    name: existingFacility.name || existingFacility.facilityName,
                    code: existingFacility.code || existingFacility.facilityCode || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }));
                  const url = new URL(window.location.href);
                  url.searchParams.delete('facilityId');
                  window.location.href = url.toString();
                  return;
                }
                const url = new URL(window.location.href);
                url.searchParams.delete('facilityId');
                window.history.replaceState({}, '', url.toString());
                if (!cancelled) setCheckingAuth(false);
                return;
              }
            } catch (e) {
              // パースエラーは無視
            }
          }

          if (cancelled) return;

          // 施設情報を取得
          const { data: facilityData, error: facilityError } = await supabase
            .from('facilities')
            .select('*')
            .eq('id', facilityIdFromQuery)
            .single();

          if (cancelled) return;

          if (facilityError || !facilityData) {
            console.error('施設情報の取得に失敗:', facilityError);
            const url = new URL(window.location.href);
            url.searchParams.delete('facilityId');
            window.history.replaceState({}, '', url.toString());
            router.push('/career');
            return;
          }

          // ユーザーがその施設に所属しているか確認
          let employmentData = null;
          const { data: empData, error: employmentError } = await supabase
            .from('employment_records')
            .select('*')
            .eq('user_id', userData.id)
            .eq('facility_id', facilityIdFromQuery)
            .is('end_date', null)
            .single();

          if (cancelled) return;

          if (!employmentError && empData) {
            employmentData = empData;
          }

          // 施設情報をlocalStorageに保存
          const facilityInfo = {
            id: facilityData.id,
            name: facilityData.name,
            code: facilityData.code || '',
            role: employmentData?.role || '一般スタッフ',
            facilityId: facilityData.id,
            facilityName: facilityData.name,
            facilityCode: facilityData.code || '',
          };
          const facilityForAuth = {
            id: facilityData.id,
            name: facilityData.name,
            code: facilityData.code || '',
            ownerUserId: facilityData.owner_user_id || '',
            createdAt: facilityData.created_at || new Date().toISOString(),
            updatedAt: facilityData.updated_at || new Date().toISOString(),
          };
          localStorage.setItem('selectedFacility', JSON.stringify(facilityInfo));
          localStorage.setItem('facility', JSON.stringify(facilityForAuth));

          // クエリパラメータを削除してリロード
          const url = new URL(window.location.href);
          url.searchParams.delete('facilityId');
          window.location.href = url.toString();
          return;
        } catch (err) {
          console.error('施設情報の取得エラー:', err);
          const url = new URL(window.location.href);
          url.searchParams.delete('facilityId');
          window.history.replaceState({}, '', url.toString());
          if (!cancelled) router.push('/career');
          return;
        }
      }

      if (!facilityStr) {
        // ログイン済みだが施設未選択 → キャリアダッシュボードへ
        if (!cancelled) router.push('/career');
        return;
      }

      if (!cancelled) setCheckingAuth(false);
    };

    const timer = setTimeout(checkAuthFlow, 100);

    // Auth timeout: if still checking after 15s, show timeout feedback
    const authTimeoutTimer = setTimeout(() => {
      if (!cancelled) setAuthTimeout(true);
    }, 15000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(authTimeoutTimer);
    };
  }, [router, isAuthenticated, facilityIdFromQuery]);

  // 認証後に初期タブを設定
  useEffect(() => {
    if (isAuthenticated && !initialTabSet) {
      // MVP用パーミッションマップ
      const permissionMap: Record<string, keyof UserPermissions> = {
        dashboard: 'dashboard',
        schedule: 'schedule',
        children: 'children',
        'staff-master': 'staff',
        shift: 'shift',
        facility: 'facility',
        'daily-log': 'dailyLog',
      };

      let defaultTab: string;

      // クエリパラメータでタブが指定されている場合は優先
      if (tabFromQuery) {
        const requiredPermission = permissionMap[tabFromQuery];
        if (hasFullAccess || (requiredPermission && hasPermission(requiredPermission))) {
          defaultTab = tabFromQuery;
        } else if (hasFullAccess) {
          defaultTab = 'dashboard';
        } else if (hasPermission('schedule')) {
          defaultTab = 'schedule';
        } else {
          const accessibleTab = Object.entries(permissionMap).find(
            ([_, perm]) => hasPermission(perm)
          )?.[0];
          defaultTab = accessibleTab || 'schedule';
        }
        // URLからtabパラメータを削除（履歴を汚さないため）
        const url = new URL(window.location.href);
        url.searchParams.delete('tab');
        window.history.replaceState({}, '', url.toString());
      } else if (hasFullAccess) {
        defaultTab = 'dashboard';
      } else {
        if (hasPermission('schedule')) {
          defaultTab = 'schedule';
        } else {
          const accessibleTab = Object.entries(permissionMap).find(
            ([_, perm]) => hasPermission(perm)
          )?.[0];
          defaultTab = accessibleTab || 'schedule';
        }
      }
      setActiveTab(defaultTab);
      prevTabRef.current = defaultTab;
      setInitialTabSet(true);
    }
  }, [isAuthenticated, hasFullAccess, hasPermission, initialTabSet, tabFromQuery]);

  // 権限に基づいてアクセス制御
  useEffect(() => {
    if (isAuthenticated && initialTabSet && activeTab) {
      // MVP用パーミッションマップ
      const permissionMap: Record<string, keyof UserPermissions> = {
        dashboard: 'dashboard',
        schedule: 'schedule',
        children: 'children',
        'staff-master': 'staff',
        shift: 'shift',
        facility: 'facility',
        'daily-log': 'dailyLog',
      };

      const requiredPermission = permissionMap[activeTab];
      if (requiredPermission && !hasFullAccess && !hasPermission(requiredPermission)) {
        const accessibleTab = Object.entries(permissionMap).find(
          ([_, perm]) => hasPermission(perm)
        )?.[0] || 'schedule';
        setActiveTab(accessibleTab);
      }
    }
  }, [isAuthenticated, hasFullAccess, activeTab, hasPermission, initialTabSet]);

  // 認証確認中はローディング表示（タイムアウト時はフィードバックを表示）
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-dark gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <p className="text-white/80 text-sm">認証を確認中...</p>
        {authTimeout && (
          <div className="mt-2 text-center max-w-xs">
            <p className="text-white/70 text-xs leading-relaxed">
              読み込みに時間がかかっています。
              <br />ネットワーク接続をご確認ください。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-1.5 text-xs font-medium text-primary bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              ページを再読み込み
            </button>
          </div>
        )}
      </div>
    );
  }

  // 未認証の場合はログインページへ（useEffectでリダイレクト済みなのでここには来ないはず）
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-dark gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <p className="text-white/80 text-sm">リダイレクト中...</p>
      </div>
    );
  }

  // 認証済みだが初期タブが設定されるまでローディング表示
  if (!initialTabSet || !activeTab) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner label="ダッシュボードを準備中..." />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'schedule':
        return <ScheduleView />;
      case 'children':
        return <ChildrenView setActiveTab={handleSetActiveTab} />;
      case 'staff-master':
        return <StaffMasterView />;
      case 'shift':
        return <ShiftManagementView />;
      case 'facility':
        return <FacilitySettingsView />;
      case 'daily-log':
        return <DailyLogView />;
      case 'support-plan':
        return <SupportPlanView />;
      case 'documents':
        return <DocumentManagementView />;
      case 'addition-settings':
        return <RevenueManagementView />;
      case 'staffing':
        return <StaffingView />;
      case 'training':
        return <TrainingRecordView />;
      case 'incident':
        return <IncidentReportView />;
      case 'finance':
        return <FinanceView />;
      case 'leave-approval':
        return <LeaveApprovalView />;
      case 'talent-management':
        return <TalentManagementView />;
      case 'regulations':
        return <RegulationsManagementView />;
      case 'compliance':
        return <ComplianceView />;
      case 'connect':
        return <ConnectMeetingView />;
      case 'transport':
        return <TransportManagementView />;
      case 'upper-limit':
        return <UpperLimitManagementView />;
      case 'recruitment':
        return <RecruitmentView />;
      case 'cashflow':
        return <CashflowWizardView />;
      case 'chat':
        return <BusinessChatView />;
      case 'billing':
        return <BillingWizardView />;
      case 'self-evaluation':
        return <SelfEvaluationView />;
      case 'staff-documents':
        return <StaffDocumentView />;
      case 'announcements':
        return <AnnouncementView />;
      case 'contract-report':
        return <ContractReportView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <SetupGuideProvider>
      {/* Onboarding guide modal for first-time admin/manager login */}
      {hasFullAccess && <OnboardingGuide onNavigate={handleSetActiveTab} />}
      <div className="flex h-screen bg-[#f5f6f8] font-sans text-gray-800">
        <Sidebar
          mode="business"
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <CommandPalette items={commandPaletteItems} setActiveTab={handleSetActiveTab} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            mode="business"
            onMenuClick={() => setIsSidebarOpen(true)}
            onLogoClick={() => {
              const homeTab = hasFullAccess ? 'dashboard' : 'schedule';
              handleSetActiveTab(homeTab);
            }}
          />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8">
            <div
              className={`max-w-[1600px] mx-auto h-full flex flex-col transition-opacity duration-150 ${
                isTabTransitioning ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <SetupGateContent activeTab={activeTab} setActiveTab={handleSetActiveTab} renderContent={renderContent} />
            </div>
          </main>
        </div>
      </div>
    </SetupGuideProvider>
  );
}
