/**
 * Notion風リッチテキストエディター
 * スラッシュコマンド、絵文字、インライン装飾対応
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Highlighter,
  Link as LinkIcon,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Smile,
  Type,
  Minus,
  X,
  FileCode,
  CornerDownLeft,
} from 'lucide-react';

const lowlight = createLowlight(common);

// スラッシュコマンドのアイテム定義
const SLASH_COMMANDS = [
  { id: 'paragraph', label: 'テキスト', description: '通常のテキスト', icon: Type, command: (editor: Editor | null) => editor?.chain().focus().setParagraph().run() },
  { id: 'h1', label: '見出し1', description: '大きな見出し', icon: Heading1, command: (editor: Editor | null) => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2', label: '見出し2', description: '中くらいの見出し', icon: Heading2, command: (editor: Editor | null) => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3', label: '見出し3', description: '小さな見出し', icon: Heading3, command: (editor: Editor | null) => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'bullet', label: '箇条書き', description: '箇条書きリスト', icon: List, command: (editor: Editor | null) => editor?.chain().focus().toggleBulletList().run() },
  { id: 'numbered', label: '番号付きリスト', description: '番号付きリスト', icon: ListOrdered, command: (editor: Editor | null) => editor?.chain().focus().toggleOrderedList().run() },
  { id: 'todo', label: 'To-Do', description: 'チェックリスト', icon: CheckSquare, command: (editor: Editor | null) => editor?.chain().focus().toggleTaskList().run() },
  { id: 'quote', label: '引用', description: '引用ブロック', icon: Quote, command: (editor: Editor | null) => editor?.chain().focus().toggleBlockquote().run() },
  { id: 'code', label: 'コードブロック', description: 'コードを記述', icon: FileCode, command: (editor: Editor | null) => editor?.chain().focus().toggleCodeBlock().run() },
  { id: 'divider', label: '区切り線', description: '水平の区切り線', icon: Minus, command: (editor: Editor | null) => editor?.chain().focus().setHorizontalRule().run() },
];

// よく使う絵文字
const COMMON_EMOJIS = [
  '😀', '😊', '🎉', '👍', '❤️', '🔥', '✨', '💡', '📝', '✅',
  '⚠️', '❌', '❓', '💪', '🙏', '👏', '🎯', '📌', '🏷️', '📋',
  '📅', '⏰', '🔔', '📞', '✉️', '🏠', '🚗', '🎁', '🌟', '💯',
];

interface NotionLikeEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const NotionLikeEditor: React.FC<NotionLikeEditorProps> = ({
  content,
  onChange,
  placeholder = '「/」でコマンドを入力...',
  editable = true,
}) => {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-600 underline cursor-pointer hover:text-purple-800',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());

      // スラッシュコマンドの検出
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 20), from);
      const slashMatch = textBefore.match(/\/([^\/\s]*)$/);

      if (slashMatch) {
        setSlashFilter(slashMatch[1] || '');
        setShowSlashMenu(true);
        setSelectedSlashIndex(0);

        // メニュー位置の計算
        const coords = editor.view.coordsAtPos(from);
        if (editorRef.current) {
          const rect = editorRef.current.getBoundingClientRect();
          setSlashMenuPosition({
            top: coords.bottom - rect.top + 5,
            left: Math.min(coords.left - rect.left, rect.width - 300),
          });
        }
      } else {
        setShowSlashMenu(false);
        setSlashFilter('');
      }
    },
  });

  // キーボードイベントのハンドリング
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showSlashMenu) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (event.key === 'Enter' && showSlashMenu) {
        event.preventDefault();
        const command = filteredCommands[selectedSlashIndex];
        if (command) {
          executeSlashCommand(command);
        }
      } else if (event.key === 'Escape') {
        setShowSlashMenu(false);
        setSlashFilter('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, showSlashMenu, selectedSlashIndex]);

  // コンテンツが外部から変更された場合に更新
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // フィルタリングされたスラッシュコマンド
  const filteredCommands = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(slashFilter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // スラッシュコマンド実行
  const executeSlashCommand = useCallback(
    (command: (typeof SLASH_COMMANDS)[0]) => {
      if (!editor) return;

      // スラッシュとフィルターテキストを削除
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 20), from);
      const slashIndex = textBefore.lastIndexOf('/');
      if (slashIndex !== -1) {
        const deleteFrom = from - (textBefore.length - slashIndex);
        editor.commands.deleteRange({ from: deleteFrom, to: from });
      }

      command.command(editor);
      setShowSlashMenu(false);
      setSlashFilter('');
    },
    [editor]
  );

  // 絵文字挿入
  const insertEmoji = useCallback(
    (emoji: string) => {
      editor?.chain().focus().insertContent(emoji).run();
      setShowEmojiPicker(false);
    },
    [editor]
  );

  // リンク設定
  const setLink = useCallback(() => {
    if (!linkUrl) {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  // クリックでスラッシュメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) {
    return <div className="animate-pulse bg-gray-100 h-[300px] rounded-lg" />;
  }

  return (
    <div ref={editorRef} className="relative border border-gray-200 rounded-xl bg-white">
      {/* 上部ツールバー */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        {/* テキスト装飾 */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="太字 (⌘B)"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="斜体 (⌘I)"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="下線 (⌘U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="取り消し線"
          >
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title="インラインコード"
          >
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
            isActive={editor.isActive('highlight')}
            title="ハイライト"
          >
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* 見出し */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="見出し1"
          >
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="見出し2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="見出し3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* リスト */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="箇条書き"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="番号付きリスト"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            isActive={editor.isActive('taskList')}
            title="チェックリスト"
          >
            <CheckSquare className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* その他 */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="引用"
          >
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="コードブロック"
          >
            <FileCode className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="区切り線"
          >
            <Minus className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* 配置 */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="左揃え"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="中央揃え"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="右揃え"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* 絵文字・リンク */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            isActive={showEmojiPicker}
            title="絵文字"
          >
            <Smile className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              const previousUrl = editor.getAttributes('link').href;
              setLinkUrl(previousUrl || '');
              setShowLinkInput(true);
            }}
            isActive={editor.isActive('link')}
            title="リンク"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* ヒント */}
        <div className="ml-auto text-xs text-gray-400 hidden sm:block">
          <span className="bg-gray-200 px-1.5 py-0.5 rounded">/</span> でコマンド入力
        </div>
      </div>

      {/* エディター本体 */}
      <EditorContent editor={editor} className="notion-editor" />

      {/* スラッシュコマンドメニュー */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div
          ref={slashMenuRef}
          className="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-72 max-h-80 overflow-y-auto"
          style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
        >
          <div className="p-2 text-xs text-gray-500 border-b border-gray-100">
            ブロックを選択
          </div>
          <div className="p-1">
            {filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => executeSlashCommand(cmd)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  index === selectedSlashIndex
                    ? 'bg-purple-50 text-purple-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  index === selectedSlashIndex ? 'bg-purple-100' : 'bg-gray-100'
                }`}>
                  <cmd.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-sm">{cmd.label}</div>
                  <div className="text-xs text-gray-500">{cmd.description}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" /> 選択
            </span>
            <span>↑↓ 移動</span>
            <span>Esc 閉じる</span>
          </div>
        </div>
      )}

      {/* 絵文字ピッカー */}
      {showEmojiPicker && (
        <div className="absolute top-14 right-4 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">絵文字</span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-10 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* リンク入力モーダル */}
      {showLinkInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-96 shadow-xl">
            <h3 className="font-bold text-gray-900 mb-3">リンクを設定</h3>
            <input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setLink()}
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkUrl('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              {editor.isActive('link') && (
                <button
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setShowLinkInput(false);
                    setLinkUrl('');
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  リンク解除
                </button>
              )}
              <button
                onClick={setLink}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* エディタースタイル */}
      <style jsx global>{`
        .notion-editor .ProseMirror {
          min-height: 300px;
          padding: 1rem;
          outline: none;
        }

        .notion-editor .ProseMirror.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }

        .notion-editor .ProseMirror h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .notion-editor .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .notion-editor .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .notion-editor .ProseMirror p {
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }

        .notion-editor .ProseMirror ul,
        .notion-editor .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .notion-editor .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }

        .notion-editor .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .notion-editor .ProseMirror ul[data-type="taskList"] li label {
          display: flex;
          align-items: center;
        }

        .notion-editor .ProseMirror ul[data-type="taskList"] li input[type="checkbox"] {
          width: 1rem;
          height: 1rem;
          margin-top: 0.25rem;
          accent-color: #9333ea;
        }

        .notion-editor .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div > p {
          text-decoration: line-through;
          color: #9ca3af;
        }

        .notion-editor .ProseMirror blockquote {
          border-left: 3px solid #9333ea;
          padding-left: 1rem;
          margin-left: 0;
          margin-bottom: 0.5rem;
          color: #6b7280;
          font-style: italic;
        }

        .notion-editor .ProseMirror pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-bottom: 0.5rem;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
        }

        .notion-editor .ProseMirror code {
          background: #f3f4f6;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875em;
          color: #dc2626;
        }

        .notion-editor .ProseMirror pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }

        .notion-editor .ProseMirror hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5rem 0;
        }

        .notion-editor .ProseMirror mark {
          background: #fef08a;
          padding: 0.125rem 0;
        }

        .notion-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }

        /* Syntax highlighting */
        .notion-editor .hljs-comment,
        .notion-editor .hljs-quote {
          color: #6b7280;
        }

        .notion-editor .hljs-variable,
        .notion-editor .hljs-template-variable,
        .notion-editor .hljs-attribute,
        .notion-editor .hljs-tag,
        .notion-editor .hljs-name,
        .notion-editor .hljs-regexp,
        .notion-editor .hljs-link,
        .notion-editor .hljs-selector-id,
        .notion-editor .hljs-selector-class {
          color: #f87171;
        }

        .notion-editor .hljs-number,
        .notion-editor .hljs-meta,
        .notion-editor .hljs-built_in,
        .notion-editor .hljs-builtin-name,
        .notion-editor .hljs-literal,
        .notion-editor .hljs-type,
        .notion-editor .hljs-params {
          color: #fb923c;
        }

        .notion-editor .hljs-string,
        .notion-editor .hljs-symbol,
        .notion-editor .hljs-bullet {
          color: #4ade80;
        }

        .notion-editor .hljs-title,
        .notion-editor .hljs-section {
          color: #fbbf24;
        }

        .notion-editor .hljs-keyword,
        .notion-editor .hljs-selector-tag {
          color: #c084fc;
        }
      `}</style>
    </div>
  );
};

// ツールバーボタンコンポーネント
const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      isActive
        ? 'bg-purple-100 text-purple-700'
        : 'text-gray-600 hover:bg-gray-200'
    }`}
  >
    {children}
  </button>
);

export default NotionLikeEditor;
