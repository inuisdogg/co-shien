import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Netlify等のプロキシ環境では x-forwarded-host を優先的に見るのが定石
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

  // 1. システムファイル・静的資産は「絶対に」リライトせず即座にスルー
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. ドメインを分解してサブドメインを取得 (例: biz.co-shien.inu.co.jp -> biz)
  const subdomain = host.split('.')[0].toLowerCase();

  // 3. サブドメインに応じたリライト処理
  if (subdomain === 'biz') {
    return NextResponse.rewrite(new URL(`/biz${pathname}`, req.url));
  }
  if (subdomain === 'my') {
    return NextResponse.rewrite(new URL(`/personal${pathname}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
