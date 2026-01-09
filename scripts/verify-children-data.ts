/**
 * 児童データの整合性を確認
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyChildrenData() {
  console.log('🔍 児童データの整合性を確認中...');
  
  const facilityId = 'dev-facility-test';
  
  // 児童データを取得
  const { data: childrenData, error: fetchError } = await supabase
    .from('children')
    .select('id, name, facility_id')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: true });
  
  if (fetchError) {
    console.error('❌ 児童データの取得エラー:', fetchError);
    return;
  }
  
  if (!childrenData || childrenData.length === 0) {
    console.log('⚠️  児童データがありません');
    return;
  }
  
  console.log(`\n📊 児童データ: ${childrenData.length}名`);
  
  // IDの重複をチェック
  const idMap = new Map<string, number>();
  childrenData.forEach(child => {
    idMap.set(child.id, (idMap.get(child.id) || 0) + 1);
  });
  
  const duplicateIds: string[] = [];
  idMap.forEach((count, id) => {
    if (count > 1) {
      duplicateIds.push(id);
    }
  });
  
  if (duplicateIds.length > 0) {
    console.error(`❌ 重複したIDが見つかりました: ${duplicateIds.join(', ')}`);
  } else {
    console.log('✅ IDの重複なし');
  }
  
  // 名前の一覧を表示
  console.log('\n📋 児童一覧:');
  childrenData.forEach((child, i) => {
    console.log(`  ${i + 1}. ${child.name} (ID: ${child.id})`);
  });
  
  // 同じ名前の児童が複数いるかチェック
  const nameMap = new Map<string, string[]>();
  childrenData.forEach(child => {
    const name = child.name || '';
    if (!nameMap.has(name)) {
      nameMap.set(name, []);
    }
    nameMap.get(name)!.push(child.id);
  });
  
  const duplicateNames: string[] = [];
  nameMap.forEach((ids, name) => {
    if (ids.length > 1) {
      duplicateNames.push(name);
      console.log(`⚠️  同じ名前の児童が複数います: ${name} (ID: ${ids.join(', ')})`);
    }
  });
  
  if (duplicateNames.length === 0) {
    console.log('✅ 名前の重複なし（すべてユニーク）');
  }
}

verifyChildrenData();

