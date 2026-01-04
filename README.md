# KidOS - 児童発達支援管理システム

児童発達支援事業所向けのSaaS管理システムです。

## 機能

- **ダッシュボード**: 売上見込、承認待ちリクエスト、稼働率などの概要表示
- **利用調整・予約**: 週間/月間カレンダー表示、予約管理、承認待ちリクエスト処理
- **児童管理**: 利用児童の台帳管理、受給者証情報の管理
- **勤怠・シフト**: スタッフのマスタ管理、シフト作成、配置基準チェック
- **収支管理**: 売上や人件費の概算表示（今後拡張予定）

## 技術スタック

- **Next.js 14**: React フレームワーク
- **TypeScript**: 型安全性
- **Tailwind CSS**: スタイリング
- **Lucide React**: アイコン
- **Recharts**: グラフ表示

## マルチテナント対応

本システムはマルチテナント構造に対応しています：

- **施設単位でのデータ分離**: 各施設のデータは `facilityId` で管理
- **3階層のユーザー管理**: 
  - 管理者（admin）: 全機能へのアクセス
  - スタッフ（staff）: 制限された機能へのアクセス
- **認証・認可**: `AuthContext` でユーザー情報と施設情報を管理

## プロジェクト構造

```
src/
  ├── app/                    # Next.js App Router
  │   ├── layout.tsx         # ルートレイアウト
  │   ├── page.tsx           # メインページ
  │   └── globals.css        # グローバルスタイル
  ├── components/             # Reactコンポーネント
  │   ├── common/            # 共通コンポーネント
  │   │   ├── Sidebar.tsx
  │   │   └── Header.tsx
  │   ├── dashboard/         # ダッシュボード
  │   ├── schedule/          # スケジュール管理
  │   ├── children/          # 児童管理
  │   ├── staff/             # スタッフ管理
  │   └── finance/           # 収支管理
  ├── contexts/              # React Context
  │   └── AuthContext.tsx    # 認証・テナント管理
  ├── hooks/                 # カスタムフック
  │   └── useFacilityData.ts # 施設データ管理
  └── types/                 # TypeScript型定義
      ├── index.ts           # 型定義
      └── mockData.ts       # モックデータ
```

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 環境変数の設定:
プロジェクトルートに `.env.local` ファイルを作成し、以下の内容を追加してください:
```env
NEXT_PUBLIC_SUPABASE_URL=https://iskgcqzozsemlmbvubna.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE
```

3. Supabaseデータベースのセットアップ:
SupabaseダッシュボードのSQL Editorで `supabase_setup.sql` の内容を実行して、`facility_settings` テーブルを作成してください。

4. 開発サーバーの起動:

通常の開発サーバー:
```bash
npm run dev
```
ブラウザで `http://localhost:3000` を開く

Netlify環境でのローカルテスト（推奨）:
```bash
# Netlify CLIのインストール（初回のみ）
npm install -g netlify-cli

# Netlify環境で起動
netlify dev
```

Netlify環境でのテスト手順:
1. ブラウザでサブドメインを使用してアクセス（`/etc/hosts`を編集して設定）
   - `biz.localhost:8888` (Biz側)
   - `my.localhost:8888` (Personal側)
2. ブラウザの開発者ツールでNetworkタブを開く
3. ページ（一番上の項目）をクリック
4. Response Headersを確認:
   - `x-debug-subdomain: biz` または `x-debug-subdomain: my` が表示されれば成功
   - `x-debug-subdomain: none` の場合は、サブドメインの取得に失敗しています

## Supabase連携

本システムはSupabaseを使用してデータを保存します。

### データベーステーブル

- `facility_settings`: 施設情報設定（施設名、定休日、営業時間、受け入れ人数など）

### 施設名の設定

1. アプリケーションの「施設情報」メニューを開く
2. 「施設名設定」セクションで施設名を入力
3. 「保存」ボタンをクリック
4. サイドバーの下部に施設名が表示されます

## 今後の拡張予定

- [ ] バックエンドAPI連携
- [ ] ログイン機能の実装（JWT等）
- [ ] その他のデータベース連携（児童、スタッフ、スケジュールなど）
- [ ] 保護者向けポータル
- [ ] レポート機能の拡充
- [ ] 通知機能
- [ ] ファイルアップロード機能

## 注意事項

- アカウント作成機能は現段階では実装していません。ログイン機能のみを実装予定です。

## ライセンス

Private

