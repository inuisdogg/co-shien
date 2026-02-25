-- Add prescribed_working_hours column to facility_settings table
-- This column stores the daily prescribed working hours in minutes (e.g., 420 = 7 hours)

ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS prescribed_working_hours INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN facility_settings.prescribed_working_hours IS 'Daily prescribed working hours in minutes (e.g., 420 = 7 hours). Used in attendance calendar calculations.';
