/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 画像最適化設定
  images: {
    unoptimized: true, // Netlifyで画像最適化を無効化（publicフォルダの画像を直接使用）
  },
  // ドメイン設定
  // Biz側: biz.co-shien.inu.co.jp
  // Personal側: my.co-shien.inu.co.jp
  // 環境変数 NEXT_PUBLIC_APP_TYPE で 'biz' または 'personal' を指定
  // NEXT_PUBLIC_BIZ_DOMAIN=biz.co-shien.inu.co.jp
  // NEXT_PUBLIC_PERSONAL_DOMAIN=my.co-shien.inu.co.jp
  
  // 注意: middleware.tsでサブドメインルーティングを処理しているため、
  // ここでのrewrite設定はフォールバックとしてのみ機能します
  async rewrites() {
    return [];
  },
}

module.exports = nextConfig



