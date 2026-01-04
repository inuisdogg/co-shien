import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const url = req.nextUrl;
  
  // デバッグ用：どのホスト名でアクセスされたかをログに出す
  // Netlifyのログ（Functionsタブ）で確認できます
  console.log("Current Hostname:", hostname);
  console.log("Pathname:", url.pathname);

  // もしURLに ?debug=true をつけたら、今認識しているホスト名を画面に出して止める
  if (url.searchParams.get('debug') === 'true') {
    return NextResponse.json({ 
      detected_hostname: hostname,
      pathname: url.pathname,
      full_url: url.toString()
    });
  }

  // 静的ファイルとNext.js内部ファイルはスキップ
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.') || // ファイル拡張子が含まれる場合
    url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // シンプルな判定：hostnameが'biz.'で始まるか、'my.'で始まるか
  if (hostname.startsWith('biz.')) {
    console.log("Rewriting to /biz", url.pathname);
    return NextResponse.rewrite(new URL(`/biz${url.pathname}`, req.url));
  }
  
  if (hostname.startsWith('my.')) {
    console.log("Rewriting to /personal", url.pathname);
    return NextResponse.rewrite(new URL(`/personal${url.pathname}`, req.url));
  }

  // より詳細な判定（フォールバック）
  if (hostname.includes('biz.co-shien')) {
    console.log("Rewriting to /biz (fallback)", url.pathname);
    return NextResponse.rewrite(new URL(`/biz${url.pathname}`, req.url));
  }
  
  if (hostname.includes('my.co-shien')) {
    console.log("Rewriting to /personal (fallback)", url.pathname);
    return NextResponse.rewrite(new URL(`/personal${url.pathname}`, req.url));
  }

  // それ以外は通常通り
  console.log("No rewrite, passing through");
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

