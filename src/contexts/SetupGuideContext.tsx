/**
 * セットアップガイドContext
 * 新規ユーザー向けの初期設定ガイド状態を管理
 */

'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useFacilityData } from '@/hooks/useFacilityData';

// セットアップステップの定義
export type SetupStep = 'timeSlots' | 'staff' | 'children' | 'completed';

// ステップ情報
export interface StepInfo {
  id: SetupStep;
  menuId: string;
  label: string;
  description: string;
  guideText: string;
}

// ステップ定義
export const SETUP_STEPS: StepInfo[] = [
  {
    id: 'timeSlots',
    menuId: 'facility',
    label: '時間枠設定',
    description: '利用時間と定員を設定',
    guideText: '利用時間枠と定員を設定してください',
  },
  {
    id: 'staff',
    menuId: 'staff-master',
    label: 'スタッフ登録',
    description: 'スタッフを登録',
    guideText: 'スタッフを1名以上登録してください',
  },
  {
    id: 'children',
    menuId: 'children',
    label: '児童登録',
    description: '児童を登録',
    guideText: '児童を1名以上登録してください',
  },
];

// Context型定義
interface SetupGuideContextType {
  currentStep: SetupStep;
  currentStepIndex: number;
  currentStepInfo: StepInfo | null;
  isSetupComplete: boolean;
  isLoading: boolean;
  completedSteps: SetupStep[];
  canAccessMenu: (menuId: string) => boolean;
  getStepStatus: (stepId: SetupStep) => 'completed' | 'current' | 'pending';
}

const SetupGuideContext = createContext<SetupGuideContextType | undefined>(undefined);

export const SetupGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    timeSlots,
    staff,
    children: childrenData,
    loadingTimeSlots,
    loadingStaff,
    loadingChildren,
  } = useFacilityData();

  // ローディング状態
  const isLoading = loadingTimeSlots || loadingStaff || loadingChildren;

  // 完了済みステップを計算
  const completedSteps = useMemo(() => {
    const completed: SetupStep[] = [];

    // Step 1: 時間枠が設定されているか
    if (timeSlots.length > 0) {
      completed.push('timeSlots');
    }

    // Step 2: スタッフが登録されているか（Step1完了後のみ判定）
    if (completed.includes('timeSlots') && staff.length > 0) {
      completed.push('staff');
    }

    // Step 3: 契約中の児童が登録されているか（Step2完了後のみ判定）
    if (completed.includes('staff')) {
      const activeChildren = childrenData.filter(c => c.contractStatus === 'active');
      if (activeChildren.length > 0) {
        completed.push('children');
      }
    }

    return completed;
  }, [timeSlots, staff, childrenData]);

  // 現在のステップを計算
  const currentStep = useMemo((): SetupStep => {
    if (!completedSteps.includes('timeSlots')) return 'timeSlots';
    if (!completedSteps.includes('staff')) return 'staff';
    if (!completedSteps.includes('children')) return 'children';
    return 'completed';
  }, [completedSteps]);

  // 現在のステップインデックス
  const currentStepIndex = useMemo(() => {
    const index = SETUP_STEPS.findIndex(s => s.id === currentStep);
    return index >= 0 ? index : SETUP_STEPS.length;
  }, [currentStep]);

  // 現在のステップ情報
  const currentStepInfo = useMemo(() => {
    return SETUP_STEPS.find(s => s.id === currentStep) || null;
  }, [currentStep]);

  // セットアップ完了判定
  const isSetupComplete = currentStep === 'completed';

  // メニューアクセス可否判定
  const canAccessMenu = (menuId: string): boolean => {
    // セットアップ完了時は全てアクセス可能
    if (isSetupComplete) return true;

    // ダッシュボードは常にアクセス可能
    if (menuId === 'dashboard') return true;

    // 現在のステップのメニューはアクセス可能
    if (currentStepInfo && currentStepInfo.menuId === menuId) return true;

    // 完了済みステップのメニューもアクセス可能（戻って編集できるように）
    for (const step of completedSteps) {
      const stepInfo = SETUP_STEPS.find(s => s.id === step);
      if (stepInfo && stepInfo.menuId === menuId) return true;
    }

    return false;
  };

  // ステップ状態を取得
  const getStepStatus = (stepId: SetupStep): 'completed' | 'current' | 'pending' => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (currentStep === stepId) return 'current';
    return 'pending';
  };

  const value: SetupGuideContextType = {
    currentStep,
    currentStepIndex,
    currentStepInfo,
    isSetupComplete,
    isLoading,
    completedSteps,
    canAccessMenu,
    getStepStatus,
  };

  return (
    <SetupGuideContext.Provider value={value}>
      {children}
    </SetupGuideContext.Provider>
  );
};

// デフォルト値（Provider外で使用する場合）
const defaultContextValue: SetupGuideContextType = {
  currentStep: 'completed',
  currentStepIndex: SETUP_STEPS.length,
  currentStepInfo: null,
  isSetupComplete: true,
  isLoading: false,
  completedSteps: ['timeSlots', 'staff', 'children'],
  canAccessMenu: () => true,
  getStepStatus: () => 'completed',
};

export const useSetupGuide = (): SetupGuideContextType => {
  const context = useContext(SetupGuideContext);
  // Provider外で使用する場合はデフォルト値を返す（全機能アクセス可能）
  if (context === undefined) {
    return defaultContextValue;
  }
  return context;
};

export default SetupGuideContext;
