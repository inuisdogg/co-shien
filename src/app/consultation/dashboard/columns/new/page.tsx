'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  Eye,
  Globe,
  Lock,
  ImageIcon,
  Tag,
  X,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useExpertProfile } from '@/hooks/useExpertProfile';
import { supabase } from '@/lib/supabase';
import { COMMON_SPECIALTY_TAGS } from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function NewColumnPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームデータ
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags((prev) => [...prev, customTag.trim()]);
      setCustomTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async (publish: boolean) => {
    if (!profile || !title.trim() || !content.trim()) {
      setError('タイトルと本文は必須です');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('expert_columns')
        .insert({
          expert_id: profile.id,
          title: title.trim(),
          content: content.trim(),
          thumbnail_url: thumbnailUrl || null,
          tags,
          is_published: publish,
          is_premium: isPremium,
          published_at: publish ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      router.push('/expert/dashboard/columns');
    } catch (err) {
      console.error('Error saving column:', err);
      setError('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const primaryColor = profile?.pageTheme?.primaryColor || '#10B981';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/expert/dashboard/columns')}
                className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="font-bold text-lg text-gray-900">コラムを作成</h1>
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                showPreview
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye className="w-4 h-4" />
              プレビュー
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6">
        {showPreview ? (
          // プレビュー表示
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{title || '（無題）'}</h1>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-sm rounded-full"
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
              <div className="prose prose-gray max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">
                  {content || '（本文なし）'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // 編集フォーム
          <div className="space-y-6">
            {/* タイトル */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="コラムのタイトルを入力..."
                maxLength={100}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
              />
            </div>

            {/* サムネイル */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ImageIcon className="w-4 h-4 inline-block mr-1" />
                サムネイル画像
              </label>
              {thumbnailUrl && (
                <div className="mb-3 relative">
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setThumbnailUrl('')}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="画像URLを入力..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            {/* タグ */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline-block mr-1" />
                タグ
              </label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="p-0.5 hover:bg-emerald-100 rounded-full"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_SPECIALTY_TAGS.slice(0, 8)
                  .filter((tag) => !tags.includes(tag))
                  .map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className="px-3 py-1 text-sm border border-gray-200 text-gray-600 rounded-full hover:border-emerald-300 hover:text-emerald-600"
                    >
                      {tag}
                    </button>
                  ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
                  placeholder="カスタムタグを追加..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={addCustomTag}
                  disabled={!customTag.trim()}
                  className="px-3 py-2 bg-emerald-500 text-white rounded-lg disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 本文 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                本文 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="コラムの内容を入力...&#10;&#10;Markdownは現在サポートしていません。&#10;改行はそのまま反映されます。"
                rows={15}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {content.length} 文字
              </p>
            </div>

            {/* 公開設定 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-medium text-gray-900 mb-4">公開設定</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-medium text-gray-900">購読者限定コンテンツ</span>
                  <p className="text-sm text-gray-500">
                    月額購読者のみが全文を閲覧できます
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </main>

      {/* 保存ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || !title.trim() || !content.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            下書き保存
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving || !title.trim() || !content.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Globe className="w-5 h-5" />
            )}
            公開する
          </button>
        </div>
      </div>
    </div>
  );
}
