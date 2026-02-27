/**
 * 施設レビュー管理フック
 * 施設レビューの取得、投稿、モデレーション、評価計算を提供する。
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FacilityReview } from '@/types';

// ------------------------------------------------------------------ types

type SubmitReviewInput = {
  facilityId: string;
  userId: string;
  jobApplicationId?: string;
  rating: number;
  workLifeBalance?: number;
  staffRelations?: number;
  growthOpportunity?: number;
  management?: number;
  title?: string;
  pros?: string;
  cons?: string;
  isAnonymous: boolean;
};

// ------------------------------------------------------------------ mapper

function mapReview(row: Record<string, unknown>): FacilityReview {
  const user = row.users as Record<string, unknown> | null;
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    userId: row.user_id as string,
    jobApplicationId: (row.job_application_id as string) || undefined,
    rating: Number(row.rating) || 0,
    workLifeBalance: row.work_life_balance != null ? Number(row.work_life_balance) : undefined,
    staffRelations: row.staff_relations != null ? Number(row.staff_relations) : undefined,
    growthOpportunity: row.growth_opportunity != null ? Number(row.growth_opportunity) : undefined,
    management: row.management != null ? Number(row.management) : undefined,
    title: (row.title as string) || undefined,
    pros: (row.pros as string) || undefined,
    cons: (row.cons as string) || undefined,
    isAnonymous: Boolean(row.is_anonymous),
    status: row.status as FacilityReview['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    userName: user ? (user.name as string) : undefined,
  };
}

// ------------------------------------------------------------------ hook

export function useFacilityReviews(facilityId?: string) {
  const [reviews, setReviews] = useState<FacilityReview[]>([]);
  const [pendingReviews, setPendingReviews] = useState<FacilityReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [subRatings, setSubRatings] = useState<{
    workLifeBalance: number;
    staffRelations: number;
    growthOpportunity: number;
    management: number;
  }>({ workLifeBalance: 0, staffRelations: 0, growthOpportunity: 0, management: 0 });

  // 承認済みレビューを取得
  const fetchReviews = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('facility_reviews')
        .select('*, users(name)')
        .eq('facility_id', facilityId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('レビューの取得に失敗しました:', error);
        return;
      }

      const mapped = (data || []).map((r) => mapReview(r as Record<string, unknown>));
      setReviews(mapped);

      // 平均評価・件数を計算
      if (mapped.length > 0) {
        const totalRating = mapped.reduce((sum, r) => sum + r.rating, 0);
        setAverageRating(totalRating / mapped.length);
        setReviewCount(mapped.length);

        // サブ評価の平均を計算
        const calcSubAvg = (getter: (r: FacilityReview) => number | undefined) => {
          const vals = mapped.map(getter).filter((v): v is number => v != null && v > 0);
          return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        };
        setSubRatings({
          workLifeBalance: calcSubAvg((r) => r.workLifeBalance),
          staffRelations: calcSubAvg((r) => r.staffRelations),
          growthOpportunity: calcSubAvg((r) => r.growthOpportunity),
          management: calcSubAvg((r) => r.management),
        });
      } else {
        setAverageRating(0);
        setReviewCount(0);
        setSubRatings({ workLifeBalance: 0, staffRelations: 0, growthOpportunity: 0, management: 0 });
      }
    } catch (err) {
      console.error('レビュー取得時にエラーが発生しました:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  // 新規レビューを投稿（status: 'pending'）
  const submitReview = useCallback(
    async (input: SubmitReviewInput): Promise<boolean> => {
      setSubmitting(true);
      try {
        const { error } = await supabase.from('facility_reviews').insert({
          facility_id: input.facilityId,
          user_id: input.userId,
          job_application_id: input.jobApplicationId || null,
          rating: input.rating,
          work_life_balance: input.workLifeBalance || null,
          staff_relations: input.staffRelations || null,
          growth_opportunity: input.growthOpportunity || null,
          management: input.management || null,
          title: input.title || null,
          pros: input.pros || null,
          cons: input.cons || null,
          is_anonymous: input.isAnonymous,
          status: 'pending',
        });

        if (error) {
          console.error('レビューの投稿に失敗しました:', error);
          return false;
        }

        return true;
      } catch (err) {
        console.error('レビュー投稿時にエラーが発生しました:', err);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  // 保留中レビューを取得（施設管理者用）
  const fetchPendingReviews = useCallback(async () => {
    if (!facilityId) return;
    try {
      const { data, error } = await supabase
        .from('facility_reviews')
        .select('*, users(name)')
        .eq('facility_id', facilityId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('保留中レビューの取得に失敗しました:', error);
        return;
      }

      setPendingReviews((data || []).map((r) => mapReview(r as Record<string, unknown>)));
    } catch (err) {
      console.error('保留中レビュー取得時にエラーが発生しました:', err);
    }
  }, [facilityId]);

  // レビューを承認/却下（施設管理者用）
  const moderateReview = useCallback(
    async (reviewId: string, status: 'approved' | 'rejected'): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('facility_reviews')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', reviewId);

        if (error) {
          console.error('レビューのモデレーションに失敗しました:', error);
          return false;
        }

        // 保留リストから削除
        setPendingReviews((prev) => prev.filter((r) => r.id !== reviewId));

        // 承認された場合は評価を再計算
        if (status === 'approved') {
          await updateFacilityRating();
          await fetchReviews();
        }

        return true;
      } catch (err) {
        console.error('レビューモデレーション時にエラーが発生しました:', err);
        return false;
      }
    },
    [facilityId]
  );

  // 施設の平均評価を再計算して更新
  const updateFacilityRating = useCallback(async () => {
    if (!facilityId) return;
    try {
      // 承認済みレビューの平均を取得
      const { data, error } = await supabase
        .from('facility_reviews')
        .select('rating')
        .eq('facility_id', facilityId)
        .eq('status', 'approved');

      if (error) {
        console.error('評価の再計算に失敗しました:', error);
        return;
      }

      const ratings = (data || []).map((r) => Number(r.rating));
      const count = ratings.length;
      const avg = count > 0 ? ratings.reduce((a, b) => a + b, 0) / count : 0;

      // facilities テーブルを更新
      const { error: updateError } = await supabase
        .from('facilities')
        .update({
          average_rating: Math.round(avg * 10) / 10,
          review_count: count,
        })
        .eq('id', facilityId);

      if (updateError) {
        console.error('施設の評価更新に失敗しました:', updateError);
      }
    } catch (err) {
      console.error('施設評価更新時にエラーが発生しました:', err);
    }
  }, [facilityId]);

  // 初回取得
  useEffect(() => {
    if (facilityId) {
      fetchReviews();
    }
  }, [facilityId, fetchReviews]);

  return {
    reviews,
    pendingReviews,
    loading,
    submitting,
    averageRating,
    reviewCount,
    subRatings,
    fetchReviews,
    submitReview,
    fetchPendingReviews,
    moderateReview,
    updateFacilityRating,
  };
}
