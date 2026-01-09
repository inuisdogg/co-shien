/**
 * スタッフの重複を解消して10名に絞る
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanupDuplicateStaff() {
  console.log('🧹 スタッフの重複を解消中...');
  
  const facilityId = 'dev-facility-test';
  
  // スタッフデータを取得
  const { data: staffData, error: fetchError } = await supabase
    .from('staff')
    .select('*')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: true });
  
  if (fetchError) {
    console.error('❌ スタッフデータの取得エラー:', fetchError);
    return;
  }
  
  if (!staffData || staffData.length === 0) {
    console.log('⚠️  スタッフデータがありません');
    return;
  }
  
  console.log(`📋 現在のスタッフ数: ${staffData.length}名`);
  
  // 重複をチェック（同じ名前のスタッフを探す）
  const nameCounts: Record<string, number[]> = {};
  staffData.forEach((staff, index) => {
    const name = staff.name || '';
    if (!nameCounts[name]) {
      nameCounts[name] = [];
    }
    nameCounts[name].push(index);
  });
  
  // 重複している名前を表示
  const duplicates: string[] = [];
  Object.keys(nameCounts).forEach(name => {
    if (nameCounts[name].length > 1) {
      duplicates.push(name);
    }
  });
  
  if (duplicates.length > 0) {
    console.log('⚠️  重複している名前:', duplicates.join(', '));
  }
  
  // 最初の10名を残して、残りを削除
  const staffToKeep = staffData.slice(0, 10);
  const staffToDelete = staffData.slice(10);
  
  console.log(`✅ 保持するスタッフ: ${staffToKeep.length}名`);
  console.log(`🗑️  削除するスタッフ: ${staffToDelete.length}名`);
  
  if (staffToDelete.length > 0) {
    const idsToDelete = staffToDelete.map(s => s.id);
    
    // 関連データを削除（employment_records、shifts等）
    console.log('🗑️  関連データを削除中...');
    
    // employment_recordsを削除
    const { error: empError } = await supabase
      .from('employment_records')
      .delete()
      .in('user_id', idsToDelete);
    
    if (empError) {
      console.error('⚠️  employment_recordsの削除エラー:', empError);
    }
    
    // shiftsを削除
    const { error: shiftError } = await supabase
      .from('shifts')
      .delete()
      .in('staff_id', idsToDelete);
    
    if (shiftError) {
      console.error('⚠️  shiftsの削除エラー:', shiftError);
    }
    
    // スタッフを削除
    const { error: deleteError } = await supabase
      .from('staff')
      .delete()
      .in('id', idsToDelete);
    
    if (deleteError) {
      console.error('❌ スタッフの削除エラー:', deleteError);
      return;
    }
    
    console.log(`✅ ${staffToDelete.length}名のスタッフを削除しました`);
  }
  
  // 最終的なスタッフ数を確認
  const { data: finalStaff, error: finalError } = await supabase
    .from('staff')
    .select('id, name')
    .eq('facility_id', facilityId);
  
  if (!finalError && finalStaff) {
    console.log(`📊 最終的なスタッフ数: ${finalStaff.length}名`);
    console.log('スタッフ一覧:');
    finalStaff.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (ID: ${s.id})`);
    });
  }
}

cleanupDuplicateStaff();

