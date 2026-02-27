/**
 * おすすめ求人通知メール送信API
 * マッチした求人をユーザーにメールで通知する
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerSupabaseClient } from '@/lib/supabase';

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
    resend = new Resend(apiKey);
  }
  return resend;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: '正社員',
  part_time: 'パート・アルバイト',
  spot: 'スポット勤務',
};

const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: '月給',
  hourly: '時給',
  daily: '日給',
  annual: '年収',
};

export async function POST(request: Request) {
  try {
    const { userId, jobPostingIds } = await request.json();
    if (!userId || !Array.isArray(jobPostingIds) || jobPostingIds.length === 0) {
      return NextResponse.json(
        { error: 'userId and jobPostingIds are required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.email) {
      return NextResponse.json({ error: 'ユーザー情報が見つかりません' }, { status: 404 });
    }

    // 求人情報を取得
    const { data: jobs, error: jobsError } = await supabase
      .from('job_postings')
      .select('id, title, job_type, salary_min, salary_max, salary_type, facility_id')
      .in('id', jobPostingIds);

    if (jobsError || !jobs || jobs.length === 0) {
      return NextResponse.json({ error: '求人情報が見つかりません' }, { status: 404 });
    }

    // 施設情報を取得
    const facilityIds = [...new Set(jobs.map((j) => j.facility_id as string))];
    const { data: facilities } = await supabase
      .from('facilities')
      .select('id, name')
      .in('id', facilityIds);

    const facilityMap = new Map(
      (facilities || []).map((f) => [f.id, f.name as string])
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://my.Roots.inu.co.jp';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Roots <noreply@and-and.co.jp>';

    // 求人カードHTMLを生成
    const jobCardsHtml = jobs
      .map((job) => {
        const jobType = JOB_TYPE_LABELS[job.job_type as string] || job.job_type;
        const facilityName = facilityMap.get(job.facility_id as string) || '施設';
        const salaryType = SALARY_TYPE_LABELS[job.salary_type as string] || '';

        let salaryText = '要相談';
        if (job.salary_min != null && job.salary_max != null) {
          salaryText = `${salaryType} ${Number(job.salary_min).toLocaleString()}円 〜 ${Number(job.salary_max).toLocaleString()}円`;
        } else if (job.salary_min != null) {
          salaryText = `${salaryType} ${Number(job.salary_min).toLocaleString()}円〜`;
        } else if (job.salary_max != null) {
          salaryText = `${salaryType} 〜${Number(job.salary_max).toLocaleString()}円`;
        }

        return `
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #818CF8;">
            <h3 style="margin: 0 0 8px; font-size: 16px; color: #1f2937;">${job.title}</h3>
            <p style="margin: 0 0 4px; font-size: 14px; color: #6b7280;">${facilityName}</p>
            <p style="margin: 0 0 4px; font-size: 14px;">
              <span style="display: inline-block; background: #818CF8; color: white; font-size: 12px; padding: 2px 8px; border-radius: 4px;">${jobType}</span>
              <span style="margin-left: 8px; color: #374151;">${salaryText}</span>
            </p>
            <a href="${baseUrl}/jobs/${job.id}" style="display: inline-block; margin-top: 8px; color: #818CF8; font-size: 14px; text-decoration: none;">
              詳細を見る &rarr;
            </a>
          </div>
        `;
      })
      .join('');

    const { error: sendError } = await getResend().emails.send({
      from: fromEmail,
      to: user.email,
      subject: `【Roots】あなたにおすすめの求人が${jobs.length}件あります`,
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">おすすめ求人のご案内</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">${user.name} 様</p>
              <p style="font-size: 16px;">あなたの資格・経験にマッチする求人が見つかりました。</p>
              <div style="margin: 20px 0;">
                ${jobCardsHtml}
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/jobs" style="display: inline-block; background: #818CF8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  すべての求人を見る
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

    // アプリ内通知を作成（ユーザー向け）
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'job_match',
      title: `おすすめ求人が${jobs.length}件あります`,
      body: jobs.length === 1
        ? `「${jobs[0].title}」があなたにマッチしています`
        : `「${jobs[0].title}」など${jobs.length}件の求人があなたにマッチしています`,
      data: { jobPostingIds },
      read: false,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('notify-match error:', error);
    const message = error instanceof Error ? error.message : 'メール送信に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
