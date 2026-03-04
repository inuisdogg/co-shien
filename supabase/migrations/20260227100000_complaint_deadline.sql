-- Add response deadline tracking to incident_reports
ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS response_due_date DATE,
  ADD COLUMN IF NOT EXISTS response_completed_at TIMESTAMPTZ;

-- Set default due dates for existing complaint records
UPDATE incident_reports
SET response_due_date = (created_at::date + INTERVAL '90 days')::date
WHERE report_type = 'complaint' AND response_due_date IS NULL;
