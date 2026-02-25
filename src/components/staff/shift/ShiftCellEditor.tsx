/**
 * シフトセルエディタ
 * クリーンなポップオーバーでシフトを編集
 * - パターンをビジュアルカードで表示
 * - 時間範囲を目立つ表示
 * - カスタム時間入力
 * - デフォルトパターン推奨表示
 * - 希望状況インジケータ
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Clock, Check, Star, AlertCircle, CheckCircle } from 'lucide-react';
import { ShiftPattern, ShiftWithPattern, DefaultWorkPattern } from '@/types';
import { formatShiftDisplay, formatPatternTimeRange, patternColorToRgba } from '@/utils/shiftDisplayFormatter';

interface ShiftCellEditorProps {
  shift?: ShiftWithPattern;
  patterns: ShiftPattern[];
  onSelect: (patternId: string | null, customTime?: { startTime: string; endTime: string }) => void;
  onClose: () => void;
  position?: { x: number; y: number };
  /** Default work pattern for this staff on this day of week */
  defaultPattern?: DefaultWorkPattern;
  /** Whether the staff is available on this date (undefined = no data) */
  staffAvailable?: boolean;
}

const ShiftCellEditor: React.FC<ShiftCellEditorProps> = ({
  shift,
  patterns,
  onSelect,
  onClose,
  position,
  defaultPattern,
  staffAvailable,
}) => {
  const [mode, setMode] = useState<'pattern' | 'custom'>('pattern');
  const [customStart, setCustomStart] = useState(
    defaultPattern?.startTime || '09:00'
  );
  const [customEnd, setCustomEnd] = useState(
    defaultPattern?.endTime || '17:00'
  );
  const editorRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectPattern = (pattern: ShiftPattern) => {
    onSelect(pattern.id);
    onClose();
  };

  const handleClearShift = () => {
    onSelect(null);
    onClose();
  };

  const handleConfirmCustom = () => {
    onSelect(null, { startTime: customStart, endTime: customEnd });
    onClose();
  };

  const dayOffPattern = patterns.find((p) => p.isDayOff);
  const workPatterns = patterns.filter((p) => !p.isDayOff);

  const currentDisplay = shift ? formatShiftDisplay(shift) : '未設定';

  // Determine which pattern is recommended by default
  const recommendedPatternId = defaultPattern?.patternId;

  // Determine if a pattern matches the default for this day
  const isRecommended = (patternId: string): boolean => {
    if (!defaultPattern) return false;
    return patternId === recommendedPatternId;
  };

  return (
    <div
      ref={editorRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-72 overflow-hidden"
      style={
        position
          ? {
              left: position.x,
              top: position.y,
              transform: 'translateY(4px)',
            }
          : undefined
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">シフト編集</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {currentDisplay}
          </span>
        </div>
        <button
          onClick={onClose}
          className="min-h-10 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
        >
          <X size={16} />
        </button>
      </div>

      {/* Availability indicator */}
      {staffAvailable !== undefined && (
        <div
          className={`flex items-center gap-2 px-4 py-2 text-xs ${
            staffAvailable
              ? 'bg-green-50 text-green-700 border-b border-green-100'
              : 'bg-red-50 text-red-700 border-b border-red-100'
          }`}
        >
          {staffAvailable ? (
            <>
              <CheckCircle size={14} />
              <span>この日は出勤希望あり</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} />
              <span>この日は出勤希望なし</span>
            </>
          )}
        </div>
      )}

      {/* Default pattern recommendation */}
      {defaultPattern && !shift?.hasShift && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-xs border-b border-amber-100">
          <Star size={14} />
          <span>
            デフォルト: {defaultPattern.type === 'full' ? 'フル' : defaultPattern.type === 'am' ? '午前' : '午後'}
            {defaultPattern.startTime && defaultPattern.endTime
              ? ` (${defaultPattern.startTime}-${defaultPattern.endTime})`
              : ''}
          </span>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setMode('pattern')}
          className={`flex-1 min-h-10 py-2.5 text-sm font-medium transition-all duration-200 ${
            mode === 'pattern'
              ? 'text-[#00c4cc] border-b-2 border-[#00c4cc] bg-[#00c4cc]/5'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          パターン
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`flex-1 min-h-10 py-2.5 text-sm font-medium transition-all duration-200 ${
            mode === 'custom'
              ? 'text-[#00c4cc] border-b-2 border-[#00c4cc] bg-[#00c4cc]/5'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          カスタム
        </button>
      </div>

      {/* Content */}
      <div className="max-h-72 overflow-y-auto">
        {mode === 'pattern' ? (
          <div className="p-2 space-y-1">
            {/* Work patterns */}
            {workPatterns.map((pattern) => {
              const timeRange = formatPatternTimeRange(pattern);
              const isSelected = shift?.shiftPattern?.id === pattern.id;
              const recommended = isRecommended(pattern.id);

              return (
                <button
                  key={pattern.id}
                  onClick={() => handleSelectPattern(pattern)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-left min-h-10 ${
                    isSelected
                      ? 'ring-2 ring-[#00c4cc]/30'
                      : recommended
                      ? 'ring-1 ring-amber-300 bg-amber-50/50'
                      : 'hover:bg-gray-50'
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: patternColorToRgba(pattern.color, 0.1) }
                      : undefined
                  }
                >
                  {/* Color dot */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: pattern.color || '#00c4cc' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-800">
                          {pattern.name}
                        </span>
                        {recommended && (
                          <Star size={12} className="text-amber-500 fill-amber-500" />
                        )}
                      </div>
                      {isSelected && <Check size={14} className="text-[#00c4cc]" />}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{timeRange}</span>
                  </div>
                </button>
              );
            })}

            {/* Separator */}
            {workPatterns.length > 0 && (
              <div className="border-t border-gray-100 my-1.5" />
            )}

            {/* Day off */}
            {dayOffPattern && (
              <button
                onClick={() => handleSelectPattern(dayOffPattern)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-left min-h-10 ${
                  shift?.shiftPattern?.isDayOff
                    ? 'bg-gray-100 ring-2 ring-gray-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-gray-300 flex-shrink-0 ring-2 ring-white shadow-sm" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-600">
                    {dayOffPattern.name}
                  </span>
                </div>
                {shift?.shiftPattern?.isDayOff && (
                  <Check size={14} className="text-gray-500" />
                )}
              </button>
            )}

            {/* Clear shift */}
            <button
              onClick={handleClearShift}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-red-50 transition-all duration-200 text-left min-h-10"
            >
              <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 flex-shrink-0" />
              <span className="text-sm text-gray-500">シフトを削除</span>
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Custom time input */}
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#00c4cc]" />
              <span className="text-sm font-bold text-gray-700">勤務時間</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 min-h-10 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm font-mono transition-all duration-200"
              />
              <span className="text-gray-400 font-bold">~</span>
              <input
                type="time"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 min-h-10 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm font-mono transition-all duration-200"
              />
            </div>

            {/* Preview */}
            <div className="p-3 bg-[#00c4cc]/5 rounded-lg text-center border border-[#00c4cc]/10">
              <span className="text-sm text-gray-500">表示: </span>
              <span className="text-lg font-bold text-[#00c4cc]">
                {customStart.split(':')[0].replace(/^0/, '')}
                -
                {customEnd.split(':')[0].replace(/^0/, '')}
              </span>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirmCustom}
              className="w-full flex items-center justify-center gap-2 min-h-10 px-4 py-2.5 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-all duration-200 font-medium"
            >
              <Check size={16} />
              確定
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftCellEditor;
