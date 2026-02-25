-- =====================================================================
-- FIX RLS FOR ANON ROLE
-- The app uses the anon key with custom localStorage-based auth.
-- There is no Supabase Auth session, so auth.uid() is always NULL.
-- All v2/v3 policies from the lockdown migration use TO authenticated
-- and check auth.uid()::text, which means ALL queries return empty
-- and ALL writes are blocked.
--
-- Fix: Drop every v2/v3 policy and re-create with USING(true) / WITH CHECK(true)
-- scoped to facility_id checks done at the application layer.
-- This restores the pre-lockdown behavior while keeping RLS enabled.
--
-- When the app migrates to Supabase Auth sessions, re-apply proper policies.
-- =====================================================================

BEGIN;

-- =====================================================================
-- CATEGORY 1: MASTER / REFERENCE TABLES (SELECT only)
-- These were already USING(true) - just need to also allow anon
-- =====================================================================

-- 1.1 service_types
DROP POLICY IF EXISTS "service_types_select" ON service_types;
CREATE POLICY "service_types_select_v4" ON service_types FOR SELECT USING (true);

-- 1.2 regional_units
DROP POLICY IF EXISTS "regional_units_select" ON regional_units;
CREATE POLICY "regional_units_select_v4" ON regional_units FOR SELECT USING (true);

-- 1.3 base_rewards
DROP POLICY IF EXISTS "base_rewards_select" ON base_rewards;
CREATE POLICY "base_rewards_select_v4" ON base_rewards FOR SELECT USING (true);

-- 1.4 addition_categories
DROP POLICY IF EXISTS "addition_categories_select" ON addition_categories;
CREATE POLICY "addition_categories_select_v4" ON addition_categories FOR SELECT USING (true);

-- 1.5 additions
DROP POLICY IF EXISTS "additions_select" ON additions;
CREATE POLICY "additions_select_v4" ON additions FOR SELECT USING (true);

-- 1.6 deductions
DROP POLICY IF EXISTS "deductions_select" ON deductions;
CREATE POLICY "deductions_select_v4" ON deductions FOR SELECT USING (true);

-- 1.7 addition_staff_requirements
DROP POLICY IF EXISTS "addition_requirements_select_v3" ON addition_staff_requirements;
CREATE POLICY "addition_requirements_select_v4" ON addition_staff_requirements FOR SELECT USING (true);

-- 1.8 document_templates
DROP POLICY IF EXISTS "document_templates_select_v2" ON document_templates;
CREATE POLICY "document_templates_select_v4" ON document_templates FOR SELECT USING (true);

-- 1.15 system_config
DROP POLICY IF EXISTS "system_config_select_v2" ON system_config;
CREATE POLICY "system_config_select_v4" ON system_config FOR SELECT USING (true);
CREATE POLICY "system_config_insert_v4" ON system_config FOR INSERT WITH CHECK (true);
CREATE POLICY "system_config_update_v4" ON system_config FOR UPDATE USING (true);

-- 1.16 platform_invitation_tokens
DROP POLICY IF EXISTS "platform_tokens_select_v2" ON platform_invitation_tokens;
CREATE POLICY "platform_tokens_select_v4" ON platform_invitation_tokens FOR SELECT USING (true);
CREATE POLICY "platform_tokens_insert_v4" ON platform_invitation_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "platform_tokens_update_v4" ON platform_invitation_tokens FOR UPDATE USING (true);

-- =====================================================================
-- CATEGORY 2: FACILITY-SCOPED TABLES
-- Drop v2/v3 policies, recreate with USING(true) / WITH CHECK(true)
-- =====================================================================

-- 2.1 children
DROP POLICY IF EXISTS "children_select_v2" ON children;
DROP POLICY IF EXISTS "children_insert_v2" ON children;
DROP POLICY IF EXISTS "children_update_v2" ON children;
CREATE POLICY "children_select_v4" ON children FOR SELECT USING (true);
CREATE POLICY "children_insert_v4" ON children FOR INSERT WITH CHECK (true);
CREATE POLICY "children_update_v4" ON children FOR UPDATE USING (true);
CREATE POLICY "children_delete_v4" ON children FOR DELETE USING (true);

-- 2.2 contracts
DROP POLICY IF EXISTS "contracts_select_v2" ON contracts;
DROP POLICY IF EXISTS "contracts_insert_v2" ON contracts;
DROP POLICY IF EXISTS "contracts_update_v2" ON contracts;
CREATE POLICY "contracts_select_v4" ON contracts FOR SELECT USING (true);
CREATE POLICY "contracts_insert_v4" ON contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "contracts_update_v4" ON contracts FOR UPDATE USING (true);
CREATE POLICY "contracts_delete_v4" ON contracts FOR DELETE USING (true);

-- 2.3 chat_messages
DROP POLICY IF EXISTS "chat_messages_select_v2" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert_v2" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_update_v2" ON chat_messages;
CREATE POLICY "chat_messages_select_v4" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "chat_messages_insert_v4" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "chat_messages_update_v4" ON chat_messages FOR UPDATE USING (true);
CREATE POLICY "chat_messages_delete_v4" ON chat_messages FOR DELETE USING (true);

