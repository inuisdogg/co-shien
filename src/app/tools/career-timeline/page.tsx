import type { Metadata } from 'next';
import CareerTimelinePage from './CareerTimelineClient';

export const metadata: Metadata = {
  title: 'キャリアタイムライン作成ツール【保育士・幼稚園教諭・福祉職向け】| Roots',
  description:
    '保育士・幼稚園教諭・児童指導員・PT/OT/STのキャリアを視覚的に整理。資格取得、研修、異動の履歴をタイムラインで一覧化。PDF出力対応。',
  openGraph: {
    title: 'キャリアタイムライン作成ツール【保育士・幼稚園教諭・福祉職向け】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/STのキャリアを視覚的に整理。資格取得、研修、異動の履歴をタイムラインで一覧化。PDF出力対応。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'キャリアタイムライン作成ツール【保育士・幼稚園教諭・福祉職向け】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/STのキャリアを視覚的に整理。資格取得、研修、異動の履歴をタイムラインで一覧化。PDF出力対応。',
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "キャリアタイムライン作成ツール（保育士・福祉職向け）",
  "description":
    "保育士・幼稚園教諭・児童指導員・PT/OT/STのキャリアを視覚的に整理。資格取得、研修、異動の履歴をタイムラインで一覧化。PDF出力対応。",
  "url": "https://roots.inu.co.jp/tools/career-timeline",
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
      <CareerTimelinePage />
    </>
  );
}
