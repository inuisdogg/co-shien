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
  themeColor: '#F6AD55',
  width: 'device-width',
  initialScale: 1,
};

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
