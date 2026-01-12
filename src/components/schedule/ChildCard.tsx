/**
 * 児童カードコンポーネント
 * スロット割り当てパネルで使用する児童表示用カード
 */

'use client';

import React from 'react';
import { X, Car } from 'lucide-react';
import { Child, TimeSlot } from '@/types';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';

interface ChildCardProps {
  child: Child;
  slot?: TimeSlot;           // 登録済みの場合のスロット
  scheduleId?: string;       // 登録済みの場合のスケジュールID
  isPatternMatch?: boolean;  // パターン一致フラグ
  hasPickup?: boolean;
  hasDropoff?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  compact?: boolean;         // コンパクト表示（ポップアップ用）
  hasUsageRecord?: boolean;  // 実績登録済みフラグ
}

export default function ChildCard({
  child,
  slot,
  scheduleId,
  isPatternMatch = false,
  hasPickup = false,
  hasDropoff = false,
  onClick,
  onRemove,
  draggable = false,
  onDragStart,
  onDragEnd,
  compact = false,
  hasUsageRecord = false,
}: ChildCardProps) {
  // スロットに応じた背景色
  const getBackgroundClass = () => {
    if (hasUsageRecord) {
      return 'bg-green-50 border-green-200 hover:border-green-300';
    }
    return 'bg-white border-gray-200 hover:border-gray-300';
  };

  // テキスト色
  const getTextClass = () => {
    if (hasUsageRecord) return 'text-green-900';
    return 'text-gray-800';
  };

  // コンパクト表示（ポップアップ用）
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
          ${getBackgroundClass()}
          ${onClick ? 'cursor-pointer' : 'cursor-default'}
        `}
      >
        <span className={`text-sm font-medium truncate ${getTextClass()}`}>
          {child.name}
          {(() => {
            const ageDisplay = child.birthDate ? calculateAgeWithMonths(child.birthDate).display : child.age ? `${child.age}歳` : null;
            return ageDisplay ? (
              <span className="text-xs font-normal text-gray-500 ml-1.5">({ageDisplay})</span>
            ) : null;
          })()}
        </span>
        {(child.needsPickup || child.needsDropoff) && (
          <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        )}
      </button>
    );
  }

  // 通常表示（スロット内）
  return (
    <div
      draggable={draggable && !hasUsageRecord}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        relative group rounded-lg border px-3 py-2 transition-all shadow-sm
        ${getBackgroundClass()}
        ${draggable && !hasUsageRecord ? 'cursor-grab active:cursor-grabbing' : ''}
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* ヘッダー: 名前 */}
      <div className="flex items-center gap-1.5">
        <span className={`font-medium text-sm truncate ${getTextClass()}`}>
          {child.name}
          {(() => {
            const ageDisplay = child.birthDate ? calculateAgeWithMonths(child.birthDate).display : child.age ? `${child.age}歳` : null;
            return ageDisplay ? (
              <span className="text-xs font-normal text-gray-500 ml-1.5">({ageDisplay})</span>
            ) : null;
          })()}
        </span>
      </div>

      {/* 実績登録済み表示 */}
      {hasUsageRecord && (
        <div className="text-[10px] text-green-700 mt-0.5">実績登録済</div>
      )}

      {/* 送迎バッジ */}
      {(hasPickup || hasDropoff) && (
        <div className="flex gap-1 mt-1.5">
          {hasPickup && (
            <span className={`
              px-1.5 py-0.5 rounded text-[10px] font-bold border
              $                                {hasUsageRecord
                                  ? 'bg-white/80 text-green-700 border-green-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                                }
            `}>
              迎
            </span>
          )}
          {hasDropoff && (
            <span className={`
              px-1.5 py-0.5 rounded text-[10px] font-bold border
              $                                {hasUsageRecord
                                  ? 'bg-white/80 text-green-700 border-green-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                                }
            `}>
              送
            </span>
          )}
        </div>
      )}

      {/* 削除ボタン（実績登録済みでない場合のみ） */}
      {onRemove && !hasUsageRecord && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
