# Roots — システム仕様書

> 障害児通所支援事業所向けオールインワンSaaS
> 最終更新: 2026-02-27

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロダクト名 | Roots |
| 対象業界 | 障害児通所支援（児童発達支援・放課後等デイサービス） |
| 技術スタック | Next.js 14 / React 18 / TypeScript / Tailwind CSS |
| バックエンド | Supabase (PostgreSQL + RLS + Auth) |
| 決済 | Stripe |
| メール | Resend |
| 監視 | Sentry（一時無効）/ Google Analytics |
| モバイル | PWA + Capacitor (iOS) |
| ホスティング | Netlify |
| 開発開始 | 2025年12月27日 |
| コミット数 | 202 |

---

## 2. ユーザー種別（3ペルソナ）

### 2-1. スタッフ（Career User）
- キャリアプロフィール管理
- 複数施設での雇用関係
- シフト確認・勤怠打刻・有休申請
- 求人閲覧・応募・スカウト受信
- 自己評価・研修記録
- 履歴書/CV/経歴証明書の生成

### 2-2. 保護者（Client User）
- 児童の登録・管理
- 施設との連絡（チャット・連絡帳）
- 利用予約・サービス記録閲覧
- 複数施設との関係管理

### 2-3. 管理者（Admin User）
- 施設管理者: 施設運営全般
- プラットフォーム管理者: 全施設統括・ベンチマーク

---

## 3. 機能一覧（20ドメイン）

---

### 3-1. 施設運営管理
**ページ**: `/business` → 施設設定タブ

| 機能 | 説明 |
|------|------|
| 施設マスタ情報 | 事業所番号・住所・電話・代表者 |
| 営業時間設定 | 曜日別・期間別の営業時間 |
| 定休日管理 | 通常定休日 + カスタム期間休 |
| サービス時間帯 | AM/PM枠、定員設定 |
| 送迎キャパシティ | 車両・運転手・添乗員 |
| 複合事業対応 | 児発 + 放デイの同時運用 |
| 変更通知トラッカー | 設定変更の履歴追跡 |
| 施設お知らせ | 内部向けアナウンス |
| 日誌 | 日々の業務記録 |
| ホームページビルダー | 施設公開ページ (`/facilities/[code]`) |

**主要コンポーネント**: `FacilitySettingsView.tsx` (115KB), `DailyLogView.tsx`, `ChangeNotificationList.tsx`

---

### 3-2. スタッフ・HR管理
**ページ**: `/business` → スタッフ台帳タブ, シフトタブ

| 機能 | 説明 |
|------|------|
| スタッフ台帳 | プロフィール・資格・雇用情報 |
| 招待フロー | リンク招待・QRコード |
| シャドウアカウント | スタッフ代行登録 |
| シフトパターン | テンプレート定義 |
| 月間シフト編集 | 一括割当・編集 |
| シフト希望収集 | 提出期限・スタッフ応答 |
| シフト確定 | 確認フロー |
| 勤怠記録 | 打刻・出退勤 |
| 休暇管理 | 申請・承認・有休残高 |
| 残業管理 | 36協定・残業時間追跡 |
| 人事設定 | 給与・控除・社会保険 |

**主要コンポーネント**: `StaffMasterView.tsx`, `ShiftManagementView.tsx`, `MonthlyShiftEditor.tsx`, `LeaveApprovalView.tsx`

---

### 3-3. 児童管理
**ページ**: `/business` → 児童タブ, `/parent/children/[id]`

| 機能 | 説明 |
|------|------|
| 児童登録 | 基本情報・障害種別・受給者証 |
| 登録ウィザード | ステップ形式の登録 |
| サービス種別 | 児発/放デイの割当 |
| 加算設定 | 児童ごとの加算項目管理 |
| 上限管理 | 月間利用上限・多事業所調整 |
| 書類管理 | 受給者証・診断書等のアップロード |
| 個別支援計画 | 5領域対応の計画書 |
| 施設固有設定 | 児童ごとの施設内設定 |

**主要コンポーネント**: `ChildrenView.tsx` (126KB), `ChildRegistrationWizard.tsx`, `ChildDocumentsManager.tsx`

---

### 3-4. スケジュール・出欠管理
**ページ**: `/business` → スケジュールタブ

| 機能 | 説明 |
|------|------|
| 週間/月間カレンダー | ドラッグ＆ドロップ対応 |
| スロット割当 | 児童の時間帯割当 |
| 送迎割当 | 迎え/送りの運転手・添乗員 |
| 出欠記録 | 予定 vs 実績の記録 |
| 人員配置準拠 | 日次の配置基準チェック |
| 一括生成 | パターンからの自動生成 |

**主要コンポーネント**: `ScheduleView.tsx`, `SlotAssignmentPanel.tsx`, `TransportAssignmentPanel.tsx`

