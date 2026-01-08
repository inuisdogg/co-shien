-- koya.htk@gmail.com のユーザー情報を更新
-- まず既存のgender制約を確認し、必要に応じて更新

-- 既存のgender制約を削除（存在する場合）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check;

-- 新しい制約を追加
ALTER TABLE users 
ADD CONSTRAINT users_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));

-- koya.htk@gmail.com のユーザー情報を更新
UPDATE users 
SET 
  last_name = '畠',
  first_name = '昂哉',
  birth_date = '1995-06-19',
  gender = 'male',
  name = '畠 昂哉', -- 後方互換性のためnameも更新
  updated_at = NOW()
WHERE email = 'koya.htk@gmail.com';

