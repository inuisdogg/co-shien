'use client';

import React, { useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  buttonLabel?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const iconMap = {
  success: { Icon: CheckCircle, color: 'text-green-500' },
  error: { Icon: XCircle, color: 'text-red-500' },
  warning: { Icon: AlertCircle, color: 'text-amber-500' },
  info: { Icon: Info, color: 'text-blue-500' },
};

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  buttonLabel = 'OK',
  type = 'info',
  onClose,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const { Icon, color } = iconMap[type];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <Icon className={`w-10 h-10 ${color}`} />
          {title && <h3 className="text-lg font-bold text-gray-800">{title}</h3>}
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{message}</p>
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#00c4cc] text-white text-sm font-medium rounded-lg hover:bg-[#00b0b8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:ring-offset-2"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
