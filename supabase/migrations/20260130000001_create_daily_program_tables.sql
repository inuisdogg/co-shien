-- =====================================================
-- 日別プログラム計画テーブル
-- Daily Program Planning Tables
-- =====================================================

-- 日別プログラム計画
-- 施設が1日ごとに計画する加算リスト
CREATE TABLE IF NOT EXISTS daily_program_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  -- 計画した加算コードリスト
  planned_additions TEXT[] DEFAULT '{}',
  -- 自動適用体制加算コードリスト（システム算出）
  auto_additions TEXT[] DEFAULT '{}',
  -- 合計単位数（概算）
  estimated_total_units INTEGER DEFAULT 0,
  -- 実際の単位数（実績登録後）
  actual_total_units INTEGER,
  -- メモ
  notes TEXT,
  -- 作成者
  created_by TEXT REFERENCES users(id),
  -- 最終更新者
  updated_by TEXT REFERENCES users(id),
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 1施設1日1レコード
  UNIQUE(facility_id, date)
);

-- 日別加算ターゲット
-- 児童ごとに計画する加算の詳細
CREATE TABLE IF NOT EXISTS daily_addition_targets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  -- 加算コード
  addition_code TEXT NOT NULL,
  -- ステータス: planned(計画), in_progress(実施中), completed(完了), cancelled(取消)
  target_status TEXT DEFAULT 'planned' CHECK (target_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  -- 担当スタッフ
  assigned_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  -- 単位数
  units INTEGER,
  -- メモ
  notes TEXT,
  -- 完了日時
  completed_at TIMESTAMPTZ,
  -- 完了者
  completed_by TEXT REFERENCES users(id),
  -- キャンセル理由
  cancel_reason TEXT,
  -- 実績記録へのリンク
  usage_record_id TEXT,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 1施設1日1児童1加算で1レコード
  UNIQUE(facility_id, date, child_id, addition_code)
);

