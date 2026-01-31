/**
 * 公式規定・制度管理フック
 * 就業規則、賃金規定、福利厚生などのPDF文書を管理
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CompanyRegulation,
  CompanyRegulationInput,
  RegulationCategory,
  DEFAULT_REGULATION_CATEGORIES,
} from '@/types';

// DB -> フロントエンド型変換
const toRegulationCategory = (row: Record<string, unknown>): RegulationCategory => ({
  id: row.id as string,
  facilityId: row.facility_id as string,
  code: row.code as string,
  name: row.name as string,
  icon: row.icon as string | undefined,
  displayOrder: row.display_order as number,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const toCompanyRegulation = (row: Record<string, unknown>): CompanyRegulation => ({
  id: row.id as string,
  facilityId: row.facility_id as string,
  title: row.title as string,
  description: row.description as string | undefined,
  categoryCode: row.category_code as string,
  fileUrl: row.file_url as string,
  fileName: row.file_name as string,
  fileSize: row.file_size as number,
  fileType: row.file_type as string,
  extractedText: row.extracted_text as string | undefined,
  version: row.version as string | undefined,
  effectiveDate: row.effective_date as string | undefined,
  revisionDate: row.revision_date as string | undefined,
  isPublished: row.is_published as boolean,
  displayOrder: row.display_order as number,
  uploadedBy: row.uploaded_by as string | undefined,
  uploadedByName: row.uploaded_by_name as string | undefined,
  viewCount: row.view_count as number,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export function useCompanyRegulations(facilityId: string) {
  const [regulations, setRegulations] = useState<CompanyRegulation[]>([]);
  const [categories, setCategories] = useState<RegulationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // カテゴリ取得（なければデフォルトを使用）
  const fetchCategories = useCallback(async () => {
    if (!facilityId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('regulation_categories')
        .select('*')
        .eq('facility_id', facilityId)
        .order('display_order');

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setCategories(data.map(toRegulationCategory));
      } else {
        // デフォルトカテゴリを使用
        setCategories(DEFAULT_REGULATION_CATEGORIES.map((cat, index) => ({
          ...cat,
          id: `default-${cat.code}`,
          facilityId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })));

        // デフォルトカテゴリをDBに挿入
        try {
          await supabase.rpc('insert_default_regulation_categories', { p_facility_id: facilityId });
        } catch {
          // RPCがない場合は手動で挿入
          for (const cat of DEFAULT_REGULATION_CATEGORIES) {
            await supabase.from('regulation_categories').upsert({
              facility_id: facilityId,
              code: cat.code,
              name: cat.name,
              icon: cat.icon,
              display_order: cat.displayOrder,
            }, { onConflict: 'facility_id,code' });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      // エラー時はデフォルトを使用
      setCategories(DEFAULT_REGULATION_CATEGORIES.map((cat) => ({
        ...cat,
        id: `default-${cat.code}`,
        facilityId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })));
    }
  }, [facilityId]);

  // 規定文書一覧取得
  const fetchRegulations = useCallback(async () => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('company_regulations')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_published', true)
        .order('category_code')
        .order('display_order')
        .order('title');

      if (fetchError) throw fetchError;

      setRegulations((data || []).map(toCompanyRegulation));
    } catch (err) {
      console.error('Error fetching regulations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch regulations');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  // 初期ロード
  useEffect(() => {
    fetchCategories();
    fetchRegulations();
  }, [fetchCategories, fetchRegulations]);

  // カテゴリ別に規定を取得
  const getRegulationsByCategory = useCallback((categoryCode: string) => {
    return regulations.filter(r => r.categoryCode === categoryCode);
  }, [regulations]);

  // 規定を追加（管理者のみ）
  const addRegulation = useCallback(async (
    input: CompanyRegulationInput,
    userId: string,
    userName: string
  ): Promise<CompanyRegulation | null> => {
    if (!facilityId) return null;

    try {
      const { data, error: insertError } = await supabase
        .from('company_regulations')
        .insert({
          facility_id: facilityId,
          title: input.title,
          description: input.description,
          category_code: input.categoryCode,
          file_url: input.fileUrl,
          file_name: input.fileName,
          file_size: input.fileSize || 0,
          file_type: input.fileType || 'pdf',
          version: input.version,
          effective_date: input.effectiveDate,
          revision_date: input.revisionDate,
          is_published: input.isPublished ?? true,
          display_order: input.displayOrder ?? 0,
          uploaded_by: userId,
          uploaded_by_name: userName,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newRegulation = toCompanyRegulation(data);
      setRegulations(prev => [...prev, newRegulation]);
      return newRegulation;
    } catch (err) {
      console.error('Error adding regulation:', err);
      throw err;
    }
  }, [facilityId]);

  // 規定を更新
  const updateRegulation = useCallback(async (
    id: string,
    input: Partial<CompanyRegulationInput>
  ): Promise<CompanyRegulation | null> => {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.categoryCode !== undefined) updateData.category_code = input.categoryCode;
      if (input.fileUrl !== undefined) updateData.file_url = input.fileUrl;
      if (input.fileName !== undefined) updateData.file_name = input.fileName;
      if (input.fileSize !== undefined) updateData.file_size = input.fileSize;
      if (input.fileType !== undefined) updateData.file_type = input.fileType;
      if (input.version !== undefined) updateData.version = input.version;
      if (input.effectiveDate !== undefined) updateData.effective_date = input.effectiveDate;
      if (input.revisionDate !== undefined) updateData.revision_date = input.revisionDate;
      if (input.isPublished !== undefined) updateData.is_published = input.isPublished;
      if (input.displayOrder !== undefined) updateData.display_order = input.displayOrder;

      const { data, error: updateError } = await supabase
        .from('company_regulations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedRegulation = toCompanyRegulation(data);
      setRegulations(prev => prev.map(r => r.id === id ? updatedRegulation : r));
      return updatedRegulation;
    } catch (err) {
      console.error('Error updating regulation:', err);
      throw err;
    }
  }, []);

  // 規定を削除
  const deleteRegulation = useCallback(async (id: string): Promise<void> => {
    try {
      const { error: deleteError } = await supabase
        .from('company_regulations')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setRegulations(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error deleting regulation:', err);
      throw err;
    }
  }, []);

  // 閲覧カウント更新
  const recordView = useCallback(async (regulationId: string, userId: string) => {
    try {
      // 閲覧履歴を記録
      await supabase
        .from('regulation_views')
        .upsert({
          regulation_id: regulationId,
          user_id: userId,
          viewed_at: new Date().toISOString(),
        }, {
          onConflict: 'regulation_id,user_id',
        });

      // 閲覧数をインクリメント
      try {
        await supabase.rpc('increment_regulation_view_count', { p_regulation_id: regulationId });
      } catch {
        // RPCがない場合はスキップ
      }
    } catch (err) {
      console.error('Error recording view:', err);
    }
  }, []);

  // 検索
  const searchRegulations = useCallback(async (query: string): Promise<CompanyRegulation[]> => {
    if (!facilityId || !query.trim()) return [];

    try {
      const searchTerm = `%${query.trim()}%`;

      const { data, error: searchError } = await supabase
        .from('company_regulations')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_published', true)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm},extracted_text.ilike.${searchTerm}`)
        .order('title');

      if (searchError) throw searchError;

      return (data || []).map(toCompanyRegulation);
    } catch (err) {
      console.error('Error searching regulations:', err);
      return [];
    }
  }, [facilityId]);

  return {
    regulations,
    categories,
    loading,
    error,
    fetchRegulations,
    getRegulationsByCategory,
    addRegulation,
    updateRegulation,
    deleteRegulation,
    recordView,
    searchRegulations,
  };
}
