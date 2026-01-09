-- パスワードが設定されていないアカウントが作成されないようにする
-- account_statusが'active'の場合は、password_hashが必須

-- 既存のアクティブなアカウントでパスワードがないものを確認（警告のみ）
DO $$
DECLARE
  passwordless_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO passwordless_count
  FROM users
  WHERE account_status = 'active' AND password_hash IS NULL;
  
  IF passwordless_count > 0 THEN
    RAISE WARNING 'パスワードが設定されていないアクティブなアカウントが % 件あります。これらのアカウントはログインできません。', passwordless_count;
  END IF;
END $$;

-- 関数: パスワードが設定されているかチェック
CREATE OR REPLACE FUNCTION check_password_required()
RETURNS TRIGGER AS $$
BEGIN
  -- account_statusが'active'の場合、password_hashが必須
  IF NEW.account_status = 'active' AND NEW.password_hash IS NULL THEN
    RAISE EXCEPTION 'アクティブなアカウントにはパスワードが必要です。password_hashを設定してください。';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー: INSERT時
DROP TRIGGER IF EXISTS users_check_password_on_insert ON users;
CREATE TRIGGER users_check_password_on_insert
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION check_password_required();

-- トリガー: UPDATE時（account_statusが'active'に変更される場合）
DROP TRIGGER IF EXISTS users_check_password_on_update ON users;
CREATE TRIGGER users_check_password_on_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.account_status = 'active' AND (OLD.account_status != 'active' OR OLD.password_hash IS NULL))
  EXECUTE FUNCTION check_password_required();

-- コメント追加
COMMENT ON FUNCTION check_password_required() IS 'アクティブなアカウントにはパスワードが必要であることをチェックする関数';
COMMENT ON TRIGGER users_check_password_on_insert ON users IS '新規ユーザー作成時にパスワードをチェック';
COMMENT ON TRIGGER users_check_password_on_update ON users IS 'アカウントをアクティブにする際にパスワードをチェック';

