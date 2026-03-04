-- Fix: driver_staff_id / attendant_staff_id を NULLABLE に変更
-- 迎え/送り別担当者が導入されたため、レガシーカラムは必須ではなくなった

-- NOT NULL 制約を外す（既にNULLABLEなら何もしない）
ALTER TABLE daily_transport_assignments ALTER COLUMN driver_staff_id DROP NOT NULL;
ALTER TABLE daily_transport_assignments ALTER COLUMN attendant_staff_id DROP NOT NULL;

-- FOREIGN KEY 制約も外す（staff テーブル以外の emp- prefix ID を許容するため）
-- まず既存の制約名を確認して DROP
DO $$ BEGIN
  ALTER TABLE daily_transport_assignments DROP CONSTRAINT IF EXISTS daily_transport_assignments_driver_staff_id_fkey;
  ALTER TABLE daily_transport_assignments DROP CONSTRAINT IF EXISTS daily_transport_assignments_attendant_staff_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
