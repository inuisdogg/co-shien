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
import Sidebar from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import DashboardView from '@/components/dashboard/DashboardView';
import ManagementSettingsView from '@/components/management/ManagementSettingsView';
import LeadView from '@/components/lead/LeadView';
import ScheduleView from '@/components/schedule/ScheduleView';
import ChildrenView from '@/components/children/ChildrenView';
import TransportRouteView from '@/components/transport/TransportRouteView';
import { StaffMasterView } from '@/components/staff/master';
import { ShiftManagementView } from '@/components/staff/shift';
import { StaffingView } from '@/components/staff/staffing';
import FacilitySettingsView from '@/components/facility/FacilitySettingsView';
import ChatManagementView from '@/components/chat/ChatManagementView';
import DailyLogView from '@/components/logs/DailyLogView';
import ServicePlanView from '@/components/logs/ServicePlanView';
import IncidentReportView from '@/components/logs/IncidentReportView';
import TrainingRecordView from '@/components/staff/TrainingRecordView';
import CommitteeView from '@/components/management/CommitteeView';
import AuditPreparationView from '@/components/management/AuditPreparationView';
import DocumentManagementView from '@/components/management/DocumentManagementView';
import FinanceView from '@/components/management/FinanceView';
import FacilityAdditionSettings from '@/components/settings/FacilityAdditionSettings';
import AdditionCatalogView from '@/components/management/AdditionCatalogView';
import StaffInfoManagementView from '@/components/management/StaffInfoManagementView';
import GovernmentPortalView from '@/components/government/GovernmentPortalView';
import KnowledgeBaseView from '@/components/knowledge/KnowledgeBaseView';
import AdditionSimulationView from '@/components/simulation/AdditionSimulationView';
import { useAuth } from '@/contexts/AuthContext';
import { UserPermissions } from '@/types';
import { supabase } from '@/lib/supabase';

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
      const permissionMap: Record<string, keyof UserPermissions> = {
        dashboard: 'dashboard',
        management: 'management',
        lead: 'lead',
        schedule: 'schedule',
        children: 'children',
        staff: 'staff',
        'staff-master': 'staff',
        staffing: 'staff',
        shift: 'staff',
        facility: 'facility',
      };

      let defaultTab: string;
      if (hasFullAccess) {
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
  }, [isAuthenticated, hasFullAccess, hasPermission, initialTabSet]);

  // 権限に基づいてアクセス制御
  useEffect(() => {
    if (isAuthenticated && initialTabSet && activeTab) {
      const permissionMap: Record<string, keyof UserPermissions> = {
        dashboard: 'dashboard',
        management: 'management',
        lead: 'lead',
        schedule: 'schedule',
        children: 'children',
        staff: 'staff',
        'staff-master': 'staff',
        staffing: 'staff',
        shift: 'staff',
        facility: 'facility',
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
      case 'management':
        return <ManagementSettingsView />;
      case 'lead':
        return <LeadView setActiveTab={setActiveTab} />;
      case 'schedule':
        return <ScheduleView />;
      case 'transport':
        return <TransportRouteView />;
      case 'children':
        return <ChildrenView setActiveTab={setActiveTab} />;
      case 'chat':
        return <ChatManagementView />;
      case 'staff-master':
        return <StaffMasterView />;
      case 'staff-info':
        return <StaffInfoManagementView facilityId={facility?.id || ''} facilityName={facility?.name} />;
      case 'shift':
        return <ShiftManagementView />;
      case 'facility':
        return <FacilitySettingsView />;
      case 'addition-settings':
        return facility?.id ? <FacilityAdditionSettings facilityId={facility.id} /> : null;
      case 'addition-catalog':
        return <AdditionCatalogView />;
      case 'addition-simulation':
        return <AdditionSimulationView />;
      case 'daily-log':
        return <DailyLogView />;
      case 'support-plan':
        return <ServicePlanView />;
      case 'incident':
        return <IncidentReportView />;
      case 'training':
        return <TrainingRecordView />;
      case 'audit-preparation':
        return <AuditPreparationView setActiveTab={setActiveTab} />;
      case 'committee':
        return <CommitteeView />;
      case 'documents':
        return <DocumentManagementView />;
      case 'finance':
        return facility?.id && user?.id ? (
          <FinanceView
            facilityId={facility.id}
            userId={user.id}
            userName={user.name || ''}
          />
        ) : null;
      case 'government':
        return <GovernmentPortalView />;
      case 'knowledge':
        return facility?.id && user?.id ? (
          <KnowledgeBaseView
            facilityId={facility.id}
            facilityName={facility.name}
            userId={user.id}
            userName={user.name || ''}
            isAdmin={hasFullAccess}
            onClose={() => setActiveTab('dashboard')}
          />
        ) : null;
      case 'staffing':
        return <StaffingView />;
      default:
        return null;
    }
  };

  return (
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
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
