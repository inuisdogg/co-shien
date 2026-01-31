'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Upload,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useExpertProfile } from '@/hooks/useExpertProfile';
import {
  ExpertProfession,
  EXPERT_PROFESSION_LABELS,
  EXPERT_PROFESSION_ICONS,
  COMMON_SPECIALTY_TAGS,
  ExpertProfileFormData,
  DEFAULT_EXPERT_THEME,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { number: 1, title: '職種選択' },
  { number: 2, title: 'プロフィール' },
  { number: 3, title: '資格証明' },
  { number: 4, title: '料金設定' },
];

export default function ExpertRegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームデータ
  const [formData, setFormData] = useState<ExpertProfileFormData>({
    displayName: '',
    profession: 'PT',
    specialty: [],
    introduction: '',
    experienceYears: undefined,
    qualificationDocuments: [],
    pageTheme: DEFAULT_EXPERT_THEME,
    pricePerMessage: 300,
    freeFirstMessage: true,
    isPublic: false,
    isAcceptingConsultations: true,
  });

  const { profile, isLoading: profileLoading, createProfile } = useExpertProfile(user?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.userType !== 'staff') {
          router.push('/career');
          return;
        }
        setUser(parsed);
        setFormData(prev => ({
          ...prev,
          displayName: parsed.name || '',
        }));
      } catch (e) {
        console.error('Failed to parse user:', e);
        router.push('/career/login');
      }
    } else {
      router.push('/career/login');
    }
  }, [router]);

  // 既にExpert登録済みの場合はダッシュボードへ
  useEffect(() => {
    if (!profileLoading && profile) {
      router.push('/expert/dashboard');
    }
  }, [profile, profileLoading, router]);

  const updateFormData = (updates: Partial<ExpertProfileFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const toggleSpecialty = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialty: prev.specialty.includes(specialty)
        ? prev.specialty.filter(s => s !== specialty)
        : [...prev.specialty, specialty],
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setError(null);

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        setError('ファイルサイズは5MB以下にしてください');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('expert-documents')
        .upload(fileName, file);

      if (uploadError) {
        setError('ファイルのアップロードに失敗しました');
        console.error(uploadError);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('expert-documents')
        .getPublicUrl(fileName);

      setFormData(prev => ({
        ...prev,
        qualificationDocuments: [...prev.qualificationDocuments, publicUrl],
      }));
    }
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      qualificationDocuments: prev.qualificationDocuments.filter((_, i) => i !== index),
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!formData.profession;
      case 2:
        return formData.displayName.trim().length > 0;
      case 3:
        return true; // 資格証明は任意
      case 4:
        return formData.pricePerMessage > 0;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const newProfile = await createProfile(formData);
      if (newProfile) {
        router.push('/expert/dashboard');
      } else {
        setError('プロフィールの作成に失敗しました');
      }
    } catch (err) {
      console.error('Error creating profile:', err);
      setError('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">Expert登録</span>
            </div>
          </div>
        </div>
      </header>

      {/* ステップインジケーター */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      currentStep > step.number
                        ? 'bg-emerald-500 text-white'
                        : currentStep === step.number
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className="text-xs text-gray-500 mt-1 hidden sm:block">
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-full h-0.5 mx-2 ${
                      currentStep > step.number ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                    style={{ minWidth: '40px' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: 職種選択 */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">職種を選択</h2>
            <p className="text-gray-600 mb-6">
              あなたの専門職種を選んでください
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(EXPERT_PROFESSION_LABELS) as ExpertProfession[]).map((profession) => (
                <button
                  key={profession}
                  onClick={() => updateFormData({ profession })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.profession === profession
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">
                    {profession === 'PT' && '🏃'}
                    {profession === 'OT' && '✋'}
                    {profession === 'ST' && '💬'}
                    {profession === 'psychologist' && '🧠'}
                    {profession === 'nursery_teacher' && '👶'}
                    {profession === 'nurse' && '💊'}
                    {profession === 'dietitian' && '🍎'}
                    {profession === 'social_worker' && '🤝'}
                  </div>
                  <div className="font-medium text-gray-900">
                    {EXPERT_PROFESSION_LABELS[profession]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: プロフィール */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">プロフィール</h2>
            <p className="text-gray-600 mb-6">
              相談者に表示される情報を入力してください
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => updateFormData({ displayName: e.target.value })}
                  placeholder="田中 太郎"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  経験年数
                </label>
                <input
                  type="number"
                  value={formData.experienceYears || ''}
                  onChange={(e) => updateFormData({ experienceYears: parseInt(e.target.value) || undefined })}
                  placeholder="5"
                  min="0"
                  max="50"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  自己紹介
                </label>
                <textarea
                  value={formData.introduction || ''}
                  onChange={(e) => updateFormData({ introduction: e.target.value })}
                  placeholder="経歴や得意分野、相談者へのメッセージなどを書いてください"
                  rows={4}
                  maxLength={2000}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {formData.introduction?.length || 0}/2000
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  専門分野（複数選択可）
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SPECIALTY_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleSpecialty(tag)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        formData.specialty.includes(tag)
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 資格証明 */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">資格証明書</h2>
            <p className="text-gray-600 mb-6">
              資格を証明する書類をアップロードしてください（任意）
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>運営による確認について：</strong><br />
                アップロードされた資格証明書は運営チームが確認し、認証後に「認証済み」バッジが表示されます。
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <input
                type="file"
                id="document-upload"
                onChange={handleFileUpload}
                accept="image/*,.pdf"
                multiple
                className="hidden"
              />
              <label
                htmlFor="document-upload"
                className="cursor-pointer"
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 font-medium">
                  クリックしてファイルを選択
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  画像またはPDF（最大5MB）
                </p>
              </label>
            </div>

            {formData.qualificationDocuments.length > 0 && (
              <div className="mt-4 space-y-2">
                {formData.qualificationDocuments.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm text-gray-600 truncate flex-1">
                      書類 {index + 1}
                    </span>
                    <button
                      onClick={() => removeDocument(index)}
                      className="text-red-500 hover:text-red-600 text-sm"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: 料金設定 */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">料金設定</h2>
            <p className="text-gray-600 mb-6">
              相談料金を設定してください
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  1回あたりの相談料金（ポイント）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.pricePerMessage}
                    onChange={(e) => updateFormData({ pricePerMessage: parseInt(e.target.value) || 0 })}
                    min="100"
                    max="10000"
                    step="50"
                    className="w-32 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <span className="text-gray-600">pt / 回</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  推奨: 200〜500pt（100円〜500円相当）
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">初回相談無料</p>
                  <p className="text-sm text-gray-500">
                    初めての相談者には無料で返信できます
                  </p>
                </div>
                <button
                  onClick={() => updateFormData({ freeFirstMessage: !formData.freeFirstMessage })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    formData.freeFirstMessage ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      formData.freeFirstMessage ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-800">
                  <strong>料金について：</strong><br />
                  売上の20%がプラットフォーム手数料として差し引かれます。
                  残りは毎月末締めで翌月15日に振り込まれます。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ナビゲーションボタン */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep((currentStep - 1) as Step)}
              className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              戻る
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep((currentStep + 1) as Step)}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-6 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              次へ
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  登録中...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  登録する
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
