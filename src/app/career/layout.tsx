import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'co-shien キャリア',
  description: '専門職のためのキャリア管理',
  manifest: '/career/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'co-shien キャリア',
  },
};

export const viewport: Viewport = {
  themeColor: '#6366F1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function CareerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
