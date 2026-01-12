-- 個別支援計画テーブル
-- 児童発達支援において最も重要な書類の一つ
-- 運営指導で必ず確認される「サービス等利用計画、個別支援計画書」

-- 個別支援計画テーブル
CREATE TABLE IF NOT EXISTS service_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,

  -- 計画の種類
  plan_type TEXT NOT NULL CHECK (plan_type IN ('initial', 'renewal', 'modification')),
  -- initial: 初回計画
  -- renewal: 更新計画
  -- modification: 計画変更

  -- 計画期間
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- 作成情報
  created_by TEXT REFERENCES users(id),
  created_by_name TEXT,
  created_date DATE,

  -- 児童の状況・課題
  current_situation TEXT, -- 現在の状況
  issues TEXT, -- 課題
  strengths TEXT, -- 強み・得意なこと
  interests TEXT, -- 興味・関心

  -- 長期目標・短期目標
  long_term_goals JSONB, -- [{ goal: "...", domain: "..." }]
  short_term_goals JSONB, -- [{ goal: "...", domain: "...", target_date: "...", evaluation_criteria: "..." }]

  -- 支援内容
  support_content JSONB, -- [{ category: "...", content: "...", frequency: "...", staff: "..." }]

  -- 週間プログラム
  weekly_program JSONB, -- { monday: [...], tuesday: [...], ... }

  -- 特記事項
  special_notes TEXT,
  medical_notes TEXT, -- 医療的ケアに関する記載
  family_cooperation TEXT, -- 家庭との連携

  -- 評価
  mid_term_evaluation TEXT, -- 中間評価
  mid_term_evaluation_date DATE,
  final_evaluation TEXT, -- 最終評価
  final_evaluation_date DATE,
  next_plan_notes TEXT, -- 次期計画への引継ぎ事項

  -- 同意・署名
  parent_signature_url TEXT, -- 保護者署名画像URL
  parent_signed_at TIMESTAMPTZ,
  parent_signer_name TEXT, -- 署名者名

  staff_signature_url TEXT, -- 担当者署名画像URL
  staff_signed_at TIMESTAMPTZ,

  manager_signature_url TEXT, -- 管理者署名画像URL
  manager_signed_at TIMESTAMPTZ,

  -- ステータス
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',           -- 下書き
    'pending_review',  -- レビュー待ち
    'pending_sign',    -- 署名待ち
    'active',          -- 有効
    'completed',       -- 期間終了
    'archived'         -- アーカイブ
  )),

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_service_plans_facility ON service_plans(facility_id);
CREATE INDEX IF NOT EXISTS idx_service_plans_child ON service_plans(child_id);
CREATE INDEX IF NOT EXISTS idx_service_plans_status ON service_plans(status);
CREATE INDEX IF NOT EXISTS idx_service_plans_period ON service_plans(period_start, period_end);

-- RLS有効化
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "service_plans_select" ON service_plans FOR SELECT USING (true);
CREATE POLICY "service_plans_insert" ON service_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "service_plans_update" ON service_plans FOR UPDATE USING (true);
CREATE POLICY "service_plans_delete" ON service_plans FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE service_plans IS '個別支援計画 - 児童ごとの支援計画';
COMMENT ON COLUMN service_plans.plan_type IS '計画種別: initial=初回, renewal=更新, modification=変更';
COMMENT ON COLUMN service_plans.long_term_goals IS '長期目標（JSON配列）';
COMMENT ON COLUMN service_plans.short_term_goals IS '短期目標（JSON配列）';
COMMENT ON COLUMN service_plans.support_content IS '支援内容（JSON配列）';
COMMENT ON COLUMN service_plans.weekly_program IS '週間プログラム（JSON）';
