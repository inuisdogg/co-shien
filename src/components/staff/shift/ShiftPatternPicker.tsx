/**
 * シフトパターンピッカー
 * ビジュアルパターンカードで選択するドロップダウンコンポーネント
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Settings } from 'lucide-react';
import { ShiftPattern } from '@/types';
import { formatPatternTimeRange, patternColorToRgba } from '@/utils/shiftDisplayFormatter';

interface ShiftPatternPickerProps {
  patterns: ShiftPattern[];
  selectedPatternId?: string;
  onSelect: (pattern: ShiftPattern) => void;
  onManagePatterns?: () => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  showTimeRange?: boolean;
  className?: string;
}

const ShiftPatternPicker: React.FC<ShiftPatternPickerProps> = ({
  patterns,
  selectedPatternId,
  onSelect,
  onManagePatterns,
  placeholder = 'パターンを選択',
  size = 'md',
  showTimeRange = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPattern = patterns.find((p) => p.id === selectedPatternId);

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // サイズクラス
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-xs min-h-8',
    md: 'px-3 py-2 text-sm min-h-10',
    lg: 'px-4 py-2.5 text-base min-h-11',
  };

  // 勤務パターンと休日パターンを分離
  const workPatterns = patterns.filter((p) => !p.isDayOff);
  const dayOffPatterns = patterns.filter((p) => p.isDayOff);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg bg-white transition-all duration-200 ${sizeClasses[size]} ${
          isOpen
            ? 'border-[#00c4cc] ring-2 ring-[#00c4cc]/20'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedPattern ? (
            <>
              {selectedPattern.color && (
                <div
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                  style={{ backgroundColor: selectedPattern.color }}
                />
              )}
              <span className="font-medium text-gray-800 truncate">
                {selectedPattern.name}
              </span>
              {showTimeRange && !selectedPattern.isDayOff && (
                <span className="text-gray-400 truncate font-mono text-xs">
                  {formatPatternTimeRange(selectedPattern)}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {/* 勤務パターン - ビジュアルカード */}
            {workPatterns.length > 0 && (
              <div className="p-1.5">
                <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  勤務パターン
                </div>
                {workPatterns.map((pattern) => {
                  const isSelected = pattern.id === selectedPatternId;
                  return (
                    <button
                      key={pattern.id}
                      onClick={() => {
                        onSelect(pattern);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 min-h-10 ${
                        isSelected
                          ? 'ring-1 ring-[#00c4cc]/30'
                          : 'hover:bg-gray-50'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: patternColorToRgba(pattern.color, 0.08) }
                          : undefined
                      }
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                        style={{ backgroundColor: pattern.color || '#00c4cc' }}
                      />
                      <div className="flex-1 text-left">
                        <span className="text-sm font-medium text-gray-800">{pattern.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {formatPatternTimeRange(pattern)}
                      </span>
                      {isSelected && <Check size={14} className="text-[#00c4cc] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 休日パターン */}
            {dayOffPatterns.length > 0 && (
              <div className="p-1.5 border-t border-gray-100">
                <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  休日
                </div>
                {dayOffPatterns.map((pattern) => {
                  const isSelected = pattern.id === selectedPatternId;
                  return (
                    <button
                      key={pattern.id}
                      onClick={() => {
                        onSelect(pattern);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 min-h-10 ${
                        isSelected
                          ? 'bg-gray-100 ring-1 ring-gray-300'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-gray-300 flex-shrink-0 ring-2 ring-white shadow-sm" />
                      <span className="text-sm text-gray-600">{pattern.name}</span>
                      {isSelected && <Check size={14} className="text-gray-600 ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* パターン管理 */}
          {onManagePatterns && (
            <div className="border-t border-gray-200 p-1.5">
              <button
                onClick={() => {
                  onManagePatterns();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-all duration-200 min-h-10"
              >
                <Settings size={14} />
                パターンを管理
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShiftPatternPicker;
