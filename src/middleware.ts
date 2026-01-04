import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // 静的ファイルとNext.js内部ファイルはスキップ
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.') || // ファイル拡張子が含まれる場合
    url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // サブドメインを抽出
  // 例: biz.co-shien.inu.co.jp -> biz
  // 例: my.co-shien.inu.co.jp -> my
  // 例: biz.co-shien.netlify.app -> biz
  // 例: my.co-shien.netlify.app -> my
  let currentHost = '';
  
  // カスタムドメインの場合
  if (hostname.includes('biz.co-shien.inu.co.jp')) {
    currentHost = 'biz';
  } else if (hostname.includes('my.co-shien.inu.co.jp')) {
    currentHost = 'my';
  } 
  // Netlifyのサブドメインの場合
  else if (hostname.includes('.netlify.app')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain === 'biz-co-shien' || subdomain === 'biz') {
        currentHost = 'biz';
      } else if (subdomain === 'my-co-shien' || subdomain === 'my') {
        currentHost = 'my';
      }
    }
  }
  // ローカル開発用
  else if (hostname.includes('localhost')) {
    const parts = hostname.split('.');
    if (parts[0] === 'biz') {
      currentHost = 'biz';
    } else if (parts[0] === 'my') {
      currentHost = 'my';
    }
  }

  // 1. biz.co-shien.inu.co.jp の場合
  if (currentHost === 'biz') {
    // 内部的に /biz フォルダの内容を表示する（URLはそのまま）
    return NextResponse.rewrite(new URL(`/biz${url.pathname}`, request.url));
  }

  // 2. my.co-shien.inu.co.jp の場合
  if (currentHost === 'my') {
    // 内部的に /personal フォルダの内容を表示する（URLはそのまま）
    return NextResponse.rewrite(new URL(`/personal${url.pathname}`, request.url));
  }

  // それ以外（co-shien.inu.co.jp 本体など）は通常通り
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static files (files with extensions)
     */
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\..*|static).*)',
  ],
};

