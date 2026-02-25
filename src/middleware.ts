import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * シングルドメイン構成: Roots.inu.co.jp
 *
 * 現在有効な機能:
 * - /business → ビジネス（施設管理）
 * - /career → キャリア（スタッフ向け）
 * - /parent → 保護者
 *
 * セキュリティ:
 * - 保護ルートへのセキュリティヘッダー付与
 * - Supabase Auth セッション対応準備
 */

// 保護が必要なパスプレフィックス
const PROTECTED_PATHS = ['/business', '/career', '/parent'];

// 認証不要な公開パス
const PUBLIC_PATHS = [
  '/business/login',
  '/career/login',
  '/parent/login',
  '/parent/signup',
  '/signup',
  '/login',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // HTMLファイルに対してキャッシュ無効化
  const isHtmlRequest =
    pathname === '/' ||
    (!pathname.includes('.') && req.headers.get('accept')?.includes('text/html'));

  // 1. システムファイル・静的資産は即座にスルー
  if (pathname.startsWith('/_next/')) {
    const response = NextResponse.next();
    response.headers.set('x-middleware-skip', 'true');
    return response;
  }

  // 静的ファイル
  if (/\.(js|js\.map|css|json|woff|woff2|ttf|eot|otf|png|jpg|jpeg|gif|svg|webp|ico|xml|txt|pdf|zip|webmanifest)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // APIルート
  if (pathname.startsWith('/api/') || pathname === '/api') {
    return NextResponse.next();
  }

  // Auth コールバック
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next();
  }

  // 招待リンク
  if (pathname === '/activate' || pathname.startsWith('/activate/')) {
    return NextResponse.next();
  }

  // 署名ページ
  if (pathname.startsWith('/sign/')) {
    return NextResponse.next();
  }

  // PWA関連ファイル
  if (pathname === '/favicon.ico' || pathname === '/sw.js' || pathname === '/manifest.json') {
    const response = NextResponse.next();
    if (pathname === '/sw.js' || pathname === '/manifest.json') {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    return response;
  }

  // robots.txt, sitemap.xml
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return NextResponse.next();
  }

  // ========================================
  // 一時的に無効化された機能へのリダイレクト
  // ========================================
  if (pathname.startsWith('/consultation') || pathname.startsWith('/babysitter')) {
    return NextResponse.redirect(new URL('/business', req.url), 302);
  }

  // ========================================
  // 保護ルートへのセキュリティヘッダー
  // ========================================
  const isProtectedPath = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  const isPublicPath = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (isProtectedPath) {
    const response = NextResponse.next();

    // セキュリティヘッダー
    if (isHtmlRequest) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    return response;
  }

  // ========================================
  // 旧パスからのリダイレクト（後方互換性）
  // ========================================
  if (pathname.startsWith('/biz')) {
    const newPath = pathname.replace('/biz', '/business');
    return NextResponse.redirect(new URL(newPath, req.url), 301);
  }
  if (pathname.startsWith('/personal')) {
    const newPath = pathname.replace('/personal', '/career');
    return NextResponse.redirect(new URL(newPath, req.url), 301);
  }
  if (pathname.startsWith('/client')) {
    const newPath = pathname.replace('/client', '/parent');
    return NextResponse.redirect(new URL(newPath, req.url), 301);
  }
  if (pathname.startsWith('/sitter') || pathname.startsWith('/expert')) {
    return NextResponse.redirect(new URL('/business', req.url), 302);
  }
  if (pathname === '/staff-dashboard' || pathname.startsWith('/staff-dashboard/')) {
    const newPath = pathname.replace('/staff-dashboard', '/career');
    return NextResponse.redirect(new URL(newPath, req.url), 301);
  }

  // ルート（/）はそのまま通す
  const response = NextResponse.next();
  if (isHtmlRequest) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export const config = {
  matcher: ['/(.*)',],
};
