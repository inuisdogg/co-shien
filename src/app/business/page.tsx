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
// Lightweight/commonly-used components - static imports
import DashboardView from '@/components/dashboard/DashboardView';
import ScheduleView from '@/components/schedule/ScheduleView';
import ChildrenView from '@/components/children/ChildrenView';
import { StaffMasterView } from '@/components/staff/master';
import { ShiftManagementView } from '@/components/staff/shift';
import FacilitySettingsView from '@/components/facility/FacilitySettingsView';
import DailyLogView from '@/components/logs/DailyLogView';
import SupportPlanView from '@/components/support-plan/SupportPlanView';
import DocumentManagementView from '@/components/documents/DocumentManagementView';
import RevenueManagementView from '@/components/addition/RevenueManagementView';
import StaffingView from '@/components/staffing/StaffingView';
import TrainingRecordView from '@/components/training/TrainingRecordView';
import IncidentReportView from '@/components/incident/IncidentReportView';
import LeaveApprovalView from '@/components/staff/LeaveApprovalView';
import { useAuth } from '@/contexts/AuthContext';
import { SetupGuideProvider, useSetupGuide, SETUP_STEPS } from '@/contexts/SetupGuideContext';
import { UserPermissions } from '@/types';
import { supabase } from '@/lib/supabase';

// Heavy components - dynamic imports for performance optimization
const DynamicLoadingSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
  </div>
);

const FinanceView = dynamicImport(
  () => import('@/components/finance/FinanceView'),
  { ssr: false, loading: DynamicLoadingSpinner }
);

/**
 * Onboarding welcome screen shown when setup is incomplete.
 * Uses the SetupGuideContext to determine current setup progress.
 */
function OnboardingWelcome({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { isSetupComplete, currentStepIndex, completedSteps, isLoading, getStepStatus } = useSetupGuide();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent border-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (isSetupComplete) return null;

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">Rootsへようこそ</h1>
      <p className="text-gray-500 mb-8">利用を開始するには、以下の初期設定を完了してください。</p>

      <div className="space-y-4">
        {SETUP_STEPS.map((step, i) => {
          const status = getStepStatus(step.id);
          const isCompleted = status === 'completed';
          const isCurrent = i === currentStepIndex;
          return (
            <div
              key={step.id}
              className={`p-4 border rounded-lg ${isCompleted ? 'border-gray-200 bg-gray-50' : isCurrent ? 'border-gray-800' : 'border-gray-100'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${isCompleted ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {isCompleted ? '\u2713' : i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{step.label}</p>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>
                {isCurrent && !isCompleted && (
                  <button
                    onClick={() => setActiveTab(step.menuId)}
                    className="ml-auto px-4 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    設定する
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Gate component that conditionally shows onboarding or regular content.
 * Must be rendered inside SetupGuideProvider to access setup state.
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
  const { isSetupComplete, isLoading } = useSetupGuide();

  // While loading setup state, show regular content (don't flash onboarding)
  if (isLoading) return <>{renderContent()}</>;

  // If setup is not complete and user is on dashboard, show onboarding
  if (!isSetupComplete && activeTab === 'dashboard') {
    return <OnboardingWelcome setActiveTab={setActiveTab} />;
  }

  return <>{renderContent()}</>;
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
        if (!facilityIdFromQuery && userData?.userType === 'staff' && userData?.role !== 'admin') {
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
