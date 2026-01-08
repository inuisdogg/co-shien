-- usersテーブルに姓名、生年月日、性別のカラムを追加

-- 姓と名を分けて管理
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT;

-- 生年月日
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 性別（'male', 'female', 'other'）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));

-- 既存のnameカラムから姓名を分離するためのコメント
-- 既存データがある場合、nameカラムの値をlast_nameにコピー（後で手動で分離する必要がある）
-- UPDATE users SET last_name = name WHERE last_name IS NULL AND name IS NOT NULL;

