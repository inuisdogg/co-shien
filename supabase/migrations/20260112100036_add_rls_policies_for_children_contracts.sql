-- 子供テーブルのRLSポリシー（利用者が自分の子供を見られるように）
DROP POLICY IF EXISTS "children_owner_select" ON children;
CREATE POLICY "children_owner_select" ON children
  FOR SELECT
  USING (true);  -- 読み取りは全員許可（一時的に）

DROP POLICY IF EXISTS "children_owner_update" ON children;
CREATE POLICY "children_owner_update" ON children
  FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "children_insert" ON children;
CREATE POLICY "children_insert" ON children
  FOR INSERT
  WITH CHECK (true);

-- 契約テーブルのRLSポリシー
DROP POLICY IF EXISTS "contracts_select" ON contracts;
CREATE POLICY "contracts_select" ON contracts
  FOR SELECT
  USING (true);  -- 読み取りは全員許可（一時的に）

DROP POLICY IF EXISTS "contracts_insert" ON contracts;
CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "contracts_update" ON contracts;
CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE
  USING (true);

-- チャットメッセージのRLSポリシー
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "chat_messages_update" ON chat_messages;
CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE
  USING (true);

-- 確認
DO $$
BEGIN
  RAISE NOTICE 'RLSポリシーを更新しました';
END $$;
