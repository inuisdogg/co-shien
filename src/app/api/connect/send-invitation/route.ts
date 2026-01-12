/**
 * コネクト - 日程調整招待メール送信API
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
      purpose,
      location,
      childName,
      participantEmail,
      participantName,
      organizationName,
      accessToken,
      dateOptions,
      isReminder,
    } = await request.json();

    if (!meetingId || !meetingTitle || !participantEmail || !accessToken || !dateOptions) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    // 回答ページのURL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.co-shien.jp';
    const responseUrl = `${baseUrl}/connect/respond?token=${accessToken}`;

    // 日程候補のHTML
    const dateOptionsHtml = dateOptions
      .map((opt: { date: string; startTime: string; endTime?: string }) => {
        const dateStr = new Date(opt.date).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        });
        const timeStr = opt.endTime ? `${opt.startTime} - ${opt.endTime}` : opt.startTime;
        return `<li style="margin: 8px 0; padding: 8px; background: #f3f4f6; border-radius: 4px;">${dateStr} ${timeStr}</li>`;
      })
      .join('');

    const subjectPrefix = isReminder ? '【リマインダー】' : '';
    const subject = `${subjectPrefix}【日程調整】${meetingTitle}のご案内`;

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
            .header { background: linear-gradient(135deg, #00c4cc 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
            .info-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
            .info-value { font-weight: 500; color: #1e293b; }
            .button { display: inline-block; background: #06b6d4; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            ul { list-style: none; padding: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">co-shien</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">連絡会日程調整</p>
            </div>
            <div class="content">
              <p>${participantName ? `${participantName} 様` : `${organizationName} ご担当者 様`}</p>

              ${isReminder ? '<p style="color: #ea580c; font-weight: bold;">こちらは日程調整依頼のリマインダーです。</p>' : ''}

              <p>下記の連絡会について、日程調整のご協力をお願いいたします。</p>

              <div class="info-box">
                <div style="margin-bottom: 12px;">
                  <div class="info-label">会議名</div>
                  <div class="info-value">${meetingTitle}</div>
                </div>
                ${childName ? `
                <div style="margin-bottom: 12px;">
                  <div class="info-label">対象児童</div>
                  <div class="info-value">${childName}</div>
                </div>
                ` : ''}
                ${purpose ? `
                <div style="margin-bottom: 12px;">
                  <div class="info-label">目的</div>
                  <div class="info-value">${purpose}</div>
                </div>
                ` : ''}
                ${location ? `
                <div>
                  <div class="info-label">場所</div>
                  <div class="info-value">${location}</div>
                </div>
                ` : ''}
              </div>

              <h3 style="color: #0891b2; margin: 24px 0 12px;">日程候補</h3>
              <ul>
                ${dateOptionsHtml}
              </ul>

              <p>以下のリンクから、各日程への参加可否をご回答ください。</p>

              <div style="text-align: center;">
                <a href="${responseUrl}" class="button">日程に回答する</a>
              </div>

              <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                このリンクは30日間有効です。<br>
                ご不明な点がございましたら、施設までお問い合わせください。
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
    console.error('Send connect invitation error:', error);
    return NextResponse.json(
      { error: 'メール送信に失敗しました', details: error.message },
      { status: 500 }
    );
  }
}
