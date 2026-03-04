/**
 * staff_documents のタイトル・ファイル名修正スクリプト
 *
 * - タイトルからスタッフ名を除去（書類は既にuser_idで紐づいているため冗長）
 * - file_name を簡略化したタイトル + ".pdf" に変更
 * - 施設レベルの書類（指定通知書、協力医療機関協定書、使用貸借契約書）はそのまま
 *
 * Usage: node scripts/fix-doc-titles.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const FACILITY_ID = 'facility-1770623012121';

// Names to strip from titles (longer/more specific patterns first to avoid partial matches)
const NAMES_TO_STRIP = [
  '長尾麻由子(旧姓清田) ',
  '長尾麻由子 ',
  '佐野春津代 ',
  '宮古萌慧 ',
  '酒井くるみ ',
  '一木朋恵 ',
  '平井菜央 ',
  '大石瑠美 ',
  '水石晶子 ',
  '畠昂哉 ',
];

function stripName(title) {
  for (const name of NAMES_TO_STRIP) {
    if (title.startsWith(name)) {
      return title.slice(name.length);
    }
  }
  return title; // No name found — return as-is (facility-level docs)
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  staff_documents タイトル・ファイル名修正         ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Step 1: Query all staff_documents for the facility where file_name starts with '履歴書等'
  const { data: docs, error: fetchError } = await supabase
    .from('staff_documents')
    .select('id, title, file_name, user_id')
    .eq('facility_id', FACILITY_ID)
    .like('file_name', '履歴書等%');

  if (fetchError) {
    console.error('Fetch error:', fetchError.message);
    process.exit(1);
  }

  console.log(`  対象ドキュメント数: ${docs.length}件\n`);

  if (docs.length === 0) {
    console.log('  対象なし — 終了');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    const newTitle = stripName(doc.title);
    const newFileName = newTitle + '.pdf';

    // Skip if title didn't change (facility-level docs without person name)
    if (newTitle === doc.title) {
      console.log(`  - [SKIP] ${doc.title} (名前なし、変更不要)`);
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('staff_documents')
      .update({
        title: newTitle,
        file_name: newFileName,
      })
      .eq('id', doc.id);

    if (updateError) {
      console.error(`  x [FAIL] ${doc.title} -> ${updateError.message}`);
      failed++;
    } else {
      console.log(`  o [OK]   "${doc.title}" -> "${newTitle}" (file: ${newFileName})`);
      updated++;
    }
  }

  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  結果: ${updated} 更新 / ${skipped} スキップ / ${failed} 失敗 (全${docs.length}件)`);

  // Step 2: Verify by re-fetching
  console.log('\n  === 更新後の確認 ===\n');
  const { data: verifyDocs } = await supabase
    .from('staff_documents')
    .select('title, file_name')
    .eq('facility_id', FACILITY_ID)
    .like('file_name', '%.pdf')
    .order('title');

  for (const d of (verifyDocs || [])) {
    console.log(`  ${d.title.padEnd(40)} | ${d.file_name}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
