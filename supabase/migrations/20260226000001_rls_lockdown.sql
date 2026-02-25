-- =====================================================================
-- RLS LOCKDOWN: Replace all USING(true) / WITH CHECK(true) policies
-- with proper facility-level tenant isolation
--
-- Pattern:
--   Tables WITH facility_id  -> USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL))
--   Tables with user_id only -> USING (user_id = auth.uid()::text)
--   Master/reference tables  -> USING(true) for SELECT only; restrict mutations
--   Special cases            -> Documented inline
--
-- Generated: 2026-02-26
-- =====================================================================

-- Helper: reusable facility-scoping expression (used in policy definitions below)
-- "The current user has an active employment record at this facility"
-- Expression: facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)

BEGIN;

-- =====================================================================
-- CATEGORY 1: MASTER / REFERENCE TABLES
-- These contain system-wide lookup data. SELECT stays open to all
-- authenticated users. INSERT/UPDATE/DELETE restricted.
-- =====================================================================

-- -------------------------------------------------------
-- 1.1  service_types  (no facility_id -- global lookup)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "service_types_select" ON service_types;
CREATE POLICY "service_types_select" ON service_types
  FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE/DELETE policies => mutations blocked by RLS

-- -------------------------------------------------------
-- 1.2  regional_units  (no facility_id -- global lookup)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "regional_units_select" ON regional_units;
CREATE POLICY "regional_units_select" ON regional_units
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------
-- 1.3  base_rewards  (no facility_id -- global lookup)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "base_rewards_select" ON base_rewards;
CREATE POLICY "base_rewards_select" ON base_rewards
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------
-- 1.4  addition_categories  (no facility_id -- global lookup)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "addition_categories_select" ON addition_categories;
CREATE POLICY "addition_categories_select" ON addition_categories
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------
-- 1.5  additions  (no facility_id -- global lookup)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "additions_select" ON additions;
CREATE POLICY "additions_select" ON additions
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------
-- 1.6  deductions  (no facility_id -- global lookup)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "deductions_select" ON deductions;
CREATE POLICY "deductions_select" ON deductions
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------
-- 1.7  addition_staff_requirements  (no facility_id -- reference data)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "addition_requirements_select" ON addition_staff_requirements;
DROP POLICY IF EXISTS "addition_requirements_insert" ON addition_staff_requirements;
DROP POLICY IF EXISTS "addition_requirements_update" ON addition_staff_requirements;

CREATE POLICY "addition_requirements_select_v3" ON addition_staff_requirements
  FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE restricted to service_role only (no policy = denied)

-- -------------------------------------------------------
-- 1.8  document_templates  (compliance lifecycle -- global templates)
--       Note: Two different document_templates tables exist; the compliance
--       lifecycle one (code-based, no facility_id) is the global master.
--       The child_documents one has facility_id and is handled in Category 2.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "document_templates_select" ON document_templates;
DROP POLICY IF EXISTS "document_templates_insert" ON document_templates;
DROP POLICY IF EXISTS "document_templates_update" ON document_templates;
DROP POLICY IF EXISTS "document_templates_delete" ON document_templates;

CREATE POLICY "document_templates_select_v2" ON document_templates
  FOR SELECT TO authenticated USING (true);
-- Mutations restricted to service_role

-- -------------------------------------------------------
-- 1.9  law_revisions  (global master, SELECT already USING(true))
-- -------------------------------------------------------
-- law_revisions_read_all already correct (SELECT USING true)
-- INSERT/UPDATE already restricted to authenticated role -- acceptable

-- -------------------------------------------------------
-- 1.10 addition_versions  (global master, SELECT already USING(true))
-- -------------------------------------------------------
-- addition_versions_read_all already correct

-- -------------------------------------------------------
-- 1.11 addition_definitions  (global master, SELECT USING(true))
-- -------------------------------------------------------
-- addition_definitions_read_policy already correct

-- -------------------------------------------------------
-- 1.14 business_type_master  (global reference, no RLS policies exist)
-- -------------------------------------------------------
-- No permissive policies to drop

