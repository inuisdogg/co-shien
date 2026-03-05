import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { verifyPassword, hashPassword } from '@/utils/password';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const ipLimit = rateLimit(`change-password:ip:${ip}`, 5, 15 * 60 * 1000);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfter!);

    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で設定してください' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, password_hash')
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

    const isValid = await verifyPassword(currentPassword, userData.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: '現在のパスワードが正しくありません' },
        { status: 401 }
      );
    }

    const newHash = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json(
        { error: 'パスワードの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
