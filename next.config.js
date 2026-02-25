/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 画像最適化設定
  images: {
    unoptimized: true, // Netlifyで画像最適化を無効化（publicフォルダの画像を直接使用）
  },
  // URL構成（パスベース）
  // ドメイン: roots.inu.co.jp
  // - /parent   : 保護者向け
  // - /career   : スタッフ向け
  // - /business : 施設管理向け
  async rewrites() {
    return [];
  },
}

module.exports = nextConfig



