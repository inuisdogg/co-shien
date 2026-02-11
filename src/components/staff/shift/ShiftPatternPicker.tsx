/**
 * シフトパターンピッカー
 * シフトパターンを選択するためのドロップダウンコンポーネント
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Plus, Settings } from 'lucide-react';
import { ShiftPattern } from '@/types';
import { formatPatternTimeRange } from '@/utils/shiftDisplayFormatter';

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
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
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
        className={`w-full flex items-center justify-between gap-2 border rounded-lg bg-white transition-colors ${sizeClasses[size]} ${
          isOpen
            ? 'border-teal-500 ring-2 ring-teal-500/20'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedPattern ? (
            <>
              {selectedPattern.color && (
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedPattern.color }}
                />
              )}
              <span className="font-medium text-gray-800 truncate">
                {selectedPattern.name}
              </span>
              {showTimeRange && !selectedPattern.isDayOff && (
                <span className="text-gray-500 truncate">
                  ({formatPatternTimeRange(selectedPattern)})
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {/* 勤務パターン */}
            {workPatterns.length > 0 && (
              <div className="p-1">
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                        isSelected
                          ? 'bg-teal-50 text-teal-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {pattern.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: pattern.color }}
                          />
                        )}
                        <span className="text-sm font-medium">{pattern.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {formatPatternTimeRange(pattern)}
                        </span>
                        {isSelected && <Check size={14} className="text-teal-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 休日パターン */}
            {dayOffPatterns.length > 0 && (
              <div className="p-1 border-t border-gray-100">
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                        isSelected
                          ? 'bg-gray-100 text-gray-700'
                          : 'hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span className="text-sm">{pattern.name}</span>
                      {isSelected && <Check size={14} className="text-gray-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* パターン管理 */}
          {onManagePatterns && (
            <div className="border-t border-gray-200 p-1">
              <button
                onClick={() => {
                  onManagePatterns();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
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
