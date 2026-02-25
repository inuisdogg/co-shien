# 利用者アカウント主導型モデルへの移行要件定義

## 1. 目的と背景

### 現状の問題点

- **施設アカウント主導型**: 施設が児童情報を「所有」しており、施設を辞めるとデータが分断される
- **データ移行の困難**: 児童が別の施設に移った場合、データの引き継ぎが手動で複雑
- **実地指導における証明の困難**: 契約関係の正当性を証明するための証跡が不足

### 目標

- **生涯にわたる支援記録の蓄積**: 児童（または保護者）が「利用者アカウント」を所有し、施設と「契約紐付け」を行う形にすることで、転院や施設変更に関わらずデータが継続的に蓄積される
- **実地指導における契約関係の正当性証明**: 「いつ、誰（保護者）の同意を得て、データ利用を開始したか」の証跡を自動保存し、監査に対応できる
- **データ主導権の明確化**: 利用者側が自分のデータを管理し、どの施設に開示するかを選択できる

## 2. アカウント構造の再定義

### 2.1 アカウント種別と役割

既存の `profiles` テーブルを拡張、または「種別（Role）」で切り分けます。

| アカウント種別 | 主体 | 役割 |
|---|---|---|
| **スタッフアカウント** | 職員・管理者 | 勤怠、支援記録の入力、施設運営 |
| **利用者アカウント** | 児童・保護者 | 支援記録の閲覧、契約同意、欠席連絡 |
| **児童プロファイル** | 児童本人 | 氏名、受給者証番号、特性等の「実データ」 |

### 2.2 データ相関図

```
利用者アカウント (1) ── (n) 児童プロファイル
                         （兄弟利用を想定）

児童プロファイル (n) ── (n) 施設アカウント
                         （併用・転院を想定）
```

- **1対多**: 1人の保護者アカウントが複数の児童プロファイルを所有（兄弟利用）
- **多対多**: 1人の児童が複数の施設と契約（併用・転院）

## 3. 利用者登録・施設紐付けフロー（UXデザイン）

### 3.1 設計原則

**「施設が勝手に登録する」のではなく、「利用者がアカウントを作り、施設にアクセス権を付与する」という流れ**

### 3.2 ステップ1：利用者アカウント作成

1. **保護者が roots.inu.co.jp/career（または利用者専用入口）で個人アカウントを作成**
   - メールアドレス認証
   - パスワード設定
   - 基本情報入力（保護者名、電話番号など）

2. **メール認証完了後、アプリ内で「児童情報（プロファイル）」を登録**
   - 児童の氏名
   - 生年月日
   - 受給者証番号
   - 特性・支援内容などの情報

### 3.3 ステップ2：施設との契約紐付け

#### パターンA：利用者からの申請

1. **申請**: 保護者がアプリから「施設ID（または事業所番号）」を検索し、利用申請を送る
2. **承認**: 施設側（Biz画面）に「利用申請」が届き、管理者が承認することで、初めて施設側からその児童の支援記録が書けるようになる

#### パターンB：施設からの招待

1. **招待URLの発行**: 施設側が「招待URL」を発行し、保護者にメール（Resend使用）で送信
2. **承認**: 保護者がそのURLを踏んでログインし、承認することで契約が成立
3. **承認後**: 施設側からその児童の支援記録が書けるようになる

## 4. 機能要件

### 4.1 Biz（事業所）側機能

#### A. 利用者承認管理

- **利用申請の受付**: 届いた利用申請の一覧表示
- **申請内容の確認**: 児童プロファイル情報、受給者証の有効期限チェック
- **承認・却下処理**: 管理者による承認/却下操作
- **通知**: 承認・却下時に保護者へメール通知（Resend使用）

#### B. 記録権限の制御

- **契約期間外の自動遮断**: 契約終了日を過ぎた児童のデータへのアクセスを自動的に遮断（個人情報保護）
- **権限付与の制限**: 契約ステータスが `active` の児童のみ、支援記録の入力が可能
- **閲覧制限**: 未契約・契約終了の児童は一覧に非表示、または閲覧制限をかける

#### C. 監査用ログ

