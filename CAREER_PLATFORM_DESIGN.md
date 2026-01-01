# キャリアプラットフォーム設計ドキュメント

## 概要

このドキュメントは、「事業所がスタッフを管理するツール」から「スタッフ個人がキャリアを持ち運べるプラットフォーム」への移行設計を説明します。

## コア概念

### 1. ハイブリッド・アカウント・モデル

- **事業所側**: 雇用予定のスタッフの基本情報（名前、メールアドレスまたは電話番号）を入力して「アカウントの種」を作成
- **スタッフ側**: ログイン（本人確認・パスワード設定）した時点で、そのアカウントの所有権は個人に移行
- **所属関係**: 事業所とスタッフは「所属関係（EmploymentRecord）」で紐付く

### 2. 実務経験証明のワークフロー化

- スタッフが自身の職歴に基づき、システム内で「過去に在籍した事業所」に対して「実務経験証明」の承認依頼をデジタルで送信
- 承認されたデータは「システム認証済み」のキャリアとして個人アカウントに蓄積
- 実地指導の際は、この「認証済みデータ」から公的な様式を自動生成して出力可能

### 3. データ所有権の分離

- **事業所が所有する業務データ**: 日報、勤怠、スケジュールなど
- **スタッフ個人が所有するキャリアデータ**: 資格、認証済み職歴など

## データベーススキーマ

### 主要テーブル

#### 1. users（個人アカウント）

```sql
- id: TEXT PRIMARY KEY
- email: TEXT
- name: TEXT NOT NULL
- phone: TEXT
- login_id: TEXT
- password_hash: TEXT
- account_status: TEXT ('pending', 'active', 'suspended')
- invited_by_facility_id: TEXT REFERENCES facilities(id)
- invited_at: TIMESTAMPTZ
- activated_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**変更点**:
- `facility_id`を削除（個人アカウントは事業所に依存しない）
- `account_status`を追加（pending/active/suspended）
- 招待関連のカラムを追加

#### 2. employment_records（所属関係）

```sql
- id: TEXT PRIMARY KEY
- user_id: TEXT REFERENCES users(id)
- facility_id: TEXT REFERENCES facilities(id)
- start_date: DATE NOT NULL
- end_date: DATE (NULLの場合は現在も在籍中)
- role: TEXT ('一般スタッフ', 'マネージャー', '管理者')
- employment_type: TEXT ('常勤', '非常勤')
- permissions: JSONB
- experience_verification_status: TEXT
- experience_verification_requested_at: TIMESTAMPTZ
- experience_verification_approved_at: TIMESTAMPTZ
- experience_verification_approved_by: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**新規テーブル**: ユーザーと事業所の所属関係を管理

#### 3. experience_verification_requests（実務経験証明依頼）

```sql
- id: TEXT PRIMARY KEY
- requester_user_id: TEXT REFERENCES users(id)
- employment_record_id: TEXT REFERENCES employment_records(id)
- approver_facility_id: TEXT REFERENCES facilities(id)
- approver_user_id: TEXT
- requested_period_start: DATE
- requested_period_end: DATE
- requested_role: TEXT
- status: TEXT ('pending', 'approved', 'rejected', 'expired')
- request_message: TEXT
- response_message: TEXT
- rejection_reason: TEXT
- digital_signature: TEXT
- signed_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- expires_at: TIMESTAMPTZ
```

**新規テーブル**: 実務経験証明のデジタルワークフロー

#### 4. user_careers（個人キャリアデータ）

```sql
- id: TEXT PRIMARY KEY
- user_id: TEXT REFERENCES users(id)
- qualification_name: TEXT NOT NULL
- qualification_type: TEXT
- issued_by: TEXT
- issued_date: DATE
- expiry_date: DATE
- certificate_url: TEXT
- verified_employment_record_id: TEXT REFERENCES employment_records(id)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**新規テーブル**: スタッフ個人が所有するキャリアデータ

## ワークフロー

### 1. スタッフ招待・アクティベーション

#### パターンA: 新規アカウント作成（個人アカウントを持っていない場合）

```
ステップ1: 事業所がスタッフを招待
  - 事業所は「名前」と「メールアドレス（または電話番号）」だけでスタッフを招待
  - システムがusersテーブルに「pending」状態で個人アカウントを作成
  - この時点では事業所に所属していない（employment_recordsは作成しない）
  - 招待トークンを生成してスタッフに送信