-- 2.4 daily_logs
DROP POLICY IF EXISTS "daily_logs_select_v2" ON daily_logs;
DROP POLICY IF EXISTS "daily_logs_insert_v2" ON daily_logs;
DROP POLICY IF EXISTS "daily_logs_update_v2" ON daily_logs;
DROP POLICY IF EXISTS "daily_logs_delete_v2" ON daily_logs;
CREATE POLICY "daily_logs_select_v4" ON daily_logs FOR SELECT USING (true);
CREATE POLICY "daily_logs_insert_v4" ON daily_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_logs_update_v4" ON daily_logs FOR UPDATE USING (true);
CREATE POLICY "daily_logs_delete_v4" ON daily_logs FOR DELETE USING (true);

-- 2.5 service_plans
DROP POLICY IF EXISTS "service_plans_select_v2" ON service_plans;
DROP POLICY IF EXISTS "service_plans_insert_v2" ON service_plans;
DROP POLICY IF EXISTS "service_plans_update_v2" ON service_plans;
DROP POLICY IF EXISTS "service_plans_delete_v2" ON service_plans;
CREATE POLICY "service_plans_select_v4" ON service_plans FOR SELECT USING (true);
CREATE POLICY "service_plans_insert_v4" ON service_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "service_plans_update_v4" ON service_plans FOR UPDATE USING (true);
CREATE POLICY "service_plans_delete_v4" ON service_plans FOR DELETE USING (true);

-- 2.6 incident_reports
DROP POLICY IF EXISTS "incident_reports_select_v2" ON incident_reports;
DROP POLICY IF EXISTS "incident_reports_insert_v2" ON incident_reports;
DROP POLICY IF EXISTS "incident_reports_update_v2" ON incident_reports;
DROP POLICY IF EXISTS "incident_reports_delete_v2" ON incident_reports;
CREATE POLICY "incident_reports_select_v4" ON incident_reports FOR SELECT USING (true);
CREATE POLICY "incident_reports_insert_v4" ON incident_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "incident_reports_update_v4" ON incident_reports FOR UPDATE USING (true);
CREATE POLICY "incident_reports_delete_v4" ON incident_reports FOR DELETE USING (true);

-- 2.7 training_records
DROP POLICY IF EXISTS "training_records_select_v2" ON training_records;
DROP POLICY IF EXISTS "training_records_insert_v2" ON training_records;
DROP POLICY IF EXISTS "training_records_update_v2" ON training_records;
DROP POLICY IF EXISTS "training_records_delete_v2" ON training_records;
CREATE POLICY "training_records_select_v4" ON training_records FOR SELECT USING (true);
CREATE POLICY "training_records_insert_v4" ON training_records FOR INSERT WITH CHECK (true);
CREATE POLICY "training_records_update_v4" ON training_records FOR UPDATE USING (true);
CREATE POLICY "training_records_delete_v4" ON training_records FOR DELETE USING (true);

-- 2.8 committee_meetings
DROP POLICY IF EXISTS "committee_meetings_select_v2" ON committee_meetings;
DROP POLICY IF EXISTS "committee_meetings_insert_v2" ON committee_meetings;
DROP POLICY IF EXISTS "committee_meetings_update_v2" ON committee_meetings;
DROP POLICY IF EXISTS "committee_meetings_delete_v2" ON committee_meetings;
CREATE POLICY "committee_meetings_select_v4" ON committee_meetings FOR SELECT USING (true);
CREATE POLICY "committee_meetings_insert_v4" ON committee_meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "committee_meetings_update_v4" ON committee_meetings FOR UPDATE USING (true);
CREATE POLICY "committee_meetings_delete_v4" ON committee_meetings FOR DELETE USING (true);

-- 2.9 audit_checklists
DROP POLICY IF EXISTS "audit_checklists_select_v2" ON audit_checklists;
DROP POLICY IF EXISTS "audit_checklists_insert_v2" ON audit_checklists;
DROP POLICY IF EXISTS "audit_checklists_update_v2" ON audit_checklists;
DROP POLICY IF EXISTS "audit_checklists_delete_v2" ON audit_checklists;
CREATE POLICY "audit_checklists_select_v4" ON audit_checklists FOR SELECT USING (true);
CREATE POLICY "audit_checklists_insert_v4" ON audit_checklists FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_checklists_update_v4" ON audit_checklists FOR UPDATE USING (true);
CREATE POLICY "audit_checklists_delete_v4" ON audit_checklists FOR DELETE USING (true);

-- 2.10 document_uploads
DROP POLICY IF EXISTS "document_uploads_select_v2" ON document_uploads;
DROP POLICY IF EXISTS "document_uploads_insert_v2" ON document_uploads;
DROP POLICY IF EXISTS "document_uploads_update_v2" ON document_uploads;
DROP POLICY IF EXISTS "document_uploads_delete_v2" ON document_uploads;
CREATE POLICY "document_uploads_select_v4" ON document_uploads FOR SELECT USING (true);
CREATE POLICY "document_uploads_insert_v4" ON document_uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "document_uploads_update_v4" ON document_uploads FOR UPDATE USING (true);
CREATE POLICY "document_uploads_delete_v4" ON document_uploads FOR DELETE USING (true);

-- 2.11 facility_document_configs
DROP POLICY IF EXISTS "facility_document_configs_select_v2" ON facility_document_configs;
DROP POLICY IF EXISTS "facility_document_configs_insert_v2" ON facility_document_configs;
DROP POLICY IF EXISTS "facility_document_configs_update_v2" ON facility_document_configs;
DROP POLICY IF EXISTS "facility_document_configs_delete_v2" ON facility_document_configs;
CREATE POLICY "facility_document_configs_select_v4" ON facility_document_configs FOR SELECT USING (true);
CREATE POLICY "facility_document_configs_insert_v4" ON facility_document_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_document_configs_update_v4" ON facility_document_configs FOR UPDATE USING (true);
CREATE POLICY "facility_document_configs_delete_v4" ON facility_document_configs FOR DELETE USING (true);

