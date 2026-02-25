# Roots MVP データベース設計書

## 概要

Rootsは3つのコアアカウントで構成される児童福祉施設向けSaaSです。

| アカウント | 対象 | 主な機能 |
|-----------|------|----------|
| **Roots for Facility** | 施設管理者 | 施設運営、スタッフ・児童管理、監査準備 |
| **Roots for Career** | スタッフ | 勤怠打刻、資格管理、実務経験の蓄積 |
| **Roots for Family** | 保護者 | 児童情報管理、施設との連絡 |

---

## ER図（テーブル関係図）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS (大元)                                    │
│  id, email, name, role(admin/staff/parent), login_id, password_hash         │
└─────────────────────────────────────────────────────────────────────────────┘
           │                          │                          │
           │ (1:N)                    │ (1:N)                    │ (1:N)
           ▼                          ▼                          ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   STAFF_PROFILES    │   │      CHILDREN       │   │  EMPLOYMENT_RECORDS │
│  (資格・経歴)        │   │  (保護者の子供)      │   │  (どの施設で働くか)  │
│  user_id (FK)       │   │  parent_user_id(FK) │   │  user_id (FK)       │
│  qualifications[]   │   │  name, birth_date   │   │  facility_id (FK)   │
│  work_history       │   │  characteristics    │   │  role, start_date   │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
                                    │                          │
                                    │ (N:M)                    │
                                    ▼                          ▼
                          ┌─────────────────────┐   ┌─────────────────────┐
                          │  FACILITY_CHILDREN  │   │     FACILITIES      │
                          │  (中間テーブル)       │◄──│  (施設情報)          │
                          │  child_id (FK)      │   │  id, name, code     │
                          │  facility_id (FK)   │   └─────────────────────┘
                          │  contract_status    │              │
                          │  beneficiary_number │              │ (1:N)
                          └─────────────────────┘              ▼
                                                   ┌─────────────────────┐
                                                   │   FACILITY_SETTINGS │
                                                   │  (営業時間・定員等)   │
                                                   └─────────────────────┘
                                                              │
                          ┌───────────────────────────────────┼───────────────┐
                          │ (1:N)                             │ (1:N)         │ (1:N)
                          ▼                                   ▼               ▼
              ┌─────────────────────┐           ┌─────────────────┐  ┌─────────────────┐
              │     ATTENDANCES     │           │     SHIFTS      │  │  LEAVE_REQUESTS │
              │  (勤怠打刻記録)       │           │  (シフト)        │  │  (有給申請)      │
              │  user_id (FK)       │           │  user_id (FK)   │  │  user_id (FK)   │
              │  facility_id (FK)   │           │  facility_id    │  │  facility_id    │
              │  clock_in/out       │           │  date, start    │  │  status         │
              │  gps_location       │           │  end            │  │  approved_by    │
              └─────────────────────┘           └─────────────────┘  └─────────────────┘
                          │
                          │ ★このデータが
                          │ ・施設側: 監査用「勤務実績表」
                          │ ・スタッフ側: 個人「実務経験ログ」
                          ▼
              ┌─────────────────────┐
              │   DAILY_RECORDS     │
              │  (日々の記録/連絡)    │
              │  child_id (FK)      │
              │  facility_id (FK)   │
              │  date, content      │
              │  absence_reason     │
              └─────────────────────┘
