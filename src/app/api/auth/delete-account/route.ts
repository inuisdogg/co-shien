import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { verifyPassword } from '@/utils/password';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const ipLimit = rateLimit(`delete-account:ip:${ip}`, 3, 60 * 60 * 1000);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfter!);

    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, password_hash, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    if (!userData.password_hash) {
      return NextResponse.json(
        { error: 'パスワードが設定されていません' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, userData.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'パスワードが正しくありません' },
        { status: 401 }
      );
    }

    // アカウントを論理削除（account_status = 'deleted'）
    const { error: updateError } = await supabase
      .from('users')
      .update({
        account_status: 'deleted',
        email: `deleted_${Date.now()}_${userData.email}`,
        password_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json(
        { error: 'アカウントの削除に失敗しました' },
        { status: 500 }
      );
    }

    // パスキーも削除
    await supabase
      .from('user_passkeys')
      .delete()
      .eq('user_id', userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
