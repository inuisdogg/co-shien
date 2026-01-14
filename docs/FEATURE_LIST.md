# co-shien 機能一覧

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | co-shien（コシエン） |
| 種別 | 障害児通所支援施設向け統合管理システム |
| 技術スタック | Next.js 14 + TypeScript + Supabase |
| デプロイ | Netlify |

---

## ユーザータイプ

| タイプ | 対象 | ドメイン |
|--------|------|----------|
| staff | 事業所スタッフ・管理者 | biz.co-shien.inu.co.jp |
| client | 利用者（保護者） | my.co-shien.inu.co.jp |

---

## Biz側（スタッフ向け）機能一覧

### カテゴリ1: 利用者管理

| # | 機能名 | タブ名 | 説明 | 優先度 |
|---|--------|--------|------|--------|
| 1 | ダッシュボード | dashboard | 売上・利用者数・スタッフ出勤率などのKPI表示 | |
| 2 | 利用調整・予約 | schedule | 児童の利用予定管理、AM/PMスロット割り当て | |
| 3 | 児童管理 | children | 登録児童一覧、個別情報編集、受給者証管理 | |
| 4 | 送迎ルート | transport | 送迎ルートの設定・管理、乗車位置マップ | |
| 5 | チャット | chat | 利用者（保護者）とのリアルタイムメッセージング | |
| 6 | コネクト | connect | 複数施設間の情報共有、児童移行連携 | |
| 7 | リード管理 | lead | 問い合わせ・見学申し込み管理 | |

### カテゴリ2: 日誌・記録管理

| # | 機能名 | タブ名 | 説明 | 優先度 |
|---|--------|--------|------|--------|
| 8 | 業務日誌 | daily-log | 日々の業務記録、実績入力 | |
| 9 | 個別支援計画 | support-plan | 児童ごとの個別支援計画の作成・管理 | |
| 10 | 苦情・事故報告 | incident | インシデント報告、苦情対応記録 | |
| 11 | 研修記録 | training | スタッフの研修・セミナー参加記録管理 | |
| 12 | 委員会管理 | committee | 運営委員会、保護者会等の開催記録 | |
| 13 | 運営指導準備 | audit-preparation | 行政監査対応書類の整理、チェックリスト | |
| 14 | 書類管理 | documents | 契約書、同意書などの電子書類管理 | |

### カテゴリ3: スタッフ管理

| # | 機能名 | タブ名 | 説明 | 優先度 |
|---|--------|--------|------|--------|
| 15 | スタッフ管理 | staff | スタッフ一覧、雇用記録、権限設定、招待管理 | |
| 16 | シフト管理 | shift | 月間シフト作成、確認機能、有給・代休管理 | |

### カテゴリ4: 経営・財務管理

| # | 機能名 | タブ名 | 説明 | 優先度 |
|---|--------|--------|------|--------|
| 17 | 損益計算書 | profit-loss | 月間・年間の収支分析ダッシュボード | |
| 18 | キャッシュフロー | cash-flow | 現金流出入の分析・予測 | |
| 19 | 経費管理 | expense-management | 経費申請、領収書管理、承認フロー | |
| 20 | 経営設定 | management | 売上・加算分析、基本設定 | |

### カテゴリ5: 設定

| # | 機能名 | タブ名 | 説明 | 優先度 |
|---|--------|--------|------|--------|
| 21 | 施設情報 | facility | 施設基本情報、営業時間、定員設定 | |
| 22 | 利用者招待 | client-invitation | 保護者のアカウント招待・招待リンク管理 | |

---

## Client側（保護者向け）機能一覧

| # | 機能名 | パス | 説明 | 優先度 |
|---|--------|------|------|--------|
| 23 | 利用者ログイン | /client/login | 保護者向けログイン画面 | |
| 24 | 利用者新規登録 | /client/signup | 保護者アカウント作成 | |
| 25 | 利用者ダッシュボード | /client/dashboard | 児童一覧、契約施設一覧、実績記録、お知らせ | |
| 26 | 児童詳細 | /client/children/[id] | 児童の利用実績、利用申し込み、受給者証管理 | |
| 27 | 利用申し込み | /client/children/[id]/usage-request | 利用日・時間帯の申し込み | |
| 28 | 児童登録 | /client/children/register | 新規児童の登録フロー | |
| 29 | 施設情報ページ | /client/facilities/[facilityId] | 施設概要、連絡先等 | |
| 30 | チャット | /client/facilities/[facilityId]/chat | 施設とのメッセージング | |
| 31 | お問い合わせ | /client/facilities/[facilityId]/contact | 施設への問い合わせフォーム | |
| 32 | 利用実績 | /client/facilities/[facilityId]/records | 過去の利用記録・出席状況 | |
| 33 | 招待リンク受け入れ | /client/invitations/[token] | 施設からの招待リンク処理 | |

---

## パーソナル（スタッフ個人向け）機能一覧

| # | 機能名 | パス | 説明 | 優先度 |
|---|--------|------|------|--------|
| 34 | パーソナルダッシュボード | /personal-dashboard | 勤務状況、シフト管理、有給残日数 | |
| 35 | パーソナルチャット | /personal-dashboard/chat | チャット機能 | |
| 36 | パーソナル初期設定 | /personal/setup | 個人情報設定 | |
| 37 | パーソナル新規登録 | /personal/signup | パーソナルアカウント作成 | |