-- -------------------------------------------------------
-- 1.15 system_config  (platform-wide config, no facility_id)
--       SELECT stays open. INSERT/UPDATE restricted to service_role.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "system_config_select" ON system_config;
DROP POLICY IF EXISTS "system_config_insert" ON system_config;
DROP POLICY IF EXISTS "system_config_update" ON system_config;

CREATE POLICY "system_config_select_v2" ON system_config
  FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE now denied for regular users (service_role bypasses RLS)

-- -------------------------------------------------------
-- 1.16 platform_invitation_tokens  (platform-wide, no facility_id)
--       SELECT stays open (token validation). INSERT/UPDATE restricted.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read invitation tokens" ON platform_invitation_tokens;
DROP POLICY IF EXISTS "Owners can create invitation tokens" ON platform_invitation_tokens;
DROP POLICY IF EXISTS "Anyone can update used_at" ON platform_invitation_tokens;

CREATE POLICY "platform_tokens_select_v2" ON platform_invitation_tokens
  FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE now denied for regular users -- use service_role for token management


-- =====================================================================
-- CATEGORY 2: FACILITY-SCOPED TABLES (have facility_id column)
-- All operations scoped to user's active employment facilities
-- =====================================================================

-- Reusable check expression (copy-pasted because Postgres policies don't support variables):
-- facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)

-- -------------------------------------------------------
-- 2.1  children  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "children_owner_select" ON children;
DROP POLICY IF EXISTS "children_owner_update" ON children;
DROP POLICY IF EXISTS "children_insert" ON children;

CREATE POLICY "children_select_v2" ON children
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "children_insert_v2" ON children
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "children_update_v2" ON children
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.2  contracts  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "contracts_select" ON contracts;
DROP POLICY IF EXISTS "contracts_insert" ON contracts;
DROP POLICY IF EXISTS "contracts_update" ON contracts;

CREATE POLICY "contracts_select_v2" ON contracts
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "contracts_insert_v2" ON contracts
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "contracts_update_v2" ON contracts
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.3  chat_messages  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_update" ON chat_messages;

CREATE POLICY "chat_messages_select_v2" ON chat_messages
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
         OR sender_id = auth.uid()::text
         OR client_user_id = auth.uid()::text);

CREATE POLICY "chat_messages_insert_v2" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
              OR sender_id = auth.uid()::text);

CREATE POLICY "chat_messages_update_v2" ON chat_messages
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
         OR sender_id = auth.uid()::text);

-- -------------------------------------------------------
-- 2.4  daily_logs  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "daily_logs_select" ON daily_logs;
DROP POLICY IF EXISTS "daily_logs_insert" ON daily_logs;
DROP POLICY IF EXISTS "daily_logs_update" ON daily_logs;
DROP POLICY IF EXISTS "daily_logs_delete" ON daily_logs;

CREATE POLICY "daily_logs_select_v2" ON daily_logs
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_logs_insert_v2" ON daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_logs_update_v2" ON daily_logs
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_logs_delete_v2" ON daily_logs
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.5  service_plans  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "service_plans_select" ON service_plans;
DROP POLICY IF EXISTS "service_plans_insert" ON service_plans;
DROP POLICY IF EXISTS "service_plans_update" ON service_plans;
DROP POLICY IF EXISTS "service_plans_delete" ON service_plans;

CREATE POLICY "service_plans_select_v2" ON service_plans
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "service_plans_insert_v2" ON service_plans
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "service_plans_update_v2" ON service_plans
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "service_plans_delete_v2" ON service_plans
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.6  incident_reports  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "incident_reports_select" ON incident_reports;
DROP POLICY IF EXISTS "incident_reports_insert" ON incident_reports;
DROP POLICY IF EXISTS "incident_reports_update" ON incident_reports;
DROP POLICY IF EXISTS "incident_reports_delete" ON incident_reports;

CREATE POLICY "incident_reports_select_v2" ON incident_reports
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "incident_reports_insert_v2" ON incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "incident_reports_update_v2" ON incident_reports
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "incident_reports_delete_v2" ON incident_reports
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.7  training_records  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "training_records_select" ON training_records;
DROP POLICY IF EXISTS "training_records_insert" ON training_records;
DROP POLICY IF EXISTS "training_records_update" ON training_records;
DROP POLICY IF EXISTS "training_records_delete" ON training_records;

