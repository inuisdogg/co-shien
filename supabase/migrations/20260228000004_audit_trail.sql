-- 監査ログ
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout', 'export', 'view_sensitive'
  resource_type TEXT NOT NULL, -- 'child', 'staff', 'usage_record', 'support_plan', 'billing', 'settings', 'user', 'document'
  resource_id TEXT,
  details JSONB, -- { field: 'name', old: 'foo', new: 'bar' } or other context
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_facility ON audit_logs(facility_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
