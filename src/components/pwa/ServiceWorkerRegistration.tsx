/**
 * Service Worker Registration Component
 * PWA用のService Workerを登録し、更新を検知してユーザーに通知
 * インストールプロンプトを表示
 */

'use client';

import { useEffect, useState, useRef } from 'react';

export default function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    // Service Workerを登録
    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
      .then((reg) => {
        setRegistration(reg);

        // 更新を定期的にチェック（1時間ごと）
        const updateInterval = setInterval(() => {
          reg.update().catch((error) => {
            console.error('[SW] Update check failed:', error);
          });
        }, 60 * 60 * 1000);

        // 新しいService Workerがインストールされた時
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // 既存のSWが動作中 → 更新が利用可能
                  setUpdateAvailable(true);
                } else {
                  // 初回インストール
                }
              }
            });
          }
        });

        // 既に待機中のSWがあるかチェック
        if (reg.waiting) {
          setUpdateAvailable(true);
        }

        return () => clearInterval(updateInterval);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });

    // Service Workerの更新を検知
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Controller changed - new SW is active
    });

    // PWAインストールプロンプトの処理
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstallBanner(true);
    };

    // インストール完了時にバナーを非表示
    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // 更新を適用
  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
      window.location.reload();
    }
  };

  // PWAインストール
  const handleInstall = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    prompt.prompt();
    const { outcome } = await prompt.userChoice;

    deferredPromptRef.current = null;
    setShowInstallBanner(false);
  };

  // インストールバナーを閉じる
  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
  };

  return (
    <>
      {updateAvailable && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border-2 border-blue-500 rounded-lg shadow-lg p-4 max-w-sm" role="alert">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">新しいバージョンが利用可能です</h3>
              <p className="text-sm text-gray-600 mb-3">
                最新の機能と修正を適用するために、更新してください。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  今すぐ更新
                </button>
                <button
                  onClick={() => setUpdateAvailable(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                >
                  後で
                </button>
              </div>
            </div>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 z-50 bg-white border-2 border-teal-500 rounded-lg shadow-lg p-4 max-w-sm" role="alert">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">アプリをインストール</h3>
              <p className="text-sm text-gray-600 mb-3">
                ホーム画面に追加して、すばやくアクセスできます。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors text-sm font-medium"
                >
                  インストール
                </button>
                <button
                  onClick={dismissInstallBanner}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                >
                  後で
                </button>
              </div>
            </div>
            <button
              onClick={dismissInstallBanner}
              className="text-gray-400 hover:text-gray-600"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
