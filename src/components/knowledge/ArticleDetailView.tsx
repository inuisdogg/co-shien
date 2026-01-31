/**
 * 記事詳細ビュー
 * Markdownコンテンツと添付ファイルを表示
 */

'use client';

import React from 'react';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Lock,
  Clock,
  Eye,
  Download,
  FileText,
  User,
} from 'lucide-react';
import { KnowledgeArticle } from '@/types';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';

interface ArticleDetailViewProps {
  article: KnowledgeArticle;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

const ArticleDetailView: React.FC<ArticleDetailViewProps> = ({
  article,
  canEdit,
  onEdit,
  onDelete,
  onBack,
}) => {
  // 日時フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // ファイルサイズフォーマット
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {article.isAdminLocked && (
                <span title="管理者のみ編集可能">
                  <Lock className="w-4 h-4 text-amber-500" />
                </span>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Edit className="w-4 h-4" />
              編集
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* タイトル */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{article.title}</h1>

          {/* メタ情報 */}
          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>更新: {formatDate(article.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>
                {article.lastEditorName || article.authorName || '不明'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>{article.viewCount} 回閲覧</span>
            </div>
            {article.isAdminLocked && (
              <div className="flex items-center gap-1.5 text-amber-600">
                <Lock className="w-4 h-4" />
                <span>公式</span>
              </div>
            )}
          </div>

          {/* 本文 */}
          <div className="prose prose-gray max-w-none">
            <MarkdownRenderer content={article.content} />
          </div>

          {/* 添付ファイル */}
          {article.attachments && article.attachments.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                添付ファイル ({article.attachments.length})
              </h2>
              <div className="space-y-2">
                {article.attachments.map((file, index) => (
                  <a
                    key={index}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                        <FileText className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm group-hover:text-purple-600">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-gray-400 group-hover:text-purple-600" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* タグ */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticleDetailView;
