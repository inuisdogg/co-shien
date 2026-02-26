-- 連絡会議参加者テーブルに出席者情報カラムを追加
ALTER TABLE connect_meeting_participants
  ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attendee_names TEXT,
  ADD COLUMN IF NOT EXISTS comment TEXT;
