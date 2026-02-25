# Roots システム設計書

## 1. サービスの目的

### 究極のゴール
```
実地指導で必要なすべての情報がワンクリックで出せる
= 障害児通所支援事業の運営がこのSaaSで完結する
```

### 代替するツール
- 会計ソフト
- 人事労務ソフト
- 請求ソフト（Litalico等）
- 運営管理システム

---

## 2. 3つの柱

### 2.1 キャリアアカウント（個人の職業人生を記録）
```
┌─────────────────────────────────────────────────────────────┐
│  キャリアアカウント = 個人の「仕事のすべて」                │
│                                                             │
│  ├── 基本情報（名前、資格、スキル）                        │
│  ├── 雇用関係（どの施設で働いているか）                    │
│  ├── 勤怠記録（出勤/退勤ボタン → リアルタイム記録）        │
│  ├── 職歴（過去の施設での勤務記録）                        │
│  ├── 実務経験証明書（ワンクリック発行）                    │
│  └── 履歴書・職務経歴書（自動更新）                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 施設運営（ビジネス側）
```
┌─────────────────────────────────────────────────────────────┐
│  施設管理 = 事業運営のすべて                                │
│                                                             │
│  ├── 基本情報（サービス種別、地域区分、定員）              │
│  ├── スタッフ管理（雇用関係の管理）                        │
│  │     └── キャリアアカウントとの紐付け                    │
│  ├── 利用者管理（児童、保護者）                            │
│  ├── スケジュール・実績記録                                │
│  ├── 加算記録（専門的支援等）                              │
│  ├── 会計・経費・P/L                                       │
│  └── 実地指導資料の自動生成                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 経営シミュレーション（計画・分析）
```
┌─────────────────────────────────────────────────────────────┐
│  シミュレーション = 事業計画の設計ツール                    │
│                                                             │
│  ├── 目標単価設計                                          │
│  │     ├── スタッフの専門性 → 取れる加算を判定             │
│  │     ├── テンプレート児童で試算                          │
│  │     └── 児童1人あたりの目標単価を決定                   │
│  ├── 売上予測（単価 × 想定児童数）                         │
│  ├── 費用計画（人件費、固定費）                            │
│  ├── 月次P/L予測                                           │
│  └── 計画 vs 実績の比較分析                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. データモデル設計

### 3.1 エンティティ関係図

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     users        │     │  employment_     │     │   facilities     │
│  (キャリアアカ)   │────▶│    records       │◀────│   (施設)         │
│                  │ 1:N │  (雇用関係)      │ N:1 │                  │
│  - id            │     │                  │     │  - id            │
│  - email         │     │  - user_id       │     │  - name          │
│  - name          │     │  - facility_id   │     │  - code          │
│  - login_id      │     │  - start_date    │     │  - company_id    │
│  - password_hash │     │  - end_date      │     │                  │
│  - user_type     │     │  - role          │     │                  │
│                  │     │  - employment_   │     │                  │
│                  │     │    type          │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                                                 │
         │ 1:N                                             │ 1:N
         ▼                                                 ▼
┌──────────────────┐                              ┌──────────────────┐
│  attendance_     │                              │   children       │
│    records       │                              │  (利用児童)       │
│  (勤怠記録)      │                              │                  │
│                  │                              │  - facility_id   │
│  - user_id       │                              │  - name          │
│  - facility_id   │                              │  - owner_profile │
│  - clock_in      │                              │    _id           │
│  - clock_out     │                              │  - contract_     │
│  - work_hours    │                              │    status        │
└──────────────────┘                              └──────────────────┘
                                                           │
                                                           │ N:1
                                                           ▼
                                                  ┌──────────────────┐
                                                  │     users        │
                                                  │  (保護者アカウント)│
                                                  │                  │
                                                  │  user_type =     │
                                                  │    'client'      │
                                                  └──────────────────┘
```

### 3.2 コアテーブル定義