- **契約履歴の記録**: 「いつ、誰（保護者）の同意を得て、データ利用を開始したか」の証跡を自動保存
- **アクセスログ**: 支援記録へのアクセス履歴（必要に応じて）
- **契約変更履歴**: 契約期間の変更、契約終了などの履歴を記録

#### D. 児童一覧画面の改修

- **契約ステータス表示**: 各児童の契約ステータス（pending / active / terminated）を表示
- **フィルタリング**: 契約中のみ表示、未承認のみ表示などのフィルタ機能
- **契約期間表示**: 契約開始日・終了日を表示

### 4.2 Personal / Client（利用者）側機能

#### A. マイページ

- **児童プロファイル管理**: 自分の子供のプロファイル情報の登録・編集
- **支援記録の閲覧**: 自分の子供の支援記録（公開設定されたもの）の閲覧
- **履歴表示**: 過去の支援記録のタイムライン表示

#### B. 契約管理

- **契約一覧**: 現在どの施設に自分のデータを開示しているかの一覧表示
- **契約詳細**: 各契約の開始日・終了日、施設情報の表示
- **契約終了申請**: 施設との契約を終了する申請機能

#### C. 施設との連携機能

- **施設検索**: 施設IDや事業所番号で施設を検索
- **利用申請**: 検索した施設への利用申請送信
- **招待承認**: 施設からの招待URLを受け取って承認

#### D. バイタル・連絡事項

- **体温入力**: 施設へ行く前の体温や健康状態の入力
- **欠席連絡**: 当日の欠席連絡機能
- **緊急連絡**: 施設への緊急連絡機能（今後の拡張）

## 5. データベーススキーマ変更案

### 5.1 既存テーブルの拡張

#### `profiles` / `users` テーブル

```sql
-- user_type カラムを追加
ALTER TABLE profiles 
ADD COLUMN user_type TEXT CHECK (user_type IN ('staff', 'client')) DEFAULT 'staff';

-- 既存データの移行（すべて 'staff' として設定）
UPDATE profiles SET user_type = 'staff' WHERE user_type IS NULL;
```

または、既存の `role` カラムを活用する場合：

- `role = 'admin'` または `role = 'staff'` → スタッフアカウント
- `role = 'client'` または `role = 'parent'` → 利用者アカウント

#### `children` テーブル

```sql
-- owner_profile_id（保護者アカウント）との紐付けを追加
ALTER TABLE children 
ADD COLUMN owner_profile_id TEXT REFERENCES profiles(id);

-- 既存の facility_id は維持（後方互換性のため、段階的に移行）
-- 将来的には facility_id を削除し、contracts テーブル経由でのみ紐付け
```

### 5.2 新設テーブル

#### `contracts` テーブル（契約管理）

```sql
CREATE TABLE contracts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'terminated', 'rejected')) DEFAULT 'pending',
  contract_start_date DATE,
  contract_end_date DATE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT REFERENCES profiles(id),
  terminated_at TIMESTAMPTZ,
  terminated_by TEXT REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 一児童につき、同じ施設とのアクティブな契約は1つのみ
  UNIQUE(child_id, facility_id) WHERE status = 'active'
);

-- インデックスの作成
CREATE INDEX idx_contracts_child_id ON contracts(child_id);
CREATE INDEX idx_contracts_facility_id ON contracts(facility_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_active ON contracts(child_id, facility_id) WHERE status = 'active';

-- RLS（Row Level Security）の設定
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
```

#### `contract_invitations` テーブル（招待管理）

```sql
CREATE TABLE contract_invitations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children(id) ON DELETE CASCADE, -- 既存児童の場合
  email TEXT NOT NULL, -- 招待先のメールアドレス
  invitation_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by TEXT NOT NULL REFERENCES profiles(id),
  accepted_at TIMESTAMPTZ,
  accepted_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX idx_contract_invitations_token ON contract_invitations(invitation_token);
CREATE INDEX idx_contract_invitations_email ON contract_invitations(email);
CREATE INDEX idx_contract_invitations_facility_id ON contract_invitations(facility_id);

-- RLS（Row Level Security）の設定
ALTER TABLE contract_invitations ENABLE ROW LEVEL SECURITY;
```

### 5.3 監査ログテーブル（オプション）

