/**
 * 児童登録ウィザード
 * 3ステップ形式で児童情報を登録
 * ステップ1: 基本情報（必須）
 * ステップ2: 受給者証情報（任意）
 * ステップ3: 連絡先・その他（任意）
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { ChildFormData } from '@/types';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';
import { saveDraft, deleteDraft } from '@/utils/draftStorage';

// 郵便番号から住所を取得するAPI
const fetchAddressByPostalCode = async (postalCode: string): Promise<{ address: string; error?: string } | null> => {
  const cleanPostalCode = postalCode.replace(/-/g, '');
  if (cleanPostalCode.length !== 7) return null;

  try {
    const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanPostalCode}`);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        address: `${result.address1}${result.address2}${result.address3}`,
      };
    }
    return { address: '', error: '該当する住所が見つかりませんでした' };
  } catch {
    return { address: '', error: '住所の取得に失敗しました' };
  }
};

type WizardStep = 'basic' | 'certificate' | 'contact';

type Props = {
  onComplete: (data: ChildFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<ChildFormData>;
  mode: 'create' | 'edit';
};

const steps: { id: WizardStep; label: string; description: string }[] = [
  { id: 'basic', label: '基本情報', description: '児童名・生年月日（必須）' },
  { id: 'certificate', label: '受給者証', description: '任意' },
  { id: 'contact', label: '連絡先等', description: '任意' },
];

const initialFormData: ChildFormData & { postalCode?: string } = {
  name: '',
  nameKana: '',
  age: undefined,
  birthDate: '',
  guardianName: '',
  guardianNameKana: '',
  guardianRelationship: '',
  beneficiaryNumber: '',
  grantDays: undefined,
  contractDays: undefined,
  postalCode: '',
  address: '',
  phone: '',
  email: '',
  doctorName: '',
  doctorClinic: '',
  schoolName: '',
  pattern: '',
  patternDays: [],
  patternTimeSlots: {},
  needsPickup: false,
  needsDropoff: false,
  pickupLocation: '',
  dropoffLocation: '',
  characteristics: '',
  contractStatus: 'active',
};

export const ChildRegistrationWizard: React.FC<Props> = ({
  onComplete,
  onCancel,
  initialData,
  mode,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [formData, setFormData] = useState<ChildFormData & { postalCode?: string }>({
    ...initialFormData,
    ...initialData,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // 生年月日から年齢を自動計算して契約終了日も設定
  useEffect(() => {
    if (formData.birthDate) {
      const ageInfo = calculateAgeWithMonths(formData.birthDate);

      // 利用終了日を計算（満6歳に達した日以後の最初の3月31日まで）
      const birth = new Date(formData.birthDate + 'T00:00:00');
      const sixYearsOldDate = new Date(birth);
      sixYearsOldDate.setFullYear(birth.getFullYear() + 6);

      const sixYearsOldYear = sixYearsOldDate.getFullYear();
      const sixYearsOldMonth = sixYearsOldDate.getMonth() + 1;
      const sixYearsOldDay = sixYearsOldDate.getDate();

      let endYear: number;
      if (sixYearsOldMonth < 4 || (sixYearsOldMonth === 4 && sixYearsOldDay === 1)) {
        endYear = sixYearsOldYear;
      } else {
        endYear = sixYearsOldYear + 1;
      }

      setFormData((prev) => ({
        ...prev,
        age: ageInfo.years,
        contractEndDate: `${endYear}-03-31`,
      }));
    }
  }, [formData.birthDate]);

  // 郵便番号から住所を取得
  const handlePostalCodeChange = useCallback(async (value: string) => {
    const cleanValue = value.replace(/-/g, '');
    setFormData(prev => ({ ...prev, postalCode: value }));
    setPostalCodeError(null);

    if (cleanValue.length === 7) {
      setIsLoadingAddress(true);
      const result = await fetchAddressByPostalCode(cleanValue);
      setIsLoadingAddress(false);

      if (result) {
        if (result.address) {
          setFormData(prev => ({ ...prev, address: result.address }));
        }
        if (result.error) {
          setPostalCodeError(result.error);
        }
      }
    }
  }, []);

  // バリデーション
  const validateStep = (step: WizardStep): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 'basic') {
      if (!formData.name.trim()) {
        newErrors.name = '児童名を入力してください';
      }
      if (!formData.birthDate) {
        newErrors.birthDate = '生年月日を入力してください';
      }
      // メールアドレスの必須チェック
      if (!formData.email?.trim()) {
        newErrors.email = '保護者メールアドレスを入力してください';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'メールアドレスの形式が正しくありません';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 次のステップへ
  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  // 前のステップへ
  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  // スキップ
  const handleSkip = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  // 下書き保存
  const handleSaveDraft = () => {
    if (formData.name) {
      saveDraft(formData);
      alert('下書きを保存しました');
    } else {
      alert('児童名を入力してから下書き保存してください');
    }
  };

  // 登録完了
  const handleSubmit = async () => {
    // 最終バリデーション（基本情報のみ必須：名前、生年月日、メール）
    if (!formData.name.trim() || !formData.birthDate || !formData.email?.trim()) {
      setCurrentStep('basic');
      validateStep('basic');
      return;
    }

    setIsSubmitting(true);
    try {
      await onComplete(formData);
      // 下書きを削除
      if (formData.name) {
        deleteDraft(formData.name);
      }
    } catch {
      alert('登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ステップ1: 基本情報
  const renderBasicStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">
            児童氏名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full border rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc] ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="山田 太郎"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">フリガナ</label>
          <input
            type="text"
            value={formData.nameKana || ''}
            onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            placeholder="ヤマダ タロウ"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">
            生年月日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.birthDate || ''}
            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            className={`w-full border rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc] ${
              errors.birthDate ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate}</p>}
          {formData.birthDate && (
            <p className="text-xs text-gray-500 mt-1">
              年齢: {calculateAgeWithMonths(formData.birthDate).display}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">利用終了予定日</label>
          <input
            type="date"
            value={formData.contractEndDate || ''}
            onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
          />
          <p className="text-xs text-gray-400 mt-1">※生年月日から自動計算されます</p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-4">
        <h4 className="font-bold text-sm text-gray-700 mb-3">保護者情報</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">保護者名</label>
            <input
              type="text"
              value={formData.guardianName || ''}
              onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
              placeholder="山田 花子"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">フリガナ</label>
            <input
              type="text"
              value={formData.guardianNameKana || ''}
              onChange={(e) => setFormData({ ...formData, guardianNameKana: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
              placeholder="ヤマダ ハナコ"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">続柄</label>
            <select
              value={formData.guardianRelationship || ''}
              onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            >
              <option value="">選択してください</option>
              <option value="母">母</option>
              <option value="父">父</option>
              <option value="祖母">祖母</option>
              <option value="祖父">祖父</option>
              <option value="その他">その他</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-bold text-gray-500 mb-1">
            保護者メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={`w-full border rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc] ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="example@email.com"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          <p className="text-xs text-gray-400 mt-1">
            ※ 保護者への招待メール送信に使用します
          </p>
        </div>
      </div>
    </div>
  );

  // ステップ2: 受給者証情報
  const renderCertificateStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-4">
        受給者証情報は後から追加・編集できます。スキップして先に進むことも可能です。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">受給者証番号</label>
          <input
            type="text"
            value={formData.beneficiaryNumber || ''}
            onChange={(e) => setFormData({ ...formData, beneficiaryNumber: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            placeholder="0123456789"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">支給日数</label>
          <input
            type="number"
            value={formData.grantDays || ''}
            onChange={(e) =>
              setFormData({ ...formData, grantDays: e.target.value ? parseInt(e.target.value) : undefined })
            }
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            placeholder="23"
            min="0"
            max="31"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">契約日数（月）</label>
        <input
          type="number"
          value={formData.contractDays || ''}
          onChange={(e) =>
            setFormData({ ...formData, contractDays: e.target.value ? parseInt(e.target.value) : undefined })
          }
          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
          placeholder="10"
          min="0"
          max="31"
        />
      </div>
    </div>
  );

  // ステップ3: 連絡先・その他
  const renderContactStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-4">
        連絡先情報は後から追加・編集できます。スキップして先に進むことも可能です。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">郵便番号</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={formData.postalCode || ''}
              onChange={(e) => handlePostalCodeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
              placeholder="1234567 または 123-4567"
              maxLength={8}
            />
            {isLoadingAddress && (
              <Loader2 className="w-5 h-5 text-[#00c4cc] animate-spin" />
            )}
          </div>
          {postalCodeError && (
            <p className="text-amber-600 text-xs mt-1">{postalCodeError}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">※ 7桁入力で住所を自動入力</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">電話番号</label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            placeholder="090-1234-5678"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-gray-500 mb-1">住所</label>
          <input
            type="text"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            placeholder="東京都渋谷区..."
          />
          <p className="text-xs text-gray-400 mt-1">※ 郵便番号から自動入力後、番地等を追記してください</p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-4">
        <h4 className="font-bold text-sm text-gray-700 mb-3">その他の情報</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">かかりつけ医</label>
            <input
              type="text"
              value={formData.doctorName || ''}
              onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">医療機関名</label>
            <input
              type="text"
              value={formData.doctorClinic || ''}
              onChange={(e) => setFormData({ ...formData, doctorClinic: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">通園先・学校名</label>
            <input
              type="text"
              value={formData.schoolName || ''}
              onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-bold text-gray-500 mb-1">特性・備考</label>
          <textarea
            value={formData.characteristics || ''}
            onChange={(e) => setFormData({ ...formData, characteristics: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
            rows={3}
            placeholder="アレルギー、服薬情報、配慮事項など"
          />
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'basic':
        return renderBasicStep();
      case 'certificate':
        return renderCertificateStep();
      case 'contact':
        return renderContactStep();
      default:
        return null;
    }
  };

  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const canSkip = currentStep !== 'basic'; // 基本情報以外はスキップ可能

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {mode === 'create' ? '児童登録' : '児童情報編集'}
            </h2>
            <p className="text-sm text-gray-500">
              ステップ {currentStepIndex + 1}/{steps.length}: {steps[currentStepIndex].label}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* プログレスバー */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index < currentStepIndex
                      ? 'bg-[#00c4cc] text-white'
                      : index === currentStepIndex
                      ? 'bg-[#00c4cc] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index < currentStepIndex ? <Check size={16} /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 ${
                      index < currentStepIndex ? 'bg-[#00c4cc]' : 'bg-gray-200'
                    }`}
                    style={{ width: '60px' }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            {steps.map((step) => (
              <span key={step.id} className="text-center" style={{ width: '80px' }}>
                {step.label}
              </span>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">{renderCurrentStep()}</div>

        {/* フッター */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex items-center space-x-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ChevronLeft size={16} />
                <span>戻る</span>
              </button>
            )}
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              下書き保存
            </button>
          </div>
          <div className="flex items-center space-x-2">
            {canSkip && !isLastStep && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                スキップ
              </button>
            )}
            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center space-x-1 px-6 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={16} />
                <span>{isSubmitting ? '登録中...' : '登録する'}</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center space-x-1 px-6 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors"
              >
                <span>次へ</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildRegistrationWizard;
