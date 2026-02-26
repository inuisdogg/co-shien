-- Fix: support_plan_files.file_name should be nullable
-- The original migration (20260128000001) had file_name as NOT NULL,
-- but plans can be created without a file (digital-only plans via plan_content JSONB).
-- The later migration (20260226000025) already defines file_name without NOT NULL in its
-- CREATE TABLE IF NOT EXISTS, but if the table already existed from the first migration,
-- the NOT NULL constraint persists. This ALTER ensures it is nullable regardless.

ALTER TABLE support_plan_files ALTER COLUMN file_name DROP NOT NULL;
