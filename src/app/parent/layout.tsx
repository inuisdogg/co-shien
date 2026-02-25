import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Roots 保護者',
  description: '児童発達支援 - 保護者向け',
  manifest: '/parent/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roots 保護者',
  },
};

export const viewport: Viewport = {
  themeColor: '#8B5CF6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
