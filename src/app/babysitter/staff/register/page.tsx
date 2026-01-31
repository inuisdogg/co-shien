'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Baby,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  User,
  Briefcase,
  MapPin,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSitterProfile } from '@/hooks/useSitter';
import {
  SitterProfession,
  SITTER_PROFESSION_LABELS,
  SitterProfileFormData,
} from '@/types/sitter';

const TOKYO_AREAS = [
  '港区', '渋谷区', '新宿区', '品川区', '目黒区', '世田谷区', '大田区',
  '中央区', '千代田区', '文京区', '台東区', '墨田区', '江東区',
  '中野区', '杉並区', '豊島区', '北区', '荒川区', '板橋区', '練馬区',
  '足立区', '葛飾区', '江戸川区',
];

const SPECIALTIES = [
  '発語遅滞', '運動発達', 'ダウン症対応', '自閉症スペクトラム', '感覚統合',
  '言語訓練', '食事支援', '社会性発達', '認知発達', 'ADL支援',
  '医療的ケア児対応', '重症心身障害児対応',
];

type Step = 'basic' | 'profession' | 'area' | 'pricing' | 'confirm';

export default function SitterRegisterPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { createProfile, isLoading: profileLoading } = useSitterProfile(user?.id);

  const [step, setStep] = useState<Step>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SitterProfileFormData>({
    displayName: '',
    introduction: '',
    professions: [],
    specialty: [],
    hourlyRate: 3000,
    minimumHours: 2,
    serviceAreas: [],
    canTravel: true,
    travelFee: 500,
    isTokyoCertified: false,
    isPublic: false,
    isAcceptingBookings: true,
  });

  const steps: Step[] = ['basic', 'profession', 'area', 'pricing', 'confirm'];
  const currentIndex = steps.indexOf(step);

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await createProfile(formData);
      if (result) {
        router.push('/sitter/staff');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProfession = (prof: SitterProfession) => {
    setFormData(prev => ({
      ...prev,
      professions: prev.professions.includes(prof)
        ? prev.professions.filter(p => p !== prof)
        : [...prev.professions, prof],
    }));
  };

  const toggleSpecialty = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specialty: prev.specialty.includes(spec)
        ? prev.specialty.filter(s => s !== spec)
        : [...prev.specialty, spec],
    }));
  };

  const toggleArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      serviceAreas: prev.serviceAreas.includes(area)
        ? prev.serviceAreas.filter(a => a !== area)
        : [...prev.serviceAreas, area],
    }));
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Baby className="w-16 h-16 text-pink-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-800 mb-2">ログインが必要です</h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          シッター登録にはログインが必要です
        </p>
        <Link
          href="/login"
          className="bg-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-pink-600 transition-colors"
        >
          ログイン
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-pink-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-500 rounded-xl flex items-center justify-center">
              <Baby className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold">シッター登録</h1>
          </div>
        </div>
      </header>

      {/* プログレスバー */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                i <= currentIndex ? 'bg-pink-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          {currentIndex + 1} / {steps.length}
        </p>
      </div>

      <main className="max-w-md mx-auto px-4 py-6">
        {/* 基本情報 */}
        {step === 'basic' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-pink-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">基本情報</h2>
              <p className="text-sm text-slate-500 mt-2">
                保護者に表示される情報を入力してください
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  表示名 <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                  placeholder="例: 小林 亜希"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  自己紹介
                </label>
                <textarea
                  value={formData.introduction}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, introduction: e.target.value }))
                  }
                  placeholder="お子様への対応で得意なことや、シッティングのスタイルなどをご記入ください"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={formData.isTokyoCertified}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isTokyoCertified: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded border-slate-300 text-pink-500 focus:ring-pink-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700">
                    東京都ベビーシッター利用支援事業 研修修了済み
                  </p>
                  <p className="text-[10px] text-slate-500">
                    チェックすると補助金対象シッターとして表示されます
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 資格・専門 */}
        {step === 'profession' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-pink-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">資格・専門分野</h2>
              <p className="text-sm text-slate-500 mt-2">
                保有資格と得意分野を選択してください
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-3">
                  保有資格（複数選択可）
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SITTER_PROFESSION_LABELS) as SitterProfession[]).map(
                    (prof) => (
                      <button
                        key={prof}
                        onClick={() => toggleProfession(prof)}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                          formData.professions.includes(prof)
                            ? 'bg-pink-500 text-white border-pink-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
                        }`}
                      >
                        {SITTER_PROFESSION_LABELS[prof]}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-3">
                  得意分野（複数選択可）
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((spec) => (
                    <button
                      key={spec}
                      onClick={() => toggleSpecialty(spec)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        formData.specialty.includes(spec)
                          ? 'bg-pink-100 text-pink-600 border border-pink-300'
                          : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-pink-50'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 対応エリア */}
        {step === 'area' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-pink-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">対応エリア</h2>
              <p className="text-sm text-slate-500 mt-2">
                シッティング可能なエリアを選択してください
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-3">
                  東京都23区
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TOKYO_AREAS.map((area) => (
                    <button
                      key={area}
                      onClick={() => toggleArea(area)}
                      className={`p-2 rounded-lg border text-xs font-bold transition-all ${
                        formData.serviceAreas.includes(area)
                          ? 'bg-pink-500 text-white border-pink-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={formData.canTravel}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, canTravel: e.target.checked }))
                  }
                  className="w-5 h-5 rounded border-slate-300 text-pink-500 focus:ring-pink-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700">出張対応可能</p>
                  <p className="text-[10px] text-slate-500">
                    上記エリア外でもご相談ください
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 料金設定 */}
        {step === 'pricing' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-pink-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">料金設定</h2>
              <p className="text-sm text-slate-500 mt-2">シッティング料金を設定してください</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  時給（税込）
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hourlyRate: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none"
                  />
                </div>
                {formData.isTokyoCertified && (
                  <p className="text-[10px] text-emerald-600 mt-1">
                    補助金適用後: ¥{Math.max(0, formData.hourlyRate - 2500).toLocaleString()}/h
                    （保護者実質負担）
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  最低利用時間
                </label>
                <select
                  value={formData.minimumHours}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      minimumHours: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none"
                >
                  <option value={1}>1時間〜</option>
                  <option value={2}>2時間〜</option>
                  <option value={3}>3時間〜</option>
                </select>
              </div>

              {formData.canTravel && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">
                    交通費
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      ¥
                    </span>
                    <input
                      type="number"
                      value={formData.travelFee}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          travelFee: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 確認 */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-pink-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">登録内容の確認</h2>
              <p className="text-sm text-slate-500 mt-2">
                以下の内容で登録します
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">表示名</p>
                <p className="text-sm font-bold text-slate-700">{formData.displayName}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">資格</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.professions.map((prof) => (
                    <span
                      key={prof}
                      className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded"
                    >
                      {SITTER_PROFESSION_LABELS[prof]}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">得意分野</p>
                <p className="text-sm text-slate-600">
                  {formData.specialty.join('、') || '未設定'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">対応エリア</p>
                <p className="text-sm text-slate-600">
                  {formData.serviceAreas.join('、') || '未設定'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">時給</p>
                  <p className="text-sm font-bold text-slate-700">
                    ¥{formData.hourlyRate.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">最低時間</p>
                  <p className="text-sm font-bold text-slate-700">{formData.minimumHours}時間</p>
                </div>
              </div>
              {formData.isTokyoCertified && (
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    東京都補助金対象シッター
                  </p>
                </div>
              )}
            </div>

            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-700">
                登録後、運営による資格確認が完了すると公開されます。
              </p>
            </div>
          </div>
        )}

        {/* ナビゲーションボタン */}
        <div className="flex gap-3 mt-8">
          {currentIndex > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 py-4 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              戻る
            </button>
          )}
          {step !== 'confirm' ? (
            <button
              onClick={handleNext}
              disabled={step === 'basic' && !formData.displayName}
              className="flex-1 py-4 rounded-2xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              次へ
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-4 rounded-2xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors disabled:bg-slate-400 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登録中...
                </>
              ) : (
                '登録する'
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