CREATE POLICY "training_records_select_v2" ON training_records
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "training_records_insert_v2" ON training_records
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "training_records_update_v2" ON training_records
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "training_records_delete_v2" ON training_records
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.8  committee_meetings  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "committee_meetings_select" ON committee_meetings;
DROP POLICY IF EXISTS "committee_meetings_insert" ON committee_meetings;
DROP POLICY IF EXISTS "committee_meetings_update" ON committee_meetings;
DROP POLICY IF EXISTS "committee_meetings_delete" ON committee_meetings;

CREATE POLICY "committee_meetings_select_v2" ON committee_meetings
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "committee_meetings_insert_v2" ON committee_meetings
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "committee_meetings_update_v2" ON committee_meetings
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "committee_meetings_delete_v2" ON committee_meetings
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.9  audit_checklists  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "audit_checklists_select" ON audit_checklists;
DROP POLICY IF EXISTS "audit_checklists_insert" ON audit_checklists;
DROP POLICY IF EXISTS "audit_checklists_update" ON audit_checklists;
DROP POLICY IF EXISTS "audit_checklists_delete" ON audit_checklists;

CREATE POLICY "audit_checklists_select_v2" ON audit_checklists
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "audit_checklists_insert_v2" ON audit_checklists
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "audit_checklists_update_v2" ON audit_checklists
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "audit_checklists_delete_v2" ON audit_checklists
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.10 document_uploads  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "document_uploads_select" ON document_uploads;
DROP POLICY IF EXISTS "document_uploads_insert" ON document_uploads;
DROP POLICY IF EXISTS "document_uploads_update" ON document_uploads;
DROP POLICY IF EXISTS "document_uploads_delete" ON document_uploads;

CREATE POLICY "document_uploads_select_v2" ON document_uploads
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "document_uploads_insert_v2" ON document_uploads
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "document_uploads_update_v2" ON document_uploads
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "document_uploads_delete_v2" ON document_uploads
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.11 facility_document_configs  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "facility_document_configs_select" ON facility_document_configs;
DROP POLICY IF EXISTS "facility_document_configs_insert" ON facility_document_configs;
DROP POLICY IF EXISTS "facility_document_configs_update" ON facility_document_configs;
DROP POLICY IF EXISTS "facility_document_configs_delete" ON facility_document_configs;

CREATE POLICY "facility_document_configs_select_v2" ON facility_document_configs
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_document_configs_insert_v2" ON facility_document_configs
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_document_configs_update_v2" ON facility_document_configs
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_document_configs_delete_v2" ON facility_document_configs
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.12 expense_categories  (has facility_id, but can be NULL for system-wide)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_insert" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_update" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete" ON expense_categories;

CREATE POLICY "expense_categories_select_v2" ON expense_categories
  FOR SELECT TO authenticated
  USING (
    facility_id IS NULL  -- system-wide categories visible to all
    OR facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
  );

CREATE POLICY "expense_categories_insert_v2" ON expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "expense_categories_update_v2" ON expense_categories
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "expense_categories_delete_v2" ON expense_categories
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.13 expenses  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

CREATE POLICY "expenses_select_v2" ON expenses
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "expenses_insert_v2" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "expenses_update_v2" ON expenses
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "expenses_delete_v2" ON expenses
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.14 monthly_financials  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "monthly_financials_select" ON monthly_financials;
DROP POLICY IF EXISTS "monthly_financials_insert" ON monthly_financials;
DROP POLICY IF EXISTS "monthly_financials_update" ON monthly_financials;
DROP POLICY IF EXISTS "monthly_financials_delete" ON monthly_financials;

CREATE POLICY "monthly_financials_select_v2" ON monthly_financials
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_financials_insert_v2" ON monthly_financials
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_financials_update_v2" ON monthly_financials
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_financials_delete_v2" ON monthly_financials
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.15 shifts  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "shifts_select" ON shifts;
DROP POLICY IF EXISTS "shifts_insert" ON shifts;
DROP POLICY IF EXISTS "shifts_update" ON shifts;
DROP POLICY IF EXISTS "shifts_delete" ON shifts;
DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
DROP POLICY IF EXISTS "shifts_all_policy" ON shifts;

