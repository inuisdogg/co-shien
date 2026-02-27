-- 応募者の希望条件フィールドを job_applications に追加
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS preferred_days TEXT; -- 希望曜日 (例: "月,水,金")
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS preferred_hours_per_week INT; -- 希望週間労働時間
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS preferred_hourly_rate INT; -- 希望時給
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS preferred_start_time TEXT; -- 希望開始時間 (例: "09:00")
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS preferred_end_time TEXT; -- 希望終了時間 (例: "17:00")
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS preferred_notes TEXT; -- その他希望・備考
