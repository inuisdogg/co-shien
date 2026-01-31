'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  User,
  Briefcase,
  Tag,
  Coins,
  Palette,
  ImageIcon,
  Save,
  Loader2,
  Check,
  X,
  Plus,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { useExpertProfile } from '@/hooks/useExpertProfile';
import { supabase } from '@/lib/supabase';
import {
  ExpertProfession,
  EXPERT_PROFESSION_LABELS,
  COMMON_SPECIALTY_TAGS,
  ExpertPageTheme,
  DEFAULT_EXPERT_THEME,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

const PRESET_COLORS = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export default function ExpertProfileEditPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'pricing' | 'theme'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームデータ
  const [displayName, setDisplayName] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [experienceYears, setExperienceYears] = useState<number | null>(null);
  const [specialty, setSpecialty] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState('');

  // 料金設定
  const [pricePerMessage, setPricePerMessage] = useState(100);
  const [freeFirstMessage, setFreeFirstMessage] = useState(false);

  // テーマ設定
  const [pageTheme, setPageTheme] = useState<ExpertPageTheme>(DEFAULT_EXPERT_THEME);

  const { profile, isLoading, updateProfile } = useExpertProfile(user?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        router.push('/career/login');
      }
    } else {
      router.push('/career/login');
    }
  }, [router]);

  // プロフィールデータをフォームに反映
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setIntroduction(profile.introduction || '');
      setExperienceYears(profile.experienceYears || null);
      setSpecialty(profile.specialty || []);
      setPricePerMessage(profile.pricePerMessage || 100);
      setFreeFirstMessage(profile.freeFirstMessage || false);
      setPageTheme(profile.pageTheme || DEFAULT_EXPERT_THEME);
    }
  }, [profile]);

  const toggleSpecialty = (tag: string) => {
    setSpecialty(prev =>
      prev.includes(tag) ? prev.filter(s => s !== tag) : [...prev, tag]
    );
  };

  const addCustomSpecialty = () => {
    if (customSpecialty.trim() && !specialty.includes(customSpecialty.trim())) {
      setSpecialty(prev => [...prev, customSpecialty.trim()]);
      setCustomSpecialty('');
    }
  };

  const removeSpecialty = (tag: string) => {
    setSpecialty(prev => prev.filter(s => s !== tag));
  };

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    setError(null);

    try {
      const success = await updateProfile({
        displayName,
        introduction,
        experienceYears: experienceYears || undefined,
        specialty,
        pricePerMessage,
        freeFirstMessage,
        pageTheme,
      });

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setError('保存に失敗しました');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('エラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-500">プロフィールが見つかりません</p>
        <button
          onClick={() => router.push('/expert/register')}
          className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg"
        >
          エキスパート登録へ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/expert/dashboard')}
                className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="font-bold text-lg text-gray-900">プロフィール編集</h1>
            </div>
            <button
              onClick={() => router.push(`/expert/${profile.id}`)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg"
            >
              <Eye className="w-4 h-4" />
              プレビュー
            </button>
          </div>
        </div>
      </header>

      {/* タブ */}
      <div className="bg-white border-b border-gray-100 sticky top-[65px] z-40">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex">
            {[
              { key: 'profile', label: 'プロフィール', icon: User },
              { key: 'pricing', label: '料金設定', icon: Coins },
              { key: 'theme', label: 'テーマ', icon: Palette },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* プロフィールタブ */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-500" />
                基本情報
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    表示名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="山田太郎"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    職種
                  </label>
                  <p className="px-4 py-2.5 bg-gray-50 rounded-lg text-gray-600">
                    {EXPERT_PROFESSION_LABELS[profile.profession]}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    経験年数
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={experienceYears || ''}
                      onChange={(e) => setExperienceYears(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-24 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-600">年</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    自己紹介
                  </label>
                  <textarea
                    value={introduction}
                    onChange={(e) => setIntroduction(e.target.value)}
                    placeholder="専門分野や経歴、得意な相談内容などを記載してください"
                    rows={5}
                    maxLength={1000}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {introduction.length}/1000
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-500" />
                専門分野
              </h2>

              {/* 選択済みタグ */}
              {specialty.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {specialty.map((tag, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeSpecialty(tag)}
                        className="p-0.5 hover:bg-emerald-100 rounded-full"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* よく使われるタグ */}
              <div className="flex flex-wrap gap-2 mb-4">
                {COMMON_SPECIALTY_TAGS.filter(tag => !specialty.includes(tag)).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleSpecialty(tag)}
                    className="px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-full hover:border-emerald-300 hover:text-emerald-600"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* カスタムタグ追加 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSpecialty}
                  onChange={(e) => setCustomSpecialty(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomSpecialty()}
                  placeholder="その他の専門分野を追加..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={addCustomSpecialty}
                  disabled={!customSpecialty.trim()}
                  className="px-3 py-2 bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 料金設定タブ */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-500" />
                テキスト相談料金
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    1回の返信あたりの料金
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={50}
                      max={1000}
                      step={10}
                      value={pricePerMessage}
                      onChange={(e) => setPricePerMessage(parseInt(e.target.value) || 100)}
                      className="w-32 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-600">ポイント</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    50〜1000ポイントの範囲で設定できます
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freeFirstMessage}
                      onChange={(e) => setFreeFirstMessage(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">初回相談無料</span>
                      <p className="text-sm text-gray-500">
                        新規クライアントの最初の相談を無料にします
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-4">
              <h3 className="font-medium text-amber-800 mb-2">収益について</h3>
              <p className="text-sm text-amber-700">
                クライアントが支払ったポイントから、プラットフォーム手数料（20%）を差し引いた金額があなたの収益になります。
                収益の支払いは月末締め、翌月15日払いです。
              </p>
            </div>
          </div>
        )}

        {/* テーマ設定タブ */}
        {activeTab === 'theme' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5 text-emerald-500" />
                テーマカラー
              </h2>

              <div className="grid grid-cols-4 gap-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setPageTheme(prev => ({ ...prev, primaryColor: color }))}
                    className={`w-full aspect-square rounded-xl border-2 transition-all ${
                      pageTheme.primaryColor === color
                        ? 'border-gray-900 scale-105'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {pageTheme.primaryColor === color && (
                      <Check className="w-6 h-6 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カスタムカラー
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={pageTheme.primaryColor}
                    onChange={(e) => setPageTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-12 h-12 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={pageTheme.primaryColor}
                    onChange={(e) => setPageTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                プロフィール画像
              </h2>

              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-full border-2 border-gray-200 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: `${pageTheme.primaryColor}15` }}
                >
                  {pageTheme.profileImage ? (
                    <img
                      src={pageTheme.profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8" style={{ color: pageTheme.primaryColor }} />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={pageTheme.profileImage || ''}
                    onChange={(e) => setPageTheme(prev => ({ ...prev, profileImage: e.target.value || undefined }))}
                    placeholder="画像URLを入力..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    正方形の画像を推奨（512x512px以上）
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                ヘッダー画像
              </h2>

              <div
                className="h-24 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden"
                style={{
                  background: pageTheme.headerImage
                    ? `url(${pageTheme.headerImage}) center/cover`
                    : `linear-gradient(135deg, ${pageTheme.primaryColor} 0%, ${pageTheme.primaryColor}99 100%)`,
                }}
              >
                {!pageTheme.headerImage && (
                  <span className="text-white/60 text-sm">ヘッダープレビュー</span>
                )}
              </div>
              <input
                type="text"
                value={pageTheme.headerImage || ''}
                onChange={(e) => setPageTheme(prev => ({ ...prev, headerImage: e.target.value || undefined }))}
                placeholder="ヘッダー画像URLを入力..."
                className="w-full mt-3 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                推奨サイズ: 1200x400px
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 保存ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || !displayName.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                保存中...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-5 h-5" />
                保存しました
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                変更を保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