-- 2.12 expense_categories
DROP POLICY IF EXISTS "expense_categories_select_v2" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_insert_v2" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_update_v2" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete_v2" ON expense_categories;
CREATE POLICY "expense_categories_select_v4" ON expense_categories FOR SELECT USING (true);
CREATE POLICY "expense_categories_insert_v4" ON expense_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "expense_categories_update_v4" ON expense_categories FOR UPDATE USING (true);
CREATE POLICY "expense_categories_delete_v4" ON expense_categories FOR DELETE USING (true);

-- 2.13 expenses
DROP POLICY IF EXISTS "expenses_select_v2" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_v2" ON expenses;
DROP POLICY IF EXISTS "expenses_update_v2" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_v2" ON expenses;
CREATE POLICY "expenses_select_v4" ON expenses FOR SELECT USING (true);
CREATE POLICY "expenses_insert_v4" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "expenses_update_v4" ON expenses FOR UPDATE USING (true);
CREATE POLICY "expenses_delete_v4" ON expenses FOR DELETE USING (true);

-- 2.14 monthly_financials
DROP POLICY IF EXISTS "monthly_financials_select_v2" ON monthly_financials;
DROP POLICY IF EXISTS "monthly_financials_insert_v2" ON monthly_financials;
DROP POLICY IF EXISTS "monthly_financials_update_v2" ON monthly_financials;
DROP POLICY IF EXISTS "monthly_financials_delete_v2" ON monthly_financials;
CREATE POLICY "monthly_financials_select_v4" ON monthly_financials FOR SELECT USING (true);
CREATE POLICY "monthly_financials_insert_v4" ON monthly_financials FOR INSERT WITH CHECK (true);
CREATE POLICY "monthly_financials_update_v4" ON monthly_financials FOR UPDATE USING (true);
CREATE POLICY "monthly_financials_delete_v4" ON monthly_financials FOR DELETE USING (true);

-- 2.15 shifts
DROP POLICY IF EXISTS "shifts_select_v2" ON shifts;
DROP POLICY IF EXISTS "shifts_insert_v2" ON shifts;
DROP POLICY IF EXISTS "shifts_update_v2" ON shifts;
DROP POLICY IF EXISTS "shifts_delete_v2" ON shifts;
CREATE POLICY "shifts_select_v4" ON shifts FOR SELECT USING (true);
CREATE POLICY "shifts_insert_v4" ON shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "shifts_update_v4" ON shifts FOR UPDATE USING (true);
CREATE POLICY "shifts_delete_v4" ON shifts FOR DELETE USING (true);

-- 2.16 shift_patterns
DROP POLICY IF EXISTS "shift_patterns_select_v2" ON shift_patterns;
DROP POLICY IF EXISTS "shift_patterns_insert_v2" ON shift_patterns;
DROP POLICY IF EXISTS "shift_patterns_update_v2" ON shift_patterns;
DROP POLICY IF EXISTS "shift_patterns_delete_v2" ON shift_patterns;
CREATE POLICY "shift_patterns_select_v4" ON shift_patterns FOR SELECT USING (true);
CREATE POLICY "shift_patterns_insert_v4" ON shift_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "shift_patterns_update_v4" ON shift_patterns FOR UPDATE USING (true);
CREATE POLICY "shift_patterns_delete_v4" ON shift_patterns FOR DELETE USING (true);

-- 2.17 monthly_shift_schedules
DROP POLICY IF EXISTS "monthly_shift_schedules_select_v2" ON monthly_shift_schedules;
DROP POLICY IF EXISTS "monthly_shift_schedules_insert_v2" ON monthly_shift_schedules;
DROP POLICY IF EXISTS "monthly_shift_schedules_update_v2" ON monthly_shift_schedules;
DROP POLICY IF EXISTS "monthly_shift_schedules_delete_v2" ON monthly_shift_schedules;
CREATE POLICY "monthly_shift_schedules_select_v4" ON monthly_shift_schedules FOR SELECT USING (true);
CREATE POLICY "monthly_shift_schedules_insert_v4" ON monthly_shift_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "monthly_shift_schedules_update_v4" ON monthly_shift_schedules FOR UPDATE USING (true);
CREATE POLICY "monthly_shift_schedules_delete_v4" ON monthly_shift_schedules FOR DELETE USING (true);

-- 2.18 shift_confirmations
DROP POLICY IF EXISTS "shift_confirmations_select_v2" ON shift_confirmations;
DROP POLICY IF EXISTS "shift_confirmations_insert_v2" ON shift_confirmations;
DROP POLICY IF EXISTS "shift_confirmations_update_v2" ON shift_confirmations;
DROP POLICY IF EXISTS "shift_confirmations_delete_v2" ON shift_confirmations;
DROP POLICY IF EXISTS "shift_confirmations_facility_select_v2" ON shift_confirmations;
CREATE POLICY "shift_confirmations_select_v4" ON shift_confirmations FOR SELECT USING (true);
CREATE POLICY "shift_confirmations_insert_v4" ON shift_confirmations FOR INSERT WITH CHECK (true);
CREATE POLICY "shift_confirmations_update_v4" ON shift_confirmations FOR UPDATE USING (true);
CREATE POLICY "shift_confirmations_delete_v4" ON shift_confirmations FOR DELETE USING (true);

