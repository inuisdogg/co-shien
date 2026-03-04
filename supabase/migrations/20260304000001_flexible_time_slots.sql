-- Phase 1 D-04: 送迎割当のNOT NULL制約を除去
ALTER TABLE IF EXISTS daily_transport_assignments
  ALTER COLUMN driver_staff_id DROP NOT NULL,
  ALTER COLUMN attendant_staff_id DROP NOT NULL;

-- Phase 4: スケジュールのAM/PM CHECK制約を除去（柔軟な時間枠対応）
ALTER TABLE IF EXISTS schedules DROP CONSTRAINT IF EXISTS schedules_slot_check;

-- 既存データをfacility_time_slotsの名前に移行
UPDATE schedules s SET slot = COALESCE(
  (SELECT fts.name FROM facility_time_slots fts
   WHERE fts.facility_id = s.facility_id AND fts.display_order = 1 LIMIT 1), s.slot
) WHERE s.slot = 'AM';

UPDATE schedules s SET slot = COALESCE(
  (SELECT fts.name FROM facility_time_slots fts
   WHERE fts.facility_id = s.facility_id AND fts.display_order = 2 LIMIT 1), s.slot
) WHERE s.slot = 'PM';
