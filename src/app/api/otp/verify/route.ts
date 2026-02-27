/**
 * OTP検証API
 * 認証コードを検証し、ログインIDを返す
 * ユーザーはメールアドレスまたは姓名+生年月日で特定する（userIdは受け取らない）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    const { code, email, lastName, firstName, birthDate, searchType } = await req.json();

    if (!code) {
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

    // 検索条件でユーザーを特定
    let userData: any = null;

    if (searchType === 'email' && email) {
      const { data } = await supabase
        .from('users')
        .select('id, login_id, email')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();
      userData = data;
    } else if (searchType === 'name_birthday' && lastName && firstName && birthDate) {
      const { data } = await supabase
        .from('users')
        .select('id, login_id, email')
        .eq('last_name', lastName.trim())
        .eq('first_name', firstName.trim())
        .eq('birth_date', birthDate)
        .maybeSingle();
      userData = data;
    } else {
      return NextResponse.json(
        { error: '検索条件が不足しています' },
        { status: 400 }
      );
    }

    if (!userData) {
      return NextResponse.json(
        { error: '認証コードが正しくありません' },
        { status: 400 }
      );
    }

    // OTPコードごとのレート制限: 10分間に最大5回の検証試行
    const codeKey = `otp:verify:${userData.id}`;
    const verifyLimit = rateLimit(codeKey, 5, 10 * 60 * 1000);

    // 5回目の失敗でOTPを無効化
    if (!verifyLimit.allowed) {
      // OTPを削除して無効化
      await supabase
        .from('otp_codes')
        .delete()
        .eq('user_id', userData.id)
        .eq('purpose', 'login_id_recovery');

      return rateLimitResponse(verifyLimit.retryAfter!);
    }

    // OTPを検証
    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userData.id)
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

    return NextResponse.json({
      success: true,
      loginId: userData.login_id || userData.email,
    });
  } catch (error: any) {
    console.error('OTP verify error:', error);
    return NextResponse.json(
      { error: 'OTP検証に失敗しました' },
      { status: 500 }
    );
  }
}
