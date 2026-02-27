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

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import Sidebar from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import { useAuth } from '@/contexts/AuthContext';
import { SetupGuideProvider, useSetupGuide, SETUP_STEPS } from '@/contexts/SetupGuideContext';
import { UserPermissions } from '@/types';
import { supabase } from '@/lib/supabase';

// All view components loaded dynamically to reduce initial bundle size
const DynamicLoadingSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
  </div>
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

/**
 * Setup guide banner shown at top of dashboard when setup is incomplete.
 * Non-blocking — users can dismiss or ignore and use all features freely.
 */
function SetupGuideBanner({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { isSetupComplete, completedSteps, isLoading, getStepStatus } = useSetupGuide();
  const [dismissed, setDismissed] = React.useState(false);

  if (isLoading || isSetupComplete || dismissed) return null;

  const totalSteps = SETUP_STEPS.length;
  const doneCount = completedSteps.length;

  return (
    <div className="mb-6 bg-gradient-to-r from-[#00c4cc]/5 to-[#00c4cc]/10 border border-[#00c4cc]/20 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 bg-[#00c4cc] text-white rounded-full flex items-center justify-center text-[10px]">&#x2713;</span>
            初期設定ガイド
            <span className="text-xs font-normal text-gray-500 ml-1">{doneCount}/{totalSteps} 完了</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">まだ完了していない設定があります。各項目は後からいつでも設定できます。</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
          title="閉じる"
        >
          &times;
        </button>
      </div>
      <div className="flex gap-3">
        {SETUP_STEPS.map((step, i) => {
          const status = getStepStatus(step.id);
          const isCompleted = status === 'completed';
          return (
            <button
              key={step.id}
              onClick={() => !isCompleted && setActiveTab(step.menuId)}
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                isCompleted
                  ? 'bg-white border-gray-200 opacity-60'
                  : 'bg-white border-[#00c4cc]/30 hover:border-[#00c4cc] hover:shadow-sm cursor-pointer'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isCompleted ? 'bg-[#00c4cc] text-white' : 'bg-gray-100 text-gray-500'
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

export default function BusinessPage() {
  const { isAuthenticated, isAdmin, isFacilityAdmin, hasPermission, facility, user } = useAuth();
  // 施設管理者としてのフルアクセス権限
  const hasFullAccess = isAdmin || isFacilityAdmin;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [initialTabSet, setInitialTabSet] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const facilityIdFromQuery = searchParams?.get('facilityId') || null;
  const tabFromQuery = searchParams?.get('tab') || null;

  // 認証フローチェック
  useEffect(() => {
    const checkAuthFlow = async () => {
      const userStr = localStorage.getItem('user');
      const facilityStr = localStorage.getItem('selectedFacility');

      if (!userStr) {
        // 未ログイン → /career/login へ（キャリアアカウントでログイン）
        router.push('/career/login');
        return;
      }

      // 利用者（クライアント）の場合は保護者ダッシュボードへリダイレクト
      try {
        const userData = JSON.parse(userStr);
        if (userData?.userType === 'client') {
          router.push('/parent');
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
                router.push('/career');
                return;
              }
            } catch (e) {
              router.push('/career');
              return;
            }
          } else {
            router.push('/career');
            return;
          }
        }
      } catch (e) {
        router.push('/career/login');
        return;
      }

      // facilityIdクエリパラメータがある場合、施設情報を取得
      if (facilityIdFromQuery) {
        try {
          const userData = JSON.parse(userStr);

          // 既存の施設選択がある場合、同じ施設IDならスキップ
          if (facilityStr) {
            try {
              const existingFacility = JSON.parse(facilityStr);
              if (existingFacility.id === facilityIdFromQuery || existingFacility.facilityId === facilityIdFromQuery) {
                const url = new URL(window.location.href);
                url.searchParams.delete('facilityId');
                window.history.replaceState({}, '', url.toString());
                setCheckingAuth(false);
                return;
              }
            } catch (e) {
              // パースエラーは無視
            }
          }

          // 施設情報を取得
          const { data: facilityData, error: facilityError } = await supabase
            .from('facilities')
            .select('*')
            .eq('id', facilityIdFromQuery)
            .single();

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
          router.push('/career');
          return;
        }
      }

      if (!facilityStr) {
        // ログイン済みだが施設未選択 → キャリアダッシュボードへ
        router.push('/career');
        return;
      }

      setCheckingAuth(false);
    };

    const timer = setTimeout(checkAuthFlow, 100);
    return () => clearTimeout(timer);
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

  // 認証確認中はローディング表示
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // 未認証の場合はログインページへ（useEffectでリダイレクト済みなのでここには来ないはず）
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // 認証済みだが初期タブが設定されるまでローディング表示
  if (!initialTabSet || !activeTab) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>読み込み中...</div>
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
        return <ChildrenView setActiveTab={setActiveTab} />;
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
      default:
        return <DashboardView />;
    }
  };

  return (
    <SetupGuideProvider>
      <div className="flex h-screen bg-[#f5f6f8] font-sans text-gray-800">
        <Sidebar
          mode="business"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            mode="business"
            onMenuClick={() => setIsSidebarOpen(true)}
            onLogoClick={() => {
              const homeTab = hasFullAccess ? 'dashboard' : 'schedule';
              setActiveTab(homeTab);
            }}
          />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8">
            <div className="max-w-[1600px] mx-auto h-full flex flex-col">
              <SetupGateContent activeTab={activeTab} setActiveTab={setActiveTab} renderContent={renderContent} />
            </div>
          </main>
        </div>
      </div>
    </SetupGuideProvider>
  );
}
