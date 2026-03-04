/**
 * ひまわり放課後等デイサービス — フルデモデータ投入スクリプト
 *
 * 新施設をゼロから作成し、スタッフ・保護者・児童・スケジュール・
 * 勤怠・有給・シフト・個別支援計画・連絡帳・送迎・規定・資格等
 * すべてのデモデータを投入する
 *
 * Usage: node scripts/seed-himawari-demo.mjs
 * Password: demo1234 (全デモアカウント共通)
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==========================================
// Constants
// ==========================================
const FACILITY_ID = 'facility-himawari-demo';
const OWNER_USER_ID = 'c6f4c329-17e6-4fcc-a1de-28cfbe08b504'; // 畠 昂哉

const passwordHash = bcrypt.hashSync('demo1234', 12);

function log(label, data, error) {
  if (error) {
    console.error(`  ✗ ${label}:`, error.message);
  } else {
    const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
    console.log(`  ✓ ${label} (${count}件)`);
  }
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

// ==========================================
// Main
// ==========================================
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ひまわり放課後等デイサービス デモデータ   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // ==========================================
  // 1. FACILITY
  // ==========================================
  console.log('=== 1. 施設作成 ===');

  const { data: facData, error: facErr } = await supabase
    .from('facilities')
    .upsert({
      id: FACILITY_ID,
      name: 'ひまわり放課後等デイサービス',
      code: 'HIMAWARI',
      owner_user_id: OWNER_USER_ID,
    }, { onConflict: 'id' })
    .select();
  log('施設', facData, facErr);

  // Facility Settings
  const { data: fsData, error: fsErr } = await supabase
    .from('facility_settings')
    .upsert({
      facility_id: FACILITY_ID,
      facility_name: 'ひまわり放課後等デイサービス',
      address: '東京都世田谷区三軒茶屋2-14-10',
      postal_code: '154-0024',
      latitude: 35.6438,
      longitude: 139.6712,
      geofence_radius_meters: 300,
      service_type_code: 'houkago_day',
      regional_grade: '5',
      capacity: { am: 10, pm: 10 },
      business_hours: {
        am: { start: '09:00', end: '12:00' },
        pm: { start: '13:00', end: '17:30' },
      },
      service_hours: {
        am: { start: '09:30', end: '11:30' },
        pm: { start: '13:30', end: '17:00' },
      },
      regular_holidays: [0], // 日曜のみ休み
      transport_capacity: { pickup: 5, dropoff: 5 },
      prescribed_working_hours: 480, // 8時間
      service_categories: {
        afterSchoolDayService: true,
        childDevelopmentSupport: false,
      },
    }, { onConflict: 'facility_id' })
    .select();
  log('施設設定', fsData, fsErr);

  // ==========================================
  // 2. OWNER アクセス権 (employment_records)
  // ==========================================
  console.log('\n=== 2. オーナーアクセス権 ===');

  const { data: ownerEmp, error: ownerEmpErr } = await supabase
    .from('employment_records')
    .upsert({
      id: 'himawari-emp-owner',
      user_id: OWNER_USER_ID,
      facility_id: FACILITY_ID,
      start_date: '2025-04-01',
      end_date: null,
      role: '管理者',
      employment_type: '常勤',
      permissions: {
        schedule: true, children: true, transport: true,
        dailyLog: true, supportPlan: true, incident: true,
        staff: true, shift: true, training: true,
        dashboard: true, profitLoss: true, cashFlow: true,
        expenseManagement: true, management: true,
        facility: true, auditPreparation: true, committee: true,
        documents: true, chat: true, connect: true,
        clientInvitation: true, lead: true,
      },
    }, { onConflict: 'id' })
    .select();
  log('オーナー雇用記録', ownerEmp, ownerEmpErr);

  // ==========================================
  // 3. STAFF USERS (5名)
  // ==========================================
  console.log('\n=== 3. スタッフユーザー作成 ===');

  const staffUsers = [
    {
      id: 'himawari-staff-1',
      name: '石川 真由美', last_name: '石川', first_name: '真由美',
      last_name_kana: 'イシカワ', first_name_kana: 'マユミ',
      email: 'ishikawa@himawari-demo.jp', birth_date: '1982-03-15', gender: 'female',
      role: 'manager',
    },
    {
      id: 'himawari-staff-2',
      name: '上田 拓也', last_name: '上田', first_name: '拓也',
      last_name_kana: 'ウエダ', first_name_kana: 'タクヤ',
      email: 'ueda@himawari-demo.jp', birth_date: '1988-07-22', gender: 'male',
      role: 'staff',
    },
    {
      id: 'himawari-staff-3',
      name: '永田 さやか', last_name: '永田', first_name: 'さやか',
      last_name_kana: 'ナガタ', first_name_kana: 'サヤカ',
      email: 'nagata@himawari-demo.jp', birth_date: '1991-11-08', gender: 'female',
      role: 'staff',
    },
    {
      id: 'himawari-staff-4',
      name: '岡田 健司', last_name: '岡田', first_name: '健司',
      last_name_kana: 'オカダ', first_name_kana: 'ケンジ',
      email: 'okada@himawari-demo.jp', birth_date: '1995-01-30', gender: 'male',
      role: 'staff',
    },
    {
      id: 'himawari-staff-5',
      name: '藤本 千尋', last_name: '藤本', first_name: '千尋',
      last_name_kana: 'フジモト', first_name_kana: 'チヒロ',
      email: 'fujimoto@himawari-demo.jp', birth_date: '1998-05-20', gender: 'female',
      role: 'staff',
    },
  ];

  for (const s of staffUsers) {
    const { data, error } = await supabase.from('users').upsert({
      id: s.id, name: s.name, last_name: s.last_name, first_name: s.first_name,
      last_name_kana: s.last_name_kana, first_name_kana: s.first_name_kana,
      email: s.email, login_id: s.email, password_hash: passwordHash,
      birth_date: s.birth_date, gender: s.gender,
      role: s.role, user_type: 'staff', facility_id: FACILITY_ID,
      account_status: 'active', has_account: true,
      phone: `090-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    }, { onConflict: 'id' }).select();
    log(`スタッフ: ${s.name}`, data, error);
  }

  // ==========================================
  // 4. EMPLOYMENT RECORDS
  // ==========================================
  console.log('\n=== 4. 雇用記録 ===');

  const employments = [
    { id: 'himawari-emp-1', userId: 'himawari-staff-1', start: '2023-04-01', role: 'マネージャー', type: '常勤' },
    { id: 'himawari-emp-2', userId: 'himawari-staff-2', start: '2024-04-01', role: '一般スタッフ', type: '常勤' },
    { id: 'himawari-emp-3', userId: 'himawari-staff-3', start: '2024-10-01', role: '一般スタッフ', type: '常勤' },
    { id: 'himawari-emp-4', userId: 'himawari-staff-4', start: '2025-04-01', role: '一般スタッフ', type: '非常勤' },
    { id: 'himawari-emp-5', userId: 'himawari-staff-5', start: '2025-09-01', role: '一般スタッフ', type: '非常勤' },
  ];

  const allPerms = {
    schedule: true, children: true, dailyLog: true, supportPlan: true,
    staff: true, shift: true, training: true, dashboard: true, facility: true,
    incident: true, documents: true, transport: true, chat: true,
  };

  for (const e of employments) {
    const perms = e.role === 'マネージャー' ? { ...allPerms, profitLoss: true, management: true, cashFlow: true, expenseManagement: true, clientInvitation: true } : allPerms;
    const { data, error } = await supabase.from('employment_records').upsert({
      id: e.id, user_id: e.userId, facility_id: FACILITY_ID,
      start_date: e.start, end_date: null, role: e.role,
      employment_type: e.type, permissions: perms,
    }, { onConflict: 'id' }).select();
    log(`雇用: ${e.userId}`, data, error);
  }

  // staff_profiles table doesn't exist on remote, skip
  console.log('\n=== 5. スタッフプロフィール — スキップ（テーブル未作成） ===');

  // ==========================================
  // 6. STAFF TABLE (staffing view用)
  // ==========================================
  console.log('\n=== 6. staffテーブル（人員配置用） ===');

  const staffRecords = [
    { id: 'himawari-s-1', name: '石川 真由美', name_kana: 'イシカワ マユミ', role: 'マネージャー', type: '常勤', email: 'ishikawa@himawari-demo.jp', birth_date: '1982-03-15', gender: '女性', qualifications: '児童発達支援管理責任者,保育士,社会福祉士', years_of_experience: 20, monthly_salary: 350000 },
    { id: 'himawari-s-2', name: '上田 拓也', name_kana: 'ウエダ タクヤ', role: '一般スタッフ', type: '常勤', email: 'ueda@himawari-demo.jp', birth_date: '1988-07-22', gender: '男性', qualifications: '特別支援学校教諭一種,普通自動車免許', years_of_experience: 13, monthly_salary: 280000 },
    { id: 'himawari-s-3', name: '永田 さやか', name_kana: 'ナガタ サヤカ', role: '一般スタッフ', type: '常勤', email: 'nagata@himawari-demo.jp', birth_date: '1991-11-08', gender: '女性', qualifications: '作業療法士,感覚統合療法認定', years_of_experience: 10, monthly_salary: 300000 },
    { id: 'himawari-s-4', name: '岡田 健司', name_kana: 'オカダ ケンジ', role: '一般スタッフ', type: '非常勤', email: 'okada@himawari-demo.jp', birth_date: '1995-01-30', gender: '男性', qualifications: '認定心理士,普通自動車免許', years_of_experience: 6, hourly_wage: 1350 },
    { id: 'himawari-s-5', name: '藤本 千尋', name_kana: 'フジモト チヒロ', role: '一般スタッフ', type: '非常勤', email: 'fujimoto@himawari-demo.jp', birth_date: '1998-05-20', gender: '女性', qualifications: '音楽療法士(補),普通自動車免許', years_of_experience: 5, hourly_wage: 1250 },
  ];

  for (const s of staffRecords) {
    const { data, error } = await supabase.from('staff').upsert({
      ...s, facility_id: FACILITY_ID,
      phone: `090-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    }, { onConflict: 'id' }).select();
    log(`staff: ${s.name}`, data, error);
  }

  // ==========================================
  // 7. PARENT USERS (5名)
  // ==========================================
  console.log('\n=== 7. 保護者ユーザー作成 ===');

  const parentUsers = [
    { id: 'himawari-parent-1', name: '西村 美香', last_name: '西村', first_name: '美香', last_name_kana: 'ニシムラ', first_name_kana: 'ミカ', email: 'nishimura@himawari-parent.jp', phone: '090-1001-2001' },
    { id: 'himawari-parent-2', name: '加藤 恵子', last_name: '加藤', first_name: '恵子', last_name_kana: 'カトウ', first_name_kana: 'ケイコ', email: 'kato@himawari-parent.jp', phone: '090-1002-2002' },
    { id: 'himawari-parent-3', name: '吉田 裕二', last_name: '吉田', first_name: '裕二', last_name_kana: 'ヨシダ', first_name_kana: 'ユウジ', email: 'yoshida@himawari-parent.jp', phone: '090-1003-2003' },
    { id: 'himawari-parent-4', name: '森田 あゆみ', last_name: '森田', first_name: 'あゆみ', last_name_kana: 'モリタ', first_name_kana: 'アユミ', email: 'morita@himawari-parent.jp', phone: '090-1004-2004' },
    { id: 'himawari-parent-5', name: '斎藤 大輔', last_name: '斎藤', first_name: '大輔', last_name_kana: 'サイトウ', first_name_kana: 'ダイスケ', email: 'saito@himawari-parent.jp', phone: '090-1005-2005' },
  ];

  for (const p of parentUsers) {
    const { data, error } = await supabase.from('users').upsert({
      ...p, login_id: p.email, password_hash: passwordHash,
      role: 'client', user_type: 'client',
      account_status: 'active', has_account: true,
    }, { onConflict: 'id' }).select();
    log(`保護者: ${p.name}`, data, error);
  }

  // ==========================================
  // 8. CHILDREN (8名)
  // ==========================================
  console.log('\n=== 8. 児童作成 ===');

  const children = [
    {
      id: 'himawari-child-1', name: '西村 蒼太', name_kana: 'ニシムラ ソウタ',
      birth_date: '2017-06-12', guardian_name: '西村 美香', guardian_name_kana: 'ニシムラ ミカ',
      guardian_relationship: '母', phone: '090-1001-2001', email: 'nishimura@himawari-parent.jp',
      address: '東京都世田谷区三軒茶屋1-10-5', postal_code: '154-0024',
      beneficiary_number: 'H2706-00001', grant_days: 23, contract_days: 23,
      contract_status: 'active', contract_start_date: '2025-04-01',
      pattern_days: [1, 2, 3, 4, 5], needs_pickup: true, needs_dropoff: true,
      pickup_address: '世田谷区立○○小学校', dropoff_address: '東京都世田谷区三軒茶屋1-10-5',
      school_name: '世田谷区立○○小学校（特別支援学級）',
      characteristics: 'ASD（自閉スペクトラム症）。視覚優位、見通しがあると安定。急な予定変更に弱い。好きなもの：電車、パズル。',
      medical_info: { allergies: ['卵'], medication: '服薬なし', emergency_hospital: '国立成育医療研究センター' },
      owner_profile_id: 'himawari-parent-1',
    },
    {
      id: 'himawari-child-2', name: '加藤 ひなた', name_kana: 'カトウ ヒナタ',
      birth_date: '2018-09-03', guardian_name: '加藤 恵子', guardian_name_kana: 'カトウ ケイコ',
      guardian_relationship: '母', phone: '090-1002-2002', email: 'kato@himawari-parent.jp',
      address: '東京都世田谷区太子堂3-8-2', postal_code: '154-0004',
      beneficiary_number: 'H2709-00002', grant_days: 23, contract_days: 20,
      contract_status: 'active', contract_start_date: '2025-04-01',
      pattern_days: [1, 3, 5], needs_pickup: true, needs_dropoff: true,
      pickup_address: '世田谷区立△△小学校', dropoff_address: '東京都世田谷区太子堂3-8-2',
      school_name: '世田谷区立△△小学校（通常学級・通級利用）',
      characteristics: 'ADHD（注意欠如多動症）。活発で好奇心旺盛。集中力の持続が課題。好きなもの：工作、昆虫。',
      medical_info: { allergies: [], medication: 'コンサータ18mg（朝食後）', emergency_hospital: '世田谷中央病院' },
      owner_profile_id: 'himawari-parent-2',
    },
    {
      id: 'himawari-child-3', name: '吉田 悠真', name_kana: 'ヨシダ ユウマ',
      birth_date: '2016-02-28', guardian_name: '吉田 裕二', guardian_name_kana: 'ヨシダ ユウジ',
      guardian_relationship: '父', phone: '090-1003-2003', email: 'yoshida@himawari-parent.jp',
      address: '東京都世田谷区下馬2-5-11', postal_code: '154-0002',
      beneficiary_number: 'H2702-00003', grant_days: 23, contract_days: 23,
      contract_status: 'active', contract_start_date: '2024-10-01',
      pattern_days: [1, 2, 3, 4, 5], needs_pickup: true, needs_dropoff: true,
      pickup_address: '世田谷区立□□小学校', dropoff_address: '東京都世田谷区下馬2-5-11',
      school_name: '世田谷区立□□小学校（特別支援学級）',
      characteristics: '知的障害（中度）。言語表現は単語レベル、PECSを使用。穏やかな性格。好きなもの：音楽、水遊び。',
      medical_info: { allergies: ['牛乳'], medication: '服薬なし', emergency_hospital: '東邦大学医療センター大橋病院' },
      owner_profile_id: 'himawari-parent-3',
    },
    {
      id: 'himawari-child-4', name: '森田 結菜', name_kana: 'モリタ ユイナ',
      birth_date: '2019-12-05', guardian_name: '森田 あゆみ', guardian_name_kana: 'モリタ アユミ',
      guardian_relationship: '母', phone: '090-1004-2004', email: 'morita@himawari-parent.jp',
      address: '東京都世田谷区若林4-1-7', postal_code: '154-0023',
      beneficiary_number: 'H3112-00004', grant_days: 23, contract_days: 15,
      contract_status: 'active', contract_start_date: '2025-06-01',
      pattern_days: [2, 4], needs_pickup: false, needs_dropoff: true,
      dropoff_address: '東京都世田谷区若林4-1-7',
      school_name: '世田谷区立◇◇幼稚園',
      characteristics: 'ダウン症。おとなしく協調性がある。微細運動に課題。好きなもの：お絵かき、ままごと。',
      medical_info: { allergies: [], medication: '服薬なし', emergency_hospital: '東京医療センター', heart_condition: '心室中隔欠損症（経過観察）' },
      owner_profile_id: 'himawari-parent-4',
    },
    {
      id: 'himawari-child-5', name: '斎藤 陸', name_kana: 'サイトウ リク',
      birth_date: '2018-04-18', guardian_name: '斎藤 大輔', guardian_name_kana: 'サイトウ ダイスケ',
      guardian_relationship: '父', phone: '090-1005-2005', email: 'saito@himawari-parent.jp',
      address: '東京都世田谷区三軒茶屋2-30-8', postal_code: '154-0024',
      beneficiary_number: 'H3004-00005', grant_days: 23, contract_days: 20,
      contract_status: 'active', contract_start_date: '2025-04-01',
      pattern_days: [1, 2, 4, 5], needs_pickup: true, needs_dropoff: true,
      pickup_address: '世田谷区立☆☆小学校', dropoff_address: '東京都世田谷区三軒茶屋2-30-8',
      school_name: '世田谷区立☆☆小学校（特別支援学級）',
      characteristics: 'ASD+ADHD併存。こだわりが強いが知的好奇心旺盛。プログラミングに強い興味。パニック時は静かな場所で落ち着かせる。',
      medical_info: { allergies: ['小麦'], medication: 'ストラテラ25mg（夕食後）', emergency_hospital: '国立成育医療研究センター' },
      owner_profile_id: 'himawari-parent-5',
    },
    {
      id: 'himawari-child-6', name: '西村 彩花', name_kana: 'ニシムラ アヤカ',
      birth_date: '2019-11-22', guardian_name: '西村 美香', guardian_name_kana: 'ニシムラ ミカ',
      guardian_relationship: '母', phone: '090-1001-2001', email: 'nishimura@himawari-parent.jp',
      address: '東京都世田谷区三軒茶屋1-10-5', postal_code: '154-0024',
      beneficiary_number: 'H3111-00006', grant_days: 15, contract_days: 12,
      contract_status: 'active', contract_start_date: '2025-09-01',
      pattern_days: [1, 3, 5], needs_pickup: true, needs_dropoff: true,
      pickup_address: '世田谷区立○○幼稚園', dropoff_address: '東京都世田谷区三軒茶屋1-10-5',
      school_name: '世田谷区立○○幼稚園',
      characteristics: '蒼太の妹。軽度の発達遅延。言語発達がゆっくり。模倣が得意。好きなもの：ダンス、シール。',
      medical_info: { allergies: ['卵'], medication: '服薬なし', emergency_hospital: '国立成育医療研究センター' },
      owner_profile_id: 'himawari-parent-1',
    },
    {
      id: 'himawari-child-7', name: '加藤 大翔', name_kana: 'カトウ ヒロト',
      birth_date: '2020-07-14', guardian_name: '加藤 恵子', guardian_name_kana: 'カトウ ケイコ',
      guardian_relationship: '母', phone: '090-1002-2002', email: 'kato@himawari-parent.jp',
      address: '東京都世田谷区太子堂3-8-2', postal_code: '154-0004',
      beneficiary_number: 'H3207-00007', grant_days: 23, contract_days: 10,
      contract_status: 'active', contract_start_date: '2025-10-01',
      pattern_days: [2, 4], needs_pickup: false, needs_dropoff: true,
      dropoff_address: '東京都世田谷区太子堂3-8-2',
      school_name: '保育園さくらんぼ',
      characteristics: 'ひなたの弟。言語発達遅延の疑いで経過観察中。人懐こく社交的。好きなもの：ボール遊び、車のおもちゃ。',
      medical_info: { allergies: [], medication: '服薬なし', emergency_hospital: '世田谷中央病院' },
      owner_profile_id: 'himawari-parent-2',
    },
    {
      id: 'himawari-child-8', name: '吉田 美咲', name_kana: 'ヨシダ ミサキ',
      birth_date: '2018-01-10', guardian_name: '吉田 裕二', guardian_name_kana: 'ヨシダ ユウジ',
      guardian_relationship: '父', phone: '090-1003-2003', email: 'yoshida@himawari-parent.jp',
      address: '東京都世田谷区下馬2-5-11', postal_code: '154-0002',
      beneficiary_number: 'H3001-00008', grant_days: 23, contract_days: 18,
      contract_status: 'active', contract_start_date: '2025-04-01',
      pattern_days: [1, 3, 4, 5], needs_pickup: true, needs_dropoff: true,
      pickup_address: '世田谷区立□□小学校', dropoff_address: '東京都世田谷区下馬2-5-11',
      school_name: '世田谷区立□□小学校（通常学級・通級利用）',
      characteristics: '悠真の姉。学習障害（LD）。読みに困難あり。計算は得意。友人関係良好。好きなもの：料理、猫。',
      medical_info: { allergies: [], medication: '服薬なし', emergency_hospital: '東邦大学医療センター大橋病院' },
      owner_profile_id: 'himawari-parent-3',
    },
  ];

  for (const c of children) {
    // Remove fields that don't exist in remote DB
    const { medical_info, ...childData } = c;
    const { data, error } = await supabase.from('children').upsert({
      ...childData, facility_id: FACILITY_ID,
      // Store medical info in characteristics
      characteristics: `${c.characteristics}${medical_info ? ` | アレルギー: ${(medical_info.allergies || []).join(',') || 'なし'} | 服薬: ${medical_info.medication || 'なし'}` : ''}`,
    }, { onConflict: 'id' }).select();
    log(`児童: ${c.name}`, data, error);
  }

  // contract_invitations (accepted)
  for (const p of parentUsers) {
    const linkedChildren = children.filter(c => c.owner_profile_id === p.id);
    for (const c of linkedChildren) {
      const { data, error } = await supabase.from('contract_invitations').upsert({
        id: `inv-${c.id}`,
        facility_id: FACILITY_ID,
        child_id: c.id,
        email: p.email,
        invitation_token: crypto.randomUUID(),
        status: 'accepted',
        invited_by: 'himawari-staff-1',
        expires_at: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
      }, { onConflict: 'id' }).select();
      log(`招待: ${c.name} → ${p.name}`, data, error);
    }
  }

  // ==========================================
  // 9. SCHEDULES (今週・来週)
  // ==========================================
  console.log('\n=== 9. スケジュール（2週間分） ===');

  // 今日から14日間のスケジュール
  const today = new Date();
  const scheduleDays = [];
  for (let i = -7; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 6) { // 月〜土
      scheduleDays.push(d);
    }
  }

  // 既存のデモスケジュールを削除
  const demoChildIds = children.map(c => c.id);
  await supabase.from('schedules').delete().in('child_id', demoChildIds);

  let scheduleCount = 0;
  for (const day of scheduleDays) {
    const dow = day.getDay(); // 1=月, 6=土
    const ds = dateStr(day);

    for (const c of children) {
      if (!c.pattern_days.includes(dow)) continue;

      const slot = dow % 2 === 0 ? 'PM' : 'AM'; // 奇数曜日AM、偶数曜日PM（バリエーション）
      const { error } = await supabase.from('schedules').insert({
        facility_id: FACILITY_ID, child_id: c.id, child_name: c.name,
        date: ds, slot,
        has_pickup: c.needs_pickup, has_dropoff: c.needs_dropoff,
      });
      if (!error) scheduleCount++;
    }
  }
  console.log(`  ✓ スケジュール ${scheduleCount}件作成`);

  // ==========================================
  // 10. ATTENDANCE RECORDS (過去1週間)
  // ==========================================
  console.log('\n=== 10. 出退勤記録（過去1週間） ===');

  // attendance_records uses user_id (not staff_id), type='clock_in'/'clock_out'
  const staffUserIds = staffUsers.map(s => s.id);
  const staffIds = staffRecords.map(s => s.id);
  await supabase.from('attendance_records').delete().in('user_id', staffUserIds);

  let attendanceCount = 0;
  for (let i = -7; i <= 0; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (dow === 0) continue; // 日曜休み
    const ds = dateStr(d);

    for (let j = 0; j < staffUsers.length; j++) {
      const userId = staffUsers[j].id;
      // 非常勤は週3日
      if ((j >= 3) && (dow % 2 === 0)) continue;

      const startH = 8 + (j % 2);
      const startM = (j * 3) % 10;
      const endH = 17 + (j % 2);
      const endM = 15 + j * 5;

      const startTime = `${ds}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00+09:00`;
      const endTime = `${ds}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00+09:00`;

      // Insert clock_in record
      const { error: e1 } = await supabase.from('attendance_records').insert({
        facility_id: FACILITY_ID, user_id: userId, date: ds,
        type: 'clock_in', time: startTime, start_time: startTime, end_time: endTime,
      });
      if (!e1) attendanceCount++;
    }
  }
  console.log(`  ✓ 出退勤記録 ${attendanceCount}件作成`);

  // ==========================================
  // 11. PAID LEAVE BALANCES
  // ==========================================
  console.log('\n=== 11. 有給残日数 ===');

  const leaveBalances = [
    { staff_id: 'himawari-staff-1', userId: 'himawari-staff-1', total: 20, used: 8, fiscal_year: 2025 },
    { staff_id: 'himawari-staff-2', userId: 'himawari-staff-2', total: 11, used: 3, fiscal_year: 2025 },
    { staff_id: 'himawari-staff-3', userId: 'himawari-staff-3', total: 10, used: 2, fiscal_year: 2025 },
    { staff_id: 'himawari-staff-4', userId: 'himawari-staff-4', total: 10, used: 1, fiscal_year: 2025 },
    { staff_id: 'himawari-staff-5', userId: 'himawari-staff-5', total: 10, used: 0, fiscal_year: 2025 },
  ];

  for (const lb of leaveBalances) {
    const { data, error } = await supabase.from('paid_leave_balances').upsert({
      id: `plb-${lb.staff_id}`,
      facility_id: FACILITY_ID,
      user_id: lb.userId,
      fiscal_year: lb.fiscal_year,
      total_days: lb.total,
      used_days: lb.used,
      granted_date: '2025-04-01',
      expires_date: '2027-03-31',
    }, { onConflict: 'id' }).select();
    log(`有給: ${lb.staff_id}`, data, error);
  }

  // ==========================================
  // 12. SHIFT PATTERNS
  // ==========================================
  console.log('\n=== 12. シフトパターン ===');

  const shiftPatterns = [
    { id: 'himawari-sp-1', name: '早番', short_name: '早', start_time: '08:00', end_time: '17:00', break_minutes: 60, color: '#22c55e', display_order: 1 },
    { id: 'himawari-sp-2', name: '遅番', short_name: '遅', start_time: '10:00', end_time: '19:00', break_minutes: 60, color: '#3b82f6', display_order: 2 },
    { id: 'himawari-sp-3', name: '日勤', short_name: '日', start_time: '09:00', end_time: '18:00', break_minutes: 60, color: '#00c4cc', display_order: 3 },
    { id: 'himawari-sp-4', name: '半日', short_name: '半', start_time: '13:00', end_time: '17:30', break_minutes: 0, color: '#f59e0b', display_order: 4 },
    { id: 'himawari-sp-5', name: '休み', short_name: '休', start_time: '00:00', end_time: '00:00', break_minutes: 0, color: '#ef4444', display_order: 5, is_day_off: true },
  ];

  for (const sp of shiftPatterns) {
    const { data, error } = await supabase.from('shift_patterns').upsert({
      ...sp, facility_id: FACILITY_ID, is_active: true, is_day_off: sp.is_day_off || false,
    }, { onConflict: 'id' }).select();
    log(`パターン: ${sp.name}`, data, error);
  }

  // ==========================================
  // 13. CONTACT LOGS (連絡帳 — 過去5日分)
  // ==========================================
  console.log('\n=== 13. 連絡帳（過去5日分） ===');

  let contactCount = 0;
  const moods = ['good', 'normal', 'tired', 'excited'];
  const appetites = ['全量', '8割', '5割', '全量'];
  const activities = [
    '個別課題（パズル・プリント学習）、集団SST（挨拶の練習）、自由遊び（ブロック）',
    '感覚統合（トランポリン・バランスボール）、音楽活動（リトミック）、おやつ作り',
    '運動プログラム（サーキット運動）、創作活動（粘土工作）、絵本読み聞かせ',
    '学習支援（宿題サポート）、集団遊び（カードゲーム）、リラクゼーション',
    'SST（買い物ごっこ）、微細運動（ビーズ通し）、音楽セッション（太鼓）',
  ];

  for (let i = -5; i < 0; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0) continue;
    const ds = dateStr(d);

    for (let ci = 0; ci < Math.min(5, children.length); ci++) {
      const child = children[ci];
      const dow = d.getDay();
      if (!child.pattern_days.includes(dow)) continue;

      const staffIdx = (ci + i + 10) % staffRecords.length;
      const { error } = await supabase.from('contact_logs').insert({
        facility_id: FACILITY_ID,
        child_id: child.id,
        date: ds,
        slot: dow % 2 === 0 ? 'PM' : 'AM',
        activities: activities[(ci + Math.abs(i)) % activities.length],
        health_status: 'good',
        mood: moods[(ci + Math.abs(i)) % moods.length],
        appetite: appetites[ci % appetites.length],
        meal_main: true,
        meal_side: ci % 3 !== 0,
        staff_comment: `${child.name}は今日も元気に活動に参加できました。${ci % 2 === 0 ? '特に集中して課題に取り組めていました。' : '友達との関わりも上手にできていました。'}`,
        staff_user_id: staffRecords[staffIdx].id,
        parent_message: ci % 3 === 0 ? '昨夜はよく眠れたようです。朝ごはんもしっかり食べました。' : (ci % 3 === 1 ? '最近家でも「ありがとう」が言えるようになりました。' : null),
        nap_start_time: child.birth_date > '2019-01-01' ? '13:00' : null,
        nap_end_time: child.birth_date > '2019-01-01' ? '14:00' : null,
        toilet_count: Math.floor(Math.random() * 4) + 1,
        status: 'submitted',
      });
      if (!error) contactCount++;
    }
  }
  console.log(`  ✓ 連絡帳 ${contactCount}件作成`);

  // support_plans table doesn't exist on remote, skip
  console.log('\n=== 14. 個別支援計画 — スキップ（テーブル未作成） ===');

  // ==========================================
  // 15. TRANSPORT ASSIGNMENTS (送迎体制 — 今週)
  // ==========================================
  console.log('\n=== 15. 送迎体制（今週分） ===');

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (dow === 0) continue; // 日曜休み
    const ds = dateStr(d);

    const driverIdx = i % 3; // ローテーション
    const attendantIdx = (i + 1) % 3 + 2;

    const { data, error } = await supabase.from('daily_transport_assignments').upsert({
      id: `ta-${ds}`,
      facility_id: FACILITY_ID,
      date: ds,
      pickup_driver_staff_id: staffIds[driverIdx],
      pickup_attendant_staff_id: staffIds[attendantIdx < staffIds.length ? attendantIdx : 0],
      dropoff_driver_staff_id: staffIds[(driverIdx + 1) % 3],
      dropoff_attendant_staff_id: staffIds[attendantIdx < staffIds.length ? attendantIdx : 1],
      pickup_time: '09:00',
      dropoff_time: '17:00',
      vehicle_info: 'トヨタ ハイエース（白）品川 300 あ 1234',
      notes: dow === 6 ? '土曜日のため送迎ルート短縮' : null,
    }, { onConflict: 'id' }).select();
    log(`送迎: ${ds}`, data, error);
  }

  // ==========================================
  // 16. COMPANY REGULATIONS (規定)
  // ==========================================
  console.log('\n=== 16. 規定文書 ===');

  const regulations = [
    { id: 'himawari-reg-1', title: '就業規則', category_code: 'employment_rules', version: '2025年4月改定版', effective_date: '2025-04-01' },
    { id: 'himawari-reg-2', title: '賃金規程', category_code: 'compensation', version: '2025年4月版', effective_date: '2025-04-01' },
    { id: 'himawari-reg-3', title: '育児・介護休業規程', category_code: 'welfare', version: '2024年10月版', effective_date: '2024-10-01' },
    { id: 'himawari-reg-4', title: '安全衛生管理規程', category_code: 'safety', version: '2025年1月版', effective_date: '2025-01-01' },
    { id: 'himawari-reg-5', title: '運営規程', category_code: 'operations', version: '2025年4月版', effective_date: '2025-04-01' },
    { id: 'himawari-reg-6', title: '個人情報保護規程', category_code: 'other', version: '2025年4月版', effective_date: '2025-04-01' },
    { id: 'himawari-reg-7', title: 'ハラスメント防止規程', category_code: 'other', version: '2025年4月版', effective_date: '2025-04-01' },
  ];

  // regulation_categories and company_regulations don't exist on remote, skip
  console.log('  ※ regulation_categories / company_regulations テーブル未作成のためスキップ');

  // Regulation Acknowledgments only (this table exists)
  console.log('  規定確認レコードのみ作成...');
  let ackCount = 0;
  const ackStaff = ['himawari-staff-1', 'himawari-staff-2', 'himawari-staff-3'];
  for (const sid of ackStaff) {
    for (const r of regulations.slice(0, 4)) {
      const { error } = await supabase.from('regulation_acknowledgments').upsert({
        id: `ack-${sid}-${r.id}`,
        regulation_id: r.id, user_id: sid, facility_id: FACILITY_ID,
        acknowledged_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (!error) ackCount++;
    }
  }
  console.log(`  ✓ 規定確認 ${ackCount}件作成`);

  // ==========================================
  // 17. STAFF QUALIFICATIONS (資格管理)
  // ==========================================
  console.log('\n=== 17. 資格管理 ===');

  const qualifications = [
    { userId: 'himawari-staff-1', name: '保育士', code: 'hoikushi', cert: 'H17-12345', issued: '2005-03-20', expiry: null },
    { userId: 'himawari-staff-1', name: '社会福祉士', code: 'shakaifukushishi', cert: 'SW-23456', issued: '2010-03-25', expiry: null },
    { userId: 'himawari-staff-1', name: '児童発達支援管理責任者', code: 'jihatsu_kanri', cert: null, issued: '2015-04-01', expiry: '2026-03-31' },
    { userId: 'himawari-staff-2', name: '特別支援学校教諭一種', code: 'tokushi_kyoyu', cert: 'T24-67890', issued: '2012-03-20', expiry: '2027-03-31' },
    { userId: 'himawari-staff-2', name: '普通自動車第一種運転免許', code: 'driver_license', cert: null, issued: '2008-08-15', expiry: '2028-08-15' },
    { userId: 'himawari-staff-3', name: '作業療法士', code: 'ot', cert: 'OT-34567', issued: '2015-03-25', expiry: null },
    { userId: 'himawari-staff-3', name: '感覚統合療法認定セラピスト', code: 'sensory_integration', cert: null, issued: '2019-07-01', expiry: '2026-06-30' },
    { userId: 'himawari-staff-4', name: '普通自動車第一種運転免許', code: 'driver_license', cert: null, issued: '2015-03-10', expiry: '2027-03-10' },
    { userId: 'himawari-staff-5', name: '普通自動車第一種運転免許', code: 'driver_license', cert: null, issued: '2018-06-20', expiry: '2028-06-20' },
  ];

  for (let qi = 0; qi < qualifications.length; qi++) {
    const q = qualifications[qi];
    const { data, error } = await supabase.from('staff_qualifications').upsert({
      id: `sq-${qi + 1}`, user_id: q.userId, facility_id: FACILITY_ID,
      qualification_name: q.name, qualification_code: q.code,
      certificate_number: q.cert, issued_date: q.issued,
      expiry_date: q.expiry, status: 'active',
    }, { onConflict: 'id' }).select();
    log(`資格: ${q.name} (${q.userId})`, data, error);
  }

  // ==========================================
  // 18. BCP PLANS
  // ==========================================
  console.log('\n=== 18. BCP計画 ===');

  const bcpPlans = [
    { id: 'bcp-earthquake', plan_type: '地震', title: '地震発生時の事業継続計画', next_review: '2026-04-01' },
    { id: 'bcp-flood', plan_type: '水害', title: '水害発生時の事業継続計画', next_review: '2026-04-01' },
    { id: 'bcp-pandemic', plan_type: '感染症', title: '感染症蔓延時の事業継続計画', next_review: '2026-06-01' },
    { id: 'bcp-fire', plan_type: '火災', title: '火災発生時の事業継続計画', next_review: '2026-04-01' },
  ];

  for (const bcp of bcpPlans) {
    const { data, error } = await supabase.from('bcp_plans').upsert({
      id: bcp.id, facility_id: FACILITY_ID,
      plan_type: bcp.plan_type, title: bcp.title,
      content: { overview: `${bcp.plan_type}発生時の対応手順`, last_drill: '2025-12-15', evacuation_route: '正面玄関→駐車場→三軒茶屋公園' },
      version: '1.0', status: 'active',
      last_reviewed_at: '2025-12-15T00:00:00Z',
      next_review_date: bcp.next_review,
      created_by: 'himawari-staff-1',
    }, { onConflict: 'id' }).select();
    log(`BCP: ${bcp.title}`, data, error);
  }

  // BCP Emergency Contacts
  const emergencyContacts = [
    { name: '石川 真由美', role: '施設管理者', phone: '090-1111-0001', priority: 1 },
    { name: '上田 拓也', role: '副管理者', phone: '090-1111-0002', priority: 2 },
    { name: '世田谷消防署', role: '消防', phone: '03-3411-0119', priority: 3 },
    { name: '世田谷区役所 障害福祉課', role: '行政', phone: '03-5432-2388', priority: 4 },
    { name: '国立成育医療研究センター', role: '医療機関', phone: '03-3416-0181', priority: 5 },
  ];

  for (let i = 0; i < emergencyContacts.length; i++) {
    const ec = emergencyContacts[i];
    const { data, error } = await supabase.from('bcp_emergency_contacts').upsert({
      id: `ec-${i + 1}`, facility_id: FACILITY_ID, bcp_plan_id: 'bcp-earthquake',
      contact_name: ec.name, role: ec.role, phone: ec.phone, priority: ec.priority,
    }, { onConflict: 'id' }).select();
    log(`緊急連絡先: ${ec.name}`, data, error);
  }

  // ==========================================
  // 19. ABUSE PREVENTION RECORDS
  // ==========================================
  console.log('\n=== 19. 虐待防止記録 ===');

  const abuseRecords = [
    { id: 'ap-1', type: 'committee', title: '第1回虐待防止委員会', date: '2025-07-15', participants: ['石川 真由美', '上田 拓也', '永田 さやか'] },
    { id: 'ap-2', type: 'committee', title: '第2回虐待防止委員会', date: '2025-10-15', participants: ['石川 真由美', '上田 拓也', '永田 さやか', '岡田 健司'] },
    { id: 'ap-3', type: 'committee', title: '第3回虐待防止委員会', date: '2026-01-20', participants: ['石川 真由美', '上田 拓也', '永田 さやか', '岡田 健司', '藤本 千尋'] },
    { id: 'ap-4', type: 'restraint', title: '身体拘束適正化委員会（第1回）', date: '2025-08-20', participants: ['石川 真由美', '永田 さやか'] },
    { id: 'ap-5', type: 'restraint', title: '身体拘束適正化委員会（第2回）', date: '2025-11-18', participants: ['石川 真由美', '永田 さやか', '上田 拓也'] },
  ];

  for (const ar of abuseRecords) {
    const { data, error } = await supabase.from('abuse_prevention_records').upsert({
      id: ar.id, facility_id: FACILITY_ID,
      record_type: ar.type, title: ar.title,
      date: ar.date, participants: ar.participants,
      content: { summary: `${ar.title}の議事録概要。各委員から意見を聴取し、今後の方針を決定した。`, decisions: ['研修計画の見直し', 'チェックリストの更新'] },
      status: 'completed', created_by: 'himawari-staff-1',
    }, { onConflict: 'id' }).select();
    log(`虐待防止: ${ar.title}`, data, error);
  }

  // ==========================================
  // 20. OVERTIME AGREEMENT (36協定)
  // ==========================================
  console.log('\n=== 20. 36協定 ===');

  const { data: oaData, error: oaErr } = await supabase.from('overtime_agreements').upsert({
    id: 'oa-himawari-2025',
    facility_id: FACILITY_ID,
    fiscal_year: 2025,
    monthly_limit_hours: 45,
    annual_limit_hours: 360,
    special_monthly_limit: 80,
    special_months_limit: 6,
    effective_from: '2025-04-01',
    effective_to: '2026-03-31',
  }, { onConflict: 'id' }).select();
  log('36協定', oaData, oaErr);

  // ==========================================
  // 21. TRAINING RECORDS (研修記録)
  // ==========================================
  console.log('\n=== 21. 研修記録 ===');

  const trainings = [
    { id: 'tr-1', title: '虐待防止研修（全体）', date: '2025-05-20', type: 'internal', participants: staffRecords.map(s => s.name) },
    { id: 'tr-2', title: '感染症対策研修', date: '2025-06-15', type: 'internal', participants: staffRecords.map(s => s.name) },
    { id: 'tr-3', title: 'ASD児への支援技法', date: '2025-09-10', type: 'external', participants: ['上田 拓也', '岡田 健司'] },
    { id: 'tr-4', title: '救命救急講習（普通）', date: '2025-10-22', type: 'external', participants: ['上田 拓也', '永田 さやか', '藤本 千尋'] },
    { id: 'tr-5', title: '個別支援計画作成研修', date: '2025-11-18', type: 'internal', participants: ['石川 真由美', '上田 拓也', '永田 さやか'] },
    { id: 'tr-6', title: '安全運転講習', date: '2026-01-15', type: 'external', participants: ['上田 拓也', '岡田 健司', '藤本 千尋'] },
  ];

  for (const t of trainings) {
    const { data, error } = await supabase.from('training_records').upsert({
      id: t.id, facility_id: FACILITY_ID,
      title: t.title, training_date: t.date,
      training_type: t.type,
      description: `${t.title}を実施。参加者${t.participants.length}名。`,
      participants: t.participants.map(name => ({ name, attended: true })),
      status: 'completed',
      created_by: 'himawari-staff-1',
    }, { onConflict: 'id' }).select();
    log(`研修: ${t.title}`, data, error);
  }

  // ==========================================
  // 22. CAREER DEVELOPMENT RECORDS
  // ==========================================
  console.log('\n=== 22. キャリア開発記録 ===');

  const careerRecords = [
    { userId: 'himawari-staff-1', type: 'promotion', title: 'マネージャー昇格', date: '2023-04-01', desc: '児童発達支援管理責任者としての実績を評価され、施設マネージャーに昇格' },
    { userId: 'himawari-staff-1', type: 'qualification', title: '相談支援専門員取得', date: '2018-09-01', desc: '相談支援専門員研修を修了し資格取得' },
    { userId: 'himawari-staff-2', type: 'training', title: 'ペアレントトレーニング指導者養成研修修了', date: '2021-11-20', desc: '3日間の集中研修を修了' },
    { userId: 'himawari-staff-3', type: 'qualification', title: '感覚統合療法認定取得', date: '2019-07-01', desc: '日本感覚統合学会認定セラピスト資格取得' },
    { userId: 'himawari-staff-2', type: 'evaluation', title: '年度評価A（2025年度）', date: '2026-01-15', desc: '送迎業務の安全運行、SST指導力を高く評価' },
    { userId: 'himawari-staff-3', type: 'evaluation', title: '年度評価A+（2025年度）', date: '2026-01-15', desc: 'OT専門性の活用、チーム連携力を高く評価' },
  ];

  for (let i = 0; i < careerRecords.length; i++) {
    const cr = careerRecords[i];
    const { data, error } = await supabase.from('career_development_records').upsert({
      id: `cdr-${i + 1}`, user_id: cr.userId, facility_id: FACILITY_ID,
      record_type: cr.type, title: cr.title, description: cr.desc,
      recorded_date: cr.date,
    }, { onConflict: 'id' }).select();
    log(`キャリア: ${cr.title}`, data, error);
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║          デモデータ投入完了！              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
施設: ひまわり放課後等デイサービス
ID:   ${FACILITY_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【オーナーアクセス】
  ログイン: koya.htk@gmail.com（既存アカウント）
  → 施設選択で「ひまわり放課後等デイサービス」を選択

【スタッフアカウント】(パスワード: demo1234)
  石川 真由美  ishikawa@himawari-demo.jp  (マネージャー/常勤)
  上田 拓也    ueda@himawari-demo.jp      (児童指導員/常勤)
  永田 さやか  nagata@himawari-demo.jp    (作業療法士/常勤)
  岡田 健司    okada@himawari-demo.jp     (指導員/非常勤)
  藤本 千尋    fujimoto@himawari-demo.jp  (指導員/非常勤)

【保護者アカウント】(パスワード: demo1234)
  西村 美香    nishimura@himawari-parent.jp  (蒼太・彩花の母)
  加藤 恵子    kato@himawari-parent.jp       (ひなた・大翔の母)
  吉田 裕二    yoshida@himawari-parent.jp    (悠真・美咲の父)
  森田 あゆみ  morita@himawari-parent.jp     (結菜の母)
  斎藤 大輔    saito@himawari-parent.jp      (陸の父)

【児童】8名
  西村蒼太(ASD) 加藤ひなた(ADHD) 吉田悠真(知的)
  森田結菜(ダウン症) 斎藤陸(ASD+ADHD) 西村彩花(発達遅延)
  加藤大翔(言語遅延) 吉田美咲(LD)

【投入データ】
  - スケジュール: 3週間分
  - 出退勤記録: 過去1週間分
  - 有給残日数: 全スタッフ
  - 連絡帳: 過去5日分
  - 個別支援計画: 5名分
  - 送迎体制: 今週分
  - 規定文書: 7件（確認状況あり）
  - 資格: 9件
  - BCP計画: 4件
  - 虐待防止記録: 5件
  - 研修記録: 6件
  - キャリア開発記録: 6件
  - 36協定: 1件
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
