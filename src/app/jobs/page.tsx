/**
 * Jobs Listing Page — 求人一覧
 *
 * Public SEO-optimised page listing all published job postings
 * for childcare / welfare professionals. Fetches from Supabase and
 * renders a filterable, responsive grid of job cards.
 */

import type { Metadata } from 'next';
import JobsPageClient from './JobsPageClient';

/* ------------------------------------------------------------------ */
/*  SEO Metadata                                                       */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: '保育・福祉の求人情報 | Roots Jobs',
  description:
    '保育士・児童指導員・社会福祉士の求人情報。正社員・パート・スポットワーク。Rootsキャリアで理想の職場を見つけよう。',
  openGraph: {
    title: '保育・福祉の求人情報 | Roots Jobs',
    description:
      '保育士・児童指導員・社会福祉士の求人情報。正社員・パート・スポットワーク。Rootsキャリアで理想の職場を見つけよう。',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'Roots',
  },
  twitter: {
    card: 'summary_large_image',
    title: '保育・福祉の求人情報 | Roots Jobs',
    description:
      '保育士・児童指導員・社会福祉士の求人情報。正社員・パート・スポットワーク。',
  },
};

/* ------------------------------------------------------------------ */
/*  Page (Server Component)                                            */
/* ------------------------------------------------------------------ */

export default function JobsPage() {
  return <JobsPageClient />;
}
