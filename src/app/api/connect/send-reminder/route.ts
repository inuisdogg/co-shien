/**
 * 連絡会議 リマインダーメール送信API
 * 未回答の外部参加者にリマインダーを送信
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participantEmail, participantName, organizationName, meetingTitle, facilityName, dateOptions, respondUrl } = body;

    // 必須フィールドのバリデーション
    if (!participantEmail || !meetingTitle || !facilityName || !respondUrl) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // 開発モード: APIキーがない場合はメール送信をスキップ
      console.log('[DEV] リマインダーメール送信スキップ:', { participantEmail, meetingTitle });
      return NextResponse.json({ success: true, devMode: true });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const dateOptionsHtml = (dateOptions || [])
      .map((d: { date: string; startTime: string; endTime?: string }) =>
        `<p style="margin:4px 0;">・${d.date} ${d.startTime}${d.endTime ? '〜' + d.endTime : ''}</p>`
      )
      .join('');

    const { error } = await resend.emails.send({
      from: 'Roots <noreply@and-and.co.jp>',
      to: participantEmail,
      subject: `【リマインダー】${meetingTitle} の日程回答をお願いします`,
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
          <div style="background:#00c4cc;padding:24px;text-align:center;">
            <h1 style="color:white;font-size:20px;margin:0;">Roots 連絡会議</h1>
          </div>
          <div style="padding:32px 24px;">
            <p>${participantName || organizationName}様</p>
            <p>${facilityName}より連絡会議「${meetingTitle}」の日程回答をお願いしております。</p>
            <p style="color:#e53e3e;font-weight:bold;">まだ日程のご回答をいただいておりません。お忙しいところ恐縮ですが、ご確認をお願いいたします。</p>
            <div style="margin:24px 0;">
              <p style="font-weight:bold;">候補日程:</p>
              ${dateOptionsHtml}
            </div>
            <div style="text-align:center;margin:32px 0;">
              <a href="${respondUrl}" style="background:#00c4cc;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;display:inline-block;">
                日程を回答する
              </a>
            </div>
            <p style="color:#999;font-size:12px;">このリンクは30日間有効です。</p>
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
    console.error('Send reminder error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'メール送信に失敗しました', details: message },
      { status: 500 }
    );
  }
}
