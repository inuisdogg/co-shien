import { createClient } from '@supabase/supabase-js';

/**
 * サーバーサイド専用 Supabase クライアント（Service Role）
 * API Routes や Server Components でのみ使用
 * RLS をバイパスするため、クライアントサイドでは絶対に使用しないこと
 */
export function createServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'サーバーサイド Supabase の環境変数が不足しています。NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください。'
    );
  }

  return createClient(supabaseUrl, serviceKey);
}