#### users（キャリアアカウント / 保護者アカウント）
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  login_id TEXT UNIQUE,
  password_hash TEXT NOT NULL,

  -- アカウント種別
  user_type TEXT NOT NULL CHECK (user_type IN (
    'career',    -- キャリアアカウント（スタッフ）
    'client',    -- 保護者アカウント
    'admin'      -- プラットフォーム管理者
  )),

  -- アカウント状態
  account_status TEXT DEFAULT 'pending' CHECK (account_status IN (
    'pending',   -- 招待済み、未アクティベート
    'active',    -- アクティブ
    'suspended'  -- 停止中
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### employment_records（雇用関係）
```sql
CREATE TABLE employment_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),

  -- 雇用期間
  start_date DATE NOT NULL,
  end_date DATE,  -- NULLなら現在も雇用中

  -- 役職・雇用形態
  role TEXT NOT NULL CHECK (role IN (
    '管理者',
    '児童発達支援管理責任者',
    '児童指導員',
    '保育士',
    'その他'
  )),
  employment_type TEXT NOT NULL CHECK (employment_type IN (
    '常勤専従',
    '常勤兼務',
    '非常勤'
  )),

  -- 権限
  permissions JSONB DEFAULT '{}',

  -- 実務経験証明
  experience_verification_status TEXT DEFAULT 'not_requested',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, facility_id, start_date)
);
```

#### attendance_records（勤怠記録）
```sql
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  employment_record_id TEXT REFERENCES employment_records(id),

  -- 勤怠
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,

  -- 計算値
  work_hours DECIMAL(4,2),
  break_hours DECIMAL(4,2),
  overtime_hours DECIMAL(4,2),

  -- 休暇
  leave_type TEXT CHECK (leave_type IN (
    NULL,           -- 通常出勤
    'paid_leave',   -- 有給
    'sick_leave',   -- 病欠
    'special_leave' -- 特別休暇
  )),

  -- 承認
  status TEXT DEFAULT 'recorded' CHECK (status IN (
    'recorded',   -- 記録済み
    'approved',   -- 承認済み
    'rejected'    -- 却下
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, facility_id, date)
);
```

#### facility_settings（施設設定）
```sql
CREATE TABLE facility_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id TEXT NOT NULL UNIQUE REFERENCES facilities(id),

  -- 基本情報
  facility_name TEXT,
  service_type_code TEXT,  -- 'jidouhatsu', 'hokago_day', etc.
  regional_grade TEXT,     -- '1級地', '2級地', etc.

  -- 営業設定（NULL = 未設定）
  business_hours JSONB,  -- DEFAULT削除
  capacity JSONB,        -- DEFAULT削除（時間枠で管理）
  regular_holidays INTEGER[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 注意: デフォルト値を削除し、NULLを「未設定」として扱う
```

#### facility_time_slots（時間枠設定）
```sql
CREATE TABLE facility_time_slots (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),

  name TEXT NOT NULL,        -- '午前', '午後', '終日' など
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER,          -- NULLなら未設定
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 注意: このテーブルにレコードがなければ「時間枠未設定」
```

---

## 4. 画面フロー設計

### 4.1 スタッフ追加の正しいフロー

```
【現状の問題】
施設管理者 → 「新規追加」 → 直接staffテーブルに挿入
（キャリアアカウントが作られない）

【あるべき姿】
┌─────────────────────────────────────────────────────────────┐
│  施設管理者がスタッフを追加する場合                         │
│                                                             │
│  1. 「スタッフを招待」ボタンをクリック                      │
│  2. メールアドレス（または電話番号）を入力                  │
│  3. システムが招待メールを送信                              │
│  4. スタッフが招待リンクをクリック                          │
│  5. キャリアアカウントを作成（またはログイン）              │
│  6. employment_recordsに雇用関係が作成される                │
│  7. スタッフとして施設に紐付く                              │
└─────────────────────────────────────────────────────────────┘

【「新規追加」ボタンは廃止または制限】
- 招待なしでスタッフを追加することは原則禁止
- どうしても必要な場合は「仮アカウント」として作成し、
  後から本人がキャリアアカウントと紐付ける
```

### 4.2 加算シミュレーションの正しいフロー

```
【現状の問題】
スケジュールに登録された児童 → その児童の加算を計算
（児童がいないと何もできない）

【あるべき姿】
┌─────────────────────────────────────────────────────────────┐
│  目標単価シミュレーター                                     │
│                                                             │
│  入力:                                                      │
│  ├── 事業所の体制（スタッフ数、資格保有者数）              │
│  ├── 取得予定の加算（チェックボックスで選択）              │
│  └── テンプレート児童（週X回利用、送迎あり/なし等）        │
│                                                             │
│  出力:                                                      │
│  ├── 児童1人1回あたりの単価                                │
│  ├── 児童1人月あたりの想定売上                             │
│  ├── 想定児童数での月間売上予測                            │
│  └── 必要経費との比較（損益分岐点）                        │
└─────────────────────────────────────────────────────────────┘

【実績管理は別機能】
- 実際の児童の加算記録は「実績記録」機能で管理
- シミュレーションと実績を比較する機能を追加
```

### 4.3 経費・P/L管理

```
┌─────────────────────────────────────────────────────────────┐
│  経費管理                                                   │
│                                                             │
│  収入:                                                      │
│  ├── 利用料収入（自動計算: 実績 × 単価）                   │
│  ├── その他収入                                            │
│                                                             │
│  支出:                                                      │
│  ├── 人件費（勤怠記録から自動計算 or 手入力）              │
│  ├── 家賃・光熱費                                          │
│  ├── 消耗品費                                              │
│  ├── 車両費（送迎関連）                                    │
│  ├── 研修費                                                │
│  └── その他経費                                            │
│                                                             │
│  レポート:                                                  │
│  ├── 月次P/L                                               │
│  ├── 年次推移                                              │
│  └── 予算 vs 実績比較                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 未設定時の動作ルール

### 5.1 原則
```
マスターデータが未設定 → 機能を使用不可 + ガイダンス表示
```

### 5.2 具体的なルール

| 設定項目 | 未設定時の動作 |
|---------|---------------|
| サービス種別 | 加算・報酬計算不可、ガイダンス表示 |
| 地域区分 | 単価計算不可、ガイダンス表示 |
| 時間枠 | スケジュール機能使用不可、ガイダンス表示 |
| 定員 | 稼働率表示不可（0/0）、ガイダンス表示 |
| スタッフ | 人員配置基準計算不可、ガイダンス表示 |

### 5.3 実装パターン
```typescript
// 1. データ取得時にisConfiguredフラグを設定
const isConfigured = !!facilitySettings.serviceTypeCode &&
                     !!facilitySettings.regionalGrade;

// 2. UIで条件分岐
if (!isConfigured) {
  return <SetupGuidance missingItems={['サービス種別', '地域区分']} />;
}

// 3. 計算処理でも防御
const calculateRevenue = () => {
  if (!isConfigured) return { totalRevenue: 0, isValid: false };
  // 計算処理
};
```

---

## 6. 移行計画

### Phase 1: データモデル修正
1. `facility_settings`のデフォルト値を削除
2. `staff`テーブルの使用を非推奨化
3. `employment_records`経由のフローに統一

### Phase 2: UI修正
1. スタッフ「新規追加」→「招待」に変更
2. 加算シミュレーション → 目標単価シミュレーターに変更
3. 未設定時のガイダンス表示を徹底

### Phase 3: 新機能追加
1. 経費・P/L管理
2. 目標単価シミュレーター
3. 計画 vs 実績比較

---

## 7. 次のアクション

1. [ ] この設計書のレビュー・承認
2. [ ] データモデル修正のマイグレーション作成
3. [ ] UI修正の実装
4. [ ] 新機能の実装

---

*最終更新: 2026-02-12*
