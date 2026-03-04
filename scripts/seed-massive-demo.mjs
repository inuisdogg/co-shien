/**
 * ひまわり放課後等デイサービス — 大規模デモデータ投入スクリプト
 *
 * VCデモ向けに「数年使い込んだSaaS感」を出すため、
 * 50名の児童・12名のスタッフ・6ヶ月分の利用実績・請求・シフト等を
 * 網羅的に投入する。
 *
 * Usage: node scripts/seed-massive-demo.mjs
 * Password: demo1234 (全デモアカウント共通)
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ==========================================
// Connection
// ==========================================
const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==========================================
// Constants
// ==========================================
const FACILITY_ID = 'facility-himawari-demo';
const OWNER_USER_ID = 'c6f4c329-17e6-4fcc-a1de-28cfbe08b504';
const passwordHash = bcrypt.hashSync('demo1234', 12);

// Date range: Oct 2025 – Mar 2026
const MONTH_RANGE = [
  { year: 2025, month: 10 },
  { year: 2025, month: 11 },
  { year: 2025, month: 12 },
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
  { year: 2026, month: 3 },
];

// ==========================================
// Helpers
// ==========================================
function log(label, count) {
  console.log(`  ✓ ${label} (${count}件)`);
}
function logErr(label, err) {
  console.error(`  ✗ ${label}: ${err.message}`);
}
function dateStr(d) {
  return d.toISOString().slice(0, 10);
}
function pad2(n) {
  return String(n).padStart(2, '0');
}
function ymStr(y, m) {
  return `${y}-${pad2(m)}`;
}

/** Deterministic pseudo-random based on seed string */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 16807 + 0) % 2147483647;
    return (h & 0x7fffffff) / 2147483647;
  };
}

/** Get business days (Mon-Sat, exclude Sun) for a given year/month */
function getBusinessDays(year, month) {
  const days = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 6) {
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** Batch upsert */
async function batchUpsert(table, rows, batchSize = 200, conflictCol = 'id') {
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflictCol })
      .select('id');
    if (error) {
      logErr(`${table} batch ${i}`, error);
    } else {
      total += (data || []).length;
    }
  }
  return total;
}

/** Batch insert (no conflict handling) */
async function batchInsert(table, rows, batchSize = 200) {
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .insert(chunk)
      .select('id');
    if (error) {
      logErr(`${table} batch ${i}`, error);
    } else {
      total += (data || []).length;
    }
  }
  return total;
}

// ==========================================
// DATA DEFINITIONS
// ==========================================

// --- 12 Staff ---
const STAFF = [
  { idx: 1, last: '石川', first: '真由美', lastK: 'イシカワ', firstK: 'マユミ', birth: '1982-03-15', gender: 'female', empType: '常勤', role: 'マネージャー', position: '施設長', dept: '管理部門', quals: ['児童発達支援管理責任者','保育士','社会福祉士'], years: 20, salary: 350000, startDate: '2023-04-01' },
  { idx: 2, last: '上田', first: '拓也', lastK: 'ウエダ', firstK: 'タクヤ', birth: '1988-07-22', gender: 'male', empType: '常勤', role: '一般スタッフ', position: 'リーダー', dept: '療育チーム', quals: ['特別支援学校教諭一種','普通自動車免許'], years: 13, salary: 280000, startDate: '2024-04-01' },
  { idx: 3, last: '永田', first: 'さやか', lastK: 'ナガタ', firstK: 'サヤカ', birth: '1991-11-08', gender: 'female', empType: '常勤', role: '一般スタッフ', position: null, dept: '療育チーム', quals: ['作業療法士','感覚統合療法認定'], years: 10, salary: 300000, startDate: '2024-10-01' },
  { idx: 4, last: '岡田', first: '健司', lastK: 'オカダ', firstK: 'ケンジ', birth: '1995-01-30', gender: 'male', empType: '非常勤', role: '一般スタッフ', position: null, dept: '相談支援', quals: ['認定心理士','普通自動車免許'], years: 6, wage: 1350, startDate: '2025-04-01' },
  { idx: 5, last: '藤本', first: '千尋', lastK: 'フジモト', firstK: 'チヒロ', birth: '1998-05-20', gender: 'female', empType: '非常勤', role: '一般スタッフ', position: null, dept: '療育チーム', quals: ['音楽療法士','普通自動車免許'], years: 5, wage: 1250, startDate: '2025-04-01' },
  { idx: 6, last: '中村', first: '康介', lastK: 'ナカムラ', firstK: 'コウスケ', birth: '1987-09-12', gender: 'male', empType: '常勤', role: '一般スタッフ', position: null, dept: '療育チーム', quals: ['理学療法士','普通自動車免許'], years: 14, salary: 310000, startDate: '2024-04-01' },
  { idx: 7, last: '高橋', first: '里美', lastK: 'タカハシ', firstK: 'サトミ', birth: '1985-04-03', gender: 'female', empType: '常勤', role: '一般スタッフ', position: null, dept: '医療ケア', quals: ['看護師','保健師'], years: 16, salary: 320000, startDate: '2024-07-01' },
  { idx: 8, last: '佐々木', first: '翔太', lastK: 'ササキ', firstK: 'ショウタ', birth: '1993-12-28', gender: 'male', empType: '常勤', role: '一般スタッフ', position: null, dept: '療育チーム', quals: ['言語聴覚士'], years: 8, salary: 290000, startDate: '2025-01-01' },
  { idx: 9, last: '田中', first: '美穂', lastK: 'タナカ', firstK: 'ミホ', birth: '1996-06-17', gender: 'female', empType: '非常勤', role: '一般スタッフ', position: null, dept: '保育', quals: ['保育士','幼稚園教諭'], years: 7, wage: 1300, startDate: '2025-04-01' },
  { idx: 10, last: '山本', first: '大地', lastK: 'ヤマモト', firstK: 'ダイチ', birth: '1994-02-08', gender: 'male', empType: '非常勤', role: '一般スタッフ', position: null, dept: '学習支援', quals: ['小学校教諭一種','普通自動車免許'], years: 9, wage: 1400, startDate: '2025-06-01' },
  { idx: 11, last: '松本', first: '愛', lastK: 'マツモト', firstK: 'アイ', birth: '1990-10-25', gender: 'female', empType: '非常勤', role: '一般スタッフ', position: null, dept: '相談支援', quals: ['公認心理師','臨床心理士'], years: 11, wage: 1500, startDate: '2025-07-01' },
  { idx: 12, last: '小林', first: '雅人', lastK: 'コバヤシ', firstK: 'マサト', birth: '1992-08-14', gender: 'male', empType: '非常勤', role: '一般スタッフ', position: null, dept: '送迎・事務', quals: ['社会福祉士','普通自動車免許'], years: 8, wage: 1300, startDate: '2025-09-01' },
];

// --- 25 Parent Families ---
const PARENTS = [
  { idx: 1, last: '西村', first: '美香', lastK: 'ニシムラ', firstK: 'ミカ' },
  { idx: 2, last: '加藤', first: '恵子', lastK: 'カトウ', firstK: 'ケイコ' },
  { idx: 3, last: '吉田', first: '裕二', lastK: 'ヨシダ', firstK: 'ユウジ' },
  { idx: 4, last: '森田', first: 'あゆみ', lastK: 'モリタ', firstK: 'アユミ' },
  { idx: 5, last: '斎藤', first: '大輔', lastK: 'サイトウ', firstK: 'ダイスケ' },
  { idx: 6, last: '渡辺', first: '由美', lastK: 'ワタナベ', firstK: 'ユミ' },
  { idx: 7, last: '伊藤', first: '正樹', lastK: 'イトウ', firstK: 'マサキ' },
  { idx: 8, last: '鈴木', first: '春香', lastK: 'スズキ', firstK: 'ハルカ' },
  { idx: 9, last: '木村', first: '健太郎', lastK: 'キムラ', firstK: 'ケンタロウ' },
  { idx: 10, last: '清水', first: '理恵', lastK: 'シミズ', firstK: 'リエ' },
  { idx: 11, last: '山田', first: '直美', lastK: 'ヤマダ', firstK: 'ナオミ' },
  { idx: 12, last: '中島', first: '誠', lastK: 'ナカジマ', firstK: 'マコト' },
  { idx: 13, last: '前田', first: '智子', lastK: 'マエダ', firstK: 'トモコ' },
  { idx: 14, last: '小川', first: '修一', lastK: 'オガワ', firstK: 'シュウイチ' },
  { idx: 15, last: '三浦', first: '麻衣', lastK: 'ミウラ', firstK: 'マイ' },
  { idx: 16, last: '原田', first: '拓郎', lastK: 'ハラダ', firstK: 'タクロウ' },
  { idx: 17, last: '松田', first: '裕子', lastK: 'マツダ', firstK: 'ユウコ' },
  { idx: 18, last: '藤田', first: '隆', lastK: 'フジタ', firstK: 'タカシ' },
  { idx: 19, last: '長谷川', first: '真理', lastK: 'ハセガワ', firstK: 'マリ' },
  { idx: 20, last: '村上', first: '浩二', lastK: 'ムラカミ', firstK: 'コウジ' },
  { idx: 21, last: '近藤', first: '恵', lastK: 'コンドウ', firstK: 'メグミ' },
  { idx: 22, last: '石田', first: '太一', lastK: 'イシダ', firstK: 'タイチ' },
  { idx: 23, last: '坂本', first: '奈々', lastK: 'サカモト', firstK: 'ナナ' },
  { idx: 24, last: '岩田', first: '英二', lastK: 'イワタ', firstK: 'エイジ' },
  { idx: 25, last: '佐野', first: '和美', lastK: 'サノ', firstK: 'カズミ' },
];

