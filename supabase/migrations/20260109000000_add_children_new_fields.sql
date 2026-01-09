-- 児童テーブルに新しいフィールドを追加
-- 生年月日、利用パターン（曜日配列）、送迎場所（自由記入）、特性・メモ

-- childrenテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  age INTEGER,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  guardian_name TEXT,
  guardian_name_kana TEXT,
  guardian_relationship TEXT,
  beneficiary_number TEXT,
  grant_days INTEGER,
  contract_days INTEGER,
  address TEXT,
  phone TEXT,
  email TEXT,
  doctor_name TEXT,
  doctor_clinic TEXT,
  school_name TEXT,
  pattern TEXT,
  pattern_days JSONB,
  needs_pickup BOOLEAN DEFAULT false,
  needs_dropoff BOOLEAN DEFAULT false,
  pickup_location TEXT,
  pickup_location_custom TEXT,
  dropoff_location TEXT,
  dropoff_location_custom TEXT,
  characteristics TEXT,
  contract_status TEXT NOT NULL DEFAULT 'active' CHECK (contract_status IN ('pre-contract', 'active', 'inactive', 'terminated')),
  contract_start_date DATE,
  contract_end_date DATE,
  enrollment_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS pattern_days JSONB,
ADD COLUMN IF NOT EXISTS pickup_location_custom TEXT,
ADD COLUMN IF NOT EXISTS dropoff_location_custom TEXT,
ADD COLUMN IF NOT EXISTS characteristics TEXT;

-- 既存のpattern_daysがNULLの場合、pattern文字列から推測して設定（オプション）
-- これは既存データの移行用（必要に応じて実行）

COMMENT ON COLUMN children.birth_date IS '生年月日';
COMMENT ON COLUMN children.pattern_days IS '基本利用パターン（曜日の配列: 0=日, 1=月, ..., 6=土）';
COMMENT ON COLUMN children.pickup_location_custom IS '乗車地（自由記入）';
COMMENT ON COLUMN children.dropoff_location_custom IS '降車地（自由記入）';
COMMENT ON COLUMN children.characteristics IS '特性・メモ';

