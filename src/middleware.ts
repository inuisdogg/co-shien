import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;

  // 【最重要：早期リターン（ガードレール）】
  // Next.jsの静的ファイルとAPIルートは絶対に書き換えてはいけない
  // これらは常にルートに存在するため、サブドメインに関わらずそのまま通す
  
  if (
    pathname.startsWith('/_next') ||  // Next.jsの静的ファイル（全て）
    pathname.startsWith('/api') ||    // APIルート
    pathname.startsWith('/static') || // 静的ディレクトリ
    pathname === '/favicon.ico' ||    // ファビコン
    /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot|otf|json|xml|txt|pdf|zip|map)$/i.test(pathname) // 拡張子付きファイル
  ) {
    return NextResponse.next();
  }

  // サブドメインの抽出
  let subdomain = '';
  
  if (hostname.includes('.co-shien.inu.co.jp')) {
    subdomain = hostname.replace('.co-shien.inu.co.jp', '').split(':')[0];
  } else if (hostname.includes('.localhost')) {
    subdomain = hostname.replace('.localhost:3000', '').replace('.localhost', '').split(':')[0];
  } else if (hostname.includes('.netlify.app')) {
    const firstPart = hostname.split('.')[0];
    subdomain = firstPart.includes('biz') ? 'biz' : (firstPart.includes('my') || firstPart.includes('personal') ? 'my' : '');
  } else {
    subdomain = hostname.split(':')[0].split('.')[0];
  }

  // サブドメインに基づいてリライト
  if (subdomain === 'biz') {
    const rewritePath = pathname === '/' ? '/biz' : `/biz${pathname}`;
    return NextResponse.rewrite(new URL(rewritePath, req.url));
  }
  
  if (subdomain === 'my') {
    const rewritePath = pathname === '/' ? '/personal' : `/personal${pathname}`;
    return NextResponse.rewrite(new URL(rewritePath, req.url));
  }

  return NextResponse.next();
}

// Matcher: 静的ファイルとAPIルートを除外
export const config = {
  matcher: [
    /*
     * 以下のパスは除外（Middleware関数に渡されない）
     * - /_next/... : Next.jsの静的ファイル（全て）
     * - /api/... : APIルート
     * - /favicon.ico : ファビコン
     * - 拡張子付きファイル: 静的アセット
     */
    '/((?!_next|api|favicon\\.ico|.*\\.[^/]+$).*)',
  ],
};
