#!/bin/bash
#
# iOS App Icon Generator
# macOS の sips コマンドを使用して 1024x1024 のソースアイコンから
# 必要な全サイズの iOS アプリアイコンを生成するスクリプト
#
# 使い方:
#   ./generate-icons.sh <source-icon-1024x1024.png> [app-name]
#
#   app-name: client, staff, facility, または all (デフォルト: all)
#
# 例:
#   ./generate-icons.sh icon-client.png client
#   ./generate-icons.sh icon.png all

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 引数チェック
if [ -z "$1" ]; then
  echo "使い方: $0 <source-icon-1024x1024.png> [client|staff|facility|all]"
  echo ""
  echo "例:"
  echo "  $0 icon.png all          # 全アプリに同じアイコンを設定"
  echo "  $0 icon-client.png client # clientアプリのみ"
  exit 1
fi

SOURCE_ICON="$1"
TARGET_APP="${2:-all}"

# ソースファイルの存在確認
if [ ! -f "$SOURCE_ICON" ]; then
  echo "エラー: ソースアイコンが見つかりません: $SOURCE_ICON"
  exit 1
fi

# ソースアイコンのサイズ確認
SOURCE_SIZE=$(sips -g pixelWidth "$SOURCE_ICON" | tail -1 | awk '{print $2}')
SOURCE_HEIGHT=$(sips -g pixelHeight "$SOURCE_ICON" | tail -1 | awk '{print $2}')

if [ "$SOURCE_SIZE" != "1024" ] || [ "$SOURCE_HEIGHT" != "1024" ]; then
  echo "警告: ソースアイコンは 1024x1024 が推奨です (現在: ${SOURCE_SIZE}x${SOURCE_HEIGHT})"
fi

# 必要なアイコンサイズ一覧
SIZES=(20 29 40 58 60 76 80 87 120 152 167 180 1024)

# アイコンを生成する関数
generate_icons() {
  local app_name="$1"
  local output_dir="${SCRIPT_DIR}/${app_name}/ios/App/App/Assets.xcassets/AppIcon.appiconset"

  # 出力ディレクトリの確認
  if [ ! -d "${SCRIPT_DIR}/${app_name}/ios/App/App/Assets.xcassets" ]; then
    echo "エラー: Assets.xcassets が見つかりません: ${app_name}"
    echo "  先に 'npx cap add ios' を実行してください"
    return 1
  fi

  # 出力ディレクトリを作成
  mkdir -p "$output_dir"

  echo "--- ${app_name} のアイコンを生成中 ---"

  # 各サイズのアイコンを生成
  for size in "${SIZES[@]}"; do
    local output_file="${output_dir}/AppIcon-${size}.png"
    sips -z "$size" "$size" "$SOURCE_ICON" --out "$output_file" > /dev/null 2>&1
    echo "  生成: AppIcon-${size}.png (${size}x${size})"
  done

  # Contents.json を生成
  cat > "${output_dir}/Contents.json" << 'CONTENTS_EOF'
{
  "images": [
    {
      "filename": "AppIcon-20.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-60.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-29.png",
      "idiom": "iphone",
      "scale": "1x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-58.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-87.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-80.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-120.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-120.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "60x60"
    },
    {
      "filename": "AppIcon-180.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "60x60"
    },
    {
      "filename": "AppIcon-20.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-40.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "20x20"
    },
    {
      "filename": "AppIcon-29.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-58.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "29x29"
    },
    {
      "filename": "AppIcon-40.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-80.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "40x40"
    },
    {
      "filename": "AppIcon-76.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "76x76"
    },
    {
      "filename": "AppIcon-152.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "76x76"
    },
    {
      "filename": "AppIcon-167.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "83.5x83.5"
    },
    {
      "filename": "AppIcon-1024.png",
      "idiom": "ios-marketing",
      "scale": "1x",
      "size": "1024x1024"
    }
  ],
  "info": {
    "author": "xcode",
    "version": 1
  }
}
CONTENTS_EOF

  echo "  生成: Contents.json"
  echo "  完了: ${app_name}"
  echo ""
}

# 対象アプリのアイコンを生成
case "$TARGET_APP" in
  client)
    generate_icons "client"
    ;;
  staff)
    generate_icons "staff"
    ;;
  facility)
    generate_icons "facility"
    ;;
  all)
    generate_icons "client"
    generate_icons "staff"
    generate_icons "facility"
    ;;
  *)
    echo "エラー: 不明なアプリ名: ${TARGET_APP}"
    echo "  client, staff, facility, または all を指定してください"
    exit 1
    ;;
esac

echo "全てのアイコン生成が完了しました"
