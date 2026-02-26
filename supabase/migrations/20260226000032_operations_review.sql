-- 月次運営確認（Operations Review Wizard）テーブル
-- 施設管理者が毎月の運営変更を確認した結果を記録する

CREATE TABLE IF NOT EXISTS operations_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  review_month TEXT NOT NULL, -- '2026-03' format
  responses JSONB DEFAULT '{}',
  changes_detected JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_operations_reviews_facility_id ON operations_reviews(facility_id);
CREATE INDEX IF NOT EXISTS idx_operations_reviews_review_month ON operations_reviews(review_month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operations_reviews_facility_month ON operations_reviews(facility_id, review_month);

-- RLS
ALTER TABLE operations_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operations_reviews_all" ON operations_reviews
  FOR ALL USING (true) WITH CHECK (true);