// 世田谷区の小学校
const SCHOOLS = [
  '世田谷区立松丘小学校', '世田谷区立駒沢小学校', '世田谷区立旭小学校',
  '世田谷区立三軒茶屋小学校', '世田谷区立太子堂小学校', '世田谷区立若林小学校',
  '世田谷区立池尻小学校', '世田谷区立多聞小学校', '世田谷区立中里小学校',
  '世田谷区立弦巻小学校', '世田谷区立桜丘小学校', '世田谷区立経堂小学校',
  '世田谷区立笹原小学校', '世田谷区立用賀小学校', '世田谷区立深沢小学校',
];

// 世田谷区の住所パターン
const ADDRESSES = [
  { addr: '東京都世田谷区三軒茶屋1-10-5', postal: '154-0024' },
  { addr: '東京都世田谷区太子堂3-8-2', postal: '154-0004' },
  { addr: '東京都世田谷区下馬2-5-11', postal: '154-0002' },
  { addr: '東京都世田谷区若林4-1-7', postal: '154-0023' },
  { addr: '東京都世田谷区三軒茶屋2-30-8', postal: '154-0024' },
  { addr: '東京都世田谷区池尻3-21-5', postal: '154-0001' },
  { addr: '東京都世田谷区駒沢1-15-3', postal: '154-0012' },
  { addr: '東京都世田谷区弦巻2-8-10', postal: '154-0016' },
  { addr: '東京都世田谷区経堂5-12-1', postal: '156-0052' },
  { addr: '東京都世田谷区桜丘4-22-8', postal: '156-0054' },
  { addr: '東京都世田谷区用賀2-6-14', postal: '158-0097' },
  { addr: '東京都世田谷区深沢5-11-9', postal: '158-0081' },
  { addr: '東京都世田谷区上野毛3-7-2', postal: '158-0093' },
  { addr: '東京都世田谷区世田谷1-16-3', postal: '154-0017' },
  { addr: '東京都世田谷区松原6-2-8', postal: '156-0043' },
];

// --- 50 Children ---
// Disability distribution: ASD(15), ADHD(8), ASD+ADHD(5), Down(4), ID(6), LD(4), DevDelay(4), Physical(2), SpeechDelay(2)
const DISABILITY_SPECS = [
  // ASD x15
  ...Array(15).fill(null).map((_, i) => ({ type: 'ASD', label: 'ASD（自閉スペクトラム症）', chars: ['視覚優位で見通しがあると安定', 'こだわりが強いが知的好奇心旺盛', '感覚過敏があり静かな環境を好む', '対人関係に課題があるが穏やか', 'ルーティンを大切にし変化に弱い'][i % 5] })),
  // ADHD x8
  ...Array(8).fill(null).map((_, i) => ({ type: 'ADHD', label: 'ADHD（注意欠如多動症）', chars: ['活発で好奇心旺盛、集中力の持続が課題', '衝動性があるが創造性豊か', '多動傾向だが興味のある活動には集中', '不注意優勢型で忘れ物が多い'][i % 4] })),
  // ASD+ADHD x5
  ...Array(5).fill(null).map((_, i) => ({ type: 'ASD+ADHD', label: 'ASD+ADHD併存', chars: ['こだわりと多動が共存、構造化された環境で安定', '知的好奇心旺盛だがパニック時は静かな場所が必要', '感覚過敏と衝動性の両方にケアが必要'][i % 3] })),
  // Down x4
  ...Array(4).fill(null).map((_, i) => ({ type: 'Down', label: 'ダウン症', chars: ['おとなしく協調性がある、微細運動に課題', '社交的で模倣が得意、言語発達ゆっくり'][i % 2] })),
  // ID x6
  ...Array(6).fill(null).map((_, i) => ({ type: 'ID', label: '知的障害（中度）', chars: ['言語表現は単語レベル、PECSを使用', '穏やかな性格で音楽を好む', '基本的生活スキルの獲得に支援が必要'][i % 3] })),
  // LD x4
  ...Array(4).fill(null).map((_, i) => ({ type: 'LD', label: '学習障害（LD）', chars: ['読みに困難あり、計算は得意', '書字に課題があるがICT活用で補える'][i % 2] })),
  // DevDelay x4
  ...Array(4).fill(null).map((_, i) => ({ type: 'DevDelay', label: '発達遅延', chars: ['全般的な発達の遅れ、模倣が得意', '言語・運動ともにゆっくり成長中'][i % 2] })),
  // Physical x2
  { type: 'Physical', label: '肢体不自由', chars: '車椅子使用、上肢機能は良好' },
  { type: 'Physical', label: '肢体不自由', chars: '装具使用で歩行可能、階段は介助必要' },
  // SpeechDelay x2
  { type: 'SpeechDelay', label: '言語発達遅延', chars: '理解力は年齢相応だが表出に課題' },
  { type: 'SpeechDelay', label: '言語発達遅延', chars: '吃音があり、SSTで改善中' },
];

// pattern_days distribution: 5日(15), 4日(12), 3日(15), 2日(8)
const PATTERN_DAYS_DIST = [
  ...Array(15).fill([1, 2, 3, 4, 5]),
  ...Array(4).fill([1, 2, 3, 4]),
  ...Array(4).fill([1, 2, 4, 5]),
  ...Array(4).fill([1, 3, 4, 5]),
  ...Array(5).fill([1, 3, 5]),
  ...Array(5).fill([2, 4, 6]),
  ...Array(5).fill([1, 2, 5]),
  ...Array(4).fill([1, 4]),
  ...Array(4).fill([2, 5]),
];

// income_category distribution: general(35), general_low(10), low_income(5)
const INCOME_DIST = [
  ...Array(35).fill('general'),
  ...Array(10).fill('general_low'),
  ...Array(5).fill('low_income'),
];

// Sibling pairs: 8 pairs share the same parent
// children 0,1 -> parent 0; children 2,3 -> parent 1; ... children 14,15 -> parent 7
// children 16-49 -> parents 8-24 (2 children per remaining parent)
function parentIdxForChild(childIdx) {
  if (childIdx < 16) return Math.floor(childIdx / 2); // 8 sibling pairs
  return 8 + Math.floor((childIdx - 16) / 2); // rest: 2 per parent
}

// First names pool for children
const CHILD_FIRST_NAMES_M = ['蒼太','悠真','陸','大翔','颯太','湊','新','樹','蓮','朝陽','奏太','律','暖','凛太朗','遥斗','碧','晴','翼','海斗','健太','拓真','陽向','歩','龍之介','壮真'];
const CHILD_FIRST_NAMES_F = ['ひなた','結菜','彩花','美咲','陽葵','凛','紬','芽依','杏','さくら','莉子','心春','花音','結愛','詩','楓','朱莉','七海','美月','琴葉','萌花','日和','光莉','真央','優奈'];
const CHILD_FIRST_KANA_M = ['ソウタ','ユウマ','リク','ヒロト','ソウタ','ミナト','アラタ','イツキ','レン','アサヒ','カナタ','リツ','ダン','リンタロウ','ハルト','アオイ','ハル','ツバサ','カイト','ケンタ','タクマ','ヒナタ','アユム','リュウノスケ','ソウマ'];
const CHILD_FIRST_KANA_F = ['ヒナタ','ユイナ','アヤカ','ミサキ','ヒマリ','リン','ツムギ','メイ','アン','サクラ','リコ','コハル','カノン','ユア','ウタ','カエデ','アカリ','ナナミ','ミツキ','コトハ','モエカ','ヒヨリ','ヒカリ','マオ','ユウナ'];

