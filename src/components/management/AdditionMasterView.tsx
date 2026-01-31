/**
 * 加算マスタ管理画面
 * - 法改正の登録・管理
 * - 加算バージョンの更新
 * - 変更履歴の閲覧
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  Plus,
  History,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Edit3,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  FileText,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// 型定義
interface LawRevision {
  id: string;
  revision_date: string;
  name: string;
  description: string | null;
  source_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface AdditionVersion {
  id: string;
  addition_id: string;
  version_number: number;
  units: number | null;
  is_percentage: boolean;
  percentage_rate: number | null;
  requirements: string | null;
  max_times_per_month: number | null;
  max_times_per_day: number | null;
  effective_from: string;
  effective_to: string | null;
  revision_id: string | null;
  notes: string | null;
  created_at: string;
}

interface Addition {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  category_code: string;
  addition_type: string;
  applicable_services: string[];
  is_active: boolean;
}

interface AdditionWithVersions extends Addition {
  versions: AdditionVersion[];
}

type TabType = 'revisions' | 'additions' | 'history';

export default function AdditionMasterView() {
  const [activeTab, setActiveTab] = useState<TabType>('revisions');
  const [revisions, setRevisions] = useState<LawRevision[]>([]);
  const [additions, setAdditions] = useState<AdditionWithVersions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 法改正フォーム
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [editingRevision, setEditingRevision] = useState<LawRevision | null>(null);
  const [revisionForm, setRevisionForm] = useState({
    revision_date: '',
    name: '',
    description: '',
    source_url: '',
  });

  // 加算バージョン更新
  const [selectedAddition, setSelectedAddition] = useState<AdditionWithVersions | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [versionForm, setVersionForm] = useState({
    revision_id: '',
    units: '',
    is_percentage: false,
    percentage_rate: '',
    requirements: '',
    max_times_per_month: '',
    max_times_per_day: '',
    effective_from: '',
    notes: '',
  });

  // データ取得
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 法改正一覧
      const { data: revData, error: revError } = await supabase
        .from('law_revisions')
        .select('*')
        .order('revision_date', { ascending: false });

      if (revError) throw revError;
      setRevisions(revData || []);

      // 加算一覧（バージョン含む）
      const { data: addData, error: addError } = await supabase
        .from('additions')
        .select('*')
        .order('display_order');

      if (addError) throw addError;

      // バージョン情報を取得
      const { data: verData, error: verError } = await supabase
        .from('addition_versions')
        .select('*')
        .order('version_number', { ascending: false });

      if (verError) throw verError;

      // 加算ごとにバージョンをグループ化
      const additionsWithVersions = (addData || []).map(addition => ({
        ...addition,
        versions: (verData || []).filter(v => v.addition_id === addition.id),
      }));

      setAdditions(additionsWithVersions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 法改正の保存
  const handleSaveRevision = async () => {
    try {
      if (editingRevision) {
        // 更新
        const { error } = await supabase
          .from('law_revisions')
          .update({
            revision_date: revisionForm.revision_date,
            name: revisionForm.name,
            description: revisionForm.description || null,
            source_url: revisionForm.source_url || null,
          })
          .eq('id', editingRevision.id);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('law_revisions')
          .insert({
            revision_date: revisionForm.revision_date,
            name: revisionForm.name,
            description: revisionForm.description || null,
            source_url: revisionForm.source_url || null,
          });

        if (error) throw error;
      }

      setShowRevisionForm(false);
      setEditingRevision(null);
      setRevisionForm({ revision_date: '', name: '', description: '', source_url: '' });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 新バージョンの作成
  const handleSaveVersion = async () => {
    if (!selectedAddition) return;

    try {
      const currentVersion = selectedAddition.versions[0];
      const newVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1;

      // 現行バージョンの終了日を設定
      if (currentVersion && !currentVersion.effective_to) {
        const effectiveToDate = new Date(versionForm.effective_from);
        effectiveToDate.setDate(effectiveToDate.getDate() - 1);

        await supabase
          .from('addition_versions')
          .update({ effective_to: effectiveToDate.toISOString().split('T')[0] })
          .eq('id', currentVersion.id);
      }

      // 新バージョンを作成
      const { error } = await supabase
        .from('addition_versions')
        .insert({
          addition_id: selectedAddition.id,
          version_number: newVersionNumber,
          units: versionForm.units ? parseInt(versionForm.units) : null,
          is_percentage: versionForm.is_percentage,
          percentage_rate: versionForm.percentage_rate ? parseFloat(versionForm.percentage_rate) : null,
          requirements: versionForm.requirements || null,
          max_times_per_month: versionForm.max_times_per_month ? parseInt(versionForm.max_times_per_month) : null,
          max_times_per_day: versionForm.max_times_per_day ? parseInt(versionForm.max_times_per_day) : null,
          effective_from: versionForm.effective_from,
          effective_to: null,
          revision_id: versionForm.revision_id || null,
          notes: versionForm.notes || null,
        });

      if (error) throw error;

      setShowVersionForm(false);
      setSelectedAddition(null);
      setVersionForm({
        revision_id: '',
        units: '',
        is_percentage: false,
        percentage_rate: '',
        requirements: '',
        max_times_per_month: '',
        max_times_per_day: '',
        effective_from: '',
        notes: '',
      });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // フィルタリング
  const filteredAdditions = additions.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 法改正名を取得
  const getRevisionName = (revisionId: string | null) => {
    if (!revisionId) return '不明';
    const rev = revisions.find(r => r.id === revisionId);
    return rev?.name || '不明';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Scale className="w-6 h-6 text-teal-600" />
              加算マスタ管理
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              法改正の登録、加算バージョンの更新、変更履歴の管理を行います
            </p>
          </div>
        </div>

        {/* タブ */}
        <div className="mt-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('revisions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'revisions'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Scale className="w-4 h-4 inline mr-1.5" />
            法改正管理
          </button>
          <button
            onClick={() => setActiveTab('additions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'additions'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-1.5" />
            加算バージョン
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4 inline mr-1.5" />
            変更履歴
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">エラーが発生しました</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* 法改正管理タブ */}
      {activeTab === 'revisions' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">法改正一覧</h3>
            <button
              onClick={() => {
                setEditingRevision(null);
                setRevisionForm({ revision_date: '', name: '', description: '', source_url: '' });
                setShowRevisionForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              新規登録
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {revisions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                法改正が登録されていません
              </div>
            ) : (
              revisions.map(revision => (
                <div key={revision.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                          {revision.revision_date}
                        </span>
                        <h4 className="font-medium text-gray-900">{revision.name}</h4>
                        {revision.is_active && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                            有効
                          </span>
                        )}
                      </div>
                      {revision.description && (
                        <p className="text-sm text-gray-500 mt-2">{revision.description}</p>
                      )}
                      {revision.source_url && (
                        <a
                          href={revision.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-teal-600 hover:underline mt-2 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          出典を見る
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingRevision(revision);
                        setRevisionForm({
                          revision_date: revision.revision_date,
                          name: revision.name,
                          description: revision.description || '',
                          source_url: revision.source_url || '',
                        });
                        setShowRevisionForm(true);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 加算バージョン管理タブ */}
      {activeTab === 'additions' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="加算名またはコードで検索..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {filteredAdditions.map(addition => {
              const currentVersion = addition.versions.find(v => !v.effective_to);
              const hasMultipleVersions = addition.versions.length > 1;

              return (
                <div key={addition.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{addition.name}</h4>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {addition.code}
                        </code>
                        {hasMultipleVersions && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            {addition.versions.length}バージョン
                          </span>
                        )}
                      </div>
                      {currentVersion && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">
                            {currentVersion.is_percentage
                              ? `${currentVersion.percentage_rate}%`
                              : `${currentVersion.units}単位`}
                          </span>
                          <span className="text-gray-400 mx-2">|</span>
                          <span>適用開始: {currentVersion.effective_from}</span>
                          {currentVersion.revision_id && (
                            <>
                              <span className="text-gray-400 mx-2">|</span>
                              <span className="text-blue-600">
                                {getRevisionName(currentVersion.revision_id)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAddition(addition);
                        if (currentVersion) {
                          setVersionForm({
                            revision_id: '',
                            units: currentVersion.units?.toString() || '',
                            is_percentage: currentVersion.is_percentage || false,
                            percentage_rate: currentVersion.percentage_rate?.toString() || '',
                            requirements: currentVersion.requirements || '',
                            max_times_per_month: currentVersion.max_times_per_month?.toString() || '',
                            max_times_per_day: currentVersion.max_times_per_day?.toString() || '',
                            effective_from: '',
                            notes: '',
                          });
                        }
                        setShowVersionForm(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      新バージョン
                    </button>
                  </div>

                  {/* バージョン履歴（展開可能） */}
                  {addition.versions.length > 1 && (
                    <details className="mt-3">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        バージョン履歴を表示
                      </summary>
                      <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                        {addition.versions.map(ver => (
                          <div key={ver.id} className="text-xs text-gray-600">
                            <span className="font-medium">v{ver.version_number}</span>
                            <span className="mx-2">|</span>
                            <span>
                              {ver.is_percentage
                                ? `${ver.percentage_rate}%`
                                : `${ver.units}単位`}
                            </span>
                            <span className="mx-2">|</span>
                            <span>
                              {ver.effective_from} 〜 {ver.effective_to || '現在'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 変更履歴タブ */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">変更履歴</h3>
            <p className="text-sm text-gray-500 mt-1">法改正ごとの加算変更を時系列で表示</p>
          </div>

          <div className="divide-y divide-gray-100">
            {revisions.map(revision => {
              const versionsForRevision = additions
                .flatMap(a => a.versions.filter(v => v.revision_id === revision.id)
                  .map(v => ({ ...v, additionName: a.name, additionCode: a.code })));

              return (
                <div key={revision.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-gray-900">{revision.name}</h4>
                      <p className="text-xs text-gray-500">適用日: {revision.revision_date}</p>
                    </div>
                  </div>

                  {versionsForRevision.length === 0 ? (
                    <p className="text-sm text-gray-400 ml-8">この改正に関連する加算変更はありません</p>
                  ) : (
                    <div className="ml-8 space-y-2">
                      {versionsForRevision.map(ver => (
                        <div key={ver.id} className="flex items-center gap-3 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium">{ver.additionName}</span>
                          <code className="text-xs bg-gray-100 px-1 rounded">{ver.additionCode}</code>
                          <span className="text-gray-500">→</span>
                          <span className="text-teal-600 font-medium">
                            {ver.is_percentage ? `${ver.percentage_rate}%` : `${ver.units}単位`}
                          </span>
                          {ver.notes && (
                            <span className="text-gray-400 text-xs">({ver.notes})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 法改正フォームモーダル */}
      {showRevisionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">
                {editingRevision ? '法改正を編集' : '法改正を登録'}
              </h3>
              <button
                onClick={() => setShowRevisionForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  適用日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={revisionForm.revision_date}
                  onChange={(e) => setRevisionForm({ ...revisionForm, revision_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  改正名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={revisionForm.name}
                  onChange={(e) => setRevisionForm({ ...revisionForm, name: e.target.value })}
                  placeholder="例: 令和8年度障害福祉サービス等報酬改定"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={revisionForm.description}
                  onChange={(e) => setRevisionForm({ ...revisionForm, description: e.target.value })}
                  placeholder="改正の概要..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  出典URL
                </label>
                <input
                  type="url"
                  value={revisionForm.source_url}
                  onChange={(e) => setRevisionForm({ ...revisionForm, source_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRevisionForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveRevision}
                disabled={!revisionForm.revision_date || !revisionForm.name}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新バージョンフォームモーダル */}
      {showVersionForm && selectedAddition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-gray-800">新バージョンを作成</h3>
                <p className="text-sm text-gray-500">{selectedAddition.name}</p>
              </div>
              <button
                onClick={() => setShowVersionForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    新バージョンを作成すると、現行バージョンの終了日が自動設定されます。
                    過去のダッシュボードでは古いバージョンの単位数で計算されます。
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  関連する法改正
                </label>
                <select
                  value={versionForm.revision_id}
                  onChange={(e) => setVersionForm({ ...versionForm, revision_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">選択してください</option>
                  {revisions.map(rev => (
                    <option key={rev.id} value={rev.id}>
                      {rev.name} ({rev.revision_date})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  適用開始日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={versionForm.effective_from}
                  onChange={(e) => setVersionForm({ ...versionForm, effective_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={versionForm.is_percentage}
                    onChange={(e) => setVersionForm({ ...versionForm, is_percentage: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">割合加算</span>
                </label>
              </div>

              {versionForm.is_percentage ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    割合（%）
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={versionForm.percentage_rate}
                    onChange={(e) => setVersionForm({ ...versionForm, percentage_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    単位数
                  </label>
                  <input
                    type="number"
                    value={versionForm.units}
                    onChange={(e) => setVersionForm({ ...versionForm, units: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    月間上限回数
                  </label>
                  <input
                    type="number"
                    value={versionForm.max_times_per_month}
                    onChange={(e) => setVersionForm({ ...versionForm, max_times_per_month: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日次上限回数
                  </label>
                  <input
                    type="number"
                    value={versionForm.max_times_per_day}
                    onChange={(e) => setVersionForm({ ...versionForm, max_times_per_day: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  算定要件
                </label>
                <textarea
                  value={versionForm.requirements}
                  onChange={(e) => setVersionForm({ ...versionForm, requirements: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  変更メモ
                </label>
                <input
                  type="text"
                  value={versionForm.notes}
                  onChange={(e) => setVersionForm({ ...versionForm, notes: e.target.value })}
                  placeholder="例: 単位数増加"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowVersionForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveVersion}
                disabled={!versionForm.effective_from}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                バージョンを作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
