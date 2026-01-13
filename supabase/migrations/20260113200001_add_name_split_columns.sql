-- ============================================
-- 姓名分離カラムの追加
-- staff, children テーブルに姓・名を分けて保存
-- ============================================

-- ============================================
-- 1. staff テーブルに姓名カラム追加
-- ============================================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_name_kana TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS first_name_kana TEXT;

COMMENT ON COLUMN staff.last_name IS '姓';
COMMENT ON COLUMN staff.first_name IS '名';
COMMENT ON COLUMN staff.last_name_kana IS '姓（カナ）';
COMMENT ON COLUMN staff.first_name_kana IS '名（カナ）';

-- ============================================
-- 2. children テーブルに姓名カラム追加
-- ============================================
ALTER TABLE children ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS last_name_kana TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS first_name_kana TEXT;

-- 保護者の姓名分離
ALTER TABLE children ADD COLUMN IF NOT EXISTS guardian_last_name TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS guardian_first_name TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS guardian_last_name_kana TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS guardian_first_name_kana TEXT;

COMMENT ON COLUMN children.last_name IS '児童の姓';
COMMENT ON COLUMN children.first_name IS '児童の名';
COMMENT ON COLUMN children.last_name_kana IS '児童の姓（カナ）';
COMMENT ON COLUMN children.first_name_kana IS '児童の名（カナ）';
COMMENT ON COLUMN children.guardian_last_name IS '保護者の姓';
COMMENT ON COLUMN children.guardian_first_name IS '保護者の名';
COMMENT ON COLUMN children.guardian_last_name_kana IS '保護者の姓（カナ）';
COMMENT ON COLUMN children.guardian_first_name_kana IS '保護者の名（カナ）';

-- ============================================
-- 3. 名前分割関数を作成
-- スペース（全角・半角）で分割し、最初を姓、残りを名とする
-- ============================================
CREATE OR REPLACE FUNCTION split_japanese_name(full_name TEXT)
RETURNS TABLE(last_name TEXT, first_name TEXT) AS $$
DECLARE
  cleaned_name TEXT;
  parts TEXT[];
BEGIN
  IF full_name IS NULL OR full_name = '' THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 全角スペースを半角に統一し、連続スペースを1つに
  cleaned_name := regexp_replace(full_name, '[\s　]+', ' ', 'g');
  cleaned_name := trim(cleaned_name);

  -- スペースで分割
  parts := string_to_array(cleaned_name, ' ');

  IF array_length(parts, 1) >= 2 THEN
    -- 2つ以上に分割できた場合、最初を姓、残りを名
    RETURN QUERY SELECT parts[1], array_to_string(parts[2:], ' ');
  ELSE
    -- 分割できない場合、全体を姓として扱う
    RETURN QUERY SELECT cleaned_name, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 4. 既存データの自動分割（staff）
-- ============================================
UPDATE staff s
SET
  last_name = split.last_name,
  first_name = split.first_name
FROM (
  SELECT id, (split_japanese_name(name)).*
  FROM staff
  WHERE name IS NOT NULL AND last_name IS NULL
) split
WHERE s.id = split.id;

-- name_kana の分割
UPDATE staff s
SET
  last_name_kana = split.last_name,
  first_name_kana = split.first_name
FROM (
  SELECT id, (split_japanese_name(name_kana)).*
  FROM staff
  WHERE name_kana IS NOT NULL AND last_name_kana IS NULL
) split
WHERE s.id = split.id;

-- ============================================
-- 5. 既存データの自動分割（children）
-- ============================================
-- 児童名の分割
UPDATE children c
SET
  last_name = split.last_name,
  first_name = split.first_name
FROM (
  SELECT id, (split_japanese_name(name)).*
  FROM children
  WHERE name IS NOT NULL AND last_name IS NULL
) split
WHERE c.id = split.id;

-- 児童名カナの分割
UPDATE children c
SET
  last_name_kana = split.last_name,
  first_name_kana = split.first_name
FROM (
  SELECT id, (split_japanese_name(name_kana)).*
  FROM children
  WHERE name_kana IS NOT NULL AND last_name_kana IS NULL
) split
WHERE c.id = split.id;

-- 保護者名の分割
UPDATE children c
SET
  guardian_last_name = split.last_name,
  guardian_first_name = split.first_name
FROM (
  SELECT id, (split_japanese_name(guardian_name)).*
  FROM children
  WHERE guardian_name IS NOT NULL AND guardian_last_name IS NULL
) split
WHERE c.id = split.id;

-- 保護者名カナの分割
UPDATE children c
SET
  guardian_last_name_kana = split.last_name,
  guardian_first_name_kana = split.first_name
FROM (
  SELECT id, (split_japanese_name(guardian_name_kana)).*
  FROM children
  WHERE guardian_name_kana IS NOT NULL AND guardian_last_name_kana IS NULL
) split
WHERE c.id = split.id;

-- ============================================
-- 6. 今後の入力時に自動分割するトリガー
-- ============================================

-- staff用トリガー関数
CREATE OR REPLACE FUNCTION auto_split_staff_name()
RETURNS TRIGGER AS $$
BEGIN
  -- nameが変更され、かつlast_name/first_nameが設定されていない場合に自動分割
  IF NEW.name IS NOT NULL AND (NEW.last_name IS NULL OR NEW.first_name IS NULL) THEN
    SELECT * INTO NEW.last_name, NEW.first_name FROM split_japanese_name(NEW.name);
  END IF;

  IF NEW.name_kana IS NOT NULL AND (NEW.last_name_kana IS NULL OR NEW.first_name_kana IS NULL) THEN
    SELECT * INTO NEW.last_name_kana, NEW.first_name_kana FROM split_japanese_name(NEW.name_kana);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_split_staff_name ON staff;
CREATE TRIGGER trigger_auto_split_staff_name
  BEFORE INSERT OR UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION auto_split_staff_name();

-- children用トリガー関数
CREATE OR REPLACE FUNCTION auto_split_children_name()
RETURNS TRIGGER AS $$
BEGIN
  -- 児童名
  IF NEW.name IS NOT NULL AND (NEW.last_name IS NULL OR NEW.first_name IS NULL) THEN
    SELECT * INTO NEW.last_name, NEW.first_name FROM split_japanese_name(NEW.name);
  END IF;

  IF NEW.name_kana IS NOT NULL AND (NEW.last_name_kana IS NULL OR NEW.first_name_kana IS NULL) THEN
    SELECT * INTO NEW.last_name_kana, NEW.first_name_kana FROM split_japanese_name(NEW.name_kana);
  END IF;

  -- 保護者名
  IF NEW.guardian_name IS NOT NULL AND (NEW.guardian_last_name IS NULL OR NEW.guardian_first_name IS NULL) THEN
    SELECT * INTO NEW.guardian_last_name, NEW.guardian_first_name FROM split_japanese_name(NEW.guardian_name);
  END IF;

  IF NEW.guardian_name_kana IS NOT NULL AND (NEW.guardian_last_name_kana IS NULL OR NEW.guardian_first_name_kana IS NULL) THEN
    SELECT * INTO NEW.guardian_last_name_kana, NEW.guardian_first_name_kana FROM split_japanese_name(NEW.guardian_name_kana);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_split_children_name ON children;
CREATE TRIGGER trigger_auto_split_children_name
  BEFORE INSERT OR UPDATE ON children
  FOR EACH ROW
  EXECUTE FUNCTION auto_split_children_name();
