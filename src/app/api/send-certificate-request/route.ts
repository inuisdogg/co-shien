/**
 * 実務経験証明書発行依頼メール送信API
 * Resendを使用して元勤務先に証明書発行依頼メールを送信
 * 開発環境（RESEND_API_KEY未設定時）はメール送信をスキップ
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Resendインスタンスを遅延初期化
let resend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null; // 開発モード
  }
  if (!resend) {
    resend = new Resend(apiKey);
  }
  return resend;
}

// Supabaseクライアント（Anon Key使用）
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, recordId } = await req.json();

    // バリデーション
    if (!to || !subject || !body || !recordId) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const resendClient = getResend();
    const isDevMode = !resendClient;

    // 署名用トークンを生成
    const signatureToken = randomUUID();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    const signatureUrl = `${baseUrl}/sign/${signatureToken}`;

    // レコードを更新（トークンとステータス）
    const { error: updateError } = await supabase
      .from('work_experience_records')
      .update({
        signature_token: signatureToken,
        status: 'pending',
        signature_requested_at: new Date().toISOString(),
        email_subject: subject,
        email_body: body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'データベースの更新に失敗しました' },
        { status: 500 }
      );
    }

    // 開発モードの場合はメール送信をスキップ
    if (isDevMode) {
      console.log('=== 開発モード: メール送信スキップ ===');
      console.log('宛先:', to);
      console.log('件名:', subject);
      console.log('署名URL:', signatureUrl);
      console.log('===============================');

      return NextResponse.json({
        success: true,
        devMode: true,
        signatureToken,
        signatureUrl,
        message: '開発モード: メール送信はスキップされました。署名URLをコンソールで確認してください。',
      });
    }

    // メール本文にリンクを埋め込む（改行をHTMLに変換）
    const bodyWithLink = body.replace(/\n/g, '<br>');
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';

    // HTMLメールを生成
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.8; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4a90a4 0%, #2c5f6e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">実務経験証明書 発行依頼</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <div style="font-size: 15px; white-space: pre-wrap;">
              ${bodyWithLink}
            </div>

            <div style="margin: 40px 0; padding: 25px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #4a90a4;">
              <p style="font-size: 14px; color: #666; margin: 0 0 15px 0; font-weight: bold;">
                下記リンクより電子署名をお願いいたします
              </p>
              <a href="${signatureUrl}" style="display: inline-block; background: #4a90a4; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
                電子署名ページへ
              </a>
              <p style="font-size: 12px; color: #999; margin: 15px 0 0 0;">
                ※ リンクの有効期限は30日間です
              </p>
            </div>

            <div style="font-size: 13px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
              <p style="margin: 0 0 10px 0;">
                このメールは実務経験証明書の発行依頼システムより自動送信されています。
              </p>
              <p style="margin: 0;">
                ご不明な点がございましたら、申請者へ直接お問い合わせください。
              </p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
            <p>co-shien - 児童発達支援管理システム</p>
          </div>
        </body>
      </html>
    `;

    // メール送信
    const { data, error } = await resendClient.emails.send({
      from: fromEmail,
      to: to,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      // メール送信失敗時はステータスを戻す
      await supabase
        .from('work_experience_records')
        .update({
          status: 'draft',
          signature_token: null,
          signature_requested_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);

      return NextResponse.json(
        { error: 'メール送信に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      signatureToken,
    });
  } catch (error: any) {
    console.error('Send certificate request error:', error);
    return NextResponse.json(
      { error: error.message || 'メール送信に失敗しました' },
      { status: 500 }
    );
  }
}
