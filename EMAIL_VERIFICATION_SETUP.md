# メール認証設定ガイド

## Supabaseダッシュボードでの設定確認

メール認証機能が動作しない場合、以下の設定を確認してください：

### 1. メール認証の有効化
1. Supabaseダッシュボードにログイン
2. プロジェクトを選択
3. **Authentication** → **Settings** に移動
4. **Email Auth** セクションで以下を確認：
   - ✅ **Enable email confirmations** が有効になっているか
   - ✅ **Enable email signup** が有効になっているか

### 2. リダイレクトURLの設定
1. **Authentication** → **URL Configuration** に移動
2. **Redirect URLs** に以下を追加：
   - `http://localhost:3000/auth/callback`
   - `https://my.co-shien.inu.co.jp/auth/callback`
   - `https://biz.co-shien.inu.co.jp/auth/callback`
   - 開発環境のURL（例: `https://your-project.supabase.co/auth/callback`）

### 3. メール送信の設定
1. **Authentication** → **Email Templates** に移動
2. **Confirm signup** テンプレートが有効になっているか確認
3. メール送信サービス（SMTP）が設定されているか確認
   - デフォルトではSupabaseのメールサービスを使用
   - カスタムSMTPを使用する場合は設定が必要

### 4. 権限の確認
- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しく設定されているか確認
- `.env.local` ファイルに環境変数が設定されているか確認

## トラブルシューティング

### メールが届かない場合
1. 迷惑メールフォルダを確認
2. Supabaseダッシュボードの **Logs** → **Auth Logs** でメール送信ログを確認
3. メール送信のレート制限に達していないか確認

### 認証コードの交換に失敗する場合
1. リダイレクトURLが正しく設定されているか確認
2. 認証コードの有効期限（通常は1時間）を確認
3. ブラウザのコンソールでエラーメッセージを確認

## 必要な権限

メール認証機能を使用するには、以下の権限が必要です：
- Supabaseプロジェクトへのアクセス権限
- Authentication設定の変更権限（プロジェクトオーナーまたは管理者）

権限が不足している場合は、プロジェクトオーナーに連絡してください。

