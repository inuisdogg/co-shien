/**
 * Root Layout
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'co-shien - 児童発達支援管理システム',
  description: '児童発達支援事業所向けの管理システム',
  icons: {
    icon: '/favicon.png',
  },
  manifest: '/manifest.json',
  themeColor: '#00c4cc',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'co-shien',
  },
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

