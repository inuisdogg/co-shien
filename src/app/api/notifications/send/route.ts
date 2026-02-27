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

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
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
          // TODO: web-push ライブラリによるプッシュ通知送信
          // 現時点ではDB通知のみ作成し、実際のプッシュ送信は未実装
          // 実装時は以下の流れ:
          //   import webpush from 'web-push';
          //   webpush.setVapidDetails(
          //     'mailto:support@roots.example.com',
          //     process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          //     process.env.VAPID_PRIVATE_KEY!
          //   );
          //   for (const sub of subscriptions) {
          //     await webpush.sendNotification(
          //       { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          //       JSON.stringify({ title, body, data: { url: data?.url || '/', ...data }, tag: type })
          //     );
          //   }
          console.log(
            `[notifications/send] プッシュ通知対象: ${subscriptions.length}件のサブスクリプション (送信はTODO)`
          );
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
        // TODO: Resendを使ったメール送信
        // 既存の notify-application/notify-status-change/notify-match ルートの
        // パターンに従って実装する
        // 現時点ではDB通知のみ作成し、汎用メール送信は未実装
        console.log(
          `[notifications/send] メール通知対象: userId=${userId}, type=${type} (送信はTODO)`
        );
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
