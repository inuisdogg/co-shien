'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Star,
  MessageCircle,
  FileText,
  CheckCircle,
  Clock,
  Heart,
  Share2,
  Bell,
  Video,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { usePublicExpert } from '@/hooks/useExpertProfile';
import { supabase } from '@/lib/supabase';
import {
  EXPERT_PROFESSION_LABELS,
  ExpertColumn,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ExpertPublicPage() {
  const router = useRouter();
  const params = useParams();
  const expertId = params.expertId as string;

  const [user, setUser] = useState<{ id: string; userType: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'columns'>('profile');
  const [columns, setColumns] = useState<ExpertColumn[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(true);

  const { expert, isLoading, error } = usePublicExpert(expertId);

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

  // コラム取得
  useEffect(() => {
    const fetchColumns = async () => {
      if (!expertId) return;

      try {
        setColumnsLoading(true);
        const { data } = await supabase
          .from('expert_columns')
          .select('*')
          .eq('expert_id', expertId)
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(10);

        setColumns((data || []).map(row => ({
          id: row.id,
          expertId: row.expert_id,
          title: row.title,
          content: row.content,
          thumbnailUrl: row.thumbnail_url,
          tags: row.tags || [],
          isPublished: row.is_published,
          isPremium: row.is_premium,
          publishedAt: row.published_at,
          viewCount: row.view_count,
          likeCount: row.like_count,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })));
      } catch (err) {
        console.error('Error fetching columns:', err);
      } finally {
        setColumnsLoading(false);
      }
    };

    fetchColumns();
  }, [expertId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !expert) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">
          エキスパートが見つかりません
        </h2>
        <p className="text-gray-500 mb-4">
          {error || 'URLを確認してください'}
        </p>
        <button
          onClick={() => router.push('/expert')}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg"
        >
          エキスパート一覧へ
        </button>
      </div>
    );
  }

  const primaryColor = expert.pageTheme?.primaryColor || '#10B981';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div
        className="h-40 relative"
        style={{
          background: expert.pageTheme?.headerImage
            ? `url(${expert.pageTheme.headerImage}) center/cover`
            : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}99 100%)`,
        }}
      >
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="absolute top-4 right-4 flex gap-2">
          <button className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
            <Share2 className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* プロフィールカード */}
      <div className="max-w-2xl mx-auto px-4 -mt-16 relative z-10">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-6">
            {/* アバター */}
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-full border-4 border-white bg-white flex items-center justify-center text-3xl font-bold shadow-sm flex-shrink-0"
                style={{ color: primaryColor }}
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
              <div className="flex-1 min-w-0 pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-gray-900 truncate">
                    {expert.displayName}
                  </h1>
                  {expert.qualificationStatus === 'verified' && (
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-gray-600">
                  {EXPERT_PROFESSION_LABELS[expert.profession]}
                  {expert.experienceYears && ` • 経験${expert.experienceYears}年`}
                </p>
              </div>
            </div>

            {/* 専門分野 */}
            {expert.specialty.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {expert.specialty.map((tag, index) => (
                  <span
                    key={index}
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

            {/* 統計 */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
              {expert.ratingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-gray-900">
                    {expert.ratingAverage.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({expert.ratingCount}件)
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">
                  {expert.totalConsultations}件の相談
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            プロフィール
          </button>
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'columns'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            コラム ({columns.length})
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* 自己紹介 */}
            {expert.introduction && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-3">自己紹介</h2>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {expert.introduction}
                </p>
              </div>
            )}

            {/* 料金 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-3">相談料金</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">テキスト相談</span>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-lg font-bold"
                      style={{ color: primaryColor }}
                    >
                      {expert.pricePerMessage}
                    </span>
                    <span className="text-sm text-gray-500"> pt/回</span>
                    {expert.freeFirstMessage && (
                      <p className="text-xs text-amber-600">初回無料</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">ビデオ通話</span>
                  </div>
                  <span className="text-sm text-gray-500">Coming Soon</span>
                </div>
              </div>
            </div>

            {/* サブスク */}
            <div
              className="rounded-xl p-4 text-white relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
              }}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-5 h-5" />
                  <span className="font-bold">月額購読</span>
                </div>
                <p className="text-sm text-white/80 mb-3">
                  コラムの購読と優先相談権が含まれます
                </p>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-bold">980</span>
                  <span className="text-sm">円/月</span>
                </div>
                <button className="w-full py-2.5 bg-white text-emerald-600 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  購読する
                </button>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10">
                <Bell className="w-32 h-32" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'columns' && (
          <div className="space-y-4">
            {columnsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
              </div>
            ) : columns.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">まだコラムがありません</p>
              </div>
            ) : (
              columns.map((column) => (
                <Link
                  key={column.id}
                  href={`/expert/${expertId}/columns/${column.id}`}
                  className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {column.thumbnailUrl && (
                    <img
                      src={column.thumbnailUrl}
                      alt={column.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 line-clamp-2">
                        {column.title}
                      </h3>
                      {column.isPremium && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex-shrink-0">
                          購読者限定
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {column.likeCount}
                      </span>
                      <span>
                        {column.publishedAt &&
                          new Date(column.publishedAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* 固定フッター */}
      {expert.isAcceptingConsultations && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <Link
              href={`/expert/${expertId}/consult`}
              className="flex items-center justify-center gap-2 w-full py-3 text-white font-medium rounded-xl transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-5 h-5" />
              相談する
              {expert.freeFirstMessage && (
                <span className="px-2 py-0.5 bg-white/20 text-xs rounded-full">
                  初回無料
                </span>
              )}
            </Link>
          </div>
        </div>
      )}

      {!expert.isAcceptingConsultations && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-2 text-gray-500">
            <Clock className="w-5 h-5" />
            現在相談を受け付けていません
          </div>
        </div>
      )}
    </div>
  );
}
