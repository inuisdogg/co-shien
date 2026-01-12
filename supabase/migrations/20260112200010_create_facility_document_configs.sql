-- 施設別書類設定テーブル
-- 各施設で書類の有効/無効、更新スケジュールをカスタマイズ可能

CREATE TABLE IF NOT EXISTS facility_document_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 書類識別（システム定義 or カスタム）
  document_type TEXT NOT NULL,           -- システム書類のキー or カスタムのユニークID
  is_custom BOOLEAN DEFAULT false,       -- true: 施設独自の書類

  -- 有効/無効
  is_enabled BOOLEAN DEFAULT true,       -- false: この施設では使用しない

  -- カスタム書類用の情報
  custom_name TEXT,                      -- カスタム書類の名前
  custom_category TEXT,                  -- カスタム書類のカテゴリ
  custom_description TEXT,               -- カスタム書類の説明

  -- 更新スケジュールのカスタマイズ
  update_cycle_type TEXT CHECK (update_cycle_type IN (
    'static',     -- 初回のみ
    'event',      -- イベント発生時
    'daily',      -- 毎日
    'monthly',    -- 毎月
    'quarterly',  -- 四半期
    'biannual',   -- 半年
    'yearly',     -- 年1回
    'biennial',   -- 年2回
    'custom'      -- カスタム間隔
  )),
  update_interval_days INTEGER,          -- カスタム間隔（日数）
  update_months JSONB,                   -- 更新月 [4, 10] など

  -- イベント駆動用
  trigger_entity TEXT CHECK (trigger_entity IN ('staff', 'child', 'facility')),
  trigger_description TEXT,              -- イベント説明

  -- 対象エンティティ
  entity_type TEXT CHECK (entity_type IN ('facility', 'staff', 'child')) DEFAULT 'facility',

  -- アラート設定
  alert_days_warning INTEGER DEFAULT 30, -- 警告（黄色）
  alert_days_urgent INTEGER DEFAULT 7,   -- 緊急（赤色）

  -- メモ
  notes TEXT,

  -- メタデータ
  display_order INTEGER DEFAULT 0,       -- 表示順
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 施設内で書類タイプはユニーク
  UNIQUE(facility_id, document_type)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facility_document_configs_facility ON facility_document_configs(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_document_configs_type ON facility_document_configs(document_type);
CREATE INDEX IF NOT EXISTS idx_facility_document_configs_enabled ON facility_document_configs(facility_id, is_enabled);

-- RLS有効化
ALTER TABLE facility_document_configs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "facility_document_configs_select" ON facility_document_configs FOR SELECT USING (true);
CREATE POLICY "facility_document_configs_insert" ON facility_document_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_document_configs_update" ON facility_document_configs FOR UPDATE USING (true);
CREATE POLICY "facility_document_configs_delete" ON facility_document_configs FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE facility_document_configs IS '施設別書類設定';
COMMENT ON COLUMN facility_document_configs.is_custom IS 'true: 施設独自の書類, false: システム標準書類';
COMMENT ON COLUMN facility_document_configs.is_enabled IS 'この施設でこの書類を使用するか';
COMMENT ON COLUMN facility_document_configs.update_months IS '更新月の配列 (例: [4, 10] = 4月と10月)';
