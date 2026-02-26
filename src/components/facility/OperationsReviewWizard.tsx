/**
 * 月次運営確認ウィザード
 * 施設管理者が来月の運営変更を確認し、変更届の必要性を判定するステップバイステップ型モーダル
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  Users,
  Star,
  Clock,
  Hash,
  MoreHorizontal,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  FileText,
  Calendar,
  ArrowRight,
  HelpCircle,
  Download,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useChangeNotifications } from '@/hooks/useChangeNotifications';
import { supabase } from '@/lib/supabase';
import type {
  ChangeNotificationType,
  OperationsReviewResponses,
  OperationsReviewChange,
} from '@/types';
import { CHANGE_NOTIFICATION_TYPE_LABELS } from '@/types';

// ==================== Constants ====================

const STAFF_POSITIONS = [
  '管理者',
  '児童発達支援管理責任者',
  '児童指導員',
  '保育士',
  '理学療法士',
  '作業療法士',
  '言語聴覚士',
  '看護師',
  'その他',
];

const SUBSIDY_OPTIONS = [
  { id: 'family_support', label: '家族支援加算' },
  { id: 'medical_liaison', label: '医療連携体制加算' },
  { id: 'specialized_support', label: '専門的支援加算' },
  { id: 'child_guidance', label: '児童指導員等加配加算' },
  { id: 'nursing_staff', label: '看護職員加配加算' },
  { id: 'strong_behavior', label: '強度行動障害児支援加算' },
  { id: 'related_agency', label: '関係機関連携加算' },
  { id: 'self_evaluation', label: '自己評価結果等未公表減算（回避）' },
  { id: 'transport', label: '送迎加算' },
  { id: 'extended_support', label: '延長支援加算' },
];

const REQUIRED_DOCUMENTS: Record<ChangeNotificationType, string[]> = {
  business_hours: ['変更届出書', '運営規程の写し（変更後）'],
  manager: ['変更届出書', '管理者の経歴書', '管理者の資格証明書の写し'],
  service_manager: ['変更届出書', '児童発達支援管理責任者の経歴書', '実務経験証明書', '研修修了証の写し'],
  capacity: ['変更届出書', '平面図', '設備一覧表'],
  facility_name: ['変更届出書', '登記事項証明書'],
  address: ['変更届出書', '平面図', '建物の権利証明書（賃貸借契約書等）'],
  equipment: ['変更届出書', '設備一覧表', '平面図'],
  subsidy: ['届出書（加算届）', '加算の算定に必要な資格証明書等', '勤務体制一覧表'],
};

const WIZARD_STEPS = [
  { id: 'staff', label: 'スタッフ体制', icon: Users },
  { id: 'subsidies', label: '加算の変更', icon: Star },
  { id: 'businessHours', label: '営業時間・営業日', icon: Clock },
  { id: 'capacity', label: '定員', icon: Hash },
  { id: 'other', label: 'その他', icon: MoreHorizontal },
  { id: 'summary', label: '確認・結果', icon: CheckCircle },
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number]['id'];

// ==================== Sub-Components ====================

function YesNoCards({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      <button
        onClick={() => onChange(true)}
        className={`p-6 rounded-xl border-2 transition-all text-center ${
          value === true
            ? 'border-[#00c4cc] bg-[#00c4cc]/5 ring-2 ring-[#00c4cc]/20'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div
          className={`text-2xl font-bold mb-1 ${
            value === true ? 'text-[#00c4cc]' : 'text-gray-700'
          }`}
        >
          はい
        </div>
        <div className="text-xs text-gray-500">変更があります</div>
      </button>
      <button
        onClick={() => onChange(false)}
        className={`p-6 rounded-xl border-2 transition-all text-center ${
          value === false
            ? 'border-[#00c4cc] bg-[#00c4cc]/5 ring-2 ring-[#00c4cc]/20'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div
          className={`text-2xl font-bold mb-1 ${
            value === false ? 'text-[#00c4cc]' : 'text-gray-700'
          }`}
        >
          いいえ
        </div>
        <div className="text-xs text-gray-500">変更なし</div>
      </button>
    </div>
  );
}

function ProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-1 w-full">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            i < currentStep
              ? 'bg-[#00c4cc]'
              : i === currentStep
              ? 'bg-[#00c4cc]/50'
              : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ==================== Guide Section ====================

function OperationsChangeGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <BookOpen size={20} className="text-[#00c4cc]" />
          変更届ガイド
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* What triggers */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h4 className="font-bold text-sm text-gray-800 mb-3">変更届が必要な項目</h4>
        <div className="space-y-2">
          {[
            { label: '管理者の変更', detail: '管理者が交代・異動する場合' },
            { label: '児童発達支援管理責任者の変更', detail: '児発管が交代する場合' },
            { label: '営業日・営業時間の変更', detail: '定休日や営業時間を変更する場合' },
            { label: '定員の変更', detail: '利用定員を増減する場合' },
            { label: '事業所名称の変更', detail: '事業所の名前を変える場合' },
            { label: '事業所所在地の変更', detail: '移転する場合' },
            { label: '設備の変更', detail: '主要な設備を変更する場合' },
            { label: '加算の追加・変更', detail: '新たに加算を取得、または廃止する場合' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
              <ChevronRight size={14} className="text-[#00c4cc] mt-0.5 shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <p className="text-xs text-gray-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deadlines */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h4 className="font-bold text-sm text-gray-800 mb-3">届出期限</h4>
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm font-bold text-amber-800">一般的な変更: 変更後10日以内</p>
            <p className="text-xs text-amber-700 mt-1">
              管理者・児発管の変更、営業時間変更、定員変更、名称変更、住所変更、設備変更
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-bold text-blue-800">加算関連: 届出月の前月15日まで</p>
            <p className="text-xs text-blue-700 mt-1">
              加算の新規取得・廃止は、適用開始月の前月15日までに届出が必要です
            </p>
          </div>
        </div>
      </div>

      {/* Required Documents */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h4 className="font-bold text-sm text-gray-800 mb-3">必要書類（代表例）</h4>
        <div className="space-y-2 text-xs text-gray-600">
          <p>- 変更届出書（所定様式）</p>
          <p>- 運営規程の写し（変更箇所あり）</p>
          <p>- 管理者・児発管変更の場合: 経歴書、資格証明書の写し</p>
          <p>- 定員変更の場合: 平面図、設備一覧表</p>
          <p>- 加算届の場合: 勤務体制一覧表、資格証明書</p>
        </div>
      </div>

      {/* Q&A */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h4 className="font-bold text-sm text-gray-800 mb-3">よくある質問</h4>
        <div className="space-y-4">
          {[
            {
              q: '変更届を出さないとどうなりますか？',
              a: '行政指導の対象となり、最悪の場合は指定取消の理由になることがあります。必ず期限内に届出してください。',
            },
            {
              q: 'パートスタッフが増えた場合も届出は必要ですか？',
              a: '一般スタッフの増減は届出不要ですが、配置基準に関わる職種（児発管、管理者等）の変更は届出が必要です。',
            },
            {
              q: '加算の届出を忘れた場合、遡って適用できますか？',
              a: '原則として遡及適用はできません。届出月の翌月からの適用となるため、前月15日までの届出を忘れないようにしましょう。',
            },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-sm font-bold text-gray-700 flex items-start gap-2">
                <HelpCircle size={14} className="text-[#00c4cc] mt-0.5 shrink-0" />
                {item.q}
              </p>
              <p className="text-xs text-gray-500 mt-1 ml-6">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== Main Component ====================

interface OperationsReviewWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function OperationsReviewWizard({
  isOpen,
  onClose,
  onComplete,
}: OperationsReviewWizardProps) {
  const { facility } = useAuth();
  const { facilitySettings } = useFacilityData();
  const { createNotification } = useChangeNotifications();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<OperationsReviewResponses>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const currentStep = WIZARD_STEPS[currentStepIndex];

  // Compute the review month (next month)
  const reviewMonth = useMemo(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const reviewMonthLabel = useMemo(() => {
    const [y, m] = reviewMonth.split('-');
    return `${y}年${parseInt(m)}月`;
  }, [reviewMonth]);

  // Detect changes from responses
  const detectedChanges = useMemo((): OperationsReviewChange[] => {
    const changes: OperationsReviewChange[] = [];
    const now = new Date();

    // Staff changes
    if (responses.staff?.hasChange) {
      const positions = responses.staff.positions || [];
      const isManagerChange = positions.includes('管理者');
      const isServiceManagerChange = positions.includes('児童発達支援管理責任者');

      if (isManagerChange) {
        const deadline = new Date(now);
        deadline.setDate(deadline.getDate() + 10);
        changes.push({
          type: 'manager',
          description: '管理者の変更',
          deadline: deadline.toISOString(),
          requiredDocuments: REQUIRED_DOCUMENTS.manager,
        });
      }
      if (isServiceManagerChange) {
        const deadline = new Date(now);
        deadline.setDate(deadline.getDate() + 10);
        changes.push({
          type: 'service_manager',
          description: '児童発達支援管理責任者の変更',
          deadline: deadline.toISOString(),
          requiredDocuments: REQUIRED_DOCUMENTS.service_manager,
        });
      }
    }

    // Subsidy changes
    if (responses.subsidies?.hasChange) {
      const deadline = new Date(now);
      deadline.setDate(15);
      if (now.getDate() > 15) {
        deadline.setMonth(deadline.getMonth() + 1);
      }
      const additions = responses.subsidies.additions || [];
      const removals = responses.subsidies.removals || [];
      if (additions.length > 0 || removals.length > 0) {
        changes.push({
          type: 'subsidy',
          description: `加算の変更（追加: ${additions.length}件、廃止: ${removals.length}件）`,
          deadline: deadline.toISOString(),
          requiredDocuments: REQUIRED_DOCUMENTS.subsidy,
        });
      }
    }

    // Business hours changes
    if (responses.businessHours?.hasChange) {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 10);
      changes.push({
        type: 'business_hours',
        description: '営業時間・営業日の変更',
        deadline: deadline.toISOString(),
        requiredDocuments: REQUIRED_DOCUMENTS.business_hours,
      });
    }

    // Capacity changes
    if (responses.capacity?.hasChange) {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 10);
      changes.push({
        type: 'capacity',
        description: '定員の変更',
        deadline: deadline.toISOString(),
        requiredDocuments: REQUIRED_DOCUMENTS.capacity,
      });
    }

    // Other changes
    if (responses.other?.hasChange) {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 10);
      const details = responses.other.details || '';
      const types: ChangeNotificationType[] = [];
      if (details.includes('事業所名')) types.push('facility_name');
      if (details.includes('住所') || details.includes('所在地')) types.push('address');
      if (details.includes('設備')) types.push('equipment');

      if (types.length === 0) {
        // Default to equipment if nothing specific matched
        changes.push({
          type: 'equipment',
          description: `その他の変更: ${details || '詳細未記入'}`,
          deadline: deadline.toISOString(),
          requiredDocuments: REQUIRED_DOCUMENTS.equipment,
        });
      } else {
        types.forEach((t) => {
          changes.push({
            type: t,
            description: `${CHANGE_NOTIFICATION_TYPE_LABELS[t]}`,
            deadline: deadline.toISOString(),
            requiredDocuments: REQUIRED_DOCUMENTS[t],
          });
        });
      }
    }

    return changes;
  }, [responses]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleComplete = useCallback(async () => {
    if (!facility?.id) return;
    setIsSaving(true);

    try {
      // 1. Save operations_review record
      const { data: userData } = await supabase.auth.getUser();

      await supabase.from('operations_reviews').upsert(
        {
          facility_id: facility.id,
          review_month: reviewMonth,
          responses,
          changes_detected: detectedChanges,
          completed_at: new Date().toISOString(),
          created_by: userData?.user?.id || null,
        },
        { onConflict: 'facility_id,review_month' }
      );

      // 2. Create change_notification records for each detected change
      for (const change of detectedChanges) {
        await createNotification(
          change.type,
          change.description,
          {},
          { reviewMonth, detectedVia: 'operations_review_wizard' }
        );
      }

      setIsComplete(true);
      onComplete?.();
    } catch (error) {
      console.error('Error saving operations review:', error);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  }, [facility?.id, reviewMonth, responses, detectedChanges, createNotification, onComplete]);

  const handleReset = useCallback(() => {
    setCurrentStepIndex(0);
    setResponses({});
    setIsComplete(false);
    setShowGuide(false);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  // Can proceed to next step?
  const canProceed = useMemo(() => {
    switch (currentStep.id) {
      case 'staff':
        return responses.staff?.hasChange !== undefined;
      case 'subsidies':
        return responses.subsidies?.hasChange !== undefined;
      case 'businessHours':
        return responses.businessHours?.hasChange !== undefined;
      case 'capacity':
        return responses.capacity?.hasChange !== undefined;
      case 'other':
        return responses.other?.hasChange !== undefined;
      case 'summary':
        return true;
      default:
        return false;
    }
  }, [currentStep.id, responses]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00c4cc]/10 flex items-center justify-center">
                <Calendar size={20} className="text-[#00c4cc]" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-gray-800">
                  {showGuide ? '変更届ガイド' : '来月の運営確認'}
                </h2>
                <p className="text-xs text-gray-500">
                  {showGuide ? '変更届に関する情報' : `${reviewMonthLabel}の変更事項を確認します`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showGuide && !isComplete && (
                <button
                  onClick={() => setShowGuide(true)}
                  className="p-2 text-gray-400 hover:text-[#00c4cc] hover:bg-[#00c4cc]/5 rounded-lg transition-colors"
                  title="変更届ガイド"
                >
                  <HelpCircle size={18} />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          {!showGuide && !isComplete && (
            <ProgressBar currentStep={currentStepIndex} totalSteps={WIZARD_STEPS.length} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showGuide ? (
            <OperationsChangeGuide onClose={() => setShowGuide(false)} />
          ) : isComplete ? (
            /* Completion Screen */
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">確認完了</h3>
              <p className="text-sm text-gray-500 mb-6">
                {reviewMonthLabel}の運営確認が完了しました。
              </p>
              {detectedChanges.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-6">
                  <p className="text-sm font-bold text-amber-800 mb-2">
                    {detectedChanges.length}件の変更届が必要です
                  </p>
                  <div className="space-y-1">
                    {detectedChanges.map((change, i) => (
                      <p key={i} className="text-xs text-amber-700 flex items-start gap-2">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        {change.description} - 期限: {new Date(change.deadline).toLocaleDateString('ja-JP')}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    変更届の管理画面に通知が作成されました。
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left mb-6">
                  <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                    <CheckCircle size={16} />
                    今月は変更届の提出は不要です
                  </p>
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 text-sm bg-[#00c4cc] text-white rounded-xl font-bold hover:bg-[#00b0b8] transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          ) : (
            /* Wizard Steps */
            <div className="min-h-[320px]">
              {/* Step Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[#00c4cc]/10 flex items-center justify-center">
                  {React.createElement(currentStep.icon, {
                    size: 16,
                    className: 'text-[#00c4cc]',
                  })}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    STEP {currentStepIndex + 1} / {WIZARD_STEPS.length}
                  </p>
                  <p className="text-sm font-bold text-gray-800">{currentStep.label}</p>
                </div>
              </div>

              {/* Step 1: Staff */}
              {currentStep.id === 'staff' && (
                <div>
                  <p className="text-base font-bold text-gray-800 mb-1">
                    来月、スタッフの増減はありますか？
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    管理者・児発管の変更は変更届が必要です
                  </p>
                  <YesNoCards
                    value={responses.staff?.hasChange ?? null}
                    onChange={(val) =>
                      setResponses((prev) => ({
                        ...prev,
                        staff: { ...prev.staff, hasChange: val },
                      }))
                    }
                  />
                  {responses.staff?.hasChange && (
                    <div className="mt-6 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                      {/* Increase or decrease */}
                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">
                          増員ですか？減員ですか？
                        </p>
                        <div className="flex gap-3">
                          {[
                            { val: 'increase' as const, label: '増員' },
                            { val: 'decrease' as const, label: '減員' },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              onClick={() =>
                                setResponses((prev) => ({
                                  ...prev,
                                  staff: { ...prev.staff!, changeType: opt.val },
                                }))
                              }
                              className={`px-5 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                                responses.staff?.changeType === opt.val
                                  ? 'border-[#00c4cc] bg-[#00c4cc]/5 text-[#00c4cc]'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Count */}
                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">何名ですか？</p>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={responses.staff?.count || ''}
                          onChange={(e) =>
                            setResponses((prev) => ({
                              ...prev,
                              staff: { ...prev.staff!, count: parseInt(e.target.value) || undefined },
                            }))
                          }
                          placeholder="人数を入力"
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                        />
                        <span className="text-sm text-gray-500 ml-2">名</span>
                      </div>

                      {/* Positions */}
                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">
                          どの職種ですか？（複数選択可）
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {STAFF_POSITIONS.map((pos) => {
                            const isSelected = responses.staff?.positions?.includes(pos);
                            const isKeyRole = pos === '管理者' || pos === '児童発達支援管理責任者';
                            return (
                              <button
                                key={pos}
                                onClick={() => {
                                  const current = responses.staff?.positions || [];
                                  const updated = isSelected
                                    ? current.filter((p) => p !== pos)
                                    : [...current, pos];
                                  setResponses((prev) => ({
                                    ...prev,
                                    staff: { ...prev.staff!, positions: updated },
                                  }));
                                }}
                                className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                                  isSelected
                                    ? isKeyRole
                                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                                      : 'border-[#00c4cc] bg-[#00c4cc]/5 text-[#00c4cc]'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {pos}
                                {isKeyRole && isSelected && (
                                  <AlertTriangle size={10} className="inline ml-1 text-amber-600" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {responses.staff?.positions?.some(
                          (p) => p === '管理者' || p === '児童発達支援管理責任者'
                        ) && (
                          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              変更届の提出が必要です
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                              管理者・児童発達支援管理責任者の変更は、変更後10日以内に届出が必要です。
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Subsidies */}
              {currentStep.id === 'subsidies' && (
                <div>
                  <p className="text-base font-bold text-gray-800 mb-1">
                    加算を新たに取得、または廃止する予定はありますか？
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    加算の追加は前月15日までに届出が必要です
                  </p>
                  <YesNoCards
                    value={responses.subsidies?.hasChange ?? null}
                    onChange={(val) =>
                      setResponses((prev) => ({
                        ...prev,
                        subsidies: { ...prev.subsidies, hasChange: val },
                      }))
                    }
                  />
                  {responses.subsidies?.hasChange && (
                    <div className="mt-6 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">
                          新規取得する加算（複数選択可）
                        </p>
                        <div className="space-y-2">
                          {SUBSIDY_OPTIONS.map((opt) => {
                            const isSelected = responses.subsidies?.additions?.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-[#00c4cc] bg-[#00c4cc]/5'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected || false}
                                  onChange={() => {
                                    const current = responses.subsidies?.additions || [];
                                    const updated = isSelected
                                      ? current.filter((id) => id !== opt.id)
                                      : [...current, opt.id];
                                    setResponses((prev) => ({
                                      ...prev,
                                      subsidies: { ...prev.subsidies!, additions: updated },
                                    }));
                                  }}
                                  className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                                />
                                <span className="text-sm text-gray-700">{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">
                          廃止する加算（複数選択可）
                        </p>
                        <div className="space-y-2">
                          {SUBSIDY_OPTIONS.map((opt) => {
                            const isSelected = responses.subsidies?.removals?.includes(opt.id);
                            return (
                              <label
                                key={`remove-${opt.id}`}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected || false}
                                  onChange={() => {
                                    const current = responses.subsidies?.removals || [];
                                    const updated = isSelected
                                      ? current.filter((id) => id !== opt.id)
                                      : [...current, opt.id];
                                    setResponses((prev) => ({
                                      ...prev,
                                      subsidies: { ...prev.subsidies!, removals: updated },
                                    }));
                                  }}
                                  className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                                />
                                <span className="text-sm text-gray-700">{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-blue-800 flex items-center gap-1">
                          <FileText size={12} />
                          届出期限について
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          加算の届出は前月15日までに提出が必要です。期限を過ぎると翌月からの適用になります。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Business Hours */}
              {currentStep.id === 'businessHours' && (
                <div>
                  <p className="text-base font-bold text-gray-800 mb-1">
                    営業時間や営業日に変更はありますか？
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    変更がある場合は施設情報設定からも変更してください
                  </p>
                  <YesNoCards
                    value={responses.businessHours?.hasChange ?? null}
                    onChange={(val) =>
                      setResponses((prev) => ({
                        ...prev,
                        businessHours: { ...prev.businessHours, hasChange: val },
                      }))
                    }
                  />
                  {responses.businessHours?.hasChange && (
                    <div className="mt-6 animate-in slide-in-from-bottom-2 duration-300">
                      {/* Current hours display */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
                        <p className="text-xs font-bold text-gray-600 mb-2">現在の営業時間</p>
                        {facilitySettings.flexibleBusinessHours ? (
                          <div className="space-y-1">
                            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                              const labels = ['日', '月', '火', '水', '木', '金', '土'];
                              const override = facilitySettings.flexibleBusinessHours?.dayOverrides?.[d];
                              const isClosed = override?.isClosed;
                              const start = override?.start || facilitySettings.flexibleBusinessHours?.default?.start || '09:00';
                              const end = override?.end || facilitySettings.flexibleBusinessHours?.default?.end || '18:00';
                              return (
                                <div key={d} className="flex items-center gap-2 text-xs">
                                  <span className="w-6 font-bold text-gray-700">{labels[d]}</span>
                                  {isClosed ? (
                                    <span className="text-gray-400">休業</span>
                                  ) : (
                                    <span className="text-gray-700">{start} - {end}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            午前: {facilitySettings.businessHours?.AM?.start || '09:00'} - {facilitySettings.businessHours?.AM?.end || '12:00'} /
                            午後: {facilitySettings.businessHours?.PM?.start || '13:00'} - {facilitySettings.businessHours?.PM?.end || '18:00'}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">変更内容の説明</p>
                        <textarea
                          value={responses.businessHours?.details || ''}
                          onChange={(e) =>
                            setResponses((prev) => ({
                              ...prev,
                              businessHours: { ...prev.businessHours!, details: e.target.value },
                            }))
                          }
                          placeholder="例: 土曜日の営業時間を9:00-15:00から9:00-13:00に変更"
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] resize-none"
                        />
                      </div>

                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-700">
                          営業時間の変更は施設情報設定の「営業・休日」タブから実際の設定も更新してください。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Capacity */}
              {currentStep.id === 'capacity' && (
                <div>
                  <p className="text-base font-bold text-gray-800 mb-1">
                    定員に変更はありますか？
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    現在の定員: 午前 {facilitySettings.capacity?.AM || 0}名 / 午後 {facilitySettings.capacity?.PM || 0}名
                  </p>
                  <YesNoCards
                    value={responses.capacity?.hasChange ?? null}
                    onChange={(val) =>
                      setResponses((prev) => ({
                        ...prev,
                        capacity: { ...prev.capacity, hasChange: val },
                      }))
                    }
                  />
                  {responses.capacity?.hasChange && (
                    <div className="mt-6 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-bold text-gray-700 block mb-2">
                            新しい午前の定員
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={responses.capacity?.newCapacityAM ?? facilitySettings.capacity?.AM ?? ''}
                              onChange={(e) =>
                                setResponses((prev) => ({
                                  ...prev,
                                  capacity: {
                                    ...prev.capacity!,
                                    newCapacityAM: parseInt(e.target.value) || undefined,
                                  },
                                }))
                              }
                              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                            />
                            <span className="text-sm text-gray-500">名</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-gray-700 block mb-2">
                            新しい午後の定員
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={responses.capacity?.newCapacityPM ?? facilitySettings.capacity?.PM ?? ''}
                              onChange={(e) =>
                                setResponses((prev) => ({
                                  ...prev,
                                  capacity: {
                                    ...prev.capacity!,
                                    newCapacityPM: parseInt(e.target.value) || undefined,
                                  },
                                }))
                              }
                              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                            />
                            <span className="text-sm text-gray-500">名</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Other */}
              {currentStep.id === 'other' && (
                <div>
                  <p className="text-base font-bold text-gray-800 mb-1">
                    事業所名、住所、設備に変更はありますか？
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    名称変更、移転、主要設備の変更など
                  </p>
                  <YesNoCards
                    value={responses.other?.hasChange ?? null}
                    onChange={(val) =>
                      setResponses((prev) => ({
                        ...prev,
                        other: { ...prev.other, hasChange: val },
                      }))
                    }
                  />
                  {responses.other?.hasChange && (
                    <div className="mt-6 animate-in slide-in-from-bottom-2 duration-300">
                      <p className="text-sm font-bold text-gray-700 mb-2">変更内容</p>
                      <textarea
                        value={responses.other?.details || ''}
                        onChange={(e) =>
                          setResponses((prev) => ({
                            ...prev,
                            other: { ...prev.other!, details: e.target.value },
                          }))
                        }
                        placeholder="例: 事業所名を変更。設備としてスヌーズレンルームを新設。"
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step 6: Summary */}
              {currentStep.id === 'summary' && (
                <div>
                  <p className="text-base font-bold text-gray-800 mb-4">
                    {reviewMonthLabel}の確認結果
                  </p>

                  {/* Changes summary */}
                  {detectedChanges.length > 0 ? (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-3">
                          <AlertTriangle size={16} />
                          変更届が必要な項目: {detectedChanges.length}件
                        </p>
                        <div className="space-y-3">
                          {detectedChanges.map((change, i) => (
                            <div
                              key={i}
                              className="bg-white rounded-lg border border-amber-200 p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-bold text-gray-800">
                                    {CHANGE_NOTIFICATION_TYPE_LABELS[change.type]}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {change.description}
                                  </p>
                                </div>
                                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                                  期限: {new Date(change.deadline).toLocaleDateString('ja-JP')}
                                </span>
                              </div>
                              <div className="mt-2">
                                <p className="text-[10px] font-bold text-gray-500 mb-1">必要書類:</p>
                                <div className="flex flex-wrap gap-1">
                                  {change.requiredDocuments.map((doc, j) => (
                                    <span
                                      key={j}
                                      className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                                    >
                                      {doc}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                      <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                      <p className="text-base font-bold text-green-800">
                        今月は変更届の提出は不要です
                      </p>
                      <p className="text-sm text-green-600 mt-1">
                        全ての項目で変更なしが確認されました。
                      </p>
                    </div>
                  )}

                  {/* Response summary */}
                  <div className="mt-6 space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">回答内容</p>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
                      {[
                        {
                          label: 'スタッフ体制',
                          value: responses.staff?.hasChange
                            ? `変更あり（${responses.staff.changeType === 'increase' ? '増員' : '減員'}${responses.staff.count ? ` ${responses.staff.count}名` : ''}${responses.staff.positions?.length ? ` - ${responses.staff.positions.join('、')}` : ''}）`
                            : '変更なし',
                          hasChange: responses.staff?.hasChange,
                        },
                        {
                          label: '加算の変更',
                          value: responses.subsidies?.hasChange
                            ? `変更あり${responses.subsidies.additions?.length ? `（追加${responses.subsidies.additions.length}件）` : ''}${responses.subsidies.removals?.length ? `（廃止${responses.subsidies.removals.length}件）` : ''}`
                            : '変更なし',
                          hasChange: responses.subsidies?.hasChange,
                        },
                        {
                          label: '営業時間・営業日',
                          value: responses.businessHours?.hasChange
                            ? `変更あり${responses.businessHours.details ? `（${responses.businessHours.details}）` : ''}`
                            : '変更なし',
                          hasChange: responses.businessHours?.hasChange,
                        },
                        {
                          label: '定員',
                          value: responses.capacity?.hasChange
                            ? `変更あり（午前: ${responses.capacity.newCapacityAM ?? '-'}名、午後: ${responses.capacity.newCapacityPM ?? '-'}名）`
                            : '変更なし',
                          hasChange: responses.capacity?.hasChange,
                        },
                        {
                          label: 'その他',
                          value: responses.other?.hasChange
                            ? `変更あり${responses.other.details ? `（${responses.other.details}）` : ''}`
                            : '変更なし',
                          hasChange: responses.other?.hasChange,
                        },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          <span
                            className={`text-xs font-bold ${
                              item.hasChange ? 'text-amber-700' : 'text-green-600'
                            }`}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!showGuide && !isComplete && (
          <div className="p-5 border-t border-gray-100 shrink-0">
            <div className="flex items-center justify-between">
              <button
                onClick={currentStepIndex === 0 ? handleClose : handleBack}
                className="flex items-center gap-1 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
              >
                <ChevronLeft size={16} />
                {currentStepIndex === 0 ? 'キャンセル' : '戻る'}
              </button>
              {currentStep.id === 'summary' ? (
                <button
                  onClick={handleComplete}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm bg-[#00c4cc] text-white rounded-xl font-bold hover:bg-[#00b0b8] transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      確認を完了する
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canProceed}
                  className="flex items-center gap-1 px-6 py-2.5 text-sm bg-[#00c4cc] text-white rounded-xl font-bold hover:bg-[#00b0b8] transition-colors disabled:opacity-30"
                >
                  次へ
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
