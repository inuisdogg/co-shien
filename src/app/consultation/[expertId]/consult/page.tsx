'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  Send,
  AlertCircle,
  Loader2,
  CheckCircle,
  Coins,
} from 'lucide-react';
import { usePublicExpert } from '@/hooks/useExpertProfile';
import { useClientConsultations } from '@/hooks/useConsultations';
import { usePoints } from '@/hooks/usePoints';
import {
  EXPERT_PROFESSION_LABELS,
  CONSULTATION_CATEGORIES,
  ConsultationThreadFormData,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ConsultStartPage() {
  const router = useRouter();
  const params = useParams();
  const expertId = params.expertId as string;

  const [user, setUser] = useState<{ id: string; name: string; userType: string } | null>(null);
  const [formData, setFormData] = useState<ConsultationThreadFormData>({
    expertId: expertId,
    subject: '',
    childAge: '',
    consultationType: [],
    initialMessage: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPointModal, setShowPointModal] = useState(false);

  const { expert, isLoading: expertLoading } = usePublicExpert(expertId);
  const { createThread } = useClientConsultations(user?.id);
  const { points, purchasePoints, hasEnoughPoints } = usePoints(user?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.userType !== 'client') {
          // staffの場合でもテスト用にアクセス許可
          // 本番ではclientのみに制限
        }
        setUser(parsed);
      } catch (e) {
        router.push('/parent/login');
      }
    } else {
      router.push('/parent/login');
    }
  }, [router]);

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      consultationType: prev.consultationType.includes(category)
        ? prev.consultationType.filter(c => c !== category)
        : [...prev.consultationType, category],
    }));
  };

  const canSubmit = () => {
    return (
      formData.subject.trim().length > 0 &&
      formData.initialMessage.trim().length > 0 &&
      formData.consultationType.length > 0
    );
  };

  const handleSubmit = async () => {
    if (!user || !expert || !canSubmit()) return;

    // 初回無料でなければポイント確認
    if (!expert.freeFirstMessage && !hasEnoughPoints(expert.pricePerMessage)) {
      setShowPointModal(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const thread = await createThread({
        ...formData,
        expertId: expert.id,
      });

      if (thread) {
        router.push(`/client/consultations/${thread.id}`);
      } else {
        setError('相談の開始に失敗しました');
      }
    } catch (err) {
      console.error('Error creating consultation:', err);
      setError('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (expertLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-500">エキスパートが見つかりません</p>
      </div>
    );
  }

  const primaryColor = expert.pageTheme?.primaryColor || '#10B981';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
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
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                }}
              >
                {expert.pageTheme?.profileImage ? (
                  <img
                    src={expert.pageTheme.profileImage}
                    alt={expert.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  expert.displayName.charAt(0)
                )}
              </div>
              <div>
                <h1 className="font-bold text-gray-900">{expert.displayName}に相談</h1>
                <p className="text-xs text-gray-500">
                  {EXPERT_PROFESSION_LABELS[expert.profession]}
                </p>
              </div>
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

        {/* 料金表示 */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">相談料金</p>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-2xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {expert.freeFirstMessage ? '無料' : expert.pricePerMessage}
                </span>
                {!expert.freeFirstMessage && (
                  <span className="text-sm text-gray-500">pt</span>
                )}
              </div>
            </div>
            {expert.freeFirstMessage && (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
                初回無料
              </span>
            )}
            {points && (
              <div className="text-right">
                <p className="text-xs text-gray-500">保有ポイント</p>
                <p className="font-bold text-gray-900">{points.balance} pt</p>
              </div>
            )}
          </div>
        </div>

        {/* フォーム */}
        <div className="space-y-6">
          {/* 相談タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              相談タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="例: 3歳児の言葉の遅れについて"
              maxLength={100}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* お子様の年齢 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              お子様の年齢（任意）
            </label>
            <input
              type="text"
              value={formData.childAge || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, childAge: e.target.value }))}
              placeholder="例: 3歳6ヶ月"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* 相談カテゴリ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              相談カテゴリ <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CONSULTATION_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    formData.consultationType.includes(category)
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* 相談内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              相談内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.initialMessage}
              onChange={(e) => setFormData(prev => ({ ...prev, initialMessage: e.target.value }))}
              placeholder="お悩みや質問を詳しく書いてください"
              rows={6}
              maxLength={2000}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {formData.initialMessage.length}/2000
            </p>
          </div>

          {/* 注意事項 */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <h4 className="font-medium text-gray-900 mb-2">ご注意</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>相談内容は専門家と相談者のみが閲覧できます</li>
              <li>医療機関での診断・治療に代わるものではありません</li>
              <li>専門家からの返信には数日かかる場合があります</li>
            </ul>
          </div>
        </div>
      </main>

      {/* 送信ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting}
            className="flex items-center justify-center gap-2 w-full py-3 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: canSubmit() ? primaryColor : '#9CA3AF' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                相談を送信
              </>
            )}
          </button>
        </div>
      </div>

      {/* ポイント不足モーダル */}
      {showPointModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <Coins className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                ポイントが不足しています
              </h3>
              <p className="text-sm text-gray-500">
                相談には{expert.pricePerMessage}ポイントが必要です。<br />
                現在の保有ポイント: {points?.balance || 0}pt
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowPointModal(false);
                  router.push('/parent/points');
                }}
                className="w-full py-2.5 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600"
              >
                ポイントを購入する
              </button>
              <button
                onClick={() => setShowPointModal(false)}
                className="w-full py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
