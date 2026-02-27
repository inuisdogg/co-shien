'use client';

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  confirmColor,
  onConfirm,
  onCancel,
  isDestructive = false,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const btnColor = confirmColor
    ? confirmColor
    : isDestructive
    ? '#ef4444'
    : '#00c4cc';

  const btnHoverColor = isDestructive ? '#dc2626' : '#00b0b8';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{message}</p>
        </div>

        <div className="mt-5 flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ backgroundColor: btnColor }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = confirmColor || btnHoverColor)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = btnColor)}
            className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
