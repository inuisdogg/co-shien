-- ============================================
-- KidOS 完全データベースセットアップ
-- ============================================
-- このSQLスクリプトは、KidOSシステムに必要なすべてのテーブルを作成します
-- SupabaseのSQL Editorで実行してください
-- ============================================

-- ============================================
-- 1. 施設情報設定テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS facility_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id TEXT NOT NULL,
  facility_name TEXT,
  regular_holidays INTEGER[] DEFAULT ARRAY[0],
  custom_holidays TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_hours JSONB NOT NULL DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}',
  capacity JSONB NOT NULL DEFAULT '{"AM": 10, "PM": 10}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id)
);

-- ============================================
-- 2. 児童テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  -- 基本情報
  name TEXT NOT NULL,
  age INTEGER,
  -- 保護者情報
  guardian_name TEXT,
  guardian_relationship TEXT,
  -- 受給者証情報
  beneficiary_number TEXT,
  grant_days INTEGER,
  contract_days INTEGER,
  -- 連絡先
  address TEXT,
  phone TEXT,
  email TEXT,
  -- 医療情報
  doctor_name TEXT,
  doctor_clinic TEXT,
  -- 通園情報
  school_name TEXT,
  -- 利用パターン
  pattern TEXT,
  needs_pickup BOOLEAN DEFAULT false,
  needs_dropoff BOOLEAN DEFAULT false,
  pickup_location TEXT,
  dropoff_location TEXT,
  -- 契約ステータス
  contract_status TEXT NOT NULL CHECK (contract_status IN ('pre-contract', 'active', 'inactive', 'terminated')),
  contract_start_date DATE,
  contract_end_date DATE,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. スタッフテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  role TEXT NOT NULL CHECK (role IN ('一般スタッフ', 'マネージャー', '管理者')),
  type TEXT NOT NULL CHECK (type IN ('常勤', '非常勤')),
  -- 基本情報
  birth_date DATE,
  gender TEXT CHECK (gender IN ('男性', '女性', 'その他')),
  address TEXT,
  phone TEXT,
  email TEXT,
  -- 資格・経験
  qualifications TEXT,
  years_of_experience INTEGER,
  qualification_certificate TEXT,
  experience_certificate TEXT,
  -- その他
  emergency_contact TEXT,
  emergency_contact_phone TEXT,
  memo TEXT,
  -- 給与
  monthly_salary NUMERIC,
  hourly_wage NUMERIC,
  -- 基本シフトパターン（週の曜日ごとのシフト有無、月～土の6日分）
  default_shift_pattern BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[],
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. スケジュールテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('AM', 'PM')),
  has_pickup BOOLEAN DEFAULT false,
  has_dropoff BOOLEAN DEFAULT false,
  staff_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 予約リクエストテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS booking_requests (
  id BIGSERIAL PRIMARY KEY,
  facility_id TEXT NOT NULL,
  child_name TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('追加希望', '欠席連絡')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. 利用実績テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  schedule_id BIGINT NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT NOT NULL,
  date DATE NOT NULL,
  -- サービス提供の状況
  service_status TEXT NOT NULL CHECK (service_status IN ('利用', '欠席(加算なし)', '加算のみ')),
  -- 提供形態
  provision_form TEXT,
  -- 計画時間
  planned_start_time TIME,
  planned_end_time TIME,
  planned_time_one_minute_interval BOOLEAN DEFAULT false,
  -- 開始終了時間
  actual_start_time TIME,
  actual_end_time TIME,
  actual_time_one_minute_interval BOOLEAN DEFAULT false,
  -- 算定時間数
  calculated_time NUMERIC NOT NULL DEFAULT 0,
  calculated_time_method TEXT NOT NULL CHECK (calculated_time_method IN ('計画時間から算出', '開始終了時間から算出', '手動入力')),
  -- 時間区分
  time_category TEXT,
  -- 送迎迎え
  pickup TEXT NOT NULL CHECK (pickup IN ('なし', 'あり')),
  pickup_same_premises BOOLEAN DEFAULT false,
  -- 送迎送り
  dropoff TEXT NOT NULL CHECK (dropoff IN ('なし', 'あり')),
  dropoff_same_premises BOOLEAN DEFAULT false,
  -- 部屋
  room TEXT,
  -- 指導形態
  instruction_form TEXT,
  -- 請求対象
  billing_target TEXT NOT NULL CHECK (billing_target IN ('請求する', '請求しない')),
  -- 自費項目
  self_pay_item TEXT,
  -- メモ
  memo TEXT,
  -- 実績記録票備考
  record_sheet_remarks TEXT,
  -- 加算情報
  addon_items TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. リードテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  -- 基本情報
  name TEXT NOT NULL,
  child_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('new-inquiry', 'visit-scheduled', 'considering', 'waiting-benefit', 'contract-progress', 'contracted', 'lost')),
  -- 連絡先
  phone TEXT,
  email TEXT,
  address TEXT,
  -- 見込み情報
  expected_start_date DATE,
  -- 利用希望
  preferred_days TEXT[] DEFAULT ARRAY[]::TEXT[],
  pickup_option TEXT CHECK (pickup_option IN ('required', 'preferred', 'not-needed')),
  -- 問い合わせ経路
  inquiry_source TEXT CHECK (inquiry_source IN ('devnavi', 'homepage', 'support-office', 'other')),
  inquiry_source_detail TEXT,
  -- 関連児童ID
  child_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- メモ
  memo TEXT,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. シフトテーブル（将来使用）
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('早番', '遅番', '日勤', '休み')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- インデックスの作成
-- ============================================

