/**
 * Supabase Auth コールバックハンドラー
 * メール認証完了時に/setupページにリダイレクト
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type') || 'biz'; // biz or personal

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 認証コードを交換
    await supabase.auth.exchangeCodeForSession(code);

    // メール認証完了後、/setupページにリダイレクト
    if (type === 'personal') {
      return NextResponse.redirect(new URL('/personal/setup?type=confirm', requestUrl.origin));
    } else {
      return NextResponse.redirect(new URL('/setup?type=confirm', requestUrl.origin));
    }
  }

  // エラー時はサインアップページにリダイレクト
  return NextResponse.redirect(new URL('/signup', requestUrl.origin));
}

