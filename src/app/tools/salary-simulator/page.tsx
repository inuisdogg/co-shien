import type { Metadata } from 'next';
import SalarySimulatorPage from './SalarySimulatorClient';

export const metadata: Metadata = {
  title: '処遇改善加算シミュレーター【保育士・福祉職向け】| Roots',
  description:
    '保育士・幼稚園教諭・児童指導員・PT/OT/STの処遇改善加算を無料でシミュレーション。経験年数・資格・研修履歴から加算額を自動計算。キャリアアップの参考に。',
  openGraph: {
    title: '処遇改善加算シミュレーター【保育士・福祉職向け】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/STの処遇改善加算を無料でシミュレーション。経験年数・資格・研修履歴から加算額を自動計算。キャリアアップの参考に。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '処遇改善加算シミュレーター【保育士・福祉職向け】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/STの処遇改善加算を無料でシミュレーション。経験年数・資格・研修履歴から加算額を自動計算。キャリアアップの参考に。',
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "処遇改善加算シミュレーター（保育士・福祉職向け）",
  "description":
    "保育士・幼稚園教諭・児童指導員・PT/OT/STの処遇改善加算を無料でシミュレーション。経験年数・資格・研修履歴から加算額を自動計算。キャリアアップの参考に。",
  "url": "https://roots.inu.co.jp/tools/salary-simulator",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "All",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "JPY",
  },
  "creator": {
    "@type": "Organization",
    "name": "Roots",
    "url": "https://roots.inu.co.jp",
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SalarySimulatorPage />
    </>
  );
}
