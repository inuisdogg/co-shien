// Service Worker for PWA
// バージョン管理: デプロイごとにこのファイルの内容が変更されることで、ブラウザが新しいバージョンとして認識
// このファイルを編集するたびに、ブラウザは新しいService Workerとして認識する
// バージョン番号を手動で更新するか、ビルド時に自動生成する
const CACHE_VERSION = 'v6';
const CACHE_NAME = `roots-${CACHE_VERSION}`;
// 重要: HTMLページ(/)はキャッシュしない - 常に最新を取得するため
const urlsToCache = [
  '/manifest.json',
  '/favicon.png',
  '/logo-cropped-center.png'
];

// Install event: 新しいService Workerがインストールされた時
self.addEventListener('install', (event) => {
  // skipWaitingは削除 - ユーザーが明示的に更新を選択した時のみ有効化
  // これにより、自動的なリロードを防ぐ
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      // skipWaitingは削除 - ユーザーが明示的に更新を選択した時のみ有効化
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
      // clients.claim()は削除 - 自動的な制御取得を防ぐ
      // ユーザーが明示的に更新を選択した時のみ制御を取得
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

// Push event: サーバーからプッシュ通知を受信した時
// データ形式: { title, body, data: { url, ... }, tag }
self.addEventListener('push', function(event) {
  var data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // JSONパースに失敗した場合はテキストをbodyとして使用
      data = { body: event.data.text() };
    }
  }

  var title = data.title || 'Roots';
  var options = {
    body: data.body || '新しい通知があります',
    icon: '/logo-cropped-center.png',
    badge: '/logo-cropped-center.png',
    data: data.data || {},
    tag: data.tag || 'default',
    renotify: true,
    actions: [
      { action: 'open', title: '開く' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: 通知をクリックした時
// data.url がある場合はそのURLを開く。既にウィンドウが開いていればフォーカスする
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data = event.notification.data || {};
  var url = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 既にそのURLを含むウィンドウが開いていればフォーカス
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // 既存ウィンドウがあればそこにナビゲート
      for (var j = 0; j < clientList.length; j++) {
        var existingClient = clientList[j];
        if ('navigate' in existingClient && 'focus' in existingClient) {
          existingClient.navigate(url);
          return existingClient.focus();
        }
      }
      // なければ新しいウィンドウを開く
      return clients.openWindow(url);
    })
  );
});

// Message event: クライアントからのメッセージを受信
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // クライアントから明示的に更新を要求された場合のみ有効化
    self.skipWaiting().then(() => {
      // 制御を取得した後、クライアントに通知
      return self.clients.claim();
    });
  }
});


