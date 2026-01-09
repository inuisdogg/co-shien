import { createClient } from '@supabase/supabase-js';

// 開発環境のデフォルト値を使用
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase環境変数が設定されていません。.env.localファイルに設定してください。');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