function buildChildren() {
  const children = [];
  const rng = seededRandom('children-v1');

  for (let i = 0; i < 50; i++) {
    const pIdx = parentIdxForChild(i);
    const parent = PARENTS[pIdx];
    const isMale = i % 2 === 0;
    const firstName = isMale ? CHILD_FIRST_NAMES_M[i % 25] : CHILD_FIRST_NAMES_F[i % 25];
    const firstKana = isMale ? CHILD_FIRST_KANA_M[i % 25] : CHILD_FIRST_KANA_F[i % 25];
    const disability = DISABILITY_SPECS[i];
    const birthYear = 2016 + (i % 5); // 2016-2020
    const birthMonth = 1 + (i % 12);
    const birthDay = 1 + (i % 28);
    const addr = ADDRESSES[i % ADDRESSES.length];
    const school = SCHOOLS[i % SCHOOLS.length];
    const patternDays = PATTERN_DAYS_DIST[i];
    const grantDays = patternDays.length >= 4 ? 23 : (patternDays.length === 3 ? 20 : 15);
    const contractDays = grantDays - Math.floor(rng() * 5);

    // Consume RNG to keep determinism stable
    for (const dow of patternDays) { rng(); rng(); }

    const chars = typeof disability.chars === 'string' ? disability.chars : disability.chars;
    const needsPickup = rng() > 0.2;
    const needsDropoff = rng() > 0.15;

    children.push({
      id: `hm-child-${pad2(i + 1)}`,
      facility_id: FACILITY_ID,
      name: `${parent.last} ${firstName}`,
      name_kana: `${parent.lastK} ${firstKana}`,
      birth_date: `${birthYear}-${pad2(birthMonth)}-${pad2(birthDay)}`,
      guardian_name: `${parent.last} ${parent.first}`,
      guardian_name_kana: `${parent.lastK} ${parent.firstK}`,
      guardian_relationship: isMale ? '母' : '父',
      phone: `090-${pad2(10 + pIdx)}00-${pad2(20 + pIdx)}00`,
      email: `${parent.lastK.toLowerCase()}@himawari-parent.jp`,
      address: addr.addr,
      postal_code: addr.postal,
      beneficiary_number: `H${String(birthYear).slice(2)}${pad2(birthMonth)}-${String(i + 1).padStart(5, '0')}`,
      grant_days: grantDays,
      contract_days: contractDays,
      contract_status: 'active',
      contract_start_date: i < 20 ? '2025-04-01' : (i < 35 ? '2025-07-01' : '2025-10-01'),
      pattern_days: patternDays,
      needs_pickup: needsPickup,
      needs_dropoff: needsDropoff,
      pickup_address: school,
      dropoff_address: addr.addr,
      school_name: birthYear >= 2019 ? `${school.replace('小学校', '')}幼稚園` : `${school}（${disability.type === 'LD' ? '通常学級・通級利用' : '特別支援学級'})`,
      characteristics: `${disability.label}。${chars} | 所得区分: ${INCOME_DIST[i]}`,
      income_category: INCOME_DIST[i],
      owner_profile_id: `hm-parent-${pad2(pIdx + 1)}`,
    });
  }
  return children;
}

