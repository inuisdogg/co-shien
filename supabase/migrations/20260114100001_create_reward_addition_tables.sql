-- ============================================
-- 障害児通所支援 報酬・加算管理システム
-- 令和6年改定ベース（令和8年1月現在）
-- ============================================

-- ============================================
-- 1. サービス種別マスタ
-- ============================================
CREATE TABLE IF NOT EXISTS service_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code TEXT NOT NULL UNIQUE,           -- 'jido_hattatsu', 'hokago_day' 等
  name TEXT NOT NULL,                   -- '児童発達支援', '放課後等デイサービス' 等
  short_name TEXT,                      -- '児発', '放デイ' 等
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ
INSERT INTO service_types (code, name, short_name, display_order) VALUES
  ('jido_hattatsu', '児童発達支援', '児発', 1),
  ('jido_hattatsu_center', '児童発達支援センター', '児発C', 2),
  ('hokago_day', '放課後等デイサービス', '放デイ', 3),
  ('hoiku_houmon', '保育所等訪問支援', '保訪', 4),
  ('kyotaku_houmon', '居宅訪問型児童発達支援', '居宅', 5),
  ('iryo_jido', '医療型児童発達支援', '医児発', 6)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. 地域区分マスタ（東京都）
-- ============================================
CREATE TABLE IF NOT EXISTS regional_units (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  grade TEXT NOT NULL UNIQUE,           -- '1級地', '2級地' 等
  rate NUMERIC(5,2) NOT NULL,           -- 上乗せ割合 (例: 1.20 = 120%)
  unit_price NUMERIC(5,2) NOT NULL,     -- 1単位あたり単価 (円)
  applicable_areas TEXT[],              -- 適用自治体
  effective_from DATE DEFAULT '2024-04-01',
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 東京都の地域区分データ
INSERT INTO regional_units (grade, rate, unit_price, applicable_areas) VALUES
  ('1級地', 1.20, 11.20, ARRAY['千代田区','中央区','港区','新宿区','文京区','台東区','墨田区','江東区','品川区','目黒区','大田区','世田谷区','渋谷区','中野区','杉並区','豊島区','北区','荒川区','板橋区','練馬区','足立区','葛飾区','江戸川区']),
  ('2級地', 1.16, 10.90, ARRAY['武蔵野市','調布市','町田市','小金井市','小平市','日野市','国分寺市','狛江市','多摩市','稲城市','西東京市']),
  ('3級地', 1.12, 10.61, ARRAY['八王子市','立川市','三鷹市','青梅市','府中市','昭島市','東村山市','国立市','福生市','東大和市','清瀬市','武蔵村山市','羽村市']),
  ('4級地', 1.10, 10.42, ARRAY['あきる野市']),
  ('その他', 1.00, 10.00, ARRAY['瑞穂町','日の出町','檜原村','奥多摩町','大島町','八丈町'])
ON CONFLICT (grade) DO NOTHING;

-- ============================================
-- 3. 基本報酬マスタ
-- ============================================
CREATE TABLE IF NOT EXISTS base_rewards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  service_type_code TEXT NOT NULL REFERENCES service_types(code),
  time_category INTEGER NOT NULL,       -- 区分1, 2, 3, 4
  time_description TEXT,                -- '30分以上1時間30分以下' 等
  min_minutes INTEGER,                  -- 最小時間（分）
  max_minutes INTEGER,                  -- 最大時間（分）
  capacity_min INTEGER,                 -- 定員下限
  capacity_max INTEGER,                 -- 定員上限
  units INTEGER NOT NULL,               -- 単位数
  applicable_days TEXT[],               -- 適用日 ['全日'], ['学校休業日のみ'] 等
  effective_from DATE DEFAULT '2024-04-01',
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_type_code, time_category, capacity_min, capacity_max)
);