#### `contract_audit_logs` テーブル

```sql
CREATE TABLE contract_audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'terminated', 'updated')),
  performed_by TEXT NOT NULL REFERENCES profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT
);

-- インデックスの作成
CREATE INDEX idx_contract_audit_logs_contract_id ON contract_audit_logs(contract_id);
CREATE INDEX idx_contract_audit_logs_performed_at ON contract_audit_logs(performed_at);
```

## 6. 実装手順と考慮事項

### 6.1 影響範囲の分析（実装前に必須）

以下の既存ロジックへの影響を分析してください：

1. **支援記録の入力・閲覧機能**
   - 現在、施設側が直接児童を選択して記録を入力している箇所
   - 契約ステータスチェックを追加する必要がある

2. **児童一覧・検索機能**
   - 現在、`facility_id` で直接児童を取得している箇所
   - `contracts` テーブル経由で取得するように変更する必要がある

3. **認証・認可ロジック**
   - 現在の `AuthContext` や `middleware.ts` での権限チェック
   - 利用者アカウントとスタッフアカウントの区別を追加

4. **データ移行**
   - 既存の児童データが `facility_id` で紐付いている場合の移行方法
   - 段階的な移行戦略の検討

### 6.2 実装フェーズ

#### フェーズ1：スキーマ拡張とデータ移行準備

1. `profiles` / `users` に `user_type` を追加
2. `contracts` テーブルを作成
3. `contract_invitations` テーブルを作成
4. 既存データの移行スクリプト作成

#### フェーズ2：利用者アカウント作成機能

1. Personal側のサインアップフロー改修
2. 児童プロファイル登録機能の実装
3. 保護者アカウントと児童プロファイルの紐付け

#### フェーズ3：契約紐付けフロー

1. 施設側からの招待機能（招待URL生成、メール送信）
2. 利用者側の招待承認機能
3. 利用者側からの申請機能
4. 施設側の承認機能

#### フェーズ4：権限制御の実装

1. 契約ステータスに基づく権限制御の実装
2. 支援記録入力時の契約チェック
3. 児童一覧画面のフィルタリング

#### フェーズ5：既存データの移行

1. 既存児童データの保護者アカウントへの紐付け
2. 既存の `facility_id` ベースの紐付けから `contracts` ベースへの移行

### 6.3 データ移行への配慮

#### 既存児童データの移行戦略

**オプション1：手動紐付け機能**

- Biz画面に「既存児童を保護者アカウントに紐付ける」機能を追加
- 保護者のメールアドレスを入力し、招待を送信
- 保護者が承認することで紐付けが完了

**オプション2：自動移行バッチ**

- 児童データに保護者のメールアドレスが既に登録されている場合
- 自動的に保護者アカウントを作成（または既存アカウントと紐付け）
- 初期契約を自動的に `active` ステータスで作成

**推奨：段階的移行**

1. 新規登録は利用者アカウント主導型で開始
2. 既存データは手動紐付け機能で段階的に移行
3. 全データ移行完了後、`children.facility_id` を削除

## 7. Claude Code への実装指示

### 7.1 実装前の分析タスク

以下の既存コードへの影響を分析し、影響範囲レポートを作成してください：

1. **児童データ取得ロジックの洗い出し**
   - `children` テーブルを直接 `facility_id` で取得している箇所の特定
   - APIエンドポイント、コンポーネント、フックなど

2. **支援記録入力ロジックの洗い出し**
   - 児童を選択して記録を入力する箇所の特定
   - 権限チェックの追加が必要な箇所

3. **認証・認可ロジックの分析**
   - 現在のユーザー種別判定ロジック
   - 利用者アカウントとスタッフアカウントの区別方法

### 7.2 実装タスク

#### DBスキーマの拡張

1. `profiles` に `user_type` を追加
2. `children` に `owner_profile_id` を追加
3. `contracts` テーブルを作成
4. `contract_invitations` テーブルを作成
5. 必要なインデックスとRLSポリシーを設定

#### 招待・申請フローの実装

1. **施設側からの招待機能**
   - Biz画面に「児童を招待」機能を追加
   - 招待URLを生成し、Resendを使用してメール送信
   - 招待トークンの有効期限管理

