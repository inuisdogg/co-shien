# Resendセットアップガイド

## 1. Resendアカウントの作成

1. [Resend](https://resend.com/)にアクセス
2. アカウントを作成（無料プランで開始可能）
3. メールアドレスを確認

## 2. APIキーの取得

1. Resendダッシュボードにログイン
2. 「API Keys」セクションに移動
3. 「Create API Key」をクリック
4. APIキー名を入力（例: `co-shien-production`）
5. 権限を選択（`Sending access`を選択）
6. APIキーをコピー（**このキーは一度しか表示されません**）

## 3. ドメインの検証（本番環境用）

### 開発環境
- Resendのテストドメイン（`resend.dev`）を使用可能
- 検証不要で即座に使用可能

### 本番環境
1. Resendダッシュボードで「Domains」セクションに移動
2. 「Add Domain」をクリック
3. ドメインを入力（例: `co-shien.inu.co.jp`）
4. DNSレコードを追加：
   - SPFレコード
   - DKIMレコード
   - DMARCレコード（オプション）
5. DNS設定が反映されるまで数時間かかる場合があります

## 4. 環境変数の設定

`.env.local`ファイルに以下を追加：

```env
# Resend API Key
RESEND_API_KEY=re_aLVRb3dN_MqCRib9e9G7BGMLSHVxaf9Ym

# 送信元メールアドレス（本番環境）
RESEND_FROM_EMAIL=noreply@co-shien.inu.co.jp

# 送信元メールアドレス（開発環境）
# RESEND_FROM_EMAIL=noreply@resend.dev
```

## 5. Netlify環境変数の設定

1. Netlifyダッシュボードにログイン
2. プロジェクトを選択
3. 「Site settings」→「Environment variables」に移動
4. 以下の環境変数を追加：
   - `RESEND_API_KEY`: ResendのAPIキー
   - `RESEND_FROM_EMAIL`: 送信元メールアドレス

## 6. パッケージのインストール

```bash
npm install resend
```

## 7. 動作確認

APIキーが正しく設定されているか確認：

```bash
# 環境変数を確認
echo $RESEND_API_KEY
```

## 参考リンク

- [Resend公式ドキュメント](https://resend.com/docs)
- [Resend APIリファレンス](https://resend.com/docs/api-reference)

