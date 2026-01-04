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
  let currentHost = hostname;
  
  // .co-shien.inu.co.jp を削除
  if (hostname.includes('.co-shien.inu.co.jp')) {
    currentHost = hostname.replace('.co-shien.inu.co.jp', '').split(':')[0];
  }
  // .localhost:3000 を削除
  else if (hostname.includes('.localhost')) {
    currentHost = hostname.replace('.localhost:3000', '').replace('.localhost', '');
  }
  // Netlifyの場合
  else if (hostname.includes('.netlify.app')) {
    const subdomain = hostname.split('.')[0];
    currentHost = subdomain.includes('biz') ? 'biz' : (subdomain.includes('my') || subdomain.includes('personal') ? 'my' : '');
  }
  // その他の場合（ポート番号を削除）
  else {
    currentHost = hostname.split(':')[0];
  }

  // リライト先のパスを決定
  let rewritePath: string | null = null;
  
  if (currentHost === 'biz') {
    rewritePath = pathname === '/' ? '/biz' : `/biz${pathname}`;
  } else if (currentHost === 'my') {
    rewritePath = pathname === '/' ? '/personal' : `/personal${pathname}`;
  }

  // リライトが必要な場合
  if (rewritePath) {
    // 【安全性チェック】リライト後のパスが/_nextを含まないことを確認
    if (rewritePath.includes('/_next')) {
      return NextResponse.next();
    }
    
    // 【安全性チェック】リライト後のパスが/apiを含まないことを確認
    if (rewritePath.includes('/api')) {
      return NextResponse.next();
    }
    
    const rewriteUrl = new URL(rewritePath, req.url);
    return NextResponse.rewrite(rewriteUrl);
  }

  // リライトが不要な場合はそのまま通過
  return NextResponse.next();
}

// Matcherの設定：できるだけ広範囲にマッチさせ、middleware関数内で除外する
// これにより、middleware関数内のガードレールが確実に機能する
export const config = {
  matcher: [
    /*
     * 基本的にすべてのパスにマッチするが、
     * middleware関数内のガードレールで/_next、/api、静的ファイルを除外する
     */
    '/(.*)',
  ],
};
