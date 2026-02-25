# 整合性レビュー計画

## 目的

プラットフォーム全体で**マスターデータ依存の原則**を徹底し、以下を達成する：

1. **未設定データの非表示**: マスターが未設定なら関連機能は表示しない
2. **ガイダンス表示**: 設定が必要な箇所では動線を明示
3. **データ整合性**: DB→バックエンド→フロントエンドの一貫性
4. **オンボーディング**: ゲーム的な初期設定フロー（オプション）

---

## レビュー対象メニュー（28機能）

| カテゴリ | メニュー | Phase |
|---------|---------|-------|
| 保護者 | 利用予約、児童管理、チャット、コネクト、保護者招待、リード管理 | 1-3 |
| 記録 | 実績と連絡帳、個別支援計画、苦情・事故報告 | 1-2 |
| スタッフ | スタッフマスタ、人員配置管理、シフト管理、研修記録 | 1-2 |
| 運営 | 送迎ルート、運営指導準備、委員会管理、書類管理、ナレッジ、行政連携 | 1-2 |
| 経営 | ダッシュボード、加算シミュレーション、加算一覧、損益計算書、キャッシュフロー、経費管理、経営設定 | 1-2 |
| 設定 | 施設情報、加算体制設定 | 1 |

---

## データ依存関係マップ

```
施設情報（facility_settings）
├── 時間枠（facility_time_slots）
│   ├── 利用予約カレンダー
│   ├── ダッシュボード稼働率
│   └── 実績記録
├── 営業時間・定休日
│   ├── シフト管理
│   ├── 利用予約
│   └── 稼働率計算
├── サービス種別（児発/放デイ等）
│   ├── 基本報酬計算
│   ├── 加算カタログ
│   └── 請求処理
└── 定員設定
    ├── 人員配置基準
    └── 稼働率計算

スタッフマスタ（staff + employment_records）
├── シフト管理
├── 人員配置管理
├── 送迎ルート（運転手・添乗員）
└── 研修記録

児童マスタ（children + contracts）
├── 利用予約
├── 実績記録
├── 個別支援計画
├── 加算適用
└── 連絡帳

加算体制設定（facility_addition_settings）
├── 加算シミュレーション
├── 日次加算記録
└── 月次請求
```

---

## レビューフェーズ詳細

### Phase R1: 施設基盤設定（最優先）

**対象テーブル:** `facility_settings`, `facility_time_slots`, `service_types`, `regional_units`

| # | チェック内容 | 対象ファイル |
|---|-------------|-------------|
| R1-1 | facility_time_slots テーブル存在確認 | migrations/ |
| R1-2 | 時間枠未設定時の全画面挙動 | ScheduleView, DashboardView, DailyLogView, StaffView, RevenueAnalytics |
| R1-3 | 営業時間未設定時の挙動 | シフト管理、カレンダー全般 |
| R1-4 | 定休日未設定時の挙動 | 利用予約、シフト管理 |
| R1-5 | サービス種別未設定時の挙動 | 加算関連、基本報酬計算 |
| R1-6 | 定員未設定時の挙動 | 人員配置、稼働率 |
| R1-7 | 地域区分未設定時の挙動 | 報酬単価計算 |

**依存コンポーネント:**
- `FacilitySettingsView.tsx`
- `useFacilityData.ts`
- `dashboardCalculations.ts`
- 全カレンダー系コンポーネント

---

### Phase R2: スタッフ管理

**対象テーブル:** `users` (user_type = 'staff'), `employment_records`, `staff` (レガシー), `shift_patterns`, `shifts`, `staff_personnel_settings`

| # | チェック内容 | 対象ファイル |
|---|-------------|-------------|
| R2-1 | スタッフ0人時のシフト管理画面 | ShiftManagementView |
| R2-2 | シフトパターン未設定時の挙動 | MonthlyShiftCalendar |
| R2-3 | 人員区分（児発管/指導員等）未設定時 | StaffingView, PersonnelSettings |
| R2-4 | 常勤換算計算の前提条件 | staffingComplianceCalculator.ts |
| R2-5 | 勤務体制一覧表の必須データ | WorkScheduleExport |
| R2-6 | 有給残日数の初期値処理 | paid_leave_balances |

**依存コンポーネント:**
- `staff/master/*`
- `staff/shift/*`
- `staff/staffing/*`
- `useStaffMaster.ts`
- `useShiftManagement.ts`
- `useStaffingCompliance.ts`

---

### Phase R3: 児童・契約管理

**対象テーブル:** `children`, `contracts`, `contract_invitations`, `child_additions`, `child_addition_plans`

| # | チェック内容 | 対象ファイル |
|---|-------------|-------------|
| R3-1 | 児童0人時の利用予約画面 | ScheduleView |
| R3-2 | 契約未設定時の児童表示 | ChildrenView |
| R3-3 | 受給者証情報未設定時の挙動 | 加算適用、請求処理 |
| R3-4 | 障害区分未設定時の加算判定 | AdditionSimulation |
| R3-5 | 利用曜日パターン未設定時 | 利用予約カレンダー |
| R3-6 | 送迎設定未設定時 | 送迎ルート管理 |

**依存コンポーネント:**
- `children/ChildrenView.tsx`
- `schedule/ScheduleView.tsx`
- `schedule/ChildCard.tsx`
- `simulation/ChildAdditionCard.tsx`