// ==========================================
// MAIN
// ==========================================
async function main() {
  const startTime = Date.now();

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  ひまわり放課後等デイサービス 大規模デモデータ投入    ║');
  console.log('║  50児童 · 12スタッフ · 6ヶ月分                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // ======================
  // 0. CLEANUP
  // ======================
  console.log('=== 0. 既存デモデータ削除 ===');
  const tables = [
    'chat_messages', 'audit_logs', 'cashflow_entries', 'cashflow_balances',
    'expenses', 'management_targets',
    'job_applications', 'job_postings',
    'billing_records', 'usage_records', 'contact_logs',
    'schedules', 'service_plans', 'incident_reports',
    'leads', 'shifts', 'monthly_shift_schedules',
    'attendance_records', 'paid_leave_balances',
    'committee_meetings', 'training_records',
    'career_development_records', 'staff_qualifications',
    'abuse_prevention_records', 'bcp_emergency_contacts', 'bcp_plans',
    'overtime_agreements', 'regulation_acknowledgments',
    'daily_transport_assignments', 'contract_invitations',
    'shift_patterns',
    'staff_personnel_settings',
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).delete().eq('facility_id', FACILITY_ID);
    if (error && !error.message.includes('does not exist')) {
      console.log(`  ⚠ ${t}: ${error.message}`);
    }
  }

  // Delete children, staff, users separately
  const childIds = Array.from({ length: 50 }, (_, i) => `hm-child-${pad2(i + 1)}`);
  const staffUserIds = STAFF.map(s => `hm-staff-${pad2(s.idx)}`);
  const staffIds = STAFF.map(s => `hm-s-${pad2(s.idx)}`);
  const parentUserIds = PARENTS.map(p => `hm-parent-${pad2(p.idx)}`);
  const empIds = STAFF.map(s => `hm-emp-${pad2(s.idx)}`);
  const applicantIds = Array.from({ length: 5 }, (_, i) => `hm-applicant-${pad2(i + 1)}`);

  await supabase.from('children').delete().in('id', childIds);
  await supabase.from('staff').delete().in('id', staffIds);
  await supabase.from('employment_records').delete().in('id', [...empIds, 'hm-emp-owner']);
  await supabase.from('users').delete().in('id', [...staffUserIds, ...parentUserIds, ...applicantIds]);

  console.log('  ✓ クリーンアップ完了\n');

  // ======================
  // 1. FACILITY (upsert existing)
  // ======================
  console.log('=== 1. 施設・施設設定更新 ===');

  // Ensure facility exists
  await supabase.from('facilities').upsert({
    id: FACILITY_ID,
    name: 'ひまわり放課後等デイサービス',
    code: 'HIMAWARI',
    owner_user_id: OWNER_USER_ID,
  }, { onConflict: 'id' });

  const { error: fsErr } = await supabase.from('facility_settings').upsert({
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
    business_hours: { am: { start: '09:00', end: '12:00' }, pm: { start: '13:00', end: '17:30' } },
    service_hours: { am: { start: '09:30', end: '11:30' }, pm: { start: '13:30', end: '17:00' } },
    regular_holidays: [0],
    transport_capacity: { pickup: 8, dropoff: 8 },
    prescribed_working_hours: 480,
    standard_weekly_hours: 40,
    service_categories: { afterSchoolDayService: true, childDevelopmentSupport: false },
  }, { onConflict: 'facility_id' });
  if (fsErr) logErr('施設設定', fsErr); else log('施設設定', 1);

  // ======================
  // 2. OWNER ACCESS
  // ======================
  console.log('\n=== 2. オーナーアクセス権 ===');
  const allPerms = {
    schedule: true, children: true, transport: true, dailyLog: true,
    supportPlan: true, incident: true, staff: true, shift: true,
    training: true, dashboard: true, profitLoss: true, cashFlow: true,
    expenseManagement: true, management: true, facility: true,
    auditPreparation: true, committee: true, documents: true,
    chat: true, connect: true, clientInvitation: true, lead: true,
    recruitment: true,
  };
  await supabase.from('employment_records').upsert({
    id: 'hm-emp-owner', user_id: OWNER_USER_ID, facility_id: FACILITY_ID,
    start_date: '2023-04-01', role: '管理者', employment_type: '常勤',
    permissions: allPerms,
  }, { onConflict: 'id' });
  log('オーナー雇用記録', 1);

  // ======================
  // 3. STAFF (users + employment_records + staff table)
  // ======================
  console.log('\n=== 3. スタッフ12名 ===');

  const staffPerms = {
    schedule: true, children: true, dailyLog: true, supportPlan: true,
    staff: true, shift: true, training: true, dashboard: true, facility: true,
    incident: true, documents: true, transport: true, chat: true,
  };
  const mgrPerms = { ...staffPerms, ...allPerms };

  // Users
  const staffUserRows = STAFF.map(s => ({
    id: `hm-staff-${pad2(s.idx)}`,
    name: `${s.last} ${s.first}`,
    last_name: s.last, first_name: s.first,
    last_name_kana: s.lastK, first_name_kana: s.firstK,
    email: `${s.lastK.toLowerCase()}@himawari-demo.jp`,
    login_id: `${s.lastK.toLowerCase()}@himawari-demo.jp`,
    password_hash: passwordHash,
    birth_date: s.birth, gender: s.gender,
    role: s.idx === 1 ? 'manager' : 'staff',
    user_type: 'staff', facility_id: FACILITY_ID,
    account_status: 'active', has_account: true,
    phone: `090-${1100 + s.idx}-${2200 + s.idx}`,
  }));
  let n = await batchUpsert('users', staffUserRows);
  log('スタッフユーザー', n);

  // Employment records
  const empRows = STAFF.map(s => ({
    id: `hm-emp-${pad2(s.idx)}`,
    user_id: `hm-staff-${pad2(s.idx)}`,
    facility_id: FACILITY_ID,
    start_date: s.startDate,
    role: s.role,
    employment_type: s.empType,
    permissions: s.idx === 1 ? mgrPerms : staffPerms,
  }));
  n = await batchUpsert('employment_records', empRows);
  log('雇用記録', n);

  // Staff table
  const staffTableRows = STAFF.map(s => ({
    id: `hm-s-${pad2(s.idx)}`,
    facility_id: FACILITY_ID,
    name: `${s.last} ${s.first}`,
    name_kana: `${s.lastK} ${s.firstK}`,
    role: s.role,
    type: s.empType,
    email: `${s.lastK.toLowerCase()}@himawari-demo.jp`,
    birth_date: s.birth,
    gender: s.gender === 'male' ? '男性' : '女性',
    qualifications: s.quals,
    years_of_experience: s.years,
    ...(s.salary ? { monthly_salary: s.salary } : { hourly_wage: s.wage }),
    phone: `090-${1100 + s.idx}-${2200 + s.idx}`,
  }));
  n = await batchUpsert('staff', staffTableRows);
  log('staffテーブル', n);

  // ======================
  // 4. PARENTS (25 families)
  // ======================
  console.log('\n=== 4. 保護者25家庭 ===');
  const parentRows = PARENTS.map(p => ({
    id: `hm-parent-${pad2(p.idx)}`,
    name: `${p.last} ${p.first}`,
    last_name: p.last, first_name: p.first,
    last_name_kana: p.lastK, first_name_kana: p.firstK,
    email: `${p.lastK.toLowerCase()}@himawari-parent.jp`,
    login_id: `${p.lastK.toLowerCase()}@himawari-parent.jp`,
    password_hash: passwordHash,
    role: 'client', user_type: 'client',
    account_status: 'active', has_account: true,
    phone: `090-${pad2(10 + p.idx)}00-${pad2(20 + p.idx)}00`,
  }));
  n = await batchUpsert('users', parentRows);
  log('保護者ユーザー', n);

  // ======================
  // 5. CHILDREN (50)
  // ======================
  console.log('\n=== 5. 児童50名 ===');
  const children = buildChildren();
  n = await batchUpsert('children', children);
  log('児童', n);

  // Contract invitations
  const invRows = children.map(c => ({
    id: `inv-${c.id}`,
    facility_id: FACILITY_ID,
    child_id: c.id,
    email: c.email,
    invitation_token: crypto.randomUUID(),
    status: 'accepted',
    invited_by: 'hm-staff-01',
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
  }));
  n = await batchUpsert('contract_invitations', invRows);
  log('契約招待', n);

  // ======================
  // 6. SCHEDULES (~4,500 over 6 months)
  // ======================
  console.log('\n=== 6. スケジュール（6ヶ月分） ===');
  // Build schedule metadata (for cross-referencing usage_records later)
  let scheduleRows = [];
  for (const { year, month } of MONTH_RANGE) {
    const days = getBusinessDays(year, month);
    for (const day of days) {
      const dow = day.getDay();
      const ds = dateStr(day);
      for (const c of children) {
        if (!c.pattern_days.includes(dow)) continue;
        if (ds < c.contract_start_date) continue;
        scheduleRows.push({
          facility_id: FACILITY_ID,
          child_id: c.id,
          child_name: c.name,
          date: ds,
          slot: 'PM',
          has_pickup: c.needs_pickup,
          has_dropoff: c.needs_dropoff,
        });
      }
    }
  }
  n = await batchInsert('schedules', scheduleRows);
  log('スケジュール', n);

  // ======================
  // 7. USAGE RECORDS (Oct-Feb completed)
  // ======================
  console.log('\n=== 7. 利用実績（Oct-Feb） ===');

  // Query schedule IDs to link usage_records (schedule_id is NOT NULL FK)
  console.log('  ⏳ スケジュールID取得中...');
  const scheduleMap = new Map(); // key: "date|child_id" -> schedule bigint id
  let schOffset = 0;
  const pageSize = 1000;
  while (true) {
    const { data: schData, error: schErr } = await supabase
      .from('schedules')
      .select('id, date, child_id')
      .eq('facility_id', FACILITY_ID)
      .range(schOffset, schOffset + pageSize - 1);
    if (schErr) { logErr('schedule query', schErr); break; }
    if (!schData || schData.length === 0) break;
    for (const s of schData) {
      scheduleMap.set(`${s.date}|${s.child_id}`, s.id);
    }
    schOffset += schData.length;
    if (schData.length < pageSize) break;
  }
  console.log(`  ✓ スケジュールID ${scheduleMap.size}件取得`);

  const rng = seededRandom('usage-v1');
  const completedMonths = MONTH_RANGE.slice(0, 5); // Oct-Feb
  let usageRows = [];
  for (const { year, month } of completedMonths) {
    const days = getBusinessDays(year, month);
    for (const day of days) {
      const dow = day.getDay();
      const ds = dateStr(day);
      for (const c of children) {
        if (!c.pattern_days.includes(dow)) continue;
        if (ds < c.contract_start_date) continue;
        const scheduleId = scheduleMap.get(`${ds}|${c.id}`);
        if (!scheduleId) { rng(); rng(); continue; }
        const r = rng();
        const status = r < 0.88 ? '利用' : (r < 0.95 ? '欠席(加算なし)' : '加算のみ');
        usageRows.push({
          id: `ur-${ds}-${c.id}`,
          facility_id: FACILITY_ID,
          schedule_id: String(scheduleId),
          child_id: c.id,
          child_name: c.name,
          date: ds,
          service_status: status,
          planned_start_time: '13:30',
          planned_end_time: '17:00',
          actual_start_time: status === '利用' ? '13:30' : null,
          actual_end_time: status === '利用' ? '17:00' : null,
          calculated_time: 3.5,
          calculated_time_method: '計画時間から算出',
          time_category: '3時間以上',
          pickup: c.needs_pickup ? 'あり' : 'なし',
          dropoff: c.needs_dropoff ? 'あり' : 'なし',
          instruction_form: ['個別', '小集団', '集団'][Math.floor(rng() * 3)],
          billing_target: '請求する',
        });
      }
    }
  }
  n = await batchUpsert('usage_records', usageRows);
  log('利用実績', n);

  // ======================
  // 8. CONTACT LOGS (~3,500)
  // ======================
  console.log('\n=== 8. 連絡帳（6ヶ月分） ===');
  const moods = ['good', 'normal', 'tired', 'excited'];
  const appetites = ['全量', '8割', '5割', '全量'];
  const activities = [
    '個別課題（パズル・プリント学習）、集団SST（挨拶の練習）、自由遊び（ブロック）',
    '感覚統合（トランポリン・バランスボール）、音楽活動（リトミック）、おやつ作り',
    '運動プログラム（サーキット運動）、創作活動（粘土工作）、絵本読み聞かせ',
    '学習支援（宿題サポート）、集団遊び（カードゲーム）、リラクゼーション',
    'SST（買い物ごっこ）、微細運動（ビーズ通し）、音楽セッション（太鼓）',
    '体幹トレーニング、ビジョントレーニング、調理活動（おやつ作り）',
    'ソーシャルスキル（自己紹介）、アート活動（水彩画）、外遊び',
  ];
  const staffComments = [
    '今日も元気に活動に参加できました。特に集中して課題に取り組めていました。',
    '友達との関わりも上手にできていました。笑顔がたくさん見られました。',
    'やや落ち着かない様子でしたが、声かけで切り替えることができました。',
    '自分から挨拶ができ、成長を感じます。活動にも積極的でした。',
    '新しい活動にチャレンジし、最後までやり遂げることができました。',
  ];

  let contactRows = [];
  const rng2 = seededRandom('contact-v1');
  for (const { year, month } of MONTH_RANGE) {
    const days = getBusinessDays(year, month);
    for (const day of days) {
      const dow = day.getDay();
      const ds = dateStr(day);
      for (let ci = 0; ci < children.length; ci++) {
        const c = children[ci];
        if (!c.pattern_days.includes(dow)) continue;
        if (ds < c.contract_start_date) continue;
        // ~70% of schedules get contact logs
        if (rng2() > 0.70) continue;
        const staffIdx = (ci + day.getDate()) % STAFF.length;
        contactRows.push({
          id: `cl-${ds}-${c.id}`,
          facility_id: FACILITY_ID,
          child_id: c.id,
          date: ds,
          slot: 'PM',
          activities: activities[(ci + day.getDate()) % activities.length],
          health_status: 'good',
          mood: moods[(ci + day.getDate()) % moods.length],
          appetite: appetites[ci % appetites.length],
          meal_main: true,
          meal_side: ci % 3 !== 0,
          staff_comment: `${c.name.split(' ')[1]}${staffComments[(ci + day.getDate()) % staffComments.length]}`,
          staff_user_id: `hm-staff-${pad2(staffIdx + 1)}`,
          parent_message: rng2() < 0.25 ? '昨夜はよく眠れたようです。朝ごはんもしっかり食べました。' : null,
          status: 'submitted',
        });
      }
    }
  }
  n = await batchUpsert('contact_logs', contactRows);
  log('連絡帳', n);

  // ======================
  // 9. ATTENDANCE RECORDS (~1,400 over 6 months)
  // ======================
  console.log('\n=== 9. 出退勤記録（6ヶ月分） ===');
  let attendanceRows = [];
  const rng3 = seededRandom('attendance-v1');
  for (const { year, month } of MONTH_RANGE) {
    const days = getBusinessDays(year, month);
    for (const day of days) {
      const dow = day.getDay();
      const ds = dateStr(day);
      for (let si = 0; si < STAFF.length; si++) {
        const s = STAFF[si];
        // Part-timers work ~3 days/week
        if (s.empType === '非常勤' && rng3() > 0.55) continue;
        const startH = 8 + (si % 3);
        const startM = (si * 7) % 15;
        const endH = 17 + (si % 2);
        const endM = (si * 11) % 30;
        // clock in
        attendanceRows.push({
          facility_id: FACILITY_ID,
          user_id: `hm-staff-${pad2(s.idx)}`,
          date: ds,
          type: 'start',
          time: `${pad2(startH)}:${pad2(startM)}:00`,
        });
        // clock out
        attendanceRows.push({
          facility_id: FACILITY_ID,
          user_id: `hm-staff-${pad2(s.idx)}`,
          date: ds,
          type: 'end',
          time: `${pad2(endH)}:${pad2(endM)}:00`,
        });
      }
    }
  }
  n = await batchInsert('attendance_records', attendanceRows);
  log('出退勤記録', n);

  // ======================
  // 10. SHIFT PATTERNS + MONTHLY SHIFTS
  // ======================
  console.log('\n=== 10. シフト ===');
  const shiftPatterns = [
    { id: 'hm-sp-1', name: '早番', short_name: '早', start_time: '08:00', end_time: '17:00', break_minutes: 60, color: '#22c55e', display_order: 1 },
    { id: 'hm-sp-2', name: '遅番', short_name: '遅', start_time: '10:00', end_time: '19:00', break_minutes: 60, color: '#3b82f6', display_order: 2 },
    { id: 'hm-sp-3', name: '日勤', short_name: '日', start_time: '09:00', end_time: '18:00', break_minutes: 60, color: '#00c4cc', display_order: 3 },
    { id: 'hm-sp-4', name: '半日', short_name: '半', start_time: '13:00', end_time: '17:30', break_minutes: 0, color: '#f59e0b', display_order: 4 },
    { id: 'hm-sp-5', name: '休み', short_name: '休', start_time: '00:00', end_time: '00:00', break_minutes: 0, color: '#ef4444', display_order: 5, is_day_off: true },
  ];
  const spRows = shiftPatterns.map(sp => ({ ...sp, facility_id: FACILITY_ID, is_active: true, is_day_off: sp.is_day_off || false }));
  n = await batchUpsert('shift_patterns', spRows);
  log('シフトパターン', n);

  // Monthly schedules
  const monthlyScheduleRows = MONTH_RANGE.map(({ year, month }) => ({
    id: `hm-ms-${year}-${pad2(month)}`,
    facility_id: FACILITY_ID,
    year, month,
    status: month <= 2 || (year === 2025 && month <= 12) ? 'confirmed' : 'draft',
    published_at: new Date().toISOString(),
  }));
  n = await batchUpsert('monthly_shift_schedules', monthlyScheduleRows);
  log('月次シフトスケジュール', n);

  // Individual shifts
  let shiftRows = [];
  const patternIds = ['hm-sp-1', 'hm-sp-2', 'hm-sp-3', 'hm-sp-4', 'hm-sp-5'];
  const rng4 = seededRandom('shifts-v1');
  for (const { year, month } of MONTH_RANGE) {
    const days = getBusinessDays(year, month);
    const msId = `hm-ms-${year}-${pad2(month)}`;
    for (const day of days) {
      const ds = dateStr(day);
      for (let si = 0; si < STAFF.length; si++) {
        const s = STAFF[si];
        let patId;
        if (s.empType === '非常勤') {
          patId = rng4() < 0.55 ? patternIds[3] : patternIds[4]; // 半日 or 休み
        } else {
          const r = rng4();
          patId = r < 0.33 ? patternIds[0] : (r < 0.66 ? patternIds[1] : patternIds[2]); // 早/遅/日
        }
        const pat = shiftPatterns.find(p => p.id === patId);
        // Map shift pattern to shift_type (remote DB uses Japanese values)
        const shiftTypeMap = { 'hm-sp-1': '早番', 'hm-sp-2': '遅番', 'hm-sp-3': '日勤', 'hm-sp-4': '日勤', 'hm-sp-5': '休み' };
        shiftRows.push({
          id: `sh-${ds}-${s.idx}`,
          facility_id: FACILITY_ID,
          staff_id: `hm-s-${pad2(s.idx)}`,
          staff_name: `${s.last} ${s.first}`,
          date: ds,
          shift_type: shiftTypeMap[patId] || '日勤',
          shift_pattern_id: patId,
          monthly_schedule_id: msId,
          start_time: pat.start_time,
          end_time: pat.end_time,
          break_minutes: pat.break_minutes,
        });
      }
    }
  }
  n = await batchUpsert('shifts', shiftRows);
  log('シフト', n);

  // ======================
  // 11. BILLING RECORDS (~250)
  // ======================
  console.log('\n=== 11. 請求データ（5ヶ月分） ===');
  let billingRows = [];
  for (const { year, month } of completedMonths) {
    const ym = ymStr(year, month);
    for (const c of children) {
      if (c.contract_start_date > `${year}-${pad2(month)}-28`) continue;
      const daysUsed = usageRows.filter(u => u.child_id === c.id && u.date.startsWith(ym) && u.service_status === '利用').length;
      if (daysUsed === 0) continue;
      const unitPrice = 904; // 基本報酬単位
      const totalUnits = daysUsed * unitPrice;
      const totalAmount = Math.round(totalUnits * 10.84); // 地域加算込み
      const upperLimit = c.income_category === 'low_income' ? 0 : (c.income_category === 'general_low' ? 4600 : 37200);
      const copay = Math.min(totalAmount, upperLimit);

      billingRows.push({
        id: `bill-${ym}-${c.id}`,
        facility_id: FACILITY_ID,
        child_id: c.id,
        year_month: ym,
        service_type: '放課後等デイサービス',
        total_units: totalUnits,
        unit_price: unitPrice,
        total_amount: totalAmount,
        copay_amount: copay,
        insurance_amount: totalAmount - copay,
        upper_limit_amount: upperLimit,
        status: month <= 1 || (year === 2025) ? 'paid' : 'confirmed',
      });
    }
  }
  n = await batchUpsert('billing_records', billingRows);
  log('請求', n);

  // ======================
  // 12. SERVICE PLANS (25)
  // ======================
  console.log('\n=== 12. 個別支援計画 ===');
  const planRows = children.slice(0, 25).map((c, i) => ({
    id: `sp-${c.id}`,
    facility_id: FACILITY_ID,
    child_id: c.id,
    plan_type: i < 15 ? 'initial' : 'renewal',
    period_start: '2025-10-01',
    period_end: '2026-03-31',
    created_by: 'hm-staff-01',
    created_by_name: '石川 真由美',
    created_date: '2025-09-25',
    current_situation: `${c.name}は${c.characteristics.split('。')[0]}の特性があります。`,
    issues: '集団活動への参加、コミュニケーション力の向上',
    strengths: '好奇心旺盛、特定の活動への集中力が高い',
    long_term_goals: [{ goal: '集団の中で自己表現ができる', domain: '社会性' }],
    short_term_goals: [{ goal: '挨拶を自分からできる', domain: 'コミュニケーション', target_date: '2026-03-31', evaluation_criteria: '週3回以上自発的に挨拶' }],
    support_content: [{ category: 'SST', content: 'ロールプレイを通じた挨拶練習', frequency: '週2回', staff: '上田 拓也' }],
    status: 'active',
  }));
  n = await batchUpsert('service_plans', planRows);
  log('個別支援計画', n);

  // ======================
  // 13. INCIDENT REPORTS (5)
  // ======================
  console.log('\n=== 13. 苦情・事故報告 ===');
  const incidents = [
    { id: 'inc-01', type: 'near_miss', title: '送迎バス乗降時のつまずき', date: '2025-11-15T14:30:00', childIdx: 3, severity: 'low' },
    { id: 'inc-02', type: 'injury', title: '活動中の擦り傷', date: '2025-12-08T15:20:00', childIdx: 7, severity: 'low' },
    { id: 'inc-03', type: 'accident', title: '児童同士の接触事故', date: '2026-01-22T16:00:00', childIdx: 12, severity: 'medium' },
    { id: 'inc-04', type: 'complaint', title: '保護者からの連絡帳に関する要望', date: '2026-02-05T10:00:00', childIdx: 0, severity: 'low' },
    { id: 'inc-05', type: 'near_miss', title: '鍵の施錠確認漏れ', date: '2026-02-20T17:30:00', childIdx: null, severity: 'medium' },
  ];
  const incRows = incidents.map(inc => ({
    id: inc.id,
    facility_id: FACILITY_ID,
    report_type: inc.type,
    title: inc.title,
    occurred_at: inc.date,
    reported_at: inc.date,
    location: '施設内',
    child_id: inc.childIdx !== null ? children[inc.childIdx].id : null,
    child_name: inc.childIdx !== null ? children[inc.childIdx].name : null,
    reporter_id: 'hm-staff-02',
    reporter_name: '上田 拓也',
    description: `${inc.title}が発生。直ちに対応を行った。`,
    immediate_action: '現場確認、関係者への連絡を実施',
    prevention_measures: '再発防止のためマニュアルを見直し',
    severity: inc.severity,
    status: 'resolved',
    family_notified: inc.childIdx !== null,
  }));
  n = await batchUpsert('incident_reports', incRows);
  log('苦情・事故報告', n);

  // ======================
  // 14. LEADS (15)
  // ======================
  console.log('\n=== 14. リード管理 ===');
  const leadStatuses = ['new-inquiry', 'visit-scheduled', 'considering', 'waiting-benefit', 'contract-progress', 'contracted', 'lost'];
  const leadNames = ['佐藤','高橋','田村','中野','久保','相川','菅原','平野','宮崎','上野','河村','飯田','梶山','望月','今井'];
  const leadRows = leadNames.map((ln, i) => ({
    id: `lead-${pad2(i + 1)}`,
    facility_id: FACILITY_ID,
    name: `${ln} ${i % 2 === 0 ? '智子' : '太郎'}`,
    child_name: `${ln} ${i % 2 === 0 ? '翔' : 'まゆ'}`,
    status: leadStatuses[i % leadStatuses.length],
    phone: `090-${3000 + i}-${4000 + i}`,
    inquiry_source: ['devnavi', 'homepage', 'support-office', 'other'][i % 4],
    memo: i < 5 ? '見学予約済み' : null,
    expected_start_date: i < 10 ? '2026-04-01' : null,
  }));
  n = await batchUpsert('leads', leadRows);
  log('リード', n);

  // ======================
  // 15. JOB POSTINGS + APPLICATIONS
  // ======================
  console.log('\n=== 15. 求人・応募 ===');
  const jobRows = [
    { id: 'job-01', title: '【常勤】児童指導員（保育士資格歓迎）', job_type: 'full_time', employment_type: '常勤', salary_min: 230000, salary_max: 300000, salary_type: 'monthly', status: 'published', required_qualifications: ['保育士'], spots_needed: 1, description: '児童発達支援・放課後等デイサービスでの児童指導員募集', work_location: '東京都世田谷区三軒茶屋2-14-10', work_hours: '9:00-18:00（シフト制）' },
    { id: 'job-02', title: '【非常勤】送迎ドライバー兼指導員', job_type: 'part_time', employment_type: '非常勤', salary_min: 1200, salary_max: 1500, salary_type: 'hourly', status: 'published', required_qualifications: ['普通自動車免許'], spots_needed: 2, description: '送迎業務と児童の見守り', work_location: '東京都世田谷区三軒茶屋2-14-10', work_hours: '14:00-18:00（週3-4日）' },
    { id: 'job-03', title: '【常勤】言語聴覚士（ST）', job_type: 'full_time', employment_type: '常勤', salary_min: 280000, salary_max: 350000, salary_type: 'monthly', status: 'published', required_qualifications: ['言語聴覚士'], spots_needed: 1, description: '言語療育を中心とした専門支援', work_location: '東京都世田谷区三軒茶屋2-14-10', work_hours: '9:00-18:00' },
  ].map(j => ({ ...j, facility_id: FACILITY_ID, published_at: '2026-02-01T00:00:00Z' }));
  n = await batchUpsert('job_postings', jobRows);
  log('求人', n);

  // Create dummy applicant users for job applications
  const applicantUsers = Array.from({ length: 5 }, (_, i) => ({
    id: `hm-applicant-${pad2(i + 1)}`,
    name: `応募者${i + 1}`,
    email: `applicant${i + 1}@example.com`,
    login_id: `applicant${i + 1}@example.com`,
    password_hash: passwordHash,
    role: 'staff', user_type: 'staff',
    account_status: 'active', has_account: true,
  }));
  await batchUpsert('users', applicantUsers);

  const appRows = [
    { id: 'app-01', job_posting_id: 'job-01', applicant_user_id: 'hm-applicant-01', status: 'interview_scheduled', cover_message: '保育士として5年の経験があります。', interview_date: '2026-03-10T10:00:00Z' },
    { id: 'app-02', job_posting_id: 'job-01', applicant_user_id: 'hm-applicant-02', status: 'screening', cover_message: '児童福祉施設での勤務経験があります。' },
    { id: 'app-03', job_posting_id: 'job-02', applicant_user_id: 'hm-applicant-03', status: 'applied', cover_message: '送迎業務に興味があります。' },
    { id: 'app-04', job_posting_id: 'job-02', applicant_user_id: 'hm-applicant-04', status: 'applied', cover_message: '週4日勤務希望です。' },
    { id: 'app-05', job_posting_id: 'job-03', applicant_user_id: 'hm-applicant-05', status: 'screening', cover_message: 'ST として病院勤務7年の経験があります。' },
  ];
  n = await batchUpsert('job_applications', appRows);
  log('応募', n);

  // ======================
  // 16. CHAT MESSAGES (~200)
  // ======================
  console.log('\n=== 16. チャットメッセージ ===');
  const chatTemplatesParent = [
    'いつもお世話になっております。明日はお休みさせていただきます。',
    '今日の様子はいかがでしたか？家でも頑張っています。',
    '来週の予定について確認させてください。',
    '最近、家でも自分から挨拶できるようになりました。ありがとうございます。',
    '体調が少し心配なので、様子を見ていただけると助かります。',
    '先日のイベント、とても楽しかったようです。ありがとうございました。',
    '受給者証の更新が完了しました。新しい番号をお伝えします。',
    '送迎の時間を変更していただくことは可能でしょうか？',
  ];
  const chatTemplatesStaff = [
    'ご連絡ありがとうございます。承知いたしました。',
    '今日は楽しく活動に参加できていましたよ。詳しくは連絡帳でお伝えします。',
    'ご安心ください。しっかり見守らせていただきます。',
    'それは素晴らしいですね！施設でも引き続きサポートしていきます。',
    '体調の件、注意して見させていただきます。何かあればすぐにご連絡します。',
    '次回の個別支援計画の面談日程をご相談させてください。',
  ];
  let chatRows = [];
  const rng5 = seededRandom('chat-v1');
  // 各parent 8通ずつ
  for (let pi = 0; pi < 25; pi++) {
    const parentId = `hm-parent-${pad2(pi + 1)}`;
    const parentName = `${PARENTS[pi].last} ${PARENTS[pi].first}`;
    for (let mi = 0; mi < 8; mi++) {
      const isParent = mi % 2 === 0;
      const dayOffset = -(mi * 3 + pi);
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      chatRows.push({
        id: `chat-${parentId}-${pad2(mi + 1)}`,
        facility_id: FACILITY_ID,
        client_user_id: parentId,
        sender_id: isParent ? parentId : 'hm-staff-01',
        sender_type: isParent ? 'client' : 'staff',
        sender_name: isParent ? parentName : '石川 真由美',
        message: isParent
          ? chatTemplatesParent[mi % chatTemplatesParent.length]
          : chatTemplatesStaff[(mi >> 1) % chatTemplatesStaff.length],
        is_read: true,
        created_at: d.toISOString(),
      });
    }
  }
  n = await batchUpsert('chat_messages', chatRows);
  log('チャット', n);

  // ======================
  // 17. MANAGEMENT TARGETS (6 months)
  // ======================
  console.log('\n=== 17. 経営目標 ===');
  const mgmtRows = MONTH_RANGE.map(({ year, month }) => ({
    id: `mt-${year}-${pad2(month)}`,
    facility_id: FACILITY_ID,
    year, month,
    target_revenue: 8500000 + (month % 3) * 500000,
    target_occupancy_rate: 85.0 + (month % 4) * 2,
    daily_price_per_child: 12000,
    total_fixed_cost: 3200000,
    total_variable_cost: 800000 + month * 50000,
  }));
  n = await batchUpsert('management_targets', mgmtRows);
  log('経営目標', n);

  // ======================
  // 18. EXPENSES (75 over 5 months)
  // ======================
  console.log('\n=== 18. 経費データ ===');
  const expCategories = ['人件費', '通信費', '水道光熱費', '消耗品費', '車両費', '研修費', '食材費', '印刷費', '保険料', '修繕費'];
  let expRows = [];
  for (const { year, month } of completedMonths) {
    for (let i = 0; i < 15; i++) {
      const cat = expCategories[i % expCategories.length];
      const amount = [12000, 8500, 25000, 5600, 15000, 32000, 18000, 4200, 45000, 8800][i % 10] + (month * 100);
      const submitter = `hm-staff-${pad2((i % STAFF.length) + 1)}`;
      expRows.push({
        id: `exp-${year}${pad2(month)}-${pad2(i + 1)}`,
        facility_id: FACILITY_ID,
        staff_id: submitter,
        submitted_by_user_id: submitter,
        title: `${cat}（${month}月分）`,
        amount,
        expense_date: `${year}-${pad2(month)}-${pad2(5 + i)}`,
        category: cat,
        status: 'approved',
        approved_by: 'hm-staff-01',
        approved_at: new Date().toISOString(),
      });
    }
  }
  n = await batchUpsert('expenses', expRows);
  log('経費', n);

  // ======================
  // 19. CASHFLOW ENTRIES (90 over 6 months)
  // ======================
  console.log('\n=== 19. キャッシュフロー ===');
  let cfRows = [];
  const cfBalanceRows = [];
  for (let mi = 0; mi < MONTH_RANGE.length; mi++) {
    const { year, month } = MONTH_RANGE[mi];
    const ym = ymStr(year, month);
    const baseIncome = 7500000 + mi * 200000;
    cfRows.push(
      { id: `cf-${ym}-inc-1`, facility_id: FACILITY_ID, year_month: ym, category: 'income', subcategory: 'benefits', item_name: '給付費収入', amount: Math.round(baseIncome * 0.8), sort_order: 1 },
      { id: `cf-${ym}-inc-2`, facility_id: FACILITY_ID, year_month: ym, category: 'income', subcategory: 'copay', item_name: '利用者負担金', amount: Math.round(baseIncome * 0.1), sort_order: 2 },
      { id: `cf-${ym}-inc-3`, facility_id: FACILITY_ID, year_month: ym, category: 'income', subcategory: 'additions', item_name: '各種加算収入', amount: Math.round(baseIncome * 0.08), sort_order: 3 },
      { id: `cf-${ym}-inc-4`, facility_id: FACILITY_ID, year_month: ym, category: 'income', subcategory: 'subsidy', item_name: '補助金収入', amount: 150000, sort_order: 4 },
      { id: `cf-${ym}-exp-1`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'personnel', item_name: '人件費', amount: 3800000 + mi * 30000, sort_order: 10 },
      { id: `cf-${ym}-exp-2`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'operations', item_name: '事業費', amount: 450000, sort_order: 11 },
      { id: `cf-${ym}-exp-3`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'admin', item_name: '管理費', amount: 350000, sort_order: 12 },
      { id: `cf-${ym}-exp-4`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'operations', item_name: '車両・送迎費', amount: 120000, sort_order: 13 },
      { id: `cf-${ym}-exp-5`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'admin', item_name: '家賃', amount: 280000, sort_order: 14 },
      { id: `cf-${ym}-exp-6`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'operations', item_name: '教材・消耗品費', amount: 85000, sort_order: 15 },
      { id: `cf-${ym}-exp-7`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'admin', item_name: '水道光熱費', amount: 65000, sort_order: 16 },
      { id: `cf-${ym}-exp-8`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'admin', item_name: '通信費', amount: 35000, sort_order: 17 },
      { id: `cf-${ym}-exp-9`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'other', item_name: '保険料', amount: 45000, sort_order: 18 },
      { id: `cf-${ym}-exp-10`, facility_id: FACILITY_ID, year_month: ym, category: 'expense', subcategory: 'other', item_name: '雑費', amount: 25000, sort_order: 19 },
    );
    cfBalanceRows.push({
      id: `cfb-${ym}`,
      facility_id: FACILITY_ID,
      year_month: ym,
      opening_balance: 5000000 + mi * 350000,
    });
  }
  n = await batchUpsert('cashflow_entries', cfRows);
  log('キャッシュフロー', n);
  n = await batchUpsert('cashflow_balances', cfBalanceRows);
  log('キャッシュフロー残高', n);

  // ======================
  // 20. TRAINING RECORDS (12)
  // ======================
  console.log('\n=== 20. 研修記録 ===');
  const trainings = [
    { id: 'hm-tr-01', title: '虐待防止研修（全体）', date: '2025-10-20', type: 'internal', numP: 12 },
    { id: 'hm-tr-02', title: '感染症対策研修', date: '2025-10-28', type: 'internal', numP: 12 },
    { id: 'hm-tr-03', title: 'ASD児への支援技法', date: '2025-11-10', type: 'external', numP: 4 },
    { id: 'hm-tr-04', title: '救命救急講習（普通）', date: '2025-11-22', type: 'external', numP: 6 },
    { id: 'hm-tr-05', title: '個別支援計画作成研修', date: '2025-12-05', type: 'internal', numP: 5 },
    { id: 'hm-tr-06', title: '安全運転講習', date: '2025-12-18', type: 'external', numP: 4 },
    { id: 'hm-tr-07', title: '身体拘束適正化研修', date: '2026-01-15', type: 'internal', numP: 12 },
    { id: 'hm-tr-08', title: 'ペアレントトレーニング指導者養成', date: '2026-01-25', type: 'external', numP: 3 },
    { id: 'hm-tr-09', title: '防災訓練・BCP研修', date: '2026-02-05', type: 'internal', numP: 12 },
    { id: 'hm-tr-10', title: '情報セキュリティ研修', date: '2026-02-15', type: 'internal', numP: 12 },
    { id: 'hm-tr-11', title: 'SST指導法研修', date: '2026-02-25', type: 'external', numP: 5 },
    { id: 'hm-tr-12', title: 'コンプライアンス研修', date: '2026-03-01', type: 'internal', numP: 12 },
  ];
  const trRows = trainings.map(t => ({
    id: t.id, facility_id: FACILITY_ID,
    title: t.title, training_date: t.date, training_type: t.type,
    description: `${t.title}を実施。参加者${t.numP}名。`,
    participants: STAFF.slice(0, t.numP).map(s => ({ name: `${s.last} ${s.first}`, attended: true })),
    status: 'completed', created_by: 'hm-staff-01',
  }));
  n = await batchUpsert('training_records', trRows);
  log('研修記録', n);

  // ======================
  // 21. COMMITTEE MEETINGS (8)
  // ======================
  console.log('\n=== 21. 委員会議事録 ===');
  const committees = [
    { id: 'hm-cm-01', type: 'operation_promotion', name: '運営推進会議', date: '2025-10-15' },
    { id: 'hm-cm-02', type: 'abuse_prevention', name: '虐待防止委員会', date: '2025-11-20' },
    { id: 'hm-cm-03', type: 'restraint_review', name: '身体拘束適正化委員会', date: '2025-12-18' },
    { id: 'hm-cm-04', type: 'safety', name: '安全衛生委員会', date: '2026-01-15' },
    { id: 'hm-cm-05', type: 'operation_promotion', name: '運営推進会議（第2回）', date: '2026-01-20' },
    { id: 'hm-cm-06', type: 'quality_improvement', name: '第三者評価・品質改善委員会', date: '2026-02-10' },
    { id: 'hm-cm-07', type: 'abuse_prevention', name: '虐待防止委員会（第2回）', date: '2026-02-20' },
    { id: 'hm-cm-08', type: 'infection_control', name: '感染症対策委員会', date: '2026-03-01' },
  ];
  const cmRows = committees.map(cm => ({
    id: cm.id, facility_id: FACILITY_ID,
    committee_type: cm.type, committee_name: cm.name,
    meeting_date: cm.date, start_time: '10:00', end_time: '11:30',
    location: '施設会議室', meeting_type: 'regular',
    attendees: STAFF.slice(0, 5).map(s => ({ name: `${s.last} ${s.first}`, role: s.dept, attended: true })),
    facilitator_name: '石川 真由美', recorder_name: '上田 拓也',
    agenda: [{ title: '前回の振り返り', content: '前回決定事項の進捗確認', decision: '概ね順調に進行中' }],
    decisions: '次回までにマニュアルの改訂を完了する',
    status: 'finalized', created_by: 'hm-staff-01',
  }));
  n = await batchUpsert('committee_meetings', cmRows);
  log('委員会', n);

  // ======================
  // 22. AUDIT LOGS (50)
  // ======================
  console.log('\n=== 22. 監査ログ ===');
  const auditActions = ['create', 'update', 'login', 'export', 'view_sensitive'];
  const auditResources = ['child', 'staff', 'usage_record', 'support_plan', 'billing', 'settings'];
  let auditRows = [];
  for (let i = 0; i < 50; i++) {
    const dayOffset = -Math.floor(i * 3.5);
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    const staffIdx = i % STAFF.length;
    auditRows.push({
      id: `audit-${pad2(i + 1)}`,
      facility_id: FACILITY_ID,
      user_id: `hm-staff-${pad2(staffIdx + 1)}`,
      user_name: `${STAFF[staffIdx].last} ${STAFF[staffIdx].first}`,
      action: auditActions[i % auditActions.length],
      resource_type: auditResources[i % auditResources.length],
      resource_id: `resource-${i}`,
      details: { description: `操作${i + 1}の詳細` },
      created_at: d.toISOString(),
    });
  }
  n = await batchUpsert('audit_logs', auditRows);
  log('監査ログ', n);

  // ======================
  // 23. PAID LEAVE BALANCES
  // ======================
  console.log('\n=== 23. 有給残日数 ===');
  const leaveRows = STAFF.map(s => ({
    id: `plb-hm-${pad2(s.idx)}`,
    facility_id: FACILITY_ID,
    user_id: `hm-staff-${pad2(s.idx)}`,
    fiscal_year: 2025,
    total_days: s.empType === '常勤' ? 20 : 10,
    used_days: Math.floor(s.years / 3),
    granted_date: '2025-04-01',
    expires_date: '2027-03-31',
  }));
  n = await batchUpsert('paid_leave_balances', leaveRows);
  log('有給残日数', n);

  // ======================
  // 24. PERSONNEL SETTINGS
  // ======================
  console.log('\n=== 24. 人員配置設定 ===');
  const personnelRows = [
    { id: `hm-ps-01`, staff_id: `hm-s-01`, facility_id: FACILITY_ID, is_service_manager: true, is_manager: true, manager_concurrent_role: '児童発達支援管理責任者', assigned_addition_codes: ['kahai_senmon'] },
    { id: `hm-ps-02`, staff_id: `hm-s-02`, facility_id: FACILITY_ID, is_service_manager: false, is_manager: false, assigned_addition_codes: ['kahai_kansan'] },
    { id: `hm-ps-03`, staff_id: `hm-s-03`, facility_id: FACILITY_ID, is_service_manager: false, is_manager: false, assigned_addition_codes: ['senmon_taisei'] },
    { id: `hm-ps-06`, staff_id: `hm-s-06`, facility_id: FACILITY_ID, is_service_manager: false, is_manager: false, assigned_addition_codes: ['senmon_taisei'] },
    { id: `hm-ps-07`, staff_id: `hm-s-07`, facility_id: FACILITY_ID, is_service_manager: false, is_manager: false, assigned_addition_codes: ['kahai_senmon'] },
    { id: `hm-ps-08`, staff_id: `hm-s-08`, facility_id: FACILITY_ID, is_service_manager: false, is_manager: false, assigned_addition_codes: ['senmon_taisei'] },
  ];
  n = await batchUpsert('staff_personnel_settings', personnelRows);
  log('人員配置設定', n);

  // ======================
  // 25. TRANSPORT ASSIGNMENTS (6 months)
  // ======================
  console.log('\n=== 25. 送迎体制 ===');
  let transportRows = [];
  for (const { year, month } of MONTH_RANGE) {
    const days = getBusinessDays(year, month);
    for (const day of days) {
      const ds = dateStr(day);
      const di = day.getDate() % 4;
      transportRows.push({
        id: `ta-${ds}`,
        facility_id: FACILITY_ID,
        date: ds,
        pickup_driver_staff_id: staffIds[di % staffIds.length],
        pickup_attendant_staff_id: staffIds[(di + 2) % staffIds.length],
        dropoff_driver_staff_id: staffIds[(di + 1) % staffIds.length],
        dropoff_attendant_staff_id: staffIds[(di + 3) % staffIds.length],
        pickup_time: '09:00',
        dropoff_time: '17:00',
        vehicle_info: di % 2 === 0 ? 'ハイエース（白）' : 'キャラバン（青）',
      });
    }
  }
  n = await batchUpsert('daily_transport_assignments', transportRows);
  log('送迎体制', n);

  // ======================
  // 26. BCP, ABUSE PREVENTION, REGULATIONS, etc.
  // ======================
  console.log('\n=== 26. BCP・虐待防止・規定等 ===');

  // BCP Plans
  const bcpRows = [
    { id: 'hm-bcp-1', plan_type: '地震', title: '地震発生時の事業継続計画' },
    { id: 'hm-bcp-2', plan_type: '水害', title: '水害発生時の事業継続計画' },
    { id: 'hm-bcp-3', plan_type: '感染症', title: '感染症蔓延時の事業継続計画' },
    { id: 'hm-bcp-4', plan_type: '火災', title: '火災発生時の事業継続計画' },
  ].map(b => ({
    ...b, facility_id: FACILITY_ID, version: '1.0', status: 'active',
    content: { overview: `${b.plan_type}発生時の対応手順`, last_drill: '2025-12-15', evacuation_route: '正面玄関→駐車場→三軒茶屋公園' },
    last_reviewed_at: '2025-12-15T00:00:00Z', next_review_date: '2026-04-01',
    created_by: 'hm-staff-01',
  }));
  n = await batchUpsert('bcp_plans', bcpRows);
  log('BCP計画', n);

  // BCP Emergency Contacts
  const ecRows = [
    { name: '石川 真由美', role: '施設管理者', phone: '090-1101-2201', priority: 1 },
    { name: '上田 拓也', role: '副管理者', phone: '090-1102-2202', priority: 2 },
    { name: '世田谷消防署', role: '消防', phone: '03-3411-0119', priority: 3 },
    { name: '世田谷区役所 障害福祉課', role: '行政', phone: '03-5432-2388', priority: 4 },
    { name: '国立成育医療研究センター', role: '医療機関', phone: '03-3416-0181', priority: 5 },
  ].map((ec, i) => ({
    id: `hm-ec-${i + 1}`, facility_id: FACILITY_ID, bcp_plan_id: 'hm-bcp-1',
    contact_name: ec.name, role: ec.role, phone: ec.phone, priority: ec.priority,
  }));
  n = await batchUpsert('bcp_emergency_contacts', ecRows);
  log('緊急連絡先', n);

  // Abuse prevention records
  const apRows = [
    { id: 'hm-ap-1', type: 'committee', title: '第1回虐待防止委員会', date: '2025-10-15' },
    { id: 'hm-ap-2', type: 'committee', title: '第2回虐待防止委員会', date: '2026-01-20' },
    { id: 'hm-ap-3', type: 'committee', title: '第3回虐待防止委員会', date: '2026-03-01' },
    { id: 'hm-ap-4', type: 'restraint', title: '身体拘束適正化委員会（第1回）', date: '2025-11-20' },
    { id: 'hm-ap-5', type: 'restraint', title: '身体拘束適正化委員会（第2回）', date: '2026-02-15' },
  ].map(({ id, type, title, date }) => ({
    id, facility_id: FACILITY_ID, record_type: type, title, date,
    participants: STAFF.slice(0, 6).map(s => `${s.last} ${s.first}`),
    content: { summary: `${title}の議事録。各委員から意見を聴取し方針決定。`, decisions: ['研修計画の見直し', 'チェックリストの更新'] },
    status: 'completed', created_by: 'hm-staff-01',
  }));
  n = await batchUpsert('abuse_prevention_records', apRows);
  log('虐待防止記録', n);

  // Overtime agreement
  await supabase.from('overtime_agreements').upsert({
    id: 'hm-oa-2025', facility_id: FACILITY_ID, fiscal_year: 2025,
    monthly_limit_hours: 45, annual_limit_hours: 360,
    special_monthly_limit: 80, special_months_limit: 6,
    effective_from: '2025-04-01', effective_to: '2026-03-31',
  }, { onConflict: 'id' });
  log('36協定', 1);

  // Staff qualifications
  const qualRows = [];
  for (const s of STAFF) {
    for (let qi = 0; qi < s.quals.length; qi++) {
      qualRows.push({
        id: `hm-sq-${s.idx}-${qi + 1}`,
        user_id: `hm-staff-${pad2(s.idx)}`,
        facility_id: FACILITY_ID,
        qualification_name: s.quals[qi],
        status: 'active',
        issued_date: `${2024 - s.years + qi}-04-01`,
      });
    }
  }
  n = await batchUpsert('staff_qualifications', qualRows);
  log('資格記録', n);

  // Career development records
  const cdrRows = [
    { userId: 'hm-staff-01', type: 'promotion', title: 'マネージャー昇格', date: '2023-04-01' },
    { userId: 'hm-staff-01', type: 'qualification', title: '児童発達支援管理責任者取得', date: '2015-04-01' },
    { userId: 'hm-staff-02', type: 'evaluation', title: '年度評価A（2025年度）', date: '2026-01-15' },
    { userId: 'hm-staff-03', type: 'qualification', title: '感覚統合療法認定取得', date: '2019-07-01' },
    { userId: 'hm-staff-06', type: 'evaluation', title: '年度評価A+（2025年度）', date: '2026-01-15' },
    { userId: 'hm-staff-07', type: 'qualification', title: '保健師資格取得', date: '2012-03-20' },
  ].map((cr, i) => ({
    id: `hm-cdr-${i + 1}`, user_id: cr.userId, facility_id: FACILITY_ID,
    record_type: cr.type, title: cr.title, recorded_date: cr.date,
    description: cr.title,
  }));
  n = await batchUpsert('career_development_records', cdrRows);
  log('キャリア記録', n);

  // Regulation acknowledgments
  const regIds = ['reg-employment', 'reg-compensation', 'reg-welfare', 'reg-safety'];
  let ackRows = [];
  for (const sid of staffUserIds.slice(0, 8)) {
    for (const rid of regIds) {
      ackRows.push({
        id: `ack-${sid}-${rid}`,
        regulation_id: rid, user_id: sid, facility_id: FACILITY_ID,
        acknowledged_at: new Date().toISOString(),
      });
    }
  }
  n = await batchUpsert('regulation_acknowledgments', ackRows);
  log('規定確認', n);

  // ======================
  // SUMMARY
  // ======================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(`║          大規模デモデータ投入完了！ (${elapsed}秒)          ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝`);
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
施設: ひまわり放課後等デイサービス
ID:   ${FACILITY_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【データ投入サマリー】
  スタッフ:        12名 (常勤6名 + 非常勤6名)
  保護者:          25家庭
  児童:            50名 (兄弟8組)
  スケジュール:    ${scheduleRows.length}件 (6ヶ月分)
  利用実績:        ${usageRows.length}件 (5ヶ月分)
  連絡帳:          ${contactRows.length}件
  出退勤記録:      ${attendanceRows.length}件
  シフト:          ${shiftRows.length}件 + ${monthlyScheduleRows.length}月分
  請求:            ${billingRows.length}件
  個別支援計画:    ${planRows.length}件
  苦情・事故報告:  ${incRows.length}件
  リード:          ${leadRows.length}件
  求人:            ${jobRows.length}件 + 応募${appRows.length}件
  チャット:        ${chatRows.length}件
  経営目標:        ${mgmtRows.length}件
  経費:            ${expRows.length}件
  キャッシュフロー: ${cfRows.length}件
  研修:            ${trRows.length}件
  委員会:          ${cmRows.length}件
  監査ログ:        ${auditRows.length}件

【オーナーアクセス】
  ログイン: koya.htk@gmail.com（既存アカウント）
  → 施設選択で「ひまわり放課後等デイサービス」を選択

【スタッフアカウント】(パスワード: demo1234)
${STAFF.map(s => `  ${s.last} ${s.first}`.padEnd(14) + ` ${s.lastK.toLowerCase()}@himawari-demo.jp`.padEnd(36) + ` (${s.role}/${s.empType}/${s.dept})`).join('\n')}

【保護者アカウント】(パスワード: demo1234)
  各保護者: {姓カナ小文字}@himawari-parent.jp

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
