-- usersテーブルにフリガナ（姓・名）のカラムを追加

-- 姓のフリガナ
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_name_kana TEXT;

-- 名のフリガナ
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name_kana TEXT;

