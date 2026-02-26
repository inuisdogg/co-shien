-- Add support record fields to usage_records table
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS support_record TEXT,
  ADD COLUMN IF NOT EXISTS support_goal TEXT,
  ADD COLUMN IF NOT EXISTS child_condition TEXT,
  ADD COLUMN IF NOT EXISTS special_notes TEXT;