---

### 3-5. 送迎管理
**ページ**: `/business` → スケジュール内

| 機能 | 説明 |
|------|------|
| ルート最適化 | 送迎ルートの効率化 |
| Google Maps連携 | ナビゲーション起動 |
| 完了チェック | 送迎完了の記録 |
| 運転手・添乗員割当 | 迎え/送り別の人員管理 |

**主要コンポーネント**: `TransportManagementView.tsx`

---

### 3-6. 請求・財務管理
**ページ**: `/business` → 請求タブ, 財務タブ, 加算設定タブ

| 機能 | 説明 |
|------|------|
| 請求ウィザード | SmartHR風6ステップ |
| 国保連請求エンジン | サービスコード・単位計算 |
| 収益管理 | 月次収益トラッカー |
| P/L計算書 | 損益計算書の生成 |
| キャッシュフロー予測 | ウィザード形式の資金繰り |
| 経費管理 | カテゴリ別経費追跡 |
| 給与計算 | 控除計算・給与明細 |
| Stripe決済 | 顧客作成・チェックアウト・請求書PDF |
| 加算設定 | 施設の取得加算の管理 |

**主要コンポーネント**: `BillingWizardView.tsx` (71KB), `CashflowWizardView.tsx` (57KB), `FinanceView.tsx`, `RevenueManagementView.tsx`

**ライブラリ**: `deductionEngine.ts`, `payrollCalculator.ts`, `excelEngine.ts`

---

### 3-7. 求人・人材プラットフォーム
**ページ**: `/jobs`, `/jobs/[id]`, `/jobs/spot`, `/business` → 採用タブ

| 機能 | 説明 |
|------|------|
| 求人掲載 | 作成・公開・管理 |
| 求人ボード | 公開求人一覧（距離ソート対応） |
| 求人詳細 | 施設情報・条件・応募 |
| スポットワーク | ギグワーク型シフト募集 |
| 応募管理 | ステータス追跡・メッセージ |
| スカウト | 施設→スタッフへの直接オファー |
| 面接調整 | スロット提示・予約 |
| 採用分析 | 応募数・採用率・チャネル分析 |
| ジオコーディング | 住所→座標変換・距離計算 |

**主要コンポーネント**: `RecruitmentView.tsx` (109KB), `JobBrowsingTab.tsx` (96KB), `InterviewScheduler.tsx`, `RecruitmentAnalyticsView.tsx`

**ライブラリ**: `jobMatcher.ts`, `geocoding.ts`

---

### 3-8. 保護者ポータル
**ページ**: `/parent/*`

| 機能 | 説明 |
|------|------|
| 保護者ダッシュボード | 児童の利用状況概要 |
| 児童登録 | 保護者側からの児童情報入力 |
| 利用予約 | 施設の利用リクエスト送信 |
| 施設一覧 | 関係する施設の詳細閲覧 |
| チャット | 施設との1対1メッセージ |
| 連絡帳 | 日々の連絡内容確認 |
| サービス記録 | 活動記録・個別報告の閲覧 |
| 招待受諾 | 施設からの招待をトークンで受理 |

---

### 3-9. キャリア（スタッフ個人）
**ページ**: `/career`, `/career/login`, `/career/signup`, `/career/setup`

| 機能 | 説明 |
|------|------|
| 個人プロフィール | 基本情報・写真・自己PR |
| 資格管理 | 保有資格の登録・更新 |
| 職歴管理 | 経歴の記録・自動蓄積 |
| 勤怠カレンダー | 個人の出勤記録閲覧 |
| シフト確認 | 割当シフトの確認・応答 |
| シフト希望提出 | 勤務可能時間の申告 |
| 有休申請 | 休暇申請の送信 |
| 求人ブラウジング | 求人検索・お気に入り・応募 |
| スカウト受信箱 | スカウトメッセージ管理 |
| 自己評価 | 定期的な自己評価提出 |
| 施設レビュー | 勤務施設の匿名レビュー |

---

### 3-10. コミュニケーション
**ページ**: `/business` → チャットタブ, コネクトタブ

| 機能 | 説明 |
|------|------|
| 保護者チャット | 施設⇔保護者のリアルタイムメッセージ |
| 施設内チャット | スタッフ間メッセージ |
| 連絡会議（コネクト） | 外部参加者を含む委員会・会議調整 |
| 日程調整 | 候補日提示・投票（調整くん風） |
| 会議リマインダー | トークンベースの外部通知 |
| スカウトメッセージ | 採用関連の直接連絡 |

**主要コンポーネント**: `ChatView.tsx`, `BusinessChatView.tsx`, `ConnectMeetingView.tsx` (65KB)

---

### 3-11. コンプライアンス・監査
**ページ**: `/business` → コンプライアンスタブ, 規程タブ

