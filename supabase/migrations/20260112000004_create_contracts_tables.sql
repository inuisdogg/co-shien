-- 契約管理テーブルと招待管理テーブルを作成

-- contractsテーブル（契約管理）
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'terminated', 'rejected')) DEFAULT 'pending',
  contract_start_date DATE,
  contract_end_date DATE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT REFERENCES users(id),
  terminated_at TIMESTAMPTZ,
  terminated_by TEXT REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 一児童につき、同じ施設とのアクティブな契約は1つのみ
  CONSTRAINT unique_active_contract UNIQUE(child_id, facility_id) 
    DEFERRABLE INITIALLY DEFERRED
);

-- 部分インデックス（アクティブな契約のみ）
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_active_unique 
  ON contracts(child_id, facility_id) 
  WHERE status = 'active';

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_contracts_child_id ON contracts(child_id);
CREATE INDEX IF NOT EXISTS idx_contracts_facility_id ON contracts(facility_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- RLS（Row Level Security）の設定
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- contract_invitationsテーブル（招待管理）
CREATE TABLE IF NOT EXISTS contract_invitations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children(id) ON DELETE CASCADE, -- 既存児童の場合
  email TEXT NOT NULL, -- 招待先のメールアドレス
  invitation_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by TEXT NOT NULL REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  accepted_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_contract_invitations_token ON contract_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_contract_invitations_email ON contract_invitations(email);
CREATE INDEX IF NOT EXISTS idx_contract_invitations_facility_id ON contract_invitations(facility_id);

-- RLS（Row Level Security）の設定
ALTER TABLE contract_invitations ENABLE ROW LEVEL SECURITY;

-- コメント追加
COMMENT ON TABLE contracts IS '児童と施設の契約管理テーブル';
COMMENT ON TABLE contract_invitations IS '施設から利用者への招待管理テーブル';

