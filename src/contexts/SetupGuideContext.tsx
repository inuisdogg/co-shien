/**
 * セットアップガイドContext
 * 新規ユーザー向けの初期設定ガイド状態を管理
 */

'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useFacilityData } from '@/hooks/useFacilityData';

// セットアップステップの定義
export type SetupStep = 'facility' | 'staff' | 'children' | 'shift' | 'schedule' | 'additionSettings' | 'completed';

// ステップ情報
export interface StepInfo {
  id: SetupStep;
  menuId: string;
  label: string;
  description: string;
  guideText: string;
}

// ステップ定義（6ステップ）
export const SETUP_STEPS: StepInfo[] = [
  {
    id: 'facility',
    menuId: 'facility',
    label: '施設情報を登録',
    description: '施設の基本情報を設定',
    guideText: '施設名・住所などの基本情報を登録してください',
  },
  {
    id: 'staff',
    menuId: 'staff-master',
    label: 'スタッフを追加',
    description: 'スタッフを登録',
    guideText: 'スタッフを1名以上登録してください',
  },
  {
    id: 'children',
    menuId: 'children',
    label: '児童を登録',
    description: '児童を登録',
    guideText: '児童を1名以上登録してください',
  },
  {
    id: 'shift',
    menuId: 'shift',
    label: 'シフトを作成',
    description: 'スタッフのシフトを作成',
    guideText: 'スタッフのシフトを作成してください',
  },
  {
    id: 'schedule',
    menuId: 'schedule',
    label: '利用予約を設定',
    description: '児童の利用予約を設定',
    guideText: '児童の利用スケジュールを登録してください',
  },
  {
    id: 'additionSettings',
    menuId: 'addition-settings',
    label: '加算体制を設定',
    description: '加算・体制の設定',
    guideText: '加算体制を設定してください',
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
    schedules,
    loadingTimeSlots,
    loadingStaff,
    loadingChildren,
  } = useFacilityData();

  // ローディング状態
  const isLoading = loadingTimeSlots || loadingStaff || loadingChildren;

  // 加算設定の有無（施設設定から推定 — timeSlots が設定されていればOK）
  // シフトの有無はschedulesデータで代用不可のため、スタッフが存在すれば仮完了扱い
  // 完了済みステップを計算（各ステップは独立判定）
  const completedSteps = useMemo(() => {
    const completed: SetupStep[] = [];

    // Step 1: 施設情報（施設が存在すれば登録済み — 常に完了扱い）
    // 施設登録しないとこの画面に来れないため常にtrue
    completed.push('facility');

    // Step 2: スタッフが登録されているか
    if (staff.length > 0) {
      completed.push('staff');
    }

    // Step 3: 児童が登録されているか
    const activeChildren = childrenData.filter(c => c.contractStatus === 'active');
    if (activeChildren.length > 0) {
      completed.push('children');
    }

    // Step 4: シフト（スタッフがいればシフト作成可能 — ここではスタッフ2名以上をヒューリスティックに利用）
    // 実際のシフトテーブルへのクエリは避け、スタッフが2名以上いれば完了扱いとする
    if (staff.length >= 2) {
      completed.push('shift');
    }

    // Step 5: 利用予約（スケジュールが存在するか）
    if (schedules.length > 0) {
      completed.push('schedule');
    }

    // Step 6: 加算体制（時間枠が設定されていれば加算設定も行われている可能性が高い）
    if (timeSlots.length > 0) {
      completed.push('additionSettings');
    }

    return completed;
  }, [timeSlots, staff, childrenData, schedules]);

  // 現在のステップを計算（最初の未完了ステップ）
  const currentStep = useMemo((): SetupStep => {
    for (const step of SETUP_STEPS) {
      if (!completedSteps.includes(step.id)) return step.id;
    }
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

  // メニューアクセス可否判定（全メニュー常にアクセス可能 — ガイドはあくまで案内）
  const canAccessMenu = (): boolean => {
    return true;
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
  completedSteps: ['facility', 'staff', 'children', 'shift', 'schedule', 'additionSettings'],
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