-- 児童発達支援の基本報酬（定員10名以下）
INSERT INTO base_rewards (service_type_code, time_category, time_description, min_minutes, max_minutes, capacity_min, capacity_max, units, applicable_days) VALUES
  ('jido_hattatsu', 1, '30分以上1時間30分以下', 30, 90, 1, 10, 574, ARRAY['全日']),
  ('jido_hattatsu', 2, '1時間30分超3時間以下', 90, 180, 1, 10, 609, ARRAY['全日']),
  ('jido_hattatsu', 3, '3時間超5時間以下', 180, 300, 1, 10, 666, ARRAY['全日']),
  ('jido_hattatsu', 4, '5時間超', 300, NULL, 1, 10, 666, ARRAY['全日'])
ON CONFLICT DO NOTHING;

-- 放課後等デイサービスの基本報酬（定員10名以下）
INSERT INTO base_rewards (service_type_code, time_category, time_description, min_minutes, max_minutes, capacity_min, capacity_max, units, applicable_days) VALUES
  ('hokago_day', 1, '30分以上1時間30分以下', 30, 90, 1, 10, 466, ARRAY['全日']),
  ('hokago_day', 2, '1時間30分超3時間以下', 90, 180, 1, 10, 480, ARRAY['全日']),
  ('hokago_day', 3, '3時間超5時間以下', 180, 300, 1, 10, 604, ARRAY['学校休業日のみ'])
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. 加算カテゴリマスタ
-- ============================================
CREATE TABLE IF NOT EXISTS addition_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO addition_categories (code, name, display_order) VALUES
  ('staff_allocation', '人員配置体制', 1),
  ('specialist', '専門的支援', 2),
  ('family_support', '家族支援・連携', 3),
  ('individual_support', '個別支援', 4),
  ('transport', '送迎・移動', 5),
  ('time_extension', '延長支援', 6),
  ('daily_care', '日常生活支援', 7),
  ('behavior_support', '行動障害支援', 8),
  ('medical_care', '医療的ケア', 9),
  ('treatment_improvement', '処遇改善', 10)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5. 加算マスタ（メイン）
