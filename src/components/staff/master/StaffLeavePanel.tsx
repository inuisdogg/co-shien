/**
 * 有給管理パネル
 * スタッフの有給休暇・振替休日の設定と履歴管理
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  Calendar,
  Save,
  Plus,
  Minus,
  History,
  CheckCircle,
  AlertCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Staff, StaffLeaveSettings } from '@/types';

interface StaffWithRelations extends Staff {
  leaveSettings?: StaffLeaveSettings;
}

interface LeaveHistory {
  id: string;
  date: string;
  type: 'paid' | 'substitute';
  action: 'used' | 'added' | 'adjusted';
  days: number;
  reason?: string;
  createdAt: string;
}

interface StaffLeavePanelProps {
  staff: StaffWithRelations;
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Partial<StaffLeaveSettings>) => Promise<boolean>;
  leaveHistory?: LeaveHistory[];
  loading?: boolean;
}

const StaffLeavePanel: React.FC<StaffLeavePanelProps> = ({
  staff,
  isOpen,
  onClose,
  onSave,
  leaveHistory = [],
  loading = false,
}) => {
  const leave = staff.leaveSettings;

  // 設定状態
  const [settings, setSettings] = useState({
    paidLeaveEnabled: leave?.paidLeaveEnabled ?? false,
    paidLeaveDays: leave?.paidLeaveDays ?? 0,
    substituteLeaveEnabled: leave?.substituteLeaveEnabled ?? false,
    substituteLeaveDays: leave?.substituteLeaveDays ?? 0,
    notes: leave?.notes ?? '',
  });

  // 日数調整モーダル
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<'paid' | 'substitute'>('paid');
  const [adjustAction, setAdjustAction] = useState<'add' | 'subtract'>('add');
  const [adjustDays, setAdjustDays] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 設定変更
  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ) => {
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  // 保存
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await onSave(settings);
      if (success) {
        setHasChanges(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 日数調整
  const handleAdjust = async () => {
    if (!adjustDays || isNaN(Number(adjustDays))) return;

    const days = Number(adjustDays);
    const delta = adjustAction === 'add' ? days : -days;

    if (adjustType === 'paid') {
      const newDays = Math.max(0, settings.paidLeaveDays + delta);
      updateSetting('paidLeaveDays', newDays);
    } else {
      const newDays = Math.max(0, settings.substituteLeaveDays + delta);
      updateSetting('substituteLeaveDays', newDays);
    }

    setShowAdjustModal(false);
    setAdjustDays('');
    setAdjustReason('');
  };

  // 履歴アクションラベル
  const getActionLabel = (history: LeaveHistory) => {
    switch (history.action) {
      case 'used':
        return { label: '取得', color: 'text-orange-600 bg-orange-50' };
      case 'added':
        return { label: '付与', color: 'text-green-600 bg-green-50' };
      case 'adjusted':
        return { label: '調整', color: 'text-blue-600 bg-blue-50' };
      default:
        return { label: history.action, color: 'text-gray-600 bg-gray-50' };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* パネル */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <Calendar size={20} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">有給管理</h2>
              <p className="text-sm text-gray-500">{staff.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 有給休暇 */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-teal-600" />
                <h3 className="font-medium text-gray-800">有給休暇</h3>
              </div>
              <button
                onClick={() => updateSetting('paidLeaveEnabled', !settings.paidLeaveEnabled)}
                className="flex items-center gap-2 text-sm"
              >
                {settings.paidLeaveEnabled ? (
                  <>
                    <ToggleRight size={24} className="text-teal-600" />
                    <span className="text-teal-600">有効</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={24} className="text-gray-400" />
                    <span className="text-gray-400">無効</span>
                  </>
                )}
              </button>
            </div>

            {settings.paidLeaveEnabled && (
              <div className="space-y-4">
                {/* 残日数表示 */}
                <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-teal-700">残日数</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-teal-700">
                        {settings.paidLeaveDays}
                      </span>
                      <span className="text-teal-600">日</span>
                    </div>
                  </div>
                </div>

                {/* 調整ボタン */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAdjustType('paid');
                      setAdjustAction('add');
                      setShowAdjustModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    付与
                  </button>
                  <button
                    onClick={() => {
                      setAdjustType('paid');
                      setAdjustAction('subtract');
                      setShowAdjustModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                  >
                    <Minus size={16} />
                    消化
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 振替休日 */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                <h3 className="font-medium text-gray-800">振替休日</h3>
              </div>
              <button
                onClick={() =>
                  updateSetting('substituteLeaveEnabled', !settings.substituteLeaveEnabled)
                }
                className="flex items-center gap-2 text-sm"
              >
                {settings.substituteLeaveEnabled ? (
                  <>
                    <ToggleRight size={24} className="text-blue-600" />
                    <span className="text-blue-600">有効</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={24} className="text-gray-400" />
                    <span className="text-gray-400">無効</span>
                  </>
                )}
              </button>
            </div>

            {settings.substituteLeaveEnabled && (
              <div className="space-y-4">
                {/* 残日数表示 */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">残日数</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-blue-700">
                        {settings.substituteLeaveDays}
                      </span>
                      <span className="text-blue-600">日</span>
                    </div>
                  </div>
                </div>

                {/* 調整ボタン */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAdjustType('substitute');
                      setAdjustAction('add');
                      setShowAdjustModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    追加
                  </button>
                  <button
                    onClick={() => {
                      setAdjustType('substitute');
                      setAdjustAction('subtract');
                      setShowAdjustModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                  >
                    <Minus size={16} />
                    消化
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* メモ */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              備考
            </label>
            <textarea
              value={settings.notes}
              onChange={(e) => updateSetting('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="メモを入力..."
            />
          </section>

          {/* 履歴 */}
          {leaveHistory.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-gray-500" />
                <h3 className="font-medium text-gray-700">取得履歴</h3>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {leaveHistory.map((history) => {
                  const action = getActionLabel(history);
                  return (
                    <div
                      key={history.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${action.color}`}
                        >
                          {action.label}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {history.type === 'paid' ? '有給休暇' : '振替休日'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(history.date).toLocaleDateString('ja-JP')}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          history.action === 'used' ? 'text-orange-600' : 'text-green-600'
                        }`}
                      >
                        {history.action === 'used' ? '-' : '+'}
                        {history.days}日
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* フッター */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {hasChanges && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <AlertCircle size={14} />
                未保存の変更があります
              </span>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || loading}
                className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 日数調整モーダル */}
      {showAdjustModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowAdjustModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 z-50 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {adjustType === 'paid' ? '有給休暇' : '振替休日'}を
              {adjustAction === 'add' ? '付与' : '消化'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日数
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={adjustDays}
                    onChange={(e) => setAdjustDays(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="0"
                    min="0"
                    step="0.5"
                  />
                  <span className="text-gray-600">日</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  理由（任意）
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="年次付与、取得など"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAdjust}
                disabled={!adjustDays}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  adjustAction === 'add'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {adjustAction === 'add' ? '付与する' : '消化する'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default StaffLeavePanel;