2. **利用者側の招待承認機能**
   - Personal側で招待URLを受け取り、ログイン後に承認
   - 児童プロファイルが未作成の場合は作成フローへ誘導
   - 承認後、`contracts` テーブルに `active` ステータスでレコード作成

3. **利用者側からの申請機能**
   - Personal側で施設を検索する機能
   - 施設への利用申請を送信（`contracts` テーブルに `pending` ステータスで作成）
   - 申請履歴の表示

4. **施設側の承認機能**
   - Biz画面に「利用申請一覧」画面を追加
   - 申請内容の確認（児童プロファイル、受給者証情報など）
   - 承認・却下処理
   - 承認/却下時に保護者へメール通知

#### Biz画面の改修

1. **児童一覧画面**
   - `contracts` テーブル経由で児童を取得するように変更
   - 契約ステータス（pending / active / terminated）を表示
   - 未契約・契約終了の児童は非表示または閲覧制限
   - フィルタリング機能（契約中のみ表示など）

2. **権限制御の実装**
   - 支援記録入力時、契約ステータスが `active` かチェック
   - 契約終了日を過ぎた児童へのアクセスを自動遮断
   - RLSポリシーの設定でデータベースレベルでも制御

#### Personal画面の実装

1. **マイページ**
   - 児童プロファイルの登録・編集機能
   - 支援記録の閲覧機能（公開設定されたもののみ）

2. **契約管理画面**
   - 現在の契約一覧表示
   - 契約詳細（施設情報、契約期間など）
   - 契約終了申請機能

3. **施設検索・申請機能**
   - 施設IDや事業所番号で施設を検索
   - 検索結果から施設への利用申請を送信

### 7.3 テスト要件

1. **契約フローのテスト**
   - 施設側からの招待 → 利用者側の承認
   - 利用者側からの申請 → 施設側の承認
   - 招待URLの有効期限切れ
   - 既に契約済みの場合のエラーハンドリング

2. **権限制御のテスト**
   - 契約中のみ支援記録が入力できること
   - 契約終了後はアクセスできないこと
   - 未承認の申請は閲覧できないこと

3. **データ移行のテスト**
   - 既存データの移行スクリプトの動作確認
   - 手動紐付け機能の動作確認

## 8. セキュリティ考慮事項

### 8.1 個人情報保護

- 契約期間外のデータアクセスを確実に遮断
- RLSポリシーによるデータベースレベルの制御
- 監査ログによるアクセス履歴の記録

### 8.2 招待トークンのセキュリティ

- 招待トークンは十分なエントロピーを持つランダム文字列
- トークンの有効期限を設定（例：7日間）
- 一度使用されたトークンは無効化

### 8.3 メール送信のセキュリティ

- Resendを使用したメール送信の実装
- メール内のリンクには適切なトークンを含める
- スパム対策として送信レート制限を考慮

## 9. 今後の拡張予定

### 9.1 短期（Phase 2）

- [ ] バイタル入力機能（体温、健康状態）
- [ ] 欠席連絡機能
- [ ] 契約期間の自動更新機能

### 9.2 中期（Phase 3）

- [ ] 支援記録の公開設定（保護者が閲覧可能な範囲を指定）
- [ ] 複数の保護者アカウントとの紐付け（両親など）
- [ ] 契約履歴の詳細表示

### 9.3 長期（Phase 4）

- [ ] データエクスポート機能（保護者側）
- [ ] 施設間でのデータ引継ぎ機能
- [ ] 支援記録の自動要約・分析機能

## 10. 参考資料

- [CAREER_PLATFORM_DESIGN.md](./CAREER_PLATFORM_DESIGN.md) - スタッフキャリアプラットフォームの設計（同様のアプローチ）
- [FACILITY_SETUP_EXPECTATIONS.md](./FACILITY_SETUP_EXPECTATIONS.md) - 施設セットアップの仕様
- [EMAIL_AUTH_IMPLEMENTATION.md](./EMAIL_AUTH_IMPLEMENTATION.md) - メール認証の実装詳細

---

**作成日**: 2025-01-XX  
**最終更新**: 2025-01-XX  
**ステータス**: 要件定義完了（実装待ち）

