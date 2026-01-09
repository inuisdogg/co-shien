/**
 * 最終的なスキーマ整合性の確認
 */

import { createClient } from '@supabase/supabase-js';

const devUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const devKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const prodUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const devSupabase = createClient(devUrl, devKey);
const prodSupabase = createClient(prodUrl, prodKey);

async function finalVerification() {
  console.log('🔍 最終的なスキーマ整合性の確認\n');

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

  let allMatch = true;

  for (const table of tables) {
    // 開発環境
    let devColumns: string[] = [];
    let devExists = false;
    try {
      const { data: devData, error: devError } = await devSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!devError) {
        devExists = true;
        if (devData && devData.length > 0) {
          devColumns = Object.keys(devData[0]).sort();
        }
      }
    } catch (err) {
      // エラーは無視
    }

    // 本番環境
    let prodColumns: string[] = [];
    let prodExists = false;
    try {
      const { data: prodData, error: prodError } = await prodSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!prodError) {
        prodExists = true;
        if (prodData && prodData.length > 0) {
          prodColumns = Object.keys(prodData[0]).sort();
        }
      }
    } catch (err) {
      // エラーは無視
    }

    // 存在チェック
    if (devExists !== prodExists) {
      console.log(`❌ ${table}: 存在が一致しません (開発: ${devExists ? '存在' : '不存在'}, 本番: ${prodExists ? '存在' : '不存在'})`);
      allMatch = false;
      continue;
    }

    if (!devExists && !prodExists) {
      console.log(`⚠️  ${table}: 両環境に存在しません`);
      continue;
    }

    // カラム数の比較（データがない場合は比較不可）
    if (devColumns.length > 0 && prodColumns.length > 0) {
      const devOnly = devColumns.filter(c => !prodColumns.includes(c));
      const prodOnly = prodColumns.filter(c => !devColumns.includes(c));
      
      if (devOnly.length > 0 || prodOnly.length > 0) {
        console.log(`❌ ${table}: カラム構成が一致しません`);
        if (devOnly.length > 0) {
          console.log(`  開発環境のみ: ${devOnly.join(', ')}`);
        }
        if (prodOnly.length > 0) {
          console.log(`  本番環境のみ: ${prodOnly.length}カラム`);
        }
        allMatch = false;
      } else {
        console.log(`✅ ${table}: 一致 (${devColumns.length}カラム)`);
      }
    } else if (devColumns.length === 0 && prodColumns.length === 0) {
      // 両方データなし（テーブルは存在）
      console.log(`✅ ${table}: テーブル存在 (データなし)`);
    } else {
      // 片方だけデータがある
      if (devColumns.length > 0) {
        console.log(`⚠️  ${table}: 開発環境のみデータあり (${devColumns.length}カラム)`);
      } else {
        console.log(`⚠️  ${table}: 本番環境のみデータあり (${prodColumns.length}カラム)`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allMatch) {
    console.log('✅ すべてのテーブル構造が一致しています！');
  } else {
    console.log('⚠️  一部のテーブル構造が一致していません。');
  }
  console.log('='.repeat(50));
}

finalVerification();

