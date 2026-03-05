import type { Metadata } from 'next';
import ResumePage from './ResumeClient';

export const metadata: Metadata = {
  title: '保育士・幼稚園教諭・児童指導員の履歴書作成ツール【無料】| Roots',
  description:
    '保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料履歴書作成ツール。JIS規格の履歴書をオンラインで作成しPDFダウンロード。福祉・保育業界に特化したテンプレート。',
  openGraph: {
    title: '保育士・幼稚園教諭・児童指導員の履歴書作成ツール【無料】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料履歴書作成ツール。JIS規格の履歴書をオンラインで作成しPDFダウンロード。福祉・保育業界に特化したテンプレート。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '保育士・幼稚園教諭・児童指導員の履歴書作成ツール【無料】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料履歴書作成ツール。JIS規格の履歴書をオンラインで作成しPDFダウンロード。福祉・保育業界に特化したテンプレート。',
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "保育士・幼稚園教諭・児童指導員の履歴書作成ツール",
  "description":
    "保育士・幼稚園教諭・児童指導員・PT/OT/ST向けの無料履歴書作成ツール。JIS規格の履歴書をオンラインで作成しPDFダウンロード。福祉・保育業界に特化したテンプレート。",
  "url": "https://roots.inu.co.jp/tools/resume",
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
      <ResumePage />
    </>
  );
}
