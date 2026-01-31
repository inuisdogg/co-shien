/**
 * 公式規定・制度ビュー
 * 就業規則、賃金規定、福利厚生などのPDF文書を表示・管理
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  Wallet,
  Heart,
  Shield,
  FolderOpen,
  Download,
  Eye,
  Edit,
  Trash2,
  Upload,
  X,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCompanyRegulations } from '@/hooks/useCompanyRegulations';
import { CompanyRegulation, RegulationCategory, CompanyRegulationInput } from '@/types';
import FileUploader from '@/components/common/FileUploader';

// アイコンマッピング
const iconMap: Record<string, React.ElementType> = {
  FileText,
  Wallet,
  Heart,
  Shield,
  FolderOpen,
};

interface CompanyRegulationsViewProps {
  facilityId: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
  onBack: () => void;
}

// 規定追加/編集モーダル
interface RegulationEditorProps {
  regulation?: CompanyRegulation | null;
  categories: RegulationCategory[];
  onSave: (data: CompanyRegulationInput) => Promise<void>;
  onClose: () => void;
}

const RegulationEditor: React.FC<RegulationEditorProps> = ({
  regulation,
  categories,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(regulation?.title || '');
  const [description, setDescription] = useState(regulation?.description || '');
  const [categoryCode, setCategoryCode] = useState(regulation?.categoryCode || categories[0]?.code || 'employment_rules');
  const [version, setVersion] = useState(regulation?.version || '');
  const [effectiveDate, setEffectiveDate] = useState(regulation?.effectiveDate || '');
  const [fileUrl, setFileUrl] = useState(regulation?.fileUrl || '');
  const [fileName, setFileName] = useState(regulation?.fileName || '');
  const [saving, setSaving] = useState(false);

  const isEditing = !!regulation;

  const handleFileUpload = (url: string, name: string) => {
    setFileUrl(url);
    setFileName(name);
    if (!title) {
      // ファイル名からタイトルを自動設定（拡張子を除く）
      setTitle(name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }
    if (!fileUrl) {
      alert('ファイルをアップロードしてください');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        categoryCode,
        fileUrl,
        fileName,
        version: version.trim() || undefined,
        effectiveDate: effectiveDate || undefined,
      });
      onClose();
    } catch (err) {
      alert(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">
            {isEditing ? '規定を編集' : '規定を追加'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* ファイルアップロード */}
          {!fileUrl ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDFファイル <span className="text-red-500">*</span>
              </label>
              <FileUploader
                bucket="documents"
                folder="regulations"
                onUpload={handleFileUpload}
                onError={(error) => alert(error)}
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                maxSizeMB={50}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">{fileName}</span>
              </div>
              <button
                onClick={() => { setFileUrl(''); setFileName(''); }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                変更
              </button>
            </div>
          )}

          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：就業規則（本則）"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カテゴリ
            </label>
            <select
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {categories.map((cat) => (
                <option key={cat.code} value={cat.code}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="この規定の概要や補足事項"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* バージョン・施行日 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                バージョン
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="例：2024年4月版"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                施行日
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !fileUrl || !title.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

// PDF ビューアモーダル
interface PDFViewerProps {
  regulation: CompanyRegulation;
  onClose: () => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ regulation, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-50">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="font-bold text-gray-900">{regulation.title}</h2>
            {regulation.version && (
              <p className="text-xs text-gray-500">{regulation.version}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={regulation.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            新しいタブで開く
          </a>
          <a
            href={regulation.fileUrl}
            download={regulation.fileName}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            ダウンロード
          </a>
        </div>
      </div>

      {/* PDF表示 */}
      <div className="flex-1 overflow-hidden bg-gray-200">
        <iframe
          src={`${regulation.fileUrl}#toolbar=1`}
          className="w-full h-full"
          title={regulation.title}
        />
      </div>
    </div>
  );
};

// メインコンポーネント
const CompanyRegulationsView: React.FC<CompanyRegulationsViewProps> = ({
  facilityId,
  userId,
  userName,
  isAdmin,
  onBack,
}) => {
  const {
    regulations,
    categories,
    loading,
    getRegulationsByCategory,
    addRegulation,
    updateRegulation,
    deleteRegulation,
    recordView,
    searchRegulations,
  } = useCompanyRegulations(facilityId);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['employment_rules']));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompanyRegulation[] | null>(null);
  const [selectedRegulation, setSelectedRegulation] = useState<CompanyRegulation | null>(null);
  const [editingRegulation, setEditingRegulation] = useState<CompanyRegulation | null | 'new'>(null);

  // カテゴリ展開切り替え
  const toggleCategory = (code: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  // 検索
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const results = await searchRegulations(searchQuery);
    setSearchResults(results);
  }, [searchQuery, searchRegulations]);

  // 規定を開く
  const openRegulation = async (regulation: CompanyRegulation) => {
    setSelectedRegulation(regulation);
    await recordView(regulation.id, userId);
  };

  // 規定を保存
  const handleSave = async (data: CompanyRegulationInput) => {
    if (editingRegulation === 'new') {
      await addRegulation(data, userId, userName);
    } else if (editingRegulation) {
      await updateRegulation(editingRegulation.id, data);
    }
  };

  // 規定を削除
  const handleDelete = async (regulation: CompanyRegulation) => {
    if (!confirm(`「${regulation.title}」を削除しますか？`)) return;
    await deleteRegulation(regulation.id);
  };

  // 日付フォーマット
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

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
          <h1 className="font-bold text-gray-900">公式規定・制度</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditingRegulation('new')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            規定を追加
          </button>
        )}
      </div>

      {/* 検索バー */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="規定を検索..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResults(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4">
        {searchResults !== null ? (
          // 検索結果
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-700">
                検索結果 ({searchResults.length}件)
              </h2>
              <button
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                クリア
              </button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                「{searchQuery}」に一致する規定が見つかりません
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((regulation) => (
                  <RegulationItem
                    key={regulation.id}
                    regulation={regulation}
                    isAdmin={isAdmin}
                    onClick={() => openRegulation(regulation)}
                    onEdit={() => setEditingRegulation(regulation)}
                    onDelete={() => handleDelete(regulation)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // カテゴリ別表示
          <div className="space-y-3">
            {categories.map((category) => {
              const categoryRegulations = getRegulationsByCategory(category.code);
              const isExpanded = expandedCategories.has(category.code);
              const Icon = iconMap[category.icon || 'FolderOpen'] || FolderOpen;

              return (
                <div key={category.code} className="bg-gray-50 rounded-xl overflow-hidden">
                  {/* カテゴリヘッダー */}
                  <button
                    onClick={() => toggleCategory(category.code)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-gray-900">{category.name}</h3>
                        <p className="text-xs text-gray-500">
                          {categoryRegulations.length}件の文書
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* 規定一覧 */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-2">
                          {categoryRegulations.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">
                              まだ規定が登録されていません
                            </p>
                          ) : (
                            categoryRegulations.map((regulation) => (
                              <RegulationItem
                                key={regulation.id}
                                regulation={regulation}
                                isAdmin={isAdmin}
                                onClick={() => openRegulation(regulation)}
                                onEdit={() => setEditingRegulation(regulation)}
                                onDelete={() => handleDelete(regulation)}
                              />
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF ビューア */}
      {selectedRegulation && (
        <PDFViewer
          regulation={selectedRegulation}
          onClose={() => setSelectedRegulation(null)}
        />
      )}

      {/* エディタモーダル */}
      {editingRegulation && (
        <RegulationEditor
          regulation={editingRegulation === 'new' ? null : editingRegulation}
          categories={categories}
          onSave={handleSave}
          onClose={() => setEditingRegulation(null)}
        />
      )}
    </div>
  );
};

// 規定アイテムコンポーネント
interface RegulationItemProps {
  regulation: CompanyRegulation;
  isAdmin: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const RegulationItem: React.FC<RegulationItemProps> = ({
  regulation,
  isAdmin,
  onClick,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-purple-300 transition-colors">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-gray-900 truncate">{regulation.title}</h4>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {regulation.version && (
                <span>{regulation.version}</span>
              )}
              {regulation.effectiveDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  施行: {new Date(regulation.effectiveDate).toLocaleDateString('ja-JP')}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {regulation.viewCount}
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
      </button>

      {isAdmin && (
        <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-gray-100 bg-gray-50">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-gray-400 hover:text-purple-600 rounded transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CompanyRegulationsView;
