import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://iskgcqzozsemlmbvubna.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI'
);

async function run() {
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, user_id')
    .eq('facility_id', 'facility-1770623012121');

  const staffMap = new Map(staff.map(s => [s.user_id, s.name]));
  const nameToUserId = new Map();
  for (const s of staff) {
    // Map various name forms
    const fullName = s.name.replace(/\s+/g, '');
    nameToUserId.set(fullName, s.user_id);
    // Also individual parts
    const parts = s.name.split(/[\s　]+/);
    for (const p of parts) {
      if (p.length >= 2) nameToUserId.set(p, s.user_id);
    }
  }

  console.log('=== Staff Map ===');
  staff.forEach(s => console.log(`  ${s.user_id} -> ${s.name}`));

  const { data: docs } = await supabase
    .from('staff_documents')
    .select('id, title, user_id, file_url')
    .eq('facility_id', 'facility-1770623012121')
    .order('user_id');

  console.log(`\n=== All ${docs.length} documents ===`);

  const issues = [];
  for (const doc of docs) {
    const assignedStaff = staffMap.get(doc.user_id) || 'UNKNOWN';
    const pathUserId = doc.file_url.match(/staff-docs\/[^/]+\/([^/]+)\//)?.[1] || 'N/A';
    const pathMatch = pathUserId === doc.user_id;

    // Check if title suggests a different staff member
    let suggestedOwner = null;
    for (const [name, userId] of nameToUserId) {
      if (doc.title.includes(name) && userId !== doc.user_id) {
        suggestedOwner = { name, userId, staffName: staffMap.get(userId) };
        break;
      }
    }

    if (!pathMatch || suggestedOwner) {
      issues.push({
        id: doc.id,
        title: doc.title,
        assignedTo: `${assignedStaff} (${doc.user_id})`,
        filePath: pathUserId,
        suggestedOwner,
        pathMismatch: !pathMatch,
      });
    }
  }

  console.log(`\nFound ${issues.length} potential mismatches:`);
  for (const i of issues) {
    console.log(`\n  ISSUE: "${i.title}"`);
    console.log(`    Currently assigned to: ${i.assignedTo}`);
    console.log(`    File stored under: ${i.filePath}`);
    if (i.suggestedOwner) {
      console.log(`    ⚠ Title suggests this belongs to: ${i.suggestedOwner.staffName} (${i.suggestedOwner.userId})`);
    }
    if (i.pathMismatch) {
      console.log(`    ⚠ Storage path doesn't match assigned user_id`);
    }
  }

  // Also show per-staff document counts
  console.log('\n=== Per-staff document counts ===');
  const counts = {};
  for (const doc of docs) {
    const name = staffMap.get(doc.user_id) || doc.user_id;
    counts[name] = (counts[name] || 0) + 1;
  }
  for (const [name, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count} docs`);
  }
}

run().catch(console.error);
