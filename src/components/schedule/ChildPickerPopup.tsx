/**
 * 児童選択ポップアップ
 * [+]ボタンクリック時に表示される児童選択UI
 */

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Car, Check } from 'lucide-react';
import { Child, TimeSlot } from '@/types';
import ChildCard from './ChildCard';

interface ChildPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  childList: Child[];
  targetSlot: TimeSlot;
  date: string;
  alreadyRegisteredIds: string[];  // 既に登録済みの児童ID
  onSelect: (childIds: string[]) => void;
  multiSelect?: boolean;
}

export default function ChildPickerPopup({
  isOpen,
  onClose,
  childList,
  targetSlot,
  date,
  alreadyRegisteredIds,
  onSelect,
  multiSelect = true,
}: ChildPickerPopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 曜日を取得
  const dayOfWeek = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).getDay();
  }, [date]);

  // ポップアップが開いたときにフォーカス
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    // 開いたときに選択をリセット
    if (isOpen) {
      setSelectedIds([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  // 利用可能な児童をフィルタリング・ソート
  const availableChildren = useMemo(() => {
    // 既に登録済みの児童を除外
    let filtered = childList.filter(c => !alreadyRegisteredIds.includes(c.id));

    // 検索クエリでフィルタリング
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.nameKana?.toLowerCase().includes(query)
      );
    }

    // パターン一致でソート（一致する児童を上に）
    return filtered.sort((a, b) => {
      const aHasPattern = a.patternDays?.includes(dayOfWeek) || false;
      const bHasPattern = b.patternDays?.includes(dayOfWeek) || false;

      // 時間帯の確認
      const aTimeSlot = a.patternTimeSlots?.[dayOfWeek];
      const bTimeSlot = b.patternTimeSlots?.[dayOfWeek];
      const aMatchesSlot = aTimeSlot === targetSlot || aTimeSlot === 'AMPM';
      const bMatchesSlot = bTimeSlot === targetSlot || bTimeSlot === 'AMPM';

      // 優先順位: 1. パターン一致+時間帯一致, 2. パターン一致, 3. その他
      if (aHasPattern && aMatchesSlot && !(bHasPattern && bMatchesSlot)) return -1;
      if (bHasPattern && bMatchesSlot && !(aHasPattern && aMatchesSlot)) return 1;
      if (aHasPattern && !bHasPattern) return -1;
      if (bHasPattern && !aHasPattern) return 1;

      // 同じ優先度の場合は名前順
      return a.name.localeCompare(b.name, 'ja');
    });
  }, [childList, alreadyRegisteredIds, searchQuery, dayOfWeek, targetSlot]);

  // パターン一致かどうか
  const isPatternMatch = (child: Child) => {
    if (!child.patternDays?.includes(dayOfWeek)) return false;
    const timeSlot = child.patternTimeSlots?.[dayOfWeek];
    return timeSlot === targetSlot || timeSlot === 'AMPM';
  };

  // 児童選択トグル
  const toggleChild = (childId: string) => {
    if (multiSelect) {
      setSelectedIds(prev =>
        prev.includes(childId)
          ? prev.filter(id => id !== childId)
          : [...prev, childId]
      );
    } else {
      // 単一選択の場合は即座に確定
      onSelect([childId]);
      onClose();
    }
  };

  // 確定
  const handleConfirm = () => {
    if (selectedIds.length > 0) {
      onSelect(selectedIds);
      onClose();
    }
  };

  // パターン一致の児童数
  const patternMatchCount = availableChildren.filter(isPatternMatch).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] shadow-2xl flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800">
              児童を選択
              <span className={`ml-2 text-sm font-normal ${
                targetSlot === 'AM' ? 'text-gray-700' : 'text-gray-700'
              }`}>
                （{targetSlot === 'AM' ? '午前' : '午後'}枠）
              </span>
            </h3>
            {patternMatchCount > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                この曜日・時間帯の利用パターン設定児童: {patternMatchCount}名
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 検索 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="児童名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
          </div>
        </div>

        {/* 児童リスト */}
        <div className="flex-1 overflow-y-auto p-4">
          {availableChildren.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? (
                <p>「{searchQuery}」に一致する児童が見つかりません</p>
              ) : (
                <p>登録可能な児童がいません</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableChildren.map(child => {
                const isSelected = selectedIds.includes(child.id);
                const patternMatch = isPatternMatch(child);

                return (
                  <button
                    key={child.id}
                    onClick={() => toggleChild(child.id)}
                    className={`
                      relative flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left
                      ${isSelected
                        ? 'bg-[#00c4cc] border-[#00c4cc] text-white'
                        : patternMatch
                          ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {/* 選択チェック */}
                    {multiSelect && isSelected && (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    )}

                    {/* 名前 */}
                    <span className={`text-sm font-medium truncate ${
                      isSelected ? 'text-white' : 'text-gray-800'
                    }`}>
                      {child.name}
                    </span>

                    {/* 送迎マーク */}
                    {(child.needsPickup || child.needsDropoff) && (
                      <Car className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isSelected ? 'text-white/80' : 'text-gray-400'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        {multiSelect && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedIds.length > 0 ? (
                <span className="font-bold text-[#00c4cc]">{selectedIds.length}名</span>
              ) : (
                '0名'
              )}
              選択中
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 text-sm font-bold text-white bg-[#00c4cc] hover:bg-[#00b0b8] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