CREATE POLICY "shifts_select_v2" ON shifts
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shifts_insert_v2" ON shifts
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shifts_update_v2" ON shifts
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shifts_delete_v2" ON shifts
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.16 shift_patterns  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "shift_patterns_select" ON shift_patterns;
DROP POLICY IF EXISTS "shift_patterns_insert" ON shift_patterns;
DROP POLICY IF EXISTS "shift_patterns_update" ON shift_patterns;
DROP POLICY IF EXISTS "shift_patterns_delete" ON shift_patterns;

CREATE POLICY "shift_patterns_select_v2" ON shift_patterns
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_patterns_insert_v2" ON shift_patterns
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_patterns_update_v2" ON shift_patterns
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_patterns_delete_v2" ON shift_patterns
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.17 monthly_shift_schedules  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "monthly_shift_schedules_select" ON monthly_shift_schedules;
DROP POLICY IF EXISTS "monthly_shift_schedules_insert" ON monthly_shift_schedules;
DROP POLICY IF EXISTS "monthly_shift_schedules_update" ON monthly_shift_schedules;
DROP POLICY IF EXISTS "monthly_shift_schedules_delete" ON monthly_shift_schedules;

CREATE POLICY "monthly_shift_schedules_select_v2" ON monthly_shift_schedules
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_shift_schedules_insert_v2" ON monthly_shift_schedules
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_shift_schedules_update_v2" ON monthly_shift_schedules
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_shift_schedules_delete_v2" ON monthly_shift_schedules
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.18 shift_confirmations  (no facility_id, but has user_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "shift_confirmations_select" ON shift_confirmations;
DROP POLICY IF EXISTS "shift_confirmations_insert" ON shift_confirmations;
DROP POLICY IF EXISTS "shift_confirmations_update" ON shift_confirmations;
DROP POLICY IF EXISTS "shift_confirmations_delete" ON shift_confirmations;

CREATE POLICY "shift_confirmations_select_v2" ON shift_confirmations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "shift_confirmations_insert_v2" ON shift_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "shift_confirmations_update_v2" ON shift_confirmations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "shift_confirmations_delete_v2" ON shift_confirmations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

-- Also allow facility managers to see all confirmations for their facility's shifts
CREATE POLICY "shift_confirmations_facility_select_v2" ON shift_confirmations
  FOR SELECT TO authenticated
  USING (
    shift_id IN (
      SELECT s.id FROM shifts s
      WHERE s.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

-- -------------------------------------------------------
-- 2.19 staff_leave_settings  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "staff_leave_settings_select" ON staff_leave_settings;
DROP POLICY IF EXISTS "staff_leave_settings_insert" ON staff_leave_settings;
DROP POLICY IF EXISTS "staff_leave_settings_update" ON staff_leave_settings;
DROP POLICY IF EXISTS "staff_leave_settings_delete" ON staff_leave_settings;

CREATE POLICY "staff_leave_settings_select_v2" ON staff_leave_settings
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_leave_settings_insert_v2" ON staff_leave_settings
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_leave_settings_update_v2" ON staff_leave_settings
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_leave_settings_delete_v2" ON staff_leave_settings
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.20 shift_availability_submissions  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "shift_availability_submissions_select" ON shift_availability_submissions;
DROP POLICY IF EXISTS "shift_availability_submissions_insert" ON shift_availability_submissions;
DROP POLICY IF EXISTS "shift_availability_submissions_update" ON shift_availability_submissions;
DROP POLICY IF EXISTS "shift_availability_submissions_delete" ON shift_availability_submissions;

CREATE POLICY "shift_availability_submissions_select_v2" ON shift_availability_submissions
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_availability_submissions_insert_v2" ON shift_availability_submissions
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_availability_submissions_update_v2" ON shift_availability_submissions
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_availability_submissions_delete_v2" ON shift_availability_submissions
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.21 shift_availability_deadlines  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "shift_availability_deadlines_select" ON shift_availability_deadlines;
DROP POLICY IF EXISTS "shift_availability_deadlines_insert" ON shift_availability_deadlines;
DROP POLICY IF EXISTS "shift_availability_deadlines_update" ON shift_availability_deadlines;
DROP POLICY IF EXISTS "shift_availability_deadlines_delete" ON shift_availability_deadlines;

CREATE POLICY "shift_availability_deadlines_select_v2" ON shift_availability_deadlines
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_availability_deadlines_insert_v2" ON shift_availability_deadlines
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_availability_deadlines_update_v2" ON shift_availability_deadlines
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "shift_availability_deadlines_delete_v2" ON shift_availability_deadlines
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.22 paid_leave_balances  (has facility_id + user_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "paid_leave_balances_select" ON paid_leave_balances;
DROP POLICY IF EXISTS "paid_leave_balances_insert" ON paid_leave_balances;
DROP POLICY IF EXISTS "paid_leave_balances_update" ON paid_leave_balances;

CREATE POLICY "paid_leave_balances_select_v2" ON paid_leave_balances
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "paid_leave_balances_insert_v2" ON paid_leave_balances
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "paid_leave_balances_update_v2" ON paid_leave_balances
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.23 leave_requests  (has facility_id + user_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_select_policy" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_all_policy" ON leave_requests;

CREATE POLICY "leave_requests_select_v2" ON leave_requests
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "leave_requests_insert_v2" ON leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "leave_requests_update_v2" ON leave_requests
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "leave_requests_delete_v2" ON leave_requests
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.24 child_additions  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "child_additions_all" ON child_additions;

CREATE POLICY "child_additions_select_v2" ON child_additions
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_additions_insert_v2" ON child_additions
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_additions_update_v2" ON child_additions
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_additions_delete_v2" ON child_additions
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.25 facility_addition_settings  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "facility_addition_settings_all" ON facility_addition_settings;

CREATE POLICY "facility_addition_settings_select_v2" ON facility_addition_settings
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_addition_settings_insert_v2" ON facility_addition_settings
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_addition_settings_update_v2" ON facility_addition_settings
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_addition_settings_delete_v2" ON facility_addition_settings
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.26 daily_addition_records  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "daily_addition_records_all" ON daily_addition_records;

CREATE POLICY "daily_addition_records_select_v2" ON daily_addition_records
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_addition_records_insert_v2" ON daily_addition_records
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_addition_records_update_v2" ON daily_addition_records
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_addition_records_delete_v2" ON daily_addition_records
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.27 monthly_revenue_estimates  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "monthly_revenue_estimates_all" ON monthly_revenue_estimates;

CREATE POLICY "monthly_revenue_estimates_select_v2" ON monthly_revenue_estimates
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_revenue_estimates_insert_v2" ON monthly_revenue_estimates
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_revenue_estimates_update_v2" ON monthly_revenue_estimates
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "monthly_revenue_estimates_delete_v2" ON monthly_revenue_estimates
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.28 child_documents  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "child_documents_select" ON child_documents;
DROP POLICY IF EXISTS "child_documents_insert" ON child_documents;
DROP POLICY IF EXISTS "child_documents_update" ON child_documents;
DROP POLICY IF EXISTS "child_documents_delete" ON child_documents;

CREATE POLICY "child_documents_select_v2" ON child_documents
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_documents_insert_v2" ON child_documents
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_documents_update_v2" ON child_documents
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_documents_delete_v2" ON child_documents
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.29 facility_children_settings  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "fcs_select" ON facility_children_settings;
DROP POLICY IF EXISTS "fcs_insert" ON facility_children_settings;
DROP POLICY IF EXISTS "fcs_update" ON facility_children_settings;
DROP POLICY IF EXISTS "fcs_delete" ON facility_children_settings;

CREATE POLICY "fcs_select_v2" ON facility_children_settings
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "fcs_insert_v2" ON facility_children_settings
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "fcs_update_v2" ON facility_children_settings
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "fcs_delete_v2" ON facility_children_settings
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.31 facility_time_slots  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "facility_time_slots_select_policy" ON facility_time_slots;
DROP POLICY IF EXISTS "facility_time_slots_insert_policy" ON facility_time_slots;
DROP POLICY IF EXISTS "facility_time_slots_update_policy" ON facility_time_slots;
DROP POLICY IF EXISTS "facility_time_slots_delete_policy" ON facility_time_slots;

CREATE POLICY "facility_time_slots_select_v2" ON facility_time_slots
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_time_slots_insert_v2" ON facility_time_slots
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_time_slots_update_v2" ON facility_time_slots
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_time_slots_delete_v2" ON facility_time_slots
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.32 notifications  (has facility_id + user_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "notifications_read_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;

CREATE POLICY "notifications_select_v2" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text
    OR (user_id IS NULL AND facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL))
  );

CREATE POLICY "notifications_insert_v2" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "notifications_update_v2" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()::text
    OR facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
  );

-- -------------------------------------------------------
-- 2.33 attendance_records  (has facility_id + user_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "attendance_records_allow_all" ON attendance_records;

CREATE POLICY "attendance_records_select_v2" ON attendance_records
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "attendance_records_insert_v2" ON attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "attendance_records_update_v2" ON attendance_records
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.34 facility_work_tool_settings  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "facility_work_tool_settings_allow_all" ON facility_work_tool_settings;

CREATE POLICY "facility_work_tool_settings_select_v2" ON facility_work_tool_settings
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_work_tool_settings_insert_v2" ON facility_work_tool_settings
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_work_tool_settings_update_v2" ON facility_work_tool_settings
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.35 connect_meetings  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "connect_meetings_all" ON connect_meetings;

CREATE POLICY "connect_meetings_select_v2" ON connect_meetings
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "connect_meetings_insert_v2" ON connect_meetings
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "connect_meetings_update_v2" ON connect_meetings
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "connect_meetings_delete_v2" ON connect_meetings
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.36 connect_meeting_date_options  (no facility_id, scoped via meeting_id -> connect_meetings.facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "connect_date_options_all" ON connect_meeting_date_options;

CREATE POLICY "connect_date_options_select_v2" ON connect_meeting_date_options
  FOR SELECT TO authenticated
  USING (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_date_options_insert_v2" ON connect_meeting_date_options
  FOR INSERT TO authenticated
  WITH CHECK (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_date_options_update_v2" ON connect_meeting_date_options
  FOR UPDATE TO authenticated
  USING (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_date_options_delete_v2" ON connect_meeting_date_options
  FOR DELETE TO authenticated
  USING (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

-- -------------------------------------------------------
-- 2.37 connect_meeting_participants  (no facility_id, scoped via meeting_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "connect_participants_all" ON connect_meeting_participants;

CREATE POLICY "connect_participants_select_v2" ON connect_meeting_participants
  FOR SELECT TO authenticated
  USING (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_participants_insert_v2" ON connect_meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_participants_update_v2" ON connect_meeting_participants
  FOR UPDATE TO authenticated
  USING (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_participants_delete_v2" ON connect_meeting_participants
  FOR DELETE TO authenticated
  USING (
    meeting_id IN (
      SELECT cm.id FROM connect_meetings cm
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

-- -------------------------------------------------------
-- 2.38 connect_meeting_responses  (no facility_id, scoped via participant -> meeting)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "connect_responses_all" ON connect_meeting_responses;

CREATE POLICY "connect_responses_select_v2" ON connect_meeting_responses
  FOR SELECT TO authenticated
  USING (
    participant_id IN (
      SELECT p.id FROM connect_meeting_participants p
      JOIN connect_meetings cm ON p.meeting_id = cm.id
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_responses_insert_v2" ON connect_meeting_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT p.id FROM connect_meeting_participants p
      JOIN connect_meetings cm ON p.meeting_id = cm.id
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_responses_update_v2" ON connect_meeting_responses
  FOR UPDATE TO authenticated
  USING (
    participant_id IN (
      SELECT p.id FROM connect_meeting_participants p
      JOIN connect_meetings cm ON p.meeting_id = cm.id
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

CREATE POLICY "connect_responses_delete_v2" ON connect_meeting_responses
  FOR DELETE TO authenticated
  USING (
    participant_id IN (
      SELECT p.id FROM connect_meeting_participants p
      JOIN connect_meetings cm ON p.meeting_id = cm.id
      WHERE cm.facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL)
    )
  );

-- -------------------------------------------------------
-- 2.39 addition_setting_history  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "addition_setting_history_all" ON addition_setting_history;

CREATE POLICY "addition_setting_history_select_v2" ON addition_setting_history
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "addition_setting_history_insert_v2" ON addition_setting_history
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "addition_setting_history_update_v2" ON addition_setting_history
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "addition_setting_history_delete_v2" ON addition_setting_history
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.40 facility_history  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "facility_history_all" ON facility_history;

CREATE POLICY "facility_history_select_v2" ON facility_history
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_history_insert_v2" ON facility_history
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_history_update_v2" ON facility_history
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "facility_history_delete_v2" ON facility_history
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.41 staff_assignment_history  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "staff_assignment_history_all" ON staff_assignment_history;

CREATE POLICY "staff_assignment_history_select_v2" ON staff_assignment_history
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_assignment_history_insert_v2" ON staff_assignment_history
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_assignment_history_update_v2" ON staff_assignment_history
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_assignment_history_delete_v2" ON staff_assignment_history
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.42 document_submissions  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "document_submissions_all" ON document_submissions;

CREATE POLICY "document_submissions_select_v2" ON document_submissions
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "document_submissions_insert_v2" ON document_submissions
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "document_submissions_update_v2" ON document_submissions
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "document_submissions_delete_v2" ON document_submissions
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.43 deadline_alerts  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "deadline_alerts_all" ON deadline_alerts;

CREATE POLICY "deadline_alerts_select_v2" ON deadline_alerts
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "deadline_alerts_insert_v2" ON deadline_alerts
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "deadline_alerts_update_v2" ON deadline_alerts
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "deadline_alerts_delete_v2" ON deadline_alerts
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.44 child_addition_plans  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "child_addition_plans_all" ON child_addition_plans;

CREATE POLICY "child_addition_plans_select_v2" ON child_addition_plans
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_addition_plans_insert_v2" ON child_addition_plans
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_addition_plans_update_v2" ON child_addition_plans
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "child_addition_plans_delete_v2" ON child_addition_plans
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.45 staff_personnel_settings  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "staff_personnel_select" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_insert" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_update" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_delete" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_all" ON staff_personnel_settings;

CREATE POLICY "staff_personnel_select_v3" ON staff_personnel_settings
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_personnel_insert_v3" ON staff_personnel_settings
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_personnel_update_v3" ON staff_personnel_settings
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "staff_personnel_delete_v3" ON staff_personnel_settings
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.46 daily_staffing_compliance  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "daily_compliance_select" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_insert" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_update" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_delete" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_all" ON daily_staffing_compliance;

CREATE POLICY "daily_compliance_select_v3" ON daily_staffing_compliance
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_compliance_insert_v3" ON daily_staffing_compliance
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_compliance_update_v3" ON daily_staffing_compliance
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "daily_compliance_delete_v3" ON daily_staffing_compliance
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.47 work_schedule_reports  (has facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "work_schedule_reports_select" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_insert" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_update" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_delete" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_all" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_select_v2" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_insert_v2" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_update_v2" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_delete_v2" ON work_schedule_reports;

CREATE POLICY "work_schedule_reports_select_v3" ON work_schedule_reports
  FOR SELECT TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "work_schedule_reports_insert_v3" ON work_schedule_reports
  FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "work_schedule_reports_update_v3" ON work_schedule_reports
  FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

CREATE POLICY "work_schedule_reports_delete_v3" ON work_schedule_reports
  FOR DELETE TO authenticated
  USING (facility_id IN (SELECT er.facility_id FROM employment_records er WHERE er.user_id = auth.uid()::text AND er.end_date IS NULL));

-- -------------------------------------------------------
-- 2.50 staff (special: has facility_id, used for legacy staff records)
-- -------------------------------------------------------
-- Note: staff table policies were not USING(true) in existing migrations,
-- but it references facility_id. The table is scoped via staff.facility_id.
-- No existing USING(true) policies to drop here.

-- =====================================================================
-- CATEGORY 3: USER-SCOPED TABLES (have user_id, no facility_id)
-- =====================================================================

-- -------------------------------------------------------
-- 3.1  work_experience_records  (has user_id, no facility_id)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "work_experience_read_own" ON work_experience_records;
DROP POLICY IF EXISTS "work_experience_insert_own" ON work_experience_records;
DROP POLICY IF EXISTS "work_experience_update_own" ON work_experience_records;
DROP POLICY IF EXISTS "work_experience_delete_own" ON work_experience_records;

CREATE POLICY "work_experience_select_v2" ON work_experience_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "work_experience_insert_v2" ON work_experience_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "work_experience_update_v2" ON work_experience_records
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "work_experience_delete_v2" ON work_experience_records
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

-- -------------------------------------------------------
-- 3.3  otp_codes  (has user_id -- authentication mechanism)
--      Note: OTP codes need to be accessible during the auth flow
--      which happens before a user is fully authenticated.
--      These are managed by the server via service_role key.
--      Keeping restrictive: own records only.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow insert otp_codes" ON otp_codes;
DROP POLICY IF EXISTS "Allow select otp_codes" ON otp_codes;
DROP POLICY IF EXISTS "Allow delete otp_codes" ON otp_codes;

-- OTP codes are managed server-side via service_role which bypasses RLS.
-- No client-side policies needed. All client access is denied.
-- Comment: otp_codes are server-managed. service_role bypasses RLS.


-- =====================================================================
-- CATEGORY 5: SPECIAL CASES
-- =====================================================================

-- -------------------------------------------------------
-- 5.1  users  (special: own-record access via id = auth.uid())
--      Note: The users table may not have had USING(true) policies
--      from the searched migrations, but if it does they should be replaced.
-- -------------------------------------------------------
-- No existing USING(true) policies found on users table in migrations.
-- The users table should use: USING (id = auth.uid()::text) for own-record access.
-- This is left as documentation; add if needed:
-- CREATE POLICY "users_own_select" ON users FOR SELECT USING (id = auth.uid()::text);

-- -------------------------------------------------------
-- 5.2  addition_definitions  (no facility_id -- global master)
--      Already has proper facility-scoped policy from daily_program_tables migration.
--      SELECT USING(true) is correct for master data.
-- -------------------------------------------------------
-- addition_definitions_read_policy already correct (SELECT USING true)

COMMIT;

-- =====================================================================
-- SUMMARY OF CHANGES
-- =====================================================================
--
-- TABLES LOCKED DOWN (grouped by category):
--
-- Master/Reference (SELECT only, no mutations):
--   service_types, regional_units, base_rewards, addition_categories,
--   additions, deductions, addition_staff_requirements, document_templates,
--   system_config, platform_invitation_tokens
--
-- Facility-scoped:
--   children, contracts, chat_messages, daily_logs, service_plans,
--   incident_reports, training_records, committee_meetings, audit_checklists,
--   document_uploads, facility_document_configs, expense_categories, expenses,
--   monthly_financials, shifts, shift_patterns, monthly_shift_schedules,
--   shift_confirmations, staff_leave_settings, shift_availability_submissions,
--   shift_availability_deadlines, paid_leave_balances, leave_requests,
--   child_additions, facility_addition_settings, daily_addition_records,
--   monthly_revenue_estimates, child_documents, facility_children_settings,
--   facility_time_slots, notifications, attendance_records,
--   facility_work_tool_settings, connect_meetings,
--   connect_meeting_date_options, connect_meeting_participants,
--   connect_meeting_responses, addition_setting_history, facility_history,
--   staff_assignment_history, document_submissions, deadline_alerts,
--   child_addition_plans, staff_personnel_settings, daily_staffing_compliance,
--   work_schedule_reports
--
-- User-scoped:
--   work_experience_records, otp_codes
-- =====================================================================
