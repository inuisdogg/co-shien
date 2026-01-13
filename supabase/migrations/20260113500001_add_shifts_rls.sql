-- ============================================
-- shiftsテーブルにRLSポリシーを追加
-- ============================================

-- RLSを有効化（まだ有効でない場合）
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "shifts_select" ON shifts;
DROP POLICY IF EXISTS "shifts_insert" ON shifts;
DROP POLICY IF EXISTS "shifts_update" ON shifts;
DROP POLICY IF EXISTS "shifts_delete" ON shifts;

-- SELECT: すべてのユーザーが読み取り可能
CREATE POLICY "shifts_select" ON shifts FOR SELECT USING (true);

-- INSERT: すべてのユーザーが挿入可能
CREATE POLICY "shifts_insert" ON shifts FOR INSERT WITH CHECK (true);

-- UPDATE: すべてのユーザーが更新可能
CREATE POLICY "shifts_update" ON shifts FOR UPDATE USING (true);

-- DELETE: すべてのユーザーが削除可能
CREATE POLICY "shifts_delete" ON shifts FOR DELETE USING (true);
