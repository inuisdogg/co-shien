/**
 * データ保存のテストスクリプト
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const facilityId = 'dev-facility-test';

async function testDataSave() {
  console.log('🧪 データ保存のテストを開始します...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`🏢 施設ID: ${facilityId}\n`);

  // 1. 施設設定の保存テスト
  console.log('1️⃣ 施設設定の保存テスト...');
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('facility_settings')
      .upsert({
        facility_id: facilityId,
        facility_name: 'テスト施設（更新）',
        regular_holidays: [0, 6], // 日曜日と土曜日
        custom_holidays: [],
        include_holidays: true,
        business_hours: {
          AM: { start: '09:00', end: '12:00' },
          PM: { start: '13:00', end: '18:00' },
        },
        capacity: {
          AM: 10,
          PM: 10,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'facility_id' })
      .select()
      .single();

    if (settingsError) {
      console.error('  ❌ エラー:', settingsError.message);
    } else {
      console.log('  ✅ 保存成功:', settingsData?.facility_name);
    }
  } catch (error: any) {
    console.error('  ❌ エラー:', error.message);
  }

  // 2. スケジュールの保存テスト
  console.log('\n2️⃣ スケジュールの保存テスト...');
  try {
    // まず児童を取得
    const { data: childrenData } = await supabase
      .from('children')
      .select('id, name')
      .eq('facility_id', facilityId)
      .limit(1)
      .single();

    if (childrenData) {
      const scheduleId = `schedule-test-${Date.now()}`;
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .insert({
          id: scheduleId,
          facility_id: facilityId,
          child_id: childrenData.id,
          child_name: childrenData.name,
          date: new Date().toISOString().split('T')[0],
          slot: 'AM',
          has_pickup: false,
          has_dropoff: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (scheduleError) {
        console.error('  ❌ エラー:', scheduleError.message);
      } else {
        console.log('  ✅ 保存成功:', scheduleData?.child_name, scheduleData?.date);
        
        // 削除（テスト用）
        await supabase.from('schedules').delete().eq('id', scheduleId);
        console.log('  🗑️  テストデータを削除しました');
      }
    } else {
      console.log('  ⚠️  児童データが見つかりません');
    }
  } catch (error: any) {
    console.error('  ❌ エラー:', error.message);
  }

  // 3. リードの保存テスト
  console.log('\n3️⃣ リードの保存テスト...');
  try {
    const leadId = `lead-test-${Date.now()}`;
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .insert({
        id: leadId,
        facility_id: facilityId,
        name: 'テストリード',
        child_name: 'テスト児童',
        status: 'new-inquiry',
        phone: '090-1234-5678',
        email: 'test@example.com',
        address: '東京都テスト区',
        preferred_days: ['月', '水', '金'],
        pickup_option: 'required',
        inquiry_source: 'homepage',
        child_ids: [],
        memo: 'テスト用リード',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (leadError) {
      console.error('  ❌ エラー:', leadError.message);
    } else {
      console.log('  ✅ 保存成功:', leadData?.name);
      
      // 削除（テスト用）
      await supabase.from('leads').delete().eq('id', leadId);
      console.log('  🗑️  テストデータを削除しました');
    }
  } catch (error: any) {
    console.error('  ❌ エラー:', error.message);
  }

  // 4. データ取得テスト
  console.log('\n4️⃣ データ取得テスト...');
  try {
    const { data: facilities, error: fError } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', facilityId)
      .single();
    
    if (fError) {
      console.error('  ❌ 施設取得エラー:', fError.message);
    } else {
      console.log('  ✅ 施設取得成功:', facilities?.name);
    }

    const { data: children, error: cError } = await supabase
      .from('children')
      .select('id, name')
      .eq('facility_id', facilityId)
      .limit(3);
    
    if (cError) {
      console.error('  ❌ 児童取得エラー:', cError.message);
    } else {
      console.log(`  ✅ 児童取得成功: ${children?.length || 0}名`);
      children?.forEach(c => console.log(`     - ${c.name}`));
    }
  } catch (error: any) {
    console.error('  ❌ エラー:', error.message);
  }

  console.log('\n✅ テスト完了');
}

testDataSave();