| 機能 | 説明 |
|------|------|
| 運営指導準備 | チェックリスト形式のレビューウィザード |
| インシデント報告 | 事故・ヒヤリハット記録 |
| 虐待防止 | 防止プロトコル・記録 |
| BCP（事業継続計画） | 計画策定・緊急連絡先 |
| 規程管理 | 就業規則・社内規程の配信 |
| 規程既読管理 | スタッフの閲覧追跡 |
| 監査ログ | 操作履歴の記録 |
| 監査レポート出力 | コンプライアンスレポートのエクスポート |
| 資格トラッカー | 配置基準の充足チェック |

**主要コンポーネント**: `ComplianceView.tsx`, `AbusePreventionPanel.tsx`, `BcpManagementPanel.tsx`, `AuditLogView.tsx`, `AuditExportView.tsx`

---

### 3-12. タレントマネジメント
**ページ**: `/business` → タレントマネジメントタブ, 研修タブ, 自己評価タブ

| 機能 | 説明 |
|------|------|
| パフォーマンス分析 | スタッフの能力・成長分析 |
| 研修記録 | 受講記録・研修計画 |
| 自己評価 | カテゴリ別の定期評価 |
| キャリア開発 | キャリアパス要件・進捗 |

**主要コンポーネント**: `TalentManagementView.tsx`, `TrainingRecordView.tsx`, `SelfEvaluationView.tsx` (38KB)

---

### 3-13. シミュレーション・計画
**ページ**: `/business` → 加算設定内のシミュレーションタブ

| 機能 | 説明 |
|------|------|
| 人員配置シミュレーター | 人員増減の影響分析 |
| 加算シミュレーター | 加算取得の収益試算 |
| 収益予測 | 月次収益のフォーキャスト |
| 最適化分析 | コスト対効果の分析 |

**主要コンポーネント**: `StaffPlanningSimulator.tsx`, `AdditionSimulatorView.tsx`, `MonthlyRevenueTab.tsx`

---

### 3-14. 文書管理
**ページ**: `/business` → 文書タブ

| 機能 | 説明 |
|------|------|
| ファイルアップロード | Supabase Storage連携 |
| 文書種別設定 | カスタム文書カテゴリ |
| 支援計画ファイル | 計画書の添付管理 |
| 行政文書提出 | 行政向け書類の管理 |
| 既読管理 | 文書閲覧の追跡 |

**主要コンポーネント**: `DocumentManagementView.tsx`

---

### 3-15. プラットフォーム管理（全施設統括）
**ページ**: `/admin`, `/admin/platform`, `/owner-setup`

| 機能 | 説明 |
|------|------|
| 全施設ダッシュボード | 利用児童数・収益・稼働率の横断表示 |
| ベンチマーク | 施設間の比較分析 |
| 戦略インサイト | AI分析による改善提案 |
| 施設招待 | 新規施設のオンボーディング |
| システム設定 | プラットフォーム全体の設定 |

**主要コンポーネント**: `PlatformDashboardPage.tsx` (98KB)

---

### 3-16. 認証・オンボーディング
**ページ**: 各ログイン/サインアップページ

| 機能 | 説明 |
|------|------|
| メール認証 | メール+パスワード |
| パスキー認証 | WebAuthn対応 |
| OTP認証 | ワンタイムパスワード |
| マルチロール | career / client / admin |
| 施設招待フロー | トークン→登録→紐付け |
| 保護者招待フロー | 施設→保護者への招待 |
| アカウント有効化 | トークンベースの有効化 |
| パスワードリセット | メールベースのリセット |
| ログインID検索 | 登録メールからIDを検索 |

---

### 3-17. ツール（無料公開）
**ページ**: `/tools/*`

| 機能 | 説明 |
|------|------|
| 履歴書ジェネレーター | フォーム入力→PDF生成 |
| 職務経歴書ジェネレーター | 経歴入力→CV生成 |
| 経歴証明書 | 勤務証明書の生成 |
| キャリアタイムライン | 経歴の可視化 |
| 給与シミュレーター | 処遇改善加算の試算 |

---

### 3-18. 通知システム

| 機能 | 説明 |
|------|------|
| Push通知 | PWA Service Worker |
| メール通知 | Resend API経由 |
| アプリ内通知 | 通知ベル・一覧 |
| 通知設定 | ユーザーごとの配信設定 |
| 採用通知 | 応募・マッチ・ステータス変更 |

---

### 3-19. 分析・レポート

| 機能 | 説明 |
|------|------|
| 経営ダッシュボード | KPI（稼働率・収益・人件費率） |
| 採用分析 | 応募チャネル・採用ファネル |
| 財務レポート | 月次/年次のP/L |
| Excel出力 | データのXLSXエクスポート |
| PDF出力 | 帳票・証明書のPDF生成 |
| 監査レポート | コンプライアンスレポート |

