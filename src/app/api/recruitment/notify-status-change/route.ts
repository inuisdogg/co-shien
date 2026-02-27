/**
 * 応募ステータス変更通知メール送信API
 * 応募者にステータス変更を通知する
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { ApplicationStatus } from '@/types';

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
    resend = new Resend(apiKey);
  }
  return resend;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: '応募受付',
  screening: '書類選考中',
  interview_scheduled: '面接日程調整中',
  interviewed: '面接完了',
  offer_sent: '内定通知',
  offer_accepted: '内定承諾',
  hired: '採用確定',
  rejected: '選考結果のお知らせ',
  withdrawn: '辞退受理',
};

export async function POST(request: Request) {
  try {
    const { applicationId, newStatus } = await request.json();
    if (!applicationId || !newStatus) {
      return NextResponse.json(
        { error: 'applicationId and newStatus are required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 応募情報を取得（応募者・求人情報をJOIN）
    const { data: app, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        users:applicant_user_id (id, name, email),
        job_postings:job_posting_id (id, title, facility_id)
      `)
      .eq('id', applicationId)
      .single();

    if (error || !app) {
      return NextResponse.json({ error: '応募情報が見つかりません' }, { status: 404 });
    }

    const applicant = app.users as Record<string, unknown> | null;
    const jobPosting = app.job_postings as Record<string, unknown> | null;
    if (!applicant || !jobPosting) {
      return NextResponse.json({ error: '関連データが不足しています' }, { status: 404 });
    }

    const recipientEmail = applicant.email as string;
    if (!recipientEmail) {
      return NextResponse.json({ error: '応募者のメールアドレスが見つかりません' }, { status: 404 });
    }

    // 施設名を取得
    const { data: facility } = await supabase
      .from('facilities')
      .select('name')
      .eq('id', jobPosting.facility_id as string)
      .single();

    const statusKey = newStatus as ApplicationStatus;
    const statusLabel = STATUS_LABELS[statusKey] || newStatus;
    const jobTitle = jobPosting.title as string;
    const applicantName = applicant.name as string;
    const facilityName = facility?.name || '施設';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://my.Roots.inu.co.jp';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Roots <noreply@and-and.co.jp>';

    // ステータスに応じたメッセージ
    let statusMessage = '';
    if (statusKey === 'rejected') {
      statusMessage = '慎重に選考を進めた結果、今回は見送りとさせていただくことになりました。今後のご活躍を心よりお祈り申し上げます。';
    } else if (statusKey === 'offer_sent') {
      statusMessage = '選考の結果、ぜひ一緒に働いていただきたくご連絡いたします。詳細はアプリからご確認ください。';
    } else if (statusKey === 'hired') {
      statusMessage = 'おめでとうございます！採用が確定しました。今後の手続きについてはアプリからご確認ください。';
    } else if (statusKey === 'withdrawn') {
      statusMessage = '辞退を承りました。またの機会がございましたらよろしくお願いいたします。';
    } else {
      statusMessage = `選考ステータスが「${statusLabel}」に更新されました。詳細はアプリからご確認ください。`;
    }

    const { error: sendError } = await getResend().emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `【Roots】${statusLabel} - ${jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${statusLabel}</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">${applicantName} 様</p>
              <p style="font-size: 16px;">
                ${facilityName}の求人「<strong>${jobTitle}</strong>」について、以下のとおりご連絡いたします。
              </p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #818CF8;">
                <p style="margin: 0 0 8px;"><strong>ステータス:</strong> ${statusLabel}</p>
                <p style="margin: 0;">${statusMessage}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/career" style="display: inline-block; background: #818CF8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  詳細を確認する
                </a>
              </div>
              <p style="font-size: 14px; color: #666; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                ご不明な点がございましたら、お気軽にお問い合わせください。
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
              <p>Roots 運営チーム</p>
            </div>
          </body>
        </html>
      `,
    });

    if (sendError) {
      console.error('Resend error:', sendError);
      return NextResponse.json({ error: 'メール送信に失敗しました' }, { status: 500 });
    }

    // アプリ内通知を作成（応募者向け）
    if (applicant?.id) {
      await supabase.from('notifications').insert({
        user_id: applicant.id as string,
        type: 'application_status',
        title: `選考ステータス更新: ${statusLabel}`,
        body: `${facilityName}の「${jobTitle}」の選考ステータスが「${statusLabel}」に更新されました`,
        data: { applicationId, jobPostingId: jobPosting.id, newStatus },
        read: false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('notify-status-change error:', error);
    const message = error instanceof Error ? error.message : 'メール送信に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
