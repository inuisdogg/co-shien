/**
 * 児童選択ポップアップ
 * カードグリッド選択UI、送迎方法プレビュー付き
 */

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Check, CheckSquare } from 'lucide-react';
import { Child, TimeSlot, ResolvedSlotInfo, TransportVehicle } from '@/types';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';
import { resolveTimeSlots, slotDisplayName } from '@/utils/slotResolver';

// 選択された児童の情報（送迎オプション付き）
export interface SelectedChildWithTransport {
  childId: string;
  hasPickup: boolean;
  hasDropoff: boolean;
  pickupMethod?: string | null;
  dropoffMethod?: string | null;
}

interface ChildPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  childList: Child[];
  targetSlot: TimeSlot;
  date: string;
  alreadyRegisteredIds: string[];
  onSelect: (childIds: string[]) => void;
  onSelectWithTransport?: (children: SelectedChildWithTransport[]) => void;
  multiSelect?: boolean;
  resolvedSlots?: ResolvedSlotInfo[];
  transportVehicles?: TransportVehicle[];
}

// 送迎方法のバッジ表示
function getTransportBadge(method: string | null | undefined, vehicles: TransportVehicle[]): string {
  if (!method) return '';
  if (method === 'walk') return '🚶';
  const vehicle = vehicles.find(v => v.id === method);
  if (vehicle) {
    const match = vehicle.name.match(/(\d+)/);
    return match ? `🚐${match[1]}` : '🚐';
  }
  return '';
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
  resolvedSlots: resolvedSlotsProp,
  transportVehicles = [],
}: ChildPickerPopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transportOptions, setTransportOptions] = useState<Record<string, { pickupMethod?: string | null; dropoffMethod?: string | null }>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  const slots: ResolvedSlotInfo[] = useMemo(() => {
    if (resolvedSlotsProp && resolvedSlotsProp.length > 0) return resolvedSlotsProp;
    return resolveTimeSlots([]);
  }, [resolvedSlotsProp]);

  const dayOfWeek = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).getDay();
  }, [date]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (isOpen) {
      setSelectedIds([]);
      setTransportOptions({});
      setSearchQuery('');
    }
  }, [isOpen]);

  // 利用可能な児童をフィルタリング・ソート
  const availableChildren = useMemo(() => {
    let filtered = childList.filter(c => !alreadyRegisteredIds.includes(c.id));
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.nameKana?.toLowerCase().includes(query)
      );
    }
    return filtered.sort((a, b) => {
      const aHasPattern = a.patternDays?.includes(dayOfWeek) || false;
      const bHasPattern = b.patternDays?.includes(dayOfWeek) || false;
      const aTimeSlot = a.patternTimeSlots?.[dayOfWeek];
      const bTimeSlot = b.patternTimeSlots?.[dayOfWeek];
      const aMatchesSlot = aTimeSlot === targetSlot || aTimeSlot === 'AMPM' || aTimeSlot === 'ALL';
      const bMatchesSlot = bTimeSlot === targetSlot || bTimeSlot === 'AMPM' || bTimeSlot === 'ALL';

      if (aHasPattern && aMatchesSlot && !(bHasPattern && bMatchesSlot)) return -1;
      if (bHasPattern && bMatchesSlot && !(aHasPattern && aMatchesSlot)) return 1;
      if (aHasPattern && !bHasPattern) return -1;
      if (bHasPattern && !aHasPattern) return 1;
      return a.name.localeCompare(b.name, 'ja');
    });
  }, [childList, alreadyRegisteredIds, searchQuery, dayOfWeek, targetSlot]);

  const isPatternMatch = (child: Child) => {
    if (!child.patternDays?.includes(dayOfWeek)) return false;
    const timeSlot = child.patternTimeSlots?.[dayOfWeek];
    return timeSlot === targetSlot || timeSlot === 'AMPM' || timeSlot === 'ALL';
  };

  // 児童のデフォルト送迎設定を取得（transportPattern優先）
  const getDefaultTransport = (child: Child): { pickupMethod: string | null; dropoffMethod: string | null } => {
    const tp = child.transportPattern?.[dayOfWeek];
    return {
      pickupMethod: tp?.pickup || null,
      dropoffMethod: tp?.dropoff || null,
    };
  };

  // 児童の送迎設定を取得
  const getTransport = (child: Child) => {
    return transportOptions[child.id] || getDefaultTransport(child);
  };

  // 児童選択トグル
  const toggleChild = (childId: string) => {
    const child = childList.find(c => c.id === childId);

    if (multiSelect) {
      setSelectedIds(prev => {
        if (prev.includes(childId)) {
          setTransportOptions(opts => {
            const newOpts = { ...opts };
            delete newOpts[childId];
            return newOpts;
          });
          return prev.filter(id => id !== childId);
        } else {
          if (child) {
            setTransportOptions(opts => ({
              ...opts,
              [childId]: getDefaultTransport(child),
            }));
          }
          return [...prev, childId];
        }
      });
    } else {
      if (onSelectWithTransport && child) {
        const tp = getDefaultTransport(child);
        onSelectWithTransport([{
          childId,
          hasPickup: !!tp.pickupMethod || child.needsPickup,
          hasDropoff: !!tp.dropoffMethod || child.needsDropoff,
          pickupMethod: tp.pickupMethod,
          dropoffMethod: tp.dropoffMethod,
        }]);
      } else {
        onSelect([childId]);
      }
      onClose();
    }
  };

  // パターン一致の「すべて選択」
  const selectAllPatternChildren = () => {
    const patternMatches = availableChildren.filter(isPatternMatch);
    const newIds: string[] = [...selectedIds];
    const newTransport = { ...transportOptions };

    for (const child of patternMatches) {
      if (!newIds.includes(child.id)) {
        newIds.push(child.id);
        newTransport[child.id] = getDefaultTransport(child);
      }
    }
    setSelectedIds(newIds);
    setTransportOptions(newTransport);
  };

  // 確定
  const handleConfirm = () => {
    if (selectedIds.length === 0) return;
    if (onSelectWithTransport) {
      const childrenWithTransport: SelectedChildWithTransport[] = selectedIds.map(childId => {
        const child = childList.find(c => c.id === childId);
        const transport = transportOptions[childId] || (child ? getDefaultTransport(child) : { pickupMethod: null, dropoffMethod: null });
        return {
          childId,
          hasPickup: !!transport.pickupMethod || child?.needsPickup || false,
          hasDropoff: !!transport.dropoffMethod || child?.needsDropoff || false,
          pickupMethod: transport.pickupMethod,
          dropoffMethod: transport.dropoffMethod,
        };
      });
      onSelectWithTransport(childrenWithTransport);
    } else {
      onSelect(selectedIds);
    }
    onClose();
  };

  const patternMatchChildren = availableChildren.filter(isPatternMatch);
  const otherChildren = availableChildren.filter(c => !isPatternMatch(c));
  const allPatternSelected = patternMatchChildren.length > 0 && patternMatchChildren.every(c => selectedIds.includes(c.id));

  if (!isOpen) return null;

  const renderChildCard = (child: Child) => {
    const isSelected = selectedIds.includes(child.id);
    const patternMatch = isPatternMatch(child);
    const transport = getTransport(child);
    const ageDisplay = child.birthDate
      ? calculateAgeWithMonths(child.birthDate).display
      : child.age ? `${child.age}歳` : null;

    const pickupBadge = getTransportBadge(transport.pickupMethod, transportVehicles);
    const dropoffBadge = getTransportBadge(transport.dropoffMethod, transportVehicles);
    const hasAnyTransport = !!transport.pickupMethod || !!transport.dropoffMethod;

    return (
      <button
        key={child.id}
        onClick={() => toggleChild(child.id)}
        className={`relative text-left rounded-xl p-3 border-2 transition-all ${
          isSelected
            ? 'border-primary bg-primary/5 shadow-sm'
            : patternMatch
              ? 'border-yellow-200 bg-yellow-50/30 hover:border-yellow-300'
              : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        {/* 選択チェック */}
        {isSelected && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* 児童名 */}
        <p className="text-sm font-bold text-gray-800 truncate">{child.name}</p>
        {ageDisplay && (
          <p className="text-[11px] text-gray-400 mt-0.5">{ageDisplay}</p>
        )}

        {/* 送迎プレビューバッジ */}
        {hasAnyTransport && (
          <div className="flex items-center gap-1 mt-1.5">
            {transport.pickupMethod && (
              <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                isSelected ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
              }`}>
                迎{pickupBadge}
              </span>
            )}
            {transport.dropoffMethod && (
              <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                isSelected ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
              }`}>
                送{dropoffBadge}
              </span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] shadow-2xl flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800">
              児童を選択
              <span className="ml-2 text-sm font-normal text-gray-700">
                （{slotDisplayName(slots, targetSlot)}枠）
              </span>
            </h3>
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
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        {/* 児童カードグリッド */}
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
            <div className="space-y-4">
              {/* パターン一致セクション */}
              {patternMatchChildren.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                        パターン一致
                      </span>
                      <span className="text-xs text-gray-400">({patternMatchChildren.length}名)</span>
                    </div>
                    {!allPatternSelected && (
                      <button
                        onClick={selectAllPatternChildren}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors"
                      >
                        <CheckSquare className="w-3 h-3" />
                        すべて選択
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {patternMatchChildren.map(renderChildCard)}
                  </div>
                </div>
              )}

              {/* その他セクション */}
              {otherChildren.length > 0 && (
                <div>
                  {patternMatchChildren.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-500">その他</span>
                      <span className="text-xs text-gray-400">({otherChildren.length}名)</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {otherChildren.map(renderChildCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        {multiSelect && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedIds.length > 0 ? (
                <span className="font-bold text-primary">{selectedIds.length}名</span>
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
                className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
