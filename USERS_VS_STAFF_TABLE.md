# usersテーブルとstaffテーブルの違い

## 概要

現在のシステムは移行期間中で、2つのテーブルが併存しています。

## 1. usersテーブル（新しいキャリアプラットフォーム設計）

### 目的
**個人アカウント**として、事業所に依存しない個人の情報を管理

### 主な特徴
- ✅ **事業所に依存しない**（`facility_id`は後方互換性のため残存、将来的に削除予定）
- ✅ **ログイン機能**（`email`, `password_hash`, `login_id`）
- ✅ **アカウントステータス管理**（`pending`, `active`, `suspended`）
- ✅ **招待・アクティベーション情報**（`invited_by_facility_id`, `invited_at`, `activated_at`）
- ✅ **基本的な個人情報**（`name`, `phone`）

### 主なカラム
```sql
- id: 個人アカウントID（UUID）
- name: 氏名
- email: メールアドレス
- phone: 電話番号
- login_id: ログイン用ID
- password_hash: パスワードハッシュ
- account_status: アカウントステータス（pending/active/suspended）
- invited_by_facility_id: 招待した事業所ID
- invited_at: 招待日時
- activated_at: アクティベーション日時
- role: 後方互換性のため残存（将来的に削除予定）
- facility_id: 後方互換性のため残存（将来的に削除予定）
```

### 使用場面
- ログイン認証
- 個人アカウントの管理
- 複数の事業所への所属を管理（`employment_records`テーブル経由）

---

## 2. staffテーブル（既存テーブル、後方互換性のため残存）

### 目的
**事業所固有のスタッフ情報**を管理（事業所ごとの詳細情報）

### 主な特徴
- ✅ **事業所に紐付く**（`facility_id`が必須）
- ✅ **事業所での詳細情報**（生年月日、性別、住所、資格、給与など）
- ✅ **シフト管理**（`default_shift_pattern`）
- ✅ **`user_id`で`users`テーブルと紐付け**（後方互換性のため）

### 主なカラム
```sql
- id: スタッフID（事業所内で一意）
- facility_id: 事業所ID（必須）
- user_id: usersテーブルへの参照（オプション）
- name: 氏名
- name_kana: フリガナ
- role: 役職（一般スタッフ/マネージャー）
- type: 雇用形態（常勤/非常勤）
- birth_date: 生年月日
- gender: 性別
- address: 住所
- phone: 電話番号
- email: メールアドレス
- qualifications: 資格
- years_of_experience: 経験年数
- qualification_certificate: 資格証
- experience_certificate: 実務経験証明書
- emergency_contact: 緊急連絡先
- emergency_contact_phone: 緊急連絡先電話番号
- memo: 備考
- monthly_salary: 月給
- hourly_wage: 時給
- default_shift_pattern: 基本シフトパターン
```

### 使用場面
- 事業所でのスタッフ管理画面
- シフト管理
- 給与管理
- 事業所固有のスタッフ情報の表示

---

## 3. employment_recordsテーブル（新しい設計）

### 目的
**ユーザーと事業所の所属関係**を管理（複数の事業所への所属を可能にする）

### 主な特徴
- ✅ **複数の事業所への所属を管理**
- ✅ **期間管理**（`start_date`, `end_date`）
- ✅ **役割・権限管理**（`role`, `permissions`）
- ✅ **実務経験証明のステータス管理**

### 主なカラム
```sql
- id: 所属記録ID
- user_id: ユーザーID（usersテーブルへの参照）
- facility_id: 事業所ID
- start_date: 所属開始日
- end_date: 所属終了日（NULLの場合は現在も在籍中）
- role: 役職（一般スタッフ/マネージャー/管理者）
- employment_type: 雇用形態（常勤/非常勤）
- permissions: 権限設定（JSONB）
- experience_verification_status: 実務経験証明ステータス
```

---

## 現在の関係性

```
users (個人アカウント)
  ↓ (1対多)
employment_records (所属関係)
  ↓ (多対1)
facilities (事業所)

users (個人アカウント)
  ↓ (1対多、後方互換性のため)
staff (事業所固有のスタッフ情報)
  ↓ (多対1)
facilities (事業所)
```

## 移行戦略

### 現在（移行期間中）
- `users`テーブル: 個人アカウントとして機能
- `staff`テーブル: 事業所固有の情報を保持（後方互換性のため）
- `employment_records`テーブル: 新しい所属関係を管理

### 将来的な方向性
1. **`users`テーブル**: 個人アカウントとして独立（`facility_id`と`role`を削除）
2. **`employment_records`テーブル**: 所属関係の管理に統一
3. **`staff`テーブル**: 段階的に廃止予定（または`employment_records`と統合）

---

## 使い分けの指針

### usersテーブルを使う場面
- ✅ ログイン認証
- ✅ 個人アカウントの管理
- ✅ 複数の事業所への所属を確認

### staffテーブルを使う場面
- ✅ 事業所でのスタッフ一覧表示
- ✅ シフト管理
- ✅ 給与管理
- ✅ 事業所固有の詳細情報の表示

### employment_recordsテーブルを使う場面
- ✅ 所属関係の管理
- ✅ 役割・権限の管理
- ✅ 実務経験証明の管理

---

## 注意事項

⚠️ **現在は移行期間中**のため、以下の点に注意：
- `users`テーブルと`staff`テーブルは`user_id`で紐付けられている
- アカウント有効化時に、`users`、`employment_records`、`staff`の3つのテーブルにデータが作成される
- 将来的には`staff`テーブルを廃止し、`employment_records`に統一する予定








