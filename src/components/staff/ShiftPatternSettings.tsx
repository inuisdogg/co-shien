/**
 * ShiftPatternSettings - シフトパターン設定コンポーネント
 * 施設ごとのシフトパターン（早番/遅番/日勤など）を管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Clock,
  GripVertical,
} from 'lucide-react';
import { ShiftPattern } from '@/types';
import { supabase } from '@/lib/supabase';

interface ShiftPatternSettingsProps {
  facilityId: string;
}

// カラーパレット
const COLOR_PALETTE = [
  '#00c4cc', // ティール（co-shienメイン）
  '#8b5cf6', // パープル
  '#f59e0b', // オレンジ
  '#10b981', // グリーン
  '#ef4444', // レッド
  '#3b82f6', // ブルー
  '#ec4899', // ピンク
  '#6366f1', // インディゴ
];

type PatternFormData = {
  name: string;
  shortName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  isDayOff: boolean;
};

const defaultFormData: PatternFormData = {
  name: '',
  shortName: '',
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: 60,
  color: '#00c4cc',
  isDayOff: false,
};

export default function ShiftPatternSettings({ facilityId }: ShiftPatternSettingsProps) {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<PatternFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);

  // データ取得
  useEffect(() => {
    fetchPatterns();
  }, [facilityId]);

  const fetchPatterns = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_patterns')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      const mapped: ShiftPattern[] = (data || []).map(row => ({
        id: row.id,
        facilityId: row.facility_id,
        name: row.name,
        shortName: row.short_name,
        startTime: row.start_time,
        endTime: row.end_time,
        breakMinutes: row.break_minutes || 60,
        color: row.color || '#00c4cc',
        displayOrder: row.display_order || 0,
        isDayOff: row.is_day_off || false,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      setPatterns(mapped);
    } catch (error) {
      console.error('シフトパターン取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // パターン追加
  const handleAdd = async () => {
    if (!formData.name.trim()) {
      alert('パターン名を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('shift_patterns').insert({
        facility_id: facilityId,
        name: formData.name.trim(),
        short_name: formData.shortName.trim() || formData.name.trim().charAt(0),
        start_time: formData.isDayOff ? null : formData.startTime,
        end_time: formData.isDayOff ? null : formData.endTime,
        break_minutes: formData.breakMinutes,
        color: formData.color,
        display_order: patterns.length,
        is_day_off: formData.isDayOff,
        is_active: true,
      });

      if (error) throw error;

      setShowAddForm(false);
      setFormData(defaultFormData);
      fetchPatterns();
    } catch (error) {
      console.error('パターン追加エラー:', error);
      alert('追加に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // パターン更新
  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('shift_patterns')
        .update({
          name: formData.name.trim(),
          short_name: formData.shortName.trim() || formData.name.trim().charAt(0),
          start_time: formData.isDayOff ? null : formData.startTime,
          end_time: formData.isDayOff ? null : formData.endTime,
          break_minutes: formData.breakMinutes,
          color: formData.color,
          is_day_off: formData.isDayOff,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) throw error;

      setEditingId(null);
      setFormData(defaultFormData);
      fetchPatterns();
    } catch (error) {
      console.error('パターン更新エラー:', error);
      alert('更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // パターン削除（論理削除）
  const handleDelete = async (id: string) => {
    if (!confirm('このパターンを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('shift_patterns')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      fetchPatterns();
    } catch (error) {
      console.error('パターン削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  // 編集開始
  const startEdit = (pattern: ShiftPattern) => {
    setEditingId(pattern.id);
    setFormData({
      name: pattern.name,
      shortName: pattern.shortName || '',
      startTime: pattern.startTime || '09:00',
      endTime: pattern.endTime || '18:00',
      breakMinutes: pattern.breakMinutes,
      color: pattern.color,
      isDayOff: pattern.isDayOff,
    });
    setShowAddForm(false);
  };

  // キャンセル
  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData(defaultFormData);
  };

  // フォームコンポーネント
  const PatternForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* パターン名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            パターン名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例: 早番"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
          />
        </div>

        {/* 短縮名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            短縮名（1文字）
          </label>
          <input
            type="text"
            value={formData.shortName}
            onChange={(e) => setFormData({ ...formData, shortName: e.target.value.slice(0, 2) })}
            placeholder="例: 早"
            maxLength={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
          />
        </div>
      </div>

      {/* 休日パターンチェック */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDayOff"
          checked={formData.isDayOff}
          onChange={(e) => setFormData({ ...formData, isDayOff: e.target.checked })}
          className="w-4 h-4 text-[#00c4cc] rounded focus:ring-[#00c4cc]"
        />
        <label htmlFor="isDayOff" className="text-sm text-gray-700">
          休日/公休パターン（時間設定なし）
        </label>
      </div>

      {/* 勤務時間（休日でない場合のみ表示） */}
      {!formData.isDayOff && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">休憩（分）</label>
            <input
              type="number"
              value={formData.breakMinutes}
              onChange={(e) => setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })}
              min={0}
              max={180}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* カラー選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">表示色</label>
        <div className="flex gap-2">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`w-8 h-8 rounded-full transition-transform ${
                formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={isEdit ? handleUpdate : handleAdd}
          disabled={isSaving || !formData.name.trim()}
          className="px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50"
        >
          {isSaving ? '保存中...' : (isEdit ? '更新' : '追加')}
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">シフトパターン設定</h3>
        {!showAddForm && !editingId && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#00c4cc] text-white text-sm font-bold rounded-lg hover:bg-[#00b0b8] transition-colors"
          >
            <Plus className="w-4 h-4" />
            パターン追加
          </button>
        )}
      </div>

      {/* 追加フォーム */}
      {showAddForm && <PatternForm />}

      {/* パターン一覧 */}
      <div className="space-y-2">
        {patterns.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>シフトパターンがありません</p>
            <p className="text-sm">「パターン追加」から作成してください</p>
          </div>
        ) : (
          patterns.map((pattern) => (
            <div key={pattern.id}>
              {editingId === pattern.id ? (
                <PatternForm isEdit />
              ) : (
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                  {/* ドラッグハンドル（将来の並び替え用） */}
                  <GripVertical className="w-4 h-4 text-gray-300" />

                  {/* カラーインジケーター */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: pattern.color }}
                  />

                  {/* パターン情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{pattern.name}</span>
                      {pattern.shortName && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                          {pattern.shortName}
                        </span>
                      )}
                      {pattern.isDayOff && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                          休日
                        </span>
                      )}
                    </div>
                    {!pattern.isDayOff && pattern.startTime && pattern.endTime && (
                      <p className="text-sm text-gray-500">
                        {pattern.startTime.slice(0, 5)} - {pattern.endTime.slice(0, 5)}
                        {pattern.breakMinutes > 0 && ` （休憩${pattern.breakMinutes}分）`}
                      </p>
                    )}
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(pattern)}
                      className="p-2 text-gray-400 hover:text-[#00c4cc] hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(pattern.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
