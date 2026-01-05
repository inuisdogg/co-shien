# 管理者システムセットアップガイド

## 概要

このシステムでは、以下の階層構造でアカウント管理を行います：

- **施設ID**: 各施設を識別する一意のID
- **管理者ID（admin）**: 全権限を持つ管理者アカウント
- **マネージャーID（manager）**: 管理者が定めた権限を付与されたマネージャーアカウント
- **スタッフID（staff）**: 管理者が定めた権限を付与されたスタッフアカウント

## セットアップ手順

### 1. データベースマイグレーションの実行

SupabaseのSQL Editorで以下の順序でSQLスクリプトを実行してください：

#### 1-1. 管理者システムのマイグレーション
```sql
-- add_admin_system_migration.sql を実行
```
このスクリプトは以下を作成します：
- `facilities` テーブル（施設情報）
- `users` テーブル（管理者・マネージャー・スタッフのアカウント）
- 既存の`staff`テーブルとの連携

#### 1-2. スタッフパスワード機能のマイグレーション（既に実行済みの場合はスキップ）
```sql
-- add_staff_password_migration.sql を実行
```

### 2. 初期管理者アカウントの作成

#### 方法A: Webインターフェースを使用（推奨）

1. ブラウザで `/admin-setup` にアクセス
2. 以下の情報を入力：
   - 施設名: `pocopoco`
   - 施設コード: `POCOPOCO001`
   - 管理者名: `管理者`（または任意の名前）
   - メールアドレス: （任意）
   - パスワード: （6文字以上）
   - パスワード（確認）: （上記と同じ）
3. 「初期設定を完了する」ボタンをクリック
4. 自動的にログインページにリダイレクトされます

#### 方法B: SQLスクリプトを使用

SupabaseのSQL Editorで以下を実行：

```sql
-- create_pocopoco_facility.sql を実行
```

**注意**: このスクリプトの初期パスワードは `password` です。初回ログイン後、必ずパスワードを変更してください。

### 3. ログイン

1. `/login` にアクセス
2. 作成した管理者名とパスワードでログイン
3. 管理者として全機能にアクセス可能です

## 権限管理

### 管理者（admin）
- 全メニューにアクセス可能
- マネージャーとスタッフのアカウント作成・権限設定が可能

### マネージャー（manager）
- 管理者が設定した権限に基づいてアクセス
- 権限は各メニュー単位で設定可能：
  - `dashboard`: ダッシュボード
  - `management`: 経営設定
  - `lead`: リード管理
  - `schedule`: 利用調整・予約
  - `children`: 児童管理
  - `staff`: スタッフ・シフト管理
  - `facility`: 施設情報

### スタッフ（staff）
- 管理者が設定した権限に基づいてアクセス
- マネージャーと同様に、各メニュー単位で権限設定可能

## マネージャー・スタッフアカウントの作成

管理者としてログイン後、スタッフ管理画面から：

1. 「スタッフ登録」タブを開く
2. スタッフを追加または編集
3. 「アカウント設定」セクションでパスワードを設定
4. 必要に応じて、`users`テーブルで権限を設定

## データベース構造

### facilities テーブル
```sql
- id: TEXT (PRIMARY KEY)
- name: TEXT
- code: TEXT (UNIQUE)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### users テーブル
```sql
- id: TEXT (PRIMARY KEY)
- facility_id: TEXT (REFERENCES facilities(id))
- name: TEXT
- email: TEXT
- role: TEXT ('admin' | 'manager' | 'staff')
- password_hash: TEXT
- has_account: BOOLEAN
- permissions: JSONB (権限設定)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### permissions の例
```json
{
  "dashboard": true,
  "management": false,
  "lead": true,
  "schedule": true,
  "children": true,
  "staff": true,
  "facility": true
}
```

## トラブルシューティング

### ログインできない場合
1. ユーザー名とパスワードが正しいか確認
2. `users`テーブルで`has_account`が`true`になっているか確認
3. `password_hash`が設定されているか確認

### 権限が正しく機能しない場合
1. `users`テーブルの`permissions`フィールドを確認
2. 管理者の場合は`permissions`は空のJSONBで問題ありません
3. マネージャー・スタッフの場合は、各権限が`true`に設定されているか確認

## セキュリティに関する注意事項

1. **初期パスワードの変更**: 初期設定後、必ずパスワードを変更してください
2. **パスワードの強度**: 6文字以上の強力なパスワードを使用してください
3. **権限の最小化**: 必要最小限の権限のみを付与してください
4. **定期的な監査**: 定期的にアカウントと権限を確認してください



