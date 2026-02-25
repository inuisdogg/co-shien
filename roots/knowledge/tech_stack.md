# 技術スタック・開発環境

## フロントエンド

### フレームワーク
- **Next.js 14**: App Router 使用（`src/app/` ディレクトリ構成）
- **React 18**: コンポーネントベースのUI構築
- **TypeScript**: 型安全性の確保

### スタイリング
- **Tailwind CSS**: ユーティリティファーストCSS
- **Lucide React**: アイコンライブラリ

### チャート・ビジュアライゼーション
- **Recharts**: グラフ表示

---

## バックエンド・データベース

### BaaS
- **Supabase**: PostgreSQLベースのBaaS
  - 認証（Auth）
  - データベース（PostgreSQL）
  - リアルタイムサブスクリプション
  - Row Level Security (RLS)
  - Edge Functions

### データベーステーブル（主要）
- `users`: ユーザーアカウント（キャリア/保護者/管理者）
- `facilities`: 施設情報
- `facility_settings`: 施設設定
- `facility_time_slots`: 時間枠設定
- `employment_records`: 雇用関係
- `attendance_records`: 勤怠記録
- `children`: 利用児童
- `contracts`: 契約管理
- `contract_invitations`: 招待管理
- `schedules`: スケジュール
- `usage_records`: 利用実績
- `daily_addition_records`: 日次加算記録

---

## デプロイ・インフラ

### ホスティング
- **Netlify**: フロントエンドのデプロイ
  - `netlify.toml` でビルド設定
  - Netlify Functions（サーバーサイド処理）
  - サブドメインルーティング（biz.* / my.*）

### メール送信
- **Resend**: トランザクショナルメール

---

## プロジェクトディレクトリ構成

```
src/
  ├── app/                      # Next.js App Router
  │   ├── layout.tsx            # ルートレイアウト
  │   ├── page.tsx              # メインページ
  │   └── globals.css           # グローバルスタイル
  ├── components/                # Reactコンポーネント
  │   ├── common/               # 共通コンポーネント
  │   │   ├── Sidebar.tsx       # サイドバーナビゲーション
  │   │   └── Header.tsx        # ヘッダー
  │   ├── dashboard/            # ダッシュボード
  │   │   ├── DashboardView.tsx
  │   │   ├── RevenueAnalytics.tsx
  │   │   └── ComplianceManagement.tsx
  │   ├── schedule/             # スケジュール管理
  │   │   ├── ScheduleView.tsx
  │   │   └── ChildCard.tsx
  │   ├── children/             # 児童管理
  │   │   └── ChildrenView.tsx
  │   ├── staff/                # スタッフ管理
  │   │   ├── master/           # スタッフマスタ
  │   │   ├── shift/            # シフト管理
  │   │   └── staffing/         # 人員配置
  │   ├── finance/              # 収支管理
  │   ├── logs/                 # 業務日誌
  │   │   ├── DailyLogView.tsx
  │   │   └── UsageRecordForm.tsx
  │   ├── settings/             # 設定
  │   │   ├── FacilitySettingsView.tsx
  │   │   └── FacilityAdditionSettings.tsx
  │   ├── simulation/           # シミュレーション
  │   │   ├── AdditionSimulationView.tsx
  │   │   └── ChildAdditionCard.tsx
  │   ├── management/           # 経営管理
  │   │   ├── AdditionCatalogView.tsx
  │   │   └── ProfitLossView.tsx
  │   └── transport/            # 送迎管理
  │       └── TransportRouteView.tsx
  ├── contexts/                  # React Context
  │   └── AuthContext.tsx        # 認証・テナント管理
  ├── hooks/                     # カスタムフック
  │   ├── useFacilityData.ts    # 施設データ管理
  │   ├── useStaffMaster.ts     # スタッフマスタ
  │   ├── useShiftManagement.ts # シフト管理
  │   ├── useStaffingCompliance.ts # 人員配置コンプライアンス
  │   └── useAdditionSimulation.ts # 加算シミュレーション
  ├── types/                     # TypeScript型定義
  │   ├── index.ts              # メイン型定義
  │   └── mockData.ts           # モックデータ
  └── utils/                     # ユーティリティ
      ├── supabase.ts           # Supabaseクライアント
      ├── additionCalculator.ts # 加算計算
      ├── dashboardCalculations.ts # ダッシュボード計算
      ├── staffingComplianceCalculator.ts # 人員配置計算
      ├── staffInvitationService.ts # スタッフ招待
      └── experienceVerificationService.ts # 実務経験証明
```

---

## 環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
ENABLE_BETA=true  # Phase 2機能の表示制御
```

---

## 開発コマンド

```bash
# 依存関係インストール
npm install

# 通常の開発サーバー
npm run dev

# Netlify環境でのローカルテスト（推奨）
netlify dev

# ビルド
npm run build
```

### Netlify環境テスト
- `biz.localhost:8888` （Biz側）
- `my.localhost:8888` （Personal側）
- Response Headers で `x-debug-subdomain` を確認

---

## マイグレーション

SQLマイグレーションファイルはプロジェクトルートまたは `migrations/` ディレクトリに配置。SupabaseダッシュボードのSQL Editorで実行する。

主なマイグレーション:
- `supabase_setup.sql`: 初期テーブル作成
- `migrate_to_career_platform.sql`: キャリアプラットフォーム移行

---

*最終更新: 2026-02-25*
