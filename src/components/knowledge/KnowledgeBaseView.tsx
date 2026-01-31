/**
 * ナレッジベースビュー（従業員向けメイン画面）
 * カテゴリ一覧、ピン留め記事、最近の更新を表示
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Pin,
  Clock,
  ChevronRight,
  Plus,
  Scale,
  BookOpen,
  Building2,
  Lightbulb,
  HelpCircle,
  FileText,
  Library,
  Lock,
  ScrollText,
} from 'lucide-react';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useCompanyRegulations } from '@/hooks/useCompanyRegulations';
import { KnowledgeArticle, KnowledgeCategory, DEFAULT_KNOWLEDGE_CATEGORIES } from '@/types';
import ArticleDetailView from './ArticleDetailView';
import ArticleEditor from './ArticleEditor';
import CompanyRegulationsView from './CompanyRegulationsView';

// アイコンマッピング
const iconMap: Record<string, React.ElementType> = {
  Scale,
  BookOpen,
  Building2,
  Lightbulb,
  HelpCircle,
  FileText,
  Library,
};

interface KnowledgeBaseViewProps {
  facilityId: string;
  facilityName: string;
  userId: string;
  userName?: string;
  isAdmin: boolean;
  onClose: () => void;
}

type ViewMode = 'home' | 'category' | 'article' | 'editor' | 'regulations';

const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  facilityId,
  facilityName,
  userId,
  userName = '',
  isAdmin,
  onClose,
}) => {
  const {
    articles,
    categories,
    pinnedArticles,
    recentArticles,
    loading,
    fetchArticles,
    fetchArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    incrementViewCount,
    searchArticles,
    canEdit,
  } = useKnowledgeBase(facilityId);

  // 規定の件数を取得
  const { regulations } = useCompanyRegulations(facilityId);

  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);

  // 検索処理
  useEffect(() => {
    const debounce = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        const results = await searchArticles(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, searchArticles]);

  // 記事を開く
  const openArticle = async (article: KnowledgeArticle) => {
    const fullArticle = await fetchArticle(article.id);
    if (fullArticle) {
      setSelectedArticle(fullArticle);
      setViewMode('article');
      incrementViewCount(article.id);
    }
  };

  // カテゴリを開く
  const openCategory = (category: KnowledgeCategory) => {
    setSelectedCategory(category);
    fetchArticles({ category: category.code });
    setViewMode('category');
  };

  // 戻る
  const goBack = () => {
    if (viewMode === 'editor') {
      setViewMode(selectedArticle ? 'article' : 'home');
      setEditingArticle(null);
    } else if (viewMode === 'article') {
      setViewMode(selectedCategory ? 'category' : 'home');
      setSelectedArticle(null);
    } else if (viewMode === 'category') {
      setViewMode('home');
      setSelectedCategory(null);
      fetchArticles();
    } else if (viewMode === 'regulations') {
      setViewMode('home');
    } else {
      onClose();
    }
  };

  // 新規作成
  const handleCreate = () => {
    setEditingArticle(null);
    setViewMode('editor');
  };

  // 編集
  const handleEdit = (article: KnowledgeArticle) => {
    setEditingArticle(article);
    setViewMode('editor');
  };

  // 保存
  const handleSave = async (data: {
    title: string;
    content: string;
    category: string;
    isAdminLocked: boolean;
    isPinned: boolean;
  }) => {
    if (editingArticle) {
      await updateArticle(editingArticle.id, data);
      const updated = await fetchArticle(editingArticle.id);
      if (updated) setSelectedArticle(updated);
    } else {
      const newArticle = await createArticle(data);
      if (newArticle) setSelectedArticle(newArticle);
    }
    setViewMode(selectedArticle ? 'article' : 'home');
    setEditingArticle(null);
  };

  // カテゴリ用のアイコン取得
  const getCategoryIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || FileText;
    return IconComponent;
  };

  // 使用するカテゴリリスト
  const displayCategories = categories.length > 0
    ? categories
    : DEFAULT_KNOWLEDGE_CATEGORIES.map((cat, i) => ({
        id: `default-${cat.code}`,
        facilityId,
        code: cat.code,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        displayOrder: i + 1,
        isDefault: true,
        createdAt: new Date().toISOString(),
      }));

  // 時間表示
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}日前`;
    if (hours > 0) return `${hours}時間前`;
    return '今';
  };

  // 公式規定表示
  if (viewMode === 'regulations') {
    return (
      <CompanyRegulationsView
        facilityId={facilityId}
        userId={userId}
        userName={userName}
        isAdmin={isAdmin}
        onBack={goBack}
      />
    );
  }

  // エディター表示
  if (viewMode === 'editor') {
    return (
      <ArticleEditor
        article={editingArticle}
        categories={displayCategories}
        isAdmin={isAdmin}
        onSave={handleSave}
        onCancel={goBack}
      />
    );
  }

  // 記事詳細表示
  if (viewMode === 'article' && selectedArticle) {
    return (
      <ArticleDetailView
        article={selectedArticle}
        canEdit={canEdit(selectedArticle, userId, isAdmin)}
        onEdit={() => handleEdit(selectedArticle)}
        onDelete={async () => {
          if (confirm('この記事を削除しますか？')) {
            await deleteArticle(selectedArticle.id);
            goBack();
          }
        }}
        onBack={goBack}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">
              {viewMode === 'category' && selectedCategory
                ? selectedCategory.name
                : 'ナレッジベース'}
            </h1>
            <p className="text-xs text-gray-500">{facilityName}</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* 検索バー */}
        <div className="sticky top-0 bg-gray-50 px-4 py-3 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="記事を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 検索結果 */}
        {searchQuery && (
          <div className="px-4 pb-4">
            <h2 className="text-sm font-bold text-gray-500 mb-2">
              検索結果 {searchResults.length > 0 && `(${searchResults.length}件)`}
            </h2>
            {isSearching ? (
              <div className="text-center py-8 text-gray-500">検索中...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                「{searchQuery}」に一致する記事が見つかりません
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => openArticle(article)}
                    className="w-full text-left bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{article.title}</span>
                          {article.isAdminLocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                        {article.summary && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.summary}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ホーム画面 */}
        {!searchQuery && viewMode === 'home' && (
          <div className="px-4 pb-6 space-y-6">
            {/* 公式規定・制度セクション */}
            <button
              onClick={() => setViewMode('regulations')}
              className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200 hover:border-purple-300 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <ScrollText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">公式規定・制度</h2>
                    <p className="text-sm text-gray-500">
                      就業規則・賃金規定・福利厚生など
                      {regulations.length > 0 && ` (${regulations.length}件)`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-400" />
              </div>
            </button>

            {/* ピン留め記事 */}
            {pinnedArticles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Pin className="w-4 h-4 text-purple-600" />
                  <h2 className="text-sm font-bold text-gray-700">ピン留め記事</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {pinnedArticles.slice(0, 4).map((article) => (
                    <button
                      key={article.id}
                      onClick={() => openArticle(article)}
                      className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {article.isAdminLocked && <Lock className="w-3 h-3 text-gray-400" />}
                        <span className="font-medium text-gray-900 text-sm truncate">
                          {article.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {article.summary || article.content.substring(0, 50)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* カテゴリ */}
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-3">カテゴリ</h2>
              <div className="grid grid-cols-3 gap-2">
                {displayCategories.map((category) => {
                  const Icon = getCategoryIcon(category.icon);
                  const count = articles.filter(a => a.category === category.code && a.isPublished).length;
                  return (
                    <button
                      key={category.id}
                      onClick={() => openCategory(category)}
                      className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors text-center"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: category.color }} />
                      </div>
                      <div className="font-medium text-gray-900 text-xs">{category.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{count}件</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 最近更新された記事 */}
            {recentArticles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-bold text-gray-700">最近更新された記事</h2>
                </div>
                <div className="space-y-2">
                  {recentArticles.slice(0, 5).map((article) => (
                    <button
                      key={article.id}
                      onClick={() => openArticle(article)}
                      className="w-full text-left bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 text-sm">{article.title}</span>
                            {article.isAdminLocked && <Lock className="w-3 h-3 text-gray-400" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {formatTimeAgo(article.updatedAt)}
                            </span>
                            {article.lastEditorName && (
                              <span className="text-xs text-gray-400">
                                by {article.lastEditorName || article.authorName}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 記事がない場合 */}
            {articles.length === 0 && !loading && (
              <div className="text-center py-12">
                <Library className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">まだ記事がありません</p>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  最初の記事を作成
                </button>
              </div>
            )}
          </div>
        )}

        {/* カテゴリ別一覧 */}
        {!searchQuery && viewMode === 'category' && selectedCategory && (
          <div className="px-4 pb-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">読み込み中...</div>
            ) : (
              <>
                {articles.filter(a => a.category === selectedCategory.code && a.isPublished).length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">このカテゴリにはまだ記事がありません</p>
                    <button
                      onClick={handleCreate}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                      記事を作成
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {articles
                      .filter(a => a.category === selectedCategory.code && a.isPublished)
                      .map((article) => (
                        <button
                          key={article.id}
                          onClick={() => openArticle(article)}
                          className="w-full text-left bg-white rounded-lg p-4 border border-gray-200 hover:border-purple-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {article.isPinned && <Pin className="w-3.5 h-3.5 text-purple-500" />}
                                <span className="font-medium text-gray-900">{article.title}</span>
                                {article.isAdminLocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                              </div>
                              {article.summary && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{article.summary}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                <span>{formatTimeAgo(article.updatedAt)}</span>
                                <span>閲覧 {article.viewCount}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseView;
