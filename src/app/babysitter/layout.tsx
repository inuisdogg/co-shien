import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'co-shien ベビーシッター',
  description: '専門職と過ごす、安心のシッティング。PT・OT・STなどの発達支援の専門家がお子様をお預かりします。',
  manifest: '/babysitter/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'co-shien ベビーシッター',
  },
};

export const viewport: Viewport = {
  themeColor: '#EC4899',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function BabysitterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
