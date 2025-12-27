/**
 * 認証コンテキスト
 * マルチテナント対応の認証・認可管理
 */

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Facility } from '@/types';
import { mockUser, mockFacility } from '@/types/mockData';

interface AuthContextType {
  user: User | null;
  facility: Facility | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(mockUser);
  const [facility, setFacility] = useState<Facility | null>(mockFacility);

  const login = async (email: string, password: string) => {
    // TODO: 実際のAPI呼び出しに置き換え
    // 現在はモックデータを使用
    setUser(mockUser);
    setFacility(mockFacility);
  };

  const logout = () => {
    setUser(null);
    setFacility(null);
  };

  const isAuthenticated = user !== null;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        facility,
        isAuthenticated,
        isAdmin,
        login,
        logout,
      }}
    >
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

