/**
 * 認証コンテキスト
 * マルチテナント対応の認証・認可管理
 * サーバーサイド認証API経由でログイン
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Facility, UserPermissions, UserRole, UserType, AccountStatus } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  facility: Facility | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isFacilityAdmin: boolean;
  facilityRole: string | null;
  isMaster: boolean;
  isLoading: boolean;
  login: (facilityCode: string, loginId: string, password: string) => Promise<void>;
  logout: () => void;
  switchFacility: (facilityId: string) => Promise<void>;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapDbUserToUser(dbUser: Record<string, unknown>): User {
  return {
    id: dbUser.id as string,
    email: (dbUser.email as string) || '',
    name: (dbUser.name as string) || (
      dbUser.last_name && dbUser.first_name
        ? `${dbUser.last_name} ${dbUser.first_name}`
        : ''
    ),
    lastName: dbUser.last_name as string | undefined,
    firstName: dbUser.first_name as string | undefined,
    lastNameKana: dbUser.last_name_kana as string | undefined,
    firstNameKana: dbUser.first_name_kana as string | undefined,
    birthDate: dbUser.birth_date as string | undefined,
    gender: dbUser.gender as ('male' | 'female' | 'other') | undefined,
    loginId: (dbUser.login_id as string) || (dbUser.name as string) || '',
    userType: ((dbUser.user_type as UserType) || 'staff'),
    role: (dbUser.role as UserRole),
    facilityId: (dbUser.facility_id as string) || '',
    permissions: (dbUser.permissions as UserPermissions) || {},
    accountStatus: (dbUser.account_status as AccountStatus) || 'active',
    createdAt: dbUser.created_at as string,
    updatedAt: dbUser.updated_at as string,
  };
}

function mapDbFacilityToFacility(dbFacility: Record<string, unknown>): Facility {
  return {
    id: dbFacility.id as string,
    name: dbFacility.name as string,
    code: (dbFacility.code as string) || (dbFacility.id as string),
    ownerUserId: dbFacility.ownerUserId as string | undefined,
    createdAt: dbFacility.createdAt as string,
    updatedAt: dbFacility.updatedAt as string,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilityRole, setFacilityRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // セッション復元
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // 開発モード
        const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

        if (isDevMode) {
          const testUser: User = {
            id: process.env.NEXT_PUBLIC_DEV_USER_ID || 'dev-user-id',
            email: process.env.NEXT_PUBLIC_DEV_USER_EMAIL || 'dev@example.com',
            name: process.env.NEXT_PUBLIC_DEV_USER_NAME || '開発テストユーザー',
            lastName: process.env.NEXT_PUBLIC_DEV_USER_LAST_NAME || '開発',
            firstName: process.env.NEXT_PUBLIC_DEV_USER_FIRST_NAME || 'テスト',
            lastNameKana: process.env.NEXT_PUBLIC_DEV_USER_LAST_NAME_KANA || 'カイハツ',
            firstNameKana: process.env.NEXT_PUBLIC_DEV_USER_FIRST_NAME_KANA || 'テスト',
            loginId: process.env.NEXT_PUBLIC_DEV_USER_LOGIN_ID || 'dev@example.com',
            userType: (process.env.NEXT_PUBLIC_DEV_USER_TYPE as UserType) || 'staff',
            role: (process.env.NEXT_PUBLIC_DEV_USER_ROLE as UserRole) || 'admin',
            facilityId: process.env.NEXT_PUBLIC_DEV_FACILITY_ID || 'dev-facility-test',
            permissions: {},
            accountStatus: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const testFacility: Facility = {
            id: process.env.NEXT_PUBLIC_DEV_FACILITY_ID || 'dev-facility-test',
            name: process.env.NEXT_PUBLIC_DEV_FACILITY_NAME || 'テスト施設',
            code: process.env.NEXT_PUBLIC_DEV_FACILITY_CODE || 'TEST',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          setUser(testUser);
          setFacility(testFacility);
          localStorage.setItem('user', JSON.stringify(testUser));
          localStorage.setItem('facility', JSON.stringify(testFacility));
          setLoading(false);
          return;
        }

        // 通常モード: ローカルストレージから復元
        const storedUser = localStorage.getItem('user');
        const storedFacility = localStorage.getItem('facility');
        const storedSelectedFacility = localStorage.getItem('selectedFacility');

        // セッション有効期限チェック
        const sessionExpires = localStorage.getItem('session_expires');
        if (sessionExpires && Date.now() > parseInt(sessionExpires, 10)) {
          // セッション期限切れ: クリアして復元しない
          localStorage.removeItem('user');
          localStorage.removeItem('facility');
          localStorage.removeItem('selectedFacility');
          localStorage.removeItem('sessionStartedAt');
          localStorage.removeItem('session_expires');
          setLoading(false);
          return;
        }

        if (storedUser) {
          const userData = JSON.parse(storedUser);
          if (!userData.userType) {
            userData.userType = 'staff';
          }
          setUser(userData);

          if (storedFacility) {
            setFacility(JSON.parse(storedFacility));
          } else {
            setFacility(null);
          }

          if (storedSelectedFacility) {
            try {
              const selectedFacilityData = JSON.parse(storedSelectedFacility);
              setFacilityRole(selectedFacilityData.role || null);
            } catch {
              setFacilityRole(null);
            }
          } else {
            setFacilityRole(null);
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('facility');
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (facilityCode: string, loginIdOrEmail: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facilityCode,
        loginId: loginIdOrEmail,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ログインに失敗しました');
    }

    const mappedUser = mapDbUserToUser(data.user);
    setUser(mappedUser);
    localStorage.setItem('user', JSON.stringify(mappedUser));
    localStorage.setItem('sessionStartedAt', Date.now().toString());
    localStorage.setItem('session_expires', (Date.now() + 8 * 60 * 60 * 1000).toString());

    if (data.facility) {
      const mappedFacility = mapDbFacilityToFacility(data.facility);
      setFacility(mappedFacility);
      localStorage.setItem('facility', JSON.stringify(mappedFacility));
    } else {
      setFacility(null);
      localStorage.removeItem('facility');
    }

    // ログイン情報を保存（パスワードは保存しない）
    if (facilityCode) {
      localStorage.setItem('savedFacilityCode', facilityCode);
      localStorage.setItem('savedLoginId', loginIdOrEmail);
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    setFacility(null);
    localStorage.removeItem('user');
    localStorage.removeItem('facility');
    localStorage.removeItem('sessionStartedAt');
    localStorage.removeItem('session_expires');
  }, []);

  const switchFacility = useCallback(async (facilityId: string) => {
    // 施設情報を取得
    const { data: facilityData, error: facilityError } = await supabase
      .from('facilities')
      .select('id, name, code')
      .eq('id', facilityId)
      .single();

    if (facilityError || !facilityData) {
      throw new Error('施設情報の取得に失敗しました');
    }

    // employment_recordsからロールを取得
    const storedUser = localStorage.getItem('user');
    if (!storedUser) throw new Error('ユーザー情報がありません');
    const userData = JSON.parse(storedUser);

    const { data: empData } = await supabase
      .from('employment_records')
      .select('role')
      .eq('user_id', userData.id)
      .eq('facility_id', facilityId)
      .is('end_date', null)
      .single();

    const role = empData?.role || '管理者';

    const newFacility: Facility = {
      id: facilityData.id,
      name: facilityData.name,
      code: facilityData.code,
      createdAt: '',
      updatedAt: '',
    };

    // state更新
    setFacility(newFacility);
    setFacilityRole(role);

    // localStorage更新
    localStorage.setItem('facility', JSON.stringify(newFacility));
    localStorage.setItem('selectedFacility', JSON.stringify({
      id: facilityData.id,
      name: facilityData.name,
      code: facilityData.code,
      role,
    }));

    // ページ遷移（既存のfacilityId query paramフローを再利用）
    window.location.href = `/business?facilityId=${facilityId}`;
  }, []);

  // セッションタイムアウト（2時間操作なしでログアウト、5分前に警告）
  useEffect(() => {
    if (!user) return;

    const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2時間
    const WARNING_BEFORE = 5 * 60 * 1000; // 5分前
    let timeoutId: ReturnType<typeof setTimeout>;
    let warningId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      warningId = setTimeout(() => {
        toast.warning('5分間操作がないと自動ログアウトされます。');
      }, SESSION_TIMEOUT - WARNING_BEFORE);
      timeoutId = setTimeout(() => {
        logout();
        window.location.href = '/';
      }, SESSION_TIMEOUT);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, logout, toast]);

  // セッション有効期限の定期チェック（1分ごと）+ 事前警告
  useEffect(() => {
    if (!user) return;

    const SESSION_EXPIRY_CHECK_INTERVAL = 60 * 1000; // 1分
    const WARNING_THRESHOLD = 15 * 60 * 1000; // 15分前に警告
    let warningShown = false;

    const checkExpiry = () => {
      const sessionStartedAt = localStorage.getItem('sessionStartedAt');
      const sessionExpires = localStorage.getItem('session_expires');
      const MAX_SESSION_DURATION = 8 * 60 * 60 * 1000; // 8時間

      const isExpiredByStart = sessionStartedAt &&
        (Date.now() - parseInt(sessionStartedAt, 10)) > MAX_SESSION_DURATION;
      const isExpiredByExpiry = sessionExpires &&
        Date.now() > parseInt(sessionExpires, 10);

      if (isExpiredByStart || isExpiredByExpiry) {
        toast.warning('セッションの有効期限（8時間）が切れました。再度ログインしてください。');
        logout();
        window.location.href = '/';
        return;
      }

      // 15分前に事前警告
      if (!warningShown && sessionExpires) {
        const expiresAt = parseInt(sessionExpires, 10);
        const remaining = expiresAt - Date.now();
        if (remaining > 0 && remaining <= WARNING_THRESHOLD) {
          warningShown = true;
          const mins = Math.ceil(remaining / 60000);
          toast.warning(`セッションがあと約${mins}分で期限切れになります。作業を保存してください。`);
        }
      }
    };

    const intervalId = setInterval(checkExpiry, SESSION_EXPIRY_CHECK_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, logout, toast]);

  const isAuthenticated = user !== null;
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isFacilityAdmin = facilityRole === '管理者' || facilityRole === 'マネージャー';
  const isMaster = !!(user && facility?.ownerUserId && user.id === facility.ownerUserId);

  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!user) return false;
    if (isAdmin || isFacilityAdmin || isMaster) return true;
    if (user.role === 'manager' || user.role === 'staff') {
      return user.permissions?.[permission] === true;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent border-primary rounded-full animate-spin" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  const contextValue: AuthContextType = {
    user,
    facility,
    isAuthenticated,
    isAdmin,
    isFacilityAdmin,
    facilityRole,
    isMaster,
    isLoading: loading,
    login,
    logout,
    switchFacility,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
