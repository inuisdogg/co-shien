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
import StaffManagementView from '@/components/staff/StaffManagementView';
import FacilitySettingsView from '@/components/facility/FacilitySettingsView';
import { useAuth } from '@/contexts/AuthContext';
import { UserPermissions } from '@/types';

export default function Home() {
  const { isAuthenticated, isAdmin, hasPermission, login } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [initialTabSet, setInitialTabSet] = useState(false);
  
  // ログインフォーム用の状態
  const [facilityCode, setFacilityCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(facilityCode, loginId, password);
      // ログイン成功後、フォームをリセット
      setFacilityCode('');
      setLoginId('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

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
        shift: 'staff',
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
        shift: 'staff',
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

  // 未認証の場合はログイン画面を表示
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <img
              src="/logo-cropped-center.png"
              alt="co-shien"
              className="h-16 w-auto mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-800">ログイン</h1>
            <p className="text-gray-600 text-sm mt-2">施設ID、ログインID、パスワードを入力してください</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="facilityCode" className="block text-sm font-bold text-gray-700 mb-2">
                施設ID
              </label>
              <input
                id="facilityCode"
                type="text"
                value={facilityCode}
                onChange={(e) => setFacilityCode(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="施設IDを入力"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="loginId" className="block text-sm font-bold text-gray-700 mb-2">
                ログインID
              </label>
              <input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="ログインIDを入力"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                パスワード
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="パスワードを入力"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-3">
              初めてご利用の方は、初期設定を行ってください
            </p>
            <button
              type="button"
              onClick={() => router.push('/admin-setup')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-md transition-colors text-sm"
            >
              初期設定を行う
            </button>
          </div>
        </div>
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
      case 'children':
        return <ChildrenView setActiveTab={setActiveTab} />;
      case 'staff':
        return <StaffManagementView />;
      case 'shift':
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
        mode="biz"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          mode="biz"
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

