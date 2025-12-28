-- ============================================
-- 基本シフトパターンカラム追加マイグレーション
-- ============================================
-- Staffテーブルにdefault_shift_patternカラムを追加
-- このSQLスクリプトは既存のstaffテーブルにカラムを追加します

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS default_shift_pattern BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[];

COMMENT ON COLUMN staff.default_shift_pattern IS '基本シフトパターン（週の曜日ごとのシフト有無、月～土の6日分）[月, 火, 水, 木, 金, 土]の順（true=シフトあり、false=シフトなし）';

