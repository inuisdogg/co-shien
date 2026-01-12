# 運営指導対応システム開発計画

## 概要

児童発達支援事業の運営指導に必要な全書類をワンクリックで出力できるシステムを構築する。
日々の記録を本サービスに入力することで、運営指導時に必要な書類が自動生成される状態を目指す。

---

## 必要書類一覧と現状のギャップ分析

### 凡例
- ✅ 実装済み（データがあれば出力可能）
- ⚠️ 部分実装（追加開発で対応可能）
- ❌ 未実装（新規開発必要）

---

## 1. 事前提出書類

| # | 書類名 | 現状 | 必要な対応 |
|---|--------|------|-----------|
| 1 | 自己点検表 | ❌ | 設問テンプレート作成、回答入力UI、PDF出力 |
| 2 | 勤務体制一覧表 | ⚠️ | shifts + staff テーブルから生成、帳票デザイン |
| 3 | 加算算定点検表 | ⚠️ | usage_records の加算情報から生成、帳票デザイン |
| 4 | 利用者一覧表 | ⚠️ | children + contracts から生成、帳票デザイン |

---

## 2. 当日必要書類

### 2-1. 従業員関係（1-9）

| # | 書類名 | 現状 | 必要な対応 |
|---|--------|------|-----------|
| 1 | 雇用契約書・辞令 | ❌ | テンプレート管理、PDF生成、署名機能 |
| 2 | 履歴書 | ✅ | ResumeExport.tsx で実装済み |
| 3 | 労働者名簿 | ⚠️ | staff テーブルから生成、帳票デザイン |
| 4 | 賃金関係書類 | ❌ | 給与テーブル作成、管理画面 |
| 5 | 守秘義務・機密保持誓約書 | ❌ | テンプレート管理、署名機能 |
| 6 | 健康診断書 | ❌ | ファイルアップロード・管理機能 |
| 7 | 勤務形態一覧表 | ⚠️ | = 勤務体制一覧表と同様 |
| 8 | 出勤簿・タイムカード | ⚠️ | shifts テーブルから生成、帳票デザイン |
| 9 | 資格証明書 | ✅ | user_careers テーブルに画像URL保存済み |

### 2-2. 運営関係（10-21）

| # | 書類名 | 現状 | 必要な対応 |
|---|--------|------|-----------|
| 10 | 指定申請関係書類 | ❌ | ドキュメント管理機能（アップロード・分類） |
| 11 | 平面図 | ❌ | ドキュメント管理機能 |
| 12 | 設備・備品台帳 | ❌ | equipment テーブル作成、管理画面 |
| 13 | 加算届出 | ❌ | 届出管理機能、履歴追跡 |
| 14 | 運営規定 | ❌ | ドキュメント管理機能 |
| 15 | 重要事項説明書 | ❌ | テンプレート生成、署名機能 |
| 16 | サービス利用契約書 | ⚠️ | contracts テーブルあり、帳票デザイン必要 |
| 17 | 加算算定要件書類 | ⚠️ | 加算点検表と連動 |
| 18 | 就業規則・給与規則 | ❌ | ドキュメント管理機能 |
| 19 | 委員会議事録 | ❌ | committee_meetings テーブル作成、管理画面 |
| 20 | 賠償責任保険証券 | ❌ | ドキュメント管理機能 |
| 21 | 業務管理体制届 | ❌ | ドキュメント管理機能 |

### 2-3. 記録関係（22-29）

| # | 書類名 | 現状 | 必要な対応 |
|---|--------|------|-----------|
| 22 | 国保連請求関係書類 | ❌ | billing テーブル作成、請求データ管理 |
| 23 | 領収書 | ❌ | receipts テーブル作成、発行機能 |
| 24 | 地域交流記録 | ❌ | community_activities テーブル作成 |
| 25 | 苦情・事故・ヒヤリハット記録 | ❌ | incidents テーブル作成、報告フロー |
| 26 | 職員研修記録 | ❌ | training_records テーブル作成 |
| 27 | 身体拘束・虐待記録 | ❌ | restraint_records テーブル作成 |
| 28 | 消防計画・避難訓練記録 | ❌ | emergency_drills テーブル作成 |
| 29 | 会計関係書類 | ❌ | accounting テーブル作成（or 外部連携） |

