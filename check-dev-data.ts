import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  const facilityId = 'dev-facility-test';
  
  console.log('🔍 データベースの状態を確認中...\n');
  
  // 施設確認
  const { data: facility, error: fError } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .single();
  console.log('📋 施設:', facility ? `✅ ${facility.name} (${facility.id})` : '❌ 見つかりません');
  if (fError) console.log('   エラー:', fError.message);
  
  // スタッフ確認
  const { data: staff, error: sError } = await supabase
    .from('staff')
    .select('*')
    .eq('facility_id', facilityId);
  console.log('👥 スタッフ:', staff ? `✅ ${staff.length}名` : '❌ 見つかりません');
  if (sError) console.log('   エラー:', sError.message);
  
  // 児童確認
  const { data: children, error: cError } = await supabase
    .from('children')
    .select('*')
    .eq('facility_id', facilityId);
  console.log('👶 児童:', children ? `✅ ${children.length}名` : '❌ 見つかりません');
  if (cError) console.log('   エラー:', cError.message);
  
  // リード確認
  const { data: leads, error: lError } = await supabase
    .from('leads')
    .select('*')
    .eq('facility_id', facilityId);
  console.log('📞 リード:', leads ? `✅ ${leads.length}件` : '❌ 見つかりません');
  if (lError) console.log('   エラー:', lError.message);
  
  // 施設設定確認
  const { data: settings, error: setError } = await supabase
    .from('facility_settings')
    .select('*')
    .eq('facility_id', facilityId)
    .single();
  console.log('⚙️  施設設定:', settings ? `✅ ${settings.facility_name || '設定あり'}` : '❌ 見つかりません');
  if (setError) console.log('   エラー:', setError.message);
}

checkData();
