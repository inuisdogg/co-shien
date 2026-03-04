/**
 * デモデータクリーンアップスクリプト
 *
 * 保存するもの:
 * - 畠昂哉 (c6f4c329-17e6-4fcc-a1de-28cfbe08b504) のユーザー
 * - Pocopoco 施設（owner_user_id = 畠昂哉）
 * - Pocopocoに紐づく employment_records（畠昂哉分のみ）
 *
 * 削除するもの:
 * - ひまわりデモ施設と全関連データ
 * - デモスタッフ・保護者・児童
 * - 求人関連のデモデータ
 * - その他のテストデータ
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

  const keepFacility = allFacilities.find(f => f.owner_user_id === OWNER_USER_ID);
  const deleteFacilities = allFacilities.filter(f => f.owner_user_id !== OWNER_USER_ID);

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

  const keepUserIds = [OWNER_USER_ID];

  // Pocopocoに紐づくemployment_recordsのユーザーも保存（もしいれば）
  if (keepFacility) {
    const { data: keepEmps } = await supabase
      .from('employment_records')
      .select('user_id')
      .eq('facility_id', keepFacility.id);
    if (keepEmps) {
      keepEmps.forEach(e => {
        if (!keepUserIds.includes(e.user_id)) {
          keepUserIds.push(e.user_id);
        }
      });
    }
  }

  const deleteUsers = (allUsers || []).filter(u => !keepUserIds.includes(u.id));
  const deleteUserIds = deleteUsers.map(u => u.id);

  console.log(`  保存ユーザー: ${keepUserIds.length}名`);
  console.log(`  削除対象ユーザー: ${deleteUserIds.length}名`);
  deleteUsers.forEach(u => console.log(`    - ${u.name} (${u.email}) [${u.user_type}]`));

  // ==========================================
  // 3. 削除対象の児童を特定
  // ==========================================
  console.log('\n=== 3. 児童の確認 ===');

  const { data: deleteChildren } = await supabase
    .from('children')
    .select('id, name')
    .in('facility_id', deleteFacilityIds);

  // Pocopocoに属さない児童も削除（orphaned）
  const { data: orphanChildren } = await supabase
    .from('children')
    .select('id, name')
    .in('owner_profile_id', deleteUserIds);

  const deleteChildIds = [
    ...new Set([
      ...(deleteChildren || []).map(c => c.id),
      ...(orphanChildren || []).map(c => c.id),
    ])
  ];
  console.log(`  削除対象児童: ${deleteChildIds.length}名`);

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

  // --- 児童削除 ---
  if (deleteChildIds.length > 0) {
    console.log('\n  --- 児童データ ---');
    const r = await supabase.from('children').delete().in('id', deleteChildIds);
    log('children', r);
  }

  // --- ユーザー削除 ---
  if (deleteUserIds.length > 0) {
    console.log('\n  --- ユーザーデータ ---');
    // パスキー
    const r1 = await supabase.from('passkey_credentials').delete().in('user_id', deleteUserIds);
    log('passkey_credentials', r1);
    // push購読
    const r2 = await supabase.from('push_subscriptions').delete().in('user_id', deleteUserIds);
    log('push_subscriptions', r2);
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
