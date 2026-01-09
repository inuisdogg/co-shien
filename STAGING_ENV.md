# ステージング環境情報

## ステージング環境（本番環境プロジェクトID使用）

### Supabase設定

**プロジェクトID**: `iskgcqzozsemlmbvubna`

**Supabase URL**: 
```
https://iskgcqzozsemlmbvubna.supabase.co
```

**Supabase Anon Key**: 
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE
```

### 環境変数設定

`.env.local` または `.env.staging` ファイルに以下を設定してください：

```env
NEXT_PUBLIC_SUPABASE_URL=https://iskgcqzozsemlmbvubna.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDYxODcsImV4cCI6MjA4MjQyMjE4N30.6LiAmoCLyZbAA1QfytTDTFKnnXu-ndfG57KW-tKEiAE
```

### Supabase CLI リンク

```bash
supabase link --project-ref iskgcqzozsemlmbvubna
```

### データベース状態

- ✅ すべてのテーブルが存在
- ✅ すべてのマイグレーション適用済み（20件）
- ✅ 開発環境と構造が一致

### 注意事項

⚠️ この環境は本番環境のプロジェクトIDを使用しています。
動作確認後、問題がなければ本番環境として使用可能です。

