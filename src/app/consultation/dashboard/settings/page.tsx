'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Palette,
  Image as ImageIcon,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useExpertProfile } from '@/hooks/useExpertProfile';
import { ExpertPageTheme, DEFAULT_EXPERT_THEME } from '@/types/expert';

export const dynamic = 'force-dynamic';

const COLOR_PRESETS = [
  { name: 'エメラルド', color: '#10B981' },
  { name: 'ブルー', color: '#3B82F6' },
  { name: 'パープル', color: '#8B5CF6' },
  { name: 'ピンク', color: '#EC4899' },
  { name: 'レッド', color: '#EF4444' },
  { name: 'オレンジ', color: '#F59E0B' },
  { name: 'ティール', color: '#14B8A6' },
  { name: 'インディゴ', color: '#6366F1' },
];

export default function ExpertSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { profile, isLoading, updateProfile, error } = useExpertProfile(user?.id);

  const [theme, setTheme] = useState<ExpertPageTheme>(DEFAULT_EXPERT_THEME);

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

  useEffect(() => {
    if (profile?.pageTheme) {
      setTheme(profile.pageTheme);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const success = await updateProfile({ pageTheme: theme });
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
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
              <h1 className="font-bold text-lg text-gray-900">ページカスタマイズ</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 p-4 bg-emerald-50 text-emerald-600 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            保存しました
          </div>
        )}

        <div className="space-y-6">
          {/* テーマカラー */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-gray-400" />
              <h2 className="font-bold text-gray-900">テーマカラー</h2>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => setTheme(prev => ({ ...prev, primaryColor: preset.color }))}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                    theme.primaryColor === preset.color
                      ? 'ring-2 ring-offset-2'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: preset.color,
                    outlineColor: preset.color,
                  }}
                >
                  {theme.primaryColor === preset.color && (
                    <CheckCircle className="w-6 h-6 text-white" />
                  )}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カスタムカラー
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-12 h-12 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="#10B981"
                />
              </div>
            </div>
          </div>

          {/* プロフィール画像 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-gray-400" />
              <h2 className="font-bold text-gray-900">プロフィール画像</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  プロフィール画像URL
                </label>
                <input
                  type="url"
                  value={theme.profileImage || ''}
                  onChange={(e) => setTheme(prev => ({ ...prev, profileImage: e.target.value || undefined }))}
                  placeholder="https://example.com/profile.jpg"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  正方形の画像を推奨（推奨サイズ: 256x256px以上）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ヘッダー画像URL
                </label>
                <input
                  type="url"
                  value={theme.headerImage || ''}
                  onChange={(e) => setTheme(prev => ({ ...prev, headerImage: e.target.value || undefined }))}
                  placeholder="https://example.com/header.jpg"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  横長の画像を推奨（推奨サイズ: 1200x400px以上）
                </p>
              </div>
            </div>
          </div>

          {/* プレビュー */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">プレビュー</h2>
            </div>
            <div className="p-4">
              <div
                className="h-24 rounded-t-xl relative"
                style={{
                  background: theme.headerImage
                    ? `url(${theme.headerImage}) center/cover`
                    : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.primaryColor}99 100%)`,
                }}
              >
                <div className="absolute -bottom-8 left-4">
                  <div
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center text-2xl font-bold"
                    style={{
                      backgroundColor: theme.profileImage ? 'transparent' : `${theme.primaryColor}15`,
                      color: theme.primaryColor,
                    }}
                  >
                    {theme.profileImage ? (
                      <img
                        src={theme.profileImage}
                        alt="プレビュー"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      profile.displayName.charAt(0)
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-12 pb-4 px-4">
                <h3 className="font-bold text-gray-900">{profile.displayName}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="px-3 py-1 text-sm rounded-full"
                    style={{
                      backgroundColor: `${theme.primaryColor}15`,
                      color: theme.primaryColor,
                    }}
                  >
                    専門タグ
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 保存ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                保存する
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
