/**
 * 認証コンテキスト
 * マルチテナント対応の認証・認可管理
 * スタッフ名とパスワードでログイン可能
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Facility, UserPermissions, UserRole } from '@/types';
import { supabase } from '@/lib/supabase';
import { verifyPassword } from '@/utils/password';

interface AuthContextType {
  user: User | null;
  facility: Facility | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (facilityCode: string, loginId: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);

  // セッション復元（ページリロード時など）
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedFacility = localStorage.getItem('facility');
        
        if (storedUser && storedFacility) {
          const userData = JSON.parse(storedUser);
          const facilityData = JSON.parse(storedFacility);
          setUser(userData);
          setFacility(facilityData);
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
    try {
      // Personal側のログイン（施設IDが空文字列の場合）
      if (!facilityCode || facilityCode.trim() === '') {
        // メールアドレスかログインIDかを判定
        const isEmail = loginIdOrEmail.includes('@');
        
        // usersテーブルから直接検索（施設IDなし）
        let userData: any = null;
        let userError: any = null;

        if (isEmail) {
          const result = await supabase
            .from('users')
            .select('*')
            .eq('email', loginIdOrEmail)
            .eq('has_account', true)
            .single();
          userData = result.data;
          userError = result.error;
        } else {
          const result = await supabase
            .from('users')
            .select('*')
            .eq('login_id', loginIdOrEmail)
            .eq('has_account', true)
            .single();
          userData = result.data;
          userError = result.error;
        }

        if (userError || !userData) {
          throw new Error('メールアドレス（またはログインID）またはパスワードが正しくありません');
        }

        if (!userData.password_hash) {
          throw new Error('このアカウントにはパスワードが設定されていません');
        }

        const isValid = await verifyPassword(password, userData.password_hash);
        if (!isValid) {
          throw new Error('メールアドレス（またはログインID）またはパスワードが正しくありません');
        }

        // ユーザー情報を作成（Personal側では施設情報は不要）
        const user: User = {
          id: userData.id,
          email: userData.email || '',
          name: userData.name,
          loginId: userData.login_id || userData.name,
          role: userData.role as UserRole,
          facilityId: userData.facility_id || '',
          permissions: userData.permissions || {},
          accountStatus: userData.account_status || 'active',
          createdAt: userData.created_at,
          updatedAt: userData.updated_at,
        };

        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
        
        // Personal側では施設情報は設定しない
        setFacility(null);
        localStorage.removeItem('facility');
        return;
      }

      // Biz側のログイン（施設IDがある場合）
      // 施設コードで施設を検索
      const { data: facilityData, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .eq('code', facilityCode)
        .single();

      if (facilityError || !facilityData) {
        throw new Error('施設IDが正しくありません');
      }

      // メールアドレスかログインIDかを判定（@が含まれていればメールアドレス）
      const isEmail = loginIdOrEmail.includes('@');

      // まずusersテーブルから検索（施設IDとメールアドレスまたはログインIDで検索）
      let userData: any = null;
      let userError: any = null;

      if (isEmail) {
        // メールアドレスで検索
        const result = await supabase
          .from('users')
          .select('*')
          .eq('facility_id', facilityData.id)
          .eq('email', loginIdOrEmail)
          .eq('has_account', true)
          .single();
        userData = result.data;
        userError = result.error;
      } else {
        // ログインIDで検索
        const result = await supabase
          .from('users')
          .select('*')
          .eq('facility_id', facilityData.id)
          .eq('login_id', loginIdOrEmail)
          .eq('has_account', true)
          .single();
        userData = result.data;
        userError = result.error;
      }

      if (!userError && userData) {
        // ユーザーテーブルにアカウントがある場合
        if (!userData.password_hash) {
          throw new Error('このアカウントにはパスワードが設定されていません');
        }

        const isValid = await verifyPassword(password, userData.password_hash);
        if (!isValid) {
          throw new Error('メールアドレス（またはログインID）またはパスワードが正しくありません');
        }

        // 施設情報を取得
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', userData.facility_id)
          .single();

        if (!facilityData) {
          throw new Error('施設情報が見つかりません');
        }

        // 施設設定から施設名を取得
        const { data: facilitySettings } = await supabase
          .from('facility_settings')
          .select('facility_name')
          .eq('facility_id', userData.facility_id)
          .single();

        const facility: Facility = {
          id: facilityData.id,
          name: facilitySettings?.facility_name || facilityData.name,
          code: facilityData.code || facilityData.id,
          createdAt: facilityData.created_at,
          updatedAt: facilityData.updated_at,
        };
        setFacility(facility);
        localStorage.setItem('facility', JSON.stringify(facility));

        // ユーザー情報を作成
        const user: User = {
          id: userData.id,
          email: userData.email || '',
          name: userData.name,
          loginId: userData.login_id || userData.name,
          role: userData.role as UserRole,
          facilityId: userData.facility_id,
          permissions: userData.permissions || {},
          accountStatus: userData.account_status || 'active',
          createdAt: userData.created_at,
          updatedAt: userData.updated_at,
        };

        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
        
        // ログイン情報を保存（パスワードは保存しない）
        localStorage.setItem('savedFacilityCode', facilityCode);
        localStorage.setItem('savedLoginId', loginIdOrEmail);
        return;
      }

      // usersテーブルにない場合、既存のstaffテーブルから検索（後方互換性）
      // 施設IDとスタッフ名またはメールアドレスで検索
      let staffData: any = null;
      let staffError: any = null;

      if (isEmail) {
        // メールアドレスで検索
        const result = await supabase
          .from('staff')
          .select('*')
          .eq('facility_id', facilityData.id)
          .eq('email', loginIdOrEmail)
          .eq('has_account', true)
          .single();
        staffData = result.data;
        staffError = result.error;
      } else {
        // スタッフ名で検索
        const result = await supabase
          .from('staff')
          .select('*')
          .eq('facility_id', facilityData.id)
          .eq('name', loginIdOrEmail)
          .eq('has_account', true)
          .single();
        staffData = result.data;
        staffError = result.error;
      }

      if (staffError || !staffData) {
        throw new Error('メールアドレス（またはログインID）またはパスワードが正しくありません');
      }

      if (!staffData.password_hash) {
        throw new Error('このスタッフにはアカウントが設定されていません');
      }

      const isValid = await verifyPassword(password, staffData.password_hash);
      if (!isValid) {
        throw new Error('メールアドレス（またはログインID）またはパスワードが正しくありません');
      }

      // 施設情報を取得
      const { data: facilitySettings } = await supabase
        .from('facility_settings')
        .select('facility_id, facility_name')
        .eq('facility_id', staffData.facility_id)
        .single();

      const facility: Facility = {
        id: staffData.facility_id,
        name: facilitySettings?.facility_name || staffData.facility_id,
        code: staffData.facility_id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setFacility(facility);
      localStorage.setItem('facility', JSON.stringify(facility));

      // スタッフ情報からユーザー情報を作成（後方互換性）
      const isAdmin = staffData.role === 'マネージャー';
      const user: User = {
        id: staffData.id,
        email: staffData.email || '',
        name: staffData.name,
        loginId: staffData.login_id || staffData.name,
        role: isAdmin ? 'admin' : 'staff',
        facilityId: staffData.facility_id,
        permissions: {},
        accountStatus: 'active',
        createdAt: staffData.created_at,
        updatedAt: staffData.updated_at,
      };

      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      
      // ログイン情報を保存（パスワードは保存しない）
      localStorage.setItem('savedFacilityCode', facilityCode);
      localStorage.setItem('savedLoginId', loginIdOrEmail);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setFacility(null);
    localStorage.removeItem('user');
    localStorage.removeItem('facility');
  };

  const isAuthenticated = user !== null;
  const isAdmin = user?.role === 'admin';
  
  // 権限チェック関数
  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!user) return false;
    if (isAdmin) return true; // 管理者は全権限
    if (user.role === 'manager' || user.role === 'staff') {
      return user.permissions?.[permission] === true;
    }
    return false;
  };

  // ローディング中は何も表示しない
  if (loading) {
    return <div className="flex items-center justify-center h-screen">読み込み中...</div>;
  }

  const contextValue: AuthContextType = {
    user,
    facility,
    isAuthenticated,
    isAdmin,
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

