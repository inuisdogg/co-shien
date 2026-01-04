import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Netlify等のプロキシ環境では x-forwarded-host を優先的に見るのが定石
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

  // 1. システムファイル・静的資産は「絶対に」リライトせず即座にスルー
  // 【理由】Next.jsの静的ファイル（/_next/static, /_next/imageなど）は
  // 常にルートに存在し、サブドメインに関わらず同じパスでアクセスできる必要がある
  // このチェックは最優先で実行し、確実にシステムファイルを除外する
  
  // Next.jsのシステムファイル（全ての/_nextで始まるパス）
  if (pathname.startsWith('/_next')) {
    return NextResponse.next();
  }
  
  // APIルート
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // 静的ファイル（拡張子付き）
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot|otf|json|xml|txt|pdf|zip|map|webmanifest)$/i.test(pathname)) {
    return NextResponse.next();
  }
  
  // PWA関連ファイル
  if (pathname === '/favicon.ico' || pathname === '/sw.js' || pathname === '/manifest.json') {
    return NextResponse.next();
  }
  
  // robots.txt, sitemap.xml など
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return NextResponse.next();
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

// Matcherの設定：システムファイルは絶対にマッチさせない
// 【理由】matcherで除外することで、Middleware関数に渡される前に除外される
// これにより、パフォーマンスの向上と確実な除外が可能
// 注意: このmatcherは除外パターンを含むが、Middleware内でも二重チェックを行う
export const config = {
  matcher: [
    /*
     * 以下のパスは除外（Middleware関数に渡されない）
     * - /api/... : APIルート
     * - /_next/... : Next.jsのシステムファイル（全て）
     * - /favicon.ico, /sw.js, /manifest.json : PWA関連
     * - 拡張子付きファイル: 静的アセット（.png, .js, .css など）
     * 
     * 正規表現の説明:
     * - (?!...) : ネガティブ先読み（除外パターン）
     * - api|_next : /api または /_next で始まるパスを除外
     * - favicon\\.ico|sw\\.js|manifest\\.json : 特定のファイルを除外
     * - .*\\.[a-zA-Z0-9]+$ : 末尾に拡張子があるファイルを除外
     */
    '/((?!api|_next|favicon\\.ico|sw\\.js|manifest\\.json|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
