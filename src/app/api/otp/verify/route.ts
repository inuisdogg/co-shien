/**
 * OTP検証API
 * 認証コードを検証し、ログインIDを返す
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json();

    if (!userId || !code) {
      return NextResponse.json(
        { error: '認証コードを入力してください' },
        { status: 400 }
      );
    }

    // Supabaseクライアントを作成
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // OTPを検証
    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code.trim())
      .eq('purpose', 'login_id_recovery')
      .maybeSingle();

    if (otpError) {
      console.error('OTP verification error:', otpError);
      return NextResponse.json(
        { error: 'OTPの検証に失敗しました' },
        { status: 500 }
      );
    }

    if (!otpData) {
      return NextResponse.json(
        { error: '認証コードが正しくありません' },
        { status: 400 }
      );
    }

    // 有効期限をチェック
    const expiresAt = new Date(otpData.expires_at);
    if (expiresAt < new Date()) {
      // 期限切れのOTPを削除
      await supabase
        .from('otp_codes')
        .delete()
        .eq('id', otpData.id);

      return NextResponse.json(
        { error: '認証コードの有効期限が切れています。再度お試しください。' },
        { status: 400 }
      );
    }

    // 使用済みのOTPを削除
    await supabase
      .from('otp_codes')
      .delete()
      .eq('id', otpData.id);

    // ユーザー情報を取得してログインIDを返す
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('login_id, email')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData) {
      console.error('User fetch error:', userError);
      return NextResponse.json(
        { error: 'ユーザー情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      loginId: userData.login_id || userData.email,
    });
  } catch (error: any) {
    console.error('OTP verify error:', error);
    return NextResponse.json(
      { error: error.message || 'OTP検証に失敗しました' },
      { status: 500 }
    );
  }
}
