'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Cloud, Shield, Zap, ArrowRight } from 'lucide-react';

interface ConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolName: string; // e.g. "履歴書", "職務経歴書"
}

export default function ConversionModal({ isOpen, onClose, toolName }: ConversionModalProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const user = localStorage.getItem('user');
      if (user) setIsLoggedIn(true);
    } catch {
      // ignore
    }
  }, []);

  // Don't show for logged-in users
  if (!isOpen || isLoggedIn) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-personal to-personal-dark px-6 py-8 text-white text-center">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 text-white/70 hover:text-white p-1"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
          <Cloud className="w-10 h-10 mx-auto mb-3 opacity-90" />
          <h3 className="text-xl font-bold">
            {toolName}をクラウドに保存しませんか？
          </h3>
          <p className="text-sm text-indigo-100 mt-2">
            無料アカウントで、次回からワンタップ更新
          </p>
        </div>

        {/* Benefits */}
        <div className="px-6 py-5 space-y-3">
          {[
            { icon: Cloud, text: 'データをクラウドに安全保管。スマホからもアクセス' },
            { icon: Zap, text: '次回は入力不要。ワンタップで最新版を生成' },
            { icon: Shield, text: '実務経験証明書のデジタル発行も無料で利用可能' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Icon className="w-4 h-4 text-personal" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-3">
          <Link
            href="/career/signup"
            className="flex items-center justify-center gap-2 w-full bg-personal hover:bg-personal-dark text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-200"
          >
            無料でアカウント作成
            <ArrowRight className="w-5 h-5" />
          </Link>
          <button
            onClick={onClose}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
          >
            今はスキップ
          </button>
        </div>
      </div>
    </div>
  );
}
