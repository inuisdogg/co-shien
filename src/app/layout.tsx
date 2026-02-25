/**
 * Root Layout
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';

const inter = Inter({ subsets: ['latin'] });

// 全ページを動的レンダリングに設定（AuthProviderがコンテキストを使用するため）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Roots - 児童福祉施設向けSaaS',
  description: '施設運営・スタッフキャリア・保護者連携を一元管理',
  icons: {
    icon: '/favicon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roots',
  },
};

// Next.js 14ではviewportとthemeColorは別のexportに
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#00c4cc',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ServiceWorkerRegistration />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

