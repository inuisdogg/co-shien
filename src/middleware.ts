import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Netlify等のプロキシ環境では x-forwarded-host を優先的に見るのが定石
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

  // 0. HTMLファイル（ページ）に対してキャッシュ無効化ヘッダーを設定
  // 【理由】ブラウザがindex.htmlをキャッシュしてしまうと、新しいバージョンのJSファイル名に気づけない
  // HTMLファイルのみ常に最新を確認させ、JS/CSSなどの静的ファイルは適切にキャッシュさせる
  const isHtmlRequest = 
    pathname === '/' || 
    (!pathname.includes('.') && req.headers.get('accept')?.includes('text/html'));

  // 1. システムファイル・静的資産は「絶対に」リライトせず即座にスルー
  // 【理由】Next.jsの静的ファイル（/_next/static, /_next/imageなど）は
  // 常にルートに存在し、サブドメインに関わらず同じパスでアクセスできる必要がある
  // このチェックは最優先で実行し、確実にシステムファイルを除外する
  
  // Next.jsのシステムファイル（全ての/_nextで始まるパス）
  // .js, .js.map, .css, .jsonなどのハッシュ付きファイルも含めて完全に除外
  // このチェックは最優先で実行し、確実にシステムファイルを除外する
  if (pathname.startsWith('/_next/')) {
    const response = NextResponse.next();
    response.headers.set('x-middleware-skip', 'true');
    response.headers.set('x-debug-pathname', pathname);
    return response;
  }
  
  // .js, .js.map, .css, .jsonなどの静的ファイル（ハッシュ付きファイル含む）
  // page-xxx.js, chunks-xxx.js などのパターンにも対応
  if (/\.(js|js\.map|css|json|woff|woff2|ttf|eot|otf|png|jpg|jpeg|gif|svg|webp|ico|xml|txt|pdf|zip|webmanifest)$/i.test(pathname)) {
    const response = NextResponse.next();
    response.headers.set('x-middleware-skip', 'true');
    return response;
  }
  
  // APIルート
  if (pathname.startsWith('/api/') || pathname === '/api') {
    const response = NextResponse.next();
    response.headers.set('x-middleware-skip', 'true');
    return response;
  }
  
  // 静的ファイル（拡張子付き）- より包括的なチェック
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot|otf|json|xml|txt|pdf|zip|map|webmanifest)$/i.test(pathname)) {
    const response = NextResponse.next();
    response.headers.set('x-middleware-skip', 'true');
    return response;
  }
  
  // PWA関連ファイル
  if (pathname === '/favicon.ico' || pathname === '/sw.js' || pathname === '/manifest.json') {
    const response = NextResponse.next();
    response.headers.set('x-middleware-skip', 'true');
    return response;
  }
  
  // robots.txt, sitemap.xml など
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    const response = NextResponse.next();
    response.headers.set('x-middleware-skip', 'true');
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
  // bizドメインはco-shienと同じルートページを使用（正式な動線として統一）
  // そのため、bizドメインからのアクセスはリライトせず、そのままルートページに進む
  if (subdomain === 'my') {
    const rewritePath = pathname === '/' ? '/personal' : `/personal${pathname}`;
    const rewriteUrl = new URL(rewritePath, req.url);
    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set('x-debug-subdomain', 'my');
    response.headers.set('x-debug-rewrite-path', rewritePath);
    
    // HTMLファイルに対してキャッシュ無効化ヘッダーを設定
    if (isHtmlRequest) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
    
    return response;
  }

  // bizドメインとco-shienドメイン（サブドメインなし）は同じルートページを使用
  // リライトせず、そのまま処理を続行
  const response = NextResponse.next();
  response.headers.set('x-debug-subdomain', subdomain || 'none');
  
  // HTMLファイルに対してキャッシュ無効化ヘッダーを設定
  // これにより、ブラウザが常に最新のHTML（＝最新のJSファイル名）を取得する
  if (isHtmlRequest) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  
  return response;
}

// Matcherの設定：全てのパスを処理するが、Middleware内で除外する
// 【理由】matcherの正規表現が複雑で、一部のケースで正しく機能しない可能性があるため、
// 全てのパスをMiddlewareに渡し、Middleware内で確実に除外する方が安全
// パフォーマンスへの影響は最小限（システムファイルのチェックは高速）
export const config = {
  matcher: [
    /*
     * 全てのパスをマッチさせる（除外はMiddleware内で行う）
     * これにより、/_next/static/chunks/... などのパスも確実に処理される
     */
    '/(.*)',
  ],
};
