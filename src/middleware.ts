import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;

  // 【最重要：ガードレール】
  // 以下のシステムパスは、サブドメインに関わらず「絶対に」書き換えてはいけない
  if (
    pathname.startsWith('/_next') || // Next.jsのシステムファイル（_next/static, _next/image, _next/webpack-hmrなど全て）
    pathname.startsWith('/api') ||   // APIルート
    pathname.includes('.')           // 画像、favicon、robots.txtなどの静的ファイル（拡張子が含まれる場合）
  ) {
    return NextResponse.next();
  }

  // サブドメインの抽出
  const currentHost = hostname
    .replace(`.co-shien.inu.co.jp`, '')
    .replace(`.localhost:3000`, '');

  // biz. への書き換え
  if (currentHost === 'biz') {
    return NextResponse.rewrite(new URL(`/biz${pathname}`, req.url));
  }

  // my. への書き換え
  if (currentHost === 'my') {
    return NextResponse.rewrite(new URL(`/personal${pathname}`, req.url));
  }

  return NextResponse.next();
}

// matcherも念のため最強の設定にしておく
export const config = {
  matcher: [
    /*
     * 以下のパスは除外（Middlewareを適用しない）
     * - api: APIルート
     * - _next/static: 静的ファイル（JS、CSSなど）
     * - _next/image: 画像最適化
     * - _next/webpack-hmr: ホットリロード
     * - favicon.ico: ファビコン
     * - 拡張子付きファイル: 画像、フォントなど
     */
    '/((?!api|_next|favicon.ico|.*\\.[^/]+$).*)',
  ],
};
