/**
 * 書類設定コンポーネント
 * 施設ごとに書類の有効/無効、更新スケジュールをカスタマイズ
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Settings,
  Plus,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  Trash2,
  Edit,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  DOCUMENT_TYPE_CONFIGS,
  DOCUMENT_CATEGORIES,
  UPDATE_CYCLE_LABELS,
  DocumentTypeConfig,
  UpdateCycleType,
} from '@/constants/documentTypeConfigs';

// 施設別書類設定の型
type FacilityDocumentConfig = {
  id: string;
  facilityId: string;
  documentType: string;
  isCustom: boolean;
  isEnabled: boolean;
  customName?: string;
  customCategory?: string;
  customDescription?: string;
  updateCycleType?: UpdateCycleType;
  updateIntervalDays?: number;
  updateMonths?: number[];
  triggerEntity?: 'staff' | 'child' | 'facility';
  triggerDescription?: string;
  entityType: 'facility' | 'staff' | 'child';
  alertDaysWarning: number;
  alertDaysUrgent: number;
  notes?: string;
  displayOrder: number;
};

// DBマッピング
const mapDbToConfig = (row: any): FacilityDocumentConfig => ({
  id: row.id,
  facilityId: row.facility_id,
  documentType: row.document_type,
  isCustom: row.is_custom,
  isEnabled: row.is_enabled,
  customName: row.custom_name,
  customCategory: row.custom_category,
  customDescription: row.custom_description,
  updateCycleType: row.update_cycle_type,
  updateIntervalDays: row.update_interval_days,
  updateMonths: row.update_months,
  triggerEntity: row.trigger_entity,
  triggerDescription: row.trigger_description,
  entityType: row.entity_type || 'facility',
  alertDaysWarning: row.alert_days_warning || 30,
  alertDaysUrgent: row.alert_days_urgent || 7,
  notes: row.notes,
  displayOrder: row.display_order || 0,
});

// 月の選択肢
const MONTHS = [
  { value: 1, label: '1月' },
  { value: 2, label: '2月' },
  { value: 3, label: '3月' },
  { value: 4, label: '4月' },
  { value: 5, label: '5月' },
  { value: 6, label: '6月' },
  { value: 7, label: '7月' },
  { value: 8, label: '8月' },
  { value: 9, label: '9月' },
  { value: 10, label: '10月' },
  { value: 11, label: '11月' },
  { value: 12, label: '12月' },
];

export default function DocumentConfigView() {
  const { facility } = useAuth();
  const [configs, setConfigs] = useState<FacilityDocumentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingDoc, setEditingDoc] = useState<string | null>(null);

  // カスタム書類追加モーダル
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('その他');
  const [newDocDescription, setNewDocDescription] = useState('');
  const [newDocCycleType, setNewDocCycleType] = useState<UpdateCycleType>('static');
  const [newDocEntityType, setNewDocEntityType] = useState<'facility' | 'staff' | 'child'>('facility');

  // データ取得
  const fetchConfigs = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('facility_document_configs')
        .select('*')
        .eq('facility_id', facility.id)
        .order('display_order');

      if (error) throw error;
      setConfigs((data || []).map(mapDbToConfig));
    } catch (err) {
      console.error('設定取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // 書類の有効/無効を切り替え
  const toggleEnabled = async (docType: string, currentEnabled: boolean) => {
    if (!facility?.id) return;

    const existingConfig = configs.find(c => c.documentType === docType);

    try {
      if (existingConfig) {
        // 既存設定を更新
        const { error } = await supabase
          .from('facility_document_configs')
          .update({ is_enabled: !currentEnabled, updated_at: new Date().toISOString() })
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        // 新規設定を作成（無効化の場合のみ）
        const { error } = await supabase
          .from('facility_document_configs')
          .insert({
            facility_id: facility.id,
            document_type: docType,
            is_custom: false,
            is_enabled: false,
          });
        if (error) throw error;
      }

      await fetchConfigs();
    } catch (err) {
      console.error('設定更新エラー:', err);
      alert('設定の更新に失敗しました');
    }
  };

  // 更新スケジュールをカスタマイズ
  const saveScheduleCustomization = async (
    docType: string,
    cycleType: UpdateCycleType,
    months?: number[],
    intervalDays?: number
  ) => {
    if (!facility?.id) return;

    setSaving(true);
    const existingConfig = configs.find(c => c.documentType === docType);

    try {
      if (existingConfig) {
        const { error } = await supabase
          .from('facility_document_configs')
          .update({
            update_cycle_type: cycleType,
            update_months: months || null,
            update_interval_days: intervalDays || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('facility_document_configs')
          .insert({
            facility_id: facility.id,
            document_type: docType,
            is_custom: false,
            is_enabled: true,
            update_cycle_type: cycleType,
            update_months: months || null,
            update_interval_days: intervalDays || null,
          });
        if (error) throw error;
      }

      await fetchConfigs();
      setEditingDoc(null);
    } catch (err) {
      console.error('スケジュール更新エラー:', err);
      alert('スケジュールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // カスタム書類を追加
  const addCustomDocument = async () => {
    if (!facility?.id || !newDocName) return;

    setSaving(true);
    try {
      const customId = `custom_${Date.now()}`;
      const { error } = await supabase
        .from('facility_document_configs')
        .insert({
          facility_id: facility.id,
          document_type: customId,
          is_custom: true,
          is_enabled: true,
          custom_name: newDocName,
          custom_category: newDocCategory,
          custom_description: newDocDescription,
          update_cycle_type: newDocCycleType,
          entity_type: newDocEntityType,
        });

      if (error) throw error;

      await fetchConfigs();
      setIsAddModalOpen(false);
      setNewDocName('');
      setNewDocDescription('');
    } catch (err) {
      console.error('カスタム書類追加エラー:', err);
      alert('書類の追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // カスタム書類を削除
  const deleteCustomDocument = async (configId: string) => {
    if (!confirm('この書類を削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('facility_document_configs')
        .delete()
        .eq('id', configId);

      if (error) throw error;
      await fetchConfigs();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました');
    }
  };

  // 設定をリセット（システムデフォルトに戻す）
  const resetToDefault = async (docType: string) => {
    const existingConfig = configs.find(c => c.documentType === docType);
    if (!existingConfig) return;

    if (!confirm('この書類の設定をシステムデフォルトに戻しますか？')) return;

    try {
      const { error } = await supabase
        .from('facility_document_configs')
        .delete()
        .eq('id', existingConfig.id);

      if (error) throw error;
      await fetchConfigs();
    } catch (err) {
      console.error('リセットエラー:', err);
      alert('リセットに失敗しました');
    }
  };

  // カテゴリの展開/折りたたみ
  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  // 書類が有効かどうかを取得
  const isDocEnabled = (docType: string): boolean => {
    const config = configs.find(c => c.documentType === docType);
    return config ? config.isEnabled : true; // デフォルトは有効
  };

  // カスタマイズされているかどうか
  const isCustomized = (docType: string): boolean => {
    return configs.some(c => c.documentType === docType && !c.isCustom);
  };

  // 表示用の更新サイクルを取得
  const getDisplayCycle = (docType: string): { type: UpdateCycleType; months?: number[] } => {
    const config = configs.find(c => c.documentType === docType);
    if (config?.updateCycleType) {
      return { type: config.updateCycleType, months: config.updateMonths };
    }
    const systemConfig = DOCUMENT_TYPE_CONFIGS.find(c => c.documentType === docType);
    return { type: systemConfig?.updateCycleType || 'static', months: systemConfig?.updateMonths };
  };

  // カスタム書類一覧
  const customDocuments = configs.filter(c => c.isCustom);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00c4cc]" />
            書類管理設定
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            この施設で使用する書類と更新スケジュールをカスタマイズできます
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg text-sm font-medium hover:bg-[#00b0b8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          独自書類を追加
        </button>
      </div>

      {/* カスタム書類セクション */}
      {customDocuments.length > 0 && (
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
          <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            独自書類（{customDocuments.length}件）
          </h3>
          <div className="space-y-2">
            {customDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100"
              >
                <div>
                  <span className="font-medium text-gray-800">{doc.customName}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {doc.customCategory} / {UPDATE_CYCLE_LABELS[doc.updateCycleType || 'static']}
                  </span>
                </div>
                <button
                  onClick={() => deleteCustomDocument(doc.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* システム書類一覧 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-800">システム標準書類（38種）</h3>
          <p className="text-xs text-gray-500 mt-1">
            トグルで有効/無効を切り替え、歯車アイコンで更新スケジュールをカスタマイズできます
          </p>
        </div>

        {DOCUMENT_CATEGORIES.map((category) => {
          const categoryDocs = DOCUMENT_TYPE_CONFIGS.filter(d => d.category === category.name);
          const isExpanded = expandedCategories.has(category.name);
          const enabledCount = categoryDocs.filter(d => isDocEnabled(d.documentType)).length;

          return (
            <div key={category.id} className="border-b border-gray-100 last:border-b-0">
              {/* カテゴリヘッダー */}
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-6 rounded-full ${category.color}`} />
                  <span className="font-bold text-gray-800">{category.name}</span>
                  <span className="text-sm text-gray-500">
                    ({enabledCount}/{categoryDocs.length}件 有効)
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
                    const enabled = isDocEnabled(doc.documentType);
                    const customized = isCustomized(doc.documentType);
                    const displayCycle = getDisplayCycle(doc.documentType);
                    const isEditing = editingDoc === doc.documentType;

                    return (
                      <div key={doc.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* 有効/無効トグル */}
                            <button
                              onClick={() => toggleEnabled(doc.documentType, enabled)}
                              className={`w-10 h-6 rounded-full transition-colors relative ${
                                enabled ? 'bg-[#00c4cc]' : 'bg-gray-300'
                              }`}
                            >
                              <div
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                  enabled ? 'left-5' : 'left-1'
                                }`}
                              />
                            </button>

                            <div className={enabled ? '' : 'opacity-50'}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800">
                                  {doc.displayName}
                                </span>
                                {customized && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    カスタム
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {UPDATE_CYCLE_LABELS[displayCycle.type]}
                                {displayCycle.months && displayCycle.months.length > 0 && (
                                  <span className="ml-1">
                                    ({displayCycle.months.map(m => `${m}月`).join(', ')})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {enabled && (
                            <div className="flex items-center gap-2">
                              {customized && (
                                <button
                                  onClick={() => resetToDefault(doc.documentType)}
                                  className="text-gray-400 hover:text-gray-600 p-1"
                                  title="デフォルトに戻す"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setEditingDoc(isEditing ? null : doc.documentType)}
                                className={`p-1 rounded transition-colors ${
                                  isEditing
                                    ? 'text-[#00c4cc] bg-[#00c4cc]/10'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 編集パネル */}
                        {isEditing && (
                          <ScheduleEditPanel
                            currentCycle={displayCycle.type}
                            currentMonths={displayCycle.months}
                            onSave={(cycleType, months, intervalDays) =>
                              saveScheduleCustomization(doc.documentType, cycleType, months, intervalDays)
                            }
                            onCancel={() => setEditingDoc(null)}
                            saving={saving}
                          />
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

      {/* カスタム書類追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">独自書類を追加</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">書類名 *</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="例: 送迎時間管理表"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">カテゴリ</label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                  <option value="独自管理">独自管理</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">説明</label>
                <input
                  type="text"
                  value={newDocDescription}
                  onChange={(e) => setNewDocDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="任意の説明"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">更新頻度</label>
                <select
                  value={newDocCycleType}
                  onChange={(e) => setNewDocCycleType(e.target.value as UpdateCycleType)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  {Object.entries(UPDATE_CYCLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">対象</label>
                <select
                  value={newDocEntityType}
                  onChange={(e) => setNewDocEntityType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="facility">施設全体</option>
                  <option value="staff">スタッフ別</option>
                  <option value="child">利用者別</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={addCustomDocument}
                disabled={saving || !newDocName}
                className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 更新スケジュール編集パネル
function ScheduleEditPanel({
  currentCycle,
  currentMonths,
  onSave,
  onCancel,
  saving,
}: {
  currentCycle: UpdateCycleType;
  currentMonths?: number[];
  onSave: (cycleType: UpdateCycleType, months?: number[], intervalDays?: number) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [cycleType, setCycleType] = useState<UpdateCycleType>(currentCycle);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(currentMonths || []);
  const [intervalDays, setIntervalDays] = useState<number>(30);

  const toggleMonth = (month: number) => {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(selectedMonths.filter(m => m !== month));
    } else {
      setSelectedMonths([...selectedMonths, month].sort((a, b) => a - b));
    }
  };

  const needsMonthSelection = ['quarterly', 'biannual', 'yearly', 'biennial'].includes(cycleType);
  const needsIntervalInput = cycleType === 'custom';

  return (
    <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">更新頻度</label>
          <select
            value={cycleType}
            onChange={(e) => setCycleType(e.target.value as UpdateCycleType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(UPDATE_CYCLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {needsMonthSelection && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">更新月</label>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((month) => (
                <button
                  key={month.value}
                  onClick={() => toggleMonth(month.value)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedMonths.includes(month.value)
                      ? 'bg-[#00c4cc] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {month.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {needsIntervalInput && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">更新間隔（日数）</label>
            <input
              type="number"
              value={intervalDays}
              onChange={(e) => setIntervalDays(parseInt(e.target.value) || 30)}
              min={1}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          キャンセル
        </button>
        <button
          onClick={() => onSave(
            cycleType,
            needsMonthSelection ? selectedMonths : undefined,
            needsIntervalInput ? intervalDays : undefined
          )}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
