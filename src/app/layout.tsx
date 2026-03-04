/**
 * Root Layout
 */

import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import GoogleAnalytics from '@/components/common/GoogleAnalytics';
import { ToastProvider } from '@/components/ui/Toast';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'Roots - 児童福祉施設向けSaaS',
  description: '施設運営・スタッフキャリア・保護者連携を一元管理',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/favicon-192.png',
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
  viewportFit: 'cover',
  themeColor: '#00c4cc',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={notoSansJP.className}>
        <GoogleAnalytics />
        <ServiceWorkerRegistration />
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
