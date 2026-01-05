// Service Worker for PWA
// バージョン管理: デプロイごとにこのファイルの内容が変更されることで、ブラウザが新しいバージョンとして認識
// このファイルを編集するたびに、ブラウザは新しいService Workerとして認識する
// バージョン番号を手動で更新するか、ビルド時に自動生成する
const CACHE_VERSION = 'v3';
const CACHE_NAME = `co-shien-${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/logo-cropped-center.png'
];

// Install event: 新しいService Workerがインストールされた時
self.addEventListener('install', (event) => {
  // skipWaiting: 新しいSWが来たら、古いSWを待たずに即座に有効化
  // これにより、ユーザーが次にページを開いた時に自動で最新版に差し替わる
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // インストール完了後、即座にアクティベート
        return self.skipWaiting();
      })
  );
});

// Activate event: Service Workerがアクティブになった時
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // 古いキャッシュを全て削除
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 全てのクライアント（開いているタブ）に対して、新しいSWを即座に制御させる
      return self.clients.claim();
    })
  );
});

// Fetch event: ネットワークリクエストをインターセプト
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // HTMLファイル（ページ）は常にネットワークから取得し、絶対にキャッシュしない
  // これにより、常に最新のHTML（＝最新のJSファイル名）を取得できる
  // Service Workerファイル自体も常に最新を取得
  if (request.method === 'GET' && 
      (request.headers.get('accept')?.includes('text/html') || 
       url.pathname === '/' || 
       url.pathname === '/sw.js' ||
       url.pathname === '/manifest.json' ||
       (!url.pathname.includes('.') && !url.pathname.startsWith('/_next/')))) {
    event.respondWith(
      fetch(request, {
        // キャッシュを完全に無視して、常にネットワークから取得
        cache: 'no-store',
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
        .then((response) => {
          // HTMLは絶対にキャッシュに保存しない（常に最新を取得）
          return response;
        })
        .catch(() => {
          // オフライン時のみキャッシュから取得（フォールバック）
          return caches.match(request);
        })
    );
    return;
  }
  
  // その他のリソース（JS、CSS、画像など）はキャッシュ優先、フォールバックでネットワーク
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        // キャッシュにない場合はネットワークから取得
        return fetch(request).then((fetchResponse) => {
          // 成功したレスポンスのみキャッシュに保存
          if (fetchResponse && fetchResponse.status === 200) {
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return fetchResponse;
        });
      })
      .catch(() => {
        // オフラインでキャッシュにもない場合は、フォールバックページを返す
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/');
        }
      })
  );
});

// Message event: クライアントからのメッセージを受信
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // クライアントから明示的に更新を要求された場合
    self.skipWaiting();
  }
});


