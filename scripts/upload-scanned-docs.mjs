/**
 * スキャン書類アップロード & スタッフ情報更新スクリプト
 *
 * 1. 新規スタッフ（一木朋恵・佐野春津代）のuser/employment/staffレコード作成
 * 2. 既存スタッフ情報更新（宮古萌慧、長尾麻由子等）
 * 3. 42件のスキャンPDFをSupabase Storageにアップロード
 * 4. staff_documentsテーブルに登録
 *
 * Usage: node scripts/upload-scanned-docs.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const FACILITY_ID = 'facility-1770623012121';
const OWNER_ID = 'c6f4c329-17e6-4fcc-a1de-28cfbe08b504';
const PDF_DIR = path.join(
  process.env.HOME,
  'Library/Mobile Documents/com~apple~CloudDocs/INU/pocopoco/追加データ/履歴書など/PDF'
);

// ==========================================
// Staff IDs
// ==========================================
const STAFF = {
  ichiki: 'pocopoco-staff-ichiki',
  sano: 'pocopoco-staff-sano',
  sakai: 'pocopoco-staff-sakai',
  hirai: 'pocopoco-staff-hirai',
  mizuishi: 'pocopoco-staff-mizuishi',
  nagao: 'pocopoco-staff-nagao',
  yogo: 'pocopoco-staff-yogo',
  oishi: 'pocopoco-staff-oishi',
  owner: OWNER_ID,
};

// ==========================================
// Document mapping: [fileNum, userId, docType, title]
// ==========================================
const DOCUMENTS = [
  [1, STAFF.ichiki, 'other', '一木朋恵 履歴書'],
  [2, STAFF.ichiki, 'other', '一木朋恵 保育士証'],
  [3, STAFF.sano, 'other', '佐野春津代 職務経歴書'],
  [4, STAFF.sano, 'other', '佐野春津代 社会福祉士登録証'],
  [5, STAFF.sano, 'other', '佐野春津代 保育士証'],
  [6, STAFF.hirai, 'other', '平井菜央 実務経験証明書（府中市役所）'],
  [7, STAFF.hirai, 'other', '平井菜央 実務経験証明書（トライトキャリア/やなぎ保育園）'],
  [8, STAFF.hirai, 'other', '平井菜央 実務経験証明書（風の森）'],
  [9, STAFF.hirai, 'other', '平井菜央 実務経験証明書（育木会）'],
  [10, STAFF.hirai, 'other', '平井菜央 秘密保持誓約書'],
  [11, STAFF.hirai, 'wage_notice', '平井菜央 労働条件通知書（正社員、令和7年12月）'],
  [12, STAFF.hirai, 'wage_notice', '平井菜央 労働条件変更通知書（令和8年1月〜）'],
  [13, STAFF.sakai, 'other', '酒井くるみ 実務経験証明書（スマートキッズ）'],
  [14, STAFF.sakai, 'other', '酒井くるみ 実務経験証明書（山鳥の会）'],
  [15, STAFF.sakai, 'other', '酒井くるみ 秘密保持誓約書'],
  [16, STAFF.sakai, 'wage_notice', '酒井くるみ 労働条件通知書（正社員、令和7年11月）'],
  [17, STAFF.sakai, 'wage_notice', '酒井くるみ 労働条件変更通知書（令和8年1月〜）'],
  [18, STAFF.sakai, 'other', '酒井くるみ 修了証書（児発管基礎研修）'],
  [19, STAFF.sakai, 'other', '酒井くるみ 修了証書（児発管実践研修）'],
  [20, STAFF.oishi, 'other', '大石瑠美 履歴書（表）'],
  [21, STAFF.oishi, 'other', '大石瑠美 履歴書（裏）'],
  [22, STAFF.oishi, 'wage_notice', '大石瑠美 労働条件通知書（有期雇用、令和8年2月）'],
  [23, STAFF.oishi, 'wage_notice', '大石瑠美 労働条件通知書（正社員、令和7年12月）'],
  [24, STAFF.yogo, 'wage_notice', '宮古萌慧 労働条件通知書（正社員、令和8年1月）'],
  [25, STAFF.sakai, 'other', '酒井くるみ 保育士証'],
  [26, STAFF.yogo, 'other', '宮古萌慧 保育士証'],
  [27, STAFF.yogo, 'other', '宮古萌慧 実務経験証明書（フローレンス）'],
  [28, STAFF.yogo, 'other', '宮古萌慧 実務経験証明書（白雲福祉会/バイオニアキッズ西野川園）'],
  [29, STAFF.nagao, 'other', '長尾麻由子 履歴書（表）'],
  [30, STAFF.nagao, 'other', '長尾麻由子 履歴書（裏）'],
  [31, STAFF.nagao, 'wage_notice', '長尾麻由子 労働条件通知書（非常勤、令和7年12月）'],
  [32, STAFF.nagao, 'wage_notice', '長尾麻由子 労働条件通知書（非常勤、令和7年12月）2枚目'],
  [33, STAFF.nagao, 'other', '長尾麻由子(旧姓清田) 幼稚園教諭2種免許状'],
  [34, STAFF.mizuishi, 'other', '水石晶子 履歴書（表）'],
  [35, STAFF.mizuishi, 'other', '水石晶子 履歴書（裏）'],
  [36, STAFF.mizuishi, 'other', '水石晶子 秘密保持誓約書'],
  [37, STAFF.mizuishi, 'wage_notice', '水石晶子 労働条件通知書（有期雇用、令和7年12月）'],
  [38, STAFF.owner, 'other', '指定通知書（児童発達支援、事業所番号1353800657）'],
  [39, STAFF.owner, 'other', '協力医療機関協定書（小金井竹田内科・小児科・在宅クリニック）'],
  [40, STAFF.owner, 'other', '畠昂哉 辞令（管理者任命、令和7年12月1日）'],
  [41, STAFF.owner, 'other', '使用貸借契約書（事業所建物、令和7年12月〜令和8年11月）'],
  [42, STAFF.owner, 'other', '畠昂哉 秘密保持誓約書'],
];

function log(label, data, error) {
  if (error) {
    console.error(`  ✗ ${label}:`, error.message);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

// ==========================================
// Phase 1: Create new staff records
// ==========================================
async function createNewStaff() {
  console.log('\n═══ Phase 1: 新規スタッフ作成 ═══\n');

  const staffPerms = {
    schedule: true, children: true, dailyLog: true,
    supportPlan: true, incident: true, transport: true,
    chat: true, documents: true,
  };

  // --- 一木朋恵 ---
  console.log('--- 一木朋恵 ---');
  {
    const { data, error } = await supabase.from('users').upsert({
      id: STAFF.ichiki,
      name: '一木 朋恵',
      last_name: '一木', first_name: '朋恵',
      last_name_kana: 'イチキ', first_name_kana: 'トモエ',
      birth_date: '1972-02-14',
      gender: 'female',
      phone: '080-5983-3786',
      address: '東京都府中市新町2-17-31',
      role: 'staff',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'pending',
      has_account: false,
      invited_by_facility_id: FACILITY_ID,
      invited_at: new Date().toISOString(),
    }, { onConflict: 'id' }).select();
    log('user: 一木朋恵', data, error);
  }
  {
    const { data, error } = await supabase.from('employment_records').upsert({
      id: 'pocopoco-emp-ichiki',
      user_id: STAFF.ichiki,
      facility_id: FACILITY_ID,
      start_date: '2026-01-06',
      end_date: null,
      role: '一般スタッフ',
      employment_type: '非常勤',
      permissions: staffPerms,
    }, { onConflict: 'id' }).select();
    log('employment: 一木朋恵', data, error);
  }
  {
    const { data, error } = await supabase.from('staff').upsert({
      id: 'pocopoco-s-ichiki',
      facility_id: FACILITY_ID,
      user_id: STAFF.ichiki,
      name: '一木 朋恵',
      name_kana: 'イチキ トモエ',
      role: '一般スタッフ',
      type: '非常勤',
      birth_date: '1972-02-14',
      gender: '女性',
      phone: '080-5983-3786',
      address: '東京都府中市新町2-17-31',
      qualifications: '幼稚園教諭2種免許,ベビーシッター技能認定,IHTA認定ヨガインストラクター,保育士',
      hourly_wage: 1400,
      memo: '非常勤。保育士・幼稚園教諭2種免許保有。',
    }, { onConflict: 'id' }).select();
    log('staff: 一木朋恵', data, error);
  }

  // --- 佐野春津代 ---
  console.log('--- 佐野春津代 ---');
  {
    const { data, error } = await supabase.from('users').upsert({
      id: STAFF.sano,
      name: '佐野 春津代',
      last_name: '佐野', first_name: '春津代',
      last_name_kana: 'サノ', first_name_kana: 'ハツヨ',
      gender: 'female',
      phone: '080-5543-7347',
      email: 'kazumoon.s@gmail.com',
      address: '東京都国分寺市西元町2-3-31',
      role: 'staff',
      user_type: 'staff',
      facility_id: FACILITY_ID,
      account_status: 'pending',
      has_account: false,
      invited_by_facility_id: FACILITY_ID,
      invited_at: new Date().toISOString(),
    }, { onConflict: 'id' }).select();
    log('user: 佐野春津代', data, error);
  }
  {
    const { data, error } = await supabase.from('employment_records').upsert({
      id: 'pocopoco-emp-sano',
      user_id: STAFF.sano,
      facility_id: FACILITY_ID,
      start_date: '2026-01-06',
      end_date: null,
      role: '一般スタッフ',
      employment_type: '非常勤',
      permissions: staffPerms,
    }, { onConflict: 'id' }).select();
    log('employment: 佐野春津代', data, error);
  }
  {
    const { data, error } = await supabase.from('staff').upsert({
      id: 'pocopoco-s-sano',
      facility_id: FACILITY_ID,
      user_id: STAFF.sano,
      name: '佐野 春津代',
      name_kana: 'サノ ハツヨ',
      role: '一般スタッフ',
      type: '非常勤',
      gender: '女性',
      phone: '080-5543-7347',
      email: 'kazumoon.s@gmail.com',
      address: '東京都国分寺市西元町2-3-31',
      qualifications: '社会福祉士,保育士',
      hourly_wage: 1400,
      memo: '非常勤。社会福祉士・保育士資格保有。',
    }, { onConflict: 'id' }).select();
    log('staff: 佐野春津代', data, error);
  }
}

// ==========================================
// Phase 2: Update existing staff info
// ==========================================
async function updateExistingStaff() {
  console.log('\n═══ Phase 2: 既存スタッフ情報更新 ═══\n');

  // 宮古萌慧 (pocopoco-staff-yogo) — name update + DOB + address
  console.log('--- 宮古萌慧 (余郷→宮古) ---');
  {
    const { data, error } = await supabase.from('users')
      .update({
        name: '宮古 萌慧',
        last_name: '宮古', first_name: '萌慧',
        last_name_kana: 'ミヤコ', first_name_kana: 'モエ',
        birth_date: '1998-02-26',
        address: '東京都渋谷区笹塚3-30-9 CREAL渋谷笹塚302',
      })
      .eq('id', STAFF.yogo)
      .select();
    log('user更新: 宮古萌慧', data, error);
  }
  {
    const { data, error } = await supabase.from('staff')
      .update({
        name: '宮古 萌慧',
        name_kana: 'ミヤコ モエ',
        birth_date: '1998-02-26',
        address: '東京都渋谷区笹塚3-30-9 CREAL渋谷笹塚302',
      })
      .eq('id', 'pocopoco-s-yogo')
      .select();
    log('staff更新: 宮古萌慧', data, error);
  }

  // 長尾麻由子 — DOB + address + qualifications
  console.log('--- 長尾麻由子 ---');
  {
    const { data, error } = await supabase.from('users')
      .update({
        birth_date: '1979-08-15',
        address: '東京都小金井市貫井南町1-13-7',
      })
      .eq('id', STAFF.nagao)
      .select();
    log('user更新: 長尾麻由子', data, error);
  }
  {
    const { data, error } = await supabase.from('staff')
      .update({
        birth_date: '1979-08-15',
        address: '東京都小金井市貫井南町1-13-7',
        qualifications: '幼稚園教諭二種免許状,中学校教諭一種免許状(音楽),高等学校教諭一種免許状(音楽)',
      })
      .eq('id', 'pocopoco-s-nagao')
      .select();
    log('staff更新: 長尾麻由子', data, error);
  }

  // 一木朋恵 — also update users table with address
  // (already done in Phase 1)

  // 酒井くるみ — add 保育士 to qualifications (already has 理学療法士,児発管)
  // Already correct in seed, skip

  // 水石晶子 — confirm qualifications = 保育士 (already set)
  // Already correct in seed, skip
}

// ==========================================
// Phase 3: Upload PDFs + register in DB
// ==========================================
async function uploadDocuments() {
  console.log('\n═══ Phase 3: 書類アップロード (42件) ═══\n');

  let success = 0;
  let fail = 0;

  for (const [fileNum, userId, docType, title] of DOCUMENTS) {
    const fileName = `履歴書等 - ${fileNum}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`  ✗ [${fileNum}] ファイルなし: ${filePath}`);
      fail++;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fs.statSync(filePath).size;
    const timestamp = Date.now();
    const docId = Math.random().toString(36).substring(2, 10);
    const storagePath = `staff-docs/${FACILITY_ID}/${userId}/${timestamp}_${docId}.pdf`;

    // Upload to Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error(`  ✗ [${fileNum}] Upload失敗: ${title} — ${uploadError.message}`);
      fail++;
      continue;
    }

    // Insert into staff_documents
    const { error: dbError } = await supabase.from('staff_documents').insert({
      facility_id: FACILITY_ID,
      user_id: userId,
      document_type: docType,
      title: title,
      file_url: storagePath,
      file_name: fileName,
      file_type: 'pdf',
      file_size: fileSize,
      is_read: false,
    });

    if (dbError) {
      console.error(`  ✗ [${fileNum}] DB登録失敗: ${title} — ${dbError.message}`);
      fail++;
      continue;
    }

    console.log(`  ✓ [${fileNum}] ${title}`);
    success++;

    // Small delay to avoid rate limiting
    if (fileNum % 10 === 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n  結果: ${success} 成功 / ${fail} 失敗 (全${DOCUMENTS.length}件)`);
}

// ==========================================
// Phase 4: Summary
// ==========================================
async function showSummary() {
  console.log('\n═══ Phase 4: 最終確認 ═══\n');

  const { data: empRecords } = await supabase
    .from('employment_records')
    .select('id, user_id, role, employment_type, start_date')
    .eq('facility_id', FACILITY_ID)
    .is('end_date', null)
    .order('start_date');

  console.log(`  在籍者数: ${(empRecords || []).length}名`);
  console.log('  ─────────────────────────────────────');
  for (const e of (empRecords || [])) {
    const { data: user } = await supabase
      .from('users')
      .select('name, account_status')
      .eq('id', e.user_id)
      .single();
    const status = user?.account_status === 'active' ? '✓' : '◯';
    console.log(`  ${status} ${(user?.name || '?').padEnd(12)} | ${e.role.padEnd(8)} | ${e.employment_type} | ${e.start_date}`);
  }

  const { count } = await supabase
    .from('staff_documents')
    .select('*', { count: 'exact', head: true })
    .eq('facility_id', FACILITY_ID);

  console.log(`\n  書類総数: ${count}件`);
}

// ==========================================
// Main
// ==========================================
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  スキャン書類アップロード & スタッフ情報更新       ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // Check PDF directory exists
  if (!fs.existsSync(PDF_DIR)) {
    console.error(`PDFフォルダが見つかりません: ${PDF_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`\n  PDFフォルダ: ${PDF_DIR}`);
  console.log(`  PDF数: ${files.length}件\n`);

  await createNewStaff();
  await updateExistingStaff();
  await uploadDocuments();
  await showSummary();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  完了！                                           ║');
  console.log('╚══════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
