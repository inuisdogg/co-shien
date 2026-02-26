/**
 * OTP送信API
 * ログインID忘れ時に認証コードをメールで送信
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// TODO: RESEND_API_KEY is NOT set in .env.local — emails will NOT send until configured.
// Resendインスタンスを遅延初期化
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

// 6桁のOTPを生成
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email, lastName, firstName, birthDate, searchType } = await req.json();

    // Supabaseクライアントを作成
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let userData: any = null;

    // ユーザーを検索
    if (searchType === 'email') {
      // メールアドレスで検索
      if (!email) {
        return NextResponse.json(
          { error: 'メールアドレスを入力してください' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, login_id, last_name, first_name, name')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) {
        console.error('User search error:', error);
        return NextResponse.json(
          { error: 'ユーザー検索に失敗しました' },
          { status: 500 }
        );
      }

      userData = data;
    } else if (searchType === 'name_birthday') {
      // 姓名＋生年月日で検索
      if (!lastName || !firstName || !birthDate) {
        return NextResponse.json(
          { error: '姓、名、生年月日をすべて入力してください' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, login_id, last_name, first_name, name')
        .eq('last_name', lastName.trim())
        .eq('first_name', firstName.trim())
        .eq('birth_date', birthDate)
        .maybeSingle();

      if (error) {
        console.error('User search error:', error);
        return NextResponse.json(
          { error: 'ユーザー検索に失敗しました' },
          { status: 500 }
        );
      }

      userData = data;
    } else {
      return NextResponse.json(
        { error: '検索方法を選択してください' },
        { status: 400 }
      );
    }

    if (!userData) {
      return NextResponse.json(
        { error: '入力された情報に一致するアカウントが見つかりませんでした' },
        { status: 404 }
      );
    }

    if (!userData.email) {
      return NextResponse.json(
        { error: 'このアカウントにはメールアドレスが登録されていません' },
        { status: 400 }
      );
    }

    // OTPを生成
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分後に有効期限切れ

    // 既存のOTPを削除（同じユーザーの古いOTP）
    await supabase
      .from('otp_codes')
      .delete()
      .eq('user_id', userData.id);

    // OTPをデータベースに保存
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        user_id: userData.id,
        code: otp,
        expires_at: expiresAt.toISOString(),
        purpose: 'login_id_recovery',
      });

    if (insertError) {
      console.error('OTP insert error:', insertError);
      return NextResponse.json(
        { error: 'OTPの保存に失敗しました' },
        { status: 500 }
      );
    }

    // OTPをメールで送信
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';
    const userName = userData.name || `${userData.last_name || ''} ${userData.first_name || ''}`.trim() || 'ユーザー';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00c4cc 0%, #00b0b8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">ログインID確認用 認証コード</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${userName} 様
            </p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              ログインID確認のための認証コードをお送りします。
            </p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center; border-left: 4px solid #00c4cc;">
              <p style="font-size: 14px; color: #666; margin: 0 0 10px 0;">認証コード</p>
              <p style="font-size: 36px; color: #00c4cc; margin: 0; font-weight: bold; letter-spacing: 8px; font-family: monospace;">
                ${otp}
              </p>
              <p style="font-size: 12px; color: #999; margin: 15px 0 0 0;">
                ※ このコードは10分間有効です
              </p>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              このメールに心当たりがない場合は、無視してください。
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
            <p>株式会社INU</p>
            <p>Roots 運営チーム</p>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await getResend().emails.send({
      from: fromEmail,
      to: userData.email,
      subject: 'Roots ログインID確認用 認証コード',
      html: htmlContent,
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      // OTPを削除
      await supabase
        .from('otp_codes')
        .delete()
        .eq('user_id', userData.id);

      return NextResponse.json(
        { error: 'メール送信に失敗しました' },
        { status: 500 }
      );
    }

    // メールアドレスの一部を隠して返す（プライバシー保護）
    const maskedEmail = userData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    return NextResponse.json({
      success: true,
      message: '認証コードを送信しました',
      maskedEmail: maskedEmail,
      userId: userData.id,
    });
  } catch (error: any) {
    console.error('OTP send error:', error);
    return NextResponse.json(
      { error: error.message || 'OTP送信に失敗しました' },
      { status: 500 }
    );
  }
}
