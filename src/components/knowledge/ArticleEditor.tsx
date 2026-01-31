/**
 * 記事エディター
 * Notion風リッチテキストエディターを使用
 */

'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Eye,
  Edit,
  Lock,
  Pin,
  Upload,
  X,
  FileText,
} from 'lucide-react';
import { KnowledgeArticle, KnowledgeCategory, KnowledgeAttachment } from '@/types';
import NotionLikeEditor from '@/components/common/NotionLikeEditor';
import FileUploader from '@/components/common/FileUploader';

interface ArticleEditorProps {
  article: KnowledgeArticle | null;
  categories: KnowledgeCategory[];
  isAdmin: boolean;
  onSave: (data: {
    title: string;
    content: string;
    category: string;
    isAdminLocked: boolean;
    isPinned: boolean;
    attachments?: KnowledgeAttachment[];
  }) => Promise<void>;
  onCancel: () => void;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({
  article,
  categories,
  isAdmin,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(article?.title || '');
  const [content, setContent] = useState(article?.content || '');
  const [category, setCategory] = useState(article?.category || categories[0]?.code || 'other');
  const [isAdminLocked, setIsAdminLocked] = useState(article?.isAdminLocked || false);
  const [isPinned, setIsPinned] = useState(article?.isPinned || false);
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>(article?.attachments || []);
  const [isPreview, setIsPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  const isEditing = !!article;

  const handleSave = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }
    if (!content.trim() || content === '<p></p>') {
      alert('本文を入力してください');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        content,
        category,
        isAdminLocked,
        isPinned,
        attachments,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (url: string, fileName: string) => {
    setAttachments(prev => [...prev, {
      url,
      name: fileName,
      type: fileName.split('.').pop() || 'unknown',
      size: 0,
    }]);
    setShowUploader(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900">
            {isEditing ? '記事を編集' : '新規記事作成'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isPreview
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {isPreview ? <Edit className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isPreview ? '編集に戻る' : 'プレビュー'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* タイトル入力 */}
          <input
            type="text"
            placeholder="タイトルを入力..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-3xl font-bold text-gray-900 border-none outline-none placeholder-gray-300 mb-4 bg-transparent"
          />

          {/* 設定バー */}
          <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b border-gray-200">
            {/* カテゴリ選択 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">カテゴリ:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 管理者ロック */}
            {isAdmin && (
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isAdminLocked}
                  onChange={(e) => setIsAdminLocked(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <Lock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">公式（編集制限）</span>
              </label>
            )}

            {/* ピン留め */}
            {isAdmin && (
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <Pin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">ピン留め</span>
              </label>
            )}

            {/* ファイル添付 */}
            <button
              onClick={() => setShowUploader(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-purple-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <Upload className="w-4 h-4" />
              ファイル添付
            </button>
          </div>

          {/* 本文エディター */}
          {isPreview ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div
                className="prose prose-sm sm:prose max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          ) : (
            <NotionLikeEditor
              content={content}
              onChange={setContent}
              placeholder="本文を入力...「/」でブロックを追加できます"
            />
          )}

          {/* 添付ファイル一覧 */}
          {attachments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                添付ファイル ({attachments.length})
              </h3>
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ファイルアップローダーモーダル */}
      {showUploader && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">ファイルを添付</h3>
              <button
                onClick={() => setShowUploader(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <FileUploader
              bucket="documents"
              folder="knowledge"
              onUpload={handleFileUpload}
              onError={(error) => alert(error)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
              maxSizeMB={20}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleEditor;
