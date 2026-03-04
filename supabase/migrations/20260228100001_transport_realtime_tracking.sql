-- リアルタイム送迎トラッキング（Uber Eats型）

-- 1. 送迎セッション（ライブGPS位置をこのテーブルで管理 → Supabase RealtimeでUPDATEをブロードキャスト）
CREATE TABLE IF NOT EXISTS transport_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('pickup', 'dropoff')),
  status TEXT NOT NULL DEFAULT 'preparing'
    CHECK (status IN ('preparing', 'active', 'completed', 'cancelled')),

  -- スタッフ
  driver_staff_id TEXT,
  attendant_staff_id TEXT,
  vehicle_info TEXT,

  -- ルート（セッション開始時にスナップショット保存）
  route_stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_distance_meters INTEGER,
  total_duration_seconds INTEGER,

  -- ライブGPS位置（5秒間隔で更新）
  current_latitude DOUBLE PRECISION,
  current_longitude DOUBLE PRECISION,
  current_heading DOUBLE PRECISION,
  current_speed DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,

  -- 進捗
  current_stop_index INTEGER DEFAULT 0,
  next_stop_eta_seconds INTEGER,

  -- タイムスタンプ
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(facility_id, date, mode)
);

CREATE INDEX IF NOT EXISTS idx_transport_sessions_facility_date ON transport_sessions(facility_id, date);
CREATE INDEX IF NOT EXISTS idx_transport_sessions_status ON transport_sessions(status);
CREATE INDEX IF NOT EXISTS idx_transport_sessions_active ON transport_sessions(facility_id, status) WHERE status = 'active';

ALTER TABLE transport_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_sessions_all ON transport_sessions FOR ALL USING (true) WITH CHECK (true);

-- Supabase Realtimeでこのテーブルの変更をブロードキャスト
ALTER PUBLICATION supabase_realtime ADD TABLE transport_sessions;


-- 2. ストップイベント（到着・出発ログ + 通知重複防止）
CREATE TABLE IF NOT EXISTS transport_stop_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id TEXT NOT NULL REFERENCES transport_sessions(id) ON DELETE CASCADE,
  stop_index INTEGER NOT NULL,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('approaching', 'arrived', 'departed', 'skipped')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stop_events_session ON transport_stop_events(session_id);
CREATE INDEX IF NOT EXISTS idx_stop_events_child ON transport_stop_events(child_id);
CREATE INDEX IF NOT EXISTS idx_stop_events_dedup ON transport_stop_events(session_id, stop_index, event_type);

ALTER TABLE transport_stop_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY stop_events_all ON transport_stop_events FOR ALL USING (true) WITH CHECK (true);


-- 3. 位置履歴（15秒間隔で保存、経路再生・分析用）
CREATE TABLE IF NOT EXISTS transport_location_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id TEXT NOT NULL REFERENCES transport_sessions(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_session ON transport_location_history(session_id, recorded_at DESC);

ALTER TABLE transport_location_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY location_history_all ON transport_location_history FOR ALL USING (true) WITH CHECK (true);