-- 2.19 staff_leave_settings
DROP POLICY IF EXISTS "staff_leave_settings_select_v2" ON staff_leave_settings;
DROP POLICY IF EXISTS "staff_leave_settings_insert_v2" ON staff_leave_settings;
DROP POLICY IF EXISTS "staff_leave_settings_update_v2" ON staff_leave_settings;
DROP POLICY IF EXISTS "staff_leave_settings_delete_v2" ON staff_leave_settings;
CREATE POLICY "staff_leave_settings_select_v4" ON staff_leave_settings FOR SELECT USING (true);
CREATE POLICY "staff_leave_settings_insert_v4" ON staff_leave_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_leave_settings_update_v4" ON staff_leave_settings FOR UPDATE USING (true);
CREATE POLICY "staff_leave_settings_delete_v4" ON staff_leave_settings FOR DELETE USING (true);

-- 2.20 shift_availability_submissions
DROP POLICY IF EXISTS "shift_availability_submissions_select_v2" ON shift_availability_submissions;
DROP POLICY IF EXISTS "shift_availability_submissions_insert_v2" ON shift_availability_submissions;
DROP POLICY IF EXISTS "shift_availability_submissions_update_v2" ON shift_availability_submissions;
DROP POLICY IF EXISTS "shift_availability_submissions_delete_v2" ON shift_availability_submissions;
CREATE POLICY "shift_availability_submissions_select_v4" ON shift_availability_submissions FOR SELECT USING (true);
CREATE POLICY "shift_availability_submissions_insert_v4" ON shift_availability_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "shift_availability_submissions_update_v4" ON shift_availability_submissions FOR UPDATE USING (true);
CREATE POLICY "shift_availability_submissions_delete_v4" ON shift_availability_submissions FOR DELETE USING (true);

-- 2.21 shift_availability_deadlines
DROP POLICY IF EXISTS "shift_availability_deadlines_select_v2" ON shift_availability_deadlines;
DROP POLICY IF EXISTS "shift_availability_deadlines_insert_v2" ON shift_availability_deadlines;
DROP POLICY IF EXISTS "shift_availability_deadlines_update_v2" ON shift_availability_deadlines;
DROP POLICY IF EXISTS "shift_availability_deadlines_delete_v2" ON shift_availability_deadlines;
CREATE POLICY "shift_availability_deadlines_select_v4" ON shift_availability_deadlines FOR SELECT USING (true);
CREATE POLICY "shift_availability_deadlines_insert_v4" ON shift_availability_deadlines FOR INSERT WITH CHECK (true);
CREATE POLICY "shift_availability_deadlines_update_v4" ON shift_availability_deadlines FOR UPDATE USING (true);
CREATE POLICY "shift_availability_deadlines_delete_v4" ON shift_availability_deadlines FOR DELETE USING (true);

-- 2.22 paid_leave_balances
DROP POLICY IF EXISTS "paid_leave_balances_select_v2" ON paid_leave_balances;
DROP POLICY IF EXISTS "paid_leave_balances_insert_v2" ON paid_leave_balances;
DROP POLICY IF EXISTS "paid_leave_balances_update_v2" ON paid_leave_balances;
CREATE POLICY "paid_leave_balances_select_v4" ON paid_leave_balances FOR SELECT USING (true);
CREATE POLICY "paid_leave_balances_insert_v4" ON paid_leave_balances FOR INSERT WITH CHECK (true);
CREATE POLICY "paid_leave_balances_update_v4" ON paid_leave_balances FOR UPDATE USING (true);
CREATE POLICY "paid_leave_balances_delete_v4" ON paid_leave_balances FOR DELETE USING (true);

-- 2.23 leave_requests
DROP POLICY IF EXISTS "leave_requests_select_v2" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert_v2" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_v2" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete_v2" ON leave_requests;
CREATE POLICY "leave_requests_select_v4" ON leave_requests FOR SELECT USING (true);
CREATE POLICY "leave_requests_insert_v4" ON leave_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "leave_requests_update_v4" ON leave_requests FOR UPDATE USING (true);
CREATE POLICY "leave_requests_delete_v4" ON leave_requests FOR DELETE USING (true);

-- 2.24 child_additions
DROP POLICY IF EXISTS "child_additions_select_v2" ON child_additions;
DROP POLICY IF EXISTS "child_additions_insert_v2" ON child_additions;
DROP POLICY IF EXISTS "child_additions_update_v2" ON child_additions;
DROP POLICY IF EXISTS "child_additions_delete_v2" ON child_additions;
CREATE POLICY "child_additions_select_v4" ON child_additions FOR SELECT USING (true);
CREATE POLICY "child_additions_insert_v4" ON child_additions FOR INSERT WITH CHECK (true);
CREATE POLICY "child_additions_update_v4" ON child_additions FOR UPDATE USING (true);
CREATE POLICY "child_additions_delete_v4" ON child_additions FOR DELETE USING (true);

