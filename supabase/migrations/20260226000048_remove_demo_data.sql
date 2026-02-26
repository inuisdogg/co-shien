-- Migration: Remove demo/test data from all environments
-- This migration cleans up demo data inserted by:
--   1. scripts/seed-himawari-demo.mjs (facility-himawari-demo)
--   2. scripts/insert-demo-data.mjs (demo-child-*, demo-staff-*, demo-parent-*)
--   3. Various migration-inserted test data (expert/sitter/chat/schedule dev data)

BEGIN;

-- ============================================================
-- 1. Himawari Demo Data (facility_id = 'facility-himawari-demo')
-- ============================================================

-- career_development_records
DO $$ BEGIN
  DELETE FROM career_development_records WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- training_records
DO $$ BEGIN
  DELETE FROM training_records WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- overtime_agreements
DO $$ BEGIN
  DELETE FROM overtime_agreements WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- abuse_prevention_records
DO $$ BEGIN
  DELETE FROM abuse_prevention_records WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- bcp_emergency_contacts
DO $$ BEGIN
  DELETE FROM bcp_emergency_contacts WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- bcp_plans
DO $$ BEGIN
  DELETE FROM bcp_plans WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- staff_qualifications
DO $$ BEGIN
  DELETE FROM staff_qualifications WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- regulation_acknowledgments
DO $$ BEGIN
  DELETE FROM regulation_acknowledgments WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- daily_transport_assignments
DO $$ BEGIN
  DELETE FROM daily_transport_assignments WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- contact_logs
DO $$ BEGIN
  DELETE FROM contact_logs WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- shift_patterns
DO $$ BEGIN
  DELETE FROM shift_patterns WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- paid_leave_balances
DO $$ BEGIN
  DELETE FROM paid_leave_balances WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- attendance_records (by user_id)
DO $$ BEGIN
  DELETE FROM attendance_records WHERE user_id IN (
    'himawari-staff-1','himawari-staff-2','himawari-staff-3','himawari-staff-4','himawari-staff-5'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- schedules
DO $$ BEGIN
  DELETE FROM schedules WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- contract_invitations
DO $$ BEGIN
  DELETE FROM contract_invitations WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- children
DO $$ BEGIN
  DELETE FROM children WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- staff
DO $$ BEGIN
  DELETE FROM staff WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- employment_records
DO $$ BEGIN
  DELETE FROM employment_records WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- users (himawari staff + parents)
DO $$ BEGIN
  DELETE FROM users WHERE id IN (
    'himawari-staff-1','himawari-staff-2','himawari-staff-3','himawari-staff-4','himawari-staff-5',
    'himawari-parent-1','himawari-parent-2','himawari-parent-3','himawari-parent-4','himawari-parent-5'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- facility_settings
DO $$ BEGIN
  DELETE FROM facility_settings WHERE facility_id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- facilities
DO $$ BEGIN
  DELETE FROM facilities WHERE id = 'facility-himawari-demo';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 2. insert-demo-data.mjs Demo Data
-- ============================================================

-- schedules (by child_id)
DO $$ BEGIN
  DELETE FROM schedules WHERE child_id IN (
    'demo-child-1','demo-child-2','demo-child-3','demo-child-4',
    'demo-child-5','demo-child-6','demo-child-7','demo-child-8'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- children
DO $$ BEGIN
  DELETE FROM children WHERE id IN (
    'demo-child-1','demo-child-2','demo-child-3','demo-child-4',
    'demo-child-5','demo-child-6','demo-child-7','demo-child-8'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- employment_records
DO $$ BEGIN
  DELETE FROM employment_records WHERE id IN (
    'demo-emp-1','demo-emp-2','demo-emp-3','demo-emp-4','demo-emp-5'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- users (demo staff + parents)
DO $$ BEGIN
  DELETE FROM users WHERE id IN (
    'demo-staff-1','demo-staff-2','demo-staff-3','demo-staff-4','demo-staff-5',
    'demo-parent-1','demo-parent-2','demo-parent-3'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 3. Migration-originated test data
-- ============================================================

-- Expert/Sitter test data
DO $$ BEGIN
  DELETE FROM sitter_profiles WHERE id LIKE 'sitter-test-%';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM expert_profiles WHERE id LIKE 'expert-profile-%';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM users WHERE id IN (
    'dev-expert-001','dev-expert-002','dev-expert-003',
    'dev-expert-004','dev-expert-005','dev-expert-006'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Chat demo data
DO $$ BEGIN
  DELETE FROM contracts WHERE id IN (
    'contract-demo-001','contract-demo-002','dev-contract-001','dev-contract-002'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM staff WHERE id = 'staff-demo-001';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM users WHERE id IN (
    'dev-staff-user-001','dev-facility-staff-001','dev-facility-admin-001','dev-client-user-001'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Sample schedules
DO $$ BEGIN
  DELETE FROM schedules WHERE child_id IN ('dev-test-child-001','dev-test-child-002');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM children WHERE id IN ('dev-test-child-001','dev-test-child-002');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

COMMIT;
