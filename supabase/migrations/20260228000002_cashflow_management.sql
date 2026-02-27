-- キャッシュフロー管理
CREATE TABLE IF NOT EXISTS cashflow_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- '2026-02' format
  category TEXT NOT NULL, -- 'income' or 'expense'
  subcategory TEXT NOT NULL, -- e.g., 'personnel', 'operations', 'admin', 'other', 'benefits', 'copay', 'additions', 'subsidy'
  item_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0, -- yen amount
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_template_item BOOLEAN NOT NULL DEFAULT true, -- part of standard template
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashflow_facility_month ON cashflow_entries(facility_id, year_month);

-- Previous month balance tracking
CREATE TABLE IF NOT EXISTS cashflow_balances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(facility_id, year_month)
);

ALTER TABLE cashflow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashflow_entries_all" ON cashflow_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cashflow_balances_all" ON cashflow_balances FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_cashflow_entries_updated_at BEFORE UPDATE ON cashflow_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cashflow_balances_updated_at BEFORE UPDATE ON cashflow_balances
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