-- 2.25 facility_addition_settings
DROP POLICY IF EXISTS "facility_addition_settings_select_v2" ON facility_addition_settings;
DROP POLICY IF EXISTS "facility_addition_settings_insert_v2" ON facility_addition_settings;
DROP POLICY IF EXISTS "facility_addition_settings_update_v2" ON facility_addition_settings;
DROP POLICY IF EXISTS "facility_addition_settings_delete_v2" ON facility_addition_settings;
CREATE POLICY "facility_addition_settings_select_v4" ON facility_addition_settings FOR SELECT USING (true);
CREATE POLICY "facility_addition_settings_insert_v4" ON facility_addition_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_addition_settings_update_v4" ON facility_addition_settings FOR UPDATE USING (true);
CREATE POLICY "facility_addition_settings_delete_v4" ON facility_addition_settings FOR DELETE USING (true);

-- 2.26 daily_addition_records
DROP POLICY IF EXISTS "daily_addition_records_select_v2" ON daily_addition_records;
DROP POLICY IF EXISTS "daily_addition_records_insert_v2" ON daily_addition_records;
DROP POLICY IF EXISTS "daily_addition_records_update_v2" ON daily_addition_records;
DROP POLICY IF EXISTS "daily_addition_records_delete_v2" ON daily_addition_records;
CREATE POLICY "daily_addition_records_select_v4" ON daily_addition_records FOR SELECT USING (true);
CREATE POLICY "daily_addition_records_insert_v4" ON daily_addition_records FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_addition_records_update_v4" ON daily_addition_records FOR UPDATE USING (true);
CREATE POLICY "daily_addition_records_delete_v4" ON daily_addition_records FOR DELETE USING (true);

-- 2.27 monthly_revenue_estimates
DROP POLICY IF EXISTS "monthly_revenue_estimates_select_v2" ON monthly_revenue_estimates;
DROP POLICY IF EXISTS "monthly_revenue_estimates_insert_v2" ON monthly_revenue_estimates;
DROP POLICY IF EXISTS "monthly_revenue_estimates_update_v2" ON monthly_revenue_estimates;
DROP POLICY IF EXISTS "monthly_revenue_estimates_delete_v2" ON monthly_revenue_estimates;
CREATE POLICY "monthly_revenue_estimates_select_v4" ON monthly_revenue_estimates FOR SELECT USING (true);
CREATE POLICY "monthly_revenue_estimates_insert_v4" ON monthly_revenue_estimates FOR INSERT WITH CHECK (true);
CREATE POLICY "monthly_revenue_estimates_update_v4" ON monthly_revenue_estimates FOR UPDATE USING (true);
CREATE POLICY "monthly_revenue_estimates_delete_v4" ON monthly_revenue_estimates FOR DELETE USING (true);

-- 2.28 child_documents
DROP POLICY IF EXISTS "child_documents_select_v2" ON child_documents;
DROP POLICY IF EXISTS "child_documents_insert_v2" ON child_documents;
DROP POLICY IF EXISTS "child_documents_update_v2" ON child_documents;
DROP POLICY IF EXISTS "child_documents_delete_v2" ON child_documents;
CREATE POLICY "child_documents_select_v4" ON child_documents FOR SELECT USING (true);
CREATE POLICY "child_documents_insert_v4" ON child_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "child_documents_update_v4" ON child_documents FOR UPDATE USING (true);
CREATE POLICY "child_documents_delete_v4" ON child_documents FOR DELETE USING (true);

-- 2.29 facility_children_settings
DROP POLICY IF EXISTS "fcs_select_v2" ON facility_children_settings;
DROP POLICY IF EXISTS "fcs_insert_v2" ON facility_children_settings;
DROP POLICY IF EXISTS "fcs_update_v2" ON facility_children_settings;
DROP POLICY IF EXISTS "fcs_delete_v2" ON facility_children_settings;
CREATE POLICY "fcs_select_v4" ON facility_children_settings FOR SELECT USING (true);
CREATE POLICY "fcs_insert_v4" ON facility_children_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "fcs_update_v4" ON facility_children_settings FOR UPDATE USING (true);
CREATE POLICY "fcs_delete_v4" ON facility_children_settings FOR DELETE USING (true);

-- 2.31 facility_time_slots
DROP POLICY IF EXISTS "facility_time_slots_select_v2" ON facility_time_slots;
DROP POLICY IF EXISTS "facility_time_slots_insert_v2" ON facility_time_slots;
DROP POLICY IF EXISTS "facility_time_slots_update_v2" ON facility_time_slots;
DROP POLICY IF EXISTS "facility_time_slots_delete_v2" ON facility_time_slots;
CREATE POLICY "facility_time_slots_select_v4" ON facility_time_slots FOR SELECT USING (true);
CREATE POLICY "facility_time_slots_insert_v4" ON facility_time_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_time_slots_update_v4" ON facility_time_slots FOR UPDATE USING (true);
CREATE POLICY "facility_time_slots_delete_v4" ON facility_time_slots FOR DELETE USING (true);

-- 2.32 notifications
DROP POLICY IF EXISTS "notifications_select_v2" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_v2" ON notifications;
DROP POLICY IF EXISTS "notifications_update_v2" ON notifications;
CREATE POLICY "notifications_select_v4" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_insert_v4" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_v4" ON notifications FOR UPDATE USING (true);
CREATE POLICY "notifications_delete_v4" ON notifications FOR DELETE USING (true);

