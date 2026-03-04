-- 労働条件通知書（Employment Contracts / Labor Condition Notices）
-- スタッフの労働条件を構造化データとして管理
-- ここから週契約時間や給与情報を人員配置に連動させる

CREATE TABLE IF NOT EXISTS employment_contracts (
  id TEXT PRIMARY KEY DEFAULT 'ec-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 8),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  staff_id TEXT NOT NULL,  -- staff.idを参照（FKはアプリ側で管理）
  user_id TEXT,            -- users.idと紐付け（あれば）

  -- 契約種別
  contract_type TEXT NOT NULL DEFAULT 'indefinite'
    CHECK (contract_type IN ('indefinite', 'fixed_term', 'parttime', 'temporary')),
  -- indefinite: 期間の定めなし, fixed_term: 有期, parttime: パートタイム, temporary: 臨時

  -- 契約期間
  contract_start_date DATE NOT NULL,
  contract_end_date DATE,            -- NULLなら期間の定めなし
  renewal_clause TEXT,               -- 更新に関する事項

  -- 就業場所・業務内容
  work_location TEXT,                -- 就業の場所
  job_description TEXT,              -- 従事すべき業務の内容

  -- 労働時間
  work_start_time TIME,              -- 始業時刻
  work_end_time TIME,                -- 終業時刻
  break_minutes INTEGER DEFAULT 60,  -- 休憩時間（分）
  contracted_weekly_hours NUMERIC(4,1) NOT NULL, -- 週所定労働時間
  overtime_allowed BOOLEAN DEFAULT false,        -- 時間外労働の有無
  work_days_per_week INTEGER DEFAULT 5,          -- 週所定労働日数

  -- 休日
  holidays TEXT,                      -- 休日（土日祝 等テキスト）
  paid_leave_notes TEXT,              -- 有給休暇に関する事項

  -- 賃金
  wage_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (wage_type IN ('monthly', 'hourly', 'daily')),
  base_salary NUMERIC(12,2),         -- 基本給
  allowances JSONB,                   -- 手当（JSON: [{name, amount}]）
  total_monthly_salary NUMERIC(12,2), -- 月額合計（常勤用）
  hourly_wage NUMERIC(10,2),         -- 時給（非常勤用）
  payment_day INTEGER,               -- 賃金支払日（毎月N日）
  payment_method TEXT DEFAULT 'bank_transfer', -- 支払方法

  -- 社会保険等
  social_insurance TEXT,              -- 社会保険の加入状況
  employment_insurance BOOLEAN DEFAULT true,  -- 雇用保険
  workers_comp BOOLEAN DEFAULT true,          -- 労災保険

  -- 退職
  retirement_rules TEXT,              -- 退職に関する事項

  -- 署名・承認
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'acknowledged', 'signed', 'expired', 'superseded')),
  issued_at TIMESTAMPTZ,              -- 発行日時
  acknowledged_at TIMESTAMPTZ,        -- 確認日時（スタッフが確認）
  signed_at TIMESTAMPTZ,              -- 署名日時
  signed_by_staff BOOLEAN DEFAULT false,    -- スタッフ署名済み
  signed_by_facility BOOLEAN DEFAULT false, -- 施設側署名済み

  -- メタ
  notes TEXT,
  document_id TEXT,                   -- 生成されたPDF等のstaff_documents.id
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLSポリシー
ALTER TABLE employment_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ec_select" ON employment_contracts;
DROP POLICY IF EXISTS "ec_insert" ON employment_contracts;
DROP POLICY IF EXISTS "ec_update" ON employment_contracts;
DROP POLICY IF EXISTS "ec_delete" ON employment_contracts;
CREATE POLICY "ec_select" ON employment_contracts FOR SELECT USING (true);
CREATE POLICY "ec_insert" ON employment_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "ec_update" ON employment_contracts FOR UPDATE USING (true);
CREATE POLICY "ec_delete" ON employment_contracts FOR DELETE USING (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_ec_facility_staff ON employment_contracts(facility_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_ec_status ON employment_contracts(status);

COMMENT ON TABLE employment_contracts IS '労働条件通知書 — スタッフの雇用条件を構造化データで管理';
COMMENT ON COLUMN employment_contracts.contracted_weekly_hours IS '週所定労働時間。人員配置のFTE計算に連動';