### 2-4. 利用者支援関連（30-35）

| # | 書類名 | 現状 | 必要な対応 |
|---|--------|------|-----------|
| 30 | 個人情報取扱同意書 | ❌ | テンプレート管理、署名機能 |
| 31 | サービス等利用計画・個別支援計画書 | ⚠️ | service_plans テーブル作成、詳細UI |
| 32 | 入退所記録 | ⚠️ | contracts テーブルから生成可能、帳票デザイン |
| 33 | 利用者・入所者数書類 | ⚠️ | schedules/usage_records から生成、帳票デザイン |
| 34 | 実施記録・業務日誌 | ⚠️ | daily_logs テーブル作成、UI実装 |
| 35 | 利用者一覧 | ⚠️ | children + contracts から生成、帳票デザイン |

### 2-5. その他（36-38）

| # | 書類名 | 現状 | 必要な対応 |
|---|--------|------|-----------|
| 36 | 医薬品台帳 | ❌ | medications テーブル作成 |
| 37 | 衛生管理記録 | ❌ | hygiene_records テーブル作成 |
| 38 | 食事提供記録 | ❌ | meal_records テーブル作成 |

---

## 3. 開発優先順位

### Phase 1: 基盤整備（最優先）
**目標**: 日常業務で必ず使う機能を優先実装

1. **業務日誌機能** (daily_logs)
   - 日々の支援記録を入力
   - 児童ごとの個別記録
   - 職員の活動記録

2. **個別支援計画機能** (service_plans)
   - 支援計画の作成・管理
   - 目標設定と評価
   - 保護者同意・署名

3. **帳票出力基盤**
   - 勤務体制一覧表
   - 利用者一覧表
   - 実績記録表（月次）

### Phase 2: 記録機能拡充
**目標**: 運営指導で重要な記録類を整備

4. **苦情・事故報告機能** (incidents)
   - インシデント登録
   - 対応履歴
   - ヒヤリハット管理

5. **研修記録機能** (training_records)
   - 研修実施記録
   - 参加者管理
   - 資料添付

6. **委員会管理機能** (committee_meetings)
   - 虐待防止委員会
   - 身体拘束適正化委員会
   - 感染対策委員会
   - 議事録管理

### Phase 3: 書類管理機能
**目標**: 運営指導で提示が必要な静的書類の管理

7. **ドキュメント管理機能** (documents)
   - 運営規定
   - 就業規則
   - 平面図
   - 保険証券
   - etc.

8. **雇用契約管理機能** (employment_contracts)
   - 契約書テンプレート
   - 電子署名
   - 更新履歴

### Phase 4: 請求・会計連携
**目標**: 国保連請求と会計書類の管理

9. **請求管理機能** (billing)
   - 国保連請求データ生成
   - 請求履歴管理

10. **領収書発行機能** (receipts)
    - 自費サービス領収書
    - 発行履歴

### Phase 5: 補助機能
**目標**: その他の運営指導対応書類

11. **設備・備品台帳** (equipment)
12. **医薬品管理** (medications)
13. **衛生管理** (hygiene_records)
14. **避難訓練記録** (emergency_drills)

---

## 4. データベース設計（新規テーブル）

### Phase 1 で必要なテーブル

