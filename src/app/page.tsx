/**
 * Main Application Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import DashboardView from '@/components/dashboard/DashboardView';
import ManagementSettingsView from '@/components/management/ManagementSettingsView';
import LeadView from '@/components/lead/LeadView';
import ScheduleView from '@/components/schedule/ScheduleView';
import ChildrenView from '@/components/children/ChildrenView';
import StaffView from '@/components/staff/StaffView';
import FacilitySettingsView from '@/components/facility/FacilitySettingsView';
import { useAuth } from '@/contexts/AuthContext';
import { UserPermissions } from '@/types';

export default function Home() {
  const { isAuthenticated, isAdmin, hasPermission } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [initialTabSet, setInitialTabSet] = useState(false);

  // 認証チェック
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // 認証後に初期タブを設定（管理者はdashboard、それ以外はschedule）
  useEffect(() => {
    if (isAuthenticated && !initialTabSet) {
      const permissionMap: Record<string, keyof UserPermissions> = {
        dashboard: 'dashboard',
        management: 'management',
        lead: 'lead',
        schedule: 'schedule',
        children: 'children',
        staff: 'staff',
        facility: 'facility',
      };

      let defaultTab: string;
      if (isAdmin) {
        // 管理者はdashboardをホームに
        defaultTab = 'dashboard';
      } else {
        // 管理者以外はscheduleをホームに（権限がある場合）
        if (hasPermission('schedule')) {
          defaultTab = 'schedule';
        } else {
          // scheduleの権限がない場合、最初にアクセス可能なメニューを探す
          const accessibleTab = Object.entries(permissionMap).find(
            ([_, perm]) => hasPermission(perm)
          )?.[0];
          defaultTab = accessibleTab || 'schedule';
        }
      }
      setActiveTab(defaultTab);
      setInitialTabSet(true);
    }
  }, [isAuthenticated, isAdmin, hasPermission, initialTabSet]);

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
        facility: 'facility',
      };

      const requiredPermission = permissionMap[activeTab];
      if (requiredPermission && !isAdmin && !hasPermission(requiredPermission)) {
        // 権限がない場合は、最初にアクセス可能なメニューにリダイレクト
        const accessibleTab = Object.entries(permissionMap).find(
          ([_, perm]) => hasPermission(perm)
        )?.[0] || 'schedule';
        setActiveTab(accessibleTab);
      }
    }
  }, [isAuthenticated, isAdmin, activeTab, hasPermission, initialTabSet]);

  // 認証されていない場合、または初期タブが設定されるまでローディング表示
  if (!isAuthenticated || !initialTabSet || !activeTab) {
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
      case 'children':
        return <ChildrenView setActiveTab={setActiveTab} />;
      case 'staff':
        return <StaffView />;
      case 'facility':
        return <FacilitySettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f6f8] font-sans text-gray-800">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          onLogoClick={() => {
            // 管理者はdashboard、それ以外はscheduleをホームに
            const homeTab = isAdmin ? 'dashboard' : 'schedule';
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

