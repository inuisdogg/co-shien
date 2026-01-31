#!/bin/bash

# co-shien iOS Apps Setup Script
# このスクリプトは3つのiOSアプリプロジェクトを初期化します

set -e

echo "========================================"
echo "co-shien iOS Apps Setup"
echo "========================================"

# カレントディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Node.jsのバージョン確認
echo ""
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Xcodeの確認
if ! command -v xcodebuild &> /dev/null; then
    echo "⚠️  Warning: Xcode is not installed. Please install Xcode from the App Store."
    echo "   iOS apps cannot be built without Xcode."
fi

# CocoaPodsの確認
if ! command -v pod &> /dev/null; then
    echo "⚠️  Warning: CocoaPods is not installed."
    echo "   Install with: sudo gem install cocoapods"
fi

# 各アプリを初期化
apps=("client" "staff" "facility")
app_names=("co-shien" "co-shien Staff" "co-shien Biz")
app_ids=("jp.co.inu.coshien.client" "jp.co.inu.coshien.staff" "jp.co.inu.coshien.facility")

for i in "${!apps[@]}"; do
    app="${apps[$i]}"
    name="${app_names[$i]}"
    id="${app_ids[$i]}"

    echo ""
    echo "----------------------------------------"
    echo "Setting up: $name ($app)"
    echo "----------------------------------------"

    cd "$SCRIPT_DIR/$app"

    # npm install
    echo "Installing dependencies..."
    npm install

    # capacitor.config.tsが存在することを確認
    if [ ! -f "capacitor.config.ts" ]; then
        echo "❌ Error: capacitor.config.ts not found in $app"
        exit 1
    fi

    # iOSプラットフォームを追加（既に存在する場合はスキップ）
    if [ ! -d "ios" ]; then
        echo "Adding iOS platform..."
        npx cap add ios
    else
        echo "iOS platform already exists, syncing..."
        npx cap sync ios
    fi

    echo "✅ $name setup complete!"
done

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Open each app in Xcode:"
echo "   cd ios-apps/client && npx cap open ios"
echo "   cd ios-apps/staff && npx cap open ios"
echo "   cd ios-apps/facility && npx cap open ios"
echo ""
echo "2. In Xcode, set up your Apple Developer account and signing"
echo ""
echo "3. Build and run on simulator or device"
echo ""
