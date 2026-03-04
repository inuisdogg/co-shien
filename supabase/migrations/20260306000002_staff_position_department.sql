-- スタッフの役職・部門カラム追加
ALTER TABLE staff ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department TEXT;

-- コメント
COMMENT ON COLUMN staff.position IS '役職（施設長、主任、リーダー等）';
COMMENT ON COLUMN staff.department IS '部門・チーム（療育チーム、事務等）';
