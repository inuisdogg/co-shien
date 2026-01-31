'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MessageCircle,
  Video,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Coins,
} from 'lucide-react';
import { useExpertProfile } from '@/hooks/useExpertProfile';

export const dynamic = 'force-dynamic';

const PRICE_OPTIONS = [100, 150, 200, 250, 300, 400, 500];

export default function ExpertPricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { profile, isLoading, updateProfile, error } = useExpertProfile(user?.id);

  const [pricePerMessage, setPricePerMessage] = useState(300);
  const [freeFirstMessage, setFreeFirstMessage] = useState(true);

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
    if (profile) {
      setPricePerMessage(profile.pricePerMessage);
      setFreeFirstMessage(profile.freeFirstMessage);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const success = await updateProfile({
        pricePerMessage,
        freeFirstMessage,
      });
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

  const primaryColor = profile.pageTheme?.primaryColor || '#10B981';

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
              <h1 className="font-bold text-lg text-gray-900">料金設定</h1>
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
          {/* テキスト相談料金 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              <h2 className="font-bold text-gray-900">テキスト相談料金</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1回あたりの料金（ポイント）
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PRICE_OPTIONS.map((price) => (
                    <button
                      key={price}
                      onClick={() => setPricePerMessage(price)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        pricePerMessage === price
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={{
                        backgroundColor: pricePerMessage === price ? primaryColor : undefined,
                      }}
                    >
                      {price}pt
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const custom = prompt('カスタム料金を入力（50〜1000pt）', pricePerMessage.toString());
                      if (custom) {
                        const value = parseInt(custom, 10);
                        if (value >= 50 && value <= 1000) {
                          setPricePerMessage(value);
                        }
                      }
                    }}
                    className="py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    その他
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Coins className="w-4 h-4" />
                  <span>現在の設定: {pricePerMessage}pt（約{pricePerMessage * 10}円相当）</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">初回相談無料</p>
                  <p className="text-sm text-gray-500">新規相談者の最初の1回を無料に</p>
                </div>
                <button onClick={() => setFreeFirstMessage(!freeFirstMessage)}>
                  {freeFirstMessage ? (
                    <ToggleRight className="w-10 h-6" style={{ color: primaryColor }} />
                  ) : (
                    <ToggleLeft className="w-10 h-6 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ビデオ通話料金（Coming Soon） */}
          <div className="bg-white rounded-xl p-4 shadow-sm opacity-60">
            <div className="flex items-center gap-2 mb-4">
              <Video className="w-5 h-5 text-gray-400" />
              <h2 className="font-bold text-gray-900">ビデオ通話料金</h2>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                Coming Soon
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">30分</span>
                </div>
                <span className="text-gray-400">未設定</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">60分</span>
                </div>
                <span className="text-gray-400">未設定</span>
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-3">
              ビデオ通話機能は今後追加予定です
            </p>
          </div>

          {/* 収益シミュレーション */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4">収益シミュレーション</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">月10件の相談</span>
                <span className="font-bold text-gray-900">
                  約 ¥{((freeFirstMessage ? 5 : 10) * pricePerMessage * 10 * 0.8).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">月30件の相談</span>
                <span className="font-bold text-gray-900">
                  約 ¥{((freeFirstMessage ? 20 : 30) * pricePerMessage * 10 * 0.8).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                ※ 手数料20%を差し引いた概算金額です。初回無料の場合は半数が新規相談者と仮定しています。
              </p>
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
            className="flex items-center justify-center gap-2 w-full py-3 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor }}
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
