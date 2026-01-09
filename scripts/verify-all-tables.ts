/**
 * すべてのテーブルの存在確認とカラム数の確認
 */

import { createClient } from '@supabase/supabase-js';

const devUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const devKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const prodUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const devSupabase = createClient(devUrl, devKey);
const prodSupabase = createClient(prodUrl, prodKey);

async function verifyAllTables() {
  console.log('🔍 すべてのテーブルの存在確認\n');

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

  const results: Array<{
    table: string;
    devExists: boolean;
    prodExists: boolean;
    devColumns: number;
    prodColumns: number;
    match: boolean;
  }> = [];

  for (const table of tables) {
    let devExists = false;
    let prodExists = false;
    let devColumns = 0;
    let prodColumns = 0;

    // 開発環境
    try {
      const { data: devData, error: devError } = await devSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!devError) {
        devExists = true;
        if (devData && devData.length > 0) {
          devColumns = Object.keys(devData[0]).length;
        }
      }
    } catch (err) {
      // エラーは無視
    }

    // 本番環境
    try {
      const { data: prodData, error: prodError } = await prodSupabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!prodError) {
        prodExists = true;
        if (prodData && prodData.length > 0) {
          prodColumns = Object.keys(prodData[0]).length;
        }
      }
    } catch (err) {
      // エラーは無視
    }

    // データがない場合は、カラム数を確認するために別の方法を試す
    if (devExists && devColumns === 0) {
      // テーブルは存在するがデータがない場合、カラム情報を取得する別の方法が必要
      // ここでは簡易的に、テーブルが存在することだけを確認
      devColumns = -1; // データなしを示す
    }
    if (prodExists && prodColumns === 0) {
      prodColumns = -1; // データなしを示す
    }

    const match = devExists === prodExists && (devColumns === prodColumns || (devColumns === -1 && prodColumns === -1));

    results.push({
      table,
      devExists,
      prodExists,
      devColumns,
      prodColumns,
      match,
    });
  }

  // 結果を表示
  console.log('テーブル存在確認結果:');
  console.log('='.repeat(80));
  console.log('テーブル名'.padEnd(30) + '開発環境'.padEnd(15) + '本番環境'.padEnd(15) + '状態');
  console.log('-'.repeat(80));

  let allMatch = true;
  for (const result of results) {
    const devStatus = result.devExists 
      ? (result.devColumns === -1 ? '存在(データなし)' : `${result.devColumns}カラム`)
      : '不存在';
    const prodStatus = result.prodExists 
      ? (result.prodColumns === -1 ? '存在(データなし)' : `${result.prodColumns}カラム`)
      : '不存在';
    const status = result.match ? '✅ 一致' : '❌ 不一致';
    
    if (!result.match) {
      allMatch = false;
    }

    console.log(
      result.table.padEnd(30) + 
      devStatus.padEnd(15) + 
      prodStatus.padEnd(15) + 
      status
    );
  }

  console.log('='.repeat(80));
  
  if (allMatch) {
    console.log('\n✅ すべてのテーブル構造が一致しています！');
  } else {
    console.log('\n⚠️  一部のテーブル構造が一致していません。');
  }

  // カラム構成の詳細比較（主要テーブル）
  console.log('\n\n📋 主要テーブルのカラム構成比較:');
  console.log('='.repeat(80));

  const mainTables = ['users', 'staff', 'facility_settings', 'children', 'leads', 'schedules', 'shifts', 'management_targets'];
  
  for (const table of mainTables) {
    const result = results.find(r => r.table === table);
    if (!result || !result.devExists || !result.prodExists) continue;

    // カラム情報を取得（データがある場合）
    let devCols: string[] = [];
    let prodCols: string[] = [];

    try {
      const { data: devData } = await devSupabase.from(table).select('*').limit(1);
      if (devData && devData.length > 0) {
        devCols = Object.keys(devData[0]).sort();
      }
    } catch (err) {
      // エラーは無視
    }

    try {
      const { data: prodData } = await prodSupabase.from(table).select('*').limit(1);
      if (prodData && prodData.length > 0) {
        prodCols = Object.keys(prodData[0]).sort();
      }
    } catch (err) {
      // エラーは無視
    }

    if (devCols.length > 0 && prodCols.length > 0) {
      const devOnly = devCols.filter(c => !prodCols.includes(c));
      const prodOnly = prodCols.filter(c => !devCols.includes(c));
      
      if (devOnly.length === 0 && prodOnly.length === 0) {
        console.log(`✅ ${table}: ${devCols.length}カラム、完全一致`);
      } else {
        console.log(`❌ ${table}: カラム不一致`);
        if (devOnly.length > 0) {
          console.log(`  開発環境のみ: ${devOnly.join(', ')}`);
        }
        if (prodOnly.length > 0) {
          console.log(`  本番環境のみ: ${prodOnly.join(', ')}`);
        }
      }
    } else if (devCols.length === 0 && prodCols.length === 0) {
      console.log(`⚠️  ${table}: データなし（テーブルは存在）`);
    }
  }
}

verifyAllTables();

