import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const url = req.nextUrl;
  const pathname = url.pathname;
  
  // デバッグ用：どのホスト名でアクセスされたかをログに出す
  // Netlifyのログ（Functionsタブ）で確認できます
  console.log("=== Middleware Debug ===");
  console.log("Current Hostname:", hostname);
  console.log("Pathname:", pathname);
  console.log("Full URL:", url.toString());
  console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));

  // もしURLに ?debug=true をつけたら、今認識しているホスト名を画面に出して止める
  if (url.searchParams.get('debug') === 'true') {
    return NextResponse.json({ 
      detected_hostname: hostname,
      pathname: pathname,
      full_url: url.toString(),
      headers: Object.fromEntries(req.headers.entries())
    });
  }

  // 静的ファイルとNext.js内部ファイルはスキップ
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // ファイル拡張子が含まれる場合
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // サブドメイン判定（複数のパターンを試す）
  let targetPath = null;
  
  // パターン1: biz.co-shien.inu.co.jp または biz.co-shien.netlify.app
  if (hostname.includes('biz.co-shien') || hostname.startsWith('biz.')) {
    targetPath = '/biz';
    console.log("✓ Detected BIZ subdomain");
  }
  // パターン2: my.co-shien.inu.co.jp または my.co-shien.netlify.app
  else if (hostname.includes('my.co-shien') || hostname.startsWith('my.')) {
    targetPath = '/personal';
    console.log("✓ Detected PERSONAL subdomain");
  }
  // パターン3: Netlifyのサブドメイン（biz-xxx.netlify.app など）
  else if (hostname.includes('.netlify.app')) {
    const subdomain = hostname.split('.')[0];
    if (subdomain.includes('biz')) {
      targetPath = '/biz';
      console.log("✓ Detected BIZ (Netlify subdomain)");
    } else if (subdomain.includes('my') || subdomain.includes('personal')) {
      targetPath = '/personal';
      console.log("✓ Detected PERSONAL (Netlify subdomain)");
    }
  }
  // パターン4: ローカル開発（biz.localhost:3000 など）
  else if (hostname.includes('localhost')) {
    const parts = hostname.split('.');
    if (parts[0] === 'biz') {
      targetPath = '/biz';
      console.log("✓ Detected BIZ (localhost)");
    } else if (parts[0] === 'my') {
      targetPath = '/personal';
      console.log("✓ Detected PERSONAL (localhost)");
    }
  }

  // rewriteを実行
  if (targetPath) {
    // パス名がルート（/）の場合はそのまま、それ以外は結合
    const rewritePath = pathname === '/' ? targetPath : `${targetPath}${pathname}`;
    const rewriteUrl = new URL(rewritePath, req.url);
    
    console.log(`→ Rewriting: ${pathname} → ${rewritePath}`);
    console.log(`→ Rewrite URL: ${rewriteUrl.toString()}`);
    
    return NextResponse.rewrite(rewriteUrl);
  }

  // それ以外は通常通り
  console.log("→ No rewrite, passing through");
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static files (files with extensions)
     */
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\..*|static).*)',
  ],
};

