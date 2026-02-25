/**
 * シフトセルエディタ
 * シフトカレンダーの各セルを編集するコンポーネント
 * 時間表記（9-17形式）で表示し、パターン選択または直接入力で編集
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Clock, Check } from 'lucide-react';
import { ShiftPattern, ShiftWithPattern } from '@/types';
import { formatShiftDisplay, formatPatternTimeRange } from '@/utils/shiftDisplayFormatter';

interface ShiftCellEditorProps {
  shift?: ShiftWithPattern;
  patterns: ShiftPattern[];
  onSelect: (patternId: string | null, customTime?: { startTime: string; endTime: string }) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

const ShiftCellEditor: React.FC<ShiftCellEditorProps> = ({
  shift,
  patterns,
  onSelect,
  onClose,
  position,
}) => {
  const [mode, setMode] = useState<'pattern' | 'custom'>('pattern');
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('17:00');
  const editorRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // パターン選択
  const handleSelectPattern = (pattern: ShiftPattern) => {
    onSelect(pattern.id);
    onClose();
  };

  // シフトなし
  const handleClearShift = () => {
    onSelect(null);
    onClose();
  };

  // カスタム時間で確定
  const handleConfirmCustom = () => {
    onSelect(null, { startTime: customStart, endTime: customEnd });
    onClose();
  };

  // 休日パターンを取得
  const dayOffPattern = patterns.find((p) => p.isDayOff);
  const workPatterns = patterns.filter((p) => !p.isDayOff);

  // 現在の表示値
  const currentDisplay = shift ? formatShiftDisplay(shift) : '-';

  return (
    <div
      ref={editorRef}
      className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-64 overflow-hidden"
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div>
          <span className="text-sm font-medium text-gray-800">シフト編集</span>
          {shift?.hasShift && (
            <span className="ml-2 text-xs text-gray-500">現在: {currentDisplay}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X size={16} />
        </button>
      </div>

      {/* モード切り替え */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setMode('pattern')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mode === 'pattern'
              ? 'text-[#00c4cc] border-b-2 border-[#00c4cc]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          パターン
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mode === 'custom'
              ? 'text-[#00c4cc] border-b-2 border-[#00c4cc]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          カスタム
        </button>
      </div>

      {/* コンテンツ */}
      <div className="max-h-64 overflow-y-auto">
        {mode === 'pattern' ? (
          <div className="p-2 space-y-1">
            {/* 勤務パターン */}
            {workPatterns.map((pattern) => {
              const timeRange = formatPatternTimeRange(pattern);
              const isSelected = shift?.shiftPattern?.id === pattern.id;

              return (
                <button
                  key={pattern.id}
                  onClick={() => handleSelectPattern(pattern)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                    isSelected
                      ? 'bg-[#00c4cc]/5 border border-[#00c4cc]/20'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {pattern.color && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: pattern.color }}
                      />
                    )}
                    <span className="text-sm font-medium text-gray-800">
                      {pattern.name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{timeRange}</span>
                </button>
              );
            })}

            {/* 区切り線 */}
            {workPatterns.length > 0 && (
              <div className="border-t border-gray-200 my-2" />
            )}

            {/* 休日 */}
            {dayOffPattern && (
              <button
                onClick={() => handleSelectPattern(dayOffPattern)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left ${
                  shift?.shiftPattern?.isDayOff
                    ? 'bg-gray-100 border border-gray-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium text-gray-600">
                  {dayOffPattern.name}
                </span>
                <span className="text-sm text-gray-400">休</span>
              </button>
            )}

            {/* シフトなし */}
            <button
              onClick={handleClearShift}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-sm text-gray-500">シフトを削除</span>
              <span className="text-sm text-gray-400">-</span>
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* カスタム時間入力 */}
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">勤務時間</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="time"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
              />
            </div>

            {/* プレビュー */}
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <span className="text-sm text-gray-500">表示: </span>
              <span className="text-lg font-bold text-[#00c4cc]">
                {customStart.replace(':', '').replace(/^0/, '').slice(0, -2) ||
                  customStart.split(':')[0].replace(/^0/, '')}
                -
                {customEnd.replace(':', '').replace(/^0/, '').slice(0, -2) ||
                  customEnd.split(':')[0].replace(/^0/, '')}
              </span>
            </div>

            {/* 確定ボタン */}
            <button
              onClick={handleConfirmCustom}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors"
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