```sql
-- 業務日誌
CREATE TABLE daily_logs (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  date DATE NOT NULL,
  staff_id TEXT REFERENCES users(id),
  log_type TEXT NOT NULL, -- 'facility' | 'child'
  child_id TEXT REFERENCES children(id), -- 児童個別記録の場合
  content TEXT NOT NULL,
  activities JSONB, -- 活動内容
  special_notes TEXT, -- 特記事項
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 個別支援計画
CREATE TABLE service_plans (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  child_id TEXT NOT NULL REFERENCES children(id),
  plan_type TEXT NOT NULL, -- 'initial' | 'renewal' | 'modification'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  goals JSONB NOT NULL, -- 目標設定
  support_content JSONB NOT NULL, -- 支援内容
  evaluation JSONB, -- 評価
  parent_signature_url TEXT,
  parent_signed_at TIMESTAMPTZ,
  staff_signature_url TEXT,
  staff_id TEXT REFERENCES users(id),
  status TEXT DEFAULT 'draft', -- 'draft' | 'pending_sign' | 'active' | 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2 で必要なテーブル

```sql
-- 苦情・事故・ヒヤリハット
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  incident_type TEXT NOT NULL, -- 'complaint' | 'accident' | 'near_miss'
  occurred_at TIMESTAMPTZ NOT NULL,
  child_id TEXT REFERENCES children(id),
  reporter_id TEXT REFERENCES users(id),
  description TEXT NOT NULL,
  cause_analysis TEXT,
  actions_taken TEXT,
  preventive_measures TEXT,
  status TEXT DEFAULT 'reported', -- 'reported' | 'investigating' | 'resolved'
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 研修記録
CREATE TABLE training_records (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  training_type TEXT NOT NULL, -- 'internal' | 'external'
  title TEXT NOT NULL,
  date DATE NOT NULL,
  duration_hours NUMERIC,
  instructor TEXT,
  content TEXT,
  participants JSONB, -- 参加者ID配列
  materials_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 委員会・会議
CREATE TABLE committee_meetings (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  committee_type TEXT NOT NULL, -- 'abuse_prevention' | 'restraint' | 'infection' | 'safety' | 'other'
  meeting_date DATE NOT NULL,
  attendees JSONB NOT NULL,
  agenda TEXT,
  minutes TEXT NOT NULL,
  decisions JSONB,
  next_meeting_date DATE,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. UI設計方針

### メニュー構成案

```
スタッフダッシュボード
├── ホーム（概要）
├── 児童管理
│   ├── 児童一覧
│   ├── 個別支援計画
│   └── 利用実績
├── 日誌・記録
│   ├── 業務日誌
│   ├── 支援記録
│   └── 連絡帳
├── スタッフ管理
│   ├── スタッフ一覧
│   ├── シフト管理
│   └── 研修記録
├── 運営管理 ★新規
│   ├── 委員会管理
│   ├── 苦情・事故報告
│   ├── 書類管理
│   └── 設備台帳
├── 帳票出力 ★新規
│   ├── 運営指導書類
│   ├── 勤務体制一覧表
│   ├── 利用者一覧
│   ├── 実績記録表
│   └── 加算点検表
└── 設定
```

### ワンクリック出力画面

```
運営指導書類出力
├── 対象期間選択
├── 書類カテゴリ選択
│   ├── □ 事前提出書類（全選択）
│   ├── □ 従業員関係書類（全選択）
│   ├── □ 運営関係書類（全選択）
│   ├── □ 記録関係書類（全選択）
│   └── □ 利用者支援関連書類（全選択）
├── 個別書類選択（チェックボックス）
└── [一括PDF出力] ボタン
```

---

## 6. 実装スケジュール目安

| Phase | 期間 | 主な機能 |
|-------|------|----------|
| Phase 1 | 2-3週間 | 業務日誌、支援計画、基本帳票 |
| Phase 2 | 2週間 | 苦情・事故、研修、委員会 |
| Phase 3 | 1-2週間 | ドキュメント管理、雇用契約 |
| Phase 4 | 2週間 | 請求、領収書 |
| Phase 5 | 1週間 | 補助機能 |

**総計: 約8-10週間**

---

## 7. 次のアクション

1. Phase 1 の詳細設計
2. daily_logs, service_plans テーブルのマイグレーション作成
3. 業務日誌UIの実装
4. 帳票出力基盤の構築

---

*作成日: 2026-01-11*
*CTO計画書 v1.0*
