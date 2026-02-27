/**
 * 自己評価管理フック
 * 事業所自己評価・保護者等向け評価の作成・更新・公開を管理する
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { SelfEvaluation, SelfEvaluationType } from '@/types';

function mapRowToEvaluation(row: any): SelfEvaluation {
  return {
    id: row.id,
    facilityId: row.facility_id,
    fiscalYear: row.fiscal_year,
    evaluationType: row.evaluation_type,
    status: row.status,
    responses: row.responses || {},
    summary: row.summary || undefined,
    improvementPlan: row.improvement_plan || undefined,
    publishedAt: row.published_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useSelfEvaluation() {
  const [evaluations, setEvaluations] = useState<SelfEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 指定施設の全自己評価を取得
   */
  const fetchEvaluations = useCallback(async (facilityId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('self_evaluations')
        .select('*')
        .eq('facility_id', facilityId)
        .order('fiscal_year', { ascending: false });

      if (fetchError) {
        console.error('自己評価の取得に失敗しました:', fetchError);
        setError(fetchError.message);
        return [];
      }

      const mapped = (data || []).map(mapRowToEvaluation);
      setEvaluations(mapped);
      return mapped;
    } catch (err: any) {
      console.error('自己評価取得エラー:', err);
      setError(err.message || '不明なエラー');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 新規自己評価を作成
   */
  const createEvaluation = useCallback(async (
    facilityId: string,
    fiscalYear: string,
    evaluationType: SelfEvaluationType
  ): Promise<SelfEvaluation | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('self_evaluations')
        .insert({
          facility_id: facilityId,
          fiscal_year: fiscalYear,
          evaluation_type: evaluationType,
          status: 'draft',
          responses: {},
        })
        .select()
        .single();

      if (insertError) {
        console.error('自己評価の作成に失敗しました:', insertError);
        setError(insertError.message);
        return null;
      }

      const mapped = mapRowToEvaluation(data);
      setEvaluations((prev) => [mapped, ...prev]);
      return mapped;
    } catch (err: any) {
      console.error('自己評価作成エラー:', err);
      setError(err.message || '不明なエラー');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 自己評価を更新
   */
  const updateEvaluation = useCallback(async (
    id: string,
    updates: Partial<Pick<SelfEvaluation, 'responses' | 'summary' | 'improvementPlan' | 'status'>>
  ): Promise<SelfEvaluation | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.responses !== undefined) dbUpdates.responses = updates.responses;
      if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
      if (updates.improvementPlan !== undefined) dbUpdates.improvement_plan = updates.improvementPlan;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { data, error: updateError } = await supabase
        .from('self_evaluations')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('自己評価の更新に失敗しました:', updateError);
        setError(updateError.message);
        return null;
      }

      const mapped = mapRowToEvaluation(data);
      setEvaluations((prev) => prev.map((e) => (e.id === id ? mapped : e)));
      return mapped;
    } catch (err: any) {
      console.error('自己評価更新エラー:', err);
      setError(err.message || '不明なエラー');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 自己評価を公開
   */
  const publishEvaluation = useCallback(async (id: string): Promise<SelfEvaluation | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: publishError } = await supabase
        .from('self_evaluations')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (publishError) {
        console.error('自己評価の公開に失敗しました:', publishError);
        setError(publishError.message);
        return null;
      }

      const mapped = mapRowToEvaluation(data);
      setEvaluations((prev) => prev.map((e) => (e.id === id ? mapped : e)));
      return mapped;
    } catch (err: any) {
      console.error('自己評価公開エラー:', err);
      setError(err.message || '不明なエラー');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    evaluations,
    isLoading,
    error,
    fetchEvaluations,
    createEvaluation,
    updateEvaluation,
    publishEvaluation,
  };
}
