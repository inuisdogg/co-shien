-- 施設のオーナー（マスター管理者）を追加
-- このユーザーは施設の作成者であり、ダッシュボードへのアクセス権を常に持つ

-- facilitiesテーブルにowner_user_idカラムを追加
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id);

-- コメント追加
COMMENT ON COLUMN facilities.owner_user_id IS '施設のオーナー（マスター管理者）のユーザーID。このユーザーはダッシュボードに常にアクセス可能';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facilities_owner_user_id ON facilities(owner_user_id);

-- 既存の施設について、employment_recordsで最初に登録された管理者をオーナーとして設定
-- （新規施設作成時は作成者が自動的にオーナーになる）
UPDATE facilities f
SET owner_user_id = (
  SELECT er.user_id
  FROM employment_records er
  WHERE er.facility_id = f.id
    AND er.role = '管理者'
    AND er.end_date IS NULL
  ORDER BY er.start_date ASC, er.created_at ASC
  LIMIT 1
)
WHERE f.owner_user_id IS NULL;

-- dev施設のオーナーをdev-staff-user-001に設定（開発用、ユーザーが存在する場合のみ）
UPDATE facilities
SET owner_user_id = 'dev-staff-user-001'
WHERE id = 'facility-demo-001'
  AND owner_user_id IS NULL
  AND EXISTS (SELECT 1 FROM users WHERE id = 'dev-staff-user-001');
