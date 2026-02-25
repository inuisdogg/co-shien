/**
 * 認証コンテキスト
 * マルチテナント対応の認証・認可管理
 * サーバーサイド認証API経由でログイン
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Facility, UserPermissions, UserRole, UserType, AccountStatus } from '@/types';

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

  const logout = () => {
    setUser(null);
    setFacility(null);
    localStorage.removeItem('user');
    localStorage.removeItem('facility');
  };

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
    return <div className="flex items-center justify-center h-screen">読み込み中...</div>;
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
