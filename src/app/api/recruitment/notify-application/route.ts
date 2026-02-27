/**
 * 新規応募通知メール送信API
 * 施設担当者に応募があったことを通知する
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerSupabaseClient } from '@/lib/supabase';
import { QUALIFICATION_CODES, type QualificationCode } from '@/types';
import { escapeHtml } from '@/utils/escapeHtml';

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function POST(request: Request) {
  try {
    const { applicationId } = await request.json();
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // 応募情報を取得（ユーザー・求人情報をJOIN）
    const { data: app, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        users:applicant_user_id (id, name, email, qualifications),
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

    // 施設情報を取得
    const { data: facility } = await supabase
      .from('facilities')
      .select('id, name')
      .eq('id', jobPosting.facility_id as string)
      .single();

    // 施設のオーナー/管理者の情報を取得
    const { data: owner } = await supabase
      .from('users')
      .select('id, email')
      .eq('facility_id', jobPosting.facility_id as string)
      .in('role', ['admin', 'owner'])
      .limit(1)
      .single();

    const recipientEmail = owner?.email;
    if (!recipientEmail) {
      return NextResponse.json({ error: '通知先メールアドレスが見つかりません' }, { status: 404 });
    }

    const jobTitle = jobPosting.title as string;
    const applicantName = applicant.name as string;
    const qualifications = Array.isArray(applicant.qualifications)
      ? (applicant.qualifications as string[])
          .map((q) => QUALIFICATION_CODES[q as QualificationCode] || q)
          .join('、')
      : '未登録';
    const coverPreview = app.cover_message
      ? (app.cover_message as string).slice(0, 100) + ((app.cover_message as string).length > 100 ? '...' : '')
      : 'なし';

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://biz.Roots.inu.co.jp';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Roots <noreply@and-and.co.jp>';

    const { error: sendError } = await getResend().emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `【Roots】新規応募がありました - ${escapeHtml(jobTitle)}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #00c4cc 0%, #00b0b8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">新規応募のお知らせ</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">求人「<strong>${escapeHtml(jobTitle)}</strong>」に新しい応募がありました。</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00c4cc;">
                <p style="margin: 0 0 8px;"><strong>応募者:</strong> ${escapeHtml(applicantName)}</p>
                <p style="margin: 0 0 8px;"><strong>保有資格:</strong> ${escapeHtml(qualifications)}</p>
                <p style="margin: 0;"><strong>カバーメッセージ:</strong> ${escapeHtml(coverPreview)}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/recruitment" style="display: inline-block; background: #00c4cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  応募を確認する
                </a>
              </div>
              <p style="font-size: 14px; color: #666; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                ${escapeHtml(facility?.name || '施設')} の採用管理画面からご確認ください。
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

    // アプリ内通知を作成
    if (owner?.id) {
      await supabase.from('notifications').insert({
        user_id: owner.id,
        type: 'new_application',
        title: `新しい応募: ${applicantName}`,
        body: `${jobTitle}に新しい応募がありました`,
        data: { applicationId, jobPostingId: jobPosting.id },
        read: false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('notify-application error:', error);
    const message = error instanceof Error ? error.message : 'メール送信に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
