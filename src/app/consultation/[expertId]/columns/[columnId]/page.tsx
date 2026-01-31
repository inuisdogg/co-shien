'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Heart,
  Share2,
  MessageCircle,
  Eye,
  Clock,
  Lock,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExpertColumn, ExpertProfile, EXPERT_PROFESSION_LABELS } from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ColumnDetailPage() {
  const router = useRouter();
  const params = useParams();
  const expertId = params.expertId as string;
  const columnId = params.columnId as string;

  const [user, setUser] = useState<{ id: string; userType: string } | null>(null);
  const [column, setColumn] = useState<ExpertColumn | null>(null);
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
  }, []);

  // コラムとエキスパート情報を取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // コラム取得
        const { data: columnData, error: columnError } = await supabase
          .from('expert_columns')
          .select('*')
          .eq('id', columnId)
          .eq('is_published', true)
          .single();

        if (columnError) throw columnError;

        setColumn({
          id: columnData.id,
          expertId: columnData.expert_id,
          title: columnData.title,
          content: columnData.content,
          thumbnailUrl: columnData.thumbnail_url,
          tags: columnData.tags || [],
          isPublished: columnData.is_published,
          isPremium: columnData.is_premium,
          publishedAt: columnData.published_at,
          viewCount: columnData.view_count,
          likeCount: columnData.like_count,
          createdAt: columnData.created_at,
          updatedAt: columnData.updated_at,
        });
        setLikeCount(columnData.like_count || 0);

        // エキスパート情報取得
        const { data: expertData, error: expertError } = await supabase
          .from('expert_profiles')
          .select('*')
          .eq('id', expertId)
          .single();

        if (expertError) throw expertError;

        setExpert({
          id: expertData.id,
          userId: expertData.user_id,
          profession: expertData.profession,
          displayName: expertData.display_name,
          introduction: expertData.introduction,
          experienceYears: expertData.experience_years,
          specialty: expertData.specialty || [],
          qualificationStatus: expertData.qualification_status,
          qualificationDocuments: expertData.qualification_documents || [],
          pricePerMessage: expertData.price_per_message,
          freeFirstMessage: expertData.free_first_message,
          isPublic: expertData.is_public,
          isAcceptingConsultations: expertData.is_accepting_consultations,
          pageTheme: expertData.page_theme,
          ratingAverage: expertData.rating_average,
          ratingCount: expertData.rating_count,
          totalConsultations: expertData.total_consultations,
          totalColumns: expertData.total_columns || 0,
          createdAt: expertData.created_at,
          updatedAt: expertData.updated_at,
        });

        // 閲覧数をインクリメント
        await supabase
          .from('expert_columns')
          .update({ view_count: (columnData.view_count || 0) + 1 })
          .eq('id', columnId);

      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (columnId && expertId) {
      fetchData();
    }
  }, [columnId, expertId]);

  // いいね状態確認
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!user || !columnId) return;

      const { data } = await supabase
        .from('column_likes')
        .select('id')
        .eq('column_id', columnId)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!data);
    };

    checkLikeStatus();
  }, [user, columnId]);

  const handleLike = async () => {
    if (!user || !columnId) return;

    try {
      if (isLiked) {
        await supabase
          .from('column_likes')
          .delete()
          .eq('column_id', columnId)
          .eq('user_id', user.id);

        setIsLiked(false);
        setLikeCount((prev) => prev - 1);
      } else {
        await supabase.from('column_likes').insert({
          column_id: columnId,
          user_id: user.id,
        });

        setIsLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!column || !expert) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-500">コラムが見つかりません</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
        >
          戻る
        </button>
      </div>
    );
  }

  const primaryColor = expert.pageTheme?.primaryColor || '#10B981';
  const isPremiumLocked = column.isPremium && user?.userType !== 'subscriber'; // TODO: サブスク確認

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto">
        {/* サムネイル */}
        {column.thumbnailUrl && (
          <img
            src={column.thumbnailUrl}
            alt={column.title}
            className="w-full h-48 sm:h-64 object-cover"
          />
        )}

        <div className="px-4 py-6">
          {/* タグ */}
          {column.tags && column.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {column.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 text-sm rounded-full"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* タイトル */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{column.title}</h1>

          {/* メタ情報 */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(column.publishedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {column.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {likeCount}
            </span>
          </div>

          {/* エキスパート情報 */}
          <Link
            href={`/expert/${expertId}`}
            className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm mb-6"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
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
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{expert.displayName}</span>
                {expert.qualificationStatus === 'verified' && (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <p className="text-sm text-gray-500">
                {EXPERT_PROFESSION_LABELS[expert.profession]}
              </p>
            </div>
          </Link>

          {/* 本文 */}
          {isPremiumLocked ? (
            <div>
              <div className="prose prose-gray max-w-none mb-6">
                <p className="whitespace-pre-wrap text-gray-700">
                  {column.content.slice(0, 300)}...
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white to-transparent" />
                <div className="relative text-center py-12">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    購読者限定コンテンツ
                  </h3>
                  <p className="text-gray-500 mb-4">
                    続きを読むには月額購読が必要です
                  </p>
                  <button
                    className="px-6 py-2.5 text-white font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: primaryColor }}
                  >
                    月額購読する
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-gray max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {column.content}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* フッター */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={handleLike}
            disabled={!user}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isLiked
                ? 'bg-pink-50 text-pink-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-pink-500' : ''}`} />
            <span>{likeCount}</span>
          </button>
          <Link
            href={`/expert/${expertId}/consult`}
            className="flex items-center gap-2 px-6 py-2.5 text-white font-medium rounded-lg transition-colors"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageCircle className="w-5 h-5" />
            相談する
          </Link>
        </div>
      </div>
    </div>
  );
}