---

### Phase R4: 日常業務（利用予約・実績）

**対象テーブル:** `schedules`, `usage_records`, `contact_logs`, `daily_addition_records`, `daily_transport_assignments`

| # | チェック内容 | 対象ファイル |
|---|-------------|-------------|
| R4-1 | 時間枠 x 児童の予約表示整合性 | ScheduleView |
| R4-2 | 実績記録の必須フィールド | UsageRecordForm |
| R4-3 | 連絡帳の表示条件 | DailyLogView |
| R4-4 | 送迎完了記録の前提条件 | TransportRouteView |
| R4-5 | 日次加算記録の自動生成条件 | daily_addition_records |
| R4-6 | 予約と実績の突合チェック | usage_records |

**依存コンポーネント:**
- `schedule/*`
- `logs/DailyLogView.tsx`
- `logs/UsageRecordForm.tsx`
- `transport/TransportRouteView.tsx`

---

### Phase R5: 報酬・加算システム

**対象テーブル:** `service_types`, `base_rewards`, `addition_categories`, `additions`, `addition_definitions`, `facility_addition_settings`, `addition_staff_requirements`

| # | チェック内容 | 対象ファイル |
|---|-------------|-------------|
| R5-1 | サービス種別未設定時の加算一覧 | AdditionCatalogView |
| R5-2 | 加算体制設定の必須項目 | FacilityAdditionSettings |
| R5-3 | 加算要件（人員配置）との連動 | addition_staff_requirements |
| R5-4 | シミュレーション計算の前提条件 | useAdditionSimulation |
| R5-5 | 月次集計の必須データ | RevenueAnalytics |
| R5-6 | 地域区分 x 単価計算の整合性 | regional_units x base_rewards |

**依存コンポーネント:**
- `management/AdditionCatalogView.tsx`
- `simulation/AdditionSimulationView.tsx`
- `settings/FacilityAdditionSettings.tsx`
- `dashboard/RevenueAnalytics.tsx`
- `utils/additionCalculator.ts`

---

### Phase R6: 経営分析・ダッシュボード

**対象テーブル:** `monthly_revenue_estimates`, `monthly_financials`, `expenses`, `daily_staffing_compliance`

| # | チェック内容 | 対象ファイル |
|---|-------------|-------------|
| R6-1 | 稼働率計算の前提条件 | dashboardCalculations.ts |
| R6-2 | 曜日別稼働率の時間枠依存 | DashboardView（週別詳細含む） |
| R6-3 | 売上予測の必須データ | RevenueAnalytics |
| R6-4 | 人員配置コンプライアンスの表示条件 | ComplianceManagement |
| R6-5 | 損益計算の必須マスタ | ProfitLossView |
| R6-6 | 経費カテゴリ未設定時 | ExpenseManagement |

**依存コンポーネント:**
- `dashboard/DashboardView.tsx`
- `dashboard/RevenueAnalytics.tsx`
- `dashboard/ComplianceManagement.tsx`
- `management/ProfitLossView.tsx`

---

### Phase R7: その他機能

**対象:** チャット（chat_messages）、コネクト（connect_meetings）、ナレッジ（knowledge_articles）、研修記録（training_records）、書類管理（document_uploads）

| # | チェック内容 |
|---|-------------|
| R7-1 | 各機能の初期表示状態 |
| R7-2 | 空データ時のガイダンス |
| R7-3 | 必須マスタとの依存関係 |

---

## 実施計画

### 実施順序

| 順序 | フェーズ | 優先度 |
|------|---------|--------|
| 1 | R1: 施設基盤設定 | 最高 |
| 2 | R6: 経営分析（R1依存大） | 高 |
| 3 | R2: スタッフ管理 | 高 |
| 4 | R3: 児童・契約管理 | 高 |
| 5 | R4: 日常業務 | 中 |
| 6 | R5: 報酬・加算 | 中 |
| 7 | R7: その他機能 | 低 |
| 8 | オンボーディング | オプション |

### 各フェーズの作業内容

1. **DBテーブル確認**: マイグレーションファイルで構造確認
2. **依存コンポーネント特定**: Grep/Readで使用箇所を洗い出し
3. **未設定時の挙動調査**: 現状の動作を確認
4. **修正実施**: 必要な箇所を修正
5. **TypeScript検証**: コンパイルエラーがないことを確認

---

## 期待される成果

### Before（現状）
- 時間枠未設定でも「午前/午後」が表示される
- 定員未設定でも稼働率が計算される
- マスターデータがなくても画面が動作する

### After（目標）
- 全ての表示がマスターデータに依存
- 未設定箇所には明確なガイダンス
- データの整合性が保証される
- 初期設定ウィザードで迷わない（オプション）

---

## オンボーディングガイド設計（オプション）

### 初期設定ステップ

```
Step 1: 施設基本情報 → 施設名・住所・サービス種別・定員・地域区分
Step 2: 営業設定 → 営業時間・時間枠・定休日・長期休業
Step 3: スタッフ登録 → 管理者情報確認・スタッフ招待・人員区分設定・シフトパターン
Step 4: 児童登録 → 基本情報・契約情報（受給者証）・利用曜日・送迎設定
Step 5: 加算体制設定 → 取得予定加算の選択・要件確認・体制設定
→ 完了！通常運用開始
```

---

*最終更新: 2026-02-25*
