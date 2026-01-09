import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLeads() {
  // テーブルが存在するか確認
  const { error } = await supabase.from('leads').select('id').limit(1);
  if (error) {
    console.log('❌ leadsテーブルが存在しません:', error.message);
    console.log('📝 テーブルを作成する必要があります');
  } else {
    console.log('✅ leadsテーブルは存在します');
  }
}

checkLeads();