-- 2.33 attendance_records
DROP POLICY IF EXISTS "attendance_records_select_v2" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_insert_v2" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_update_v2" ON attendance_records;
CREATE POLICY "attendance_records_select_v4" ON attendance_records FOR SELECT USING (true);
CREATE POLICY "attendance_records_insert_v4" ON attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "attendance_records_update_v4" ON attendance_records FOR UPDATE USING (true);
CREATE POLICY "attendance_records_delete_v4" ON attendance_records FOR DELETE USING (true);

-- 2.34 facility_work_tool_settings
DROP POLICY IF EXISTS "facility_work_tool_settings_select_v2" ON facility_work_tool_settings;
DROP POLICY IF EXISTS "facility_work_tool_settings_insert_v2" ON facility_work_tool_settings;
DROP POLICY IF EXISTS "facility_work_tool_settings_update_v2" ON facility_work_tool_settings;
CREATE POLICY "facility_work_tool_settings_select_v4" ON facility_work_tool_settings FOR SELECT USING (true);
CREATE POLICY "facility_work_tool_settings_insert_v4" ON facility_work_tool_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_work_tool_settings_update_v4" ON facility_work_tool_settings FOR UPDATE USING (true);
CREATE POLICY "facility_work_tool_settings_delete_v4" ON facility_work_tool_settings FOR DELETE USING (true);

-- 2.35 connect_meetings
DROP POLICY IF EXISTS "connect_meetings_select_v2" ON connect_meetings;
DROP POLICY IF EXISTS "connect_meetings_insert_v2" ON connect_meetings;
DROP POLICY IF EXISTS "connect_meetings_update_v2" ON connect_meetings;
DROP POLICY IF EXISTS "connect_meetings_delete_v2" ON connect_meetings;
CREATE POLICY "connect_meetings_select_v4" ON connect_meetings FOR SELECT USING (true);
CREATE POLICY "connect_meetings_insert_v4" ON connect_meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "connect_meetings_update_v4" ON connect_meetings FOR UPDATE USING (true);
CREATE POLICY "connect_meetings_delete_v4" ON connect_meetings FOR DELETE USING (true);

-- 2.36 connect_meeting_date_options
DROP POLICY IF EXISTS "connect_date_options_select_v2" ON connect_meeting_date_options;
DROP POLICY IF EXISTS "connect_date_options_insert_v2" ON connect_meeting_date_options;
DROP POLICY IF EXISTS "connect_date_options_update_v2" ON connect_meeting_date_options;
DROP POLICY IF EXISTS "connect_date_options_delete_v2" ON connect_meeting_date_options;
CREATE POLICY "connect_date_options_select_v4" ON connect_meeting_date_options FOR SELECT USING (true);
CREATE POLICY "connect_date_options_insert_v4" ON connect_meeting_date_options FOR INSERT WITH CHECK (true);
CREATE POLICY "connect_date_options_update_v4" ON connect_meeting_date_options FOR UPDATE USING (true);
CREATE POLICY "connect_date_options_delete_v4" ON connect_meeting_date_options FOR DELETE USING (true);

-- 2.37 connect_meeting_participants
DROP POLICY IF EXISTS "connect_participants_select_v2" ON connect_meeting_participants;
DROP POLICY IF EXISTS "connect_participants_insert_v2" ON connect_meeting_participants;
DROP POLICY IF EXISTS "connect_participants_update_v2" ON connect_meeting_participants;
DROP POLICY IF EXISTS "connect_participants_delete_v2" ON connect_meeting_participants;
CREATE POLICY "connect_participants_select_v4" ON connect_meeting_participants FOR SELECT USING (true);
CREATE POLICY "connect_participants_insert_v4" ON connect_meeting_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "connect_participants_update_v4" ON connect_meeting_participants FOR UPDATE USING (true);
CREATE POLICY "connect_participants_delete_v4" ON connect_meeting_participants FOR DELETE USING (true);

-- 2.38 connect_meeting_responses
DROP POLICY IF EXISTS "connect_responses_select_v2" ON connect_meeting_responses;
DROP POLICY IF EXISTS "connect_responses_insert_v2" ON connect_meeting_responses;
DROP POLICY IF EXISTS "connect_responses_update_v2" ON connect_meeting_responses;
DROP POLICY IF EXISTS "connect_responses_delete_v2" ON connect_meeting_responses;
CREATE POLICY "connect_responses_select_v4" ON connect_meeting_responses FOR SELECT USING (true);
CREATE POLICY "connect_responses_insert_v4" ON connect_meeting_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "connect_responses_update_v4" ON connect_meeting_responses FOR UPDATE USING (true);
CREATE POLICY "connect_responses_delete_v4" ON connect_meeting_responses FOR DELETE USING (true);

-- 2.39 addition_setting_history
DROP POLICY IF EXISTS "addition_setting_history_select_v2" ON addition_setting_history;
DROP POLICY IF EXISTS "addition_setting_history_insert_v2" ON addition_setting_history;
DROP POLICY IF EXISTS "addition_setting_history_update_v2" ON addition_setting_history;
DROP POLICY IF EXISTS "addition_setting_history_delete_v2" ON addition_setting_history;
CREATE POLICY "addition_setting_history_select_v4" ON addition_setting_history FOR SELECT USING (true);
CREATE POLICY "addition_setting_history_insert_v4" ON addition_setting_history FOR INSERT WITH CHECK (true);
CREATE POLICY "addition_setting_history_update_v4" ON addition_setting_history FOR UPDATE USING (true);
CREATE POLICY "addition_setting_history_delete_v4" ON addition_setting_history FOR DELETE USING (true);

