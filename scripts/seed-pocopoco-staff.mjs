/**
 * POCOPOCO 職員シードデータ投入スクリプト
 *
 * 株式会社INU 児童発達支援POCOPOCO の実在職員データを登録する
 * - 畠昂哉（代表取締役）は既存ユーザー → employment_records + staff のみ追加
 * - 他7名は users(pending) + employment_records + staff を作成
 * - pending状態で作成 → 後から本人がアクティベーション可能
 *
 * Usage: node scripts/seed-pocopoco-staff.mjs
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==========================================
// Constants
// ==========================================
const OWNER_USER_ID = 'c6f4c329-17e6-4fcc-a1de-28cfbe08b504'; // 畠 昂哉

function log(label, data, error) {
  if (error) {
    console.error(`  ✗ ${label}:`, error.message);
  } else {
    const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
    console.log(`  ✓ ${label} (${count}件)`);
  }
}

// ==========================================
// Staff Definitions（実データ）
// ==========================================

// 安定したUUIDを生成（名前ベースで一貫性を保つ）
const staffIds = {
  sakai:  'pocopoco-staff-sakai',
  hirai:  'pocopoco-staff-hirai',
  mizuishi: 'pocopoco-staff-mizuishi',
  nagao:  'pocopoco-staff-nagao',
  yogo:   'pocopoco-staff-yogo',
  oishi:  'pocopoco-staff-oishi',
  sasano: 'pocopoco-staff-sasano',
};

// ==========================================
// Main
// ==========================================
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  POCOPOCO 職員シードデータ投入                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ==========================================
  // 1. POCOPOCO施設を特定
  // ==========================================
  console.log('=== 1. 施設の確認 ===');

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, owner_user_id')
    .eq('owner_user_id', OWNER_USER_ID);

  if (!facilities || facilities.length === 0) {
    console.error('  ✗ POCOPOCOの施設が見つかりません。先にログインして施設を作成してください。');
    process.exit(1);
  }

  const facility = facilities[0];
  const FACILITY_ID = facility.id;
  console.log(`  ★ 施設: ${facility.name} (${FACILITY_ID})`);

  // ==========================================
  // 2. オーナー（畠昂哉）の雇用記録を確認・作成
  // ==========================================
  console.log('\n=== 2. オーナー（畠昂哉）の雇用記録 ===');

  const ownerPerms = {
    schedule: true, children: true, transport: true,
    dailyLog: true, supportPlan: true, incident: true,
    staff: true, shift: true, training: true,
    dashboard: true, profitLoss: true, cashFlow: true,
    expenseManagement: true, management: true,
    facility: true, auditPreparation: true, committee: true,
    documents: true, chat: true, connect: true,
    clientInvitation: true, lead: true,
  };

  const { data: ownerEmp, error: ownerEmpErr } = await supabase
    .from('employment_records')
    .upsert({
      id: 'pocopoco-emp-owner',
      user_id: OWNER_USER_ID,
      facility_id: FACILITY_ID,
      start_date: '2025-07-01',
      end_date: null,
      role: '管理者',
      employment_type: '常勤',
      permissions: ownerPerms,
    }, { onConflict: 'id' })
    .select();
  log('オーナー雇用記録', ownerEmp, ownerEmpErr);

  // オーナーのstaffレコード
  const { data: ownerStaff, error: ownerStaffErr } = await supabase
    .from('staff')
    .upsert({
      id: 'pocopoco-s-owner',
      facility_id: FACILITY_ID,
      user_id: OWNER_USER_ID,
      name: '畠 昂哉',
      name_kana: 'ハタ コウヤ',
      role: '管理者',
      type: '常勤',
      email: 'koya.htk@gmail.com',
      phone: '080-1965-7976',
      birth_date: '1997-01-23',
      gender: '男性',
      monthly_salary: 0,
      qualifications: '代表取締役',
      memo: '株式会社INU 代表取締役。施設管理者。',
    }, { onConflict: 'id' })
    .select();
  log('オーナーstaffレコード', ownerStaff, ownerStaffErr);

  // ==========================================
  // 3. 職員ユーザー作成（pending状態）
  // ==========================================
  console.log('\n=== 3. 職員ユーザー作成（pending） ===');

  const staffUsers = [
    {
      id: staffIds.sakai,
      name: '酒井 くるみ',
      last_name: '酒井', first_name: 'くるみ',
      last_name_kana: 'サカイ', first_name_kana: 'クルミ',
      gender: 'female',
    },
    {
      id: staffIds.hirai,
      name: '平井 菜央',
      last_name: '平井', first_name: '菜央',
      last_name_kana: 'ヒライ', first_name_kana: 'ナオ',
      birth_date: '1994-04-20',
      gender: 'female',
    },
    {
      id: staffIds.mizuishi,
      name: '水石 晶子',
      last_name: '水石', first_name: '晶子',
      last_name_kana: 'ミズイシ', first_name_kana: 'アキコ',
      birth_date: '1989-03-31',
      gender: 'female',
    },
    {
      id: staffIds.nagao,
      name: '長尾 麻由子',
      last_name: '長尾', first_name: '麻由子',
      last_name_kana: 'ナガオ', first_name_kana: 'マユコ',
      gender: 'female',
    },
    {
      id: staffIds.yogo,
      name: '余郷 ちひろ',
      last_name: '余郷', first_name: 'ちひろ',
      last_name_kana: 'ヨゴウ', first_name_kana: 'チヒロ',
      gender: 'female',
    },
    {
      id: staffIds.oishi,
      name: '大石 瑠美',
      last_name: '大石', first_name: '瑠美',
      last_name_kana: 'オオイシ', first_name_kana: 'ルミ',
      gender: 'female',
    },
    {
      id: staffIds.sasano,
      name: '笹野 周平',
      last_name: '笹野', first_name: '周平',
      last_name_kana: 'ササノ', first_name_kana: 'シュウヘイ',
      gender: 'male',
    },
  ];

  for (const s of staffUsers) {
    const { data, error } = await supabase.from('users').upsert({
      id: s.id,
      name: s.name,
      last_name: s.last_name,
      first_name: s.first_name,
      last_name_kana: s.last_name_kana,
      first_name_kana: s.first_name_kana,
      birth_date: s.birth_date || null,
      gender: s.gender || null,
      role: 'staff',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'pending',
      has_account: false,
      invited_by_facility_id: FACILITY_ID,
      invited_at: new Date().toISOString(),
    }, { onConflict: 'id' }).select();
    log(`ユーザー: ${s.name}`, data, error);
  }

  // ==========================================
  // 4. 雇用記録（employment_records）
  // ==========================================
  console.log('\n=== 4. 雇用記録 ===');

  const staffPerms = {
    schedule: true, children: true, dailyLog: true,
    supportPlan: true, incident: true, transport: true,
    chat: true, documents: true,
  };

  const managerPerms = {
    ...staffPerms,
    staff: true, shift: true, training: true,
    dashboard: true, facility: true,
    profitLoss: true, management: true, cashFlow: true,
    expenseManagement: true, connect: true, clientInvitation: true,
  };

  const employments = [
    {
      id: 'pocopoco-emp-sakai',
      userId: staffIds.sakai,
      startDate: '2025-11-13',
      role: 'マネージャー', // 児発管 → マネージャー相当
      type: '常勤',
      permissions: managerPerms,
    },
    {
      id: 'pocopoco-emp-hirai',
      userId: staffIds.hirai,
      startDate: '2025-12-01',
      role: '一般スタッフ',
      type: '常勤',
      permissions: staffPerms,
    },
    {
      id: 'pocopoco-emp-mizuishi',
      userId: staffIds.mizuishi,
      startDate: '2026-01-01',
      role: '一般スタッフ',
      type: '非常勤',
      permissions: staffPerms,
    },
    {
      id: 'pocopoco-emp-nagao',
      userId: staffIds.nagao,
      startDate: '2025-12-05',
      role: '一般スタッフ',
      type: '非常勤',
      permissions: staffPerms,
    },
    {
      id: 'pocopoco-emp-yogo',
      userId: staffIds.yogo,
      startDate: '2026-04-01',
      role: '一般スタッフ',
      type: '常勤',
      permissions: staffPerms,
    },
    {
      id: 'pocopoco-emp-oishi',
      userId: staffIds.oishi,
      startDate: '2026-04-01',
      role: '一般スタッフ',
      type: '常勤',
      permissions: staffPerms,
    },
    {
      id: 'pocopoco-emp-sasano',
      userId: staffIds.sasano,
      startDate: '2026-05-01',
      role: '一般スタッフ',
      type: '常勤',
      permissions: staffPerms,
    },
  ];

  for (const e of employments) {
    const { data, error } = await supabase.from('employment_records').upsert({
      id: e.id,
      user_id: e.userId,
      facility_id: FACILITY_ID,
      start_date: e.startDate,
      end_date: null,
      role: e.role,
      employment_type: e.type,
      permissions: e.permissions,
    }, { onConflict: 'id' }).select();
    log(`雇用: ${e.id}`, data, error);
  }

  // ==========================================
  // 5. staffテーブル（レガシー互換 + 人員配置用）
  // ==========================================
  console.log('\n=== 5. staffテーブル（人員配置・資格情報） ===');

  const staffRecords = [
    {
      id: 'pocopoco-s-sakai',
      user_id: staffIds.sakai,
      name: '酒井 くるみ',
      name_kana: 'サカイ クルミ',
      role: 'マネージャー',
      type: '常勤',
      gender: '女性',
      qualifications: '理学療法士,児童発達支援管理責任者(基礎研修修了),児童発達支援管理責任者(実践研修修了)',
      years_of_experience: 10,
      monthly_salary: 350000,
      memo: '児童発達支援管理責任者。理学療法士資格保有。基本給200,000+役職手当50,000+固定残業34,000(15h)+処遇改善66,000。',
    },
    {
      id: 'pocopoco-s-hirai',
      user_id: staffIds.hirai,
      name: '平井 菜央',
      name_kana: 'ヒライ ナオ',
      role: '一般スタッフ',
      type: '常勤',
      birth_date: '1994-04-20',
      gender: '女性',
      qualifications: '保育士',
      monthly_salary: 250000,
      memo: '保育士。基本給205,800+固定残業24,200(15h)+処遇改善20,000。',
    },
    {
      id: 'pocopoco-s-mizuishi',
      user_id: staffIds.mizuishi,
      name: '水石 晶子',
      name_kana: 'ミズイシ アキコ',
      role: '一般スタッフ',
      type: '非常勤',
      birth_date: '1989-03-31',
      gender: '女性',
      qualifications: '保育士',
      hourly_wage: 1600,
      memo: '非常勤。週2日程度・1日7h以内。保育補助・個別支援補助。',
    },
    {
      id: 'pocopoco-s-nagao',
      user_id: staffIds.nagao,
      name: '長尾 麻由子',
      name_kana: 'ナガオ マユコ',
      role: '一般スタッフ',
      type: '非常勤',
      gender: '女性',
      hourly_wage: 1400,
      memo: '非常勤。週2日程度・1日7h以内。保育補助・個別支援補助。',
    },
    {
      id: 'pocopoco-s-yogo',
      user_id: staffIds.yogo,
      name: '余郷 ちひろ',
      name_kana: 'ヨゴウ チヒロ',
      role: '一般スタッフ',
      type: '常勤',
      gender: '女性',
      qualifications: '保育士',
      monthly_salary: 335000,
      memo: '2026年4月入社予定。保育士/児発管補助。基本給200,000+役職手当35,000+処遇改善66,000+固定残業34,000(15h)。',
    },
    {
      id: 'pocopoco-s-oishi',
      user_id: staffIds.oishi,
      name: '大石 瑠美',
      name_kana: 'オオイシ ルミ',
      role: '一般スタッフ',
      type: '常勤',
      gender: '女性',
      monthly_salary: 300000,
      memo: '2026年4月入社予定。正社員。基本給230,900+固定残業29,100(15h)+処遇改善40,000。',
    },
    {
      id: 'pocopoco-s-sasano',
      user_id: staffIds.sasano,
      name: '笹野 周平',
      name_kana: 'ササノ シュウヘイ',
      role: '一般スタッフ',
      type: '常勤',
      gender: '男性',
      qualifications: '指導員',
      monthly_salary: 350000,
      memo: '2026年5月入社予定。指導員。基本給250,000+固定残業34,000(15h)+処遇改善66,000。',
    },
  ];

  for (const s of staffRecords) {
    const { data, error } = await supabase.from('staff').upsert({
      ...s,
      facility_id: FACILITY_ID,
    }, { onConflict: 'id' }).select();
    log(`staff: ${s.name}`, data, error);
  }

  // ==========================================
  // 6. 最終確認
  // ==========================================
  console.log('\n=== 6. 最終確認 ===');

  const { data: empRecords } = await supabase
    .from('employment_records')
    .select('id, user_id, role, employment_type, start_date')
    .eq('facility_id', FACILITY_ID)
    .is('end_date', null)
    .order('start_date');

  console.log(`\n  施設: ${facility.name}`);
  console.log(`  在籍者数: ${(empRecords || []).length}名`);
  console.log('  ─────────────────────────────────────');
  for (const e of (empRecords || [])) {
    const { data: user } = await supabase
      .from('users')
      .select('name, account_status')
      .eq('id', e.user_id)
      .single();
    const status = user?.account_status === 'active' ? '✓ active' : '◯ pending';
    console.log(`  ${user?.name?.padEnd(12)} | ${e.role.padEnd(8)} | ${e.employment_type} | ${e.start_date} | ${status}`);
  }

  const { data: staffList } = await supabase
    .from('staff')
    .select('id, name, role, type, monthly_salary, hourly_wage')
    .eq('facility_id', FACILITY_ID);

  console.log(`\n  staffテーブル: ${(staffList || []).length}件`);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  POCOPOCO 職員データ投入完了！                 ║');
  console.log('║  pendingユーザーはアクティベーションリンクで     ║');
  console.log('║  本人がパスワードを設定してログイン可能に       ║');
  console.log('╚══════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
