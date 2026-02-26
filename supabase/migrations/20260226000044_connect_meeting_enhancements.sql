-- 連絡会議テーブルに議題・議事録カラムを追加
ALTER TABLE connect_meetings ADD COLUMN IF NOT EXISTS agenda_items JSONB DEFAULT '[]'::JSONB;
ALTER TABLE connect_meetings ADD COLUMN IF NOT EXISTS minutes TEXT;
ALTER TABLE connect_meetings ADD COLUMN IF NOT EXISTS decisions JSONB DEFAULT '[]'::JSONB;
ALTER TABLE connect_meetings ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]'::JSONB;
ALTER TABLE connect_meetings ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::JSONB;
