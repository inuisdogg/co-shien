import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'co-shien 発達相談',
  description: '専門職によるオンライン発達相談サービス',
  manifest: '/consultation/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'co-shien 発達相談',
  },
};

export const viewport: Viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ConsultationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