-- 加算定義テーブル（マスター）
-- システム全体で使用する加算のマスター情報
CREATE TABLE IF NOT EXISTS addition_definitions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  category_code TEXT NOT NULL, -- staffing, specialist, treatment, daily, monthly
  addition_type TEXT NOT NULL CHECK (addition_type IN ('facility_preset', 'monthly', 'daily')),
  -- 単位数（null = 階層あり or パーセント型）
  units INTEGER,
  -- パーセント型の場合
  is_percentage BOOLEAN DEFAULT FALSE,
  percentage_rate NUMERIC(5,2),
  -- 月間/日間の上限回数
  max_times_per_month INTEGER,
  max_times_per_day INTEGER DEFAULT 1,
  -- 排他グループ（同時取得不可）
  exclusive_group TEXT,
  -- 要件（テキスト説明）
  requirements TEXT,
  -- 要件（JSON形式の詳細）
  requirements_json JSONB,
  -- 記録方法ガイド（Markdown形式）
  recording_guide TEXT,
  -- 表示順
  display_order INTEGER DEFAULT 0,
  -- 有効フラグ
  is_active BOOLEAN DEFAULT TRUE,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_daily_program_plans_facility_date
  ON daily_program_plans(facility_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_program_plans_date
  ON daily_program_plans(date);

CREATE INDEX IF NOT EXISTS idx_daily_addition_targets_facility_date
  ON daily_addition_targets(facility_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_addition_targets_child
  ON daily_addition_targets(child_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_addition_targets_status
  ON daily_addition_targets(target_status);

CREATE INDEX IF NOT EXISTS idx_addition_definitions_type
  ON addition_definitions(addition_type);
CREATE INDEX IF NOT EXISTS idx_addition_definitions_category
  ON addition_definitions(category_code);

-- RLS ポリシー
ALTER TABLE daily_program_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_addition_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE addition_definitions ENABLE ROW LEVEL SECURITY;

-- daily_program_plans: 施設に所属するユーザーのみアクセス可能
CREATE POLICY "daily_program_plans_facility_policy" ON daily_program_plans
  FOR ALL USING (
    facility_id IN (
      SELECT facility_id FROM users WHERE id = auth.uid()::text
    )
  );

-- daily_addition_targets: 施設に所属するユーザーのみアクセス可能
CREATE POLICY "daily_addition_targets_facility_policy" ON daily_addition_targets
  FOR ALL USING (
    facility_id IN (
      SELECT facility_id FROM users WHERE id = auth.uid()::text
    )
  );

-- addition_definitions: 全ユーザー読み取り可能（マスターデータ）
CREATE POLICY "addition_definitions_read_policy" ON addition_definitions
  FOR SELECT USING (true);

-- トリガー: updated_at自動更新
CREATE OR REPLACE FUNCTION update_daily_program_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_program_plans_updated_at
  BEFORE UPDATE ON daily_program_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_program_updated_at();

CREATE TRIGGER daily_addition_targets_updated_at
  BEFORE UPDATE ON daily_addition_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_program_updated_at();

-- =====================================================
-- 初期データ投入: 加算定義マスター
-- =====================================================

INSERT INTO addition_definitions (code, name, short_name, category_code, addition_type, units, is_percentage, percentage_rate, requirements, recording_guide, display_order)
VALUES
  -- 体制加算（facility_preset）
  ('staff_allocation_1_fulltime_exp', '児童指導員等加配加算(I) 常勤専従・経験5年以上', '加配I-1', 'staffing', 'facility_preset', 187, false, null,
   '有資格者を常勤専従で配置、経験5年以上',
   '## 記録方法\n- 勤務体制一覧表に加配職員を記載\n- 経験年数証明書を保管', 10),

  ('staff_allocation_1_fulltime', '児童指導員等加配加算(I) 常勤専従', '加配I-2', 'staffing', 'facility_preset', 152, false, null,
   '有資格者を常勤専従で配置',
   '## 記録方法\n- 勤務体制一覧表に加配職員を記載', 11),

  ('staff_allocation_1_convert_exp', '児童指導員等加配加算(I) 常勤換算・経験5年以上', '加配I-3', 'staffing', 'facility_preset', 123, false, null,
   '有資格者を常勤換算1名以上配置、経験5年以上',
   '## 記録方法\n- 勤務体制一覧表に加配職員を記載\n- 常勤換算計算書を保管', 12),

  ('staff_allocation_1_convert', '児童指導員等加配加算(I) 常勤換算', '加配I-4', 'staffing', 'facility_preset', 107, false, null,
   '有資格者を常勤換算1名以上配置',
   '## 記録方法\n- 勤務体制一覧表に加配職員を記載', 13),

  ('staff_allocation_2', '児童指導員等加配加算(II)', '加配II', 'staffing', 'facility_preset', 90, false, null,
   'その他の従業者を1名以上加配',
   '## 記録方法\n- 勤務体制一覧表に加配職員を記載', 14),

  ('specialist_support_structure', '専門的支援体制加算', '専門体制', 'specialist', 'facility_preset', 123, false, null,
   '理学療法士等を常勤換算1名以上配置',
   '## 記録方法\n- 勤務体制一覧表に専門職を記載\n- 資格証の写しを保管', 20),

  ('welfare_professional_1', '福祉専門職員配置等加算(I)', '福専I', 'staffing', 'facility_preset', 15, false, null,
   '常勤従業者のうち資格者割合35%以上',
   '## 記録方法\n- 資格者割合計算書を作成', 30),

  ('welfare_professional_2', '福祉専門職員配置等加算(II)', '福専II', 'staffing', 'facility_preset', 10, false, null,
   '常勤従業者のうち資格者割合25%以上',
   '## 記録方法\n- 資格者割合計算書を作成', 31),

  ('welfare_professional_3', '福祉専門職員配置等加算(III)', '福専III', 'staffing', 'facility_preset', 6, false, null,
   '常勤割合75%以上、または勤続3年以上30%以上',
   '## 記録方法\n- 常勤率/勤続年数計算書を作成', 32),

  ('treatment_improvement_1', '福祉・介護職員処遇改善加算(I)', '処遇I', 'treatment', 'facility_preset', null, true, 13.1,
   '全要件を満たす（最高区分）',
   '## 記録方法\n- 処遇改善計画書・実績報告書を提出', 40),

  ('treatment_improvement_2', '福祉・介護職員処遇改善加算(II)', '処遇II', 'treatment', 'facility_preset', null, true, 10.0,
   '一部要件を満たす',
   '## 記録方法\n- 処遇改善計画書・実績報告書を提出', 41),

  ('treatment_improvement_3', '福祉・介護職員処遇改善加算(III)', '処遇III', 'treatment', 'facility_preset', null, true, 7.0,
   '基本要件を満たす',
   '## 記録方法\n- 処遇改善計画書・実績報告書を提出', 42),

  ('treatment_improvement_4', '福祉・介護職員処遇改善加算(IV)', '処遇IV', 'treatment', 'facility_preset', null, true, 4.0,
   '最低限の要件を満たす',
   '## 記録方法\n- 処遇改善計画書・実績報告書を提出', 43),

  -- 実施加算（daily）
  ('specialist_support_daily', '専門的支援実施加算', '専門', 'specialist', 'daily', 187, false, null,
   'PT/OT/ST/公認心理師が専門的支援計画に基づき直接支援',
   '## 記録方法\n1. 専門的支援計画書を作成\n2. 支援記録に実施内容を記載\n3. 支援計画の評価を実施', 50),

  ('family_support_1', '家族支援加算(I)', '家支I', 'family', 'daily', 300, false, null,
   '保護者への個別相談支援',
   '## 記録方法\n- 相談記録を作成（日時、内容、担当者）', 60),

  ('family_support_2', '家族支援加算(II)', '家支II', 'family', 'daily', 200, false, null,
   'グループでの家族支援',
   '## 記録方法\n- グループワーク記録を作成', 61),

  ('transport', '送迎加算', '送迎', 'transport', 'daily', 54, false, null,
   '居宅と事業所間の送迎（片道）',
   '## 記録方法\n- 送迎記録に往復を記載\n- 運転者・添乗員を記載', 70),

  ('transport_severe', '送迎加算（重心）', '送迎重', 'transport', 'daily', 37, false, null,
   '重症心身障害児の送迎（片道）',
   '## 記録方法\n- 送迎記録に往復を記載', 71),

  ('extension_1h', '延長支援加算（1時間）', '延長1h', 'extension', 'daily', 61, false, null,
   '営業時間の前後1時間以内の延長',
   '## 記録方法\n- 利用実績に延長時間を記載', 80),

  ('extension_2h', '延長支援加算（2時間）', '延長2h', 'extension', 'daily', 92, false, null,
   '営業時間の前後2時間以内の延長',
   '## 記録方法\n- 利用実績に延長時間を記載', 81),

  ('extension_over2h', '延長支援加算（2時間超）', '延長超', 'extension', 'daily', 123, false, null,
   '営業時間の前後2時間を超える延長',
   '## 記録方法\n- 利用実績に延長時間を記載', 82),

  ('individual_support_1', '個別サポート加算(I)', '個サI', 'support', 'daily', 120, false, null,
   '著しく重度の障害児への支援',
   '## 記録方法\n- アセスメント記録\n- 個別支援記録', 90),

  ('individual_support_2', '個別サポート加算(II)', '個サII', 'support', 'daily', 125, false, null,
   '要保護・要支援児童への支援',
   '## 記録方法\n- 関係機関との連携記録', 91),

  ('behavior_support_1', '強度行動障害児支援加算', '強行', 'support', 'daily', 200, false, null,
   '強度行動障害スコア20点以上の児童への支援',
   '## 記録方法\n- 行動関連項目評価\n- 支援記録', 100),

  ('medical_care_3', '医療連携体制加算(III)', '医連III', 'medical', 'daily', 500, false, null,
   '看護職員による医療的ケア実施',
   '## 記録方法\n- 医療的ケア実施記録\n- 主治医との連携記録', 110),

  ('childcare_support', '保育・教育等移行支援加算', '移行', 'support', 'monthly', 500, false, null,
   '保育所・幼稚園等への移行支援',
   '## 記録方法\n- 移行支援計画\n- 関係機関との連絡記録', 120),

  ('self_evaluation', '自己評価結果等公表加算', '自己評', 'other', 'facility_preset', 15, false, null,
   '自己評価結果と保護者評価結果を公表',
   '## 記録方法\n- 自己評価シート作成・公表\n- 保護者アンケート実施・公表', 130)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  category_code = EXCLUDED.category_code,
  addition_type = EXCLUDED.addition_type,
  units = EXCLUDED.units,
  is_percentage = EXCLUDED.is_percentage,
  percentage_rate = EXCLUDED.percentage_rate,
  requirements = EXCLUDED.requirements,
  recording_guide = EXCLUDED.recording_guide,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- コメント追加
COMMENT ON TABLE daily_program_plans IS '日別プログラム計画 - 施設が1日ごとに計画する加算リスト';
COMMENT ON TABLE daily_addition_targets IS '日別加算ターゲット - 児童ごとに計画する加算の詳細';
COMMENT ON TABLE addition_definitions IS '加算定義マスター - システム全体で使用する加算のマスター情報';
