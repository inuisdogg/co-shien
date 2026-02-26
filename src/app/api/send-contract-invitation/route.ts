/**
 * 契約招待メール送信API
 * 統一された招待URL（/parent/invitations/[token]）のみ送信
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// TODO: RESEND_API_KEY is NOT set in .env.local — emails will NOT send until configured.
// Set RESEND_API_KEY in .env.local with a valid Resend API key to enable email delivery.
// Without it, invitation emails fail silently (the invitation record is still created in DB).

// ビルド時にエラーにならないよう、遅延初期化
const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  return new Resend(apiKey);
};

export async function POST(request: NextRequest) {
  try {
    const { email, facilityName, childName, invitationUrl } = await request.json();

    if (!email || !facilityName || !childName || !invitationUrl) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    // メール送信
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: 'Roots <noreply@Roots.inu.co.jp>',
      to: email,
      subject: `${facilityName}からの利用招待`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #F6AD55 0%, #ED8936 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #F6AD55; color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; font-size: 16px; }
            .button:hover { background: #ED8936; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Roots</h1>
            </div>
            <div class="content">
              <h2>施設からの利用招待</h2>
              <p>${facilityName}から、${childName}さんの施設利用に関する招待が届きました。</p>
              <p>以下のボタンから招待を確認・承認してください。<br>アカウントをお持ちでない方は、リンク先から新規登録ができます。</p>
              <div style="text-align: center;">
                <a href="${invitationUrl}" class="button">招待を確認する</a>
              </div>
              <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                このリンクは7日間有効です。<br>
                心当たりがない場合は、このメールを無視してください。
              </p>
            </div>
            <div class="footer">
              <p>Roots - 児童発達支援管理システム</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'メール送信に失敗しました', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Send invitation error:', error);
    return NextResponse.json(
      { error: 'メール送信に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}