---

## 共通・認証機能

| # | 機能名 | パス | 説明 | 優先度 |
|---|--------|------|------|--------|
| 38 | スタッフログイン | /login | ログインID・パスワード + パスキー認証対応 | |
| 39 | スタッフ新規登録 | /signup | 新規アカウント登録 | |
| 40 | ポータル | /portal | 施設選択・パーソナルダッシュボード | |
| 41 | アカウント有効化 | /activate/[token] | 招待リンクから新規登録完了処理 | |
| 42 | 施設初期設定 | /facility-setup | 施設アカウント初期セットアップ | |

---

## APIエンドポイント一覧

| # | エンドポイント | メソッド | 説明 | 優先度 |
|---|---------------|----------|------|--------|
| 43 | /api/otp/send | POST | OTP（ワンタイムパスワード）送信 | |
| 44 | /api/otp/verify | POST | OTP検証 | |
| 45 | /api/passkey/register/begin | POST | パスキー登録開始 | |
| 46 | /api/passkey/register/finish | POST | パスキー登録完了 | |
| 47 | /api/passkey/authenticate/begin | POST | パスキー認証開始 | |
| 48 | /api/passkey/authenticate/finish | POST | パスキー認証完了 | |
| 49 | /api/connect/send-invitation | POST | コネクト招待メール送信 | |
| 50 | /api/connect/send-confirmation | POST | コネクト確認メール送信 | |
| 51 | /api/send-welcome-email | POST | ウェルカムメール送信 | |
| 52 | /api/send-certificate-request | POST | 実務経験証明申請メール送信 | |
| 53 | /api/send-contract-invitation | POST | 契約招待メール送信 | |
| 54 | /api/generate-certificate-pdf | POST | 実務経験証明書PDF生成 | |

---

## データベーステーブル一覧（主要）

### コアテーブル

| テーブル名 | 説明 | 優先度 |
|-----------|------|--------|
| facilities | 事業所（テナント）情報 | |
| users | 個人アカウント | |
| employment_records | スタッフと施設の関係性 | |
| facility_settings | 施設の営業時間、定員、休業日等 | |
| children | 児童情報 | |
| schedules | 利用予定（AM/PMスロット） | |
| staff | スタッフ情報（後方互換） | |
| contracts | 契約情報 | |

### シフト管理系

| テーブル名 | 説明 | 優先度 |
|-----------|------|--------|
| shift_patterns | シフトパターン定義 | |
| monthly_shift_schedules | 月間シフトスケジュール | |
| shifts | シフト | |
| shift_confirmations | シフト確認 | |
| staff_leave_settings | 有給・代休設定 | |

### 経費・財務系

| テーブル名 | 説明 | 優先度 |
|-----------|------|--------|
| expense_categories | 経費カテゴリ | |
| expenses | 経費 | |
| monthly_financials | 月次財務サマリー | |

### 報酬・加算系

| テーブル名 | 説明 | 優先度 |
|-----------|------|--------|
| service_types | サービス種別 | |
| regional_units | 地域区分 | |
| base_rewards | 基本報酬 | |
| addition_categories | 加算カテゴリ | |
| additions | 加算 | |
| deductions | 減算 | |
| child_additions | 児童別加算 | |
| facility_addition_settings | 施設加算設定 | |
| daily_addition_records | 日次加算記録 | |
| monthly_revenue_estimates | 月間売上見込み | |

### その他

| テーブル名 | 説明 | 優先度 |
|-----------|------|--------|
| chat_messages | チャットメッセージ | |
| daily_logs | 業務日誌 | |
| service_plans | 個別支援計画 | |
| incident_reports | 苦情・事故報告 | |
| training_records | 研修記録 | |
| committee_meetings | 委員会 | |
| audit_checklists | 監査チェックリスト | |
| document_uploads | 書類アップロード | |
| notifications | 通知 | |
| paid_leave_records | 有給記録 | |

---

## 直近の開発履歴

| コミット | 内容 |
|---------|------|
| fdc3a36 | 売上・加算分析ダッシュボード機能の追加 |
| e058a33 | 障害児通所支援の報酬・加算管理DB構築 |
| e60db44 | シフト管理機能追加とBizサイドバーUX改善 |
| e36e857 | 勤怠カレンダー刷新と有給管理機能の追加 |
| cbf72b3 | スタッフ管理画面UI改善と姓名分離対応 |

---

## 優先度の目安

| 優先度 | 意味 |
|--------|------|
| **P0** | 必須（これがないとサービスが成り立たない） |
| **P1** | 高（初期リリースに必要） |
| **P2** | 中（あると便利、次フェーズ） |
| **P3** | 低（将来的に検討） |
| **保留** | 一旦開発停止 |

---

## 統計

- **Biz側機能**: 22個
- **Client側機能**: 11個
- **パーソナル機能**: 4個
- **共通・認証機能**: 5個
- **APIエンドポイント**: 12個
- **DBマイグレーション**: 81個
- **合計機能数**: 約54個