-- 施設情報設定
CREATE INDEX IF NOT EXISTS idx_facility_settings_facility_id ON facility_settings(facility_id);

-- 児童
CREATE INDEX IF NOT EXISTS idx_children_facility_id ON children(facility_id);
CREATE INDEX IF NOT EXISTS idx_children_contract_status ON children(contract_status);

-- スタッフ
CREATE INDEX IF NOT EXISTS idx_staff_facility_id ON staff(facility_id);

-- スケジュール
CREATE INDEX IF NOT EXISTS idx_schedules_facility_id ON schedules(facility_id);
CREATE INDEX IF NOT EXISTS idx_schedules_facility_date ON schedules(facility_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_child_id ON schedules(child_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

-- 予約リクエスト
CREATE INDEX IF NOT EXISTS idx_booking_requests_facility_id ON booking_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_date ON booking_requests(date);

-- 利用実績
CREATE INDEX IF NOT EXISTS idx_usage_records_facility_id ON usage_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_schedule_id ON usage_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_child_id ON usage_records(child_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_date ON usage_records(date);

-- リード
CREATE INDEX IF NOT EXISTS idx_leads_facility_id ON leads(facility_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- シフト
CREATE INDEX IF NOT EXISTS idx_shifts_facility_id ON shifts(facility_id);
CREATE INDEX IF NOT EXISTS idx_shifts_facility_date ON shifts(facility_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);

-- ============================================
-- 更新日時の自動更新トリガー関数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER update_facility_settings_updated_at BEFORE UPDATE ON facility_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_requests_updated_at BEFORE UPDATE ON booking_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_records_updated_at BEFORE UPDATE ON usage_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) の設定
-- ============================================
-- 注意: 本番環境では適切なRLSポリシーを設定してください
-- 現在は開発用に全テーブルでRLSを有効化していますが、ポリシーは設定していません

-- ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE children ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'KidOSデータベースセットアップが完了しました！';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  - facility_settings';
  RAISE NOTICE '  - children';
  RAISE NOTICE '  - staff';
  RAISE NOTICE '  - schedules';
  RAISE NOTICE '  - booking_requests';
  RAISE NOTICE '  - usage_records';
  RAISE NOTICE '  - leads';
  RAISE NOTICE '  - shifts';
END $$;

