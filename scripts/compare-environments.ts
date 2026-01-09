/**
 * 本番環境と開発環境のテーブル構造を比較
 */

import { createClient } from '@supabase/supabase-js';

const prodUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const devUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const devKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const prodSupabase = createClient(prodUrl, prodKey);
const devSupabase = createClient(devUrl, devKey);

async function compareEnvironments() {
  console.log('🔍 本番環境と開発環境の比較\n');

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
    console.log(`\n📋 ${table}:`);
    
    // 本番環境
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
      } else {
        console.log(`  本番: ✅ テーブルが存在します`);
      }
    } catch (err: any) {
      console.log(`  本番: ❌ エラー - ${err.message}`);
    }

    // 開発環境
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
      } else {
        console.log(`  開発: ✅ テーブルが存在します`);
      }
    } catch (err: any) {
      console.log(`  開発: ❌ エラー - ${err.message}`);
    }
  }
}

compareEnvironments();