---

### 3-20. 行政連携（将来拡張）

| 機能 | 説明 |
|------|------|
| 自治体リンク | 行政組織との接続管理 |
| 行政アカウント | 行政向けログイン |
| 行政文書 | 提出文書の管理 |
| 法改正追跡 | 報酬改定等の変更管理 |

---

## 4. アーキテクチャ

### 4-1. マルチテナント設計
- `facility_id` をテナントキーとしたデータ分離
- Supabase RLS（Row-Level Security）による行レベルアクセス制御
- `employment_records` でスタッフ⇔施設の関係を管理

### 4-2. ルーティング
```
/ ...................... トップ（施設管理者/スタッフ/保護者の入口）
/business .............. 施設管理（タブ切替で全管理機能）
/career ................ スタッフ個人ダッシュボード
/parent ................ 保護者ポータル
/admin ................. プラットフォーム管理
/jobs .................. 求人ボード（公開）
/tools ................. 無料ツール（公開）
/facilities/[code] ..... 施設公開ページ
```

### 4-3. 権限設計（RBAC）
| ロール | 権限 |
|--------|------|
| Admin | 全施設アクセス |
| Manager | 管理権限（設定変更・承認） |
| Staff | 業務権限（記録・閲覧） |

細粒度権限: `schedule`, `children`, `staff`, `shift`, `facility`, `dailyLog`, `supportPlan`, `incident`, `training`, `auditPreparation`, `compliance`, `billing`

### 4-4. 主要パターン
- **Facade Hook**: `useFacilityData` がドメイン別hookを集約
- **Dynamic Import**: 大型コンポーネントの遅延読み込み
- **PWA**: Service Worker + Push通知
- **ミドルウェア**: ルートガード + CSP + キャッシュ制御

---

## 5. データベース（160+ テーブル）

### 主要テーブル群
| カテゴリ | 主要テーブル |
|----------|-------------|
| ユーザー | `users`, `user_careers`, `employment_records` |
| 施設 | `facilities`, `facility_settings`, `facility_settings_history` |
| スタッフ | `staff_profiles`, `staff_qualifications`, `staff_personnel_settings` |
| 児童 | `children`, `facility_children`, `child_additions`, `upper_limit_management` |
| スケジュール | `schedules`, `usage_records`, `usage_requests` |
| シフト | `shift_patterns`, `shifts`, `shift_confirmations`, `shift_availability_submissions` |
| 勤怠 | `attendance_records`, `paid_leave_balances` |
| 請求 | `billing_records`, `billing_details`, `monthly_financials` |
| 求人 | `job_postings`, `job_applications`, `scout_messages`, `interview_slots` |
| コミュニケーション | `chat_messages`, `connect_meetings`, `committee_meetings` |
| コンプライアンス | `incident_reports`, `audit_logs`, `bcp_plans`, `regulation_acknowledgments` |
| 文書 | `document_uploads`, `support_plan_files` |
| 通知 | `notifications`, `push_subscriptions` |

---

## 6. API エンドポイント（22本）

| カテゴリ | エンドポイント |
|----------|---------------|
| 認証 | `POST /api/auth/login`, `/api/otp/send`, `/api/otp/verify` |
| パスキー | `/api/passkey/register/begin\|finish`, `/api/passkey/authenticate/begin\|finish` |
| メール | `/api/send-welcome-email`, `/api/send-contract-invitation`, `/api/send-certificate-request` |
| 通知 | `/api/notifications/send` |
| 採用 | `/api/recruitment/notify-application\|notify-match\|notify-status-change` |
| 会議 | `/api/connect/send-invitation\|send-confirmation\|send-reminder` |
| 文書 | `/api/generate-certificate-pdf` |
| 決済 | `/api/stripe/create-customer\|create-checkout\|create-invoice-pdf\|webhook` |

---

## 7. 外部サービス連携

| サービス | 用途 |
|----------|------|
| Supabase | DB・Auth・Storage・RLS |
| Stripe | サブスク決済・請求書 |
| Resend | トランザクションメール |
| Google Maps | ジオコーディング・送迎ナビ |
| Sentry | エラー監視（現在無効） |
| Google Analytics | ユーザー行動分析 |

---

## 8. 動作確認ステータス（2026-02-27）

| チェック項目 | 結果 |
|---|---|
| ビルド (`next build`) | ✅ 成功（Warning のみ、Error なし） |
| 静的ページ (41ページ) | ✅ 全ページ HTTP 200 |
| 動的ページ (14ページ) | ✅ 全ページ HTTP 200 |
| APIエンドポイント (8本テスト) | ✅ 正常応答 (405/400 = POST専用の正常動作) |
| サーバーログ | ✅ エラーなし |
| コンパイル | ✅ 全ルートでコンパイル成功 |
