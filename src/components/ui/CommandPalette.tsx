/**
 * CommandPalette コンポーネント
 * Cmd+K / Ctrl+K で呼び出せるクイックナビゲーション
 *
 * 機能:
 * - キーボードショートカット (Cmd+K / Ctrl+K) で開閉
 * - メニュー項目の検索・フィルタリング
 * - 矢印キーで上下移動、Enterで選択、Escapeで閉じる
 * - カテゴリ名・説明文も検索対象
 */

'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import type { SidebarMenuItem } from '@/components/common/Sidebar';
import { MENU_DESCRIPTIONS } from '@/components/common/Sidebar';

export interface CommandPaletteItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: string | number; strokeWidth?: string | number; className?: string }>;
  category: string;
  description?: string;
}

interface CommandPaletteProps {
  items: CommandPaletteItem[];
  setActiveTab: (tab: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ items, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // フィルタリング結果
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => {
      const desc = item.description || MENU_DESCRIPTIONS[item.id] || '';
      return (
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      );
    });
  }, [query, items]);

  // selectedIndex をフィルタ結果の範囲内に制限
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // グローバルキーボードショートカット: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            // 開く時にクエリをリセット
            setQuery('');
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 開いたときに入力欄にフォーカス
  useEffect(() => {
    if (isOpen) {
      // 次のフレームでフォーカス
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // パレット内のキーボード操作
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(filteredItems.length, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(filteredItems.length, 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            setActiveTab(filteredItems[selectedIndex].id);
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [filteredItems, selectedIndex, setActiveTab]
  );

  // 選択中のアイテムをスクロールして表示
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // オーバーレイクリックで閉じる
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="コマンドパレット"
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* 検索入力欄 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="メニュー名やキーワードで検索..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            autoComplete="off"
            spellCheck={false}
            aria-label="メニュー検索"
            role="combobox"
            aria-expanded={filteredItems.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={filteredItems[selectedIndex] ? `command-item-${filteredItems[selectedIndex].id}` : undefined}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded">
            ESC
          </kbd>
        </div>

        {/* 結果リスト */}
        <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              「{query}」に一致するメニューがありません
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const ItemIcon = item.icon;
              const isSelected = index === selectedIndex;
              const description = item.description || MENU_DESCRIPTIONS[item.id] || '';

              return (
                <button
                  key={item.id}
                  id={`command-item-${item.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75 ${
                    isSelected ? 'bg-primary/8 text-primary' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary/15' : 'bg-gray-100'
                    }`}
                  >
                    <ItemIcon size={16} strokeWidth={2} className={isSelected ? 'text-primary' : 'text-gray-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.label}</span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                        {item.category}
                      </span>
                    </div>
                    {description && (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{description}</p>
                    )}
                  </div>
                  {isSelected && (
                    <CornerDownLeft size={14} className="text-gray-400 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* フッター: キーボードショートカットガイド */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded font-mono">↑</kbd>
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded font-mono">↓</kbd>
            <span>移動</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded font-mono">Enter</kbd>
            <span>選択</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded font-mono">Esc</kbd>
            <span>閉じる</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