```

---

## テーブル詳細

### 1. users（ユーザー - 全アカウントの大元）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ユーザーID |
| email | TEXT | メールアドレス |
| name | TEXT | 氏名 |
| name_kana | TEXT | 氏名（かな） |
| role | TEXT | `admin` / `staff` / `parent` |
| login_id | TEXT | ログインID |
| password_hash | TEXT | パスワードハッシュ |
| phone | TEXT | 電話番号 |
| account_status | TEXT | `pending` / `active` / `suspended` |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 2. facilities（施設）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | 施設ID |
| name | TEXT | 施設名 |
| code | TEXT | 事業所番号 |
| address | TEXT | 住所 |
| phone | TEXT | 電話番号 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 3. facility_settings（施設設定）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID PK | ID |
| facility_id | TEXT FK | 施設ID |
| regular_holidays | INTEGER[] | 定休日（0=日曜〜6=土曜） |
| business_hours | JSONB | 営業時間 |
| capacity | JSONB | 定員 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 4. employment_records（雇用記録 - スタッフと施設の紐付け）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ID |
| user_id | TEXT FK | ユーザーID（スタッフ） |
| facility_id | TEXT FK | 施設ID |
| role | TEXT | `一般スタッフ` / `マネージャー` / `管理者` |
| employment_type | TEXT | `常勤` / `非常勤` |
| start_date | DATE | 入職日 |
| end_date | DATE | 退職日（NULL=在籍中） |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 5. staff_profiles（スタッフプロフィール - 資格・経歴）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ID |
| user_id | TEXT FK | ユーザーID |
| qualifications | JSONB | 保有資格リスト `[{name, date, certificate_url}]` |
| work_history | JSONB | 職歴 |
| bio | TEXT | 自己紹介 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 6. children（児童 - 保護者に紐づく）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | 児童ID |
| parent_user_id | TEXT FK | 保護者のユーザーID |
| name | TEXT | 氏名 |
| name_kana | TEXT | 氏名（かな） |
| birth_date | DATE | 生年月日 |
| gender | TEXT | 性別 |
| characteristics | TEXT | 特性・注意事項 |
| medical_info | JSONB | 医療情報 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 7. facility_children（施設-児童 中間テーブル N:M）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ID |
| facility_id | TEXT FK | 施設ID |
| child_id | TEXT FK | 児童ID |
| contract_status | TEXT | `pre-contract` / `active` / `inactive` |
| beneficiary_number | TEXT | 受給者証番号 |
| beneficiary_image_url | TEXT | 受給者証画像URL |
| beneficiary_valid_from | DATE | 受給者証有効期間（開始） |
| beneficiary_valid_to | DATE | 受給者証有効期間（終了） |
| grant_days | INTEGER | 支給日数 |
| contract_start_date | DATE | 契約開始日 |
| contract_end_date | DATE | 契約終了日 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

**★重要**: この設計により、1人の児童が複数施設に通える（保護者が別施設にRootsを紹介した際、即座に連携可能）

### 8. attendances（勤怠打刻）★監査データ＆実務経験データ

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ID |
| user_id | TEXT FK | スタッフのユーザーID |
| facility_id | TEXT FK | 施設ID |
| date | DATE | 勤務日 |
| clock_in | TIMESTAMPTZ | 出勤打刻時刻 |
| clock_out | TIMESTAMPTZ | 退勤打刻時刻 |
| clock_in_method | TEXT | `gps` / `qr` / `manual` |
| clock_out_method | TEXT | `gps` / `qr` / `manual` |
| clock_in_location | JSONB | 出勤時GPS座標 |
| clock_out_location | JSONB | 退勤時GPS座標 |
| break_minutes | INTEGER | 休憩時間（分） |
| status | TEXT | `pending` / `approved` / `modified` |
| modified_by | TEXT FK | 修正者のユーザーID |
| modified_reason | TEXT | 修正理由 |
| notes | TEXT | 備考 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

**★重要**: このテーブルが
- 施設側 → 監査用「勤務実績表（出勤簿）」の元データ
- スタッフ側 → 個人の「実務経験ログ」として蓄積

### 9. shifts（シフト）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ID |
| user_id | TEXT FK | スタッフのユーザーID |
| facility_id | TEXT FK | 施設ID |
| date | DATE | シフト日 |
| start_time | TIME | 開始時刻 |
| end_time | TIME | 終了時刻 |
| break_minutes | INTEGER | 休憩時間（分） |
| shift_type | TEXT | `normal` / `early` / `late` / `night` |
| status | TEXT | `draft` / `published` / `confirmed` |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 10. leave_requests（有給休暇申請）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ID |
| user_id | TEXT FK | 申請者のユーザーID |
| facility_id | TEXT FK | 施設ID |
| leave_type | TEXT | `paid` / `sick` / `special` |
| start_date | DATE | 開始日 |
| end_date | DATE | 終了日 |
| reason | TEXT | 申請理由 |
| status | TEXT | `pending` / `approved` / `rejected` |
| approved_by | TEXT FK | 承認者のユーザーID |
| approved_at | TIMESTAMPTZ | 承認日時 |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### 11. daily_records（日々の記録 - 施設と保護者の連絡）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | ID |
| facility_id | TEXT FK | 施設ID |
| child_id | TEXT FK | 児童ID |
| date | DATE | 日付 |
| record_type | TEXT | `activity` / `absence` |
| content | TEXT | 記録内容 |
| absence_reason | TEXT | 欠席理由（欠席連絡の場合） |
| created_by | TEXT FK | 作成者のユーザーID |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

---

## 削除するテーブル・機能（MVP対象外）

### 削除するテーブル
- `leads` - 見込み客管理（MVP対象外）
- `companies` - 会社管理（MVP対象外）
- `staff` - usersとemployment_recordsに統合済み
- `additions` - 加算関連（MVP対象外）
- `schedules` - 児童スケジュール（MVP対象外）
- その他、加算シミュレーション関連のテーブル

### 削除する機能
- 加算シミュレーション / 加算カタログ
- 送迎管理
- 詳細な療育記録
- 売上・収益ダッシュボード
- ナレッジベース
- オンボーディングツアー
- リード管理

---

## MVP機能マトリクス

### Roots for Facility（施設管理者）

| 機能 | 画面 | 説明 |
|------|------|------|
| 施設情報登録 | `/facility/settings` | 施設名、住所、営業時間等 |
| スタッフ招待 | `/facility/staff` | キャリアアカウントを招待・紐付け |
| 保護者招待 | `/facility/families` | 保護者アカウントを招待・児童紐付け |
| シフト作成 | `/facility/shifts` | 月間シフト作成・公開 |
| 勤怠確認・修正 | `/facility/attendance` | 打刻データの確認・修正 |
| 有給承認 | `/facility/leave` | 有給申請の承認・却下 |
| 勤務実績表出力 | `/facility/reports` | 監査用出勤簿の出力 |

### Roots for Career（スタッフ）

| 機能 | 画面 | 説明 |
|------|------|------|
| プロフィール登録 | `/career/profile` | 氏名、資格、経歴 |
| 出退勤打刻 | `/career/clock` | GPS/QRで打刻 |
| シフト確認 | `/career/shifts` | 自分のシフト表示 |
| 有給申請 | `/career/leave` | 有給休暇の申請 |
| 実務経験確認 | `/career/experience` | 蓄積された勤務記録の確認 |

### Roots for Family（保護者）

| 機能 | 画面 | 説明 |
|------|------|------|
| 児童プロフィール | `/family/children` | 児童情報、特性の登録 |
| 受給者証登録 | `/family/certificate` | 画像アップロード、期間登録 |
| 日々の記録 | `/family/records` | 施設からの記録を受け取り |
| 欠席連絡 | `/family/absence` | 欠席の連絡 |

---

## 次のステップ

1. ✅ データベース設計の承認
2. マイグレーションファイルの作成
3. フロントエンド構築（施設管理者 + スタッフ勤怠連動から）
4. サービス名「Roots」への変更
