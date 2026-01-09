/**
 * データベースのテーブル存在確認スクリプト
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log('🔍 データベーステーブルの存在確認中...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  const tables = [
    'facilities',
    'facility_settings',
    'children',
    'staff',
    'users',
    'schedules',
    'usage_records',
    'shifts',
    'leads',
    'management_targets',
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
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
        console.log(`✅ ${table}: テーブルが存在します (データ数: ${data ? 'あり' : 'なし'})`);
      }
    } catch (err: any) {
      console.log(`❌ ${table}: エラー - ${err.message}`);
    }
  }

  // 施設データの確認
  console.log('\n📊 施設データの確認:');
  const { data: facilities, error: fError } = await supabase
    .from('facilities')
    .select('*')
    .limit(5);

  if (fError) {
    console.log(`  エラー: ${fError.message}`);
  } else {
    console.log(`  施設数: ${facilities?.length || 0}`);
    facilities?.forEach(f => {
      console.log(`    - ${f.name} (${f.id})`);
    });
  }

  // スケジュールデータの確認
  console.log('\n📅 スケジュールデータの確認:');
  const { data: schedules, error: sError } = await supabase
    .from('schedules')
    .select('*')
    .limit(5);

  if (sError) {
    console.log(`  エラー: ${sError.message}`);
  } else {
    console.log(`  スケジュール数: ${schedules?.length || 0}`);
  }

  // リードデータの確認
  console.log('\n📞 リードデータの確認:');
  const { data: leads, error: lError } = await supabase
    .from('leads')
    .select('*')
    .limit(5);

  if (lError) {
    console.log(`  エラー: ${lError.message}`);
  } else {
    console.log(`  リード数: ${leads?.length || 0}`);
  }
}

checkTables();

