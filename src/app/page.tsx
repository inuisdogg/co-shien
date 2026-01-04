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
import { usePasskeyAuth } from '@/components/auth/PasskeyAuth';
import { getAppType } from '@/utils/domain';

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
  const [rememberMe, setRememberMe] = useState(false);
  const { authenticatePasskey, isSupported, isAuthenticating, checkSupport } = usePasskeyAuth();
  
  // WebAuthnサポート確認
  useEffect(() => {
    if (typeof window !== 'undefined') {
      checkSupport();
    }
  }, []);

  // アプリタイプを取得
  const appType = getAppType();
  
  // 保存されたログイン情報を読み込む（30日間有効）
  useEffect(() => {
    const savedData = localStorage.getItem(`savedLoginData_${appType}`);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const savedDate = new Date(data.savedAt);
        const daysSinceSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // 30日以内なら読み込む
        if (daysSinceSaved <= 30) {
          if (data.facilityCode) {
            setFacilityCode(data.facilityCode);
          }
          if (data.loginId) {
            setLoginId(data.loginId);
          }
          if (data.password) {
            setPassword(data.password);
          }
          setRememberMe(true);
        } else {
          // 30日を超えていたら削除
          localStorage.removeItem(`savedLoginData_${appType}`);
        }
      } catch (e) {
        // パースエラーの場合は削除
        localStorage.removeItem(`savedLoginData_${appType}`);
      }
    }
  }, [appType]);

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Personal側では施設IDが不要（空文字列を渡す）
      const facilityCodeToUse = appType === 'personal' ? '' : facilityCode;
      await login(facilityCodeToUse, loginId, password);
      // ログイン情報を保存するかどうか（30日間有効）
      if (rememberMe) {
        const savedData = {
          facilityCode,
          loginId,
          password, // パスワードも保存（30日間）
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(`savedLoginData_${appType}`, JSON.stringify(savedData));
      } else {
        localStorage.removeItem(`savedLoginData_${appType}`);
      }
      // ログイン成功後、パスワードをリセット（保存しない場合のみ）
      if (!rememberMe) {
        setPassword('');
      }
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
    const isBiz = appType === 'biz';
    const isPersonal = appType === 'personal';
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <img
              src="/logo-cropped-center.png"
              alt="co-shien"
              className="h-16 w-auto mx-auto mb-4"
            />
            <div className="mb-2">
              {isBiz && (
                <span className="inline-block px-3 py-1 bg-[#00c4cc] text-white text-xs font-bold rounded-full mb-2">
                  Biz（事業所向け）
                </span>
              )}
              {isPersonal && (
                <span className="inline-block px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full mb-2">
                  Personal（スタッフ向け）
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-800">ログイン</h1>
            <p className="text-gray-600 text-sm mt-2">
              {isBiz 
                ? '施設ID、メールアドレス（またはログインID）、パスワードを入力してください'
                : 'メールアドレス（またはログインID）、パスワードを入力してください'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {isBiz && (
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
            )}

            <div>
              <label htmlFor="loginId" className="block text-sm font-bold text-gray-700 mb-2">
                メールアドレスまたはログインID
              </label>
              <input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="メールアドレスまたはログインIDを入力"
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

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                disabled={loading}
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-600">
                ログイン情報を30日間保存する
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || isAuthenticating}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {isSupported && (
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">または</span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!facilityCode || !loginId) {
                    setError('施設IDとメールアドレス（またはログインID）を入力してください');
                    return;
                  }
                  setError('');
                  try {
                    await authenticatePasskey(facilityCode, loginId);
                    // パスキー認証が成功した場合、通常のログインフローを実行
                    // 実際の実装では、パスキー認証の結果に基づいてログイン処理を行う
                    setError('パスキー認証機能は現在開発中です');
                  } catch (err: any) {
                    setError(err.message || 'パスキー認証に失敗しました');
                  }
                }}
                disabled={loading || isAuthenticating || !facilityCode || !loginId}
                className="mt-4 w-full bg-white hover:bg-gray-50 text-[#00c4cc] border-2 border-[#00c4cc] font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAuthenticating ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    認証中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    パスキーでログイン
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            {isPersonal ? (
              <div className="text-center">
                <button
                  onClick={() => router.push('/signup')}
                  className="w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg transition-all duration-200 transform hover:scale-105 border-2 border-purple-200 hover:border-purple-300"
                >
                  <img
                    src="/signup-icon.png"
                    alt="新規登録"
                    className="w-24 h-24 mb-3 object-contain"
                    onError={(e) => {
                      // 画像が存在しない場合のフォールバック
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-lg font-bold text-purple-700">新規登録</span>
                  <span className="text-sm text-purple-600 mt-1">アカウントを作成して始めましょう</span>
                </button>
              </div>
            ) : (
              <>
                <p className="text-center text-sm text-gray-600 mb-3">
                  初めてご利用の方は、初期設定を行ってください
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/facility-setup')}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-md transition-colors text-sm"
                >
                  初期設定を行う
                </button>
              </>
            )}
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