-- ============================================
CREATE TABLE IF NOT EXISTS additions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code TEXT NOT NULL UNIQUE,                    -- 加算コード
  category_code TEXT REFERENCES addition_categories(code),
  name TEXT NOT NULL,                           -- 加算名
  short_name TEXT,                              -- 短縮名
  description TEXT,                             -- 説明
  units INTEGER,                                -- 単位数（固定の場合）
  unit_type TEXT DEFAULT 'day',                 -- 'day'(日), 'time'(回), 'month'(月), 'percent'(%)
  is_percentage BOOLEAN DEFAULT FALSE,          -- パーセント加算かどうか
  percentage_rate NUMERIC(5,2),                 -- パーセント率（処遇改善等）
  applicable_services TEXT[],                   -- 適用サービス種別
  requirements TEXT,                            -- 算定要件（テキスト）
  requirements_json JSONB,                      -- 算定要件（構造化データ）
  max_times_per_month INTEGER,                  -- 月間上限回数
  max_times_per_day INTEGER DEFAULT 1,          -- 日間上限回数
  is_exclusive BOOLEAN DEFAULT FALSE,           -- 他加算との排他
  exclusive_with TEXT[],                        -- 排他対象の加算コード
  effective_from DATE DEFAULT '2024-04-01',
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5.1 人員配置体制加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('staff_allocation_1_fulltime', 'staff_allocation', '児童指導員等加配加算(I)常勤専従', '加配I常', 187, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   'PT/OT/ST/保育士/児童指導員等で経験5年以上、常勤専従1.0人以上配置', 1),
  ('staff_allocation_1_convert', 'staff_allocation', '児童指導員等加配加算(I)常勤換算', '加配I換', 123, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   'PT/OT/ST/保育士/児童指導員等で経験5年以上、常勤換算1.0人以上配置', 2),
  ('staff_allocation_2_fulltime', 'staff_allocation', '児童指導員等加配加算(II)常勤専従', '加配II常', 152, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   'PT/OT/ST/保育士/児童指導員等で経験5年未満、常勤専従配置', 3),
  ('staff_allocation_2_convert', 'staff_allocation', '児童指導員等加配加算(II)常勤換算', '加配II換', 107, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   'PT/OT/ST/保育士/児童指導員等で経験5年未満、常勤換算配置', 4),
  ('staff_allocation_3', 'staff_allocation', '児童指導員等加配加算(III)', '加配III', 90, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   'その他の従業者（資格要件なし）を配置', 5)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.2 専門的支援加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('specialist_support', 'specialist', '専門的支援実施加算', '専門支援', 150, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   'PT/OT/ST/公認心理師等が専門的支援計画に基づき直接支援を実施', 10),
  ('care_needs_basic', 'specialist', 'ケアニーズ対応加算', 'ケアニーズ', 80, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '医療的ケア児（スコア16点以上）への支援、看護職員配置', 11)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.3 家族支援加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, max_times_per_month, display_order) VALUES
  ('family_support_1', 'family_support', '家族支援加算(I)', '家族I', 300, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   '居宅訪問での相談援助（1時間以上）', 2, 20),
  ('family_support_2', 'family_support', '家族支援加算(II)', '家族II', 200, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   '居宅訪問での相談援助（1時間未満）', 2, 21),
  ('family_support_3', 'family_support', '家族支援加算(III)', '家族III', 100, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   '事業所内での対面相談援助', 4, 22),
  ('family_support_4', 'family_support', '家族支援加算(IV)', '家族IV', 80, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   'オンライン（テレビ電話等）での相談援助', 4, 23),
  ('agency_cooperation_1', 'family_support', '関係機関連携加算(I)', '機関連携I', 200, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   '保育所・学校・児相等との連携会議参加', 1, 24),
  ('agency_cooperation_2', 'family_support', '関係機関連携加算(II)', '機関連携II', 200, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   '就学先・就職先等との連携調整', 1, 25),
  ('inter_office_cooperation', 'family_support', '事業所間連携加算', '事業所連携', 150, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   'セルフプラン利用児について他事業所と支援内容調整', NULL, 26)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.4 個別サポート加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('individual_support_1', 'individual_support', '個別サポート加算(I)', '個別I', 100, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   'ケアニーズの高い児童への支援（乳幼児等サポート調査判定）', 30),
  ('individual_support_1_high', 'individual_support', '個別サポート加算(I)重度', '個別I重', 120, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '著しく重度・ケアニーズが高い児童への支援', 31),
  ('individual_support_2', 'individual_support', '個別サポート加算(II)', '個別II', 125, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '要保護・要支援児童の受入れ、関係機関との連携体制', 32)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.5 送迎加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, max_times_per_day, display_order) VALUES
  ('transport', 'transport', '送迎加算', '送迎', 54, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   '居宅・保育所等と事業所間の送迎（片道）', 2, 40),
  ('transport_same_site', 'transport', '送迎加算（同一敷地内）', '送迎同敷', 37, 'time',
   ARRAY['jido_hattatsu','hokago_day'],
   '同一敷地内等の送迎（片道）', 2, 41),
  ('transport_independence', 'transport', '通所自立支援加算', '通所自立', 60, 'time',
   ARRAY['hokago_day'],
   '公共交通機関等での自力通所の見守り・付き添い支援', 2, 42)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.6 延長支援加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('extension_1h', 'time_extension', '延長支援加算（1時間未満）', '延長1h未満', 61, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '基本営業時間を超えた支援（1時間未満）', 50),
  ('extension_2h', 'time_extension', '延長支援加算（1時間以上2時間未満）', '延長1-2h', 92, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '基本営業時間を超えた支援（1時間以上2時間未満）', 51),
  ('extension_over2h', 'time_extension', '延長支援加算（2時間以上）', '延長2h以上', 123, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '基本営業時間を超えた支援（2時間以上）', 52)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.7 日常生活支援加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('bathing_support', 'daily_care', '入浴支援加算', '入浴', 80, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '入浴設備を有し、職員が入浴介助等を実施', 60),
  ('meal_provision', 'daily_care', '食事提供加算', '食事', 30, 'day',
   ARRAY['jido_hattatsu','hokago_day'],
   '低所得・中間所得層児童に食事を提供（生保世帯等）', 61)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.8 強度行動障害支援加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('behavior_support_1', 'behavior_support', '強度行動障害児支援加算(I)', '強行I', 200, 'day',
   ARRAY['hokago_day'],
   '強度行動障害スコア20点以上、研修修了者が支援', 70),
  ('behavior_support_1_initial', 'behavior_support', '強度行動障害児支援加算(I)開始90日', '強行I初', 700, 'day',
   ARRAY['hokago_day'],
   '強度行動障害スコア20点以上、開始から90日以内', 71),
  ('behavior_support_2', 'behavior_support', '強度行動障害児支援加算(II)', '強行II', 250, 'day',
   ARRAY['hokago_day'],
   '強度行動障害スコア30点以上、研修修了者が支援', 72),
  ('behavior_support_2_initial', 'behavior_support', '強度行動障害児支援加算(II)開始90日', '強行II初', 750, 'day',
   ARRAY['hokago_day'],
   '強度行動障害スコア30点以上、開始から90日以内', 73)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.9 放デイ特有加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('self_support', 'individual_support', '自立サポート加算', '自立サポ', 100, 'day',
   ARRAY['hokago_day'],
   '高3等、卒業後の進路決定・就労に向けた相談支援', 80),
  ('transition_support', 'individual_support', '保育・教育等移行支援加算', '移行支援', 500, 'time',
   ARRAY['hokago_day'],
   '退所し保育所・学校等へ移行する際の調整・相談（1回限り）', 81)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.10 訪問支援加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('visit_specialist_1', 'specialist', '訪問支援員特別加算(I)', '訪問特I', 850, 'time',
   ARRAY['hoiku_houmon'],
   '障害児支援業務10年以上（または保訪5年以上）の職員が訪問', 90),
  ('visit_specialist_2', 'specialist', '訪問支援員特別加算(II)', '訪問特II', 700, 'time',
   ARRAY['hoiku_houmon'],
   '障害児支援業務5年以上（または保訪3年以上）の職員が訪問', 91),
  ('multi_discipline', 'specialist', '多職種連携支援加算', '多職種', 200, 'time',
   ARRAY['hoiku_houmon'],
   '職種の異なる複数人（保育士+OT等）で訪問支援', 92)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.11 居宅訪問型加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, applicable_services, requirements, display_order) VALUES
  ('home_visit_specialist', 'specialist', '訪問支援員特別加算（居宅）', '居宅訪問特', 679, 'day',
   ARRAY['kyotaku_houmon'],
   '保育士・児童指導員・OT等で障害児支援業務5年以上', 100),
  ('intensive_support', 'specialist', '集中的支援加算', '集中支援', 1000, 'time',
   ARRAY['kyotaku_houmon'],
   '状態悪化児童への集中的支援（月4回限度）', 101)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5.12 処遇改善加算
