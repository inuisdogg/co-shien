'use client';

import React, { useState, useCallback } from 'react';
import { Star, X, MessageSquare, ThumbsUp, AlertCircle, User } from 'lucide-react';
import { useFacilityReviews } from '@/hooks/useFacilityReviews';
import { FacilityReview } from '@/types';

// ================================================================
// Props
// ================================================================

interface FacilityReviewSectionProps {
  facilityId: string;
  userId?: string;
  facilityName?: string;
}

// ================================================================
// Sub-components
// ================================================================

/** クリック可能な星評価入力 */
const StarRatingInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
}> = ({ value, onChange, size = 'md' }) => {
  const [hovered, setHovered] = useState(0);
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`${starSize} transition-colors ${
              star <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

/** 星表示（読み取り専用） */
const StarRatingDisplay: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg' }> = ({
  rating,
  size = 'md',
}) => {
  const starSize = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${
            star <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : star - 0.5 <= rating
                ? 'fill-amber-200 text-amber-400'
                : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
};

/** サブ評価バー */
const SubRatingBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  if (value <= 0) return null;
  const pct = (value / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
};

/** 日付フォーマット */
function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// ================================================================
// Main Component
// ================================================================

const FacilityReviewSection: React.FC<FacilityReviewSectionProps> = ({
  facilityId,
  userId,
  facilityName,
}) => {
  const {
    reviews,
    loading,
    submitting,
    averageRating,
    reviewCount,
    subRatings,
    fetchReviews,
    submitReview,
  } = useFacilityReviews(facilityId);

  // レビュー投稿モーダル
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formWorkLifeBalance, setFormWorkLifeBalance] = useState(0);
  const [formStaffRelations, setFormStaffRelations] = useState(0);
  const [formGrowthOpportunity, setFormGrowthOpportunity] = useState(0);
  const [formManagement, setFormManagement] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formPros, setFormPros] = useState('');
  const [formCons, setFormCons] = useState('');
  const [formAnonymous, setFormAnonymous] = useState(true);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const resetForm = useCallback(() => {
    setFormRating(0);
    setFormWorkLifeBalance(0);
    setFormStaffRelations(0);
    setFormGrowthOpportunity(0);
    setFormManagement(0);
    setFormTitle('');
    setFormPros('');
    setFormCons('');
    setFormAnonymous(true);
    setSubmitSuccess(false);
    setSubmitError('');
  }, []);

  const handleOpenWriteModal = useCallback(() => {
    resetForm();
    setShowWriteModal(true);
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!userId) return;
    if (formRating === 0) {
      setSubmitError('総合評価を入力してください');
      return;
    }
    setSubmitError('');

    const success = await submitReview({
      facilityId,
      userId,
      rating: formRating,
      workLifeBalance: formWorkLifeBalance || undefined,
      staffRelations: formStaffRelations || undefined,
      growthOpportunity: formGrowthOpportunity || undefined,
      management: formManagement || undefined,
      title: formTitle || undefined,
      pros: formPros || undefined,
      cons: formCons || undefined,
      isAnonymous: formAnonymous,
    });

    if (success) {
      setSubmitSuccess(true);
      // 再取得
      await fetchReviews();
    } else {
      setSubmitError('レビューの投稿に失敗しました。もう一度お試しください。');
    }
  }, [
    userId,
    facilityId,
    formRating,
    formWorkLifeBalance,
    formStaffRelations,
    formGrowthOpportunity,
    formManagement,
    formTitle,
    formPros,
    formCons,
    formAnonymous,
    submitReview,
    fetchReviews,
  ]);

  // レビューカード
  const renderReviewCard = (review: FacilityReview) => (
    <div key={review.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <StarRatingDisplay rating={review.rating} size="sm" />
          {review.title && (
            <h4 className="text-sm font-bold text-gray-800">{review.title}</h4>
          )}
        </div>
        <div className="text-right space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <User className="h-3 w-3" />
            <span>{review.isAnonymous ? '匿名' : review.userName || '匿名'}</span>
          </div>
          <p className="text-[10px] text-gray-400">{formatReviewDate(review.createdAt)}</p>
        </div>
      </div>

      {/* 良い点 */}
      {review.pros && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">良い点</span>
          </div>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{review.pros}</p>
        </div>
      )}

      {/* 改善点 */}
      {review.cons && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-bold text-amber-700">改善点</span>
          </div>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{review.cons}</p>
        </div>
      )}
    </div>
  );

  // レビュー投稿モーダル
  const renderWriteModal = () => {
    if (!showWriteModal) return null;

    return (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setShowWriteModal(false)}
        />
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
          {/* ヘッダー */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
            <h3 className="font-bold text-gray-800">レビューを書く</h3>
            <button
              onClick={() => setShowWriteModal(false)}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {submitSuccess ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                <Star className="h-8 w-8 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-gray-800 mb-1">レビューを投稿しました</h4>
                <p className="text-sm text-gray-500">
                  承認後に公開されます。ご協力ありがとうございます。
                </p>
              </div>
              <button
                onClick={() => setShowWriteModal(false)}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {facilityName && (
                <p className="text-sm text-gray-500">{facilityName} のレビュー</p>
              )}

              {/* 総合評価 */}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">
                  総合評価 <span className="text-red-500">*</span>
                </label>
                <StarRatingInput value={formRating} onChange={setFormRating} size="md" />
              </div>

              {/* サブ評価 */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-600">項目別評価（任意）</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">ワークライフバランス</span>
                    <StarRatingInput
                      value={formWorkLifeBalance}
                      onChange={setFormWorkLifeBalance}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">人間関係</span>
                    <StarRatingInput
                      value={formStaffRelations}
                      onChange={setFormStaffRelations}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">成長機会</span>
                    <StarRatingInput
                      value={formGrowthOpportunity}
                      onChange={setFormGrowthOpportunity}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">マネジメント</span>
                    <StarRatingInput
                      value={formManagement}
                      onChange={setFormManagement}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {/* タイトル */}
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">タイトル</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="レビューの要約を入力"
                  maxLength={100}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              {/* 良い点 */}
              <div>
                <label className="text-xs font-bold text-emerald-700 mb-1 block">良い点</label>
                <textarea
                  value={formPros}
                  onChange={(e) => setFormPros(e.target.value)}
                  placeholder="この施設の良いところを教えてください"
                  rows={3}
                  maxLength={1000}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none"
                />
              </div>

              {/* 改善点 */}
              <div>
                <label className="text-xs font-bold text-amber-700 mb-1 block">改善点</label>
                <textarea
                  value={formCons}
                  onChange={(e) => setFormCons(e.target.value)}
                  placeholder="改善してほしい点を教えてください"
                  rows={3}
                  maxLength={1000}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none"
                />
              </div>

              {/* 匿名トグル */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-600">匿名で投稿</span>
                  <p className="text-[10px] text-gray-400">名前を非公開にします</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormAnonymous(!formAnonymous)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formAnonymous ? 'bg-indigo-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formAnonymous ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* エラー */}
              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>
              )}

              {/* 送信ボタン */}
              <button
                onClick={handleSubmit}
                disabled={submitting || formRating === 0}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '投稿中...' : 'レビューを投稿'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ================================================================
  // Render
  // ================================================================

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          口コミ・レビュー
        </h2>
        {userId && (
          <button
            onClick={handleOpenWriteModal}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            レビューを書く
          </button>
        )}
      </div>

      {/* 総合評価サマリー */}
      {reviewCount > 0 ? (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3">
          {/* 平均評価 */}
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-gray-900">{averageRating.toFixed(1)}</div>
            <div className="space-y-0.5">
              <StarRatingDisplay rating={averageRating} size="md" />
              <p className="text-xs text-gray-500">{reviewCount}件のレビュー</p>
            </div>
          </div>

          {/* サブ評価 */}
          <div className="space-y-2">
            <SubRatingBar label="ワークライフバランス" value={subRatings.workLifeBalance} />
            <SubRatingBar label="人間関係" value={subRatings.staffRelations} />
            <SubRatingBar label="成長機会" value={subRatings.growthOpportunity} />
            <SubRatingBar label="マネジメント" value={subRatings.management} />
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">まだレビューがありません</p>
          {userId && (
            <button
              onClick={handleOpenWriteModal}
              className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              最初のレビューを書く
            </button>
          )}
        </div>
      )}

      {/* レビュー一覧 */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-gray-400 mt-2">読み込み中...</p>
        </div>
      ) : (
        reviews.length > 0 && (
          <div className="space-y-3">
            {reviews.map((review) => renderReviewCard(review))}
          </div>
        )
      )}

      {/* レビュー投稿モーダル */}
      {renderWriteModal()}
    </div>
  );
};

export default FacilityReviewSection;
