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
      // 既存のService Workerを全てアンインストール（強制クリーンアップ）
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().then((success) => {
            if (success) {
              console.log('[SW] Unregistered old Service Worker');
            }
          });
        }
      }).then(() => {
        // 既存のキャッシュを全て削除
        if ('caches' in window) {
          caches.keys().then((cacheNames) => {
            return Promise.all(
              cacheNames.map((cacheName) => {
                console.log('[SW] Deleting cache:', cacheName);
                return caches.delete(cacheName);
              })
            );
          });
        }
      }).then(() => {
        // 少し待ってから新しいService Workerを登録
        return new Promise(resolve => setTimeout(resolve, 100));
      }).then(() => {
        // Service Workerを登録（キャッシュを無視して最新版を取得）
        return navigator.serviceWorker.register('/sw.js', {
          // スコープをルートに設定
          scope: '/',
          // 更新を強制（キャッシュを無視）- これにより、常に最新のSWファイルを取得
          updateViaCache: 'none',
        });
      })
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);

          // 即座に更新をチェック
          checkForUpdates(reg);

          // ページロード時に必ず更新をチェック
          window.addEventListener('focus', () => {
            checkForUpdates(reg);
          });

          // 定期的に更新をチェック（5分ごと）- 頻繁すぎると問題が発生するため間隔を延長
          const updateInterval = setInterval(() => {
            checkForUpdates(reg);
          }, 5 * 60 * 1000);

          // クリーンアップ
          return () => clearInterval(updateInterval);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });

      // Service Workerの更新を検知（自動リロードは削除）
      // 自動リロードはユーザー体験を損なうため、ユーザーが明示的に更新ボタンを押した時のみリロード
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // 新しいService Workerが制御を取得した時
        console.log('[SW] Controller changed');
        // 自動リロードは行わない（ユーザーが明示的に更新ボタンを押した時のみリロード）
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
    // 既に待機中のService Workerがある場合は再チェックしない
    if (reg.waiting) {
      return;
    }

    // キャッシュを無視して強制的に更新をチェック（ただし頻繁に呼ばれないように注意）
    reg.update().then(() => {
      // 更新されたService Workerが待機中かチェック
      if (reg.waiting) {
        console.log('[SW] Update available, waiting for user confirmation');
        setUpdateAvailable(true);
      }
    }).catch((error) => {
      console.error('[SW] Update check failed:', error);
    });

    // 新しいService Workerがインストールされた時（一度だけ実行）
    if (!reg.installing && !reg.waiting) {
      const handleUpdateFound = () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[SW] New worker state:', newWorker.state);
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // 既存のService Workerが動作している場合、更新が利用可能
                console.log('[SW] New version installed, update available');
                setUpdateAvailable(true);
              } else {
                // 初回インストール
                console.log('[SW] Service Worker installed for the first time');
              }
            }
          });
        }
      };

      // 既にリスナーが登録されていない場合のみ追加
      reg.addEventListener('updatefound', handleUpdateFound);
    }
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