-- ============================================
INSERT INTO additions (code, category_code, name, short_name, units, unit_type, is_percentage, percentage_rate, applicable_services, requirements, display_order) VALUES
  ('treatment_improvement_1', 'treatment_improvement', '福祉・介護職員等処遇改善加算(I)', '処遇I', NULL, 'percent', TRUE, 14.0,
   ARRAY['jido_hattatsu','hokago_day','hoiku_houmon','kyotaku_houmon'],
   '（基本報酬＋各種加算）×加算率', 110),
  ('treatment_improvement_2', 'treatment_improvement', '福祉・介護職員等処遇改善加算(II)', '処遇II', NULL, 'percent', TRUE, 10.0,
   ARRAY['jido_hattatsu','hokago_day','hoiku_houmon','kyotaku_houmon'],
   '（基本報酬＋各種加算）×加算率', 111),
  ('treatment_improvement_3', 'treatment_improvement', '福祉・介護職員等処遇改善加算(III)', '処遇III', NULL, 'percent', TRUE, 8.1,
   ARRAY['jido_hattatsu','hokago_day','hoiku_houmon','kyotaku_houmon'],
   '（基本報酬＋各種加算）×加算率', 112),
  ('treatment_improvement_4', 'treatment_improvement', '福祉・介護職員等処遇改善加算(IV)', '処遇IV', NULL, 'percent', TRUE, 5.5,
   ARRAY['jido_hattatsu','hokago_day','hoiku_houmon','kyotaku_houmon'],
   '（基本報酬＋各種加算）×加算率', 113)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 6. 減算マスタ
