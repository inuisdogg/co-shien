'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ExpertProfile,
  ExpertProfileFormData,
  ExpertDashboardStats,
  mapExpertProfileFromDB,
  DEFAULT_EXPERT_THEME,
} from '@/types/expert';

export type UseExpertProfileReturn = {
  profile: ExpertProfile | null;
  isLoading: boolean;
  error: string | null;
  isExpert: boolean;

  // CRUD操作
  createProfile: (data: ExpertProfileFormData) => Promise<ExpertProfile | null>;
  updateProfile: (data: Partial<ExpertProfileFormData>) => Promise<boolean>;

  // 統計
  stats: ExpertDashboardStats | null;
  loadStats: () => Promise<void>;

  // リフレッシュ
  refresh: () => Promise<void>;
};

export function useExpertProfile(userId?: string): UseExpertProfileReturn {
  const [profile, setProfile] = useState<ExpertProfile | null>(null);
  const [stats, setStats] = useState<ExpertDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // プロフィール取得
  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('expert_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setProfile(mapExpertProfileFromDB(data));
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching expert profile:', err);
      setError('プロフィールの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // プロフィール作成
  const createProfile = useCallback(async (formData: ExpertProfileFormData): Promise<ExpertProfile | null> => {
    if (!userId) {
      setError('ユーザーIDが必要です');
      return null;
    }

    try {
      setError(null);

      const insertData = {
        user_id: userId,
        display_name: formData.displayName,
        profession: formData.profession,
        specialty: formData.specialty || [],
        introduction: formData.introduction,
        experience_years: formData.experienceYears,
        qualification_documents: formData.qualificationDocuments || [],
        page_theme: formData.pageTheme || DEFAULT_EXPERT_THEME,
        price_per_message: formData.pricePerMessage,
        free_first_message: formData.freeFirstMessage,
        is_public: formData.isPublic,
        is_accepting_consultations: formData.isAcceptingConsultations,
      };

      const { data, error: insertError } = await supabase
        .from('expert_profiles')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const newProfile = mapExpertProfileFromDB(data);
      setProfile(newProfile);
      return newProfile;
    } catch (err) {
      console.error('Error creating expert profile:', err);
      setError('プロフィールの作成に失敗しました');
      return null;
    }
  }, [userId]);

  // プロフィール更新
  const updateProfile = useCallback(async (formData: Partial<ExpertProfileFormData>): Promise<boolean> => {
    if (!profile) {
      setError('プロフィールが見つかりません');
      return false;
    }

    try {
      setError(null);

      const updateData: Record<string, unknown> = {};

      if (formData.displayName !== undefined) updateData.display_name = formData.displayName;
      if (formData.profession !== undefined) updateData.profession = formData.profession;
      if (formData.specialty !== undefined) updateData.specialty = formData.specialty;
      if (formData.introduction !== undefined) updateData.introduction = formData.introduction;
      if (formData.experienceYears !== undefined) updateData.experience_years = formData.experienceYears;
      if (formData.qualificationDocuments !== undefined) updateData.qualification_documents = formData.qualificationDocuments;
      if (formData.pageTheme !== undefined) updateData.page_theme = formData.pageTheme;
      if (formData.pricePerMessage !== undefined) updateData.price_per_message = formData.pricePerMessage;
      if (formData.freeFirstMessage !== undefined) updateData.free_first_message = formData.freeFirstMessage;
      if (formData.isPublic !== undefined) updateData.is_public = formData.isPublic;
      if (formData.isAcceptingConsultations !== undefined) updateData.is_accepting_consultations = formData.isAcceptingConsultations;

      const { data, error: updateError } = await supabase
        .from('expert_profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProfile(mapExpertProfileFromDB(data));
      return true;
    } catch (err) {
      console.error('Error updating expert profile:', err);
      setError('プロフィールの更新に失敗しました');
      return false;
    }
  }, [profile]);

  // 統計取得
  const loadStats = useCallback(async () => {
    if (!profile) return;

    try {
      // 相談数
      const { count: openCount } = await supabase
        .from('consultation_threads')
        .select('*', { count: 'exact', head: true })
        .eq('expert_id', profile.id)
        .eq('status', 'open');

      // 未読メッセージ数
      const { data: threads } = await supabase
        .from('consultation_threads')
        .select('id')
        .eq('expert_id', profile.id);

      let unreadCount = 0;
      if (threads && threads.length > 0) {
        const threadIds = threads.map(t => t.id);
        const { count } = await supabase
          .from('consultation_messages')
          .select('*', { count: 'exact', head: true })
          .in('thread_id', threadIds)
          .eq('sender_type', 'client')
          .eq('is_read', false);
        unreadCount = count || 0;
      }

      // コラム統計
      const { data: columns } = await supabase
        .from('expert_columns')
        .select('view_count, like_count')
        .eq('expert_id', profile.id);

      let totalColumnViews = 0;
      let totalColumnLikes = 0;
      if (columns) {
        columns.forEach(col => {
          totalColumnViews += col.view_count || 0;
          totalColumnLikes += col.like_count || 0;
        });
      }

      // サブスク数
      const { count: subscriberCount } = await supabase
        .from('expert_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('expert_id', profile.id)
        .eq('status', 'active');

      setStats({
        totalConsultations: profile.totalConsultations,
        openConsultations: openCount || 0,
        unreadMessages: unreadCount,
        monthlyRevenue: 0, // モック
        totalRevenue: 0,   // モック
        totalColumns: profile.totalColumns,
        totalColumnViews,
        totalColumnLikes,
        activeSubscribers: subscriberCount || 0,
        averageRating: profile.ratingAverage,
        totalRatings: profile.ratingCount,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [profile]);

  // 初期ロード
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    isExpert: !!profile,
    createProfile,
    updateProfile,
    stats,
    loadStats,
    refresh: fetchProfile,
  };
}

// 公開エキスパート一覧取得用フック
export function usePublicExperts(filters?: {
  profession?: string[];
  specialty?: string[];
  limit?: number;
}) {
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('expert_profiles')
        .select('*')
        .eq('is_public', true)
        .eq('qualification_status', 'verified')
        .eq('is_accepting_consultations', true)
        .order('rating_average', { ascending: false });

      if (filters?.profession && filters.profession.length > 0) {
        query = query.in('profession', filters.profession);
      }

      if (filters?.specialty && filters.specialty.length > 0) {
        query = query.overlaps('specialty', filters.specialty);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setExperts((data || []).map(mapExpertProfileFromDB));
    } catch (err) {
      console.error('Error fetching experts:', err);
      setError('エキスパート一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [filters?.profession, filters?.specialty, filters?.limit]);

  useEffect(() => {
    fetchExperts();
  }, [fetchExperts]);

  return { experts, isLoading, error, refresh: fetchExperts };
}

// 単一エキスパート取得用フック（公開ページ用）
export function usePublicExpert(expertId: string) {
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExpert = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('expert_profiles')
          .select('*')
          .eq('id', expertId)
          .eq('is_public', true)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (data) {
          setExpert(mapExpertProfileFromDB(data));
        } else {
          setError('エキスパートが見つかりません');
        }
      } catch (err) {
        console.error('Error fetching expert:', err);
        setError('エキスパート情報の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (expertId) {
      fetchExpert();
    }
  }, [expertId]);

  return { expert, isLoading, error };
}
