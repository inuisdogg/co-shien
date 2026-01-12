/**
 * 運営指導準備コンポーネント
 * 38種の必要書類一覧とチェックリスト管理
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  Plus,
  Edit,
  Save,
  X,
  Calendar,
  FileText,
  CheckCircle,
  Circle,
  ExternalLink,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// チェックリストの型定義
type AuditChecklist = {
  id: string;
  facilityId: string;
  auditName: string;
  auditDate?: string;
  auditType?: 'regular' | 'follow_up' | 'complaint';
  checklist: Record<string, { checked: boolean; checkedAt?: string; checkedBy?: string; notes?: string }>;
  notes?: string;
  status: 'preparing' | 'ready' | 'completed' | 'archived';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

// 書類の型定義
type Document = {
  id: string;
  name: string;
  category: string;
  status: 'implemented' | 'partial' | 'not_implemented';
  navigateTo?: string; // 遷移先のactiveTab ID
  description?: string;
};

// 38種の必要書類定義
const requiredDocuments: Document[] = [
  // 事前提出書類
  { id: 'pre_1', name: '自己点検表', category: '事前提出書類', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'pre_2', name: '勤務体制一覧表', category: '事前提出書類', status: 'partial', navigateTo: 'shift', description: 'シフトデータから生成' },
  { id: 'pre_3', name: '加算算定点検表', category: '事前提出書類', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'pre_4', name: '利用者一覧表', category: '事前提出書類', status: 'partial', navigateTo: 'children', description: '児童一覧から生成' },

  // 従業員関係
  { id: 'emp_1', name: '雇用契約書・辞令', category: '従業員関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード（スタッフ別）' },
  { id: 'emp_2', name: '履歴書', category: '従業員関係', status: 'implemented', navigateTo: 'staff', description: 'スタッフ管理から出力' },
  { id: 'emp_3', name: '労働者名簿', category: '従業員関係', status: 'partial', navigateTo: 'staff', description: 'スタッフ一覧から生成' },
  { id: 'emp_4', name: '賃金関係書類', category: '従業員関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'emp_5', name: '守秘義務・機密保持誓約書', category: '従業員関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード（スタッフ別）' },
  { id: 'emp_6', name: '健康診断書', category: '従業員関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード（スタッフ別）' },
  { id: 'emp_7', name: '勤務形態一覧表', category: '従業員関係', status: 'partial', navigateTo: 'shift', description: 'シフトデータから生成' },
  { id: 'emp_8', name: '出勤簿・タイムカード', category: '従業員関係', status: 'partial', navigateTo: 'shift', description: 'シフト実績から生成' },
  { id: 'emp_9', name: '資格証明書', category: '従業員関係', status: 'implemented', navigateTo: 'staff', description: 'スタッフ管理から確認' },

  // 運営関係
  { id: 'ops_1', name: '指定申請関係書類', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_2', name: '平面図', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_3', name: '設備・備品台帳', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_4', name: '加算届出', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_5', name: '運営規定', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_6', name: '重要事項説明書', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_7', name: 'サービス利用契約書', category: '運営関係', status: 'partial', navigateTo: 'children', description: '契約情報から生成' },
  { id: 'ops_8', name: '加算算定要件書類', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_9', name: '就業規則・給与規則', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_10', name: '委員会議事録', category: '運営関係', status: 'implemented', navigateTo: 'committee', description: '委員会管理から出力' },
  { id: 'ops_11', name: '賠償責任保険証券', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'ops_12', name: '業務管理体制届', category: '運営関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },

  // 記録関係
  { id: 'rec_1', name: '国保連請求関係書類', category: '記録関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'rec_2', name: '領収書', category: '記録関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'rec_3', name: '地域交流記録', category: '記録関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'rec_4', name: '苦情・事故・ヒヤリハット記録', category: '記録関係', status: 'implemented', navigateTo: 'incident', description: '苦情・事故報告から出力' },
  { id: 'rec_5', name: '職員研修記録', category: '記録関係', status: 'implemented', navigateTo: 'training', description: '研修記録から出力' },
  { id: 'rec_6', name: '身体拘束・虐待記録', category: '記録関係', status: 'partial', navigateTo: 'incident', description: '事故報告から' },
  { id: 'rec_7', name: '消防計画・避難訓練記録', category: '記録関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'rec_8', name: '会計関係書類', category: '記録関係', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },

  // 利用者支援関連
  { id: 'usr_1', name: '個人情報取扱同意書', category: '利用者支援関連', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード（児童別）' },
  { id: 'usr_2', name: '個別支援計画書', category: '利用者支援関連', status: 'implemented', navigateTo: 'support-plan', description: '個別支援計画から出力' },
  { id: 'usr_3', name: '入退所記録', category: '利用者支援関連', status: 'partial', navigateTo: 'children', description: '契約情報から生成' },
  { id: 'usr_4', name: '利用者・入所者数書類', category: '利用者支援関連', status: 'partial', navigateTo: 'schedule', description: '予約データから生成' },
  { id: 'usr_5', name: '実施記録・業務日誌', category: '利用者支援関連', status: 'implemented', navigateTo: 'daily-log', description: '業務日誌から出力' },

  // その他
  { id: 'oth_1', name: '医薬品台帳', category: 'その他', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'oth_2', name: '衛生管理記録', category: 'その他', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
  { id: 'oth_3', name: '食事提供記録', category: 'その他', status: 'partial', navigateTo: 'documents', description: '書類管理からアップロード' },
];

// カテゴリごとにグループ化
const documentCategories = [
  { id: 'pre', name: '事前提出書類', color: 'bg-blue-500' },
  { id: 'emp', name: '従業員関係', color: 'bg-green-500' },
  { id: 'ops', name: '運営関係', color: 'bg-purple-500' },
  { id: 'rec', name: '記録関係', color: 'bg-orange-500' },
  { id: 'usr', name: '利用者支援関連', color: 'bg-pink-500' },
  { id: 'oth', name: 'その他', color: 'bg-gray-500' },
];

// ステータスラベル
const statusLabels = {
  implemented: { label: '実装済', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partial: { label: '一部対応', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  not_implemented: { label: '未実装', color: 'bg-gray-100 text-gray-500', icon: Circle },
};

// チェックリストステータス
const checklistStatusLabels = {
  preparing: { label: '準備中', color: 'bg-yellow-100 text-yellow-700' },
  ready: { label: '準備完了', color: 'bg-green-100 text-green-700' },
  completed: { label: '実施完了', color: 'bg-blue-100 text-blue-700' },
  archived: { label: 'アーカイブ', color: 'bg-gray-100 text-gray-500' },
};

// DBマッピング
const mapDbToChecklist = (row: any): AuditChecklist => ({
  id: row.id,
  facilityId: row.facility_id,
  auditName: row.audit_name,
  auditDate: row.audit_date,
  auditType: row.audit_type,
  checklist: row.checklist || {},
  notes: row.notes,
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

interface Props {
  setActiveTab?: (tab: string) => void;
}

export default function AuditPreparationView({ setActiveTab }: Props) {
  const { user, facility } = useAuth();
  const [checklists, setChecklists] = useState<AuditChecklist[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<AuditChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(documentCategories.map(c => c.id)));

  // 新規作成フォーム
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<'regular' | 'follow_up' | 'complaint'>('regular');

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_checklists')
        .select('*')
        .eq('facility_id', facility.id)
        .order('audit_date', { ascending: false });

      if (error) throw error;
      setChecklists((data || []).map(mapDbToChecklist));
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // チェックリスト作成
  const handleCreate = async () => {
    if (!facility?.id || !newName) {
      alert('運営指導名を入力してください');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('audit_checklists')
        .insert({
          facility_id: facility.id,
          audit_name: newName,
          audit_date: newDate || null,
          audit_type: newType,
          checklist: {},
          status: 'preparing',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchData();
      setSelectedChecklist(mapDbToChecklist(data));
      setIsCreating(false);
      setNewName('');
      setNewDate('');
    } catch (err) {
      console.error('作成エラー:', err);
      alert('作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // チェック状態を更新
  const toggleCheck = async (docId: string) => {
    if (!selectedChecklist) return;

    const currentCheck = selectedChecklist.checklist[docId];
    const newChecklist = {
      ...selectedChecklist.checklist,
      [docId]: {
        checked: !currentCheck?.checked,
        checkedAt: !currentCheck?.checked ? new Date().toISOString() : undefined,
        checkedBy: !currentCheck?.checked ? user?.name : undefined,
      },
    };

    try {
      const { error } = await supabase
        .from('audit_checklists')
        .update({ checklist: newChecklist, updated_at: new Date().toISOString() })
        .eq('id', selectedChecklist.id);

      if (error) throw error;

      setSelectedChecklist({ ...selectedChecklist, checklist: newChecklist });
    } catch (err) {
      console.error('更新エラー:', err);
    }
  };

  // ステータス更新
  const updateStatus = async (status: AuditChecklist['status']) => {
    if (!selectedChecklist) return;

    try {
      const { error } = await supabase
        .from('audit_checklists')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', selectedChecklist.id);

      if (error) throw error;

      setSelectedChecklist({ ...selectedChecklist, status });
      await fetchData();
    } catch (err) {
      console.error('更新エラー:', err);
    }
  };

  // チェックリスト削除
  const deleteChecklist = async () => {
    if (!selectedChecklist) return;
    if (!confirm('このチェックリストを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('audit_checklists')
        .delete()
        .eq('id', selectedChecklist.id);

      if (error) throw error;

      setSelectedChecklist(null);
      await fetchData();
    } catch (err) {
      console.error('削除エラー:', err);
    }
  };

  // カテゴリの展開/折りたたみ
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // 書類をクリックして遷移
  const handleDocumentClick = (doc: Document) => {
    if (doc.status === 'not_implemented' || !doc.navigateTo) return;
    if (setActiveTab) {
      setActiveTab(doc.navigateTo);
    }
  };

  // 進捗計算
  const calculateProgress = (checklist: AuditChecklist) => {
    const total = requiredDocuments.length;
    const checked = Object.values(checklist.checklist).filter(c => c.checked).length;
    return { checked, total, percentage: Math.round((checked / total) * 100) };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-[#00c4cc]" />
            運営指導準備
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            運営指導に必要な38種の書類を確認・準備します
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg text-sm font-medium hover:bg-[#00b0b8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規チェックリスト
        </button>
      </div>

      {/* 新規作成モーダル */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-4">新規チェックリスト作成</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">運営指導名 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="例: 令和6年度 定期運営指導"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">実施予定日</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">種別</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="regular">定期</option>
                  <option value="follow_up">フォローアップ</option>
                  <option value="complaint">苦情・事故対応</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newName}
                className="px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50"
              >
                {saving ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* チェックリスト一覧 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">チェックリスト</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {checklists.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  チェックリストがありません
                </div>
              ) : (
                checklists.map((cl) => {
                  const progress = calculateProgress(cl);
                  return (
                    <button
                      key={cl.id}
                      onClick={() => setSelectedChecklist(cl)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedChecklist?.id === cl.id ? 'bg-[#00c4cc]/5 border-l-4 border-[#00c4cc]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${checklistStatusLabels[cl.status].color}`}>
                          {checklistStatusLabels[cl.status].label}
                        </span>
                        <span className="text-xs text-gray-500">{progress.percentage}%</span>
                      </div>
                      <p className="font-medium text-gray-800 text-sm truncate">{cl.auditName}</p>
                      {cl.auditDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(cl.auditDate).toLocaleDateString('ja-JP')}
                        </p>
                      )}
                      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00c4cc] transition-all"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 書類一覧・チェック */}
        <div className="lg:col-span-3">
          {selectedChecklist ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* チェックリストヘッダー */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${checklistStatusLabels[selectedChecklist.status].color}`}>
                        {checklistStatusLabels[selectedChecklist.status].label}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">{selectedChecklist.auditName}</h2>
                    {selectedChecklist.auditDate && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(selectedChecklist.auditDate).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedChecklist.status}
                      onChange={(e) => updateStatus(e.target.value as any)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="preparing">準備中</option>
                      <option value="ready">準備完了</option>
                      <option value="completed">実施完了</option>
                      <option value="archived">アーカイブ</option>
                    </select>
                    <button
                      onClick={deleteChecklist}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* 進捗バー */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">準備進捗</span>
                    <span className="font-medium text-[#00c4cc]">
                      {calculateProgress(selectedChecklist).checked} / {calculateProgress(selectedChecklist).total} 件
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00c4cc] transition-all"
                      style={{ width: `${calculateProgress(selectedChecklist).percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 書類カテゴリリスト */}
              <div className="divide-y divide-gray-100 max-h-[calc(100vh-400px)] overflow-y-auto">
                {documentCategories.map((category) => {
                  const categoryDocs = requiredDocuments.filter(d => d.category === category.name);
                  const checkedCount = categoryDocs.filter(d => selectedChecklist.checklist[d.id]?.checked).length;
                  const isExpanded = expandedCategories.has(category.id);

                  return (
                    <div key={category.id}>
                      {/* カテゴリヘッダー */}
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${category.color}`} />
                          <span className="font-bold text-gray-800">{category.name}</span>
                          <span className="text-sm text-gray-500">
                            ({checkedCount}/{categoryDocs.length})
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {/* 書類リスト */}
                      {isExpanded && (
                        <div className="bg-gray-50 divide-y divide-gray-100">
                          {categoryDocs.map((doc) => {
                            const isChecked = selectedChecklist.checklist[doc.id]?.checked;
                            const StatusIcon = statusLabels[doc.status].icon;
                            const isClickable = doc.status !== 'not_implemented' && doc.navigateTo;

                            return (
                              <div
                                key={doc.id}
                                className="flex items-center gap-4 px-4 py-3 pl-8"
                              >
                                {/* チェックボックス */}
                                <button
                                  onClick={() => toggleCheck(doc.id)}
                                  className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                    isChecked
                                      ? 'bg-[#00c4cc] border-[#00c4cc] text-white'
                                      : 'border-gray-300 hover:border-[#00c4cc]'
                                  }`}
                                >
                                  {isChecked && <CheckCircle className="w-4 h-4" />}
                                </button>

                                {/* 書類名と説明 */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium ${isChecked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                      {doc.name}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[doc.status].color}`}>
                                      {statusLabels[doc.status].label}
                                    </span>
                                  </div>
                                  {doc.description && (
                                    <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                                  )}
                                </div>

                                {/* 遷移ボタン */}
                                {isClickable ? (
                                  <button
                                    onClick={() => handleDocumentClick(doc)}
                                    className="flex items-center gap-1 text-sm text-[#00c4cc] hover:underline"
                                  >
                                    出力画面へ
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">未実装</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // 書類一覧（チェックリスト未選択時）
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-800">必要書類一覧（38種）</h2>
                <p className="text-sm text-gray-500 mt-1">
                  チェックリストを選択すると、準備状況を記録できます
                </p>
              </div>

              {/* 凡例 */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-4">
                {Object.entries(statusLabels).map(([key, { label, color, icon: Icon }]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                  </div>
                ))}
              </div>

              <div className="divide-y divide-gray-100 max-h-[calc(100vh-350px)] overflow-y-auto">
                {documentCategories.map((category) => {
                  const categoryDocs = requiredDocuments.filter(d => d.category === category.name);
                  const isExpanded = expandedCategories.has(category.id);
                  const implementedCount = categoryDocs.filter(d => d.status === 'implemented').length;
                  const partialCount = categoryDocs.filter(d => d.status === 'partial').length;

                  return (
                    <div key={category.id}>
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${category.color}`} />
                          <span className="font-bold text-gray-800">{category.name}</span>
                          <span className="text-xs text-gray-500">
                            {categoryDocs.length}件
                            {implementedCount > 0 && (
                              <span className="text-green-600 ml-1">（実装済: {implementedCount}）</span>
                            )}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="bg-gray-50 divide-y divide-gray-100">
                          {categoryDocs.map((doc) => {
                            const isClickable = doc.status !== 'not_implemented' && doc.navigateTo;

                            return (
                              <div
                                key={doc.id}
                                className="flex items-center gap-4 px-4 py-3 pl-8"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800">{doc.name}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[doc.status].color}`}>
                                      {statusLabels[doc.status].label}
                                    </span>
                                  </div>
                                  {doc.description && (
                                    <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                                  )}
                                </div>

                                {isClickable ? (
                                  <button
                                    onClick={() => handleDocumentClick(doc)}
                                    className="flex items-center gap-1 text-sm text-[#00c4cc] hover:underline"
                                  >
                                    出力画面へ
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">未実装</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
