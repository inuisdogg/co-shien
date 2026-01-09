/**
 * ステージング環境（本番環境プロジェクトID）の準備状況確認
 */

import { createClient } from '@supabase/supabase-js';

const stagingUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const stagingKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const stagingSupabase = createClient(stagingUrl, stagingKey);

async function verifyStagingReady() {
  console.log('🔍 ステージング環境（本番環境プロジェクトID）の準備状況確認\n');
  console.log(`📍 プロジェクトID: iskgcqzozsemlmbvubna`);
  console.log(`📍 URL: ${stagingUrl}\n`);

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
  console.log('='.repeat(70));
  console.log('テーブル名'.padEnd(30) + '存在'.padEnd(10) + 'カラム数'.padEnd(15) + 'データ有無');
  console.log('-'.repeat(70));

  let allTablesExist = true;

  for (const table of tables) {
    try {
      const { data, error } = await stagingSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST205') {
          console.log(`${table.padEnd(30)}❌ 不存在`);
          allTablesExist = false;
        } else {
          console.log(`${table.padEnd(30)}⚠️  エラー: ${error.message}`);
        }
      } else {
        const columnCount = data && data.length > 0 ? Object.keys(data[0]).length : 0;
        const hasData = data && data.length > 0;
        const columnInfo = columnCount > 0 ? `${columnCount}カラム` : 'データなし';
        const dataInfo = hasData ? 'データあり' : 'データなし';
        console.log(`${table.padEnd(30)}✅ 存在${columnInfo.padEnd(15)}${dataInfo}`);
      }
    } catch (err: any) {
      console.log(`${table.padEnd(30)}❌ エラー: ${err.message}`);
      allTablesExist = false;
    }
  }

  console.log('='.repeat(70));

  if (allTablesExist) {
    console.log('\n✅ すべてのテーブルが存在します。ステージング環境として使用可能です。');
  } else {
    console.log('\n⚠️  一部のテーブルが存在しません。マイグレーションの適用が必要です。');
  }

  // 主要テーブルのカラム構成を確認
  console.log('\n📋 主要テーブルのカラム構成:');
  console.log('='.repeat(70));

  const mainTables = ['users', 'staff', 'facility_settings', 'children', 'leads', 'schedules', 'shifts', 'management_targets'];
  
  for (const table of mainTables) {
    try {
      const { data, error } = await stagingSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!error && data && data.length > 0) {
        const columns = Object.keys(data[0]).sort();
        console.log(`\n${table} (${columns.length}カラム):`);
        console.log(`  ${columns.join(', ')}`);
      }
    } catch (err) {
      // エラーは無視
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ ステージング環境の確認完了');
  console.log('\n📝 次のステップ:');
  console.log('  1. ステージング環境で動作確認');
  console.log('  2. 問題がなければ本番環境にプッシュ（既に適用済み）');
}

verifyStagingReady();

