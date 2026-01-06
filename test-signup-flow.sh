#!/bin/bash

# 新規登録フローの動作確認用スクリプト
# 使用方法: ./test-signup-flow.sh

echo "=========================================="
echo "新規登録フロー動作確認スクリプト"
echo "=========================================="
echo ""

# 環境変数の確認
echo "1. 環境変数の確認"
echo "-------------------"

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL が設定されていません"
else
  echo "✅ NEXT_PUBLIC_SUPABASE_URL: 設定済み"
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません"
else
  echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: 設定済み"
fi

if [ -z "$RESEND_API_KEY" ]; then
  echo "❌ RESEND_API_KEY が設定されていません"
else
  echo "✅ RESEND_API_KEY: 設定済み"
fi

if [ -z "$RESEND_FROM_EMAIL" ]; then
  echo "❌ RESEND_FROM_EMAIL が設定されていません"
else
  echo "✅ RESEND_FROM_EMAIL: $RESEND_FROM_EMAIL"
fi

echo ""
echo "2. 必要なファイルの確認"
echo "-------------------"

# 主要なファイルの存在確認
files=(
  "src/app/signup/page.tsx"
  "src/app/setup/page.tsx"
  "src/app/personal/signup/page.tsx"
  "src/app/personal/setup/page.tsx"
  "src/app/api/send-welcome-email/route.ts"
  "src/app/auth/callback/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file が存在します"
  else
    echo "❌ $file が見つかりません"
  fi
done

echo ""
echo "3. 依存関係の確認"
echo "-------------------"

if [ -d "node_modules" ]; then
  echo "✅ node_modules が存在します"
else
  echo "❌ node_modules が見つかりません。npm install を実行してください"
fi

echo ""
echo "4. テスト用URL"
echo "-------------------"
echo "Biz新規登録: https://biz.co-shien.inu.co.jp/signup"
echo "パーソナル新規登録: https://my.co-shien.inu.co.jp/personal/signup"
echo ""

echo "=========================================="
echo "確認完了"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. npm run dev で開発サーバーを起動"
echo "2. 上記のURLにアクセスしてテストを実施"
echo "3. TESTING_GUIDE.md のチェックリストを確認"
echo ""

