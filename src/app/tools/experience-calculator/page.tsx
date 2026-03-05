import type { Metadata } from 'next';
import ExperienceCalculatorClient from './ExperienceCalculatorClient';

export const metadata: Metadata = {
  title: '実務経験年数計算ツール【保育士試験・社会福祉士向け無料】| Roots',
  description:
    '実務経験の計算を無料で。保育士試験の実務経験ルート、社会福祉士の受験資格、児童指導員の実務経験年数を自動計算。複数施設の勤務期間を重複除外して正確に算出。実務経験証明書の発行にも対応。',
  keywords: [
    '実務経験 計算',
    '保育士試験 実務経験',
    '社会福祉士 受験資格',
    '児童指導員 実務経験',
    '実務経験年数 計算ツール',
    '児童発達支援管理責任者 実務経験',
    'サービス管理責任者 実務経験',
  ],
  openGraph: {
    title: '実務経験年数計算ツール【保育士試験・社会福祉士向け無料】| Roots',
    description:
      '実務経験の計算を無料で。保育士試験の実務経験ルート、社会福祉士の受験資格、児童指導員の実務経験年数を自動計算。複数施設の勤務期間を重複除外して正確に算出。',
    type: 'website',
    url: 'https://roots.inu.co.jp/tools/experience-calculator',
  },
  twitter: {
    card: 'summary_large_image',
    title: '実務経験年数計算ツール【保育士試験・社会福祉士向け無料】| Roots',
    description:
      '実務経験の計算を無料で。保育士試験の実務経験ルート、社会福祉士の受験資格、児童指導員の実務経験年数を自動計算。複数施設の勤務期間を重複除外して正確に算出。',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '実務経験年数計算ツール',
  description:
    '保育士試験・社会福祉士・児童指導員などの受験資格に必要な実務経験年数を自動計算。複数施設の勤務期間を重複除外して正確に算出する無料ツール。',
  url: 'https://roots.inu.co.jp/tools/experience-calculator',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'JPY',
  },
  creator: {
    '@type': 'Organization',
    name: 'Roots',
    url: 'https://roots.inu.co.jp',
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ExperienceCalculatorClient />
    </>
  );
}
