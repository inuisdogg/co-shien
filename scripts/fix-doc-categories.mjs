import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://iskgcqzozsemlmbvubna.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI'
);

// Title pattern -> { type, category }
const TITLE_RULES = [
  // Received documents (from staff)
  { pattern: /履歴書/, type: 'resume', category: 'received' },
  { pattern: /職務経歴書/, type: 'career_history', category: 'received' },
  { pattern: /実務経験/, type: 'work_experience', category: 'received' },
  { pattern: /資格証|保育士証|PT資格/, type: 'qualification_cert', category: 'received' },
  { pattern: /修了証|研修/, type: 'qualification_cert', category: 'received' },
  { pattern: /秘密保持|誓約書/, type: 'confidentiality_agreement', category: 'received' },
  { pattern: /健康診断/, type: 'health_checkup', category: 'received' },
  { pattern: /就労証明/, type: 'other_received', category: 'received' },
  { pattern: /離職票/, type: 'other_received', category: 'received' },
  { pattern: /資格喪失/, type: 'other_received', category: 'received' },
  { pattern: /マイナンバー/, type: 'id_document', category: 'received' },
  { pattern: /扶養控除/, type: 'tax_withholding_form', category: 'received' },
  { pattern: /通勤届/, type: 'commute_certificate', category: 'received' },

  // Distributed documents (to staff)
  { pattern: /労働条件通知|雇用契約/, type: 'employment_contract', category: 'distributed' },
  { pattern: /賃金通知|辞令/, type: 'wage_notice', category: 'distributed' },
  { pattern: /給与明細/, type: 'payslip', category: 'distributed' },
  { pattern: /源泉徴収/, type: 'withholding_tax', category: 'distributed' },
  { pattern: /社会保険|雇用保険|被保険者/, type: 'social_insurance', category: 'distributed' },
  { pattern: /就業規則/, type: 'employment_regulation', category: 'distributed' },
  { pattern: /採用通知/, type: 'other_distributed', category: 'distributed' },

  // Facility-level docs (received/stored)
  { pattern: /指定通知|協力医療|使用貸借|協定書/, type: 'other_received', category: 'received' },
];

async function run() {
  const { data: docs } = await supabase
    .from('staff_documents')
    .select('id, title, document_type, document_category');

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    let matched = false;
    for (const rule of TITLE_RULES) {
      if (rule.pattern.test(doc.title)) {
        const updates = {};
        if (doc.document_type === 'other') {
          updates.document_type = rule.type;
        }
        updates.document_category = rule.category;

        // Also fix: documents already typed correctly but wrong category
        if (doc.document_category !== rule.category || doc.document_type === 'other') {
          const { error } = await supabase
            .from('staff_documents')
            .update(updates)
            .eq('id', doc.id);
          if (error) {
            console.error(`Error updating ${doc.id}:`, error.message);
          } else {
            console.log(`  ${doc.title} → type:${updates.document_type || doc.document_type} cat:${rule.category}`);
            updated++;
          }
        }
        matched = true;
        break;
      }
    }
    if (!matched && doc.document_type === 'other') {
      // Default: if title doesn't match any pattern, assume received
      const { error } = await supabase
        .from('staff_documents')
        .update({ document_category: 'received', document_type: 'other_received' })
        .eq('id', doc.id);
      if (!error) {
        console.log(`  ${doc.title} → type:other_received cat:received (default)`);
        updated++;
      }
    }
  }

  console.log(`\nUpdated: ${updated}`);

  // Verify
  const { data: all } = await supabase.from('staff_documents').select('document_category, document_type');
  const received = all.filter(d => d.document_category === 'received').length;
  const distributed = all.filter(d => d.document_category === 'distributed').length;
  console.log(`\nFinal: ${all.length} total, ${received} received, ${distributed} distributed`);

  // Type distribution
  const types = {};
  for (const d of all) {
    types[d.document_type] = (types[d.document_type] || 0) + 1;
  }
  console.log('\nBy type:');
  for (const [t, c] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c}`);
  }
}

run().catch(console.error);