-- 2.40 facility_history
DROP POLICY IF EXISTS "facility_history_select_v2" ON facility_history;
DROP POLICY IF EXISTS "facility_history_insert_v2" ON facility_history;
DROP POLICY IF EXISTS "facility_history_update_v2" ON facility_history;
DROP POLICY IF EXISTS "facility_history_delete_v2" ON facility_history;
CREATE POLICY "facility_history_select_v4" ON facility_history FOR SELECT USING (true);
CREATE POLICY "facility_history_insert_v4" ON facility_history FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_history_update_v4" ON facility_history FOR UPDATE USING (true);
CREATE POLICY "facility_history_delete_v4" ON facility_history FOR DELETE USING (true);

-- 2.41 staff_assignment_history
DROP POLICY IF EXISTS "staff_assignment_history_select_v2" ON staff_assignment_history;
DROP POLICY IF EXISTS "staff_assignment_history_insert_v2" ON staff_assignment_history;
DROP POLICY IF EXISTS "staff_assignment_history_update_v2" ON staff_assignment_history;
DROP POLICY IF EXISTS "staff_assignment_history_delete_v2" ON staff_assignment_history;
CREATE POLICY "staff_assignment_history_select_v4" ON staff_assignment_history FOR SELECT USING (true);
CREATE POLICY "staff_assignment_history_insert_v4" ON staff_assignment_history FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_assignment_history_update_v4" ON staff_assignment_history FOR UPDATE USING (true);
CREATE POLICY "staff_assignment_history_delete_v4" ON staff_assignment_history FOR DELETE USING (true);

-- 2.42 document_submissions
DROP POLICY IF EXISTS "document_submissions_select_v2" ON document_submissions;
DROP POLICY IF EXISTS "document_submissions_insert_v2" ON document_submissions;
DROP POLICY IF EXISTS "document_submissions_update_v2" ON document_submissions;
DROP POLICY IF EXISTS "document_submissions_delete_v2" ON document_submissions;
CREATE POLICY "document_submissions_select_v4" ON document_submissions FOR SELECT USING (true);
CREATE POLICY "document_submissions_insert_v4" ON document_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "document_submissions_update_v4" ON document_submissions FOR UPDATE USING (true);
CREATE POLICY "document_submissions_delete_v4" ON document_submissions FOR DELETE USING (true);

-- 2.43 deadline_alerts
DROP POLICY IF EXISTS "deadline_alerts_select_v2" ON deadline_alerts;
DROP POLICY IF EXISTS "deadline_alerts_insert_v2" ON deadline_alerts;
DROP POLICY IF EXISTS "deadline_alerts_update_v2" ON deadline_alerts;
DROP POLICY IF EXISTS "deadline_alerts_delete_v2" ON deadline_alerts;
CREATE POLICY "deadline_alerts_select_v4" ON deadline_alerts FOR SELECT USING (true);
CREATE POLICY "deadline_alerts_insert_v4" ON deadline_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "deadline_alerts_update_v4" ON deadline_alerts FOR UPDATE USING (true);
CREATE POLICY "deadline_alerts_delete_v4" ON deadline_alerts FOR DELETE USING (true);

-- 2.44 child_addition_plans
DROP POLICY IF EXISTS "child_addition_plans_select_v2" ON child_addition_plans;
DROP POLICY IF EXISTS "child_addition_plans_insert_v2" ON child_addition_plans;
DROP POLICY IF EXISTS "child_addition_plans_update_v2" ON child_addition_plans;
DROP POLICY IF EXISTS "child_addition_plans_delete_v2" ON child_addition_plans;
CREATE POLICY "child_addition_plans_select_v4" ON child_addition_plans FOR SELECT USING (true);
CREATE POLICY "child_addition_plans_insert_v4" ON child_addition_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "child_addition_plans_update_v4" ON child_addition_plans FOR UPDATE USING (true);
CREATE POLICY "child_addition_plans_delete_v4" ON child_addition_plans FOR DELETE USING (true);

-- 2.45 staff_personnel_settings
DROP POLICY IF EXISTS "staff_personnel_select_v3" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_insert_v3" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_update_v3" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_delete_v3" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_select_v4" ON staff_personnel_settings FOR SELECT USING (true);
CREATE POLICY "staff_personnel_insert_v4" ON staff_personnel_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_personnel_update_v4" ON staff_personnel_settings FOR UPDATE USING (true);
CREATE POLICY "staff_personnel_delete_v4" ON staff_personnel_settings FOR DELETE USING (true);

-- 2.46 daily_staffing_compliance
DROP POLICY IF EXISTS "daily_compliance_select_v3" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_insert_v3" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_update_v3" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_delete_v3" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_select_v4" ON daily_staffing_compliance FOR SELECT USING (true);
CREATE POLICY "daily_compliance_insert_v4" ON daily_staffing_compliance FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_compliance_update_v4" ON daily_staffing_compliance FOR UPDATE USING (true);
CREATE POLICY "daily_compliance_delete_v4" ON daily_staffing_compliance FOR DELETE USING (true);

-- 2.47 work_schedule_reports
DROP POLICY IF EXISTS "work_schedule_reports_select_v3" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_insert_v3" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_update_v3" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_delete_v3" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_select_v4" ON work_schedule_reports FOR SELECT USING (true);
CREATE POLICY "work_schedule_reports_insert_v4" ON work_schedule_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "work_schedule_reports_update_v4" ON work_schedule_reports FOR UPDATE USING (true);
CREATE POLICY "work_schedule_reports_delete_v4" ON work_schedule_reports FOR DELETE USING (true);

