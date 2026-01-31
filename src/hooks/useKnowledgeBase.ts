/**
 * ナレッジベース（社内Wiki）フック
 * useKnowledgeBase - 記事のCRUD、検索、カテゴリ管理
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  KnowledgeArticle,
  KnowledgeArticleInput,
  KnowledgeCategory,
  KnowledgeAttachment,
  DEFAULT_KNOWLEDGE_CATEGORIES,
} from '@/types';

// DBレコード→フロントエンド型への変換
const mapArticleFromDB = (record: Record<string, unknown>): KnowledgeArticle => ({
  id: record.id as string,
  facilityId: record.facility_id as string,
  title: record.title as string,
  content: record.content as string,
  summary: record.summary as string | undefined,
  category: record.category as string,
  tags: (record.tags as string[]) || [],
  isAdminLocked: record.is_admin_locked as boolean,
  isPublished: record.is_published as boolean,
  isPinned: record.is_pinned as boolean,
  attachments: (record.attachments as KnowledgeAttachment[]) || [],
  authorId: record.author_id as string | undefined,
  authorName: record.author_name as string | undefined,
  lastEditorId: record.last_editor_id as string | undefined,
  lastEditorName: record.last_editor_name as string | undefined,
  viewCount: record.view_count as number,
  createdAt: record.created_at as string,
  updatedAt: record.updated_at as string,
});

const mapCategoryFromDB = (record: Record<string, unknown>): KnowledgeCategory => ({
  id: record.id as string,
  facilityId: record.facility_id as string,
  code: record.code as string,
  name: record.name as string,
  icon: record.icon as string,
  color: record.color as string,
  displayOrder: record.display_order as number,
  isDefault: record.is_default as boolean,
  createdAt: record.created_at as string,
});

export interface UseKnowledgeBaseReturn {
  // データ
  articles: KnowledgeArticle[];
  categories: KnowledgeCategory[];
  pinnedArticles: KnowledgeArticle[];
  recentArticles: KnowledgeArticle[];

  // 状態
  loading: boolean;
  error: string | null;

  // 記事操作
  fetchArticles: (options?: { category?: string; search?: string }) => Promise<void>;
  fetchArticle: (id: string) => Promise<KnowledgeArticle | null>;
  createArticle: (input: KnowledgeArticleInput) => Promise<KnowledgeArticle | null>;
  updateArticle: (id: string, input: Partial<KnowledgeArticleInput>) => Promise<boolean>;
  deleteArticle: (id: string) => Promise<boolean>;
  incrementViewCount: (id: string) => Promise<void>;

  // カテゴリ操作
  fetchCategories: () => Promise<void>;
  initializeDefaultCategories: () => Promise<void>;

  // 検索
  searchArticles: (query: string) => Promise<KnowledgeArticle[]>;

  // 権限チェック
  canEdit: (article: KnowledgeArticle, userId: string, isAdmin: boolean) => boolean;
}

export function useKnowledgeBase(facilityId: string | null): UseKnowledgeBaseReturn {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ピン留め記事
  const pinnedArticles = articles.filter(a => a.isPinned && a.isPublished);

  // 最近更新された記事（上位10件）
  const recentArticles = [...articles]
    .filter(a => a.isPublished)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  // カテゴリ取得
  const fetchCategories = useCallback(async () => {
    if (!facilityId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('knowledge_categories')
        .select('*')
        .eq('facility_id', facilityId)
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setCategories(data.map(mapCategoryFromDB));
      } else {
        // カテゴリがなければデフォルトを使用（UIのみ）
        setCategories(DEFAULT_KNOWLEDGE_CATEGORIES.map((cat, i) => ({
          id: `default-${cat.code}`,
          facilityId: facilityId,
          code: cat.code,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          displayOrder: i + 1,
          isDefault: true,
          createdAt: new Date().toISOString(),
        })));
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, [facilityId]);

  // デフォルトカテゴリ初期化
  const initializeDefaultCategories = useCallback(async () => {
    if (!facilityId) return;

    try {
      // RPC関数を呼び出し
      const { error: rpcError } = await supabase
        .rpc('create_default_knowledge_categories', { p_facility_id: facilityId });

      if (rpcError) throw rpcError;

      await fetchCategories();
    } catch (err) {
      console.error('Error initializing categories:', err);
    }
  }, [facilityId, fetchCategories]);

  // 記事一覧取得
  const fetchArticles = useCallback(async (options?: { category?: string; search?: string }) => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('knowledge_articles')
        .select('*')
        .eq('facility_id', facilityId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (options?.category) {
        query = query.eq('category', options.category);
      }

      if (options?.search) {
        query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setArticles((data || []).map(mapArticleFromDB));
    } catch (err) {
      console.error('Error fetching articles:', err);
      setError('記事の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  // 単一記事取得
  const fetchArticle = useCallback(async (id: string): Promise<KnowledgeArticle | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('knowledge_articles')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      return data ? mapArticleFromDB(data) : null;
    } catch (err) {
      console.error('Error fetching article:', err);
      return null;
    }
  }, []);

  // 記事作成
  const createArticle = useCallback(async (input: KnowledgeArticleInput): Promise<KnowledgeArticle | null> => {
    if (!facilityId) return null;

    try {
      // 現在のユーザー情報を取得
      const { data: { user } } = await supabase.auth.getUser();

      let authorName = '不明';
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();
        authorName = userData?.name || user.email || '不明';
      }

      const { data, error: insertError } = await supabase
        .from('knowledge_articles')
        .insert({
          facility_id: facilityId,
          title: input.title,
          content: input.content,
          summary: input.summary || input.content.substring(0, 100),
          category: input.category,
          tags: input.tags || [],
          is_admin_locked: input.isAdminLocked ?? false,
          is_published: input.isPublished ?? true,
          is_pinned: input.isPinned ?? false,
          attachments: input.attachments || [],
          author_id: user?.id,
          author_name: authorName,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newArticle = mapArticleFromDB(data);
      setArticles(prev => [newArticle, ...prev]);

      return newArticle;
    } catch (err) {
      console.error('Error creating article:', err);
      setError('記事の作成に失敗しました');
      return null;
    }
  }, [facilityId]);

  // 記事更新
  const updateArticle = useCallback(async (id: string, input: Partial<KnowledgeArticleInput>): Promise<boolean> => {
    try {
      // 現在のユーザー情報を取得
      const { data: { user } } = await supabase.auth.getUser();

      let editorName = '不明';
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();
        editorName = userData?.name || user.email || '不明';
      }

      const updateData: Record<string, unknown> = {
        last_editor_id: user?.id,
        last_editor_name: editorName,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.content !== undefined) {
        updateData.content = input.content;
        updateData.summary = input.summary || input.content.substring(0, 100);
      }
      if (input.category !== undefined) updateData.category = input.category;
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.isAdminLocked !== undefined) updateData.is_admin_locked = input.isAdminLocked;
      if (input.isPublished !== undefined) updateData.is_published = input.isPublished;
      if (input.isPinned !== undefined) updateData.is_pinned = input.isPinned;
      if (input.attachments !== undefined) updateData.attachments = input.attachments;

      const { error: updateError } = await supabase
        .from('knowledge_articles')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      // ローカル状態を更新
      setArticles(prev => prev.map(article => {
        if (article.id !== id) return article;
        return {
          ...article,
          ...input,
          lastEditorId: user?.id,
          lastEditorName: editorName,
          updatedAt: new Date().toISOString(),
        };
      }));

      return true;
    } catch (err) {
      console.error('Error updating article:', err);
      setError('記事の更新に失敗しました');
      return false;
    }
  }, []);

  // 記事削除
  const deleteArticle = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('knowledge_articles')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setArticles(prev => prev.filter(article => article.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting article:', err);
      setError('記事の削除に失敗しました');
      return false;
    }
  }, []);

  // 閲覧数増加
  const incrementViewCount = useCallback(async (id: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 閲覧履歴をupsert
      await supabase
        .from('knowledge_article_views')
        .upsert({
          article_id: id,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
        }, {
          onConflict: 'article_id,user_id',
        });

      // view_countを更新（RPCがない場合はエラーを無視）
      try {
        await supabase.rpc('increment_view_count', { article_id: id });
      } catch {
        // RPCがなければスキップ（view_countはオプション機能）
      }
    } catch (err) {
      console.error('Error incrementing view count:', err);
    }
  }, []);

  // 検索
  const searchArticles = useCallback(async (query: string): Promise<KnowledgeArticle[]> => {
    if (!facilityId || !query.trim()) return [];

    try {
      const { data, error: searchError } = await supabase
        .from('knowledge_articles')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_published', true)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (searchError) throw searchError;

      return (data || []).map(mapArticleFromDB);
    } catch (err) {
      console.error('Error searching articles:', err);
      return [];
    }
  }, [facilityId]);

  // 編集権限チェック
  const canEdit = useCallback((article: KnowledgeArticle, userId: string, isAdmin: boolean): boolean => {
    // 管理者ロック記事は管理者のみ編集可能
    if (article.isAdminLocked) {
      return isAdmin;
    }
    // それ以外は誰でも編集可能
    return true;
  }, []);

  // 初期読み込み
  useEffect(() => {
    if (facilityId) {
      fetchCategories();
      fetchArticles();
    }
  }, [facilityId, fetchCategories, fetchArticles]);

  return {
    articles,
    categories,
    pinnedArticles,
    recentArticles,
    loading,
    error,
    fetchArticles,
    fetchArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    incrementViewCount,
    fetchCategories,
    initializeDefaultCategories,
    searchArticles,
    canEdit,
  };
}
