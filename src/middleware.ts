import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

