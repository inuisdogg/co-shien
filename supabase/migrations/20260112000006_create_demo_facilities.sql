-- 施設のデモデータを作成（3件）

INSERT INTO facilities (id, name, code, created_at, updated_at)
VALUES
  ('facility-demo-001', 'サンプル児童発達支援施設A', 'FAC001', NOW(), NOW()),
  ('facility-demo-002', 'サンプル児童発達支援施設B', 'FAC002', NOW(), NOW()),
  ('facility-demo-003', 'サンプル児童発達支援施設C', 'FAC003', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- コメント追加
COMMENT ON TABLE facilities IS '施設（事業所）情報。デモデータとして3件の施設を作成済み。';