ステップ2: スタッフがアカウントを有効化
  - スタッフが招待リンクをクリック
  - パスワードを設定して個人アカウントを有効化
  - account_statusが「active」に更新
  - アカウント有効化時に、招待された事業所への所属関係（employment_records）を作成
  - これにより、個人アカウントが事業所のスタッフリストに追加される
```

#### パターンB: 既存の個人アカウントを事業所に追加

```
ステップ1: 事業所が既存の個人アカウントを検索
  - 事業所はメールアドレスまたは電話番号で既存の個人アカウントを検索
  - 既存の個人アカウントが見つかった場合、そのアカウントを事業所に追加

ステップ2: 所属関係を作成
  - 既存の個人アカウントに対して、新しい所属関係（employment_records）を作成
  - これにより、既存の個人アカウントが事業所のスタッフリストに追加される
  - 個人アカウントは独立したまま、複数の事業所に所属可能
```

#### パターンC: 個人アカウントが独立して存在

```
- スタッフは事業所に所属していなくても、独立した個人アカウントとして存在可能
- 個人アカウントは以下の情報を保持：
  - 基本情報（名前、メール、電話）
  - 資格情報（user_careersテーブル）
  - 認証済み職歴（承認済みのemployment_records）
- 事業所で働くタイミングになったときに、既存の個人アカウントを事業所に追加
```

### 2. 実務経験証明のワークフロー

```
ステップ1: スタッフが申請
  - 自身のキャリア画面で「A事業所に2022年〜2024年まで在籍した」というレコードを作成
  - 「承認依頼を送る」ボタンを押す
  - experience_verification_requestsテーブルにレコードを作成
  - 相手がシステム未導入ならメールで招待が飛ぶ

ステップ2: 元職場の管理者が承認
  - 管理画面に「証明依頼」が届く
  - 内容を確認し、ワンクリックでデジタル署名（承認）
  - experience_verification_requestsのstatusが「approved」に更新
  - employment_recordsのexperience_verification_statusが「approved」に更新

ステップ3: 結果
  - スタッフのプロフィールに「認証済みバッジ」がつく
  - 実地指導の際は、この「認証済みデータ」から公的な様式を自動生成して出力
```

## 実装ファイル

### マイグレーションSQL
- `migrate_to_career_platform.sql`: データベーススキーマの移行

### サービス層
- `src/utils/staffInvitationService.ts`: スタッフ招待・アクティベーション
- `src/utils/experienceVerificationService.ts`: 実務経験証明ワークフロー

### 型定義
- `src/types/index.ts`: TypeScript型定義（更新済み）

## 移行手順

### 1. データベースマイグレーション

```sql
-- migrate_to_career_platform.sqlを実行
-- 既存のusersテーブルのデータをバックアップ
-- 新しいテーブルを作成
-- 既存データをemployment_recordsに移行
```

### 2. 既存コードの更新

- 認証コンテキストの更新（個人アカウントベース）
- スタッフ管理画面の更新（招待機能の追加）
- キャリア画面の追加（スタッフ個人のキャリア管理）

### 3. 段階的移行

- 既存のstaffテーブルは後方互換性のため保持
- 新しい機能は段階的に追加
- 既存ユーザーは自動的にemployment_recordsに移行

## 注意事項

1. **既存データの保護**: マイグレーション前に必ずバックアップを取得
2. **段階的移行**: 既存機能への影響を最小限に
3. **テスト環境での検証**: 本番環境への適用前に十分なテストを実施

## 今後の拡張

1. **通知システム**: メール/SMS通知の実装
2. **デジタル署名**: より安全な署名方式の実装
3. **公的様式の自動生成**: 実地指導用の証明書自動生成
4. **キャリアポートフォリオ**: スタッフ個人のキャリア可視化