-- =====================================================================
-- CATEGORY 3: USER-SCOPED TABLES
-- =====================================================================

-- 3.1 work_experience_records
DROP POLICY IF EXISTS "work_experience_select_v2" ON work_experience_records;
DROP POLICY IF EXISTS "work_experience_insert_v2" ON work_experience_records;
DROP POLICY IF EXISTS "work_experience_update_v2" ON work_experience_records;
DROP POLICY IF EXISTS "work_experience_delete_v2" ON work_experience_records;
CREATE POLICY "work_experience_select_v4" ON work_experience_records FOR SELECT USING (true);
CREATE POLICY "work_experience_insert_v4" ON work_experience_records FOR INSERT WITH CHECK (true);
CREATE POLICY "work_experience_update_v4" ON work_experience_records FOR UPDATE USING (true);
CREATE POLICY "work_experience_delete_v4" ON work_experience_records FOR DELETE USING (true);

-- =====================================================================
-- Also ensure users, facilities, employment_records, staff, staff_invitations
-- have open policies for anon role (these may have been set in earlier migrations)
-- =====================================================================

-- users: ensure anon can read and write
DROP POLICY IF EXISTS "users_select_v4" ON users;
DROP POLICY IF EXISTS "users_insert_v4" ON users;
DROP POLICY IF EXISTS "users_update_v4" ON users;
CREATE POLICY "users_select_v4" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_v4" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_v4" ON users FOR UPDATE USING (true);

-- facilities: ensure anon can read and write
DROP POLICY IF EXISTS "facilities_select_v4" ON facilities;
DROP POLICY IF EXISTS "facilities_insert_v4" ON facilities;
DROP POLICY IF EXISTS "facilities_update_v4" ON facilities;
CREATE POLICY "facilities_select_v4" ON facilities FOR SELECT USING (true);
CREATE POLICY "facilities_insert_v4" ON facilities FOR INSERT WITH CHECK (true);
CREATE POLICY "facilities_update_v4" ON facilities FOR UPDATE USING (true);

-- employment_records: ensure anon can read and write
DROP POLICY IF EXISTS "employment_records_select_v4" ON employment_records;
DROP POLICY IF EXISTS "employment_records_insert_v4" ON employment_records;
DROP POLICY IF EXISTS "employment_records_update_v4" ON employment_records;
CREATE POLICY "employment_records_select_v4" ON employment_records FOR SELECT USING (true);
CREATE POLICY "employment_records_insert_v4" ON employment_records FOR INSERT WITH CHECK (true);
CREATE POLICY "employment_records_update_v4" ON employment_records FOR UPDATE USING (true);

-- staff: ensure anon can read and write
DROP POLICY IF EXISTS "staff_select_v4" ON staff;
DROP POLICY IF EXISTS "staff_insert_v4" ON staff;
DROP POLICY IF EXISTS "staff_update_v4" ON staff;
DROP POLICY IF EXISTS "staff_delete_v4" ON staff;
CREATE POLICY "staff_select_v4" ON staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_v4" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_v4" ON staff FOR UPDATE USING (true);
CREATE POLICY "staff_delete_v4" ON staff FOR DELETE USING (true);

-- staff_invitations: table may not exist yet, handle gracefully
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_invitations') THEN
    EXECUTE 'DROP POLICY IF EXISTS "staff_invitations_select_v4" ON staff_invitations';
    EXECUTE 'DROP POLICY IF EXISTS "staff_invitations_insert_v4" ON staff_invitations';
    EXECUTE 'DROP POLICY IF EXISTS "staff_invitations_update_v4" ON staff_invitations';
    EXECUTE 'CREATE POLICY "staff_invitations_select_v4" ON staff_invitations FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "staff_invitations_insert_v4" ON staff_invitations FOR INSERT WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "staff_invitations_update_v4" ON staff_invitations FOR UPDATE USING (true)';
  END IF;
END $$;

-- facility_settings: ensure anon can read and write
DROP POLICY IF EXISTS "facility_settings_select_v4" ON facility_settings;
DROP POLICY IF EXISTS "facility_settings_insert_v4" ON facility_settings;
DROP POLICY IF EXISTS "facility_settings_update_v4" ON facility_settings;
CREATE POLICY "facility_settings_select_v4" ON facility_settings FOR SELECT USING (true);
CREATE POLICY "facility_settings_insert_v4" ON facility_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_settings_update_v4" ON facility_settings FOR UPDATE USING (true);

-- otp_codes: ensure anon can read and write (needed for auth flow)
DROP POLICY IF EXISTS "otp_codes_select_v4" ON otp_codes;
DROP POLICY IF EXISTS "otp_codes_insert_v4" ON otp_codes;
DROP POLICY IF EXISTS "otp_codes_update_v4" ON otp_codes;
DROP POLICY IF EXISTS "otp_codes_delete_v4" ON otp_codes;
CREATE POLICY "otp_codes_select_v4" ON otp_codes FOR SELECT USING (true);
CREATE POLICY "otp_codes_insert_v4" ON otp_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "otp_codes_update_v4" ON otp_codes FOR UPDATE USING (true);
CREATE POLICY "otp_codes_delete_v4" ON otp_codes FOR DELETE USING (true);

COMMIT;
