/**
 * OnboardingGuide - 初回ログイン時のオンボーディングモーダル
 * 3ステップで施設セットアップを案内
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Users, Baby, ChevronRight, X } from 'lucide-react';

interface OnboardingGuideProps {
  onNavigate: (tab: string) => void;
}

const STEPS = [
  {
    id: 1,
    icon: Building2,
    title: '施設基本設定',
    description: '施設名・住所・定員など基本情報を設定します。行政への届出情報と一致させましょう。',
    tab: 'facility',
    details: [
      '施設名（事業所名）と所在地を入力',
      '定員数（利用定員・運営規程に記載の人数）を設定',
      '開所時間と営業日を設定',
      'サービス種別（放課後等デイ・児童発達支援）を選択',
    ],
  },
  {
    id: 2,
    icon: Users,
    title: 'スタッフ登録',
    description: '職員を登録してシフト管理や勤怠記録を始めましょう。招待リンクで簡単に追加できます。',
    tab: 'staff-master',
    details: [
      '「スタッフを招待」ボタンから氏名・メールで招待',
      '役職（管理者/児童指導員/保育士など）を設定',
      '保有資格を登録（人員配置基準の自動チェックに使用）',
      '管理画面の閲覧権限を必要に応じて設定',
    ],
  },
  {
    id: 3,
    icon: Baby,
    title: '児童登録',
    description: '利用児童の情報を登録して、個別支援計画や出席管理を開始しましょう。',
    tab: 'children',
    details: [
      '「児童を追加」ボタンから児童名・生年月日を入力',
      '受給者証番号と支給日数を入力（後からでもOK）',
      '保護者メールアドレスを登録（保護者への通知に使用）',
      '所得区分を選択（利用者負担上限月額の計算に使用）',
    ],
  },
];

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('onboarding_completed');
      if (!completed) {
        setVisible(true);
      }
    }
  }, []);

  if (!visible) return null;

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setVisible(false);
  };

  const handleStepAction = (tab: string) => {
    localStorage.setItem('onboarding_completed', 'true');
    setVisible(false);
    onNavigate(tab);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
        onClick={handleSkip}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-primary to-primary-dark px-6 py-8 text-white relative">
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/20 transition-colors"
              aria-label="閉じる"
            >
              <X size={18} />
            </button>
            <p className="text-sm font-medium text-white/80 mb-1">
              ようこそ Roots へ
            </p>
            <h2 className="text-xl font-bold">
              かんたん初期設定ガイド
            </h2>
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mt-4">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'w-8 bg-white'
                      : i < currentStep
                        ? 'w-4 bg-white/60'
                        : 'w-4 bg-white/30'
                  }`}
                />
              ))}
              <span className="ml-auto text-sm text-white/70 font-medium">
                {currentStep + 1}/{STEPS.length}
              </span>
            </div>
          </div>

          {/* Step content */}
          <div className="px-6 py-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <StepIcon size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-800">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            {/* 具体的な入力項目のガイド */}
            <div className="mt-4 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-500 mb-2">このステップで行うこと:</p>
              <ul className="space-y-1.5">
                {step.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action button */}
            <button
              onClick={() => handleStepAction(step.tab)}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              設定する
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Footer navigation */}
          <div className="px-6 pb-6 flex items-center justify-between">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  戻る
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                スキップ
              </button>
              {currentStep < STEPS.length - 1 && (
                <button
                  onClick={handleNext}
                  className="text-sm text-primary font-medium px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  次へ
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingGuide;
