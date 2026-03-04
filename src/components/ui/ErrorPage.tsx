'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  brand?: 'primary' | 'personal' | 'client';
}

const brandBg = {
  primary: 'bg-primary hover:bg-primary-dark',
  personal: 'bg-personal hover:bg-personal-dark',
  client: 'bg-client hover:bg-client-dark',
};

export default function ErrorPage({
  error,
  reset,
  title = 'エラーが発生しました',
  description = '画面の読み込み中にエラーが発生しました。再試行してください。',
  homeHref = '/',
  brand = 'primary',
}: ErrorPageProps) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-danger-light rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-danger" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{description}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className={`px-6 py-2.5 text-white rounded-lg transition-colors text-sm font-medium ${brandBg[brand]}`}
          >
            再試行
          </button>
          <button
            onClick={() => (window.location.href = homeHref)}
            className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
