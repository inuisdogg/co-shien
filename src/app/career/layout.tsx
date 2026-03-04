import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Roots キャリア',
  description: '専門職のためのキャリア管理',
  manifest: '/career/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roots キャリア',
  },
};

export const viewport: Viewport = {
  themeColor: '#818CF8',
  width: 'device-width',
  initialScale: 1,
};

export default function CareerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
