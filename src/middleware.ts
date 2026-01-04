import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;

  // 【最重要：早期リターン（ガードレール）】
  // 以下のシステムパスは、サブドメインに関わらず「絶対に」書き換えてはいけない
  // 処理の最初に実行し、該当する場合は即座にNextResponse.next()を返す
  
  // Next.jsのシステムファイル（/_nextで始まるすべてのパス）
  // /_next/static, /_next/image, /_next/webpack-hmr など全て
  // これらは常にルートの/_next/...に存在するため、リライトしてはいけない
  if (pathname.startsWith('/_next')) {
    return NextResponse.next();
  }
  
  // APIルート
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // ファビコン
  if (pathname === '/favicon.ico' || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }
  
  // 静的ファイル（拡張子が含まれる場合）
  // 画像、フォント、CSS、JSなどの静的アセット
  const staticFileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', 
                                '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.otf',
                                '.json', '.xml', '.txt', '.pdf', '.zip', '.map'];
  const hasExtension = staticFileExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
  if (hasExtension) {
    return NextResponse.next();
  }
  
  // 静的ディレクトリ
  if (pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // サブドメインの抽出
  let currentHost = hostname.split('.')[0]; // 最初の部分を取得（biz, my, またはその他）
  
  // .co-shien.inu.co.jp の場合、サブドメインを抽出
  if (hostname.includes('.co-shien.inu.co.jp')) {
    currentHost = hostname.replace('.co-shien.inu.co.jp', '').split(':')[0];
  }
  // .localhost の場合
  else if (hostname.includes('.localhost')) {
    currentHost = hostname.replace('.localhost:3000', '').replace('.localhost', '').split(':')[0];
  }
  // Netlifyの場合
  else if (hostname.includes('.netlify.app')) {
    const subdomain = hostname.split('.')[0];
    currentHost = subdomain.includes('biz') ? 'biz' : (subdomain.includes('my') || subdomain.includes('personal') ? 'my' : '');
  }
  // その他の場合
  else {
    currentHost = hostname.split(':')[0].split('.')[0];
  }

  // サブドメインに基づいてリライト
  if (currentHost === 'biz') {
    // bizサブドメインの場合、/bizにリライト
    const rewritePath = pathname === '/' ? '/biz' : `/biz${pathname}`;
    const rewriteUrl = new URL(rewritePath, req.url);
    return NextResponse.rewrite(rewriteUrl);
  } else if (currentHost === 'my') {
    // myサブドメインの場合、/personalにリライト
    const rewritePath = pathname === '/' ? '/personal' : `/personal${pathname}`;
    const rewriteUrl = new URL(rewritePath, req.url);
    return NextResponse.rewrite(rewriteUrl);
  }

  // サブドメインがない場合（co-shien.inu.co.jpなど）はそのまま通過
  return NextResponse.next();
}

// Matcherの設定：/_nextで始まるパスは絶対にマッチさせない
export const config = {
  matcher: [
    /*
     * 以下のパスは除外（Middleware関数に渡されない）
     * - /api/... : APIルート
     * - /_next/... : Next.jsのシステムファイル（全て）
     * - 拡張子付きファイル: 静的アセット
     */
    '/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
