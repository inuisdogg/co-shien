import type { Metadata } from 'next';
import CvGeneratorPage from './CVClient';

export const metadata: Metadata = {
  title: '保育士・幼稚園教諭・児童指導員の職務経歴書作成ツール【無料】| Roots',
  description:
    '保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料職務経歴書作成ツール。児童発達支援・放課後デイサービスなど福祉施設での経験をわかりやすく整理。PDFダウンロード対応。',
  openGraph: {
    title: '保育士・幼稚園教諭・児童指導員の職務経歴書作成ツール【無料】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料職務経歴書作成ツール。児童発達支援・放課後デイサービスなど福祉施設での経験をわかりやすく整理。PDFダウンロード対応。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '保育士・幼稚園教諭・児童指導員の職務経歴書作成ツール【無料】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料職務経歴書作成ツール。児童発達支援・放課後デイサービスなど福祉施設での経験をわかりやすく整理。PDFダウンロード対応。',
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "保育士・幼稚園教諭・児童指導員の職務経歴書作成ツール",
  "description":
    "保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料職務経歴書作成ツール。児童発達支援・放課後デイサービスなど福祉施設での経験をわかりやすく整理。PDFダウンロード対応。",
  "url": "https://roots.inu.co.jp/tools/cv",
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
      <CvGeneratorPage />
    </>
  );
}
