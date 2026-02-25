import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Roots ビジネス',
  description: '児童発達支援 - 施設管理向け',
  manifest: '/business/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roots ビジネス',
  },
};

export const viewport: Viewport = {
  themeColor: '#3B82F6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
