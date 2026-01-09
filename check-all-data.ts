import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAll() {
  console.log('🔍 全データ確認\n');
  
  // 全施設確認
  const { data: facilities, error: fError } = await supabase
    .from('facilities')
    .select('*');
  console.log('📋 全施設:', facilities ? `${facilities.length}件` : 'エラー');
  if (facilities && facilities.length > 0) {
    facilities.forEach(f => console.log(`   - ${f.id}: ${f.name}`));
  }
  if (fError) console.log('   エラー:', fError.message);
  
  // 全スタッフ確認
  const { data: allStaff, error: sError } = await supabase
    .from('staff')
    .select('*');
  console.log('\n👥 全スタッフ:', allStaff ? `${allStaff.length}名` : 'エラー');
  if (allStaff && allStaff.length > 0) {
    allStaff.slice(0, 5).forEach(s => console.log(`   - ${s.name} (${s.facility_id})`));
  }
  
  // 全児童確認
  const { data: allChildren, error: cError } = await supabase
    .from('children')
    .select('*');
  console.log('\n👶 全児童:', allChildren ? `${allChildren.length}名` : 'エラー');
  if (allChildren && allChildren.length > 0) {
    allChildren.slice(0, 5).forEach(c => console.log(`   - ${c.name} (${c.facility_id})`));
  }
  
  // テーブル一覧確認
  console.log('\n📊 テーブル存在確認:');
  const tables = ['facilities', 'staff', 'children', 'leads', 'facility_settings'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    console.log(`   ${table}: ${error ? '❌ ' + error.message : '✅ 存在'}`);
  }
}

checkAll();
