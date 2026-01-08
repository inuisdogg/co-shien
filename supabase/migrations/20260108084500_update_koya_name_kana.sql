-- koya.htk@gmail.com のフリガナを更新
UPDATE users 
SET 
  last_name_kana = 'ハタケ',
  first_name_kana = 'コウヤ',
  updated_at = NOW()
WHERE email = 'koya.htk@gmail.com';

