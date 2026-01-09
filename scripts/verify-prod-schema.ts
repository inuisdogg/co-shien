/**
 * 本番環境のスキーマ最終確認
 */

import { createClient } from '@supabase/supabase-js';

const prodUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const prodSupabase = createClient(prodUrl, prodKey);

async function verifyProdSchema() {
  console.log('🔍 本番環境のスキーマ最終確認\n');

  const tables = [
    'facilities',
    'users',
    'staff',
    'employment_records',
    'user_careers',
    'children',
    'leads',
    'facility_settings',
    'facility_settings_history',
    'schedules',
    'usage_records',
    'shifts',
    'management_targets',
    'otp_codes',
    'companies',
  ];

  console.log('📋 テーブル存在確認:');
  console.log('='.repeat(60));

  for (const table of tables) {
    try {
      const { data, error } = await prodSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST205') {
          console.log(`❌ ${table}: テーブルが存在しません`);
        } else {
          console.log(`⚠️  ${table}: エラー - ${error.message}`);
        }
      } else {
        const columnCount = data && data.length > 0 ? Object.keys(data[0]).length : 0;
        const status = columnCount > 0 ? `${columnCount}カラム` : 'テーブル存在（データなし）';
        console.log(`✅ ${table}: ${status}`);
      }
    } catch (err: any) {
      console.log(`❌ ${table}: エラー - ${err.message}`);
    }
  }

  console.log('='.repeat(60));
  console.log('\n✅ 本番環境のスキーマ確認完了');
}

verifyProdSchema();

