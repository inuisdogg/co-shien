/**
 * 連絡会議 日程確定通知メール送信API
 * 日程確定時に全参加者に自動通知
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      participantEmail,
      participantName,
      organizationName,
      meetingTitle,
      facilityName,
      confirmedDate,
      confirmedTime,
      location,
    } = body;

    if (!participantEmail || !meetingTitle || !facilityName || !confirmedDate) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('[DEV] 確定通知メール送信スキップ:', { participantEmail, meetingTitle });
      return NextResponse.json({ success: true, devMode: true });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const locationHtml = location
      ? `<p style="margin:8px 0;"><strong>場所:</strong> ${location}</p>`
      : '';

    const { error } = await resend.emails.send({
      from: 'Roots <noreply@and-and.co.jp>',
      to: participantEmail,
      subject: `【Roots】日程が確定しました: ${meetingTitle}`,
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
          <div style="background:#00c4cc;padding:24px;text-align:center;">
            <h1 style="color:white;font-size:20px;margin:0;">Roots 連絡会議</h1>
          </div>
          <div style="padding:32px 24px;">
            <p>${participantName || organizationName}様</p>
            <p>連絡会議「<strong>${meetingTitle}</strong>」の日程が確定しました。</p>

            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
              <p style="color:#15803d;font-size:14px;margin:0 0 8px;">確定日程</p>
              <p style="color:#166534;font-size:22px;font-weight:bold;margin:0;">
                ${confirmedDate} ${confirmedTime || ''}
              </p>
              ${locationHtml}
            </div>

            <p>ご出席をお待ちしております。</p>
            <p style="color:#999;font-size:12px;margin-top:24px;">
              このメールは ${facilityName} より自動送信されています。
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'メール送信に失敗しました', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Send confirmation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'メール送信に失敗しました', details: message },
      { status: 500 }
    );
  }
}
