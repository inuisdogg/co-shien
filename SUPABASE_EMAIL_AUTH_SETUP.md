# Supabaseメール認証セットアップガイド

## 1. Supabaseダッシュボードでの設定

### メール認証の有効化

1. Supabaseダッシュボードにログイン
2. プロジェクトを選択
3. 「Authentication」→「Settings」に移動
4. 「Email Auth」セクションで以下を設定：

#### 必須設定
- ✅ **Enable email confirmations**: 有効化
- ✅ **Enable email signup**: 有効化

#### メールテンプレートのカスタマイズ（オプション）
- 「Email Templates」セクションで確認メールのテンプレートをカスタマイズ可能
- リダイレクトURLを設定：`https://roots.inu.co.jp/business/setup?type=confirm`（Biz側）
- リダイレクトURLを設定：`https://roots.inu.co.jp/career/setup?type=confirm`（Personal側）

### リダイレクトURLの設定

1. 「Authentication」→「URL Configuration」に移動
2. 「Redirect URLs」に以下を追加：
   ```
   https://roots.inu.co.jp/business/setup
   https://roots.inu.co.jp/career/setup
   https://roots.inu.co.jp/business/setup?type=confirm
   https://roots.inu.co.jp/career/setup?type=confirm
   ```

### メール送信設定

1. 「Authentication」→「Settings」→「SMTP Settings」に移動
2. カスタムSMTPを使用する場合：
   - SMTP Host
   - SMTP Port
   - SMTP User
   - SMTP Password
   - Sender email
   - Sender name

または、Supabaseのデフォルトメール送信を使用（開発環境では十分）

## 2. 環境変数の確認

`.env.local`ファイルに以下が設定されていることを確認：

```env
NEXT_PUBLIC_SUPABASE_URL=https://iskgcqzozsemlmbvubna.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE
```

✅ **確認済み**: `src/lib/supabase.ts`で正しく設定されています。

## 3. コードでの実装

### サインアップ時の処理

```typescript
// Supabase Authを使用してサインアップ
const { data, error } = await supabase.auth.signUp({
  email: email,
  password: password,
  options: {
    emailRedirectTo: `${window.location.origin}/setup?type=confirm`,
    data: {
      name: name,
    }
  }
});
```

### メール認証状態の確認

```typescript
// セッションを確認
const { data: { session } } = await supabase.auth.getSession();

// メール認証が完了しているか確認
if (session?.user?.email_confirmed_at) {
  // 認証完了
} else {
  // 認証待ち
}
```

## 4. 動作確認

1. サインアップを実行
2. メールボックスを確認
3. 確認メール内のリンクをクリック
4. `/setup`ページにリダイレクトされることを確認

## 参考リンク

- [Supabase Auth ドキュメント](https://supabase.com/docs/guides/auth)
- [メール認証の設定](https://supabase.com/docs/guides/auth/auth-email)

