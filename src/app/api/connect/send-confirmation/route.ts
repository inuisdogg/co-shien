/**
 * コネクト - 日程確定通知メール送信API
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  return new Resend(apiKey);
};

export async function POST(request: NextRequest) {
  try {
    const {
      meetingId,
      meetingTitle,
      location,
      participantEmail,
      participantName,
      organizationName,
      confirmedDate,
      confirmedStartTime,
      confirmedEndTime,
    } = await request.json();

    if (!meetingId || !meetingTitle || !participantEmail || !confirmedDate || !confirmedStartTime) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    // 確定日時の整形
    const dateStr = new Date(confirmedDate).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
    const timeStr = confirmedEndTime
      ? `${confirmedStartTime} - ${confirmedEndTime}`
      : confirmedStartTime;

    const subject = `【日程確定】${meetingTitle} - ${dateStr}`;

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: 'co-shien <noreply@co-shien.inu.co.jp>',
      to: participantEmail,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .confirmed-box { background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .confirmed-date { font-size: 24px; font-weight: bold; color: #1e40af; margin: 8px 0; }
            .confirmed-time { font-size: 18px; color: #3b82f6; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
            .info-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
            .info-value { font-weight: 500; color: #1e293b; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">co-shien</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">日程確定のお知らせ</p>
            </div>
            <div class="content">
              <p>${participantName ? `${participantName} 様` : `${organizationName} ご担当者 様`}</p>

              <p>下記の連絡会の日程が確定しましたのでお知らせいたします。</p>

              <div class="confirmed-box">
                <div style="font-size: 14px; color: #64748b;">確定日程</div>
                <div class="confirmed-date">${dateStr}</div>
                <div class="confirmed-time">${timeStr}</div>
              </div>

              <div class="info-box">
                <div style="margin-bottom: 12px;">
                  <div class="info-label">会議名</div>
                  <div class="info-value">${meetingTitle}</div>
                </div>
                ${location ? `
                <div>
                  <div class="info-label">場所</div>
                  <div class="info-value">${location}</div>
                </div>
                ` : ''}
              </div>

              <p>ご参加をお待ちしております。</p>

              <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                ご都合が変わった場合は、施設までお早めにご連絡ください。
              </p>
            </div>
            <div class="footer">
              <p>co-shien - 児童発達支援管理システム</p>
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
    console.error('Send connect confirmation error:', error);
    return NextResponse.json(
      { error: 'メール送信に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}
