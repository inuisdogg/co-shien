/**
 * 児童選択ポップアップ
 * [+]ボタンクリック時に表示される児童選択UI
 * 送迎オプションの個別設定に対応
 */

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Car, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Child, TimeSlot } from '@/types';

// 選択された児童の情報（送迎オプション付き）
export interface SelectedChildWithTransport {
  childId: string;
  hasPickup: boolean;
  hasDropoff: boolean;
}

// 時間枠情報の型
interface SlotInfoType {
  AM: { name: string; startTime: string; endTime: string };
  PM: { name: string; startTime: string; endTime: string } | null;
}

interface ChildPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  childList: Child[];
  targetSlot: TimeSlot;
  date: string;
  alreadyRegisteredIds: string[];  // 既に登録済みの児童ID
  onSelect: (childIds: string[]) => void;
  onSelectWithTransport?: (children: SelectedChildWithTransport[]) => void; // 送迎オプション付き
  multiSelect?: boolean;
  slotInfo?: SlotInfoType;
}

export default function ChildPickerPopup({
  isOpen,
  onClose,
  childList,
  targetSlot,
  date,
  alreadyRegisteredIds,
  onSelect,
  onSelectWithTransport,
  multiSelect = true,
  slotInfo = {
    AM: { name: '午前', startTime: '09:00', endTime: '12:00' },
    PM: { name: '午後', startTime: '13:00', endTime: '18:00' },
  },
}: ChildPickerPopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // 送迎オプション: childId -> { hasPickup, hasDropoff }
  const [transportOptions, setTransportOptions] = useState<Record<string, { hasPickup: boolean; hasDropoff: boolean }>>({});
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
      setTransportOptions({});
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
    const child = childList.find(c => c.id === childId);

    if (multiSelect) {
      setSelectedIds(prev => {
        if (prev.includes(childId)) {
          // 選択解除時は送迎オプションも削除
          setTransportOptions(opts => {
            const newOpts = { ...opts };
            delete newOpts[childId];
            return newOpts;
          });
          return prev.filter(id => id !== childId);
        } else {
          // 選択時は児童のデフォルト送迎設定を使用
          setTransportOptions(opts => ({
            ...opts,
            [childId]: {
              hasPickup: child?.needsPickup || false,
              hasDropoff: child?.needsDropoff || false,
            }
          }));
          return [...prev, childId];
        }
      });
    } else {
      // 単一選択の場合は即座に確定
      if (onSelectWithTransport) {
        onSelectWithTransport([{
          childId,
          hasPickup: child?.needsPickup || false,
          hasDropoff: child?.needsDropoff || false,
        }]);
      } else {
        onSelect([childId]);
      }
      onClose();
    }
  };

  // 送迎オプションのトグル
  const toggleTransportOption = (childId: string, option: 'pickup' | 'dropoff') => {
    setTransportOptions(opts => ({
      ...opts,
      [childId]: {
        ...opts[childId],
        [option === 'pickup' ? 'hasPickup' : 'hasDropoff']: !opts[childId]?.[option === 'pickup' ? 'hasPickup' : 'hasDropoff']
      }
    }));
  };

  // 確定
  const handleConfirm = () => {
    if (selectedIds.length > 0) {
      if (onSelectWithTransport) {
        // 送迎オプション付きで返す
        const childrenWithTransport: SelectedChildWithTransport[] = selectedIds.map(childId => ({
          childId,
          hasPickup: transportOptions[childId]?.hasPickup || false,
          hasDropoff: transportOptions[childId]?.hasDropoff || false,
        }));
        onSelectWithTransport(childrenWithTransport);
      } else {
        onSelect(selectedIds);
      }
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
                （{targetSlot === 'AM' ? slotInfo.AM.name : (slotInfo.PM?.name || '午後')}枠）
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
            <div className="space-y-2">
              {availableChildren.map(child => {
                const isSelected = selectedIds.includes(child.id);
                const patternMatch = isPatternMatch(child);
                const transport = transportOptions[child.id];

                return (
                  <div
                    key={child.id}
                    className={`
                      rounded-lg border transition-all
                      ${isSelected
                        ? 'bg-[#00c4cc]/5 border-[#00c4cc]'
                        : patternMatch
                          ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {/* 児童名と選択 */}
                    <button
                      onClick={() => toggleChild(child.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    >
                      {/* 選択チェック */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#00c4cc] border-[#00c4cc]'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>

                      {/* 名前 */}
                      <span className="text-sm font-medium text-gray-800 flex-1">
                        {child.name}
                      </span>

                      {/* デフォルト送迎設定の表示（未選択時） */}
                      {!isSelected && (child.needsPickup || child.needsDropoff) && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Car className="w-3.5 h-3.5" />
                          {child.needsPickup && child.needsDropoff ? '送迎あり' : child.needsPickup ? '迎えあり' : '送りあり'}
                        </span>
                      )}

                      {/* パターン一致マーク */}
                      {patternMatch && (
                        <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                          パターン
                        </span>
                      )}
                    </button>

                    {/* 送迎オプション（選択時のみ表示） */}
                    {isSelected && (
                      <div className="px-3 pb-2.5 flex items-center gap-4 ml-8">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={transport?.hasPickup || false}
                            onChange={() => toggleTransportOption(child.id, 'pickup')}
                            className="w-4 h-4 rounded border-gray-300 text-[#00c4cc] focus:ring-[#00c4cc]"
                          />
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            お迎え
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={transport?.hasDropoff || false}
                            onChange={() => toggleTransportOption(child.id, 'dropoff')}
                            className="w-4 h-4 rounded border-gray-300 text-[#00c4cc] focus:ring-[#00c4cc]"
                          />
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <ArrowLeft className="w-3 h-3" />
                            お送り
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
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
