/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ドメイン設定
  // Biz側: biz.co-shien.inu.co.jp
  // Personal側: my.co-shien.inu.co.jp
  // 環境変数 NEXT_PUBLIC_APP_TYPE で 'biz' または 'personal' を指定
  // NEXT_PUBLIC_BIZ_DOMAIN=biz.co-shien.inu.co.jp
  // NEXT_PUBLIC_PERSONAL_DOMAIN=my.co-shien.inu.co.jp
}

module.exports = nextConfig



