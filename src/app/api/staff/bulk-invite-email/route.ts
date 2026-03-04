/**
 * スタッフ一括招待メール送信API
 * Resendで10件ずつバッチ送信
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { escapeHtml } from '@/utils/escapeHtml';

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

interface InviteEmailRequest {
  recipients: Array<{
    name: string;
    email: string;
    activationUrl: string;
  }>;
  facilityName: string;
}

export async function POST(req: NextRequest) {
  try {
    const { authenticateRequest, unauthorizedResponse } = await import('@/lib/apiAuth');
    const auth = await authenticateRequest(req);
    if (!auth) return unauthorizedResponse();

    const { recipients, facilityName }: InviteEmailRequest = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: '送信先が指定されていません' },
        { status: 400 }
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';
    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    // 10件ずつバッチ送信
    const BATCH_SIZE = 10;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (recipient) => {
        try {
          const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #00c4cc 0%, #00b0b8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">スタッフ招待のお知らせ</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    ${escapeHtml(recipient.name)} 様
                  </p>
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    <strong>${escapeHtml(facilityName)}</strong>のスタッフとして招待されました。
                  </p>
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    以下のボタンからアカウントを作成し、施設に参加してください。
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${escapeHtml(recipient.activationUrl)}" style="display: inline-block; background: #00c4cc; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                      招待を受け入れる
                    </a>
                  </div>
                  <p style="font-size: 12px; color: #999; margin-top: 20px;">
                    ※ このリンクは7日間有効です。期限が切れた場合は管理者に再発行を依頼してください。
                  </p>
                  <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                    ご不明な点がございましたら、施設の管理者にお問い合わせください。
                  </p>
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
                  <p>株式会社INU</p>
                  <p>Roots 運営チーム</p>
                </div>
              </body>
            </html>
          `;

          const { error } = await getResend().emails.send({
            from: fromEmail,
            to: recipient.email,
            subject: `【${facilityName}】スタッフ招待のお知らせ - Roots`,
            html: htmlContent,
          });

          if (error) {
            results.push({ email: recipient.email, success: false, error: error.message });
          } else {
            results.push({ email: recipient.email, success: true });
          }
        } catch (err: any) {
          results.push({ email: recipient.email, success: false, error: err.message });
        }
      });

      await Promise.all(promises);
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      totalSent: successCount,
      totalFailed: errorCount,
      results,
    });
  } catch (error: any) {
    console.error('Bulk invite email error:', error);
    return NextResponse.json(
      { error: 'メール送信に失敗しました' },
      { status: 500 }
    );
  }
}
