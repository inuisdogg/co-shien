-- Analytics events table for tracking tool usage, PDF generation, etc.
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_agent text DEFAULT '',
  referrer text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Index for querying by event name and date
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_date
  ON analytics_events (event_name, created_at DESC);

-- RLS: allow anon inserts (public tool tracking), restrict reads to service role
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Only service role can read analytics"
  ON analytics_events FOR SELECT
  TO service_role
  USING (true);
