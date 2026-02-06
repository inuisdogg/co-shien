-- Supabase Auth ユーザーを全て削除
-- 警告: これは認証済みユーザーを全て削除します

-- auth.usersテーブルからすべてのユーザーを削除
DELETE FROM auth.users;

-- system_configもリセット（オーナー未登録状態に戻す）
DELETE FROM system_config WHERE key = 'owner_setup_completed';
