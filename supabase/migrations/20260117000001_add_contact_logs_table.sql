-- 連絡帳テーブル
CREATE TABLE IF NOT EXISTS contact_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  slot TEXT CHECK (slot IN ('AM', 'PM')),

  -- 活動内容
  activities TEXT, -- 今日の活動内容

  -- 体調・様子
  health_status TEXT CHECK (health_status IN ('excellent', 'good', 'fair', 'poor')), -- 体調
  mood TEXT CHECK (mood IN ('very_happy', 'happy', 'neutral', 'sad', 'upset')), -- 機嫌
  appetite TEXT CHECK (appetite IN ('excellent', 'good', 'fair', 'poor', 'none')), -- 食欲

  -- 食事
  meal_main BOOLEAN DEFAULT false, -- 主食を食べたか
  meal_side BOOLEAN DEFAULT false, -- 副食を食べたか
  meal_notes TEXT, -- 食事に関するメモ

  -- 排泄
  toilet_count INTEGER DEFAULT 0, -- トイレ回数
  toilet_notes TEXT, -- 排泄に関するメモ

  -- 睡眠（お昼寝）
  nap_start_time TIME, -- お昼寝開始
  nap_end_time TIME, -- お昼寝終了
  nap_notes TEXT, -- 睡眠に関するメモ

  -- スタッフからのコメント
  staff_comment TEXT,
  staff_user_id TEXT REFERENCES users(id),

  -- 保護者への連絡事項
  parent_message TEXT,

  -- 保護者からの返信
  parent_reply TEXT,
  parent_reply_at TIMESTAMP WITH TIME ZONE,

  -- サイン関連
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  signed_by_user_id TEXT REFERENCES users(id),
  signature_data TEXT, -- デジタルサインデータ（Base64など）

  -- メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),

  -- ユニーク制約：同じ児童の同じ日・スロットには1つの連絡帳のみ
  UNIQUE(child_id, date, slot)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_contact_logs_facility_id ON contact_logs(facility_id);
CREATE INDEX IF NOT EXISTS idx_contact_logs_child_id ON contact_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_contact_logs_date ON contact_logs(date);
CREATE INDEX IF NOT EXISTS idx_contact_logs_schedule_id ON contact_logs(schedule_id);

-- RLSポリシー
ALTER TABLE contact_logs ENABLE ROW LEVEL SECURITY;

-- 施設スタッフは自分の施設の連絡帳を操作可能
CREATE POLICY "staff_contact_logs_policy" ON contact_logs
  FOR ALL USING (
    facility_id IN (
      SELECT facility_id FROM employment_records
      WHERE user_id = auth.uid()::TEXT AND end_date IS NULL
    )
  );

-- 保護者は自分の子供の連絡帳を閲覧可能
CREATE POLICY "parent_contact_logs_policy" ON contact_logs
  FOR SELECT USING (
    child_id IN (
      SELECT id FROM children WHERE owner_profile_id = auth.uid()::TEXT
    )
  );

-- トリガーで updated_at を自動更新
CREATE OR REPLACE FUNCTION update_contact_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contact_logs_updated_at ON contact_logs;
CREATE TRIGGER trigger_contact_logs_updated_at
  BEFORE UPDATE ON contact_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_logs_updated_at();
