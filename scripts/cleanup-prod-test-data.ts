/**
 * 本番環境から誤って挿入されたテストデータを削除するスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/cleanup-prod-test-data.ts
 */

import { createClient } from '@supabase/supabase-js';

// 本番環境のSupabase設定（元のgenerate-dev-data.tsにあったデフォルト値）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iskgcqzozsemlmbvubna.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const facilityId = 'dev-facility-test';

async function cleanupProdTestData() {
  console.log('⚠️  本番環境からテストデータを削除します...');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`🏢 削除対象施設ID: ${facilityId}\n`);

  try {
    // 1. 施設設定を削除
    console.log('📋 施設設定を削除中...');
    const { error: settingsError } = await supabase
      .from('facility_settings')
      .delete()
      .eq('facility_id', facilityId);
    
    if (settingsError) {
      console.error('⚠️  施設設定の削除エラー:', settingsError.message);
    } else {
      console.log('✅ 施設設定を削除しました');
    }

    // 2. リードを削除（テーブルが存在する場合）
    console.log('📞 リードを削除中...');
    const { error: leadsError } = await supabase
      .from('leads')
      .delete()
      .eq('facility_id', facilityId);
    
    if (leadsError) {
      if (leadsError.code === 'PGRST205') {
        console.log('ℹ️  leadsテーブルは存在しません（スキップ）');
      } else {
        console.error('⚠️  リードの削除エラー:', leadsError.message);
      }
    } else {
      console.log('✅ リードを削除しました');
    }

    // 3. 利用児童を削除
    console.log('👶 利用児童を削除中...');
    const { data: children, error: childrenSelectError } = await supabase
      .from('children')
      .select('id')
      .eq('facility_id', facilityId);
    
    if (childrenSelectError) {
      console.error('⚠️  利用児童の取得エラー:', childrenSelectError.message);
    } else if (children && children.length > 0) {
      const { error: childrenError } = await supabase
        .from('children')
        .delete()
        .eq('facility_id', facilityId);
      
      if (childrenError) {
        console.error('⚠️  利用児童の削除エラー:', childrenError.message);
      } else {
        console.log(`✅ 利用児童${children.length}名を削除しました`);
      }
    } else {
      console.log('ℹ️  削除対象の利用児童はありませんでした');
    }

    // 4. 雇用記録を削除
    console.log('💼 雇用記録を削除中...');
    const { data: empRecords, error: empSelectError } = await supabase
      .from('employment_records')
      .select('user_id')
      .eq('facility_id', facilityId);
    
    if (empSelectError) {
      console.error('⚠️  雇用記録の取得エラー:', empSelectError.message);
    } else if (empRecords && empRecords.length > 0) {
      const { error: empError } = await supabase
        .from('employment_records')
        .delete()
        .eq('facility_id', facilityId);
      
      if (empError) {
        console.error('⚠️  雇用記録の削除エラー:', empError.message);
      } else {
        console.log(`✅ 雇用記録${empRecords.length}件を削除しました`);
      }
    } else {
      console.log('ℹ️  削除対象の雇用記録はありませんでした');
    }

    // 5. スタッフを削除
    console.log('👥 スタッフを削除中...');
    const { data: staff, error: staffSelectError } = await supabase
      .from('staff')
      .select('user_id')
      .eq('facility_id', facilityId);
    
    if (staffSelectError) {
      console.error('⚠️  スタッフの取得エラー:', staffSelectError.message);
    } else if (staff && staff.length > 0) {
      const userIds = staff.map(s => s.user_id).filter(Boolean);
      
      const { error: staffError } = await supabase
        .from('staff')
        .delete()
        .eq('facility_id', facilityId);
      
      if (staffError) {
        console.error('⚠️  スタッフの削除エラー:', staffError.message);
      } else {
        console.log(`✅ スタッフ${staff.length}名を削除しました`);
      }

      // 6. ユーザーを削除（スタッフに関連するユーザー）
      if (userIds.length > 0) {
        console.log('👤 ユーザーを削除中...');
        const { error: usersError } = await supabase
          .from('users')
          .delete()
          .in('id', userIds);
        
        if (usersError) {
          console.error('⚠️  ユーザーの削除エラー:', usersError.message);
        } else {
          console.log(`✅ ユーザー${userIds.length}名を削除しました`);
        }
      }
    } else {
      console.log('ℹ️  削除対象のスタッフはありませんでした');
    }

    // 7. 施設を削除
    console.log('🏢 施設を削除中...');
    const { error: facilityError } = await supabase
      .from('facilities')
      .delete()
      .eq('id', facilityId);
    
    if (facilityError) {
      console.error('⚠️  施設の削除エラー:', facilityError.message);
    } else {
      console.log('✅ 施設を削除しました');
    }

    console.log('\n🎉 本番環境のテストデータ削除が完了しました！');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
cleanupProdTestData();

