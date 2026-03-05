/**
 * デモデータ完全クリーンアップスクリプト
 *
 * 保存するもの:
 * - 畠昂哉 (c6f4c329-17e6-4fcc-a1de-28cfbe08b504) のユーザー・雇用記録・staffレコード
 * - Pocopoco 施設 + facility_settings
 *
 * 削除するもの:
 * - 他の全施設と全関連データ
 * - Pocopoco内の畠昂哉以外のスタッフ・雇用記録・ユーザー
 * - 全児童データ
 * - 全運用データ（スケジュール、勤怠、連絡帳など）
 * - 求人関連のデモデータ
 *
 * 追加するもの:
 * - 株式会社INU の会社レコード → Pocopocoに紐付け
 *
 * Usage: node scripts/cleanup-demo-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const OWNER_USER_ID = 'c6f4c329-17e6-4fcc-a1de-28cfbe08b504';

function log(label, result) {
  if (result.error) {
    console.error(`  ✗ ${label}:`, result.error.message);
  } else {
    const count = Array.isArray(result.data) ? result.data.length : (result.count ?? '?');
    console.log(`  ✓ ${label} (${count}件)`);
  }
}

async function deleteByFacility(table, facilityIds) {
  if (facilityIds.length === 0) return;
  const result = await supabase.from(table).delete().in('facility_id', facilityIds);
  log(`${table}`, result);
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  デモデータクリーンアップ                  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // ==========================================
  // 1. Pocopoco施設を特定
  // ==========================================
  console.log('=== 1. 施設の確認 ===');

  const { data: allFacilities } = await supabase
    .from('facilities')
    .select('id, name, owner_user_id, company_id');

  if (!allFacilities || allFacilities.length === 0) {
    console.log('  施設が見つかりません。終了します。');
    return;
  }

  // pocopocoを名前で特定（ひまわりも畠昂哉がオーナーのため、owner_user_idだけでは区別不可）
  const keepFacility = allFacilities.find(f => f.name?.toLowerCase().includes('pocopoco'));
  const deleteFacilities = allFacilities.filter(f => f.id !== keepFacility?.id);

  if (keepFacility) {
    console.log(`  ★ 保存する施設: ${keepFacility.name} (${keepFacility.id})`);
  } else {
    console.log('  ⚠ オーナーの施設が見つかりません！');
  }

  const deleteFacilityIds = deleteFacilities.map(f => f.id);
  console.log(`  削除対象施設: ${deleteFacilities.map(f => f.name).join(', ') || 'なし'}`);

  // ==========================================
  // 2. 削除対象ユーザーを特定
  // ==========================================
  console.log('\n=== 2. ユーザーの確認 ===');

  // オーナー以外のユーザーを取得
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email, user_type');

  // 畠昂哉のみ保持（他のpocopocoスタッフも削除対象）
  const keepUserIds = [OWNER_USER_ID];

  const deleteUsers = (allUsers || []).filter(u => !keepUserIds.includes(u.id));
  const deleteUserIds = deleteUsers.map(u => u.id);

  console.log(`  保存ユーザー: ${keepUserIds.length}名`);
  console.log(`  削除対象ユーザー: ${deleteUserIds.length}名`);
  deleteUsers.forEach(u => console.log(`    - ${u.name} (${u.email}) [${u.user_type}]`));

  // ==========================================
  // 3. 全児童を削除対象に（pocopoco含む）
  // ==========================================
  console.log('\n=== 3. 児童の確認 ===');

  const { data: allChildren } = await supabase
    .from('children')
    .select('id, name');

  const deleteChildIds = (allChildren || []).map(c => c.id);
  console.log(`  削除対象児童: ${deleteChildIds.length}名`);
  (allChildren || []).forEach(c => console.log(`    - ${c.name} (${c.id})`));

  // ==========================================
  // 4. デモデータ削除開始
  // ==========================================
  console.log('\n=== 4. デモデータ削除 ===');

  // --- 施設に紐づくデータ削除（削除対象施設） ---
  if (deleteFacilityIds.length > 0) {
    console.log('\n  --- 施設関連データ ---');

    // Transport系
    await deleteByFacility('transport_location_history', deleteFacilityIds);
    await deleteByFacility('transport_stop_events', deleteFacilityIds);
    await deleteByFacility('transport_sessions', deleteFacilityIds);
    await deleteByFacility('daily_transport_assignments', deleteFacilityIds);

    // スケジュール・利用実績
    await deleteByFacility('usage_records', deleteFacilityIds);
    await deleteByFacility('schedules', deleteFacilityIds);

    // 連絡帳・日誌
    await deleteByFacility('contact_logs', deleteFacilityIds);
    await deleteByFacility('daily_logs', deleteFacilityIds);

    // 勤怠・シフト
    await deleteByFacility('attendance_records', deleteFacilityIds);
    await deleteByFacility('shift_confirmations', deleteFacilityIds);
    await deleteByFacility('shifts', deleteFacilityIds);
    await deleteByFacility('monthly_shift_schedules', deleteFacilityIds);
    await deleteByFacility('shift_patterns', deleteFacilityIds);
    await deleteByFacility('leave_requests', deleteFacilityIds);
    await deleteByFacility('paid_leave_balances', deleteFacilityIds);
    await deleteByFacility('attendance_monthly_closings', deleteFacilityIds);

    // コンプライアンス
    await deleteByFacility('regulation_acknowledgments', deleteFacilityIds);
    await deleteByFacility('abuse_prevention_records', deleteFacilityIds);
    await deleteByFacility('training_records', deleteFacilityIds);
    await deleteByFacility('career_development_records', deleteFacilityIds);
    await deleteByFacility('overtime_agreements', deleteFacilityIds);
    await deleteByFacility('incident_reports', deleteFacilityIds);

    // BCP
    const { data: bcpPlans } = await supabase
      .from('bcp_plans')
      .select('id')
      .in('facility_id', deleteFacilityIds);
    if (bcpPlans && bcpPlans.length > 0) {
      const bcpIds = bcpPlans.map(b => b.id);
      const r1 = await supabase.from('bcp_emergency_contacts').delete().in('bcp_plan_id', bcpIds);
      log('bcp_emergency_contacts', r1);
    }
    await deleteByFacility('bcp_plans', deleteFacilityIds);

    // 求人系
    const { data: jobPostings } = await supabase
      .from('job_postings')
      .select('id')
      .in('facility_id', deleteFacilityIds);
    if (jobPostings && jobPostings.length > 0) {
      const jpIds = jobPostings.map(j => j.id);
      // applications → messages, placements
      const { data: apps } = await supabase
        .from('job_applications')
        .select('id')
        .in('job_posting_id', jpIds);
      if (apps && apps.length > 0) {
        const appIds = apps.map(a => a.id);
        const r1 = await supabase.from('recruitment_messages').delete().in('job_application_id', appIds);
        log('recruitment_messages', r1);
        const r2 = await supabase.from('placements').delete().in('job_application_id', appIds);
        log('placements', r2);
        const r3 = await supabase.from('job_applications').delete().in('id', appIds);
        log('job_applications', r3);
      }
      const r4 = await supabase.from('spot_work_shifts').delete().in('job_posting_id', jpIds);
      log('spot_work_shifts', r4);
      const r5 = await supabase.from('job_postings').delete().in('id', jpIds);
      log('job_postings', r5);
    }

    // リード
    await deleteByFacility('leads', deleteFacilityIds);

    // チャット
    await deleteByFacility('chat_messages', deleteFacilityIds);

    // 契約系
    await deleteByFacility('contract_invitations', deleteFacilityIds);
    await deleteByFacility('contracts', deleteFacilityIds);

    // 請求・財務
    await deleteByFacility('billing_records', deleteFacilityIds);
    await deleteByFacility('upper_limit_management', deleteFacilityIds);
    await deleteByFacility('payslips', deleteFacilityIds);
    await deleteByFacility('cashflow_entries', deleteFacilityIds);
    await deleteByFacility('cashflow_balances', deleteFacilityIds);
    await deleteByFacility('monthly_financials', deleteFacilityIds);

    // 資格
    await deleteByFacility('staff_qualifications', deleteFacilityIds);

    // 施設設定
    await deleteByFacility('facility_settings_history', deleteFacilityIds);
    await deleteByFacility('facility_settings', deleteFacilityIds);

    // 雇用記録
    await deleteByFacility('employment_records', deleteFacilityIds);

    // 通知
    await deleteByFacility('notifications', deleteFacilityIds);

    // スタッフ（レガシー）
    await deleteByFacility('staff', deleteFacilityIds);
  }

  // --- Pocopoco内の畠昂哉以外のデータ削除 ---
  if (keepFacility) {
    console.log('\n  --- Pocopoco内クリーンアップ（畠昂哉以外） ---');

    // Pocopocoの運用データを全削除
    const fid = [keepFacility.id];

    // Transport系
    await deleteByFacility('transport_location_history', fid);
    await deleteByFacility('transport_stop_events', fid);
    await deleteByFacility('transport_sessions', fid);
    await deleteByFacility('daily_transport_assignments', fid);

    // スケジュール・利用実績
    await deleteByFacility('usage_records', fid);
    await deleteByFacility('schedules', fid);

    // 連絡帳・日誌
    await deleteByFacility('contact_logs', fid);
    await deleteByFacility('daily_logs', fid);

    // 勤怠・シフト
    await deleteByFacility('attendance_records', fid);
    await deleteByFacility('shift_confirmations', fid);
    await deleteByFacility('shifts', fid);
    await deleteByFacility('monthly_shift_schedules', fid);
    await deleteByFacility('shift_patterns', fid);
    await deleteByFacility('leave_requests', fid);
    await deleteByFacility('paid_leave_balances', fid);
    await deleteByFacility('attendance_monthly_closings', fid);

    // コンプライアンス
    await deleteByFacility('regulation_acknowledgments', fid);
    await deleteByFacility('abuse_prevention_records', fid);
    await deleteByFacility('training_records', fid);
    await deleteByFacility('career_development_records', fid);
    await deleteByFacility('overtime_agreements', fid);
    await deleteByFacility('incident_reports', fid);

    // BCP
    const { data: pocoBcp } = await supabase
      .from('bcp_plans')
      .select('id')
      .eq('facility_id', keepFacility.id);
    if (pocoBcp && pocoBcp.length > 0) {
      const bcpIds = pocoBcp.map(b => b.id);
      const r1 = await supabase.from('bcp_emergency_contacts').delete().in('bcp_plan_id', bcpIds);
      log('bcp_emergency_contacts (pocopoco)', r1);
    }
    await deleteByFacility('bcp_plans', fid);

    // 求人系
    const { data: pocoJobs } = await supabase
      .from('job_postings')
      .select('id')
      .eq('facility_id', keepFacility.id);
    if (pocoJobs && pocoJobs.length > 0) {
      const jpIds = pocoJobs.map(j => j.id);
      const { data: apps } = await supabase
        .from('job_applications')
        .select('id')
        .in('job_posting_id', jpIds);
      if (apps && apps.length > 0) {
        const appIds = apps.map(a => a.id);
        await supabase.from('recruitment_messages').delete().in('job_application_id', appIds);
        await supabase.from('placements').delete().in('job_application_id', appIds);
        await supabase.from('job_applications').delete().in('id', appIds);
      }
      await supabase.from('spot_work_shifts').delete().in('job_posting_id', jpIds);
      await supabase.from('job_postings').delete().in('id', jpIds);
      log('job_postings (pocopoco)', { data: pocoJobs });
    }

    // リード・チャット
    await deleteByFacility('leads', fid);
    await deleteByFacility('chat_messages', fid);

    // 契約系
    await deleteByFacility('contract_invitations', fid);
    await deleteByFacility('contracts', fid);

    // 請求・財務
    await deleteByFacility('billing_records', fid);
    await deleteByFacility('upper_limit_management', fid);
    await deleteByFacility('payslips', fid);
    await deleteByFacility('cashflow_entries', fid);
    await deleteByFacility('cashflow_balances', fid);
    await deleteByFacility('monthly_financials', fid);

    // 資格
    await deleteByFacility('staff_qualifications', fid);

    // 通知
    await deleteByFacility('notifications', fid);

    // 畠昂哉以外のスタッフ・雇用記録削除
    const { data: pocoStaff } = await supabase
      .from('staff')
      .select('id, name, user_id')
      .eq('facility_id', keepFacility.id)
      .neq('user_id', OWNER_USER_ID);
    if (pocoStaff && pocoStaff.length > 0) {
      const staffIds = pocoStaff.map(s => s.id);
      // staff_personnel_settings
      const r1 = await supabase.from('staff_personnel_settings').delete().in('staff_id', staffIds);
      log('staff_personnel_settings (pocopoco)', r1);
      // staff_documents
      const r2 = await supabase.from('staff_documents').delete().in('staff_id', staffIds);
      log('staff_documents (pocopoco)', r2);
      // employment_contracts
      const r3 = await supabase.from('employment_contracts').delete().in('staff_id', staffIds);
      log('employment_contracts (pocopoco)', r3);
      // staff本体
      const r4 = await supabase.from('staff').delete().in('id', staffIds);
      log('staff (pocopoco non-owner)', r4);
      pocoStaff.forEach(s => console.log(`    削除: ${s.name}`));
    }

    // 畠昂哉以外の雇用記録削除
    const r5 = await supabase
      .from('employment_records')
      .delete()
      .eq('facility_id', keepFacility.id)
      .neq('user_id', OWNER_USER_ID);
    log('employment_records (pocopoco non-owner)', r5);
  }

  // --- 児童削除（全施設） ---
  if (deleteChildIds.length > 0) {
    console.log('\n  --- 児童データ ---');
    // 児童関連の子テーブルも先に削除
    const r0 = await supabase.from('child_parent_links').delete().in('child_id', deleteChildIds);
    log('child_parent_links', r0);
    const r = await supabase.from('children').delete().in('id', deleteChildIds);
    log('children', r);
  }

  // --- ユーザー削除 ---
  if (deleteUserIds.length > 0) {
    console.log('\n  --- ユーザーデータ ---');

    // FK制約のある子テーブルを先に削除
    const userFkTables = [
      'career_development_records',
      'training_records',
      'regulation_acknowledgments',
      'abuse_prevention_records',
      'push_subscriptions',
      'leave_requests',
      'attendance_records',
    ];
    for (const table of userFkTables) {
      const r = await supabase.from(table).delete().in('user_id', deleteUserIds);
      log(`${table} (user FK)`, r);
    }

    // 求人応募（ユーザーが応募者の場合）
    const { data: userApps } = await supabase
      .from('job_applications')
      .select('id')
      .in('applicant_user_id', deleteUserIds);
    if (userApps && userApps.length > 0) {
      const uaIds = userApps.map(a => a.id);
      await supabase.from('recruitment_messages').delete().in('job_application_id', uaIds);
      await supabase.from('placements').delete().in('job_application_id', uaIds);
      const r3 = await supabase.from('job_applications').delete().in('id', uaIds);
      log('job_applications (applicant)', r3);
    }

    // 雇用記録（他施設分 — pocopocoのowner分は保持済み）
    const rEmp = await supabase.from('employment_records').delete().in('user_id', deleteUserIds);
    log('employment_records (user FK)', rEmp);

    // staff レコード
    const rStaff = await supabase.from('staff').delete().in('user_id', deleteUserIds);
    log('staff (user FK)', rStaff);

    // ユーザー本体
    const r4 = await supabase.from('users').delete().in('id', deleteUserIds);
    log('users', r4);
  }

  // --- 施設本体削除 ---
  if (deleteFacilityIds.length > 0) {
    console.log('\n  --- 施設本体 ---');
    const r = await supabase.from('facilities').delete().in('id', deleteFacilityIds);
    log('facilities', r);
  }

  // --- Expert/Sitter デモデータ削除 ---
  console.log('\n  --- Expert/Sitter デモデータ ---');
  const { data: experts } = await supabase.from('expert_profiles').select('id');
  if (experts && experts.length > 0) {
    const expertIds = experts.map(e => e.id);
    await supabase.from('expert_columns').delete().in('expert_id', expertIds);
    await supabase.from('expert_expertise').delete().in('expert_id', expertIds);
    const r = await supabase.from('expert_profiles').delete().in('id', expertIds);
    log('expert_profiles', r);
  }
  const { data: sitters } = await supabase.from('sitter_profiles').select('id');
  if (sitters && sitters.length > 0) {
    const sitterIds = sitters.map(s => s.id);
    await supabase.from('sitter_reviews').delete().in('sitter_id', sitterIds);
    await supabase.from('sitter_bookings').delete().in('sitter_id', sitterIds);
    const r = await supabase.from('sitter_profiles').delete().in('id', sitterIds);
    log('sitter_profiles', r);
  }

  // --- 孤立した既存companiesを削除（新しく作り直す） ---
  console.log('\n  --- 既存会社データクリーンアップ ---');
  const { data: oldCompanies } = await supabase.from('companies').select('id');
  if (oldCompanies && oldCompanies.length > 0) {
    const r = await supabase.from('companies').delete().in('id', oldCompanies.map(c => c.id));
    log('companies (old)', r);
  }

  // --- 孤立した求人データ削除（施設に紐づかない） ---
  console.log('\n  --- 孤立データクリーンアップ ---');
  const { data: orphanJobs } = await supabase
    .from('job_postings')
    .select('id, facility_id');
  if (orphanJobs) {
    const existingFacilityIds = keepFacility ? [keepFacility.id] : [];
    const orphanJobIds = orphanJobs
      .filter(j => !existingFacilityIds.includes(j.facility_id))
      .map(j => j.id);
    if (orphanJobIds.length > 0) {
      const { data: apps } = await supabase
        .from('job_applications')
        .select('id')
        .in('job_posting_id', orphanJobIds);
      if (apps && apps.length > 0) {
        const appIds = apps.map(a => a.id);
        await supabase.from('recruitment_messages').delete().in('job_application_id', appIds);
        await supabase.from('placements').delete().in('job_application_id', appIds);
        await supabase.from('job_applications').delete().in('id', appIds);
      }
      await supabase.from('spot_work_shifts').delete().in('job_posting_id', orphanJobIds);
      const r = await supabase.from('job_postings').delete().in('id', orphanJobIds);
      log('orphan job_postings', r);
    }
  }

  // ==========================================
  // 5. 株式会社INU の会社レコード作成 → Pocopocoに紐付け
  // ==========================================
  console.log('\n=== 5. 株式会社INU 登録 ===');

  if (keepFacility) {
    // 施設設定から住所取得
    const { data: settings } = await supabase
      .from('facility_settings')
      .select('address, postal_code')
      .eq('facility_id', keepFacility.id)
      .maybeSingle();

    const companyId = crypto.randomUUID();

    const { data: companyData, error: companyErr } = await supabase
      .from('companies')
      .upsert({
        id: companyId,
        name: '株式会社INU',
        contact_person_name: '畠 昂哉',
        contact_person_email: 'koya.htk@gmail.com',
      }, { onConflict: 'id' })
      .select();

    if (companyErr) {
      console.error('  ✗ 会社作成エラー:', companyErr.message);
    } else {
      console.log(`  ✓ 株式会社INU 作成 (${companyId})`);
    }

    // 施設に会社IDを紐付け
    const { error: linkErr } = await supabase
      .from('facilities')
      .update({ company_id: companyId })
      .eq('id', keepFacility.id);

    if (linkErr) {
      console.error('  ✗ 施設→会社紐付けエラー:', linkErr.message);
    } else {
      console.log(`  ✓ ${keepFacility.name} → 株式会社INU 紐付け完了`);
    }
  }

  // ==========================================
  // 6. 最終確認
  // ==========================================
  console.log('\n=== 6. 最終確認 ===');

  const { data: remainFacilities } = await supabase.from('facilities').select('id, name, company_id');
  console.log(`  施設: ${(remainFacilities || []).map(f => f.name).join(', ') || 'なし'}`);

  const { data: remainUsers } = await supabase.from('users').select('id, name, email');
  console.log(`  ユーザー: ${(remainUsers || []).length}名`);
  (remainUsers || []).forEach(u => console.log(`    - ${u.name} (${u.email})`));

  const { data: remainChildren } = await supabase.from('children').select('id, name');
  console.log(`  児童: ${(remainChildren || []).length}名`);

  const { data: remainEmps } = await supabase.from('employment_records').select('id, user_id, facility_id, role');
  console.log(`  雇用記録: ${(remainEmps || []).length}件`);

  const { data: remainCompanies } = await supabase.from('companies').select('id, name');
  console.log(`  会社: ${(remainCompanies || []).map(c => c.name).join(', ') || 'なし'}`);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  クリーンアップ完了！                      ║');
  console.log('╚══════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
