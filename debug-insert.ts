import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const facilityId = 'dev-facility-test';
  
  console.log('🧪 テスト挿入を実行...\n');
  
  // 施設を直接挿入
  const { data: facility, error: fError } = await supabase
    .from('facilities')
    .insert({
      id: facilityId,
      name: 'テスト施設',
      code: 'TEST',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (fError) {
    console.log('❌ 施設挿入エラー:', fError);
  } else {
    console.log('✅ 施設挿入成功:', facility);
  }
  
  // 確認
  const { data: checkFacility } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .single();
  
  console.log('\n📋 確認結果:', checkFacility ? `✅ ${checkFacility.name}` : '❌ 見つかりません');
}

testInsert();
