import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://iskgcqzozsemlmbvubna.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI'
);

async function run() {
  // Step 1: Check if column already exists
  const { data: existCheck } = await supabase
    .from('staff_documents')
    .select('document_category')
    .limit(1);

  if (existCheck !== null) {
    console.log('Column document_category already exists, checking data...');
  } else {
    console.log('Column does not exist yet. Adding it via direct query...');
    // We can't run ALTER TABLE via the JS client, need to use the SQL editor / dashboard
    // Instead, let's try adding the column by inserting a test and checking
    console.log('Please run this SQL in the Supabase Dashboard SQL editor:');
    console.log(`
ALTER TABLE staff_documents
  ADD COLUMN IF NOT EXISTS document_category TEXT DEFAULT 'distributed';
    `);
  }

  // Step 2: Update received documents
  const receivedTypes = [
    'resume', 'qualification_cert', 'work_experience', 'career_history',
    'health_checkup', 'confidentiality_agreement', 'id_document',
    'commute_certificate', 'tax_withholding_form', 'other_received',
  ];

  const { data: receivedUpdate, error: recErr } = await supabase
    .from('staff_documents')
    .update({ document_category: 'received' })
    .in('document_type', receivedTypes)
    .select('id');

  if (recErr) {
    console.error('Error updating received docs:', recErr.message);
    // Column might not exist yet - try adding via a different approach
    if (recErr.message.includes('document_category')) {
      console.log('\nColumn does not exist. Creating via workaround...');
      // Use rpc if available, otherwise instruct user
      console.log('Run this SQL in Supabase Dashboard → SQL Editor:');
      console.log(`ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS document_category TEXT DEFAULT 'distributed';`);
      console.log(`CREATE INDEX IF NOT EXISTS idx_staff_documents_category ON staff_documents(document_category);`);
      return;
    }
  } else {
    console.log(`Updated ${receivedUpdate?.length || 0} docs to 'received'`);
  }

  // Step 3: Update distributed documents
  const distributedTypes = [
    'payslip', 'wage_notice', 'employment_contract', 'social_insurance',
    'withholding_tax', 'year_end_adjustment', 'employment_regulation',
  ];

  const { data: distUpdate, error: distErr } = await supabase
    .from('staff_documents')
    .update({ document_category: 'distributed' })
    .in('document_type', distributedTypes)
    .select('id');

  if (distErr) {
    console.error('Error updating distributed docs:', distErr.message);
  } else {
    console.log(`Updated ${distUpdate?.length || 0} docs to 'distributed'`);
  }

  // Step 4: Verify
  const { data: stats } = await supabase
    .from('staff_documents')
    .select('document_category');

  if (stats) {
    const received = stats.filter(d => d.document_category === 'received').length;
    const distributed = stats.filter(d => d.document_category === 'distributed').length;
    const nullCat = stats.filter(d => !d.document_category).length;
    console.log(`\nVerification:`);
    console.log(`  Total: ${stats.length}`);
    console.log(`  Received: ${received}`);
    console.log(`  Distributed: ${distributed}`);
    console.log(`  Null/unset: ${nullCat}`);
  }
}

run().catch(console.error);
