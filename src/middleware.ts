import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ドメイン構成:
 * - biz.co-shien.inu.co.jp → スタッフ用（ログイン、ダッシュボード、施設管理）
 * - my.co-shien.inu.co.jp → 利用者（クライアント）専用
 * - localhost → 開発環境（すべてのパスにアクセス可能）
 */

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

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

  // 招待リンク（どちらのドメインからでもアクセス可能）
  if (pathname === '/activate' || pathname.startsWith('/activate/')) {
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

  // 無限ループ防止
  if (pathname.startsWith('/biz') || pathname.startsWith('/personal')) {
    return NextResponse.next();
  }

  // ドメイン解析
  const hostWithoutPort = host.split(':')[0].toLowerCase();

  // ========================================
  // ローカル開発環境 → すべてのパスにアクセス可能
  // ========================================
  if (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') {
    const response = NextResponse.next();
    if (isHtmlRequest) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    return response;
  }

  const hostParts = hostWithoutPort.split('.');
  const firstPart = hostParts[0]?.toLowerCase() || '';

  // co-shien.inu.co.jp → biz.co-shien.inu.co.jp にリダイレクト
  if (hostWithoutPort === 'co-shien.inu.co.jp' || hostWithoutPort === 'www.co-shien.inu.co.jp') {
    const protocol = req.nextUrl.protocol || 'https:';
    const redirectUrl = new URL(`${protocol}//biz.co-shien.inu.co.jp${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl, 301);
  }

  // ========================================
  // my.co-shien.inu.co.jp → 利用者専用
  // ========================================
  if (firstPart === 'my' || hostWithoutPort.startsWith('my.')) {
    // /client パスはそのまま通す
    if (pathname.startsWith('/client')) {
      const response = NextResponse.next();
      if (isHtmlRequest) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
      return response;
    }

    // ルート（/）へのアクセスは /client/login にリダイレクト
    if (pathname === '/') {
      const redirectUrl = new URL('/client/login', req.url);
      return NextResponse.redirect(redirectUrl, 302);
    }

    // その他のパス（/staff-dashboard など）へのアクセスは biz 側にリダイレクト
    if (pathname.startsWith('/staff-dashboard') ||
        pathname.startsWith('/portal') ||
        pathname.startsWith('/facility') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/setup')) {
      const protocol = req.nextUrl.protocol || 'https:';
      const redirectUrl = new URL(`${protocol}//biz.co-shien.inu.co.jp${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(redirectUrl, 302);
    }

    // その他は /client/login にリダイレクト
    const redirectUrl = new URL('/client/login', req.url);
    return NextResponse.redirect(redirectUrl, 302);
  }

  // ========================================
  // biz.co-shien.inu.co.jp → スタッフ用（メイン）
  // ========================================

  // /client へのアクセスは my 側にリダイレクト
  if (pathname.startsWith('/client')) {
    const protocol = req.nextUrl.protocol || 'https:';
    const redirectUrl = new URL(`${protocol}//my.co-shien.inu.co.jp${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl, 302);
  }

  // /personal へのアクセスは /staff-dashboard にリダイレクト（後方互換性）
  if (pathname === '/personal' || pathname.startsWith('/personal/')) {
    const newPath = pathname.replace('/personal', '/staff-dashboard');
    const redirectUrl = new URL(newPath || '/staff-dashboard', req.url);
    return NextResponse.redirect(redirectUrl, 302);
  }

  // biz側はそのまま処理を続行
  const response = NextResponse.next();
  response.headers.set('x-debug-subdomain', firstPart || 'none');

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
