-- 業務日誌テーブル
-- 日々の支援記録・活動記録を管理
-- 運営指導で必要な「サービス提供に関する実施記録」の元データ

-- 業務日誌テーブル
CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- 日誌タイプ: 'facility'=施設全体の日誌, 'child'=児童個別記録
  log_type TEXT NOT NULL CHECK (log_type IN ('facility', 'child')),

  -- 児童個別記録の場合のみ
  child_id TEXT REFERENCES children(id) ON DELETE CASCADE,

  -- 記録者
  staff_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  staff_name TEXT,

  -- 基本情報（施設日誌用）
  weather TEXT, -- 天気
  temperature NUMERIC, -- 気温

  -- 出欠情報（施設日誌用）
  attendance_summary JSONB, -- { present: 10, absent: 2, total: 12 }

  -- 活動内容
  morning_activities TEXT, -- 午前の活動
  afternoon_activities TEXT, -- 午後の活動
  activities JSONB, -- 詳細な活動リスト [{ time: "10:00", content: "...", participants: [...] }]

  -- 児童個別記録用
  mood TEXT, -- 機嫌・様子
  health_condition TEXT, -- 体調
  meal_status TEXT, -- 食事の様子
  support_content TEXT, -- 支援内容
  progress_notes TEXT, -- 経過記録

  -- 共通フィールド
  special_notes TEXT, -- 特記事項
  incidents TEXT, -- ヒヤリハット・事故等（簡易記録）
  communication_notes TEXT, -- 保護者連絡事項

  -- メタデータ
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  submitted_at TIMESTAMPTZ,
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 施設日誌は1日1件のみ
  CONSTRAINT unique_facility_daily_log UNIQUE (facility_id, date, log_type)
    DEFERRABLE INITIALLY DEFERRED
);

-- 部分ユニーク制約: log_type='facility' の場合のみ日付ユニーク
DROP INDEX IF EXISTS idx_unique_facility_log;
CREATE UNIQUE INDEX idx_unique_facility_log
  ON daily_logs (facility_id, date)
  WHERE log_type = 'facility';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_daily_logs_facility_date ON daily_logs(facility_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_child ON daily_logs(child_id, date DESC) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_logs_staff ON daily_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_type ON daily_logs(log_type);

-- RLS有効化
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "daily_logs_select" ON daily_logs FOR SELECT USING (true);
CREATE POLICY "daily_logs_insert" ON daily_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_logs_update" ON daily_logs FOR UPDATE USING (true);
CREATE POLICY "daily_logs_delete" ON daily_logs FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE daily_logs IS '業務日誌 - 日々の支援記録・活動記録';
COMMENT ON COLUMN daily_logs.log_type IS '日誌タイプ: facility=施設全体, child=児童個別';
COMMENT ON COLUMN daily_logs.activities IS '活動詳細（JSON配列）';
COMMENT ON COLUMN daily_logs.attendance_summary IS '出欠サマリー（JSON）';
