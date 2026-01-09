-- ============================================
-- 既存のstaffテーブルのスタッフをusersテーブルに移行するマイグレーション
-- ============================================
-- 既存のstaffテーブルのスタッフが独立した個人アカウント（usersテーブル）を持てるようにする
-- これにより、退職後も個人アカウントとしてキャリアを蓄積できる

-- ============================================
-- 1. 既存のstaffテーブルのスタッフで、user_idがNULLのものを確認
-- ============================================

-- まず、既存のstaffテーブルのスタッフで、まだusersテーブルにアカウントがないものを
-- usersテーブルに作成する

-- staffテーブルのスタッフをusersテーブルに移行
-- 注意: emailまたはphoneが重複している場合は、既存のusersレコードと紐付ける

INSERT INTO users (
  id,
  name,
  email,
  phone,
  account_status,
  role,
  facility_id,
  has_account,
  created_at,
  updated_at
)
SELECT DISTINCT ON (s.email, s.phone)
  gen_random_uuid()::TEXT,
  s.name,
  s.email,
  s.phone,
  'pending'::TEXT, -- パスワード未設定のためpending
  CASE 
    WHEN s.role = 'マネージャー' THEN 'manager'
    ELSE 'staff'
  END,
  s.facility_id, -- 後方互換性のため一時的に保持
  false, -- パスワード未設定のためfalse
  s.created_at,
  s.updated_at
FROM staff s
WHERE s.user_id IS NULL
  AND NOT EXISTS (
    -- 既に同じemailまたはphoneでusersテーブルにアカウントが存在する場合はスキップ
    SELECT 1 FROM users u
    WHERE (u.email IS NOT NULL AND u.email = s.email AND s.email IS NOT NULL)
       OR (u.phone IS NOT NULL AND u.phone = s.phone AND s.phone IS NOT NULL)
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. staffテーブルのuser_idを更新
-- ============================================

-- emailまたはphoneでマッチングして、staffテーブルのuser_idを更新
UPDATE staff s
SET user_id = u.id
FROM users u
WHERE s.user_id IS NULL
  AND (
    (u.email IS NOT NULL AND u.email = s.email AND s.email IS NOT NULL)
    OR (u.phone IS NOT NULL AND u.phone = s.phone AND s.phone IS NOT NULL)
  )
  AND u.account_status = 'pending'; -- 今回作成したアカウントのみ

-- ============================================
-- 3. employment_recordsテーブルに所属関係を作成
-- ============================================

-- staffテーブルとusersテーブルが紐付いたスタッフについて、
-- employment_recordsテーブルに所属関係を作成

INSERT INTO employment_records (
  id,
  user_id,
  facility_id,
  start_date,
  end_date,
  role,
  employment_type,
  permissions,
  experience_verification_status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid()::TEXT,
  s.user_id,
  s.facility_id,
  s.created_at::DATE, -- スタッフ登録日を開始日とする
  NULL, -- 現在も在籍中と仮定
  CASE 
    WHEN s.role = 'マネージャー' THEN 'マネージャー'
    ELSE '一般スタッフ'
  END,
  CASE 
    WHEN s.type = '常勤' THEN '常勤'
    WHEN s.type = '非常勤' THEN '非常勤'
    ELSE '常勤' -- デフォルト値
  END,
  '{}'::JSONB, -- デフォルトの権限
  'not_requested', -- 実務経験証明は未申請
  s.created_at,
  s.updated_at
FROM staff s
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (
    -- 既に同じuser_idとfacility_idの組み合わせでemployment_recordsが存在する場合はスキップ
    SELECT 1 FROM employment_records er
    WHERE er.user_id = s.user_id
      AND er.facility_id = s.facility_id
      AND er.end_date IS NULL
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. 完了メッセージ
-- ============================================

DO $$
DECLARE
  v_staff_count INTEGER;
  v_users_created INTEGER;
  v_employment_records_created INTEGER;
BEGIN
  -- 統計情報を取得
  SELECT COUNT(*) INTO v_staff_count FROM staff WHERE user_id IS NULL;
  SELECT COUNT(*) INTO v_users_created FROM users WHERE account_status = 'pending' AND created_at >= NOW() - INTERVAL '1 minute';
  SELECT COUNT(*) INTO v_employment_records_created FROM employment_records WHERE created_at >= NOW() - INTERVAL '1 minute';
  
  RAISE NOTICE '既存スタッフの個人アカウント移行が完了しました！';
  RAISE NOTICE '';
  RAISE NOTICE '移行結果:';
  RAISE NOTICE '  - まだuser_idが設定されていないスタッフ: % 人', v_staff_count;
  RAISE NOTICE '  - 作成されたusersアカウント: % 件', v_users_created;
  RAISE NOTICE '  - 作成されたemployment_records: % 件', v_employment_records_created;
  RAISE NOTICE '';
  RAISE NOTICE '注意事項:';
  RAISE NOTICE '  1. 作成されたusersアカウントは「pending」ステータスです';
  RAISE NOTICE '  2. スタッフが初回ログイン時にパスワードを設定すると「active」になります';
  RAISE NOTICE '  3. 退職後も個人アカウントとして残り、キャリアを蓄積できます';
END $$;








