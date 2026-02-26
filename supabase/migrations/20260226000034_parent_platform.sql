-- Parent Platform Enhancement: usage_requests + facility_messages tables

-- ============================================================
-- 1. usage_requests table (利用希望申請)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  parent_user_id TEXT NOT NULL,
  request_month TEXT NOT NULL, -- '2026-03'
  requested_dates JSONB NOT NULL, -- [{date: '2026-03-05', slot: 'am', notes: ''}, ...]
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'partially_approved', 'rejected'
  facility_response JSONB, -- [{date: '2026-03-05', approved: true}, ...]
  facility_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_requests_facility_id ON usage_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_usage_requests_child_id ON usage_requests(child_id);
CREATE INDEX IF NOT EXISTS idx_usage_requests_parent_user_id ON usage_requests(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_usage_requests_status ON usage_requests(status);
CREATE INDEX IF NOT EXISTS idx_usage_requests_month ON usage_requests(request_month);

-- RLS
ALTER TABLE usage_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_requests_all" ON usage_requests FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. facility_messages table (施設メッセージ)
-- ============================================================
CREATE TABLE IF NOT EXISTS facility_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  parent_user_id TEXT NOT NULL,
  child_id TEXT,
  sender_type TEXT NOT NULL, -- 'facility', 'parent'
  sender_name TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facility_messages_facility_id ON facility_messages(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_messages_parent_user_id ON facility_messages(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_facility_messages_is_read ON facility_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_facility_messages_created_at ON facility_messages(created_at);

-- RLS
ALTER TABLE facility_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_messages_all" ON facility_messages FOR ALL USING (true) WITH CHECK (true);
