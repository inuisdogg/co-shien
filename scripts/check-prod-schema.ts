/**
 * 本番環境のスキーマを確認して開発環境と比較
 */

import { createClient } from '@supabase/supabase-js';

const prodUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const devUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const devKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const prodSupabase = createClient(prodUrl, prodKey);
const devSupabase = createClient(devUrl, devKey);

async function checkSchema() {
  console.log('🔍 本番環境と開発環境のスキーマ比較\n');

  // facility_settingsテーブルのカラムを確認
  console.log('📋 facility_settingsテーブルのカラム:');
  
  // 本番環境
  try {
    const { data: prodData, error: prodError } = await prodSupabase
      .from('facility_settings')
      .select('*')
      .limit(1);
    
    if (prodError) {
      console.log('  本番: ❌ エラー -', prodError.message);
    } else if (prodData && prodData.length > 0) {
      console.log('  本番: ✅ カラム:', Object.keys(prodData[0]).join(', '));
    } else {
      console.log('  本番: ⚠️  データなし');
    }
  } catch (err: any) {
    console.log('  本番: ❌ エラー -', err.message);
  }

  // 開発環境
  try {
    const { data: devData, error: devError } = await devSupabase
      .from('facility_settings')
      .select('*')
      .limit(1);
    
    if (devError) {
      console.log('  開発: ❌ エラー -', devError.message);
    } else if (devData && devData.length > 0) {
      console.log('  開発: ✅ カラム:', Object.keys(devData[0]).join(', '));
    } else {
      console.log('  開発: ⚠️  データなし');
    }
  } catch (err: any) {
    console.log('  開発: ❌ エラー -', err.message);
  }

  // management_targetsテーブルのカラムを確認
  console.log('\n📋 management_targetsテーブルのカラム:');
  
  // 本番環境
  try {
    const { data: prodData, error: prodError } = await prodSupabase
      .from('management_targets')
      .select('*')
      .limit(1);
    
    if (prodError) {
      if (prodError.code === 'PGRST205') {
        console.log('  本番: ❌ テーブルが存在しません');
      } else {
        console.log('  本番: ⚠️  エラー -', prodError.message);
      }
    } else if (prodData && prodData.length > 0) {
      console.log('  本番: ✅ カラム:', Object.keys(prodData[0]).join(', '));
    } else {
      console.log('  本番: ⚠️  データなし（テーブルは存在）');
    }
  } catch (err: any) {
    console.log('  本番: ❌ エラー -', err.message);
  }

  // 開発環境
  try {
    const { data: devData, error: devError } = await devSupabase
      .from('management_targets')
      .select('*')
      .limit(1);
    
    if (devError) {
      if (devError.code === 'PGRST205') {
        console.log('  開発: ❌ テーブルが存在しません');
      } else {
        console.log('  開発: ⚠️  エラー -', devError.message);
      }
    } else if (devData && devData.length > 0) {
      console.log('  開発: ✅ カラム:', Object.keys(devData[0]).join(', '));
    } else {
      console.log('  開発: ⚠️  データなし（テーブルは存在）');
    }
  } catch (err: any) {
    console.log('  開発: ❌ エラー -', err.message);
  }
}

checkSchema();

