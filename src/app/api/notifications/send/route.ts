/**
 * 通知送信API
 * アプリ内通知の作成、プッシュ通知、メール通知を統合管理する
 *
 * POST /api/notifications/send
 * Body: {
 *   userId: string;
 *   type: string;
 *   title: string;
 *   body?: string;
 *   data?: Record<string, unknown>;
 *   sendPush?: boolean;
 *   sendEmail?: boolean;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { authenticateRequest, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const auth = await authenticateRequest(request);
    if (!auth) return unauthorizedResponse();

    const {
      userId,
      type,
      title,
      body,
      data,
      sendPush = false,
      sendEmail = false,
    } = await request.json();

    // バリデーション
    if (!userId || !type || !title) {
      return NextResponse.json(
        { error: 'userId, type, title は必須です' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 1. アプリ内通知をDBに作成
    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body: body || null,
        data: data || null,
        read: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[notifications/send] DB挿入エラー:', insertError);
      return NextResponse.json(
        { error: '通知の作成に失敗しました' },
        { status: 500 }
      );
    }

    // 2. ユーザーの通知設定を取得
    let preferences: Record<string, unknown> | null = null;
    if (sendPush || sendEmail) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      preferences = prefs;
    }

    // 3. プッシュ通知の送信
    if (sendPush) {
      const pushEnabled = preferences?.push_enabled !== false;

      if (pushEnabled) {
        // ユーザーのpush_subscriptionを取得
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId);

        if (subscriptions && subscriptions.length > 0) {
          const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

          if (vapidPublic && vapidPrivate) {
            const webpush = await import('web-push');
            webpush.setVapidDetails(
              'mailto:support@and-and.co.jp',
              vapidPublic,
              vapidPrivate,
            );

            const payload = JSON.stringify({
              title,
              body: body || '',
              data: { url: (data as Record<string, unknown>)?.url || '/', ...data as Record<string, unknown> },
              tag: type,
            });

            for (const sub of subscriptions) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  payload,
                );
              } catch (pushErr: unknown) {
                console.error('[notifications/send] プッシュ送信エラー:', pushErr);
                // 410 Gone = subscription expired, remove it
                if (pushErr && typeof pushErr === 'object' && 'statusCode' in pushErr && (pushErr as { statusCode: number }).statusCode === 410) {
                  await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('id', sub.id);
                }
              }
            }
          }
        }
      }
    }

    // 4. メール通知の送信
    if (sendEmail) {
      // 通知タイプに応じたメール設定キーをチェック
      const emailPreferenceMap: Record<string, string> = {
        new_application: 'email_new_application',
        new_message: 'email_new_message',
        application_status: 'email_status_change',
        scout: 'email_scout',
        job_match: 'email_job_match',
      };

      const emailPrefKey = emailPreferenceMap[type];
      const emailEnabled =
        !emailPrefKey || preferences?.[emailPrefKey] !== false;

      if (emailEnabled) {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          // ユーザーのメールアドレスを取得
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single();

          if (userData?.email) {
            const { Resend } = await import('resend');
            const resend = new Resend(resendApiKey);
            const fromEmail = process.env.RESEND_FROM_EMAIL || 'Roots <noreply@and-and.co.jp>';

            try {
              await resend.emails.send({
                from: fromEmail,
                to: userData.email,
                subject: title,
                html: `
                  <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
                    <div style="background:#00c4cc;padding:24px;text-align:center;">
                      <h1 style="color:white;font-size:20px;margin:0;">Roots</h1>
                    </div>
                    <div style="padding:24px;">
                      <h2 style="font-size:16px;color:#333;">${title}</h2>
                      ${body ? `<p style="color:#666;line-height:1.8;">${body}</p>` : ''}
                      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />
                      <p style="color:#999;font-size:12px;">この通知はRootsから自動送信されています。</p>
                    </div>
                  </div>
                `,
              });
            } catch (emailErr) {
              console.error('[notifications/send] メール送信エラー:', emailErr);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        read: notification.read,
        createdAt: notification.created_at,
      },
    });
  } catch (error: unknown) {
    console.error('[notifications/send] エラー:', error);
    const message =
      error instanceof Error ? error.message : '通知送信に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
