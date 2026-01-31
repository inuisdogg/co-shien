-- ============================================
-- 行政コンプライアンス・履歴管理システム
-- 設計書: regulatory_compliance_design.md
-- ============================================

-- ============================================
-- 1. 加算ステータスライフサイクル管理
-- Planned → Applying → Active → Inactive
-- ============================================

-- 加算申請ステータスENUM
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'addition_lifecycle_status') THEN
    CREATE TYPE addition_lifecycle_status AS ENUM (
      'planned',    -- 計画中（売上予測に含めない）
      'applying',   -- 届出準備中（書類出力可能、15日締切前）
      'submitted',  -- 届出済み（行政受理待ち）
      'active',     -- 適用中（行政受理済み、売上に反映）
      'inactive'    -- 廃止/停止
    );
  END IF;
END $$;

-- 施設加算設定テーブルの拡張
ALTER TABLE facility_addition_settings
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS planned_start_date DATE,           -- 適用予定開始日
  ADD COLUMN IF NOT EXISTS submission_deadline DATE,          -- 届出締切日（前月15日）
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,          -- 届出日時
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,           -- 行政受理日時
  ADD COLUMN IF NOT EXISTS approved_by TEXT,                  -- 受理担当
  ADD COLUMN IF NOT EXISTS document_output_at TIMESTAMPTZ,    -- 書類出力日時
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,         -- バージョン（変更履歴用）
  ADD COLUMN IF NOT EXISTS previous_version_id TEXT;          -- 前バージョンのID

COMMENT ON COLUMN facility_addition_settings.status IS '加算ステータス: planned/applying/submitted/active/inactive';
COMMENT ON COLUMN facility_addition_settings.planned_start_date IS '適用予定開始日（例：4月から取得なら4月1日）';
COMMENT ON COLUMN facility_addition_settings.submission_deadline IS '届出締切日（適用月の前月15日）';
COMMENT ON COLUMN facility_addition_settings.submitted_at IS '行政への届出日時';
COMMENT ON COLUMN facility_addition_settings.approved_at IS '行政による受理日時';

