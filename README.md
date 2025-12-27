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

2. 開発サーバーの起動:
```bash
npm run dev
```

3. ブラウザで `http://localhost:3000` を開く

## 今後の拡張予定

- [ ] バックエンドAPI連携
- [ ] 認証システムの実装（JWT等）
- [ ] データベース連携（PostgreSQL等）
- [ ] 保護者向けポータル
- [ ] レポート機能の拡充
- [ ] 通知機能
- [ ] ファイルアップロード機能

## ライセンス

Private

