/**
 * 全データの確認スクリプト
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const facilityId = 'dev-facility-test';

async function verifyAllData() {
  console.log('🔍 全データの確認を開始します...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`🏢 施設ID: ${facilityId}\n`);

  // 施設
  console.log('📋 施設:');
  const { data: facilities } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', facilityId);
  console.log(`  ${facilities?.length || 0}件`);
  facilities?.forEach(f => console.log(`    - ${f.name} (${f.id}, code: ${f.code})`));

  // 施設設定
  console.log('\n⚙️  施設設定:');
  const { data: settings } = await supabase
    .from('facility_settings')
    .select('*')
    .eq('facility_id', facilityId)
    .single();
  if (settings) {
    console.log(`  ✅ 設定あり: ${settings.facility_name || '未設定'}`);
    console.log(`     定員: 午前${settings.capacity?.AM || 0}名 / 午後${settings.capacity?.PM || 0}名`);
  } else {
    console.log('  ❌ 設定なし');
  }

  // 児童
  console.log('\n👶 利用児童:');
  const { data: children } = await supabase
    .from('children')
    .select('id, name')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false });
  console.log(`  ${children?.length || 0}名`);
  children?.slice(0, 5).forEach(c => console.log(`    - ${c.name}`));
  if (children && children.length > 5) {
    console.log(`    ... 他${children.length - 5}名`);
  }

  // スタッフ
  console.log('\n👥 スタッフ:');
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false });
  console.log(`  ${staff?.length || 0}名`);
  staff?.slice(0, 5).forEach(s => console.log(`    - ${s.name}`));
  if (staff && staff.length > 5) {
    console.log(`    ... 他${staff.length - 5}名`);
  }

  // スケジュール
  console.log('\n📅 スケジュール:');
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('facility_id', facilityId)
    .order('date', { ascending: false })
    .limit(10);
  console.log(`  ${schedules?.length || 0}件`);
  schedules?.forEach(s => {
    console.log(`    - ${s.date} ${s.slot}: ${s.child_name}`);
  });

  // リード
  console.log('\n📞 リード:');
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(`  ${leads?.length || 0}件`);
  leads?.forEach(l => {
    console.log(`    - ${l.name} (${l.status}): ${l.child_name || '未設定'}`);
  });

  // シフト
  console.log('\n🕐 シフト:');
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('facility_id', facilityId)
    .limit(10);
  console.log(`  ${shifts?.length || 0}件`);
  if (shifts && shifts.length > 0) {
    const shiftDates = new Set(shifts.map(s => s.date));
    console.log(`    日付: ${Array.from(shiftDates).slice(0, 5).join(', ')}`);
  }

  console.log('\n✅ 確認完了');
}

verifyAllData();

