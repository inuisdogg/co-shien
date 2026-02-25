-- ============================================
-- スタッフのデフォルト勤務パターン追加
-- シフト作成時にスタッフの基本的な勤務パターンを
-- 自動入力するためのJSONBカラム
-- ============================================

-- staffテーブルにdefault_work_patternカラムを追加
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS default_work_pattern JSONB;

COMMENT ON COLUMN staff.default_work_pattern IS 'デフォルト勤務パターン。例: {"days":[1,2,3,4,5],"type":"full","startTime":"09:00","endTime":"18:00","label":"月-金 Full"}';

-- default_work_pattern JSONB構造:
-- {
--   "days": [1, 2, 3, 4, 5],          -- 勤務曜日 (0=日, 1=月, ..., 6=土)
--   "type": "full" | "am" | "pm",     -- 勤務タイプ
--   "startTime": "09:00",             -- 開始時刻
--   "endTime": "18:00",               -- 終了時刻
--   "patternId": "sp-xxx",            -- デフォルトのシフトパターンID（任意）
--   "label": "月-金 Full"             -- 表示用ラベル（自動生成可能）
-- }
