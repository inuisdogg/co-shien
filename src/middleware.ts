import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

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

  // サブドメインに応じたルーティング
  // biz.co-shien.inu.co.jp → ルートページ（Biz用ログイン）
  // my.co-shien.inu.co.jp → /login（Personal用ログイン）
  if (pathname === '/') {
    if (hostname.includes('biz.co-shien') || hostname === 'biz.co-shien.inu.co.jp') {
      // Biz側: ルートページのまま（page.tsxでBizログインを表示）
      return NextResponse.next();
    } else if (hostname.includes('my.co-shien') || hostname === 'my.co-shien.inu.co.jp') {
      // Personal側: /loginにリダイレクト
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // 全てのページにアクセスを許可（認証チェックはクライアントサイドで行う）
  // これにより、Netlifyで全てのルートが正しく解決される
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

