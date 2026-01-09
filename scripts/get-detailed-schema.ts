/**
 * 開発環境と本番環境の詳細なスキーマ比較
 */

import { createClient } from '@supabase/supabase-js';

const devUrl = 'https://ukjkltiafitpnqfoahhl.supabase.co';
const devKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const prodUrl = 'https://iskgcqzozsemlmbvubna.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE';

const devSupabase = createClient(devUrl, devKey);
const prodSupabase = createClient(prodUrl, prodKey);

async function getDetailedSchema() {
  console.log('🔍 詳細なスキーマ比較\n');

  // usersテーブルの詳細比較
  console.log('📋 usersテーブル:');
  
  // 開発環境
  const { data: devUsersData, error: devUsersError } = await devSupabase
    .from('users')
    .select('*')
    .limit(1);
  
  let devUserColumns: string[] = [];
  if (!devUsersError && devUsersData && devUsersData.length > 0) {
    devUserColumns = Object.keys(devUsersData[0]).sort();
    console.log(`  開発: ${devUserColumns.length}カラム`);
  }
  
  // 本番環境
  const { data: prodUsersData, error: prodUsersError } = await prodSupabase
    .from('users')
    .select('*')
    .limit(1);
  
  let prodUserColumns: string[] = [];
  if (!prodUsersError && prodUsersData && prodUsersData.length > 0) {
    prodUserColumns = Object.keys(prodUsersData[0]).sort();
    console.log(`  本番: ${prodUserColumns.length}カラム`);
  }
  
  const prodOnlyUsers = prodUserColumns.filter(c => !devUserColumns.includes(c));
  const devOnlyUsers = devUserColumns.filter(c => !prodUserColumns.includes(c));
  
  if (prodOnlyUsers.length > 0) {
    console.log(`  ⚠️  本番環境のみ: ${prodOnlyUsers.join(', ')}`);
  }
  if (devOnlyUsers.length > 0) {
    console.log(`  ⚠️  開発環境のみ: ${devOnlyUsers.join(', ')}`);
  }
  
  // staffテーブルの詳細比較
  console.log('\n📋 staffテーブル:');
  
  const { data: devStaffData, error: devStaffError } = await devSupabase
    .from('staff')
    .select('*')
    .limit(1);
  
  let devStaffColumns: string[] = [];
  if (!devStaffError && devStaffData && devStaffData.length > 0) {
    devStaffColumns = Object.keys(devStaffData[0]).sort();
    console.log(`  開発: ${devStaffColumns.length}カラム`);
  }
  
  const { data: prodStaffData, error: prodStaffError } = await prodSupabase
    .from('staff')
    .select('*')
    .limit(1);
  
  let prodStaffColumns: string[] = [];
  if (!prodStaffError && prodStaffData && prodStaffData.length > 0) {
    prodStaffColumns = Object.keys(prodStaffData[0]).sort();
    console.log(`  本番: ${prodStaffColumns.length}カラム`);
  }
  
  const prodOnlyStaff = prodStaffColumns.filter(c => !devStaffColumns.includes(c));
  const devOnlyStaff = devStaffColumns.filter(c => !prodStaffColumns.includes(c));
  
  if (prodOnlyStaff.length > 0) {
    console.log(`  ⚠️  本番環境のみ: ${prodOnlyStaff.join(', ')}`);
  }
  if (devOnlyStaff.length > 0) {
    console.log(`  ⚠️  開発環境のみ: ${devOnlyStaff.join(', ')}`);
  }
  
  // facility_settingsテーブルの詳細比較
  console.log('\n📋 facility_settingsテーブル:');
  
  const { data: devSettingsData, error: devSettingsError } = await devSupabase
    .from('facility_settings')
    .select('*')
    .limit(1);
  
  let devSettingsColumns: string[] = [];
  if (!devSettingsError && devSettingsData && devSettingsData.length > 0) {
    devSettingsColumns = Object.keys(devSettingsData[0]).sort();
    console.log(`  開発: ${devSettingsColumns.join(', ')}`);
  }
  
  const { data: prodSettingsData, error: prodSettingsError } = await prodSupabase
    .from('facility_settings')
    .select('*')
    .limit(1);
  
  let prodSettingsColumns: string[] = [];
  if (!prodSettingsError && prodSettingsData && prodSettingsData.length > 0) {
    prodSettingsColumns = Object.keys(prodSettingsData[0]).sort();
    console.log(`  本番: ${prodSettingsColumns.join(', ')}`);
  }
  
  const prodOnlySettings = prodSettingsColumns.filter(c => !devSettingsColumns.includes(c));
  const devOnlySettings = devSettingsColumns.filter(c => !prodSettingsColumns.includes(c));
  
  if (prodOnlySettings.length > 0) {
    console.log(`  ⚠️  本番環境のみ: ${prodOnlySettings.join(', ')}`);
  }
  if (devOnlySettings.length > 0) {
    console.log(`  ⚠️  開発環境のみ: ${devOnlySettings.join(', ')}`);
  }
  
  console.log('\n✅ スキーマ比較完了');
}

getDetailedSchema();

