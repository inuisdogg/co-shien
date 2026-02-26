/**
 * ウェルカムメール送信API
 * Resendを使用してウェルカムメールを送信
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// TODO: RESEND_API_KEY is NOT set in .env.local — emails will NOT send until configured.
// Resendインスタンスを遅延初期化（ビルド時エラー回避）
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

export async function POST(req: NextRequest) {
  try {
    const { email, name, facilityCode, type, mailType } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: 'メールアドレスと名前が必要です' },
        { status: 400 }
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://biz.Roots.inu.co.jp';

    // メールタイプに応じた内容を生成
    let subject = '';
    let htmlContent = '';

    // mailTypeが指定されている場合、そのタイプのメールを送信
    // 'personal_account' = 個人アカウント発行のお知らせ
    // 'facility_id' = 施設IDを記したお知らせ
    if (mailType === 'personal_account') {
      // 個人アカウント発行のお知らせ
      subject = 'Roots 個人アカウント発行完了のお知らせ';
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #00c4cc 0%, #00b0b8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">個人アカウント発行完了</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                ${name} 様
              </p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                この度は、Roots（児童発達支援管理システム）にご登録いただき、誠にありがとうございます。
              </p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                個人アカウントの発行が完了いたしました。
              </p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                以下の情報でログインできます：
              </p>
              <ul style="font-size: 14px; margin-bottom: 20px; padding-left: 20px;">
                <li>メールアドレス: <strong>${email}</strong></li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://my.Roots.inu.co.jp/login" style="display: inline-block; background: #00c4cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  ログインページへ
                </a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                ご不明な点がございましたら、お気軽にお問い合わせください。
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
              <p>株式会社INU</p>
              <p>Roots 運営チーム</p>
            </div>
          </body>
        </html>
      `;
    } else if (mailType === 'facility_id' && facilityCode) {
      // 施設IDを記したお知らせ
      subject = 'Roots 施設ID発行のお知らせ';
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #00c4cc 0%, #00b0b8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">施設ID発行完了</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                ${name} 様
              </p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                施設IDの発行が完了いたしました。
              </p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #00c4cc;">
                <p style="font-size: 14px; color: #666; margin: 0 0 10px 0; font-weight: bold;">あなたの施設ID</p>
                <p style="font-size: 28px; color: #00c4cc; margin: 0; font-weight: bold; letter-spacing: 2px; font-family: monospace;">
                  ${facilityCode}
                </p>
                <p style="font-size: 12px; color: #999; margin: 10px 0 0 0;">
                  ※ この施設IDは大切に保管してください。ログイン時に必要です。
                </p>
              </div>
              <p style="font-size: 16px; margin-bottom: 20px;">
                以下の情報でログインできます：
              </p>
              <ul style="font-size: 14px; margin-bottom: 20px; padding-left: 20px;">
                <li>施設ID: <strong>${facilityCode}</strong></li>
                <li>メールアドレス: <strong>${email}</strong></li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/" style="display: inline-block; background: #00c4cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  ログインページへ
                </a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                ご不明な点がございましたら、お気軽にお問い合わせください。
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
              <p>株式会社INU</p>
              <p>Roots 運営チーム</p>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'biz' && facilityCode) {
      // Biz側のウェルカムメール（施設IDを含む）- 後方互換性のため残す
      subject = 'Roots ご登録ありがとうございます';
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #00c4cc 0%, #00b0b8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Roots へようこそ！</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                ${name} 様
              </p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                この度は、Roots（児童発達支援管理システム）にご登録いただき、誠にありがとうございます。
              </p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #00c4cc;">
                <p style="font-size: 14px; color: #666; margin: 0 0 10px 0; font-weight: bold;">あなたの施設ID</p>
                <p style="font-size: 28px; color: #00c4cc; margin: 0; font-weight: bold; letter-spacing: 2px; font-family: monospace;">
                  ${facilityCode}
                </p>
                <p style="font-size: 12px; color: #999; margin: 10px 0 0 0;">
                  ※ この施設IDは大切に保管してください。ログイン時に必要です。
                </p>
              </div>
              <p style="font-size: 16px; margin-bottom: 20px;">
                以下の情報でログインできます：
              </p>
              <ul style="font-size: 14px; margin-bottom: 20px; padding-left: 20px;">
                <li>施設ID: <strong>${facilityCode}</strong></li>
                <li>メールアドレス: <strong>${email}</strong></li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/" style="display: inline-block; background: #00c4cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  ログインページへ
                </a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                ご不明な点がございましたら、お気軽にお問い合わせください。
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
              <p>株式会社INU</p>
              <p>Roots 運営チーム</p>
            </div>
          </body>
        </html>
      `;
    } else {
      // Personal側のウェルカムメール
      subject = 'Roots ご登録ありがとうございます';
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #00c4cc 0%, #00b0b8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Roots へようこそ！</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                ${name} 様
              </p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                この度は、Roots（児童発達支援管理システム）にご登録いただき、誠にありがとうございます。
              </p>
              <p style="font-size: 16px; margin-bottom: 20px;">
                以下の情報でログインできます：
              </p>
              <ul style="font-size: 14px; margin-bottom: 20px; padding-left: 20px;">
                <li>メールアドレス: <strong>${email}</strong></li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://my.Roots.inu.co.jp/login" style="display: inline-block; background: #00c4cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  ログインページへ
                </a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                ご不明な点がございましたら、お気軽にお問い合わせください。
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
              <p>株式会社INU</p>
              <p>Roots 運営チーム</p>
            </div>
          </body>
        </html>
      `;
    }

    const { data, error } = await getResend().emails.send({
      from: fromEmail,
      to: email,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'メール送信に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Send welcome email error:', error);
    return NextResponse.json(
      { error: error.message || 'メール送信に失敗しました' },
      { status: 500 }
    );
  }
}

