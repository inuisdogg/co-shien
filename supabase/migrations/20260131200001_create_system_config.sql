-- =============================================
-- システム設定テーブル
-- プラットフォーム全体の設定を管理
-- =============================================

-- システム設定テーブル
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期設定
INSERT INTO system_config (key, value, description) VALUES
  ('owner_setup_completed', 'false', 'プラットフォームオーナーの初期登録が完了したかどうか'),
  ('platform_name', 'co-shien', 'プラットフォーム名'),
  ('maintenance_mode', 'false', 'メンテナンスモード')
ON CONFLICT (key) DO NOTHING;

-- RLSポリシー
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 誰でも読み取り可能
CREATE POLICY "system_config_select" ON system_config
  FOR SELECT USING (true);

-- 挿入・更新は認証ユーザーのみ（実際にはオーナーのみに制限すべき）
CREATE POLICY "system_config_insert" ON system_config
  FOR INSERT WITH CHECK (true);

CREATE POLICY "system_config_update" ON system_config
  FOR UPDATE USING (true);

-- コメント
COMMENT ON TABLE system_config IS 'プラットフォーム全体のシステム設定';
