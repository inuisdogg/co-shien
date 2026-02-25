# メール認証フロー実装ガイド

## 実装概要

ユーザー登録時にSupabaseのメール認証機能を有効化し、メール認証が完了するまで施設セットアップ画面に進めないようにガードを実装しました。

## 実装内容

### 1. Supabaseのメール認証設定

詳細は `SUPABASE_EMAIL_AUTH_SETUP.md` を参照してください。

**必須設定**:
- Supabaseダッシュボードで「Enable email confirmations」を有効化
- リダイレクトURLに以下を追加：
  - `https://roots.inu.co.jp/business/auth/callback?type=biz`
  - `https://roots.inu.co.jp/career/auth/callback?type=personal`

### 2. Resendのセットアップ

詳細は `RESEND_SETUP_GUIDE.md` を参照してください。

**必須環境変数**:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@resend.dev  # 開発環境
# RESEND_FROM_EMAIL=noreply@roots.inu.co.jp  # 本番環境
```

### 3. 実装されたページと機能

#### サインアップページ
- **Biz側**: `/signup`
- **Personal側**: `/personal/signup`
- Supabase Authを使用してサインアップ
- メール認証待機ページにリダイレクト

#### メール認証待機ページ
- **Biz側**: `/signup/waiting`
- **Personal側**: `/personal/signup/waiting`
- 5秒ごとにメール認証状態をチェック
- 認証完了時に自動的に`/setup`ページにリダイレクト

#### セットアップページ
- **Biz側**: `/setup`
- **Personal側**: `/personal/setup`
- メール認証完了後に自動的に表示
- **Biz側**: 施設IDを発行し、ウェルカムメールを送信
- **Personal側**: ウェルカムメールを送信

#### 認証コールバック
- **パス**: `/auth/callback`
- Supabase Authのメール認証リンクから呼び出される
- 認証完了後、適切な`/setup`ページにリダイレクト

#### 施設セットアップページ（ガード追加）
- **パス**: `/admin-setup`
- メール認証が完了していない場合、サインアップページにリダイレクト

### 4. フロー図

#### Biz側のフロー
```
1. /signup でサインアップ
   ↓
2. Supabase Authでメール認証メールを送信
   ↓
3. /signup/waiting でメール認証待機
   ↓
4. ユーザーがメール内のリンクをクリック
   ↓
5. /auth/callback で認証処理
   ↓
6. /setup にリダイレクト
   ↓
7. 施設IDを発行 + ウェルカムメール送信
```

#### Personal側のフロー
```
1. /personal/signup でサインアップ
   ↓
2. Supabase Authでメール認証メールを送信
   ↓
3. /personal/signup/waiting でメール認証待機
   ↓
4. ユーザーがメール内のリンクをクリック
   ↓
5. /auth/callback?type=personal で認証処理
   ↓
6. /personal/setup にリダイレクト
   ↓
7. ウェルカムメール送信
```

## セキュリティ対策

### メール認証ガード
- `/admin-setup`ページにアクセスする前に、メール認証が完了しているか確認
- 未認証の場合は自動的にサインアップページにリダイレクト

### セッション管理
- Supabase Authのセッションを使用
- メール認証状態（`email_confirmed_at`）を確認

## テスト方法

### 1. サインアップフローのテスト

1. `/signup`（Biz側）または`/personal/signup`（Personal側）にアクセス
2. フォームに入力してサインアップ
3. メール認証待機ページが表示されることを確認
4. メールボックスで確認メールを確認
5. メール内のリンクをクリック
6. `/setup`ページにリダイレクトされることを確認
7. 施設ID（Biz側）が表示され、ウェルカムメールが送信されることを確認

### 2. メール認証ガードのテスト

1. メール認証が完了していない状態で`/admin-setup`にアクセス
2. 自動的にサインアップページにリダイレクトされることを確認

## トラブルシューティング

### メールが届かない場合
1. 迷惑メールフォルダを確認
2. Supabaseダッシュボードでメール送信設定を確認
3. リダイレクトURLが正しく設定されているか確認

### 認証コールバックが動作しない場合
1. SupabaseダッシュボードのリダイレクトURL設定を確認
2. `/auth/callback`がMiddlewareで除外されているか確認

### ウェルカムメールが送信されない場合
1. Resend APIキーが正しく設定されているか確認
2. 環境変数`RESEND_API_KEY`と`RESEND_FROM_EMAIL`を確認
3. ブラウザのコンソールでエラーログを確認

## 注意事項

- Supabase Authとusersテーブルの同期が必要
- メール認証が完了するまで、施設セットアップは実行できない
- Resendの無料プランには送信制限がある（月100通まで）

