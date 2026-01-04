import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Netlify等のプロキシ環境では x-forwarded-host を優先的に見るのが定石
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

  // 1. システムファイル・静的資産は「絶対に」リライトせず即座にスルー
  // 【理由】Next.jsの静的ファイル（/_next/static, /_next/imageなど）は
  // 常にルートに存在し、サブドメインに関わらず同じパスでアクセスできる必要がある
  if (
    pathname.startsWith('/_next') ||  // Next.jsのシステムファイル（全て）
    pathname.startsWith('/api') ||    // APIルート
    pathname === '/favicon.ico' ||    // ファビコン
    /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot|otf|json|xml|txt|pdf|zip|map)$/i.test(pathname) // 拡張子付きファイル（末尾に拡張子がある場合のみ）
  ) {
    const response = NextResponse.next();
    response.headers.set('x-debug-subdomain', 'excluded-static');
    return response;
  }

  // 2. 無限ループ防止：既にリライト済みのパス（/biz, /personal）は再度リライトしない
  // 【理由】/biz や /personal で始まるパスは既にリライトされたパスの可能性が高いため、
  // 再度リライトすると /biz/biz/... のように重複してしまう
  if (pathname.startsWith('/biz') || pathname.startsWith('/personal')) {
    const response = NextResponse.next();
    response.headers.set('x-debug-subdomain', 'already-rewritten');
    return response;
  }

  // 3. ドメインを分解してサブドメインを取得 (例: biz.co-shien.inu.co.jp -> biz)
  // 【理由】Netlifyのプロキシ環境では、x-forwarded-hostに実際のホスト名が含まれる
  // ポート番号を除去し、最初の部分（サブドメイン）を取得
  const hostWithoutPort = host.split(':')[0];
  const subdomain = hostWithoutPort.split('.')[0].toLowerCase();

  // 4. サブドメインに応じたリライト処理
  if (subdomain === 'biz') {
    const rewritePath = pathname === '/' ? '/biz' : `/biz${pathname}`;
    const rewriteUrl = new URL(rewritePath, req.url);
    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set('x-debug-subdomain', 'biz');
    response.headers.set('x-debug-rewrite-path', rewritePath);
    return response;
  }
  
  if (subdomain === 'my') {
    const rewritePath = pathname === '/' ? '/personal' : `/personal${pathname}`;
    const rewriteUrl = new URL(rewritePath, req.url);
    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set('x-debug-subdomain', 'my');
    response.headers.set('x-debug-rewrite-path', rewritePath);
    return response;
  }

  // サブドメインがない場合（co-shien.inu.co.jpなど）
  const response = NextResponse.next();
  response.headers.set('x-debug-subdomain', subdomain || 'none');
  return response;
}

// Matcherの設定：/_nextで始まるパスは絶対にマッチさせない
// 【理由】matcherで除外することで、Middleware関数に渡される前に除外される
// これにより、パフォーマンスの向上と確実な除外が可能
export const config = {
  matcher: [
    /*
     * 以下のパスは除外（Middleware関数に渡されない）
     * - /api/... : APIルート
     * - /_next/... : Next.jsのシステムファイル（全て）
     * - /favicon.ico : ファビコン
     * - 拡張子付きファイル: 静的アセット
     */
    '/((?!api|_next|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
