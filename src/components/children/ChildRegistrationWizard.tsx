/**
 * 児童登録ウィザード
 * 4ステップ形式で児童情報を登録
 * ステップ1: 基本情報（必須）
 * ステップ2: 受給者証情報（任意）
 * ステップ3: 保護者情報（任意）
 * ステップ4: 確認
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Loader2, User, FileText, Shield, ClipboardCheck, Save, Info } from 'lucide-react';
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

type WizardStep = 'basic' | 'certificate' | 'contact' | 'confirm';

type Props = {
  onComplete: (data: ChildFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<ChildFormData>;
  mode: 'create' | 'edit';
};

const steps: { id: WizardStep; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'basic', label: '基本情報', description: '児童名・生年月日', icon: User },
  { id: 'certificate', label: '受給者証情報', description: '受給者証番号・支給日数', icon: Shield },
  { id: 'contact', label: '保護者情報', description: '連絡先・住所', icon: FileText },
  { id: 'confirm', label: '確認', description: '入力内容の確認', icon: ClipboardCheck },
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

  // 共通の入力フィールドスタイル
  const inputClass = (hasError?: boolean) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc] transition-colors ${
      hasError ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-gray-300'
    }`;

  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const helpClass = 'text-xs text-gray-400 mt-1';
  const sectionClass = 'bg-gray-50/50 rounded-xl p-4 border border-gray-100';

  // ステップ1: 基本情報
  const renderBasicStep = () => (
    <div className="space-y-6">
      {/* ヒントカード */}
      <div className="flex items-start gap-3 bg-[#00c4cc]/5 border border-[#00c4cc]/20 rounded-xl p-4">
        <Info size={18} className="text-[#00c4cc] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">児童の基本情報を入力してください</p>
          <p className="text-xs text-gray-500 mt-0.5">児童名、生年月日、保護者メールアドレスは必須項目です。</p>
        </div>
      </div>

      {/* 児童情報 */}
      <div className={sectionClass}>
        <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
          <User size={16} className="text-[#00c4cc]" />
          児童情報
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              児童氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass(!!errors.name)}
              placeholder="例: 山田 太郎"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><X size={12} />{errors.name}</p>}
          </div>
          <div>
            <label className={labelClass}>フリガナ</label>
            <input
              type="text"
              value={formData.nameKana || ''}
              onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
              className={inputClass()}
              placeholder="例: ヤマダ タロウ"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelClass}>
              生年月日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.birthDate || ''}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className={inputClass(!!errors.birthDate)}
            />
            {errors.birthDate && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><X size={12} />{errors.birthDate}</p>}
            {formData.birthDate && (
              <p className="text-xs text-[#00c4cc] font-medium mt-1.5">
                現在 {calculateAgeWithMonths(formData.birthDate).display}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>利用終了予定日</label>
            <input
              type="date"
              value={formData.contractEndDate || ''}
              onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
              className={inputClass()}
            />
            <p className={helpClass}>生年月日から自動計算されます（満6歳後の3月31日）</p>
          </div>
        </div>
      </div>

      {/* 保護者連絡先（必須） */}
      <div className={sectionClass}>
        <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-[#00c4cc]" />
          保護者連絡先
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>保護者名</label>
            <input
              type="text"
              value={formData.guardianName || ''}
              onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
              className={inputClass()}
              placeholder="例: 山田 花子"
            />
          </div>
          <div>
            <label className={labelClass}>フリガナ</label>
            <input
              type="text"
              value={formData.guardianNameKana || ''}
              onChange={(e) => setFormData({ ...formData, guardianNameKana: e.target.value })}
              className={inputClass()}
              placeholder="例: ヤマダ ハナコ"
            />
          </div>
          <div>
            <label className={labelClass}>続柄</label>
            <select
              value={formData.guardianRelationship || ''}
              onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
              className={inputClass()}
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
          <label className={labelClass}>
            保護者メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={inputClass(!!errors.email)}
            placeholder="例: parent@example.com"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><X size={12} />{errors.email}</p>}
          <p className={helpClass}>保護者への招待メール送信に使用します。正確に入力してください。</p>
        </div>
      </div>
    </div>
  );

  // ステップ2: 受給者証情報
  const renderCertificateStep = () => (
    <div className="space-y-6">
      {/* ヒントカード */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">受給者証情報は後から追加・編集できます</p>
          <p className="text-xs text-gray-500 mt-0.5">お手元に受給者証がない場合は「スキップ」で先に進めます。</p>
        </div>
      </div>

      <div className={sectionClass}>
        <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
          <Shield size={16} className="text-[#00c4cc]" />
          受給者証
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>受給者証番号</label>
            <input
              type="text"
              value={formData.beneficiaryNumber || ''}
              onChange={(e) => setFormData({ ...formData, beneficiaryNumber: e.target.value })}
              className={`${inputClass()} font-mono`}
              placeholder="例: 0123456789（10桁）"
            />
            <p className={helpClass}>受給者証に記載の10桁の番号</p>
          </div>
          <div>
            <label className={labelClass}>支給日数</label>
            <input
              type="number"
              value={formData.grantDays || ''}
              onChange={(e) =>
                setFormData({ ...formData, grantDays: e.target.value ? parseInt(e.target.value) : undefined })
              }
              className={inputClass()}
              placeholder="例: 23"
              min="0"
              max="31"
            />
            <p className={helpClass}>受給者証に記載の月あたり支給日数</p>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>契約日数（月あたり）</label>
          <input
            type="number"
            value={formData.contractDays || ''}
            onChange={(e) =>
              setFormData({ ...formData, contractDays: e.target.value ? parseInt(e.target.value) : undefined })
            }
            className={inputClass()}
            placeholder="例: 10"
            min="0"
            max="31"
          />
          <p className={helpClass}>施設との契約で定めた月あたりの利用日数</p>
        </div>
      </div>
    </div>
  );

  // ステップ3: 連絡先・その他
  const renderContactStep = () => (
    <div className="space-y-6">
      {/* ヒントカード */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">連絡先情報は後から追加・編集できます</p>
          <p className="text-xs text-gray-500 mt-0.5">すべて任意項目です。「スキップ」で先に進めます。</p>
        </div>
      </div>

      {/* 住所・電話 */}
      <div className={sectionClass}>
        <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-[#00c4cc]" />
          住所・電話番号
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>郵便番号</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.postalCode || ''}
                onChange={(e) => handlePostalCodeChange(e.target.value)}
                className={inputClass()}
                placeholder="例: 1234567 または 123-4567"
                maxLength={8}
              />
              {isLoadingAddress && (
                <Loader2 className="w-5 h-5 text-[#00c4cc] animate-spin shrink-0" />
              )}
            </div>
            {postalCodeError && (
              <p className="text-amber-600 text-xs mt-1.5">{postalCodeError}</p>
            )}
            <p className={helpClass}>7桁入力で住所を自動入力します</p>
          </div>
          <div>
            <label className={labelClass}>電話番号</label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={inputClass()}
              placeholder="例: 090-1234-5678"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>住所</label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={inputClass()}
              placeholder="例: 東京都渋谷区..."
            />
            <p className={helpClass}>郵便番号から自動入力後、番地等を追記してください</p>
          </div>
        </div>
      </div>

      {/* その他の情報 */}
      <div className={sectionClass}>
        <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
          <Info size={16} className="text-[#00c4cc]" />
          その他の情報
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>かかりつけ医</label>
            <input
              type="text"
              value={formData.doctorName || ''}
              onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
              className={inputClass()}
              placeholder="例: 田中 医師"
            />
          </div>
          <div>
            <label className={labelClass}>医療機関名</label>
            <input
              type="text"
              value={formData.doctorClinic || ''}
              onChange={(e) => setFormData({ ...formData, doctorClinic: e.target.value })}
              className={inputClass()}
              placeholder="例: ○○クリニック"
            />
          </div>
          <div>
            <label className={labelClass}>通園先・学校名</label>
            <input
              type="text"
              value={formData.schoolName || ''}
              onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
              className={inputClass()}
              placeholder="例: ○○幼稚園"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>特性・備考</label>
          <textarea
            value={formData.characteristics || ''}
            onChange={(e) => setFormData({ ...formData, characteristics: e.target.value })}
            className={inputClass()}
            rows={3}
            placeholder="例: アレルギー、服薬情報、配慮事項など"
          />
        </div>
      </div>
    </div>
  );

  // ステップ4: 確認
  const renderConfirmStep = () => {
    const ConfirmItem = ({ label, value }: { label: string; value: string | number | undefined | null }) => (
      <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-500 shrink-0 mr-4">{label}</span>
        <span className="text-sm font-medium text-gray-800 text-right">{value || '-'}</span>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* 成功ヒント */}
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <Check size={18} className="text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">入力内容をご確認ください</p>
            <p className="text-xs text-gray-500 mt-0.5">問題がなければ「登録する」ボタンで登録を完了できます。修正がある場合は「戻る」で各ステップに戻れます。</p>
          </div>
        </div>

        {/* 基本情報 */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <User size={16} className="text-[#00c4cc]" />
              基本情報
            </h4>
            <button
              onClick={() => setCurrentStep('basic')}
              className="text-xs text-[#00c4cc] hover:text-[#00b0b8] font-medium"
            >
              編集する
            </button>
          </div>
          <ConfirmItem label="児童氏名" value={formData.name} />
          <ConfirmItem label="フリガナ" value={formData.nameKana} />
          <ConfirmItem label="生年月日" value={formData.birthDate} />
          <ConfirmItem label="年齢" value={formData.birthDate ? calculateAgeWithMonths(formData.birthDate).display : undefined} />
          <ConfirmItem label="利用終了予定日" value={formData.contractEndDate} />
        </div>

        {/* 保護者情報 */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <FileText size={16} className="text-[#00c4cc]" />
              保護者情報
            </h4>
            <button
              onClick={() => setCurrentStep('basic')}
              className="text-xs text-[#00c4cc] hover:text-[#00b0b8] font-medium"
            >
              編集する
            </button>
          </div>
          <ConfirmItem label="保護者名" value={formData.guardianName} />
          <ConfirmItem label="フリガナ" value={formData.guardianNameKana} />
          <ConfirmItem label="続柄" value={formData.guardianRelationship} />
          <ConfirmItem label="メールアドレス" value={formData.email} />
        </div>

        {/* 受給者証情報 */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <Shield size={16} className="text-[#00c4cc]" />
              受給者証情報
            </h4>
            <button
              onClick={() => setCurrentStep('certificate')}
              className="text-xs text-[#00c4cc] hover:text-[#00b0b8] font-medium"
            >
              編集する
            </button>
          </div>
          <ConfirmItem label="受給者証番号" value={formData.beneficiaryNumber} />
          <ConfirmItem label="支給日数" value={formData.grantDays ? `${formData.grantDays}日` : undefined} />
          <ConfirmItem label="契約日数" value={formData.contractDays ? `${formData.contractDays}日` : undefined} />
        </div>

        {/* 連絡先・その他 */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <Info size={16} className="text-[#00c4cc]" />
              連絡先・その他
            </h4>
            <button
              onClick={() => setCurrentStep('contact')}
              className="text-xs text-[#00c4cc] hover:text-[#00b0b8] font-medium"
            >
              編集する
            </button>
          </div>
          <ConfirmItem label="郵便番号" value={formData.postalCode} />
          <ConfirmItem label="住所" value={formData.address} />
          <ConfirmItem label="電話番号" value={formData.phone} />
          <ConfirmItem label="かかりつけ医" value={formData.doctorName} />
          <ConfirmItem label="医療機関名" value={formData.doctorClinic} />
          <ConfirmItem label="通園先・学校名" value={formData.schoolName} />
          {formData.characteristics && <ConfirmItem label="特性・備考" value={formData.characteristics} />}
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'basic':
        return renderBasicStep();
      case 'certificate':
        return renderCertificateStep();
      case 'contact':
        return renderContactStep();
      case 'confirm':
        return renderConfirmStep();
      default:
        return null;
    }
  };

  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const canSkip = currentStep === 'certificate' || currentStep === 'contact';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {mode === 'create' ? '児童を新規登録' : '児童情報を編集'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              ステップ {currentStepIndex + 1} / {steps.length}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* プログレスバー */}
        <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center flex-1">
                    <button
                      onClick={() => {
                        // Only allow going back to completed steps or current
                        if (index <= currentStepIndex) {
                          setCurrentStep(step.id);
                        }
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-[#00c4cc] text-white shadow-sm cursor-pointer hover:bg-[#00b0b8]'
                          : isCurrent
                          ? 'bg-[#00c4cc] text-white shadow-md ring-4 ring-[#00c4cc]/20'
                          : 'bg-gray-200 text-gray-400'
                      } ${index <= currentStepIndex ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {isCompleted ? <Check size={18} /> : <StepIcon size={18} />}
                    </button>
                    <span className={`text-xs mt-2 font-medium text-center ${
                      isCurrent ? 'text-[#00c4cc]' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-shrink-0 w-8 md:w-12 h-0.5 mt-[-16px] mx-1">
                      <div
                        className={`h-full rounded-full transition-colors ${
                          index < currentStepIndex ? 'bg-[#00c4cc]' : 'bg-gray-200'
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{renderCurrentStep()}</div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                <ChevronLeft size={16} />
                戻る
              </button>
            )}
            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors rounded-lg hover:bg-gray-100"
            >
              <Save size={14} />
              下書き保存
            </button>
          </div>
          <div className="flex items-center gap-2">
            {canSkip && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors rounded-lg hover:bg-gray-100"
              >
                スキップ
              </button>
            )}
            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    登録中...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    登録する
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors font-bold text-sm shadow-sm"
              >
                次へ
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
