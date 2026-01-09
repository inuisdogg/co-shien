/**
 * 開発環境と本番環境のDB構造を比較
 */

import { createClient } from '@supabase/supabase-js';

const devUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const devKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const prodUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const devSupabase = createClient(devUrl, devKey);
const prodSupabase = createClient(prodUrl, prodKey);

async function compareSchemas() {
  console.log('🔍 開発環境と本番環境のDB構造を比較中...\n');

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

  for (const table of tables) {
    console.log(`📋 ${table}:`);
    
    // 開発環境
    let devColumns: string[] = [];
    try {
      const { data: devData, error: devError } = await devSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (devError) {
        if (devError.code === 'PGRST205') {
          console.log('  開発: ❌ テーブルが存在しません');
        } else {
          console.log(`  開発: ⚠️  エラー - ${devError.message}`);
        }
      } else if (devData && devData.length > 0) {
        devColumns = Object.keys(devData[0]);
        console.log(`  開発: ✅ テーブルが存在します (カラム数: ${devColumns.length})`);
      } else {
        // テーブルは存在するがデータがない場合、カラム情報を取得できないので確認
        console.log(`  開発: ✅ テーブルが存在します (データなし)`);
      }
    } catch (err: any) {
      console.log(`  開発: ❌ エラー - ${err.message}`);
    }

    // 本番環境
    let prodColumns: string[] = [];
    try {
      const { data: prodData, error: prodError } = await prodSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (prodError) {
        if (prodError.code === 'PGRST205') {
          console.log('  本番: ❌ テーブルが存在しません');
        } else {
          console.log(`  本番: ⚠️  エラー - ${prodError.message}`);
        }
      } else if (prodData && prodData.length > 0) {
        prodColumns = Object.keys(prodData[0]);
        console.log(`  本番: ✅ テーブルが存在します (カラム数: ${prodColumns.length})`);
      } else {
        console.log(`  本番: ✅ テーブルが存在します (データなし)`);
      }
    } catch (err: any) {
      console.log(`  本番: ❌ エラー - ${err.message}`);
    }

    // カラムの比較
    if (devColumns.length > 0 && prodColumns.length > 0) {
      const devOnly = devColumns.filter(c => !prodColumns.includes(c));
      const prodOnly = prodColumns.filter(c => !devColumns.includes(c));
      
      if (devOnly.length > 0) {
        console.log(`  ⚠️  開発環境のみのカラム: ${devOnly.join(', ')}`);
      }
      if (prodOnly.length > 0) {
        console.log(`  ⚠️  本番環境のみのカラム: ${prodOnly.join(', ')}`);
      }
      if (devOnly.length === 0 && prodOnly.length === 0) {
        console.log(`  ✅ カラム構成は一致しています`);
      }
    }
    
    console.log('');
  }
}

compareSchemas();

