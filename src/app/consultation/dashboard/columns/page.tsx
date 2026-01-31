'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Plus,
  FileText,
  Eye,
  Edit2,
  Trash2,
  Heart,
  Clock,
  Lock,
  Globe,
  Loader2,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import { useExpertProfile } from '@/hooks/useExpertProfile';
import { supabase } from '@/lib/supabase';
import { ExpertColumn } from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ExpertColumnsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [columns, setColumns] = useState<ExpertColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const { profile, isLoading: profileLoading } = useExpertProfile(user?.id);

  // ユーザー情報取得
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

  // コラム取得
  useEffect(() => {
    const fetchColumns = async () => {
      if (!profile?.id) return;

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('expert_columns')
          .select('*')
          .eq('expert_id', profile.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setColumns(
          (data || []).map((row) => ({
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
          }))
        );
      } catch (err) {
        console.error('Error fetching columns:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (profile) {
      fetchColumns();
    }
  }, [profile]);

  const handleDelete = async (columnId: string) => {
    if (!confirm('このコラムを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('expert_columns')
        .delete()
        .eq('id', columnId);

      if (error) throw error;

      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    } catch (err) {
      console.error('Error deleting column:', err);
    }
    setMenuOpenId(null);
  };

  const togglePublish = async (column: ExpertColumn) => {
    try {
      const { error } = await supabase
        .from('expert_columns')
        .update({
          is_published: !column.isPublished,
          published_at: !column.isPublished ? new Date().toISOString() : null,
        })
        .eq('id', column.id);

      if (error) throw error;

      setColumns((prev) =>
        prev.map((c) =>
          c.id === column.id
            ? {
                ...c,
                isPublished: !c.isPublished,
                publishedAt: !c.isPublished ? new Date().toISOString() : undefined,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error toggling publish:', err);
    }
    setMenuOpenId(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (profileLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="font-bold text-lg text-gray-900">コラム管理</h1>
            </div>
            <Link
              href="/expert/dashboard/columns/new"
              className="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600"
            >
              <Plus className="w-4 h-4" />
              新規作成
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {columns.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              コラムがありません
            </h3>
            <p className="text-gray-500 mb-4">
              専門知識を活かしたコラムを執筆してみましょう
            </p>
            <Link
              href="/expert/dashboard/columns/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
            >
              <Plus className="w-4 h-4" />
              コラムを作成
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {columns.map((column) => (
              <div
                key={column.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                <div className="flex">
                  {column.thumbnailUrl && (
                    <div className="w-32 h-24 flex-shrink-0">
                      <img
                        src={column.thumbnailUrl}
                        alt={column.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {column.isPublished ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                              <Globe className="w-3 h-3" />
                              公開中
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                              <Lock className="w-3 h-3" />
                              下書き
                            </span>
                          )}
                          {column.isPremium && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                              購読者限定
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-gray-900 line-clamp-1">
                          {column.title}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {column.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5" />
                            {column.likeCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(column.publishedAt || column.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setMenuOpenId(menuOpenId === column.id ? null : column.id)
                          }
                          className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {menuOpenId === column.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[140px] z-10">
                            <Link
                              href={`/expert/dashboard/columns/${column.id}/edit`}
                              className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Edit2 className="w-4 h-4" />
                              編集
                            </Link>
                            {column.isPublished && (
                              <Link
                                href={`/expert/${profile?.id}/columns/${column.id}`}
                                className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="w-4 h-4" />
                                プレビュー
                              </Link>
                            )}
                            <button
                              onClick={() => togglePublish(column)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {column.isPublished ? (
                                <>
                                  <Lock className="w-4 h-4" />
                                  非公開にする
                                </>
                              ) : (
                                <>
                                  <Globe className="w-4 h-4" />
                                  公開する
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(column.id)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              削除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
