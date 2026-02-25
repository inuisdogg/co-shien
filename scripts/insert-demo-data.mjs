import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const FACILITY_ID = 'facility-1770623012121';
const OWNER_USER_ID = 'c6f4c329-17e6-4fcc-a1de-28cfbe08b504';

// Generate password hash once
const passwordHash = bcrypt.hashSync('demo1234', 10);
console.log('Password hash generated:', passwordHash.substring(0, 20) + '...');

// Helper: log results
function logResult(label, data, error) {
  if (error) {
    console.error(`  [ERROR] ${label}:`, error.message, error.details || '');
  } else {
    const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
    console.log(`  [OK] ${label}: ${count} record(s)`);
  }
}

async function main() {
  // ==========================================
  // 1. STAFF USERS
  // ==========================================
  console.log('\n=== 1. Inserting Staff Users ===');
  
  const staffUsers = [
    {
      id: 'demo-staff-1',
      name: '山田 花子',
      email: 'yamada@demo.roots.jp',
      login_id: 'yamada@demo.roots.jp',
      password_hash: passwordHash,
      role: 'manager',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'active',
      has_account: true,
      last_name: '山田',
      first_name: '花子',
      last_name_kana: 'ヤマダ',
      first_name_kana: 'ハナコ',
      gender: 'female',
      birth_date: '1985-04-15',
    },
    {
      id: 'demo-staff-2',
      name: '佐藤 太郎',
      email: 'sato@demo.roots.jp',
      login_id: 'sato@demo.roots.jp',
      password_hash: passwordHash,
      role: 'staff',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'active',
      has_account: true,
      last_name: '佐藤',
      first_name: '太郎',
      last_name_kana: 'サトウ',
      first_name_kana: 'タロウ',
      gender: 'male',
      birth_date: '1990-08-22',
    },
    {
      id: 'demo-staff-3',
      name: '鈴木 美咲',
      email: 'suzuki@demo.roots.jp',
      login_id: 'suzuki@demo.roots.jp',
      password_hash: passwordHash,
      role: 'staff',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'active',
      has_account: true,
      last_name: '鈴木',
      first_name: '美咲',
      last_name_kana: 'スズキ',
      first_name_kana: 'ミサキ',
      gender: 'female',
      birth_date: '1992-11-03',
    },
    {
      id: 'demo-staff-4',
      name: '田中 健一',
      email: 'tanaka@demo.roots.jp',
      login_id: 'tanaka@demo.roots.jp',
      password_hash: passwordHash,
      role: 'staff',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'active',
      has_account: true,
      last_name: '田中',
      first_name: '健一',
      last_name_kana: 'タナカ',
      first_name_kana: 'ケンイチ',
      gender: 'male',
      birth_date: '1988-02-28',
    },
    {
      id: 'demo-staff-5',
      name: '高橋 愛',
      email: 'takahashi@demo.roots.jp',
      login_id: 'takahashi@demo.roots.jp',
      password_hash: passwordHash,
      role: 'staff',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'active',
      has_account: true,
      last_name: '高橋',
      first_name: '愛',
      last_name_kana: 'タカハシ',
      first_name_kana: 'アイ',
      gender: 'female',
      birth_date: '1995-06-10',
    },
  ];

  for (const user of staffUsers) {
    const { data, error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'id' })
      .select();
    logResult(`Staff: ${user.name}`, data, error);
  }

  // ==========================================
  // 2. EMPLOYMENT RECORDS
  // ==========================================
  console.log('\n=== 2. Inserting Employment Records ===');

  // Owner already has an employment record, so we skip that one
  // but update it if needed
  console.log('  [SKIP] Owner employment record already exists');

  const employmentRecords = [
    {
      id: 'demo-emp-1',
      user_id: 'demo-staff-1',
      facility_id: FACILITY_ID,
      start_date: '2025-04-01',
      end_date: null,
      role: 'マネージャー',
      employment_type: '常勤',
    },
    {
      id: 'demo-emp-2',
      user_id: 'demo-staff-2',
      facility_id: FACILITY_ID,
      start_date: '2025-04-01',
      end_date: null,
      role: '一般スタッフ',
      employment_type: '常勤',
    },
    {
      id: 'demo-emp-3',
      user_id: 'demo-staff-3',
      facility_id: FACILITY_ID,
      start_date: '2025-06-01',
      end_date: null,
      role: '一般スタッフ',
      employment_type: '常勤',
    },
    {
      id: 'demo-emp-4',
      user_id: 'demo-staff-4',
      facility_id: FACILITY_ID,
      start_date: '2025-04-01',
      end_date: null,
      role: '一般スタッフ',
      employment_type: '非常勤',
    },
    {
      id: 'demo-emp-5',
      user_id: 'demo-staff-5',
      facility_id: FACILITY_ID,
      start_date: '2025-09-01',
      end_date: null,
      role: '一般スタッフ',
      employment_type: '非常勤',
    },
  ];

  for (const emp of employmentRecords) {
    const { data, error } = await supabase
      .from('employment_records')
      .upsert(emp, { onConflict: 'id' })
      .select();
    logResult(`Employment: ${emp.id}`, data, error);
  }

  // ==========================================
  // 3. CHILDREN (no gender column in actual DB)
  // ==========================================
  console.log('\n=== 3. Inserting Children ===');

  const children = [
    {
      id: 'demo-child-1',
      facility_id: FACILITY_ID,
      name: '木村 翔太',
      name_kana: 'キムラ ショウタ',
      birth_date: '2019-05-12',
      guardian_name: '木村 由美',
      phone: '090-1111-2222',
      email: 'kimura@demo.roots.jp',
      beneficiary_number: '1234567890',
      contract_status: 'active',
      contract_start_date: '2025-04-01',
      characteristics: '発達障害',
    },
    {
      id: 'demo-child-2',
      facility_id: FACILITY_ID,
      name: '中村 さくら',
      name_kana: 'ナカムラ サクラ',
      birth_date: '2020-03-25',
      guardian_name: '中村 理恵',
      phone: '090-2222-3333',
      email: 'nakamura@demo.roots.jp',
      beneficiary_number: '2345678901',
      contract_status: 'active',
      contract_start_date: '2025-04-01',
      characteristics: '知的障害',
    },
    {
      id: 'demo-child-3',
      facility_id: FACILITY_ID,
      name: '小林 大輝',
      name_kana: 'コバヤシ ダイキ',
      birth_date: '2018-09-08',
      guardian_name: '小林 真理',
      phone: '090-3333-4444',
      email: 'kobayashi@demo.roots.jp',
      beneficiary_number: '3456789012',
      contract_status: 'active',
      contract_start_date: '2025-04-01',
      characteristics: '自閉スペクトラム症',
    },
    {
      id: 'demo-child-4',
      facility_id: FACILITY_ID,
      name: '渡辺 結衣',
      name_kana: 'ワタナベ ユイ',
      birth_date: '2020-12-17',
      guardian_name: '渡辺 健太',
      phone: '090-4444-5555',
      email: 'watanabe@demo.roots.jp',
      beneficiary_number: '4567890123',
      contract_status: 'active',
      contract_start_date: '2025-06-01',
      characteristics: 'ADHD',
    },
    {
      id: 'demo-child-5',
      facility_id: FACILITY_ID,
      name: '伊藤 陽翔',
      name_kana: 'イトウ ハルト',
      birth_date: '2019-07-30',
      guardian_name: '伊藤 美穂',
      phone: '090-5555-6666',
      email: 'ito@demo.roots.jp',
      beneficiary_number: '5678901234',
      contract_status: 'active',
      contract_start_date: '2025-04-01',
      characteristics: 'ダウン症',
    },
    {
      id: 'demo-child-6',
      facility_id: FACILITY_ID,
      name: '松本 美月',
      name_kana: 'マツモト ミヅキ',
      birth_date: '2021-01-20',
      guardian_name: '松本 浩二',
      phone: '090-6666-7777',
      email: 'matsumoto@demo.roots.jp',
      beneficiary_number: '6789012345',
      contract_status: 'active',
      contract_start_date: '2025-09-01',
      characteristics: '肢体不自由',
    },
    {
      id: 'demo-child-7',
      facility_id: FACILITY_ID,
      name: '井上 蓮',
      name_kana: 'イノウエ レン',
      birth_date: '2018-04-04',
      guardian_name: '井上 幸子',
      phone: '090-7777-8888',
      email: 'inoue@demo.roots.jp',
      beneficiary_number: '7890123456',
      contract_status: 'active',
      contract_start_date: '2025-04-01',
      characteristics: '発達障害',
    },
    {
      id: 'demo-child-8',
      facility_id: FACILITY_ID,
      name: '山本 凛',
      name_kana: 'ヤマモト リン',
      birth_date: '2020-08-15',
      guardian_name: '山本 大介',
      phone: '090-8888-9999',
      email: 'yamamoto@demo.roots.jp',
      beneficiary_number: '8901234567',
      contract_status: 'active',
      contract_start_date: '2025-10-01',
      characteristics: '言語障害',
    },
  ];

  for (const child of children) {
    const { data, error } = await supabase
      .from('children')
      .upsert(child, { onConflict: 'id' })
      .select();
    logResult(`Child: ${child.name}`, data, error);
  }

  // ==========================================
  // 4. FACILITY SETTINGS
  // ==========================================
  console.log('\n=== 4. Upserting Facility Settings ===');

  const facilitySettings = {
    facility_id: FACILITY_ID,
    facility_name: 'pocopoco',
    service_type_code: 'jidou_hattatsu',
    regional_grade: '3',
    capacity: { am: 10, pm: 10 },
    business_hours: {
      am: { start: '09:00', end: '12:00' },
      pm: { start: '13:00', end: '17:00' },
    },
    latitude: 35.6762,
    longitude: 139.6503,
    geofence_radius_meters: 500,
  };

  const { data: fsData, error: fsError } = await supabase
    .from('facility_settings')
    .upsert(facilitySettings, { onConflict: 'facility_id' })
    .select();
  logResult('Facility Settings', fsData, fsError);

  // ==========================================
  // 5. SCHEDULES (bigint IDs)
  // ==========================================
  console.log('\n=== 5. Inserting Schedules ===');

  // Compute today and next 5 weekdays
  const today = new Date('2026-02-25');
  const weekdays = [];
  let d = new Date(today);
  while (weekdays.length < 6) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      weekdays.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  // First, delete any existing demo schedules (IDs in our range 2026022500XX)
  // We'll use IDs derived from date + child index: YYYYMMDDCC where CC is child+slot combo
  // e.g., 2026022511 = 2026-02-25 child1 AM(1), 2026022512 = child1 PM(2)

  // Child slot assignments per day
  const childSlotPatterns = [
    // Day 0 (Wed 2/25): 6 children
    [
      { childIdx: 0, slot: 'AM' },
      { childIdx: 1, slot: 'AM' },
      { childIdx: 2, slot: 'PM' },
      { childIdx: 3, slot: 'AM' },
      { childIdx: 5, slot: 'PM' },
      { childIdx: 7, slot: 'PM' },
    ],
    // Day 1 (Thu 2/26): 5 children
    [
      { childIdx: 0, slot: 'PM' },
      { childIdx: 2, slot: 'AM' },
      { childIdx: 4, slot: 'AM' },
      { childIdx: 5, slot: 'PM' },
      { childIdx: 6, slot: 'AM' },
    ],
    // Day 2 (Fri 2/27): 6 children
    [
      { childIdx: 1, slot: 'PM' },
      { childIdx: 2, slot: 'PM' },
      { childIdx: 3, slot: 'AM' },
      { childIdx: 4, slot: 'PM' },
      { childIdx: 6, slot: 'AM' },
      { childIdx: 7, slot: 'AM' },
    ],
    // Day 3 (Mon 3/2): 5 children
    [
      { childIdx: 0, slot: 'AM' },
      { childIdx: 1, slot: 'AM' },
      { childIdx: 3, slot: 'PM' },
      { childIdx: 5, slot: 'AM' },
      { childIdx: 7, slot: 'PM' },
    ],
    // Day 4 (Tue 3/3): 6 children
    [
      { childIdx: 0, slot: 'PM' },
      { childIdx: 1, slot: 'PM' },
      { childIdx: 2, slot: 'AM' },
      { childIdx: 4, slot: 'AM' },
      { childIdx: 6, slot: 'PM' },
      { childIdx: 7, slot: 'AM' },
    ],
    // Day 5 (Wed 3/4): 5 children
    [
      { childIdx: 1, slot: 'AM' },
      { childIdx: 3, slot: 'PM' },
      { childIdx: 4, slot: 'AM' },
      { childIdx: 5, slot: 'PM' },
      { childIdx: 6, slot: 'AM' },
    ],
  ];

  // Use auto-generated IDs by omitting the id field, but we need upsert capability.
  // Since schedules ID is bigint (auto-increment), we'll delete existing demo schedules first,
  // then insert fresh ones.

  // Delete any previously inserted demo schedules by checking child_id pattern
  const demoChildIds = children.map(c => c.id);
  console.log('  Cleaning up any existing demo schedules...');
  const { error: delErr } = await supabase
    .from('schedules')
    .delete()
    .in('child_id', demoChildIds);
  if (delErr) {
    console.error('  [ERROR] Cleanup:', delErr.message);
  } else {
    console.log('  [OK] Cleanup done');
  }

  for (let dayIdx = 0; dayIdx < weekdays.length; dayIdx++) {
    const dateStr = weekdays[dayIdx].toISOString().slice(0, 10);
    const assignments = childSlotPatterns[dayIdx];

    for (const assignment of assignments) {
      const child = children[assignment.childIdx];
      const childNum = assignment.childIdx + 1;

      const schedule = {
        facility_id: FACILITY_ID,
        child_id: child.id,
        child_name: child.name,
        date: dateStr,
        slot: assignment.slot,
        has_pickup: childNum % 2 === 1,
        has_dropoff: childNum % 3 === 0,
      };

      const { data, error } = await supabase
        .from('schedules')
        .insert(schedule)
        .select();
      logResult(`Schedule: ${dateStr} ${child.name} ${assignment.slot}`, data, error);
    }
  }

  // ==========================================
  // 6. PARENT USERS
  // ==========================================
  console.log('\n=== 6. Inserting Parent Users ===');

  const parentUsers = [
    {
      id: 'demo-parent-1',
      name: '木村 由美',
      email: 'kimura-parent@demo.roots.jp',
      login_id: 'kimura-parent@demo.roots.jp',
      password_hash: passwordHash,
      role: 'client',
      user_type: 'client',
      last_name: '木村',
      first_name: '由美',
      phone: '090-1111-2222',
      account_status: 'active',
      has_account: true,
    },
    {
      id: 'demo-parent-2',
      name: '中村 理恵',
      email: 'nakamura-parent@demo.roots.jp',
      login_id: 'nakamura-parent@demo.roots.jp',
      password_hash: passwordHash,
      role: 'client',
      user_type: 'client',
      last_name: '中村',
      first_name: '理恵',
      phone: '090-2222-3333',
      account_status: 'active',
      has_account: true,
    },
    {
      id: 'demo-parent-3',
      name: '小林 真理',
      email: 'kobayashi-parent@demo.roots.jp',
      login_id: 'kobayashi-parent@demo.roots.jp',
      password_hash: passwordHash,
      role: 'client',
      user_type: 'client',
      last_name: '小林',
      first_name: '真理',
      phone: '090-3333-4444',
      account_status: 'active',
      has_account: true,
    },
  ];

  for (const parent of parentUsers) {
    const { data, error } = await supabase
      .from('users')
      .upsert(parent, { onConflict: 'id' })
      .select();
    logResult(`Parent: ${parent.name}`, data, error);
  }

  // ==========================================
  // 6b. Link children to parent users (owner_profile_id)
  // ==========================================
  console.log('\n=== 6b. Linking Children to Parents ===');

  const childParentLinks = [
    { childId: 'demo-child-1', parentId: 'demo-parent-1' },
    { childId: 'demo-child-2', parentId: 'demo-parent-2' },
    { childId: 'demo-child-3', parentId: 'demo-parent-3' },
  ];

  for (const link of childParentLinks) {
    const { data, error } = await supabase
      .from('children')
      .update({ owner_profile_id: link.parentId })
      .eq('id', link.childId)
      .select('id, name, owner_profile_id');
    logResult(`Link: ${link.childId} -> ${link.parentId}`, data, error);
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n========================================');
  console.log('=== DEMO DATA INSERTION COMPLETE ===');
  console.log('========================================');
  console.log('\nSummary:');
  console.log('  - 5 staff users (demo-staff-1 to demo-staff-5)');
  console.log('  - 5 employment records (demo-emp-1 to demo-emp-5)');
  console.log('  - 8 children (demo-child-1 to demo-child-8)');
  console.log('  - 1 facility settings record');
  console.log('  - 33 schedule records across 6 weekdays');
  console.log('  - 3 parent users (demo-parent-1 to demo-parent-3)');
  console.log('  - 3 child-parent links');
  console.log('\nLogin credentials for all demo users:');
  console.log('  Password: demo1234');
  console.log('  Staff emails: yamada@, sato@, suzuki@, tanaka@, takahashi@ @demo.roots.jp');
  console.log('  Parent emails: kimura-parent@, nakamura-parent@, kobayashi-parent@ @demo.roots.jp');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