-- ============================================
CREATE TABLE IF NOT EXISTS deductions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  rate NUMERIC(5,2),                    -- 減算率（例: 0.70 = 70%に減算）
  applicable_services TEXT[],
  conditions TEXT,
  effective_from DATE DEFAULT '2024-04-01',
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO deductions (code, name, short_name, rate, applicable_services, conditions) VALUES
  ('over_capacity', '定員超過減算', '定員超過', 0.70,
   ARRAY['jido_hattatsu','hokago_day'],
   '定員150%超過または過去3ヶ月平均で定員105%超過'),
  ('staff_shortage', '人員欠如減算', '人員欠如', 0.70,
   ARRAY['jido_hattatsu','hokago_day'],
   '人員基準を満たしていない場合'),
  ('plan_not_created', '個別支援計画未作成減算', '計画未作成', 0.95,
   ARRAY['jido_hattatsu','hokago_day'],
   '個別支援計画が作成されていない場合'),
  ('self_evaluation_unpublished', '自己評価結果等未公表減算', '未公表', 0.85,
   ARRAY['jido_hattatsu','hokago_day'],
   '自己評価結果を公表していない場合'),
  ('body_restraint', '身体拘束廃止未実施減算', '身拘未実施', 0.99,
   ARRAY['jido_hattatsu','hokago_day'],
   '身体拘束廃止等の取組が未実施')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 7. 児童への加算適用テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS child_additions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  addition_code TEXT NOT NULL REFERENCES additions(code),
  is_enabled BOOLEAN DEFAULT TRUE,              -- 有効/無効
  start_date DATE,                              -- 適用開始日
  end_date DATE,                                -- 適用終了日
  custom_units INTEGER,                         -- カスタム単位数（上書き用）
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, facility_id, addition_code)
);

CREATE INDEX IF NOT EXISTS idx_child_additions_child ON child_additions(child_id);
CREATE INDEX IF NOT EXISTS idx_child_additions_facility ON child_additions(facility_id);
CREATE INDEX IF NOT EXISTS idx_child_additions_code ON child_additions(addition_code);

-- ============================================
-- 8. 施設の加算体制設定
-- ============================================
CREATE TABLE IF NOT EXISTS facility_addition_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  addition_code TEXT NOT NULL REFERENCES additions(code),
  is_enabled BOOLEAN DEFAULT FALSE,             -- 体制として算定可能か
  effective_from DATE,                          -- 届出日/適用開始日
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, addition_code)
);

CREATE INDEX IF NOT EXISTS idx_facility_addition_settings_facility ON facility_addition_settings(facility_id);

-- ============================================
-- 9. 施設の基本設定拡張
-- ============================================
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS service_type_code TEXT DEFAULT 'hokago_day',
  ADD COLUMN IF NOT EXISTS regional_grade TEXT DEFAULT '1級地',
  ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS treatment_improvement_grade TEXT;

COMMENT ON COLUMN facility_settings.service_type_code IS 'サービス種別コード';
COMMENT ON COLUMN facility_settings.regional_grade IS '地域区分（1級地等）';
COMMENT ON COLUMN facility_settings.capacity IS '定員数';
COMMENT ON COLUMN facility_settings.treatment_improvement_grade IS '処遇改善加算区分（I〜IV）';