-- ============================================
-- 2. 加算変更履歴テーブル（Time Travel対応）
-- ============================================
CREATE TABLE IF NOT EXISTS addition_setting_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_addition_setting_id TEXT NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  addition_code TEXT NOT NULL,
  status TEXT NOT NULL,
  valid_from DATE NOT NULL,                      -- この設定が有効になった日
  valid_to DATE,                                 -- この設定が無効になった日（NULLは現在有効）
  is_enabled BOOLEAN DEFAULT FALSE,
  notes TEXT,
  changed_by TEXT,                               -- 変更者
  change_reason TEXT,                            -- 変更理由
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addition_history_facility ON addition_setting_history(facility_id);
CREATE INDEX IF NOT EXISTS idx_addition_history_valid ON addition_setting_history(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_addition_history_code ON addition_setting_history(addition_code);

COMMENT ON TABLE addition_setting_history IS '加算設定の変更履歴（任意時点の状態を再現可能）';

-- ============================================
-- 3. 施設情報履歴テーブル（Time Travel対応）
-- ============================================
CREATE TABLE IF NOT EXISTS facility_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE,
  -- 施設基本情報のスナップショット
  name TEXT,
  address TEXT,
  phone TEXT,
  capacity INTEGER,
  service_type_code TEXT,
  regional_grade TEXT,
  manager_name TEXT,
  manager_id TEXT,
  -- 法人情報
  corporation_name TEXT,
  corporation_address TEXT,
  representative_name TEXT,
  -- 変更追跡
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_history_facility ON facility_history(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_history_valid ON facility_history(valid_from, valid_to);

COMMENT ON TABLE facility_history IS '施設情報の変更履歴（監査対応用Time Travel）';

-- ============================================
-- 4. 職員配置履歴テーブル（Time Travel対応）
-- ============================================
CREATE TABLE IF NOT EXISTS staff_assignment_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE,
  -- 配置情報のスナップショット
  position TEXT,                               -- 職種
  employment_type TEXT,                        -- 雇用形態（常勤/非常勤）
  is_fulltime BOOLEAN,                         -- 常勤専従か
  weekly_hours NUMERIC(4,1),                   -- 週間勤務時間
  qualifications TEXT[],                       -- 保有資格
  years_of_experience INTEGER,                 -- 経験年数
  -- 変更追跡
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_history_facility ON staff_assignment_history(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_history_staff ON staff_assignment_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_history_valid ON staff_assignment_history(valid_from, valid_to);

COMMENT ON TABLE staff_assignment_history IS '職員配置の変更履歴（勤務体制表出力用）';

-- ============================================
-- 5. 届出書類管理テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS document_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,                 -- 'designation_application', 'change_notification', 'addition_notification' 等
  document_name TEXT NOT NULL,                 -- 書類名
  target_month DATE,                           -- 対象月（加算届の場合、適用開始月）
  submission_deadline DATE,                    -- 提出期限
  status TEXT DEFAULT 'draft',                 -- draft/ready/submitted/approved/rejected
  generated_at TIMESTAMPTZ,                    -- 書類生成日時
  generated_file_path TEXT,                    -- 生成ファイルパス
  submitted_at TIMESTAMPTZ,                    -- 提出日時
  approved_at TIMESTAMPTZ,                     -- 受理日時
  rejection_reason TEXT,                       -- 差戻理由
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_submissions_facility ON document_submissions(facility_id);
CREATE INDEX IF NOT EXISTS idx_doc_submissions_type ON document_submissions(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_submissions_deadline ON document_submissions(submission_deadline);

COMMENT ON TABLE document_submissions IS '行政提出書類の管理';

-- ============================================
-- 6. 書類テンプレート定義テーブル
-- ============================================
-- 既存テーブルがあれば削除して再作成
DROP TABLE IF EXISTS document_templates CASCADE;

CREATE TABLE document_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code TEXT NOT NULL UNIQUE,                   -- テンプレートコード
  name TEXT NOT NULL,                          -- テンプレート名
  file_type TEXT NOT NULL,                     -- 'excel', 'word'
  template_path TEXT NOT NULL,                 -- テンプレートファイルパス
  output_strategy TEXT,                        -- 'master_injection', 'direct_write', 'template_substitution'
  applicable_services TEXT[],                  -- 適用サービス種別
  required_additions TEXT[],                   -- このシートを出力するのに必要な加算
  is_required BOOLEAN DEFAULT FALSE,           -- 必須書類か
  mapping_config JSONB,                        -- セルマッピング設定
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 基本テンプレート定義
INSERT INTO document_templates (code, name, file_type, template_path, output_strategy, is_required, display_order) VALUES
  -- Excel系（指定申請）
  ('designation_main', '新規指定様式', 'excel', 'templates/新規指定様式　R070401~_.xlsx', 'master_injection', TRUE, 1),
  ('work_schedule', '勤務体制一覧表（参考様式1）', 'excel', 'templates/新規指定様式　R070401~_.xlsx', 'direct_write', TRUE, 2),
  ('equipment_list', '設備・備品等一覧表（参考様式2）', 'excel', 'templates/新規指定様式　R070401~_.xlsx', 'direct_write', TRUE, 3),
  ('career_history', '経歴書（参考様式3）', 'excel', 'templates/新規指定様式　R070401~_.xlsx', 'direct_write', TRUE, 4),
  ('work_experience', '実務経験証明書', 'excel', 'templates/新規指定様式　R070401~_.xlsx', 'direct_write', FALSE, 5),
  ('individual_support_plan', '個別支援計画', 'excel', 'templates/0520_個別支援計画(都参考様式） (1).xlsx', 'direct_write', FALSE, 10),
  ('service_record', 'サービス提供記録', 'excel', 'templates/15_サービス提供記録（障害児通所）.xls', 'direct_write', FALSE, 11),
  ('accident_report', '事故報告書', 'excel', 'templates/30_事故報告書.xls', 'direct_write', FALSE, 12),
  -- Word系（運営記録）
  ('incident_report', 'ヒヤリハット報告書', 'word', 'templates/32_ヒヤリハット報告書（児童系）.docx', 'template_substitution', FALSE, 20),
  ('complaint_record', '相談・苦情受付等記録書', 'word', 'templates/29_相談・苦情受付等記録書.doc', 'template_substitution', FALSE, 21),
  ('training_minutes', '研修議事録', 'word', 'templates/33_研修議事録.docx', 'template_substitution', FALSE, 22),
  ('confidentiality_oath', '秘密情報保持誓約書', 'word', 'templates/34_秘密情報の保持に関する誓約書.doc', 'template_substitution', FALSE, 23),
  ('consent_form', '個人情報使用同意書', 'word', 'templates/10_個人情報使用同意書（児童系） (1).doc', 'template_substitution', FALSE, 24);

COMMENT ON TABLE document_templates IS '書類テンプレート定義';

-- ============================================
-- 7. 締切アラート管理テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS deadline_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,                    -- 'addition_deadline', 'document_deadline', 'renewal' 等
  related_id TEXT,                             -- 関連レコードID
  deadline_date DATE NOT NULL,                 -- 締切日
  alert_date DATE NOT NULL,                    -- アラート表示開始日
  title TEXT NOT NULL,
  message TEXT,
  priority TEXT DEFAULT 'medium',              -- low/medium/high/critical
  is_dismissed BOOLEAN DEFAULT FALSE,          -- 非表示にしたか
  dismissed_at TIMESTAMPTZ,
  dismissed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deadline_alerts_facility ON deadline_alerts(facility_id);
CREATE INDEX IF NOT EXISTS idx_deadline_alerts_date ON deadline_alerts(deadline_date);
CREATE INDEX IF NOT EXISTS idx_deadline_alerts_dismissed ON deadline_alerts(is_dismissed);

COMMENT ON TABLE deadline_alerts IS '締切アラート管理（15日締切等）';

-- ============================================
-- 8. 売上予測テーブル拡張
-- 届出ステータスに基づく分離
-- ============================================
ALTER TABLE monthly_revenue_estimates
  ADD COLUMN IF NOT EXISTS confirmed_units INTEGER DEFAULT 0,      -- 確定単位（Active加算のみ）
  ADD COLUMN IF NOT EXISTS pending_units INTEGER DEFAULT 0,        -- 未確定単位（Applying/Submitted）
  ADD COLUMN IF NOT EXISTS planned_units INTEGER DEFAULT 0,        -- 計画単位（Planned）
  ADD COLUMN IF NOT EXISTS confirmed_revenue NUMERIC(12,0),        -- 確定売上
  ADD COLUMN IF NOT EXISTS pending_revenue NUMERIC(12,0),          -- 未確定売上
  ADD COLUMN IF NOT EXISTS planned_revenue NUMERIC(12,0);          -- 計画売上

COMMENT ON COLUMN monthly_revenue_estimates.confirmed_units IS '確定単位数（届出受理済み加算のみ）';
COMMENT ON COLUMN monthly_revenue_estimates.pending_units IS '未確定単位数（届出中の加算）';
COMMENT ON COLUMN monthly_revenue_estimates.planned_units IS '計画単位数（計画中の加算）';

-- ============================================
-- 9. ビュー：特定日時点の加算状態
-- ============================================
CREATE OR REPLACE VIEW v_addition_settings_at_date AS
SELECT
  h.facility_id,
  h.addition_code,
  a.name AS addition_name,
  a.units,
  h.status,
  h.is_enabled,
  h.valid_from,
  h.valid_to
FROM addition_setting_history h
JOIN additions a ON a.code = h.addition_code
WHERE h.valid_to IS NULL OR h.valid_to > CURRENT_DATE;

COMMENT ON VIEW v_addition_settings_at_date IS '現在有効な加算設定（履歴ベース）';

-- ============================================
-- 10. 関数：指定日の施設加算状態を取得
-- ============================================
CREATE OR REPLACE FUNCTION get_facility_additions_at_date(
  p_facility_id TEXT,
  p_target_date DATE
)
RETURNS TABLE (
  addition_code TEXT,
  addition_name TEXT,
  units INTEGER,
  status TEXT,
  is_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.addition_code,
    a.name,
    a.units,
    h.status,
    h.is_enabled
  FROM addition_setting_history h
  JOIN additions a ON a.code = h.addition_code
  WHERE h.facility_id = p_facility_id
    AND h.valid_from <= p_target_date
    AND (h.valid_to IS NULL OR h.valid_to > p_target_date);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_facility_additions_at_date IS '指定日時点の施設加算状態を取得（監査対応）';

-- ============================================
-- 11. 関数：届出締切日を計算
-- ============================================
CREATE OR REPLACE FUNCTION calculate_submission_deadline(
  p_target_start_date DATE
)
RETURNS DATE AS $$
DECLARE
  v_deadline DATE;
BEGIN
  -- 適用開始月の前月15日が締切
  -- 例: 4月1日適用なら3月15日締切
  v_deadline := (date_trunc('month', p_target_start_date) - INTERVAL '1 month' + INTERVAL '14 days')::DATE;
  RETURN v_deadline;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_submission_deadline IS '加算届出の締切日を計算（前月15日）';

-- ============================================
-- 12. トリガー：加算設定変更時に履歴を自動記録
-- ============================================
CREATE OR REPLACE FUNCTION record_addition_setting_history()
RETURNS TRIGGER AS $$
BEGIN
  -- 既存の有効レコードを終了
  UPDATE addition_setting_history
  SET valid_to = CURRENT_DATE
  WHERE facility_id = NEW.facility_id
    AND addition_code = NEW.addition_code
    AND valid_to IS NULL;

  -- 新しい履歴レコードを挿入
  INSERT INTO addition_setting_history (
    facility_addition_setting_id,
    facility_id,
    addition_code,
    status,
    valid_from,
    is_enabled,
    notes,
    changed_by
  ) VALUES (
    NEW.id,
    NEW.facility_id,
    NEW.addition_code,
    NEW.status,
    COALESCE(NEW.effective_from, CURRENT_DATE),
    NEW.is_enabled,
    NEW.notes,
    current_user
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_addition_setting_history ON facility_addition_settings;
CREATE TRIGGER trg_addition_setting_history
  AFTER INSERT OR UPDATE ON facility_addition_settings
  FOR EACH ROW
  EXECUTE FUNCTION record_addition_setting_history();

-- ============================================
-- 13. RLS設定
-- ============================================
ALTER TABLE addition_setting_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_alerts ENABLE ROW LEVEL SECURITY;

-- 全操作許可（実運用では適切な制限を）
CREATE POLICY "addition_setting_history_all" ON addition_setting_history FOR ALL USING (true);
CREATE POLICY "facility_history_all" ON facility_history FOR ALL USING (true);
CREATE POLICY "staff_assignment_history_all" ON staff_assignment_history FOR ALL USING (true);
CREATE POLICY "document_submissions_all" ON document_submissions FOR ALL USING (true);
CREATE POLICY "document_templates_select" ON document_templates FOR SELECT USING (true);
CREATE POLICY "deadline_alerts_all" ON deadline_alerts FOR ALL USING (true);

-- ============================================
-- 14. スタッフテーブル拡張（資格・経験年数）
-- ============================================
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS qualifications TEXT[],
  ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'fulltime',
  ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS career_history JSONB;

COMMENT ON COLUMN staff.qualifications IS '保有資格（配列）';
COMMENT ON COLUMN staff.years_of_experience IS '障害児支援業務経験年数';
COMMENT ON COLUMN staff.employment_type IS '雇用形態: fulltime/parttime/contract';
COMMENT ON COLUMN staff.weekly_hours IS '週間勤務時間';
COMMENT ON COLUMN staff.hire_date IS '入社日';
COMMENT ON COLUMN staff.career_history IS '経歴（JSON）';
