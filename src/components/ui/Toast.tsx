'use client';

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for components outside provider
    return {
      toast: {
        success: (msg: string) => { console.info('[Toast]', msg); },
        error: (msg: string) => { console.warn('[Toast Error]', msg); },
        warning: (msg: string) => { console.warn('[Toast Warning]', msg); },
        info: (msg: string) => { console.info('[Toast]', msg); },
      },
    };
  }
  return ctx;
}

const iconMap: Record<ToastType, { Icon: typeof CheckCircle; bg: string; border: string; text: string }> = {
  success: { Icon: CheckCircle, bg: 'bg-success-light', border: 'border-success', text: 'text-success' },
  error: { Icon: XCircle, bg: 'bg-danger-light', border: 'border-danger', text: 'text-danger' },
  warning: { Icon: AlertCircle, bg: 'bg-warning-light', border: 'border-warning', text: 'text-warning' },
  info: { Icon: Info, bg: 'bg-info-light', border: 'border-info', text: 'text-info' },
};

function ToastNotification({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const { Icon, bg, border, text } = iconMap[item.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(item.id), 300);
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${bg} ${border} shadow-lg max-w-sm w-full transition-all duration-300 ${
        exiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
      }`}
      role="alert"
    >
      <Icon className={`w-5 h-5 ${text} shrink-0 mt-0.5`} />
      <p className="text-sm text-gray-800 flex-1 whitespace-pre-wrap">{item.message}</p>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onRemove(item.id), 300);
        }}
        className="text-gray-400 hover:text-gray-600 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  const toast = {
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number) => addToast(message, 'error', duration ?? 5000),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration ?? 4000),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastNotification item={item} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
