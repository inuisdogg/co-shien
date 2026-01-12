/**
 * Main Application Page
 *
 * アクセス時の動作:
 * - 未ログイン → /login へリダイレクト
 * - ログイン済み + 施設未選択 → /portal へリダイレクト
 * - ログイン済み + 施設選択済み → Biz/Personalモード表示
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import DashboardView from '@/components/dashboard/DashboardView';
import ManagementSettingsView from '@/components/management/ManagementSettingsView';
import LeadView from '@/components/lead/LeadView';
import ScheduleView from '@/components/schedule/ScheduleView';
import ChildrenView from '@/components/children/ChildrenView';
import TransportRouteView from '@/components/transport/TransportRouteView';
import StaffView from '@/components/staff/StaffView';
import StaffManagementView from '@/components/staff/StaffManagementView';
import FacilitySettingsView from '@/components/facility/FacilitySettingsView';
import ClientInvitationView from '@/components/client/ClientInvitationView';
import ChatManagementView from '@/components/chat/ChatManagementView';
import DailyLogView from '@/components/logs/DailyLogView';
import ServicePlanView from '@/components/logs/ServicePlanView';
import IncidentReportView from '@/components/logs/IncidentReportView';
import TrainingRecordView from '@/components/staff/TrainingRecordView';
import CommitteeView from '@/components/management/CommitteeView';
import AuditPreparationView from '@/components/management/AuditPreparationView';
import DocumentManagementView from '@/components/management/DocumentManagementView';
import ExpenseManagementView from '@/components/management/ExpenseManagementView';
import ProfitLossView from '@/components/management/ProfitLossView';
import CashFlowView from '@/components/management/CashFlowView';
import ConnectView from '@/components/connect/ConnectView';
import { useAuth } from '@/contexts/AuthContext';
import { UserPermissions } from '@/types';
import { usePasskeyAuth } from '@/components/auth/PasskeyAuth';
import { supabase } from '@/lib/supabase';

// 静的生成をスキップ（useAuthを使用するため）
export const dynamic = 'force-dynamic';

// 未実装機能のプレースホルダー
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500">この機能は準備中です</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isAdmin, hasPermission, login, facility, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [initialTabSet, setInitialTabSet] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // リダイレクト先を取得（クエリパラメータから）
  const redirectTo = searchParams?.get('redirect') || null;
  const facilityIdFromQuery = searchParams?.get('facilityId') || null;

  // 新フロー: 未ログインなら /login へ、利用者なら /client/dashboard へ、ログイン済み+施設未選択なら /portal へ
  useEffect(() => {
    const checkAuthFlow = async () => {
      const userStr = localStorage.getItem('user');
      const facilityStr = localStorage.getItem('selectedFacility');

      if (!userStr) {
        // 未ログイン → /login へ
        router.push('/login');
        return;
      }

      // 利用者（クライアント）の場合は利用者ダッシュボードへリダイレクト
      try {
        const userData = JSON.parse(userStr);
        if (userData?.userType === 'client') {
          router.push('/client/dashboard');
          return;
        }
      } catch (e) {
        // パースエラーの場合はログインページへ
        router.push('/login');
        return;
      }

      // facilityIdクエリパラメータがある場合、既にログイン済みなら施設情報を取得して認証をスキップ
      if (facilityIdFromQuery) {
        try {
          const userData = JSON.parse(userStr);
          
          // 既存の施設選択がある場合、同じ施設IDならスキップ
          if (facilityStr) {
            try {
              const existingFacility = JSON.parse(facilityStr);
              if (existingFacility.id === facilityIdFromQuery || existingFacility.facilityId === facilityIdFromQuery) {
                // 既に同じ施設が選択されている場合は、クエリパラメータを削除して続行
                const url = new URL(window.location.href);
                url.searchParams.delete('facilityId');
                window.history.replaceState({}, '', url.toString());
                setCheckingAuth(false);
                return;
              }
            } catch (e) {
              // パースエラーは無視して続行
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
            // クエリパラメータを削除してスタッフダッシュボードへ
            const url = new URL(window.location.href);
            url.searchParams.delete('facilityId');
            window.history.replaceState({}, '', url.toString());
            router.push('/staff-dashboard');
            return;
          }

          // ユーザーがその施設に所属しているか確認（所属していなくても、パーソナルアカウントでログイン済みなら許可）
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
          // 所属関係がない場合でも、パーソナルアカウントでログイン済みなら施設情報を保存して続行

          // 施設情報をlocalStorageに保存（selectedFacilityとfacilityの両方）
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
          
          // クエリパラメータを削除してからページをリロード（AuthContextがlocalStorageから読み込む）
          const url = new URL(window.location.href);
          url.searchParams.delete('facilityId');
          window.location.href = url.toString();
          return;
        } catch (err) {
          console.error('施設情報の取得エラー:', err);
          // クエリパラメータを削除してスタッフダッシュボードへ
          const url = new URL(window.location.href);
          url.searchParams.delete('facilityId');
          window.history.replaceState({}, '', url.toString());
          router.push('/staff-dashboard');
          return;
        }
      }

      if (!facilityStr) {
        // ログイン済みだが施設未選択 → スタッフダッシュボードへ
        // パーソナル単体でも利用可能。施設参加はダッシュボードからできる
        router.push('/staff-dashboard');
        return;
      }

      setCheckingAuth(false);
    };

    // 少し遅延してチェック（AuthContextの初期化を待つ）
    const timer = setTimeout(checkAuthFlow, 100);
    return () => clearTimeout(timer);
  }, [router, isAuthenticated, facilityIdFromQuery]);
  
  // ログインフォーム用の状態
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
  }, [checkSupport]);

  // 保存されたログイン情報を読み込む（30日間有効）
  useEffect(() => {
    const savedData = localStorage.getItem('savedLoginData_staff');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const savedDate = new Date(data.savedAt);
        const daysSinceSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

        // 30日以内なら読み込む
        if (daysSinceSaved <= 30) {
          if (data.loginId) {
            setLoginId(data.loginId);
          }
          if (data.password) {
            setPassword(data.password);
          }
          setRememberMe(true);
        } else {
          // 30日を超えていたら削除
          localStorage.removeItem('savedLoginData_staff');
        }
      } catch (e) {
        // パースエラーの場合は削除
        localStorage.removeItem('savedLoginData_staff');
      }
    }
  }, []);

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // スタッフログインは施設コード不要（空文字列を渡す）
      await login('', loginId, password);
      // ログイン情報を保存するかどうか（30日間有効）
      if (rememberMe) {
        const savedData = {
          loginId,
          password, // パスワードも保存（30日間）
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem('savedLoginData_staff', JSON.stringify(savedData));
      } else {
        localStorage.removeItem('savedLoginData_staff');
      }
      // ログイン成功後、パスワードをリセット（保存しない場合のみ）
      if (!rememberMe) {
        setPassword('');
      }
      // リダイレクト先が指定されている場合はそこに移動、そうでなければスタッフダッシュボードへ
      if (redirectTo) {
        if (redirectTo.startsWith('http')) {
          window.location.href = redirectTo;
        } else {
          router.push(redirectTo);
        }
      } else {
        router.push('/staff-dashboard');
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

  // 認証確認中はローディング表示
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // パーソナルアカウントでログイン済みの場合、facilityIdクエリパラメータがあれば施設情報を取得して認証をスキップ
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const hasUser = userStr !== null;
  const facilityStr = typeof window !== 'undefined' ? localStorage.getItem('facility') : null;
  const hasFacility = facilityStr !== null;

  // 未認証の場合はログイン画面を表示
  if (!isAuthenticated && !(hasUser && facilityIdFromQuery)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <Image
              src="/logo-cropped-center.png"
              alt="co-shien"
              width={200}
              height={64}
              className="h-16 w-auto mx-auto mb-4"
              priority
            />
            <h1 className="text-2xl font-bold text-gray-800">スタッフログイン</h1>
            <p className="text-gray-600 text-sm mt-2">
              メールアドレス（またはログインID）とパスワードを入力してください
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
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
                  if (!loginId) {
                    setError('メールアドレス（またはログインID）を入力してください');
                    return;
                  }
                  setError('');
                  try {
                    await authenticatePasskey('', loginId);
                    setError('パスキー認証機能は現在開発中です');
                  } catch (err: any) {
                    setError(err.message || 'パスキー認証に失敗しました');
                  }
                }}
                disabled={loading || isAuthenticating || !loginId}
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

          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
            <p className="text-center text-sm text-gray-600">
              アカウントをお持ちでない方は{' '}
              <button
                onClick={() => router.push('/signup')}
                className="text-[#00c4cc] hover:underline font-bold"
              >
                こちらから新規登録
              </button>
            </p>
            <p className="text-center text-xs text-gray-400">
              <button
                onClick={() => router.push('/client/login')}
                className="hover:underline"
              >
                利用者（保護者）の方はこちら
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 認証済みだが初期タブが設定されるまでローディング表示
  // 未認証の場合は既にログイン画面を表示しているので、ここには来ない
  if (isAuthenticated && (!initialTabSet || !activeTab)) {
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
      case 'client-invitation':
        return <ClientInvitationView />;
      case 'connect':
        return <ConnectView />;
      case 'chat':
        return <ChatManagementView />;
      case 'staff':
        return <StaffManagementView />;
      case 'shift':
        return <StaffView />;
      case 'facility':
        return <FacilitySettingsView />;
      // 日誌・記録
      case 'daily-log':
        return <DailyLogView />;
      case 'support-plan':
        return <ServicePlanView />;
      case 'incident':
        return <IncidentReportView />;
      // 運営管理
      case 'training':
        return <TrainingRecordView />;
      case 'audit-preparation':
        return <AuditPreparationView setActiveTab={setActiveTab} />;
      case 'committee':
        return <CommitteeView />;
      case 'documents':
        return <DocumentManagementView />;
      // 経営管理
      case 'profit-loss':
        return facility?.id ? <ProfitLossView facilityId={facility.id} /> : null;
      case 'cash-flow':
        return facility?.id ? <CashFlowView facilityId={facility.id} /> : null;
      case 'expense-management':
        return facility?.id && user?.id ? (
          <ExpenseManagementView
            facilityId={facility.id}
            approverId={user.id}
            approverName={user.name || ''}
          />
        ) : null;
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

