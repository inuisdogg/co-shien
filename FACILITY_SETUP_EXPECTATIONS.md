# 施設セットアップ後の期待値

## 概要

施設の初回セットアップ（`/admin-setup`）を完了した後、以下のテーブルにデータが作成されます。

## セットアップ完了後のテーブル状態

### 1. `facilities`テーブル
**必須**: ✅ 必ず1レコード作成される

```sql
- id: facility-{timestamp} (例: facility-1234567890)
- name: 入力された施設名
- code: 5桁のランダムな施設コード（例: 12345）
- created_at: セットアップ日時
- updated_at: セットアップ日時
```

### 2. `users`テーブル
**必須**: ✅ 管理者の個人アカウントが必ず1レコード作成/更新される

**新規ユーザーの場合（施設と同時にアカウント作成）**:
```sql
- id: admin-{facilityId} (例: admin-facility-1234567890)
- facility_id: {facilityId} (後方互換性のため、将来的に削除予定)
- name: 入力された管理者名
- login_id: メールアドレス
- email: 入力されたメールアドレス
- role: 'admin'
- password_hash: ハッシュ化されたパスワード
- has_account: true
- account_status: 'active' (有効化済み)
- activated_at: セットアップ日時
- permissions: {}
- created_at: セットアップ日時
- updated_at: セットアップ日時
```

**既存ユーザーの場合（Personal側で既にログイン済み）**:
```sql
- id: 既存のuser_id
- role: 'admin' (更新される)
- updated_at: セットアップ日時 (更新される)
- その他のフィールド: 既存の値が保持される
```

### 3. `employment_records`テーブル
**必須**: ✅ 管理者の所属関係が必ず1レコード作成される

```sql
- id: emp-{adminId} (例: emp-admin-facility-1234567890)
- user_id: {adminId} (usersテーブルへの参照)
- facility_id: {facilityId} (facilitiesテーブルへの参照)
- start_date: セットアップ日（YYYY-MM-DD形式）
- end_date: NULL (現在も在籍中)
- role: '管理者'
- employment_type: '常勤' (デフォルト値)
- permissions: {}
- experience_verification_status: 'not_requested'
- created_at: セットアップ日時
- updated_at: セットアップ日時
```

### 4. `staff`テーブル
**必須**: ✅ 管理者のスタッフレコードが必ず1レコード作成される（後方互換性のため）

```sql
- id: staff-{adminId} (例: staff-admin-facility-1234567890)
- facility_id: {facilityId} (facilitiesテーブルへの参照)
- user_id: {adminId} (usersテーブルへの参照)
- name: 管理者名
- role: '管理者'
- type: '常勤' (デフォルト値)
- email: メールアドレス
- created_at: セットアップ日時
- updated_at: セットアップ日時
- その他のフィールド: NULLまたはデフォルト値
```

### 5. `facility_settings`テーブル
**必須**: ✅ 施設設定が必ず1レコード作成される

```sql
- facility_id: {facilityId}
- facility_name: 入力された施設名
- regular_holidays: [0] (日曜日を定休日)
- custom_holidays: []
- business_hours: {
    "AM": {"start": "09:00", "end": "12:00"},
    "PM": {"start": "13:00", "end": "18:00"}
  }
- capacity: {
    "AM": 10,
    "PM": 10
  }
- created_at: セットアップ日時
- updated_at: セットアップ日時
```

## テーブル間の関係性

```
facilities (施設)
  ↓ (1対多)
employment_records (所属関係)
  ↓ (多対1)
users (個人アカウント)

facilities (施設)
  ↓ (1対多)
staff (事業所固有のスタッフ情報)
  ↓ (多対1)
users (個人アカウント) [user_idで紐付け]

facilities (施設)
  ↓ (1対1)
facility_settings (施設設定)
```

## 期待される動作

### セットアップ完了後、管理者は：

1. **Biz側（biz.co-shien.inu.co.jp）でログイン可能**
   - 施設ID + メールアドレス + パスワードでログイン
   - `users`テーブルと`employment_records`テーブルで認証
   - 施設の管理画面にアクセス可能

2. **Personal側（my.co-shien.inu.co.jp）でログイン可能**
   - メールアドレス + パスワードでログイン（施設ID不要）
   - `users`テーブルで認証
   - 個人のキャリア管理画面にアクセス可能

3. **スタッフ一覧に自分が表示される**
   - `staff`テーブルと`employment_records`テーブルの両方に存在
   - Biz側のスタッフ管理画面で自分を確認可能

## 検証方法

セットアップ完了後、以下のSQLで確認できます：

```sql
-- 1. 施設が作成されているか
SELECT * FROM facilities WHERE code = '{施設コード}';

-- 2. 管理者の個人アカウントが作成されているか
SELECT * FROM users WHERE email = '{メールアドレス}';

-- 3. 所属関係が作成されているか
SELECT er.*, u.name, f.name as facility_name
FROM employment_records er
JOIN users u ON er.user_id = u.id
JOIN facilities f ON er.facility_id = f.id
WHERE u.email = '{メールアドレス}';

-- 4. スタッフレコードが作成されているか
SELECT s.*, u.name as user_name
FROM staff s
JOIN users u ON s.user_id = u.id
WHERE u.email = '{メールアドレス}';

-- 5. 施設設定が作成されているか
SELECT * FROM facility_settings WHERE facility_id = '{facilityId}';
```

## エラー時のロールバック

セットアップ中にエラーが発生した場合、以下の順序でロールバックされます：

1. `employment_records`の作成失敗 → `users`と`facilities`を削除
2. `staff`の作成失敗 → `employment_records`、`users`、`facilities`を削除
3. `facility_settings`の作成失敗 → エラーは無視（後で設定可能）

## 将来的な離職時の設計

管理者が離職した場合：

1. **`users`テーブル**: 個人アカウントとして残る（削除しない）
2. **`employment_records`テーブル**: `end_date`を設定して所属関係を終了
3. **`staff`テーブル**: 削除または非アクティブ化（事業所固有の情報のため）

これにより、離職後も個人アカウントとしてログイン可能で、他の事業所への所属やキャリア管理が可能です。



