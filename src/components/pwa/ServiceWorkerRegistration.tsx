/**
 * Service Worker Registration Component
 * PWA用のService Workerを登録し、更新を検知してユーザーに通知
 */

'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      // Service Workerを登録
      navigator.serviceWorker
        .register('/sw.js', {
          // スコープをルートに設定
          scope: '/',
        })
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);

          // 更新が利用可能かチェック
          checkForUpdates(reg);

          // 定期的に更新をチェック（5分ごと）
          const updateInterval = setInterval(() => {
            checkForUpdates(reg);
          }, 5 * 60 * 1000);

          // クリーンアップ
          return () => clearInterval(updateInterval);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });

      // Service Workerの更新を検知
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // 新しいService Workerが制御を取得した時、ページをリロード
        window.location.reload();
      });

      // PWAインストールプロンプトの処理（オプション）
      let deferredPrompt: any;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
      });
    }
  }, []);

  // 更新が利用可能かチェック
  const checkForUpdates = (reg: ServiceWorkerRegistration) => {
    reg.update().then(() => {
      // 更新されたService Workerが待機中かチェック
      if (reg.waiting) {
        setUpdateAvailable(true);
      }
    });

    // 新しいService Workerがインストールされた時
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 既存のService Workerが動作している場合、更新が利用可能
            setUpdateAvailable(true);
          }
        });
      }
    });
  };

  // 更新を適用
  const handleUpdate = () => {
    if (registration?.waiting) {
      // 待機中のService Workerにメッセージを送信してスキップ
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
      // ページをリロード（controllerchangeイベントでもリロードされるが、念のため）
      window.location.reload();
    }
  };

  // PWAインストールプロンプトの処理（オプション）
  useEffect(() => {
    let deferredPrompt: any;
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return (
    <>
      {updateAvailable && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border-2 border-blue-500 rounded-lg shadow-lg p-4 max-w-sm">
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
    </>
  );
}