-- ============================================
-- 10. 児童マスタ拡張（加算判定用）
-- ============================================
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS medical_care_score INTEGER,
  ADD COLUMN IF NOT EXISTS behavior_disorder_score INTEGER,
  ADD COLUMN IF NOT EXISTS care_needs_category TEXT,
  ADD COLUMN IF NOT EXISTS is_protected_child BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS income_category TEXT DEFAULT 'general';

COMMENT ON COLUMN children.medical_care_score IS '医療的ケア判定スコア';
COMMENT ON COLUMN children.behavior_disorder_score IS '強度行動障害判定スコア';
COMMENT ON COLUMN children.care_needs_category IS 'ケアニーズ判定結果';
COMMENT ON COLUMN children.is_protected_child IS '要保護・要支援児童フラグ';
COMMENT ON COLUMN children.income_category IS '世帯所得区分（general/low_income/welfare）';

-- ============================================
-- 11. 日次利用実績への加算記録
-- ============================================
CREATE TABLE IF NOT EXISTS daily_addition_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  addition_code TEXT NOT NULL REFERENCES additions(code),
  units INTEGER NOT NULL,                       -- 算定単位数
  times INTEGER DEFAULT 1,                      -- 回数（送迎など複数回の場合）
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, facility_id, date, addition_code)
);

CREATE INDEX IF NOT EXISTS idx_daily_addition_records_child ON daily_addition_records(child_id);
CREATE INDEX IF NOT EXISTS idx_daily_addition_records_facility ON daily_addition_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_daily_addition_records_date ON daily_addition_records(date);

-- ============================================
-- 12. 月間売上見込みテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_revenue_estimates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  estimated_usage_days INTEGER,                 -- 見込み利用日数（全児童合計）
  base_reward_units INTEGER,                    -- 基本報酬単位合計
  addition_units INTEGER,                       -- 加算単位合計
  deduction_units INTEGER DEFAULT 0,            -- 減算単位合計
  total_units INTEGER,                          -- 総単位数
  unit_price NUMERIC(5,2),                      -- 適用単価
  estimated_revenue NUMERIC(12,0),              -- 見込み売上（円）
  actual_revenue NUMERIC(12,0),                 -- 実績売上（円）
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_revenue_facility ON monthly_revenue_estimates(facility_id);
CREATE INDEX IF NOT EXISTS idx_monthly_revenue_year_month ON monthly_revenue_estimates(year, month);

-- ============================================
-- 13. RLS設定
-- ============================================
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE addition_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE additions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_additions ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_addition_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_addition_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_revenue_estimates ENABLE ROW LEVEL SECURITY;

-- マスタ系は全員読み取り可能
CREATE POLICY "service_types_select" ON service_types FOR SELECT USING (true);
CREATE POLICY "regional_units_select" ON regional_units FOR SELECT USING (true);
CREATE POLICY "base_rewards_select" ON base_rewards FOR SELECT USING (true);
CREATE POLICY "addition_categories_select" ON addition_categories FOR SELECT USING (true);
CREATE POLICY "additions_select" ON additions FOR SELECT USING (true);
CREATE POLICY "deductions_select" ON deductions FOR SELECT USING (true);

-- 施設関連データは全操作許可（実運用ではより厳密に）
CREATE POLICY "child_additions_all" ON child_additions FOR ALL USING (true);
CREATE POLICY "facility_addition_settings_all" ON facility_addition_settings FOR ALL USING (true);
CREATE POLICY "daily_addition_records_all" ON daily_addition_records FOR ALL USING (true);
CREATE POLICY "monthly_revenue_estimates_all" ON monthly_revenue_estimates FOR ALL USING (true);

COMMENT ON TABLE additions IS '障害児通所支援の加算マスタ（令和6年改定ベース）';
COMMENT ON TABLE child_additions IS '児童ごとの加算適用設定';
COMMENT ON TABLE facility_addition_settings IS '施設の加算体制届出状況';
COMMENT ON TABLE daily_addition_records IS '日次の加算算定実績';
COMMENT ON TABLE monthly_revenue_estimates IS '月間売上見込み・実績';
