import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。'
  );
}

/**
 * ブラウザ用Supabaseクライアント（既存互換）
 * 全コンポーネントからインポートされる
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * サーバーサイド用Supabaseクライアント生成
 * Server Components, API Routes, Middleware から使用
 * Service Role Keyがある場合はそれを使用（RLSバイパス）
 */
export function createServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(
    supabaseUrl,
    serviceRoleKey || supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
