-- 研修記録テーブル
-- 運営指導で必須の「人材育成」「研修実施」関連書類の元データ

-- 研修記録テーブル
CREATE TABLE IF NOT EXISTS training_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 研修基本情報
  title TEXT NOT NULL, -- 研修名
  training_type TEXT NOT NULL CHECK (training_type IN (
    'internal',       -- 施設内研修
    'external',       -- 外部研修
    'online',         -- オンライン研修
    'oj_training'     -- OJT（実地研修）
  )),

  -- 研修カテゴリ
  category TEXT CHECK (category IN (
    'mandatory',          -- 法定研修
    'skill_improvement',  -- スキルアップ
    'safety',             -- 安全管理
    'welfare',            -- 福祉制度
    'medical',            -- 医療的ケア
    'communication',      -- コミュニケーション
    'other'               -- その他
  )),

  -- 日時・場所
  training_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  duration_hours DECIMAL(4,2), -- 研修時間（時間単位）
  location TEXT, -- 開催場所
  online_url TEXT, -- オンラインの場合のURL

  -- 講師情報
  instructor_name TEXT,
  instructor_affiliation TEXT, -- 所属
  instructor_qualification TEXT, -- 資格

  -- 研修内容
  description TEXT, -- 研修概要
  objectives TEXT, -- 研修目標
  content TEXT, -- 研修内容（詳細）
  materials_used TEXT, -- 使用教材

  -- 参加者
  participants JSONB, -- [{ staff_id: "...", name: "...", attended: true, notes: "..." }]
  participant_count INTEGER,

  -- 評価・振り返り
  evaluation_method TEXT, -- 評価方法
  overall_feedback TEXT, -- 全体の振り返り
  improvement_points TEXT, -- 改善点
  next_training_suggestions TEXT, -- 次回への提案

  -- 添付ファイル
  attachments JSONB, -- [{ name: "...", url: "...", type: "..." }]
  certificate_url TEXT, -- 修了証等のURL

  -- 費用
  cost DECIMAL(10,0), -- 研修費用
  cost_breakdown TEXT, -- 費用内訳

  -- ステータス
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',     -- 予定
    'completed',     -- 完了
    'cancelled'      -- 中止
  )),

  -- メタデータ
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_training_records_facility ON training_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_training_records_date ON training_records(training_date);
CREATE INDEX IF NOT EXISTS idx_training_records_type ON training_records(training_type);
CREATE INDEX IF NOT EXISTS idx_training_records_status ON training_records(status);

-- RLS有効化
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "training_records_select" ON training_records FOR SELECT USING (true);
CREATE POLICY "training_records_insert" ON training_records FOR INSERT WITH CHECK (true);
CREATE POLICY "training_records_update" ON training_records FOR UPDATE USING (true);
CREATE POLICY "training_records_delete" ON training_records FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE training_records IS '研修記録';
COMMENT ON COLUMN training_records.training_type IS '研修種別: internal=施設内, external=外部, online=オンライン, oj_training=OJT';
COMMENT ON COLUMN training_records.category IS '研修カテゴリ';
COMMENT ON COLUMN training_records.participants IS '参加者一覧（JSON配列）';
