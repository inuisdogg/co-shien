/**
 * 実務経験証明書 署名完了通知メールAPI
 * 施設側が署名を完了した際に、申請者へ完了通知メールを送信
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

let resend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resend) resend = new Resend(apiKey);
  return resend;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase configuration is missing');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { recordId, signerName } = await req.json();

    if (!recordId) {
      return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get the record and applicant info
    const { data: record, error: recordError } = await supabase
      .from('work_experience_records')
      .select('id, user_id, facility_name, status')
      .eq('id', recordId)
      .single();

    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    if (record.status !== 'signed') {
      return NextResponse.json({ error: 'Record is not signed' }, { status: 400 });
    }

    // Get applicant email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', record.user_id)
      .single();

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const resendClient = getResend();
    if (!resendClient) {
      // Dev mode
      return NextResponse.json({
        success: true,
        devMode: true,
        message: `開発モード: ${user.email}への通知メールはスキップされました`,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://roots.inu.co.jp';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">実務経験証明書の署名が完了しました</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p>${user.name || ''}さん</p>
            <p>
              <strong>${record.facility_name}</strong>の実務経験証明書について、
              ${signerName ? `<strong>${signerName}</strong>様による` : ''}電子署名が完了しました。
            </p>
            <p>署名済みの証明書はRootsキャリアアカウントからいつでもダウンロードできます。</p>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${baseUrl}/career" style="display: inline-block; background: #10b981; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                証明書をダウンロード
              </a>
            </div>

            <div style="font-size: 13px; color: #666; border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
              <p style="margin: 0;">このメールはRoots実務経験証明書システムから自動送信されています。</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
            <p>Roots - 福祉専門職のためのキャリアプラットフォーム</p>
          </div>
        </body>
      </html>
    `;

    const { error } = await resendClient.emails.send({
      from: fromEmail,
      to: user.email,
      subject: `【Roots】実務経験証明書の署名が完了しました — ${record.facility_name}`,
      html: htmlContent,
    });

    if (error) {
      console.error('Notification email error:', error);
      return NextResponse.json({ error: 'メール送信に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Certificate signed notification error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
